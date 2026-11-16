import { Injectable } from '@nestjs/common';
import {
  WorkflowDefinition,
  FlowNode,
  FlowEdge,
  FlowNodeType,
  TriggerNodeConfig,
  MessageTextNodeConfig,
  MessageMediaNodeConfig,
  ButtonsNodeConfig,
  ListInteractiveNodeConfig,
  QuestionInputNodeConfig,
  ConditionNodeConfig,
  SwitchNodeConfig,
  DelayNodeConfig,
  WaitReplyNodeConfig,
  SetVariableNodeConfig,
} from '../schema/flow-node.types';
import {
  FlowValidationResult,
  ValidationErrorDetail,
  ValidationCodes,
} from './flow-validator.types';

// Nós que pausam a execução aguardando tempo ou interação do usuário
const BLOCKING_NODE_TYPES: string[] = [
  'question_input',
  'wait_reply',
  'delay',
  'interaction.question',
  'logic.delay',
  'logic.wait_for_input',
];

// Variáveis de sistema e contato sempre disponíveis
const SYSTEM_VARIABLES = new Set([
  'contact.name',
  'contact.phone',
  'contact.id',
  'now',
  'system.date',
]);

@Injectable()
export class FlowValidatorService {
  /**
   * Valida integralmente um fluxo de automação conversacional
   */
  validate(
    definition: WorkflowDefinition,
    options?: { capabilities?: any; allowFallback?: boolean },
  ): FlowValidationResult {
    const errors: ValidationErrorDetail[] = [];
    const warnings: ValidationErrorDetail[] = [];

    // 1. Estrutura raiz
    if (!definition || !Array.isArray(definition.nodes) || definition.nodes.length === 0) {
      errors.push({
        field: 'nodes',
        message: 'O fluxo precisa conter pelo menos um nó.',
        code: ValidationCodes.FLOW_EMPTY,
      });
      return { isValid: false, errors, warnings };
    }

    const nodes = definition.nodes;
    const edges = Array.isArray(definition.edges) ? definition.edges : [];
    const declaredVariables = new Set(
      (definition.variables || []).map((v) => v.name.toLowerCase().trim()),
    );

    // Mapeamentos para validação
    const nodeMap = new Map<string, FlowNode>();
    const nodeIds = new Set<string>();
    let triggerCount = 0;

    // 2. Validação de identificadores e nós individuais
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      // 2.1 Identificador obrigatório
      if (!node.id || typeof node.id !== 'string' || node.id.trim() === '') {
        errors.push({
          nodeId: node.id || `node_index_${i}`,
          field: 'id',
          message: `O nó no índice ${i} não possui um identificador válido.`,
          code: ValidationCodes.NODE_MISSING_ID,
        });
        continue;
      }

      // 2.2 Identificador duplicado
      if (nodeIds.has(node.id)) {
        errors.push({
          nodeId: node.id,
          field: 'id',
          message: `Identificador de nó duplicado: "${node.id}". Cada nó deve possuir um ID exclusivo.`,
          code: ValidationCodes.DUPLICATE_NODE_ID,
        });
      } else {
        nodeIds.add(node.id);
        nodeMap.set(node.id, node);
      }

      const rawType = this.getNodeType(node);
      const normType = this.normalizeNodeType(node);
      if (normType === 'trigger') {
        triggerCount++;
      }

      // 2.3 Validação de configurações por tipo de nó
      this.validateNodeConfig(node, errors, warnings, declaredVariables);

      // 2.4 Validação de compatibilidade com capacidades do provedor selecionado
      if (options?.capabilities) {
        const caps = options.capabilities;
        if ((normType === 'template' || rawType === 'message.template') && !caps.template) {
          errors.push({
            nodeId: node.id,
            field: 'type',
            message: `Nó de modelo pré-aprovado (Template) não é suportado pelo provedor ${caps.providerType || 'selecionado'}.`,
            code: 'INCOMPATIBLE_CAPABILITY',
          });
        }

        if ((normType === 'buttons' || rawType === 'message.buttons') && !caps.buttons) {
          if (options.allowFallback === false) {
            errors.push({
              nodeId: node.id,
              field: 'type',
              message: `Nó de botões nativos incompatível com a conexão ${caps.providerType}.`,
              code: 'INCOMPATIBLE_CAPABILITY',
            });
          } else {
            warnings.push({
              nodeId: node.id,
              field: 'type',
              message: `A conexão ${caps.providerType} não renderiza botões nativos. Será aplicado fallback para menu textual numerado.`,
              code: 'CAPABILITY_FALLBACK_APPLIED',
            });
          }
        }

        if ((normType === 'list' || rawType === 'message.list') && !caps.list) {
          if (options.allowFallback === false) {
            errors.push({
              nodeId: node.id,
              field: 'type',
              message: `Nó de lista interativa incompatível com a conexão ${caps.providerType}.`,
              code: 'INCOMPATIBLE_CAPABILITY',
            });
          } else {
            warnings.push({
              nodeId: node.id,
              field: 'type',
              message: `A conexão ${caps.providerType} não renderiza listas interativas. Será aplicado fallback para menu textual estruturado.`,
              code: 'CAPABILITY_FALLBACK_APPLIED',
            });
          }
        }
      }
    }

