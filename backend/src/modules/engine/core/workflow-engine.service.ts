import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NodeHandlerRegistryService } from '../handlers/node-handler-registry.service';
import { VariableResolverService } from '../variables/variable-resolver.service';
import { OutboxService } from '../outbox/outbox.service';
import { IdempotencyService } from '../resilience/idempotency.service';
import { ConcurrencyLockService } from '../resilience/concurrency-lock.service';
import { ExecutionStateMachine } from '../state/execution-state-machine';
import {
  InboundEvent,
  VariableContext,
  NodeExecutionContext,
  NodeResult,
} from '../types/execution.types';
import { WorkflowDefinition, FlowNode } from '../../automations/schema/flow-node.types';
import { ExecutionStatus, ExecutionNodeStatus, LogLevel } from '@prisma/client';

const MAX_CONSECUTIVE_STEPS = 25; // Proteção contra loops infinitos

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nodeRegistry: NodeHandlerRegistryService,
    private readonly variableResolver: VariableResolverService,
    private readonly outboxService: OutboxService,
    private readonly idempotency: IdempotencyService,
    private readonly concurrencyLock: ConcurrencyLockService,
  ) {}

  /**
   * Ponto de entrada principal para qualquer evento recebido de mensagem do WhatsApp
   */
  async handleInboundEvent(event: InboundEvent): Promise<{
    processed: boolean;
    executionId?: string;
    reason?: string;
  }> {
    const { tenantId, contactPhone, messageId } = event;

    // 1. Idempotência: ignora eventos já processados
    const isNew = await this.idempotency.checkAndSet(tenantId, messageId);
    if (!isNew) {
      this.logger.warn(`Mensagem duplicada descartada por idempotência [ID: ${messageId}]`);
      return { processed: false, reason: 'duplicate_message' };
    }

    // 2. Concorrência: adquire trava atômica para a conversa deste contato
    const lockToken = await this.concurrencyLock.acquireLock(tenantId, contactPhone);
    if (!lockToken) {
      this.logger.warn(`Conversa bloqueada por processamento concorrente para ${contactPhone}. Reenfileirando...`);
      // Libera idempotência para que o retry possa reprocessar quando a trava liberar
      await this.idempotency.clear(tenantId, messageId);
      return { processed: false, reason: 'concurrency_lock_busy' };
    }

    try {
      // 3. Identifica ou provisiona o Contato no banco
      const contact = await this.ensureContact(tenantId, contactPhone, event.contactName);

      // 3.1 Verificação de Opt-out / Descadastramento (Conformidade Meta WhatsApp)
      const rawText = String(event.interaction?.value || '').trim();
      const isOptOut = /^(sair|stop|cancelar|parar|descadastrar)$/i.test(rawText);
      if (isOptOut) {
        const currentCustomFields = (contact.customFields as Record<string, any>) || {};
        const currentTags = contact.tags || [];
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: {
            tags: currentTags.includes('OPT_OUT') ? currentTags : [...currentTags, 'OPT_OUT'],
            customFields: {
              ...currentCustomFields,
              optOut: true,
              optOutAt: new Date().toISOString(),
            },
          },
        });

        // Cancela qualquer execução ativa
        const active = await this.findActiveExecution(tenantId, contactPhone);
        if (active) {
          await this.prisma.flowExecution.update({
            where: { id: active.id },
            data: { status: ExecutionStatus.CANCELLED, completedAt: new Date() },
          });
        }

        await this.outboxService.recordOutgoingMessage(
          tenantId,
          active?.id || null,
          event.instanceName || 'whatsapp-default',
          contactPhone,
          'text',
          { text: 'Você foi descadastrado com sucesso das comunicações automatizadas. Para reativar, envie QUERO VOLTAR.' },
        );

        return { processed: true, reason: 'opt_out_completed' };
      }

      // 3.2 Verificação de Opt-in / Reativação de Consentimento
      const isOptIn = /^(quero voltar|reativar|opt-in)$/i.test(rawText);
      const customFields = (contact.customFields as Record<string, any>) || {};
      if (customFields.optOut) {
        if (isOptIn) {
          await this.prisma.contact.update({
            where: { id: contact.id },
            data: {
              tags: contact.tags.filter((t) => t !== 'OPT_OUT'),
              customFields: {
                ...customFields,
                optOut: false,
                consentGivenAt: new Date().toISOString(),
              },
            },
          });
          await this.outboxService.recordOutgoingMessage(
            tenantId,
            null,
            event.instanceName || 'whatsapp-default',
            contactPhone,
            'text',
            { text: 'Seu consentimento foi reativado com sucesso! Como podemos te ajudar hoje?' },
          );
          return { processed: true, reason: 'opt_in_completed' };
        } else {
          this.logger.log(`Mensagem ignorada para contato com opt-out ativo: ${contactPhone}`);
          return { processed: false, reason: 'contact_opted_out' };
        }
      }

      // 4. Verifica se existe uma sessão ativa em andamento para este contato
      const activeExecution = await this.findActiveExecution(tenantId, contactPhone);

      // 4.1 Cenário A: Sessão ativa aguardando resposta
      if (activeExecution) {
        if (
          activeExecution.status === ExecutionStatus.WAITING_FOR_INPUT ||
          activeExecution.status === ExecutionStatus.WAITING_INPUT
        ) {
          this.logger.log(`Retomando execução pendente [${activeExecution.id}] para ${contactPhone}`);
          await this.resumeExecution(activeExecution, event);
          return { processed: true, executionId: activeExecution.id };
        }

        if (
          activeExecution.status === ExecutionStatus.HUMAN_HANDOFF ||
          activeExecution.status === ExecutionStatus.HANDOVER_HUMAN
        ) {
          this.logger.log(`Mensagem recebida para conversa em atendimento humano. Bot inativo.`);
          return { processed: false, reason: 'human_handoff_active' };
        }
      }

      // 4.2 Cenário B: Nenhuma sessão ativa -> Avalia gatilhos para iniciar novo fluxo com prioridade
      const matchedTrigger = await this.matchTrigger(tenantId, event.interaction.value, contactPhone);
      if (!matchedTrigger) {
        this.logger.debug(`Nenhum gatilho ativado para a mensagem recebida: "${event.interaction.value}"`);
        return { processed: false, reason: 'no_trigger_matched' };
      }

      this.logger.log(
        `Gatilho encontrado! Iniciando nova automação "${matchedTrigger.automation.name}" para ${contactPhone}`,
      );

      const execution = await this.startNewExecution(
        tenantId,
        matchedTrigger.automation,
        matchedTrigger.flowVersion,
        contact,
        event,
      );

      return { processed: true, executionId: execution.id };
    } finally {
      await this.concurrencyLock.releaseLock(tenantId, contactPhone, lockToken);
    }
  }

  /**
   * Inicia uma nova execução a partir de um gatilho correspondente
   */
  private async startNewExecution(
    tenantId: string,
    automation: any,
    flowVersion: any,
    contact: any,
    event: InboundEvent,
  ) {
    const definition = flowVersion.definition as unknown as WorkflowDefinition;
    const triggerNode = definition.nodes.find((n) => {
      const type = this.getNodeType(n);
      return (
        type === 'trigger' ||
        type.startsWith('trigger.') ||
        type.startsWith('trigger_')
      );
    });

    if (!triggerNode) {
      throw new NotFoundException(`Nó de gatilho não encontrado na versão ${flowVersion.versionNumber}`);
    }

    // Cria registro de execução no banco
    const execution = await this.prisma.flowExecution.create({
      data: {
        tenantId,
        automationId: automation.id,
        flowVersionId: flowVersion.id,
        contactId: contact.id,
        instanceName: event.instanceName,
        contactPhone: contact.phone,
        contactName: contact.name,
        status: ExecutionStatus.RUNNING,
        currentNodeId: triggerNode.id,
        contextData: {},
      },
    });

    // Constrói o contexto inicial de variáveis
    const variableContext = this.buildVariableContext(
      contact,
      execution,
      automation,
      flowVersion,
      {},
    );

    // Executa a árvore a partir do nó de gatilho
    await this.runStepLoop(execution.id, triggerNode, definition, variableContext, event.interaction);

    return execution;
  }

  /**
   * Retoma uma execução que estava pausada aguardando resposta
   */
  private async resumeExecution(execution: any, event: InboundEvent) {
    const flowVersion = await this.prisma.flowVersion.findUnique({
      where: { id: execution.flowVersionId },
      include: { automation: true },
    });

    if (!flowVersion) {
      throw new NotFoundException(`Versão de fluxo vinculada à execução ${execution.id} não encontrada.`);
    }

    const definition = flowVersion.definition as unknown as WorkflowDefinition;
    const currentNode = definition.nodes.find((n) => n.id === execution.currentNodeId);

    if (!currentNode) {
      throw new NotFoundException(`Nó atual ${execution.currentNodeId} não encontrado no grafo.`);
    }

    // Altera status de volta para RUNNING com transição validada
    ExecutionStateMachine.validateTransition(execution.status, ExecutionStatus.RUNNING);
    await this.prisma.flowExecution.update({
      where: { id: execution.id },
      data: {
        status: ExecutionStatus.RUNNING,
        lastInteractionAt: new Date(),
      },
    });

    const contact = await this.prisma.contact.findUnique({ where: { id: execution.contactId } });
    const currentVariables = (execution.contextData as Record<string, any>) || {};

    const variableContext = this.buildVariableContext(
      contact,
      execution,
      flowVersion.automation,
      flowVersion,
      currentVariables,
    );

    // Executa o nó com a resposta recebida
    await this.runStepLoop(execution.id, currentNode, definition, variableContext, event.interaction, true);
  }

  /**
   * Loop sequencial que navega e executa os nós do fluxo até encontrar um nó bloqueante
   */
  private async runStepLoop(
    executionId: string,
    startNode: FlowNode,
    definition: WorkflowDefinition,
    variableContext: VariableContext,
    initialInteraction?: any,
    isResume = false,
  ): Promise<void> {
    let currentNode: FlowNode | null = startNode;
    let currentInteraction = initialInteraction;
    let stepCount = 0;

    const nodeMap = new Map<string, FlowNode>(definition.nodes.map((n) => [n.id, n]));
    const outgoingEdges = new Map<string, any[]>();
    for (const edge of definition.edges || []) {
      if (!outgoingEdges.has(edge.source)) outgoingEdges.set(edge.source, []);
      outgoingEdges.get(edge.source)!.push(edge);
    }

    while (currentNode) {
      stepCount++;
      if (stepCount > MAX_CONSECUTIVE_STEPS) {
        this.logger.error(`Execução ${executionId} abortada: limite de ${MAX_CONSECUTIVE_STEPS} passos consecutivos excedido.`);
        await this.finalizeExecution(executionId, ExecutionStatus.FAILED, currentNode.id, variableContext);
        return;
      }

      const rawNodeType = this.getNodeType(currentNode);
      const handler = this.nodeRegistry.getHandler(rawNodeType);
      if (!handler) {
        this.logger.error(`Nenhum handler registrado para o nó ${currentNode.id} (${rawNodeType}).`);
        await this.finalizeExecution(executionId, ExecutionStatus.FAILED, currentNode.id, variableContext);
        return;
      }

      // Registra início do passo no log
      const execNodeRecord = await this.prisma.flowExecutionNode.create({
        data: {
          tenantId: variableContext.company.id,
          executionId,
          nodeId: currentNode.id,
          nodeType: rawNodeType,
          status: ExecutionNodeStatus.RUNNING,
          inputPayload: currentInteraction ? { interaction: currentInteraction } : null,
        },
      });

      const effectiveNode: FlowNode = {
        ...currentNode,
        type: rawNodeType as any,
        config:
          currentNode.config && Object.keys(currentNode.config).length > 0
            ? currentNode.config
            : currentNode.data?.config || currentNode.config || {},
      };

      // Cria contexto de execução do nó
      const nodeContext: NodeExecutionContext = {
        tenantId: variableContext.company.id,
        executionId,
        node: effectiveNode,
        flowDefinition: definition,
        variables: variableContext,
        incomingInteraction: currentInteraction,
        outboxMessage: async (msgType, recipient, payload) => {
          return this.outboxService.recordOutgoingMessage(
            variableContext.company.id,
            executionId,
            variableContext.execution.instanceName || 'whatsapp-default',
            recipient,
            msgType,
            payload,
          );
        },
      };

      // Executa o handler do nó
      let result: NodeResult;
      try {
        result = await handler.execute(nodeContext);
      } catch (err) {
        this.logger.error(`Erro ao executar nó ${currentNode.id}: ${err.message}`, err.stack);
        await this.prisma.flowExecutionNode.update({
          where: { id: execNodeRecord.id },
          data: {
            status: ExecutionNodeStatus.FAILED,
            error: err.message,
            completedAt: new Date(),
          },
        });
        await this.logStep(executionId, currentNode.id, LogLevel.ERROR, `Erro no nó ${currentNode.id}: ${err.message}`);
        await this.finalizeExecution(executionId, ExecutionStatus.FAILED, currentNode.id, variableContext);
        return;
      }

      // Atualiza variáveis calculadas
      if (result.variableUpdates) {
        Object.assign(variableContext.execution.variables, result.variableUpdates);
      }

      // Conclui o passo
      await this.prisma.flowExecutionNode.update({
        where: { id: execNodeRecord.id },
        data: {
          status: result.success ? ExecutionNodeStatus.COMPLETED : ExecutionNodeStatus.FAILED,
          outputPayload: result.outputPayload || null,
          error: result.error || null,
          completedAt: new Date(),
        },
      });

      await this.logStep(
        executionId,
        currentNode.id,
        result.success ? LogLevel.INFO : LogLevel.WARN,
        `Passo executado: ${currentNode.type} -> Saída: ${result.nextHandle || 'nenhuma'}`,
      );

      // Persiste variáveis e nó atual na execução
      await this.prisma.flowExecution.update({
        where: { id: executionId },
        data: {
          currentNodeId: currentNode.id,
          contextData: variableContext.execution.variables,
        },
      });

      // Sincroniza dados do contato caso tenham sido alterados (ex: tags, customFields)
      if (variableContext.contact?.phone) {
        await this.prisma.contact.updateMany({
          where: {
            tenantId: variableContext.company.id,
            phone: variableContext.contact.phone,
          },
          data: {
            name: variableContext.contact.name,
            tags: variableContext.contact.tags,
            customFields: variableContext.contact.customFields,
            lastInteractionAt: new Date(),
          },
        }).catch((err) => {
          this.logger.warn(`Falha ao sincronizar dados do contato ${variableContext.contact.phone}: ${err.message}`);
        });
      }

      // 4. Verifica se o nó é bloqueante ou finalizador
      if (result.waitingForInput) {
        await this.pauseExecution(executionId, ExecutionStatus.WAITING_FOR_INPUT, currentNode.id, variableContext);
        return;
      }

      if (result.waitingForDelaySeconds && result.waitingForDelaySeconds > 0) {
        await this.pauseExecution(executionId, ExecutionStatus.WAITING_FOR_DELAY, currentNode.id, variableContext);
        return;
      }

      if (result.statusTransition === ExecutionStatus.HUMAN_HANDOFF) {
        await this.finalizeExecution(executionId, ExecutionStatus.HUMAN_HANDOFF, currentNode.id, variableContext);
        return;
      }

      if (result.statusTransition === ExecutionStatus.COMPLETED) {
        await this.finalizeExecution(executionId, ExecutionStatus.COMPLETED, currentNode.id, variableContext);
        return;
      }

      // 5. Determina o próximo nó a partir da aresta de saída
      const edges = outgoingEdges.get(currentNode.id) || [];
      let targetNodeId: string | null = null;

      if (result.nextHandle) {
        const edgeWithHandle = edges.find((e) => e.sourceHandle === result.nextHandle);
        if (edgeWithHandle) {
          targetNodeId = edgeWithHandle.target;
        } else if (result.nextHandle === 'default' && edges.length > 0) {
          targetNodeId = edges[0].target;
        }
      } else if (edges.length > 0) {
        targetNodeId = edges[0].target;
      }

      if (!targetNodeId) {
        // Fim do caminho sem nó explícito de encerramento
        await this.finalizeExecution(executionId, ExecutionStatus.COMPLETED, currentNode.id, variableContext);
        return;
      }

      currentNode = nodeMap.get(targetNodeId) || null;
      currentInteraction = undefined; // Limpa entrada para nós subsequentes
    }
  }

  /**
   * Pausa a execução no estado de espera
   */
  private async pauseExecution(
    executionId: string,
    status: ExecutionStatus,
    nodeId: string,
    variableContext: VariableContext,
  ) {
    ExecutionStateMachine.validateTransition(ExecutionStatus.RUNNING, status);
    await this.prisma.flowExecution.update({
      where: { id: executionId },
      data: {
        status,
        currentNodeId: nodeId,
        contextData: variableContext.execution.variables,
        lastInteractionAt: new Date(),
      },
    });
    this.logger.log(`Execução ${executionId} pausada no estado ${status} (nó ${nodeId}).`);
  }

  /**
   * Finaliza a execução
   */
  private async finalizeExecution(
    executionId: string,
    status: ExecutionStatus,
    nodeId: string,
    variableContext: VariableContext,
  ) {
    ExecutionStateMachine.validateTransition(ExecutionStatus.RUNNING, status);
    await this.prisma.flowExecution.update({
      where: { id: executionId },
      data: {
        status,
        currentNodeId: nodeId,
        contextData: variableContext.execution.variables,
        completedAt: new Date(),
      },
    });
    this.logger.log(`Execução ${executionId} finalizada com status ${status}.`);
  }

  /**
   * Registra log estruturado de execução
   */
  private async logStep(executionId: string, nodeId: string, level: LogLevel, message: string) {
    try {
      const execution = await this.prisma.flowExecution.findUnique({
        where: { id: executionId },
        select: { tenantId: true },
      });
      if (execution) {
        await this.prisma.flowExecutionLog.create({
          data: {
            tenantId: execution.tenantId,
            executionId,
            nodeId,
            level,
            message,
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Falha ao gravar execution log: ${err.message}`);
    }
  }

  /**
   * Procura uma sessão ativa para o contato
   */
  private async findActiveExecution(tenantId: string, contactPhone: string) {
    return this.prisma.flowExecution.findFirst({
      where: {
        tenantId,
        contactPhone,
        status: {
          in: [
            ExecutionStatus.WAITING_FOR_INPUT,
            ExecutionStatus.WAITING_INPUT,
            ExecutionStatus.WAITING_FOR_DELAY,
            ExecutionStatus.WAITING_DELAY,
            ExecutionStatus.HUMAN_HANDOFF,
            ExecutionStatus.HANDOVER_HUMAN,
            ExecutionStatus.RUNNING,
          ],
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Avalia os gatilhos cadastrados com priorização estrita:
   * 1. KEYWORD_EXACT
   * 2. KEYWORD_CONTAINS
   * 3. REGEX
   * 4. FIRST_INTERACTION
   * 5. ANY_MESSAGE
   */
  private async matchTrigger(tenantId: string, text: string, contactPhone?: string) {
    const rawText = (text || '').trim().toLowerCase();

    const triggers = await this.prisma.automationTrigger.findMany({
      where: {
        tenantId,
        isActive: true,
        automation: {
          status: 'PUBLISHED',
          activeVersionId: { not: null },
        },
      },
      include: {
        automation: true,
      },
    });

    const TRIGGER_PRIORITY: Record<string, number> = {
      KEYWORD_EXACT: 1,
      KEYWORD_CONTAINS: 2,
      REGEX: 3,
      FIRST_INTERACTION: 4,
      ANY_MESSAGE: 5,
    };

    // Ordena os gatilhos por nível de especificidade e prioridade
    triggers.sort(
      (a, b) => (TRIGGER_PRIORITY[a.type] || 99) - (TRIGGER_PRIORITY[b.type] || 99),
    );

    for (const trigger of triggers) {
      const cfg = (trigger.config || {}) as any;
      let matched = false;

      switch (trigger.type) {
        case 'KEYWORD_EXACT': {
          const keywords = Array.isArray(cfg.keywords)
            ? cfg.keywords
            : cfg.keyword
            ? [cfg.keyword]
            : [];
          matched = keywords.some((k: string) => k.toLowerCase().trim() === rawText);
          break;
        }

        case 'KEYWORD_CONTAINS': {
          const keywords = Array.isArray(cfg.keywords)
            ? cfg.keywords
            : cfg.keyword
            ? [cfg.keyword]
            : [];
          matched = keywords.some((k: string) => rawText.includes(k.toLowerCase().trim()));
          break;
        }

        case 'REGEX': {
          if (cfg.regexPattern) {
            try {
              const reg = new RegExp(cfg.regexPattern, 'i');
              matched = reg.test(text);
            } catch {
              matched = false;
            }
          }
          break;
        }

        case 'FIRST_INTERACTION': {
          if (contactPhone) {
            const previousCount = await this.prisma.flowExecution.count({
              where: { tenantId, contactPhone },
            });
            matched = previousCount === 0;
          } else {
            matched = true;
          }
          break;
        }

        case 'ANY_MESSAGE':
          matched = true;
          break;
      }

      if (matched && trigger.automation.activeVersionId) {
        const flowVersion = await this.prisma.flowVersion.findUnique({
          where: { id: trigger.automation.activeVersionId },
        });
        if (flowVersion) {
          return {
            trigger,
            automation: trigger.automation,
            flowVersion,
          };
        }
      }
    }

    return null;
  }

  /**
   * Garante a existência do contato no banco
   */
  private async ensureContact(tenantId: string, phone: string, name?: string) {
    return this.prisma.contact.upsert({
      where: {
        tenantId_phone: { tenantId, phone },
      },
      update: {
        name: name || undefined,
      },
      create: {
        tenantId,
        phone,
        name: name || `WhatsApp ${phone.slice(-4)}`,
        tags: [],
        customFields: {},
      },
    });
  }

  /**
   * Constrói o contexto padronizado de variáveis
   */
  private buildVariableContext(
    contact: any,
    execution: any,
    automation: any,
    flowVersion: any,
    initialVars: Record<string, any>,
  ): VariableContext {
    return {
      contact: {
        id: contact?.id,
        phone: contact?.phone,
        name: contact?.name || 'Cliente',
        tags: contact?.tags || [],
        customFields: (contact?.customFields as Record<string, any>) || {},
      },
      conversation: {
        id: `conv_${contact?.phone}`,
        lastMessage: '',
        lastInteractionAt: new Date(),
      },
      execution: {
        id: execution?.id,
        status: execution?.status || ExecutionStatus.RUNNING,
        startedAt: execution?.startedAt || new Date(),
        currentNodeId: execution?.currentNodeId,
        variables: { ...initialVars },
        instanceName: execution?.instanceName,
      },
      company: {
        id: automation.tenantId,
        name: 'Minha Empresa',
      },
      flow: {
        id: automation.id,
        name: automation.name,
        version: flowVersion.versionNumber,
        versionId: flowVersion.id,
      },
    };
  }

  /**
   * Obtém o tipo real do nó, com fallback para metadados do React Flow (data.nodeType)
   */
  private getNodeType(node?: FlowNode): string {
    if (!node) return '';
    if (node.type && (node.type as string) !== 'custom') {
      return node.type as string;
    }
    return (
      node.data?.nodeType ||
      node.data?.type ||
      node.data?.label ||
      (node.type as string) ||
      ''
    );
  }
}
