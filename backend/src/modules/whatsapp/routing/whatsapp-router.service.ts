import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventNormalizerService } from '../normalization/event-normalizer.service';
import { WorkflowEngineService } from '../../engine/core/workflow-engine.service';
import { IdempotencyService } from '../../engine/resilience/idempotency.service';
import { WebhookEventStatus, OutboxStatus } from '@prisma/client';
import { InboundEvent, InboundInteraction } from '../../engine/types/execution.types';
import { NormalizedMessageEvent } from '../normalization/normalized-event.types';

@Injectable()
export class WhatsAppRouterService {
  private readonly logger = new Logger(WhatsAppRouterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: EventNormalizerService,
    private readonly engineService: WorkflowEngineService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Ponto de entrada de roteamento para webhooks da Evolution API
   */
  async routeIncomingWebhook(rawPayload: any, explicitTenantId?: string): Promise<{
    success: boolean;
    eventId?: string;
    reason?: string;
    executionId?: string;
  }> {
    const instanceName =
      rawPayload.instance ||
      rawPayload.instanceName ||
      rawPayload.data?.instance ||
      'whatsapp-default';

    // 1. Identifica a conexão WhatsApp cadastrada
    let instance = await this.prisma.whatsAppInstance.findFirst({
      where: explicitTenantId
        ? { instanceName, tenantId: explicitTenantId }
        : { instanceName },
    });

    // Se não encontrou a instância pelo nome mas foi informado tenantId, provisiona ou busca default
    if (!instance && explicitTenantId) {
      instance = await this.prisma.whatsAppInstance.findFirst({
        where: { tenantId: explicitTenantId },
      });
    }

    if (!instance) {
      this.logger.error(`Instância WhatsApp [${instanceName}] não encontrada no banco.`);
      throw new NotFoundException(`Instância WhatsApp "${instanceName}" não está registrada.`);
    }

    const tenantId = instance.tenantId;
    const externalMessageId =
      rawPayload.data?.key?.id ||
      rawPayload.id ||
      rawPayload.messageId ||
      `evt_${Date.now()}`;

    // 2. Persiste o evento bruto no banco para auditoria antes do processamento assíncrono
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        tenantId,
        instanceId: instance.id,
        instanceName: instance.instanceName,
        eventType: rawPayload.event || 'messages.upsert',
        externalId: externalMessageId,
        payload: rawPayload,
        status: WebhookEventStatus.PENDING,
      },
    });

    try {
      // 3. Normalização agnóstica de provedor
      const normalized: NormalizedMessageEvent = this.normalizer.normalize(rawPayload, tenantId);

      // 4. Se for evento de atualização de status de entrega (messages.update)
      if (normalized.eventType === 'messages.update' || normalized.message.type === 'status_update') {
        await this.handleStatusUpdate(normalized);

        await this.prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: WebhookEventStatus.PROCESSED,
            processedAt: new Date(),
          },
        });

        return { success: true, eventId: webhookEvent.id, reason: 'status_updated' };
      }

      // 5. Se a mensagem foi enviada pela própria empresa (fromMe = true)
      if (normalized.message.fromMe) {
        this.logger.debug(
          `Mensagem enviada pelo operador/empresa ignorada para automação [ID: ${normalized.message.id}]`,
        );

        await this.prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: WebhookEventStatus.IGNORED,
            processedAt: new Date(),
          },
        });

        return { success: false, eventId: webhookEvent.id, reason: 'from_me_ignored' };
      }

      // 6. Mensagem recebida de cliente: Atualiza/Provisiona Contato com lastInteractionAt
      await this.ensureContact(tenantId, normalized.contact.phone, normalized.contact.name);

      // 7. Constrói InboundEvent e encaminha ao Workflow Execution Engine
      const interaction = this.buildInboundInteraction(normalized);

      const engineEvent: InboundEvent = {
        messageId: normalized.message.id,
        tenantId,
        instanceName: instance.instanceName,
        contactPhone: normalized.contact.phone,
        contactName: normalized.contact.name,
        interaction,
        timestamp: normalized.receivedAt,
      };

      const result = await this.engineService.handleInboundEvent(engineEvent);

      // 8. Atualiza status do WebhookEvent para PROCESSED
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: result.processed ? WebhookEventStatus.PROCESSED : WebhookEventStatus.IGNORED,
          errorMessage: result.reason,
          processedAt: new Date(),
        },
      });

      return {
        success: result.processed,
        eventId: webhookEvent.id,
        executionId: result.executionId,
        reason: result.reason,
      };
    } catch (err) {
      this.logger.error(`Falha ao rotear webhook [${webhookEvent.id}]: ${err.message}`, err.stack);

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: WebhookEventStatus.FAILED,
          errorMessage: err.message,
          processedAt: new Date(),
        },
      });

      throw err;
    }
  }

  private async ensureContact(tenantId: string, phone: string, name?: string) {
    if (!phone) return;

    await this.prisma.contact.upsert({
      where: {
        tenantId_phone: { tenantId, phone },
      },
      update: {
        name: name || undefined,
        lastInteractionAt: new Date(),
      },
      create: {
        tenantId,
        phone,
        name: name || 'Cliente WhatsApp',
        lastInteractionAt: new Date(),
      },
    });
  }

  private async handleStatusUpdate(normalized: NormalizedMessageEvent): Promise<void> {
    const messageId = normalized.message.id;
    const status = normalized.message.status;
    if (!messageId || !status) return;

    this.logger.log(`Atualizando status de entrega da mensagem [${messageId}] para ${status}`);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId);
    const whereConditions: any[] = [{ providerMessageId: messageId }];
    if (isUuid) {
      whereConditions.push({ id: messageId });
    }

    const outboxMessage = await this.prisma.outboxMessage.findFirst({
      where: {
        OR: whereConditions,
      },
    });

    if (outboxMessage) {
      await this.prisma.outboxMessage.update({
        where: { id: outboxMessage.id },
        data: {
          status: status === 'FAILED' ? OutboxStatus.FAILED : OutboxStatus.SENT,
          updatedAt: new Date(),
        },
      });
    }
  }

  private buildInboundInteraction(normalized: NormalizedMessageEvent): InboundInteraction {
    const msg = normalized.message;

    switch (msg.type) {
      case 'button_reply':
        return {
          type: 'button_click',
          value: msg.text || msg.buttonText || msg.buttonId || '',
          buttonId: msg.buttonId,
          buttonPayload: msg.buttonPayload || msg.buttonId,
          rawPayload: msg.raw,
        };

      case 'list_reply':
        return {
          type: 'list_selection',
          value: msg.text || msg.listTitle || msg.listRowId || '',
          rowId: msg.listRowId,
          rowPayload: msg.listRowId,
          rawPayload: msg.raw,
        };

      case 'poll_vote':
        return {
          type: 'button_click',
          value: msg.pollSelectedOptions?.[0] || msg.text || '',
          buttonId: msg.pollSelectedOptions?.[0],
          rawPayload: msg.raw,
        };

      case 'image':
      case 'video':
      case 'audio':
      case 'document':
      case 'sticker':
        return {
          type: 'media',
          value: msg.text || msg.mediaUrl || msg.type,
          mediaUrl: msg.mediaUrl,
          mediaType: msg.mimeType,
          rawPayload: msg.raw,
        };

      case 'text':
      default:
        return {
          type: 'text',
          value: msg.text || '',
          rawPayload: msg.raw,
        };
    }
  }
}
