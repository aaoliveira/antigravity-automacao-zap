import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FlowValidatorService } from './validator/flow-validator.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { ValidateFlowDto } from './dto/validate-flow.dto';
import { PublishFlowDto } from './dto/publish-flow.dto';
import { DuplicateAutomationDto } from './dto/duplicate-automation.dto';
import { WorkflowDefinition } from './schema/flow-node.types';
import { AutomationStatus, TriggerType, VariableType } from '@prisma/client';

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flowValidator: FlowValidatorService,
  ) {}

  /**
   * Retorna rascunho inicial padrão quando nenhum é informado
   */
  private getDefaultDraft(name: string): WorkflowDefinition {
    return {
      schemaVersion: '1.0.0',
      name,
      viewport: { x: 0, y: 0, zoom: 1 },
      variables: [],
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          position: { x: 100, y: 200 },
          config: {
            triggerType: 'exact_keyword',
            keywords: ['oi', 'ola'],
          },
        },
        {
          id: 'message_1',
          type: 'message_text',
          position: { x: 400, y: 200 },
          config: {
            text: 'Olá! Como posso ajudar você hoje?',
          },
        },
        {
          id: 'end_1',
          type: 'end_flow',
          position: { x: 700, y: 200 },
          config: {
            farewellMessage: 'Atendimento finalizado com sucesso.',
          },
        },
      ],
      edges: [
        {
          id: 'edge_1_2',
          source: 'trigger_1',
          target: 'message_1',
        },
        {
          id: 'edge_2_3',
          source: 'message_1',
          target: 'end_1',
        },
      ],
    };
  }

  /**
   * Garante que o tenant exista antes de criar automações
   */
  private async ensureTenant(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      // Se não existir, provisiona o tenant padrão no banco
      await this.prisma.tenant.create({
        data: {
          id: tenantId,
          name: `Tenant ${tenantId.slice(0, 8)}`,
          slug: `tenant-${tenantId.slice(0, 8)}`,
        },
      });
    }
  }

  /**
   * Cria uma nova automação
   */
  async create(tenantId: string, userId: string, dto: CreateAutomationDto) {
    await this.ensureTenant(tenantId);

    const draft = dto.initialDraft || this.getDefaultDraft(dto.name);

    const automation = await this.prisma.automation.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        status: AutomationStatus.DRAFT,
        currentDraft: draft as any,
      },
    });

    // Sincroniza gatilhos e variáveis declaradas no rascunho
    await this.syncTriggersAndVariables(tenantId, automation.id, draft);

    return this.findOne(tenantId, automation.id);
  }

  /**
   * Lista automações do tenant
   */
  async findAll(tenantId: string, status?: AutomationStatus) {
    const where: any = {
      tenantId,
      status: status ? status : { not: AutomationStatus.ARCHIVED },
    };

    const automations = await this.prisma.automation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            versions: true,
            executions: true,
          },
        },
      },
    });

    return automations.map((a) => ({
      ...a,
      versionCount: a._count.versions,
      executionCount: a._count.executions,
    }));
  }

  /**
   * Consulta uma automação por ID (estritamente isolada por tenant)
   */
  async findOne(tenantId: string, id: string) {
    const automation = await this.prisma.automation.findFirst({
      where: { id, tenantId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 5,
        },
        triggers: true,
        variables: true,
        _count: {
          select: {
            versions: true,
            executions: true,
          },
        },
      },
    });

    if (!automation) {
      throw new NotFoundException(`Automação com ID "${id}" não encontrada.`);
    }

    let activeVersion: any = null;
    if (automation.activeVersionId) {
      activeVersion = await this.prisma.flowVersion.findUnique({
        where: { id: automation.activeVersionId },
      });
    }

    return {
      ...automation,
      activeVersion,
      versionCount: automation._count.versions,
      executionCount: automation._count.executions,
    };
  }

  /**
   * Atualiza dados cadastrais ou salva rascunho do fluxo (com auto-provisionamento resiliente)
   */
  async update(tenantId: string, id: string, dto: UpdateAutomationDto) {
    await this.ensureTenant(tenantId);
    let automation = await this.prisma.automation.findFirst({ where: { id, tenantId } });

    if (!automation) {
      // Verifica se o ID pertence a outra empresa para preservar isolamento multi-tenant
      const belongsToOtherTenant = await this.prisma.automation.findFirst({ where: { id } });
      if (belongsToOtherTenant) {
        throw new NotFoundException(`Automação com ID "${id}" não encontrada.`);
      }

      // Se não existe em nenhum tenant, auto-provisiona para o tenant atual
      const draft = dto.currentDraft || this.getDefaultDraft(dto.name || 'Nova Automação');
      await this.prisma.automation.create({
        data: {
          id,
          tenantId,
          name: dto.name || 'Nova Automação',
          description: dto.description || '',
          status: AutomationStatus.DRAFT,
          currentDraft: draft as any,
        },
      });
    } else {
      // Regra de negócio: Para editar um fluxo criado, ele precisa estar pausado ou inativado
      if (automation.status === AutomationStatus.PUBLISHED) {
        throw new BadRequestException(
          'Para editar uma automação ativa, é necessário pausá-la ou inativá-la previamente.',
        );
      }

      const dataToUpdate: any = {};
      if (dto.name !== undefined) dataToUpdate.name = dto.name;
      if (dto.description !== undefined) dataToUpdate.description = dto.description;
      if (dto.currentDraft !== undefined) {
        dataToUpdate.currentDraft = dto.currentDraft as any;
      }

      await this.prisma.automation.update({
        where: { id },
        data: dataToUpdate,
      });
    }

    if (dto.currentDraft) {
      await this.syncTriggersAndVariables(tenantId, id, dto.currentDraft);
    }

    return this.findOne(tenantId, id);
  }

  /**
   * Exclui ou arquiva a automação
   */
  async delete(tenantId: string, id: string) {
    const automation = await this.findOne(tenantId, id);

    // Regra de negócio: Para excluir um fluxo criado, ele precisa estar pausado ou inativado
    if (automation.status === AutomationStatus.PUBLISHED) {
      throw new BadRequestException(
        'Para excluir uma automação ativa, é necessário pausá-la ou inativá-la previamente.',
      );
    }

    // Se possui execuções históricas, arquiva para preservar rastreabilidade
    if (automation.executionCount > 0) {
      await this.prisma.automation.update({
        where: { id },
        data: { status: AutomationStatus.ARCHIVED },
      });
      return { success: true, message: 'Automação arquivada devido ao histórico de execuções existentes.' };
    }

    await this.prisma.automation.delete({ where: { id } });
    return { success: true, message: 'Automação excluída com sucesso.' };
  }

  /**
   * Valida o fluxo (seja o rascunho salvo ou um payload enviado)
   */
  async validate(tenantId: string, id: string, dto?: ValidateFlowDto) {
    if (dto?.definition) {
      return this.flowValidator.validate(dto.definition);
    }

    const automation = await this.findOne(tenantId, id);
    const definitionToValidate = automation.currentDraft as unknown as WorkflowDefinition;

    if (!definitionToValidate) {
      throw new BadRequestException('Nenhum rascunho ou definição fornecida para validação.');
    }

    return this.flowValidator.validate(definitionToValidate);
  }

  /**
   * Publica o fluxo gerando uma nova versão imutável
   */
  async publish(tenantId: string, id: string, userId: string, dto?: PublishFlowDto) {
    let automation: any;
    try {
      automation = await this.findOne(tenantId, id);
    } catch (err) {
      // Se não existe para este tenant, verifica se pertence a outro tenant
      const belongsToOtherTenant = await this.prisma.automation.findFirst({ where: { id } });
      if (belongsToOtherTenant) {
        throw new NotFoundException(`Automação com ID "${id}" não encontrada.`);
      }

      if (dto?.definition) {
        await this.update(tenantId, id, {
          name: dto.definition.name || 'Nova Automação',
          currentDraft: dto.definition,
        });
        automation = await this.findOne(tenantId, id);
      } else {
        throw err;
      }
    }

    const definitionToPublish = (dto?.definition || automation.currentDraft) as WorkflowDefinition;

    if (!definitionToPublish) {
      throw new BadRequestException('Nenhum rascunho disponível para publicação.');
    }

    // 1. Validação obrigatória
    const validationResult = this.flowValidator.validate(definitionToPublish);
    if (!validationResult.isValid) {
      throw new BadRequestException({
        message: 'O fluxo possui erros estruturais e não pode ser publicado.',
        errors: validationResult.errors,
      });
    }

    // 2. Determina o próximo número de versão
    const lastVersion = await this.prisma.flowVersion.findFirst({
      where: { automationId: id },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;

    // 3. Cria a FlowVersion imutável
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '');
    const newVersion = await this.prisma.flowVersion.create({
      data: {
        automationId: id,
        tenantId,
        versionNumber: nextVersionNumber,
        schemaVersion: definitionToPublish.schemaVersion || '1.0.0',
        name: `${automation.name} v${nextVersionNumber}`,
        description: dto?.releaseNotes || `Versão ${nextVersionNumber} publicada em ${new Date().toISOString()}`,
        definition: definitionToPublish as any,
        isPublished: true,
        publishedBy: isUuid ? userId : null,
        publishedAt: new Date(),
      },
    });

    // 4. Atualiza o status e aponta a versão ativa na Automação
    await this.prisma.automation.update({
      where: { id },
      data: {
        status: AutomationStatus.PUBLISHED,
        activeVersionId: newVersion.id,
        currentDraft: definitionToPublish as any,
      },
    });

    // 5. Sincroniza os gatilhos oficiais da versão publicada
    await this.syncTriggersAndVariables(tenantId, id, definitionToPublish);

    this.logger.log(`Automação ${id} publicada com sucesso na versão ${nextVersionNumber} pelo usuário ${userId}`);

    return {
      success: true,
      message: `Versão ${nextVersionNumber} publicada com sucesso.`,
      version: newVersion,
      automation: await this.findOne(tenantId, id),
    };
  }

  /**
   * Pausa/desativa uma automação publicada
   */
  async pause(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    const updated = await this.prisma.automation.update({
      where: { id },
      data: { status: AutomationStatus.PAUSED },
    });

    return updated;
  }

  /**
   * Reativa uma automação pausada/inativada
   */
  async activate(tenantId: string, id: string) {
    const automation = await this.findOne(tenantId, id);

    if (!automation.activeVersionId && (!automation.versions || automation.versions.length === 0)) {
      throw new BadRequestException(
        'Esta automação não possui versão publicada para ser ativada.',
      );
    }

    const updated = await this.prisma.automation.update({
      where: { id },
      data: { status: AutomationStatus.PUBLISHED },
    });

    return updated;
  }

  /**
   * Processa arquivo enviado e gera URL canônica e metadados para envio via Evolution API
   */
  handleMediaUpload(tenantId: string, file: Express.Multer.File, req: any) {
    const baseUrl = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
    const relativeUrl = `/uploads/${tenantId}/${file.filename}`;
    const fileUrl = `${baseUrl}${relativeUrl}`;

    let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
    const mime = (file.mimetype || '').toLowerCase();

    if (mime.startsWith('image/')) {
      mediaType = 'image';
    } else if (mime.startsWith('video/')) {
      mediaType = 'video';
    } else if (mime.startsWith('audio/')) {
      mediaType = 'audio';
    }

    this.logger.log(
      `Upload de mídia realizado: [Tenant: ${tenantId}] ${file.originalname} (${file.size} bytes, tipo: ${mediaType}) -> ${fileUrl}`,
    );

    return {
      success: true,
      url: fileUrl,
      relativeUrl,
      fileName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      mediaType,
    };
  }

  /**
   * Consulta histórico de versões
   */
  async getVersions(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.flowVersion.findMany({
      where: { automationId: id, tenantId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  /**
   * Restaura uma versão anterior para o rascunho de trabalho
   */
  async restoreVersion(tenantId: string, id: string, versionId: string) {
    await this.findOne(tenantId, id);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId || '');
    if (!isUuid) {
      throw new NotFoundException(`Versão "${versionId}" não encontrada para esta automação.`);
    }

    const version = await this.prisma.flowVersion.findFirst({
      where: { id: versionId, automationId: id, tenantId },
    });

    if (!version) {
      throw new NotFoundException(`Versão "${versionId}" não encontrada para esta automação.`);
    }

    // Copia a definição da versão histórica para o rascunho atual
    await this.prisma.automation.update({
      where: { id },
      data: {
        currentDraft: version.definition as any,
      },
    });

    return {
      success: true,
      message: `Rascunho restaurado com sucesso a partir da versão ${version.versionNumber}.`,
      restoredFromVersionNumber: version.versionNumber,
      currentDraft: version.definition,
    };
  }

  /**
   * Duplica uma automação
   */
  async duplicate(tenantId: string, id: string, dto?: DuplicateAutomationDto) {
    const source = await this.findOne(tenantId, id);
    const newName = dto?.newName || `Cópia de ${source.name}`;

    const duplicated = await this.prisma.automation.create({
      data: {
        tenantId,
        name: newName,
        description: source.description ? `(Cópia) ${source.description}` : null,
        status: AutomationStatus.DRAFT,
        currentDraft: source.currentDraft as any,
      },
    });

    // Copia variáveis
    for (const variable of source.variables) {
      await this.prisma.flowVariable.create({
        data: {
          automationId: duplicated.id,
          tenantId,
          name: variable.name,
          type: variable.type,
          defaultValue: variable.defaultValue,
          description: variable.description,
          isGlobal: variable.isGlobal,
        },
      });
    }

    // Copia gatilhos
    for (const trigger of source.triggers) {
      await this.prisma.automationTrigger.create({
        data: {
          automationId: duplicated.id,
          tenantId,
          type: trigger.type,
          config: trigger.config as any,
          isActive: trigger.isActive,
        },
      });
    }

    return this.findOne(tenantId, duplicated.id);
  }

  /**
   * Consulta histórico de execuções da automação
   */
  async getExecutions(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.flowExecution.findMany({
      where: { automationId: id, tenantId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        flowVersion: {
          select: {
            id: true,
            versionNumber: true,
          },
        },
        _count: {
          select: {
            executionNodes: true,
            logs: true,
          },
        },
      },
    });
  }

  /**
   * Sincroniza entidades relacionais de gatilhos e variáveis a partir do JSON do fluxo
   */
  private getNodeType(node: any): string {
    if (!node) return '';
    if (node.type && node.type !== 'custom') {
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

  private async syncTriggersAndVariables(
    tenantId: string,
    automationId: string,
    definition: WorkflowDefinition,
  ): Promise<void> {
    try {
      // 1. Sincroniza Gatilhos
      const triggerNodes = (definition.nodes || []).filter((n) => {
        const type = this.getNodeType(n);
        return (
          type === 'trigger' ||
          type.startsWith('trigger.') ||
          type.startsWith('trigger_')
        );
      });
      await this.prisma.automationTrigger.deleteMany({ where: { automationId } });

      for (const node of triggerNodes) {
        const cfg = (node.config && Object.keys(node.config).length > 0 ? node.config : undefined) || node.data?.config || node.config || {};
        const nodeType = this.getNodeType(node);
        let tType: TriggerType = TriggerType.KEYWORD_EXACT;
        if (
          cfg.triggerType === 'contains_keyword' ||
          cfg.matchType === 'CONTAINS' ||
          nodeType === 'trigger.keyword'
        ) {
          tType = TriggerType.KEYWORD_CONTAINS;
        }
        if (cfg.triggerType === 'exact' || cfg.matchType === 'EXACT') {
          tType = TriggerType.KEYWORD_EXACT;
        }
        if (cfg.triggerType === 'regex') tType = TriggerType.REGEX;
        if (cfg.triggerType === 'first_interaction') tType = TriggerType.FIRST_INTERACTION;
        if (
          cfg.triggerType === 'any_message' ||
          nodeType === 'trigger.message_received'
        ) {
          tType = TriggerType.ANY_MESSAGE;
        }

        await this.prisma.automationTrigger.create({
          data: {
            automationId,
            tenantId,
            type: tType,
            config: cfg as any,
            isActive: true,
          },
        });
      }

      // 2. Sincroniza Variáveis Declaradas
      if (Array.isArray(definition.variables)) {
        for (const v of definition.variables) {
          let vType: VariableType = VariableType.STRING;
          if (v.type === 'number') vType = VariableType.NUMBER;
          if (v.type === 'boolean') vType = VariableType.BOOLEAN;
          if (v.type === 'json') vType = VariableType.JSON;

          await this.prisma.flowVariable.upsert({
            where: {
              automationId_name: {
                automationId,
                name: v.name,
              },
            },
            update: {
              type: vType,
              defaultValue: v.defaultValue ? String(v.defaultValue) : null,
              description: v.description,
            },
            create: {
              automationId,
              tenantId,
              name: v.name,
              type: vType,
              defaultValue: v.defaultValue ? String(v.defaultValue) : null,
              description: v.description,
            },
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Erro não impeditivo ao sincronizar gatilhos/variáveis da automação ${automationId}: ${err.message}`);
    }
  }
}
