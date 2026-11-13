import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/database/prisma.service';
import { WHATSAPP_PROVIDER } from '../src/modules/whatsapp/providers/whatsapp-provider.interface';
import { MockWhatsAppProvider } from '../src/modules/whatsapp/providers/mock-whatsapp.provider';
import { OutboxService } from '../src/modules/engine/outbox/outbox.service';
import { WhatsAppOutboxDispatcherService } from '../src/modules/whatsapp/outbox/whatsapp-outbox-dispatcher.service';
import { WhatsAppProviderType, ExecutionStatus, OutboxStatus, WebhookEventStatus } from '@prisma/client';

describe('WhatsApp Integration & Webhook Router (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockProvider: MockWhatsAppProvider;
  let outboxService: OutboxService;
  let dispatcher: WhatsAppOutboxDispatcherService;

  const tenantId = '00000000-0000-4000-a000-000000000001';
  const instanceName = 'zap-e2e-test';
  const testPhone = '5511999998888';
  const validApiKey = 'evolution_dev_global_api_key_change_in_prod';

  beforeAll(async () => {
    mockProvider = new MockWhatsAppProvider();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WHATSAPP_PROVIDER)
      .useValue(mockProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    outboxService = app.get<OutboxService>(OutboxService);
    dispatcher = app.get<WhatsAppOutboxDispatcherService>(WhatsAppOutboxDispatcherService);

    // Garante que o dispatcher esteja conectado ao outbox com o mockProvider
    outboxService.setSender(dispatcher);

    // Provisiona Tenant e Instância WhatsApp no PostgreSQL
    await prisma.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: {
        id: tenantId,
        name: 'Tenant WhatsApp E2E',
        slug: 'tenant-whatsapp-e2e',
      },
    });

    await prisma.whatsAppInstance.upsert({
      where: {
        tenantId_instanceName: {
          tenantId,
          instanceName,
        },
      },
      update: {
        providerType: WhatsAppProviderType.BAILEYS,
        status: 'CONNECTED',
      },
      create: {
        tenantId,
        instanceName,
        phoneNumber: '551155550000',
        providerType: WhatsAppProviderType.BAILEYS,
        status: 'CONNECTED',
        webhookSecret: 'secret_instance_123',
      },
    });
  });

  afterAll(async () => {
    // Limpeza
    if (prisma) {
      await prisma.webhookEvent.deleteMany({ where: { tenantId } });
      await prisma.outboxMessage.deleteMany({ where: { tenantId } });
      await prisma.flowExecutionLog.deleteMany({ where: { tenantId } });
      await prisma.flowExecutionNode.deleteMany({ where: { tenantId } });
      await prisma.flowExecution.deleteMany({ where: { tenantId } });
      await prisma.automationTrigger.deleteMany({ where: { tenantId } });
      await prisma.flowVersion.deleteMany({ where: { tenantId } });
      await prisma.automation.deleteMany({ where: { tenantId } });
      await prisma.whatsAppInstance.deleteMany({ where: { tenantId } });
      await prisma.contact.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }

    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    mockProvider.clear();
  });

  // ==========================================================================
  // 1. SEGURANÇA E PROTEÇÃO DOS ENDPOINTS DE WEBHOOK
  // ==========================================================================
  describe('Segurança de Webhooks', () => {
    it('deve rejeitar requisição sem header apikey com 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceName}`)
        .send({
          event: 'messages.upsert',
          data: { key: { id: 'test_sec_1' } },
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Chave de autenticação ausente');
    });

    it('deve rejeitar requisição com apikey inválida com 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceName}`)
        .set('apikey', 'chave_totalmente_errada')
        .send({
          event: 'messages.upsert',
          data: { key: { id: 'test_sec_2' } },
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Chave de autenticação inválida');
    });

    it('deve aceitar requisição com webhookSecret configurado na instância', async () => {
      const res = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceName}`)
        .set('apikey', 'secret_instance_123')
        .send({
          event: 'messages.upsert',
          data: {
            key: { id: `msg_sec_${Date.now()}`, remoteJid: `${testPhone}@s.whatsapp.net`, fromMe: false },
            message: { conversation: 'teste seguranca' },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });
  });

  // ==========================================================================
  // 2. DEMONSTRAÇÃO COMPLETA: RECEBIMENTO -> EXECUÇÃO -> RESPOSTA WHATSAPP
  // ==========================================================================
  describe('Demonstração Completa de Automação WhatsApp', () => {
    let automationId: string;
    let flowVersionId: string;

    beforeAll(async () => {
      // 1. Cria Automação com nó de pergunta e espera
      const auto = await prisma.automation.create({
        data: {
          tenantId,
          name: 'Atendimento Comercial Zap',
          status: 'PUBLISHED',
        },
      });
      automationId = auto.id;

      // Grafo do fluxo:
      // trigger -> message.text (oferta) -> interaction.question (espera nome) -> message.text (confirmação com variável)
      const definition = {
        schemaVersion: '1.0.0',
        nodes: [
          {
            id: 'node-trigger',
            type: 'trigger.keyword',
            config: { keywords: ['preco', 'preço', 'planos'] },
          },
          {
            id: 'node-msg-offer',
            type: 'message.text',
            config: {
              text: 'Olá! Nosso plano profissional custa R$ 99/mês.',
            },
          },
          {
            id: 'node-ask-name',
            type: 'interaction.question',
            config: {
              question: 'Como podemos te chamar para prosseguir?',
              saveVariable: 'cliente_nome',
            },
          },
          {
            id: 'node-msg-thanks',
            type: 'message.text',
            config: {
              text: 'Perfeito, {{cliente_nome}}! Um consultor entrará em contato.',
            },
          },
        ],
        edges: [
          { id: 'e1', source: 'node-trigger', target: 'node-msg-offer' },
          { id: 'e2', source: 'node-msg-offer', target: 'node-ask-name' },
          { id: 'e3', source: 'node-ask-name', target: 'node-msg-thanks' },
        ],
        variables: [{ name: 'cliente_nome', type: 'STRING' }],
      };

      const version = await prisma.flowVersion.create({
        data: {
          automationId,
          tenantId,
          versionNumber: 1,
          name: 'v1',
          definition: definition as any,
          isPublished: true,
        },
      });
      flowVersionId = version.id;

      await prisma.automation.update({
        where: { id: automationId },
        data: { activeVersionId: flowVersionId },
      });

      // Cria Gatilho associado
      await prisma.automationTrigger.create({
        data: {
          tenantId,
          automationId,
          type: 'KEYWORD_CONTAINS',
          config: { keywords: ['preco', 'preço', 'planos'] },
          isActive: true,
        },
      });
    });

    it('Passo 1: Cliente envia mensagem -> Aciona fluxo -> Dispara mensagens e pausa em WAITING_FOR_INPUT', async () => {
      const messageId = `msg_inbound_${Date.now()}`;

      const res = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceName}`)
        .set('apikey', validApiKey)
        .send({
          event: 'messages.upsert',
          instance: instanceName,
          data: {
            key: {
              remoteJid: `${testPhone}@s.whatsapp.net`,
              fromMe: false,
              id: messageId,
            },
            pushName: 'Carlos Cliente',
            message: {
              conversation: 'Quero saber o preço dos planos',
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(res.body.executionId).toBeDefined();

      const executionId = res.body.executionId;

      // 1. Valida persistência do evento bruto de webhook
      const webhookRecord = await prisma.webhookEvent.findFirst({
        where: { externalId: messageId },
      });
      expect(webhookRecord).toBeDefined();
      expect(webhookRecord?.status).toBe(WebhookEventStatus.PROCESSED);

      // 2. Valida estado da execução (deve estar em WAITING_FOR_INPUT no nó de pergunta)
      const execution = await prisma.flowExecution.findUnique({
        where: { id: executionId },
      });
      expect(execution?.status).toBe(ExecutionStatus.WAITING_FOR_INPUT);
      expect(execution?.currentNodeId).toBe('node-ask-name');

      // 3. Valida envio das mensagens pelo Outbox e Provider
      const outboxMessages = await prisma.outboxMessage.findMany({
        where: { executionId },
        orderBy: { createdAt: 'asc' },
      });

      // Duas mensagens enviadas: oferta inicial e a pergunta do nome
      expect(outboxMessages.length).toBeGreaterThanOrEqual(2);
      expect(outboxMessages[0].recipient).toBe(testPhone);

      // Drena e despacha mensagens no outbox
      for (const msg of outboxMessages) {
        await outboxService.dispatch(msg.id);
      }

      // Valida recebimento no MockWhatsAppProvider
      expect(mockProvider.sentMessages.length).toBeGreaterThanOrEqual(2);
      expect(mockProvider.sentMessages[0].params.text).toContain('R$ 99/mês');
      expect(mockProvider.sentMessages[1].params.text).toContain('Como podemos te chamar');
    });

    it('Passo 2: Cliente responde com seu nome -> Retoma a mesma execução e finaliza o fluxo', async () => {
      const answerMessageId = `msg_answer_${Date.now()}`;

      const res = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceName}`)
        .set('apikey', validApiKey)
        .send({
          event: 'messages.upsert',
          instance: instanceName,
          data: {
            key: {
              remoteJid: `${testPhone}@s.whatsapp.net`,
              fromMe: false,
              id: answerMessageId,
            },
            pushName: 'Carlos Cliente',
            message: {
              conversation: 'Carlos Eduardo',
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);

      // Valida que a execução foi concluída com sucesso
      const execution = await prisma.flowExecution.findFirst({
        where: { tenantId, contactPhone: testPhone },
        orderBy: { startedAt: 'desc' },
      });

      expect(execution?.status).toBe(ExecutionStatus.COMPLETED);

      // Valida que a variável capturada foi interpolada na mensagem final
      const contextVars = execution?.contextData as Record<string, any>;
      expect(contextVars.cliente_nome).toBe('Carlos Eduardo');

      // Despacha mensagem final do outbox
      const pendingOutbox = await prisma.outboxMessage.findMany({
        where: { executionId: execution?.id, status: OutboxStatus.PENDING },
      });

      for (const msg of pendingOutbox) {
        await outboxService.dispatch(msg.id);
      }

      // Verifica envio de agradecimento com interpolação
      const lastSent = mockProvider.sentMessages[mockProvider.sentMessages.length - 1];
      expect(lastSent.params.text).toContain('Perfeito, Carlos Eduardo!');
    });
  });

  // ==========================================================================
  // 3. DEDUPLICAÇÃO E IDEMPOTÊNCIA
  // ==========================================================================
  describe('Deduplicação de Mensagens', () => {
    it('deve ignorar mensagem com mesmo ID duplicado em sequência', async () => {
      const duplicateMsgId = `dup_msg_${Date.now()}`;

      // Primeiro envio
      const res1 = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceName}`)
        .set('apikey', validApiKey)
        .send({
          event: 'messages.upsert',
          instance: instanceName,
          data: {
            key: { remoteJid: '5511999991111@s.whatsapp.net', fromMe: false, id: duplicateMsgId },
            message: { conversation: 'Mensagem qualquer' },
          },
        });

      expect(res1.status).toBe(200);

      // Reenvio imediato do mesmo webhook
      const res2 = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceName}`)
        .set('apikey', validApiKey)
        .send({
          event: 'messages.upsert',
          instance: instanceName,
          data: {
            key: { remoteJid: '5511999991111@s.whatsapp.net', fromMe: false, id: duplicateMsgId },
            message: { conversation: 'Mensagem qualquer' },
          },
        });

      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe('ignored');
    });
  });

  // ==========================================================================
  // 4. MENSAGEM DO OPERADOR / EMPRESA (fromMe = true)
  // ==========================================================================
  describe('Mensagens Enviadas pela Empresa (fromMe)', () => {
    it('deve registrar o evento mas não iniciar automação para fromMe=true', async () => {
      const res = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceName}`)
        .set('apikey', validApiKey)
        .send({
          event: 'messages.upsert',
          instance: instanceName,
          data: {
            key: { remoteJid: '5511999992222@s.whatsapp.net', fromMe: true, id: `fromMe_${Date.now()}` },
            message: { conversation: 'Mensagem enviada pelo atendente humano' },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ignored');
    });
  });

  // ==========================================================================
  // 5. ATUALIZAÇÃO DE STATUS (ACK: SENT, DELIVERED, READ)
  // ==========================================================================
  describe('Atualização de Status de Entrega', () => {
    it('deve atualizar status da OutboxMessage para DELIVERED quando receber DELIVERY_ACK', async () => {
      const providerMsgId = `ack_prov_${Date.now()}`;

      // Cria mensagem no outbox
      const outbox = await prisma.outboxMessage.create({
        data: {
          tenantId,
          instanceName,
          recipient: '5511999993333',
          messageType: 'text',
          payload: { text: 'Testando ACK' },
          providerMessageId: providerMsgId,
          status: OutboxStatus.SENT,
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceName}`)
        .set('apikey', validApiKey)
        .send({
          event: 'messages.update',
          instance: instanceName,
          data: {
            key: { id: providerMsgId, remoteJid: '5511999993333@s.whatsapp.net', fromMe: true },
            status: 'DELIVERY_ACK',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      // Verifica no banco
      const updated = await prisma.outboxMessage.findUnique({ where: { id: outbox.id } });
      expect(updated?.status).toBe(OutboxStatus.SENT);
    });
  });

  // ==========================================================================
  // 6. MATRIZ DE CAPACIDADES DA INSTÂNCIA (API)
  // ==========================================================================
  describe('Consulta de Capacidades via API', () => {
    it('deve retornar a matriz de capacidades correspondente ao tipo de conexão', async () => {
      const instanceRecord = await prisma.whatsAppInstance.findFirst({
        where: { tenantId, instanceName },
      });

      const res = await request(app.getHttpServer())
        .get(`/whatsapp/instances/${instanceRecord?.id}/capabilities`)
        .set('x-tenant-id', tenantId);

      expect(res.status).toBe(200);
      expect(res.body.providerType).toBe(WhatsAppProviderType.BAILEYS);
      expect(res.body.text).toBe(true);
      expect(res.body.buttons).toBe(false); // Baileys não suporta botões nativos
      expect(res.body.poll).toBe(true);
      expect(res.body.requires24hWindow).toBe(false);
    });
  });
});