    // 3. Ausência de nó de gatilho
    if (triggerCount === 0) {
      errors.push({
        field: 'nodes',
        message: 'O fluxo deve conter pelo menos um nó de gatilho (Trigger).',
        code: ValidationCodes.MISSING_TRIGGER,
      });
    }

    // 4. Validação de Edges (Conexões)
    const edgeIds = new Set<string>();
    const outgoingByNode = new Map<string, FlowEdge[]>();
    const incomingByNode = new Map<string, FlowEdge[]>();
    const connectionKeySet = new Set<string>();

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];

      // 4.1 Identificador de aresta obrigatório
      if (!edge.id || typeof edge.id !== 'string' || edge.id.trim() === '') {
        errors.push({
          edgeId: edge.id || `edge_index_${i}`,
          field: 'id',
          message: `A conexão no índice ${i} não possui um identificador válido.`,
          code: ValidationCodes.EDGE_MISSING_ID,
        });
        continue;
      }

      // 4.2 Identificador de aresta duplicado
      if (edgeIds.has(edge.id)) {
        errors.push({
          edgeId: edge.id,
          field: 'id',
          message: `Identificador de conexão duplicado: "${edge.id}".`,
          code: ValidationCodes.DUPLICATE_EDGE_ID,
        });
      } else {
        edgeIds.add(edge.id);
      }

      // 4.3 Nós de origem e destino existentes
      const sourceExists = nodeMap.has(edge.source);
      const targetExists = nodeMap.has(edge.target);

      if (!sourceExists) {
        errors.push({
          edgeId: edge.id,
          field: 'source',
          message: `Conexão "${edge.id}" referencia nó de origem inexistente: "${edge.source}".`,
          code: ValidationCodes.EDGE_INVALID_SOURCE,
        });
      }

      if (!targetExists) {
        errors.push({
          edgeId: edge.id,
          field: 'target',
          message: `Conexão "${edge.id}" referencia nó de destino inexistente: "${edge.target}".`,
          code: ValidationCodes.EDGE_INVALID_TARGET,
        });
      }

      // Se um dos nós não existe, pula checagens detalhadas dessa aresta
      if (!sourceExists || !targetExists) {
        continue;
      }

      // 4.4 Auto-conexão (source === target)
      if (edge.source === edge.target) {
        errors.push({
          edgeId: edge.id,
          nodeId: edge.source,
          field: 'target',
          message: `O nó "${edge.source}" não pode se conectar a si mesmo diretamente.`,
          code: ValidationCodes.SELF_CONNECTION,
        });
      }

      // 4.5 Conexão duplicada idêntica
      const connKey = `${edge.source}__${edge.sourceHandle || 'default'}__${edge.target}`;
      if (connectionKeySet.has(connKey)) {
        errors.push({
          edgeId: edge.id,
          message: `Conexão redundante duplicada entre o nó "${edge.source}" e "${edge.target}".`,
          code: ValidationCodes.DUPLICATE_CONNECTION,
        });
      } else {
        connectionKeySet.add(connKey);
      }

      // 4.6 Restrição: Gatilho não pode ter aresta de entrada
      const targetNode = nodeMap.get(edge.target);
      if (targetNode && this.normalizeNodeType(targetNode) === 'trigger') {
        errors.push({
          edgeId: edge.id,
          nodeId: edge.target,
          field: 'target',
          message: `O nó de gatilho "${edge.target}" é o ponto de entrada do fluxo e não pode receber conexões de outros nós.`,
          code: ValidationCodes.TRIGGER_HAS_INCOMING,
        });
      }

      // 4.7 Restrição: Nós de encerramento não podem ter arestas de saída
      const sourceNode = nodeMap.get(edge.source);
      if (sourceNode) {
        const normSourceType = this.normalizeNodeType(sourceNode);
        if (normSourceType === 'end_flow' || normSourceType === 'human_transfer') {
          errors.push({
            edgeId: edge.id,
            nodeId: edge.source,
            field: 'source',
            message: `O nó "${edge.source}" (${this.getNodeType(sourceNode)}) encerra o fluxo e não pode ter conexões de saída.`,
            code: ValidationCodes.END_NODE_HAS_OUTGOING,
          });
        }
      }

      // Agrupa conexões
      if (!outgoingByNode.has(edge.source)) outgoingByNode.set(edge.source, []);
      outgoingByNode.get(edge.source)!.push(edge);

      if (!incomingByNode.has(edge.target)) incomingByNode.set(edge.target, []);
      incomingByNode.get(edge.target)!.push(edge);
    }

    // 5. Validação de Portas e Caminhos Obrigatórios
    for (const [nodeId, node] of nodeMap.entries()) {
      const outgoing = outgoingByNode.get(nodeId) || [];
      const nodeNormalizedType = this.normalizeNodeType(node);

      switch (nodeNormalizedType) {
        case 'condition': {
          const hasTrue = outgoing.some((e) => e.sourceHandle === 'true');
          const hasFalse = outgoing.some((e) => e.sourceHandle === 'false');

          if (!hasTrue) {
            errors.push({
              nodeId,
              field: 'handles',
              message: `O nó de condição "${nodeId}" deve possuir uma conexão saindo da porta "true".`,
              code: ValidationCodes.MISSING_MANDATORY_OUTPUT_EDGE,
            });
          }
          if (!hasFalse) {
            errors.push({
              nodeId,
              field: 'handles',
              message: `O nó de condição "${nodeId}" deve possuir uma conexão saindo da porta "false".`,
              code: ValidationCodes.MISSING_MANDATORY_OUTPUT_EDGE,
            });
          }

          // Valida se há handles inválidos
          for (const e of outgoing) {
            if (e.sourceHandle !== 'true' && e.sourceHandle !== 'false') {
              errors.push({
                edgeId: e.id,
                nodeId,
                field: 'sourceHandle',
                message: `Porta inválida "${e.sourceHandle}" no nó de condição "${nodeId}". Esperado "true" ou "false".`,
                code: ValidationCodes.INVALID_HANDLE,
              });
            }
          }
          break;
        }

        case 'switch': {
          const cfg = (node.config || {}) as SwitchNodeConfig;
          const caseIds = new Set((cfg.cases || []).map((c) => c.id));
          const hasDefault = outgoing.some((e) => e.sourceHandle === 'default');

          if (!hasDefault) {
            errors.push({
              nodeId,
              field: 'handles',
              message: `O nó Switch "${nodeId}" deve possuir uma conexão de saída para o caso padrão "default".`,
              code: ValidationCodes.MISSING_MANDATORY_OUTPUT_EDGE,
            });
          }

          for (const caseId of caseIds) {
            const hasCaseEdge = outgoing.some((e) => e.sourceHandle === caseId);
            if (!hasCaseEdge) {
              errors.push({
                nodeId,
                field: 'handles',
                message: `O nó Switch "${nodeId}" não possui conexão para o caso "${caseId}".`,
                code: ValidationCodes.MISSING_MANDATORY_OUTPUT_EDGE,
              });
            }
          }

          for (const e of outgoing) {
            if (e.sourceHandle !== 'default' && !caseIds.has(e.sourceHandle || '')) {
              errors.push({
                edgeId: e.id,
                nodeId,
                field: 'sourceHandle',
                message: `Porta inválida "${e.sourceHandle}" no nó Switch "${nodeId}".`,
                code: ValidationCodes.INVALID_HANDLE,
              });
            }
          }
          break;
        }

        case 'wait_reply': {
          const hasReply = outgoing.some((e) => e.sourceHandle === 'reply');
          const hasTimeout = outgoing.some((e) => e.sourceHandle === 'timeout');

          if (!hasReply) {
            errors.push({
              nodeId,
              field: 'handles',
              message: `O nó de espera "${nodeId}" deve possuir uma conexão para a resposta ("reply").`,
              code: ValidationCodes.MISSING_MANDATORY_OUTPUT_EDGE,
            });
          }
          if (!hasTimeout) {
            errors.push({
              nodeId,
              field: 'handles',
              message: `O nó de espera "${nodeId}" deve possuir uma conexão para o tempo esgotado ("timeout").`,
              code: ValidationCodes.MISSING_MANDATORY_OUTPUT_EDGE,
            });
          }
          break;
        }

        case 'buttons': {
          const cfg = (node.config || {}) as ButtonsNodeConfig;
          const buttonIds = new Set((cfg.buttons || []).map((b) => b.id));

          for (const btnId of buttonIds) {
            const hasBtnEdge = outgoing.some((e) => e.sourceHandle === btnId);
            if (!hasBtnEdge) {
              errors.push({
                nodeId,
                field: 'handles',
                message: `O botão "${btnId}" no nó "${nodeId}" não possui uma conexão de saída conectada.`,
                code: ValidationCodes.MISSING_MANDATORY_OUTPUT_EDGE,
              });
            }
          }

          for (const e of outgoing) {
            if (e.sourceHandle && !buttonIds.has(e.sourceHandle)) {
              errors.push({
                edgeId: e.id,
                nodeId,
                field: 'sourceHandle',
                message: `Conexão "${e.id}" referencia botão inexistente "${e.sourceHandle}" no nó "${nodeId}".`,
                code: ValidationCodes.INVALID_HANDLE,
              });
            }
          }
          break;
        }

        case 'end_flow':
        case 'human_transfer':
          // Não exige saída
          break;

        default: {
          // Demais nós (trigger, message_text, message_media, question_input, delay, set_variable, list_interactive)
          // Nós intermediários sem saída são considerados incompletos
          if (outgoing.length === 0) {
            errors.push({
              nodeId,
              field: 'edges',
              message: `O nó "${nodeId}" (${this.getNodeType(node)}) não possui conexão de saída. O fluxo deve continuar ou terminar em nó de encerramento.`,
              code: ValidationCodes.MISSING_MANDATORY_OUTPUT_EDGE,
            });
          }
          break;
        }
      }
    }

    // 6. Detecção de Ciclos Não Permitidos (Loops sem nó bloqueante)
    this.detectUnpermittedCycles(nodeMap, outgoingByNode, errors);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Valida as configurações internas de cada tipo de nó
   */
  private validateNodeConfig(
    node: FlowNode,
    errors: ValidationErrorDetail[],
    warnings: ValidationErrorDetail[],
    declaredVariables: Set<string>,
  ): void {
    const cfg = this.getNodeConfig(node);
    const rawType = this.getNodeType(node);
    const normType = this.normalizeNodeType(rawType);

    switch (normType) {
      case 'trigger': {
        const c = cfg as TriggerNodeConfig;
        const triggerType =
          c.triggerType ||
          (rawType === 'trigger.keyword'
            ? 'contains_keyword'
            : rawType === 'trigger.message_received'
            ? 'any_message'
            : undefined);

        if (!triggerType) {
          errors.push({
            nodeId: node.id,
            field: 'config.triggerType',
            message: `O nó de gatilho "${node.id}" deve especificar um "triggerType".`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        } else if (
          (triggerType === 'exact_keyword' || triggerType === 'contains_keyword') &&
          (!Array.isArray(c.keywords) || c.keywords.length === 0) &&
          !(c as any).keyword
        ) {
          errors.push({
            nodeId: node.id,
            field: 'config.keywords',
            message: `O nó de gatilho por palavra-chave "${node.id}" precisa conter pelo menos uma palavra-chave.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        } else if (triggerType === 'regex' && (!c.regexPattern || c.regexPattern.trim() === '')) {
          errors.push({
            nodeId: node.id,
            field: 'config.regexPattern',
            message: `O nó de gatilho por regex "${node.id}" precisa definir uma expressão regular válida.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        break;
      }

      case 'message_text': {
        const c = cfg as MessageTextNodeConfig;
        if (!c.text || typeof c.text !== 'string' || c.text.trim() === '') {
          errors.push({
            nodeId: node.id,
            field: 'config.text',
            message: `O nó de mensagem de texto "${node.id}" não pode ter texto vazio.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        break;
      }

      case 'message_media': {
        const c = cfg as MessageMediaNodeConfig;
        if (!c.mediaType || !['image', 'audio', 'video', 'document'].includes(c.mediaType)) {
          errors.push({
            nodeId: node.id,
            field: 'config.mediaType',
            message: `O nó de mídia "${node.id}" deve ter mediaType válido ('image', 'audio', 'video', 'document').`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        if (!c.mediaUrl || typeof c.mediaUrl !== 'string' || c.mediaUrl.trim() === '') {
          errors.push({
            nodeId: node.id,
            field: 'config.mediaUrl',
            message: `O nó de mídia "${node.id}" deve possuir uma URL pública válida.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        break;
      }

      case 'buttons': {
        const c = cfg as ButtonsNodeConfig;
        const bodyText = c.body || (c as any).text;
        if (!bodyText || typeof bodyText !== 'string' || bodyText.trim() === '') {
          errors.push({
            nodeId: node.id,
            field: 'config.body',
            message: `O nó de botões "${node.id}" deve possuir uma mensagem de texto (body).`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        if (!Array.isArray(c.buttons) || c.buttons.length === 0) {
          errors.push({
            nodeId: node.id,
            field: 'config.buttons',
            message: `O nó de botões "${node.id}" deve possuir pelo menos 1 botão configurado.`,
            code: ValidationCodes.INVALID_BUTTON,
          });
        } else if (c.buttons.length > 3) {
          errors.push({
            nodeId: node.id,
            field: 'config.buttons',
            message: `O nó de botões "${node.id}" excede o limite máximo permitido de 3 botões pelo WhatsApp.`,
            code: ValidationCodes.INVALID_BUTTON,
          });
        } else {
          const btnIds = new Set<string>();
          for (let b = 0; b < c.buttons.length; b++) {
            const btn = c.buttons[b];
            if (!btn.id || typeof btn.id !== 'string' || btn.id.trim() === '') {
              errors.push({
                nodeId: node.id,
                field: `config.buttons[${b}].id`,
                message: `O botão no índice ${b} do nó "${node.id}" não possui identificador.`,
                code: ValidationCodes.INVALID_BUTTON,
              });
            } else if (btnIds.has(btn.id)) {
              errors.push({
                nodeId: node.id,
                field: `config.buttons[${b}].id`,
                message: `Identificador de botão duplicado "${btn.id}" no nó "${node.id}".`,
                code: ValidationCodes.INVALID_BUTTON,
              });
            } else {
              btnIds.add(btn.id);
            }

            if (!btn.label || typeof btn.label !== 'string' || btn.label.trim() === '') {
              errors.push({
                nodeId: node.id,
                field: `config.buttons[${b}].label`,
                message: `O botão no índice ${b} do nó "${node.id}" não possui rótulo visível (label).`,
                code: ValidationCodes.INVALID_BUTTON,
              });
            } else if (btn.label.length > 20) {
              warnings.push({
                nodeId: node.id,
                field: `config.buttons[${b}].label`,
                message: `O rótulo do botão "${btn.label}" ultrapassa 20 caracteres e pode ser truncado no WhatsApp.`,
                code: ValidationCodes.INVALID_BUTTON,
              });
            }
          }
        }
        break;
      }

      case 'list_interactive': {
        const c = cfg as ListInteractiveNodeConfig;
        if (!c.body || typeof c.body !== 'string' || c.body.trim() === '') {
          errors.push({
            nodeId: node.id,
            field: 'config.body',
            message: `O nó de lista "${node.id}" deve possuir um texto principal (body).`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        if (!c.buttonText || typeof c.buttonText !== 'string' || c.buttonText.trim() === '') {
          errors.push({
            nodeId: node.id,
            field: 'config.buttonText',
            message: `O nó de lista "${node.id}" deve definir o texto do botão de abertura da lista.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        if (!Array.isArray(c.sections) || c.sections.length === 0) {
          errors.push({
            nodeId: node.id,
            field: 'config.sections',
            message: `O nó de lista "${node.id}" deve possuir pelo menos 1 seção.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        } else {
          for (let s = 0; s < c.sections.length; s++) {
            const sec = c.sections[s];
            if (!sec.title || sec.title.trim() === '') {
              errors.push({
                nodeId: node.id,
                field: `config.sections[${s}].title`,
                message: `A seção no índice ${s} do nó "${node.id}" não possui título.`,
                code: ValidationCodes.INVALID_NODE_CONFIG,
              });
            }
            if (!Array.isArray(sec.rows) || sec.rows.length === 0) {
              errors.push({
                nodeId: node.id,
                field: `config.sections[${s}].rows`,
                message: `A seção "${sec.title || s}" no nó "${node.id}" deve possuir pelo menos uma linha de opção.`,
                code: ValidationCodes.INVALID_NODE_CONFIG,
              });
            }
          }
        }
        break;
      }

      case 'question_input': {
        const c = cfg as QuestionInputNodeConfig;
        const qText = c.questionText || (c as any).question || (c as any).text;
        const targetVar = c.targetVariable || (c as any).variable || (c as any).saveVariable;
        const expType = c.expectedType || 'text';

        if (!qText || typeof qText !== 'string' || qText.trim() === '') {
          errors.push({
            nodeId: node.id,
            field: 'config.questionText',
            message: `O nó de pergunta "${node.id}" deve conter o texto da pergunta.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        if (!targetVar || typeof targetVar !== 'string' || targetVar.trim() === '') {
          errors.push({
            nodeId: node.id,
            field: 'config.targetVariable',
            message: `O nó de pergunta "${node.id}" deve definir a variável de destino (targetVariable) para salvar a resposta.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        if (!['text', 'number', 'email', 'phone', 'regex'].includes(expType)) {
          errors.push({
            nodeId: node.id,
            field: 'config.expectedType',
            message: `Tipo de entrada esperado inválido no nó "${node.id}".`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        if (c.expectedType === 'regex' && (!c.validationRegex || c.validationRegex.trim() === '')) {
          errors.push({
            nodeId: node.id,
            field: 'config.validationRegex',
            message: `O nó "${node.id}" configurado com tipo regex precisa definir a expressão de validação.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        break;
      }

      case 'condition': {
        const c = cfg as ConditionNodeConfig;
        if (!Array.isArray(c.rules) || c.rules.length === 0) {
          errors.push({
            nodeId: node.id,
            field: 'config.rules',
            message: `O nó de condição "${node.id}" deve conter pelo menos uma regra comparativa.`,
            code: ValidationCodes.INCOMPLETE_CONDITION,
          });
        } else {
          for (let r = 0; r < c.rules.length; r++) {
            const rule = c.rules[r];
            if (!rule.variable || typeof rule.variable !== 'string' || rule.variable.trim() === '') {
              errors.push({
                nodeId: node.id,
                field: `config.rules[${r}].variable`,
                message: `Regra ${r + 1} no nó de condição "${node.id}" não especifica a variável a ser comparada.`,
                code: ValidationCodes.INCOMPLETE_CONDITION,
              });
            } else {
              this.checkVariableReference(node.id, rule.variable, declaredVariables, warnings);
            }

            if (!rule.operator) {
              errors.push({
                nodeId: node.id,
                field: `config.rules[${r}].operator`,
                message: `Regra ${r + 1} no nó de condição "${node.id}" não especifica o operador.`,
                code: ValidationCodes.INCOMPLETE_CONDITION,
              });
            } else if (
              rule.operator !== 'is_empty' &&
              rule.operator !== 'is_not_empty' &&
              (rule.value === undefined || rule.value === null || String(rule.value).trim() === '')
            ) {
              errors.push({
                nodeId: node.id,
                field: `config.rules[${r}].value`,
                message: `Regra ${r + 1} no nó de condição "${node.id}" com operador "${rule.operator}" requer um valor comparativo.`,
                code: ValidationCodes.INCOMPLETE_CONDITION,
              });
            }
          }
        }
        break;
      }

      case 'switch': {
        const c = cfg as SwitchNodeConfig;
        if (!c.variable || typeof c.variable !== 'string' || c.variable.trim() === '') {
          errors.push({
            nodeId: node.id,
            field: 'config.variable',
            message: `O nó Switch "${node.id}" deve indicar a variável a ser avaliada.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        } else {
          this.checkVariableReference(node.id, c.variable, declaredVariables, warnings);
        }

        if (!Array.isArray(c.cases) || c.cases.length === 0) {
          errors.push({
            nodeId: node.id,
            field: 'config.cases',
            message: `O nó Switch "${node.id}" deve definir pelo menos um caso de comparação.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        } else {
          const caseValues = new Set<string>();
          for (let idx = 0; idx < c.cases.length; idx++) {
            const cs = c.cases[idx];
            if (!cs.id || cs.id.trim() === '') {
              errors.push({
                nodeId: node.id,
                field: `config.cases[${idx}].id`,
                message: `Caso ${idx + 1} no nó Switch "${node.id}" não possui identificador de saída.`,
                code: ValidationCodes.INVALID_NODE_CONFIG,
              });
            }
            if (cs.value === undefined || cs.value === null || String(cs.value).trim() === '') {
              errors.push({
                nodeId: node.id,
                field: `config.cases[${idx}].value`,
                message: `Caso ${idx + 1} no nó Switch "${node.id}" não possui valor definido.`,
                code: ValidationCodes.INVALID_NODE_CONFIG,
              });
            } else if (caseValues.has(cs.value)) {
              warnings.push({
                nodeId: node.id,
                field: `config.cases[${idx}].value`,
                message: `Valor duplicado "${cs.value}" no nó Switch "${node.id}". Apenas o primeiro caso coincidente será executado.`,
                code: ValidationCodes.INVALID_NODE_CONFIG,
              });
            } else {
              caseValues.add(cs.value);
            }
          }
        }
        break;
      }

      case 'delay': {
        const c = cfg as DelayNodeConfig;
        if (typeof c.durationSeconds !== 'number' || c.durationSeconds <= 0) {
          errors.push({
            nodeId: node.id,
            field: 'config.durationSeconds',
            message: `O nó de atraso "${node.id}" deve definir uma duração positiva em segundos maior que zero.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        break;
      }

      case 'wait_reply': {
        const c = cfg as WaitReplyNodeConfig;
        if (typeof c.timeoutMinutes !== 'number' || c.timeoutMinutes <= 0) {
          errors.push({
            nodeId: node.id,
            field: 'config.timeoutMinutes',
            message: `O nó de espera "${node.id}" deve definir um timeout em minutos maior que zero.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        break;
      }

      case 'set_variable': {
        const c = cfg as SetVariableNodeConfig;
        if (!c.variableName || typeof c.variableName !== 'string' || c.variableName.trim() === '') {
          errors.push({
            nodeId: node.id,
            field: 'config.variableName',
            message: `O nó de atribuição "${node.id}" deve especificar o nome da variável.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        if (!['set', 'increment', 'decrement', 'clear'].includes(c.operation)) {
          errors.push({
            nodeId: node.id,
            field: 'config.operation',
            message: `Operação inválida no nó de variável "${node.id}".`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        if (c.operation !== 'clear' && (c.expression === undefined || c.expression === null || String(c.expression).trim() === '')) {
          errors.push({
            nodeId: node.id,
            field: 'config.expression',
            message: `O nó de atribuição "${node.id}" requer uma expressão de valor.`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        break;
      }

      case 'interaction.capture': {
        const targetVar = cfg.targetVariable || cfg.variable || cfg.variableName;
        if (!targetVar || typeof targetVar !== 'string' || targetVar.trim() === '') {
          errors.push({
            nodeId: node.id,
            field: 'config.targetVariable',
            message: `O nó de captura "${node.id}" deve especificar a variável de destino (targetVariable).`,
            code: ValidationCodes.INVALID_NODE_CONFIG,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Alerta sobre variáveis referenciadas que não constam nas variáveis declaradas do fluxo
   */
  private checkVariableReference(
    nodeId: string,
    variableName: string,
    declaredVariables: Set<string>,
    warnings: ValidationErrorDetail[],
  ): void {
    const cleanVar = variableName.toLowerCase().trim();
    if (SYSTEM_VARIABLES.has(cleanVar)) return;
    if (declaredVariables.size > 0 && !declaredVariables.has(cleanVar)) {
      warnings.push({
        nodeId,
        field: 'variable',
        message: `A variável "${variableName}" é referenciada no nó "${nodeId}", mas não está declarada nas variáveis do fluxo.`,
        code: ValidationCodes.UNDECLARED_VARIABLE,
      });
    }
  }

  /**
   * Detecta ciclos no grafo que não possuam nenhum nó bloqueante (loops infinitos de CPU)
   */
  private detectUnpermittedCycles(
    nodeMap: Map<string, FlowNode>,
    outgoingByNode: Map<string, FlowEdge[]>,
    errors: ValidationErrorDetail[],
  ): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const edges = outgoingByNode.get(nodeId) || [];
      for (const edge of edges) {
        const neighborId = edge.target;
        if (!nodeMap.has(neighborId)) continue;

        if (!visited.has(neighborId)) {
          dfs(neighborId);
        } else if (recursionStack.has(neighborId)) {
          // Ciclo detectado! Verifica se o ciclo possui nó bloqueante
          const cycleStartIndex = path.indexOf(neighborId);
          const cycleNodes = path.slice(cycleStartIndex);

          const hasBlockingNode = cycleNodes.some((id) => {
            const n = nodeMap.get(id);
            return (
              n &&
              (BLOCKING_NODE_TYPES.includes(n.type) ||
                BLOCKING_NODE_TYPES.includes(this.normalizeNodeType(n)) ||
                BLOCKING_NODE_TYPES.includes(this.getNodeType(n)))
            );
          });

          if (!hasBlockingNode) {
            errors.push({
              nodeId,
              message: `Ciclo não permitido detectado: [${cycleNodes.join(' -> ')} -> ${neighborId}]. Um loop só é permitido se contiver pelo menos um nó de espera ou pausa (delay, question_input ou wait_reply).`,
              code: ValidationCodes.UNPERMITTED_CYCLE,
            });
          }
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
    };

    for (const nodeId of nodeMap.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }
  }

  /**
   * Obtém o tipo real do nó, suportando tanto formato canônico quanto payload do React Flow (data.nodeType)
   */
  public getNodeType(node?: FlowNode): string {
    if (!node) return '';
    if (node.type && (node.type as string) !== 'custom') {
      return node.type;
    }
    return (
      node.data?.nodeType ||
      node.data?.type ||
      node.data?.label ||
      node.type ||
      ''
    );
  }

  /**
   * Obtém a configuração do nó, priorizando config e realizando fallback para data.config
   */
  public getNodeConfig(node?: FlowNode): Record<string, any> {
    if (!node) return {};
    if (node.config && Object.keys(node.config).length > 0) {
      return node.config;
    }
    return node.data?.config || node.config || {};
  }

  /**
   * Normaliza os identificadores de nós entre a sintaxe pontilhada e underscore
   */
  public normalizeNodeType(typeOrNode: string | FlowNode): string {
    const type = typeof typeOrNode === 'string' ? typeOrNode : this.getNodeType(typeOrNode);
    if (!type) return '';
    const t = type.toLowerCase().trim();
    if (
      t === 'trigger.message_received' ||
      t === 'trigger.keyword' ||
      t === 'trigger' ||
      t.startsWith('trigger.') ||
      t.startsWith('trigger_')
    ) {
      return 'trigger';
    }
    if (t === 'message.text' || t === 'message_text') return 'message_text';
    if (
      [
        'message.image',
        'message.video',
        'message.audio',
        'message.document',
        'message.sticker',
        'message.location',
        'message.contact',
        'message.template',
        'message_media',
      ].includes(t)
    ) {
      return 'message_media';
    }
    if (t === 'message.buttons' || t === 'message_buttons' || t === 'buttons') return 'buttons';
    if (t === 'message.list' || t === 'message_list' || t === 'list_interactive') return 'list_interactive';
    if (t === 'interaction.question' || t === 'question_input') return 'question_input';
    if (t === 'interaction.capture' || t === 'set_variable') return 'interaction.capture';
    if (t === 'interaction.choice') return 'buttons';
    if (t === 'logic.condition' || t === 'condition') return 'condition';
    if (t === 'logic.switch' || t === 'switch') return 'switch';
    if (t === 'logic.delay' || t === 'delay') return 'delay';
    if (t === 'logic.wait_for_input' || t === 'wait_reply') return 'wait_reply';
    if (t === 'action.human_handoff' || t === 'human_transfer') return 'human_transfer';
    if (t === 'action.end' || t === 'end_flow') return 'end_flow';
    return t;
  }
}
