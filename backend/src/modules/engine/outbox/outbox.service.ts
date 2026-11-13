import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OutboxStatus } from '@prisma/client';

export interface MessageSender {
  sendMessage(
    instanceName: string,
    recipient: string,
    messageType: string,
    payload: any,
  ): Promise<{ messageId: string; providerResponse?: any }>;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private customSender?: MessageSender;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Permite plugar sender externo (ex: cliente HTTP da Evolution API) ou mock para testes
   */
  setSender(sender: MessageSender): void {
    this.customSender = sender;
  }

  /**
   * Grava mensagem no Outbox antes de qualquer operação externa de rede
   */
  async recordOutgoingMessage(
    tenantId: string,
    executionId: string | null,
    instanceName: string,
    recipient: string,
    messageType: string,
    payload: any,
  ) {
    const msg = await this.prisma.outboxMessage.create({
      data: {
        tenantId,
        executionId,
        instanceName,
        recipient,
        messageType,
        payload,
        status: OutboxStatus.PENDING,
      },
    });

    this.logger.debug(`Mensagem outbox gravada [ID: ${msg.id}] para ${recipient} (${messageType})`);
    return msg;
  }

  /**
   * Despacha uma mensagem do Outbox com proteção contra duplicação e retry com backoff exponencial
   */
  async dispatch(outboxId: string, maxAttempts = 3): Promise<{ success: boolean; outboxId: string; error?: string }> {
    const message = await this.prisma.outboxMessage.findUnique({ where: { id: outboxId } });
    if (!message) {
      return { success: false, outboxId, error: 'Mensagem outbox não encontrada.' };
    }

    if (message.status === OutboxStatus.SENT) {
      // Já foi enviada anteriormente (Idempotência garantida)
      return { success: true, outboxId };
    }

    // Marca como em processamento
    await this.prisma.outboxMessage.update({
      where: { id: outboxId },
      data: { status: OutboxStatus.PROCESSING },
    });

    try {
      let providerMessageId: string | undefined;
      let providerResponse: any = undefined;

      if (this.customSender) {
        const sendResult = await this.customSender.sendMessage(
          message.instanceName,
          message.recipient,
          message.messageType,
          message.payload,
        );
        providerMessageId = sendResult?.messageId;
        providerResponse = sendResult?.providerResponse;
      } else {
        // Simulação padrão em desenvolvimento local
        this.logger.log(
          `[Outbox Dispatch Mock] Instância: ${message.instanceName} -> Destinatário: ${message.recipient} | Tipo: ${message.messageType}`,
        );
      }

      // Sucesso! Atualiza estado para SENT
      await this.prisma.outboxMessage.update({
        where: { id: outboxId },
        data: {
          status: OutboxStatus.SENT,
          sentAt: new Date(),
          providerMessageId,
          providerResponse,
        },
      });

      return { success: true, outboxId };
    } catch (err) {
      const attempts = message.attempts + 1;
      const isDeadLetter = attempts >= maxAttempts;
      const newStatus = isDeadLetter ? OutboxStatus.FAILED : OutboxStatus.PENDING;

      this.logger.error(
        `Falha ao despachar outbox [ID: ${outboxId}] tentativa ${attempts}/${maxAttempts}: ${err.message}`,
      );

      await this.prisma.outboxMessage.update({
        where: { id: outboxId },
        data: {
          attempts,
          status: newStatus,
          lastError: err.message || String(err),
        },
      });

      return { success: false, outboxId, error: err.message };
    }
  }

  /**
   * Recupera mensagens pendentes para drenagem
   */
  async getPendingMessages(limit = 50) {
    return this.prisma.outboxMessage.findMany({
      where: { status: OutboxStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Consulta a fila de cartas mortas (Dead Letter Queue)
   */
  async getDeadLetterMessages(tenantId?: string) {
    const where: any = { status: OutboxStatus.FAILED };
    if (tenantId) where.tenantId = tenantId;
    return this.prisma.outboxMessage.findMany({ where, orderBy: { updatedAt: 'desc' } });
  }
}
