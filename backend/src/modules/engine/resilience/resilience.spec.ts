import { Test, TestingModule } from '@nestjs/testing';
import { OutboxService } from '../outbox/outbox.service';
import { IdempotencyService } from './idempotency.service';
import { ConcurrencyLockService } from './concurrency-lock.service';
import { PrismaService } from '../../database/prisma.service';
import { OutboxStatus } from '@prisma/client';

describe('Resilience Services (Idempotency, ConcurrencyLock, Outbox Pattern)', () => {
  let idempotency: IdempotencyService;
  let lockService: ConcurrencyLockService;
  let outboxService: OutboxService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      outboxMessage: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        ConcurrencyLockService,
        OutboxService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    idempotency = module.get<IdempotencyService>(IdempotencyService);
    lockService = module.get<ConcurrencyLockService>(ConcurrencyLockService);
    outboxService = module.get<OutboxService>(OutboxService);
  });

  describe('IdempotencyService', () => {
    it('deve aceitar primeira ocorrência de mensagem e rejeitar ocorrência repetida', async () => {
      const tenantId = 't1';
      const msgId = `msg_test_${Date.now()}`;

      const firstAttempt = await idempotency.checkAndSet(tenantId, msgId, 10);
      expect(firstAttempt).toBe(true);

      const secondAttempt = await idempotency.checkAndSet(tenantId, msgId, 10);
      expect(secondAttempt).toBe(false);

      // Limpeza
      await idempotency.clear(tenantId, msgId);
      const afterClear = await idempotency.checkAndSet(tenantId, msgId, 10);
      expect(afterClear).toBe(true);
      await idempotency.clear(tenantId, msgId);
    });
  });

  describe('ConcurrencyLockService', () => {
    it('deve conceder trava exclusiva e rejeitar tentativas concorrentes na mesma conversa', async () => {
      const tenantId = 't1';
      const phone = '5511888888888';

      const token1 = await lockService.acquireLock(tenantId, phone, 5000);
      expect(token1).toBeTruthy();

      // Segunda tentativa simultânea deve ser negada
      const token2 = await lockService.acquireLock(tenantId, phone, 5000);
      expect(token2).toBeNull();

      // Liberação segura com o token correto
      const released = await lockService.releaseLock(tenantId, phone, token1!);
      expect(released).toBe(true);

      // Agora deve permitir nova aquisição
      const token3 = await lockService.acquireLock(tenantId, phone, 5000);
      expect(token3).toBeTruthy();
      await lockService.releaseLock(tenantId, phone, token3!);
    });
  });

  describe('OutboxService (Outbox Pattern & DLQ)', () => {
    it('deve persistir mensagem no outbox com status PENDING antes do envio', async () => {
      prismaMock.outboxMessage.create.mockResolvedValue({
        id: 'outbox-1',
        status: OutboxStatus.PENDING,
        recipient: '5511999999999',
      });

      const msg = await outboxService.recordOutgoingMessage(
        'tenant-1',
        'exec-1',
        'inst-1',
        '5511999999999',
        'text',
        { text: 'Olá!' },
      );

      expect(prismaMock.outboxMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipient: '5511999999999',
            status: OutboxStatus.PENDING,
          }),
        }),
      );
      expect(msg.id).toBe('outbox-1');
    });

    it('deve despachar mensagem com sucesso e atualizar status para SENT', async () => {
      prismaMock.outboxMessage.findUnique.mockResolvedValue({
        id: 'outbox-1',
        status: OutboxStatus.PENDING,
        attempts: 0,
        recipient: '5511999999999',
        instanceName: 'inst-1',
        messageType: 'text',
        payload: { text: 'Olá!' },
      });

      const senderMock = {
        sendMessage: jest.fn().mockResolvedValue({ messageId: 'wa-msg-123' }),
      };
      outboxService.setSender(senderMock);

      const result = await outboxService.dispatch('outbox-1');

      expect(result.success).toBe(true);
      expect(senderMock.sendMessage).toHaveBeenCalled();
      expect(prismaMock.outboxMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'outbox-1' },
          data: expect.objectContaining({ status: OutboxStatus.SENT }),
        }),
      );
    });

    it('deve mover mensagem para FAILED (Dead Letter Queue) quando atingir limite máximo de tentativas', async () => {
      prismaMock.outboxMessage.findUnique.mockResolvedValue({
        id: 'outbox-dlq',
        status: OutboxStatus.PENDING,
        attempts: 2, // Já tentou 2 vezes
        recipient: '5511999999999',
        instanceName: 'inst-1',
        messageType: 'text',
        payload: { text: 'Olá!' },
      });

      const failingSender = {
        sendMessage: jest.fn().mockRejectedValue(new Error('WhatsApp Gateway 503 Service Unavailable')),
      };
      outboxService.setSender(failingSender);

      const result = await outboxService.dispatch('outbox-dlq', 3); // Max 3

      expect(result.success).toBe(false);
      expect(prismaMock.outboxMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'outbox-dlq' },
          data: expect.objectContaining({
            attempts: 3,
            status: OutboxStatus.FAILED,
          }),
        }),
      );
    });
  });
});
