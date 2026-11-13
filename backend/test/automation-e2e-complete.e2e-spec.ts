import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import axios from 'axios';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/database/prisma.service';
import { WHATSAPP_PROVIDER } from '../src/modules/whatsapp/providers/whatsapp-provider.interface';
import { MockWhatsAppProvider } from '../src/modules/whatsapp/providers/mock-whatsapp.provider';
import { EvolutionApiV2Adapter } from '../src/modules/whatsapp/providers/evolution-api-v2.adapter';
import { OutboxService } from '../src/modules/engine/outbox/outbox.service';
import { WhatsAppOutboxDispatcherService } from '../src/modules/whatsapp/outbox/whatsapp-outbox-dispatcher.service';
import { WorkflowEngineService } from '../src/modules/engine/core/workflow-engine.service';
import { CryptoService } from '../src/modules/whatsapp/security/crypto.service';
import { WhatsAppCapabilitiesService } from '../src/modules/whatsapp/capabilities/whatsapp-capabilities.service';
import {
  WhatsAppProviderType,
  ExecutionStatus,
  OutboxStatus,
  WebhookEventStatus,
} from '@prisma/client';

describe('PROMPT 06 — Testes End-to-End e Validação da Automação WhatsApp', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockProvider: MockWhatsAppProvider;
  let outboxService: OutboxService;
  let dispatcher: WhatsAppOutboxDispatcherService;
  let engineService: WorkflowEngineService;
  let cryptoService: CryptoService;

  const tenantAlfa = '44444444-4444-4444-4444-444444444444';
  const tenantBeta = '55555555-5555-5555-5555-555555555555';
  const instanceAlfa = 'zap-e2e-alfa';
  const testPhone = '5511988887777';
  const realInstanceName = 'zap-localhost';
  const realEvolutionUrl = 'http://localhost:8080';
  const realEvolutionKey = 'evolution_dev_global_api_key_change_in_prod';
  const msgId = (base: string) => `${base}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

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
    engineService = app.get<WorkflowEngineService>(WorkflowEngineService);
    cryptoService = app.get<CryptoService>(CryptoService);

    outboxService.setSender(dispatcher);

    // 1. Provisiona Tenants para isolamento multi-tenant
    await prisma.tenant.upsert({
      where: { id: tenantAlfa },
      update: {},
      create: {
        id: tenantAlfa,
        name: 'Empresa Alfa E2E',
        slug: 'empresa-alfa-e2e',
      },
    });

    await prisma.tenant.upsert({
      where: { id: tenantBeta },
      update: {},
      create: {
        id: tenantBeta,
        name: 'Empresa Beta E2E',
        slug: 'empresa-beta-e2e',
      },
    });

    // 2. Instância WhatsApp Mockada para testes automatizados rápidos
    await prisma.whatsAppInstance.upsert({
      where: { tenantId_instanceName: { tenantId: tenantAlfa, instanceName: instanceAlfa } },
      update: { status: 'CONNECTED', providerType: WhatsAppProviderType.BAILEYS },
      create: {
        tenantId: tenantAlfa,
        instanceName: instanceAlfa,
        phoneNumber: '551155551111',
        providerType: WhatsAppProviderType.BAILEYS,
        status: 'CONNECTED',
      },
    });

    // 3. Instância Real Evolution API para testes de integração real sem mock
    const encryptedKey = cryptoService.encrypt(realEvolutionKey);
    await prisma.whatsAppInstance.upsert({
      where: { tenantId_instanceName: { tenantId: tenantAlfa, instanceName: realInstanceName } },
      update: {
        serverUrl: realEvolutionUrl,
        apiKeyEncrypted: encryptedKey,
        status: 'CONNECTED',
        providerType: WhatsAppProviderType.BAILEYS,
      },
      create: {
        tenantId: tenantAlfa,
        instanceName: realInstanceName,
        serverUrl: realEvolutionUrl,
        apiKeyEncrypted: encryptedKey,
        status: 'CONNECTED',
        providerType: WhatsAppProviderType.BAILEYS,
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.webhookEvent.deleteMany({ where: { tenantId: { in: [tenantAlfa, tenantBeta] } } });
      await prisma.outboxMessage.deleteMany({ where: { tenantId: { in: [tenantAlfa, tenantBeta] } } });
      await prisma.flowExecutionLog.deleteMany({ where: { tenantId: { in: [tenantAlfa, tenantBeta] } } });
      await prisma.flowExecutionNode.deleteMany({ where: { tenantId: { in: [tenantAlfa, tenantBeta] } } });
      await prisma.flowExecution.deleteMany({ where: { tenantId: { in: [tenantAlfa, tenantBeta] } } });
      await prisma.automationTrigger.deleteMany({ where: { tenantId: { in: [tenantAlfa, tenantBeta] } } });
      await prisma.flowVersion.deleteMany({ where: { tenantId: { in: [tenantAlfa, tenantBeta] } } });
      await prisma.automation.deleteMany({ where: { tenantId: { in: [tenantAlfa, tenantBeta] } } });
      await prisma.whatsAppInstance.deleteMany({ where: { tenantId: { in: [tenantAlfa, tenantBeta] } } });
      await prisma.contact.deleteMany({ where: { tenantId: { in: [tenantAlfa, tenantBeta] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantAlfa, tenantBeta] } } });
    }

    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    mockProvider.clear();
  });

  // =========================================================================
  // 1. CENÁRIO PRINCIPAL E TESTES DO CONSTRUTOR DE FLUXOS
  // =========================================================================
  describe('1. Cenário Principal: Construção e Publicação do Atendimento Comercial', () => {
    let commercialAutomationId: string;
    let publishedVersionId: string;

    it('1.1 Deve criar a automação comercial e salvar rascunho com o fluxo completo de 10 nós', async () => {
      // Cria a automação
      const createRes = await request(app.getHttpServer())
        .post('/automations')
        .set('x-tenant-id', tenantAlfa)
        .send({
          name: 'Atendimento Comercial Realista',
          description: 'Fluxo comercial com botões, condições e captura de tamanho',
        })
        .expect(201);

      commercialAutomationId = createRes.body.id;
      expect(commercialAutomationId).toBeDefined();

      // Definição do grafo do Cenário Principal (10 Nós)
      const flowDefinition = {
        schemaVersion: '1.0',
        flowId: commercialAutomationId,
        name: 'Atendimento Comercial',
        nodes: [
          // Nó 1 — Gatilho
          {
            id: 'node-1',
            type: 'trigger.keyword',
            config: {
              triggerType: 'contains_keyword',
              keywords: ['quero comprar', 'olá', 'oi'],
              matchType: 'CONTAINS',
            },
          },
          // Nó 2 — Mensagem de boas-vindas
          {
            id: 'node-2',
            type: 'message.text',
            config: { text: 'Olá! Seja bem-vindo. Como podemos ajudar?' },
          },
          // Nó 3 — Botões Menu Principal
          {
            id: 'node-3',
            type: 'message.buttons',
            config: {
              text: 'Escolha uma das opções abaixo:',
              buttons: [
                { id: 'btn_produtos', label: 'Conhecer produtos' },
                { id: 'btn_precos', label: 'Consultar preços' },
                { id: 'btn_atendente', label: 'Falar com atendente' },
              ],
            },
          },
          // Nó 4 — Condição: Se escolher "Conhecer produtos"
          {
            id: 'node-4',
            type: 'logic.condition',
            config: {
              logicalOperator: 'AND',
              rules: [
                { variable: 'last_selected_button_label', operator: 'EQUALS', value: 'Conhecer produtos' },
              ],
            },
          },
          // Nó 5 — Botões Categorias
          {
            id: 'node-5',
            type: 'message.buttons',
            config: {
              text: 'Qual categoria você procura?',
              buttons: [
                { id: 'btn_camisetas', label: 'Camisetas' },
                { id: 'btn_calcas', label: 'Calças' },
                { id: 'btn_acessorios', label: 'Acessórios' },
              ],
            },
          },
          // Nó 6 — Condição: Se escolher "Camisetas"
          {
            id: 'node-6',
            type: 'logic.condition',
            config: {
              logicalOperator: 'AND',
              rules: [
                { variable: 'last_selected_button_label', operator: 'EQUALS', value: 'Camisetas' },
              ],
            },
          },
          // Nó 7 — Pergunta: Tamanho
          {
            id: 'node-7',
            type: 'interaction.question',
            config: {
              questionText: 'Temos diversas opções. Qual tamanho você procura?',
              targetVariable: 'temp_size',
              expectedType: 'text',
            },
          },
          // Nó 8 — Captura: Salvar em {{contact.product_size}}
          {
            id: 'node-8',
            type: 'interaction.capture',
            config: {
              targetVariable: 'contact.product_size',
            },
          },
          // Nó 9 — Mensagem de confirmação
          {
            id: 'node-9',
            type: 'message.text',
            config: {
              text: 'Perfeito! Vou encaminhar seu interesse para nosso atendimento.',
            },
          },
          // Nó 10 — Encerrar fluxo
          {
            id: 'node-10',
            type: 'action.end',
            config: { farewellMessage: 'Atendimento concluído. Tenha um excelente dia!' },
          },
          // Nó Alternativo A: Preços
          {
            id: 'node-alt-precos',
            type: 'message.text',
            config: {
              text: 'Nossos preços: Camisetas R$ 49,90 | Calças R$ 99,90 | Acessórios R$ 29,90.',
            },
          },
          // Nó Alternativo B: Transfere para Atendente Humano
          {
            id: 'node-alt-atendente',
            type: 'action.human_handoff',
            config: {
              department: 'Comercial',
              closingMessage: 'Transferindo seu atendimento para nossa equipe humana.',
            },
          },
        ],
        edges: [
          { id: 'e1-2', source: 'node-1', target: 'node-2' },
          { id: 'e2-3', source: 'node-2', target: 'node-3' },
          // Nó 3 se conecta com o nó 4 (Condição Conhecer Produtos) via handle do botão
          { id: 'e3-4', source: 'node-3', sourceHandle: 'btn_produtos', target: 'node-4' },
          { id: 'e3-precos', source: 'node-3', sourceHandle: 'btn_precos', target: 'node-alt-precos' },
          { id: 'e3-atendente', source: 'node-3', sourceHandle: 'btn_atendente', target: 'node-alt-atendente' },
          // Nó 4: Se verdadeiro -> Nó 5 (Botões Categorias)
          { id: 'e4-5', source: 'node-4', sourceHandle: 'true', target: 'node-5' },
          { id: 'e4-false', source: 'node-4', sourceHandle: 'false', target: 'node-10' },
          // Nó 5 se conecta com o nó 6 (Condição Camisetas)
          { id: 'e5-6', source: 'node-5', sourceHandle: 'btn_camisetas', target: 'node-6' },
          { id: 'e5-calcas', source: 'node-5', sourceHandle: 'btn_calcas', target: 'node-10' },
          { id: 'e5-acessorios', source: 'node-5', sourceHandle: 'btn_acessorios', target: 'node-10' },
          // Nó 6: Se verdadeiro -> Nó 7 (Pergunta Tamanho)
          { id: 'e6-7', source: 'node-6', sourceHandle: 'true', target: 'node-7' },
          { id: 'e6-false', source: 'node-6', sourceHandle: 'false', target: 'node-10' },
          // Nó 7 -> Nó 8 (Captura)
          { id: 'e7-8', source: 'node-7', target: 'node-8' },
          // Nó 8 -> Nó 9 (Mensagem Confirmação)
          { id: 'e8-9', source: 'node-8', target: 'node-9' },
          // Nó 9 -> Nó 10 (Encerrar)
          { id: 'e9-10', source: 'node-9', target: 'node-10' },
          // Preços -> Encerrar
          { id: 'e-precos-end', source: 'node-alt-precos', target: 'node-10' },
        ],
      };

      // Salva rascunho
      const draftRes = await request(app.getHttpServer())
        .put(`/automations/${commercialAutomationId}`)
        .set('x-tenant-id', tenantAlfa)
        .send({ currentDraft: flowDefinition })
        .expect(200);

      expect(draftRes.body.currentDraft).toBeDefined();
      expect(draftRes.body.currentDraft.nodes.length).toBe(12);
    });

    it('1.2 Deve validar o fluxo com sucesso contra o validador de grafos', async () => {
      const valRes = await request(app.getHttpServer())
        .post(`/automations/${commercialAutomationId}/validate`)
        .set('x-tenant-id', tenantAlfa)
        .expect(200);

      expect(valRes.body.isValid).toBe(true);
      expect(valRes.body.errors.length).toBe(0);
    });

    it('1.3 Deve publicar o fluxo comercial e ativar os gatilhos no banco', async () => {
      const pubRes = await request(app.getHttpServer())
        .post(`/automations/${commercialAutomationId}/publish`)
        .set('x-tenant-id', tenantAlfa)
        .expect(201);

      expect(pubRes.body.version.id).toBeDefined();
      publishedVersionId = pubRes.body.version.id;

      const triggers = await prisma.automationTrigger.findMany({
        where: { tenantId: tenantAlfa, automationId: commercialAutomationId },
      });
      expect(triggers.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. TESTES DE EXECUÇÃO DO CENÁRIO PRINCIPAL (CAMINHO FELIZ)
  // =========================================================================
  describe('2. Execução do Cenário Principal (Conhecer Produtos -> Camisetas -> Tamanho -> Finalizar)', () => {
    let executionId: string;

    it('2.1 Passo 1: Mensagem "Quero comprar" inicia fluxo, envia boas-vindas e apresenta botões de menu', async () => {
      const inboundPayload = {
        event: 'messages.upsert',
        instance: instanceAlfa,
        data: {
          key: { id: msgId('msg_e2e_001'), remoteJid: `${testPhone}@s.whatsapp.net`, fromMe: false },
          message: { conversation: 'Olá, quero comprar roupas!' },
          messageTimestamp: Math.floor(Date.now() / 1000),
        },
      };

      const res = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send(inboundPayload)
        .expect(200);

      expect(res.body.received).toBe(true);

      // Localiza a execução criada
      const execution = await prisma.flowExecution.findFirst({
        where: { tenantId: tenantAlfa, contactPhone: testPhone },
        orderBy: { startedAt: 'desc' },
      });
      expect(execution).toBeDefined();
      executionId = execution!.id;

      // Execução deve estar pausada no nó de botões (node-3) aguardando clique do usuário
      expect(execution!.status).toBe(ExecutionStatus.WAITING_FOR_INPUT);
      expect(execution!.currentNodeId).toBe('node-3');

      // Verifica mensagens no Outbox
      const outboxMessages = await prisma.outboxMessage.findMany({
        where: { executionId },
        orderBy: { createdAt: 'asc' },
      });

      // Duas mensagens enviadas: boas-vindas (node-2) e menu de botões (node-3)
      expect(outboxMessages.length).toBe(2);
      expect(outboxMessages[0].payload).toMatchObject({ text: 'Olá! Seja bem-vindo. Como podemos ajudar?' });
      expect(outboxMessages[1].messageType).toBe('buttons');
    });

    it('2.2 Passo 2: Cliente seleciona "Conhecer produtos" -> Condição avalia e envia botões de categorias (node-5)', async () => {
      // Webhook simulando o clique no botão "btn_produtos"
      const buttonClickPayload = {
        event: 'messages.upsert',
        instance: instanceAlfa,
        data: {
          key: { id: msgId('msg_e2e_002'), remoteJid: `${testPhone}@s.whatsapp.net`, fromMe: false },
          message: {
            buttonsResponseMessage: {
              selectedButtonId: 'btn_produtos',
              selectedDisplayText: 'Conhecer produtos',
            },
          },
          messageTimestamp: Math.floor(Date.now() / 1000),
        },
      };

      const res = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send(buttonClickPayload)
        .expect(200);

      expect(res.body.received).toBe(true);

      // Execução avançou: avaliou node-4 (condição = true), executou node-5 (botões categorias) e pausou
      const execution = await prisma.flowExecution.findUnique({ where: { id: executionId } });
      expect(execution!.status).toBe(ExecutionStatus.WAITING_FOR_INPUT);
      expect(execution!.currentNodeId).toBe('node-5');

      // Verifica envio de "Qual categoria você procura?"
      const outboxMessages = await prisma.outboxMessage.findMany({
        where: { executionId },
        orderBy: { createdAt: 'asc' },
      });
      const lastOutbox = outboxMessages[outboxMessages.length - 1];
      expect(lastOutbox.payload).toMatchObject({
        body: 'Qual categoria você procura?',
      });
    });

    it('2.3 Passo 3: Cliente seleciona "Camisetas" -> Condição avalia e envia pergunta de tamanho (node-7)', async () => {
      const buttonCamisetasPayload = {
        event: 'messages.upsert',
        instance: instanceAlfa,
        data: {
          key: { id: msgId('msg_e2e_003'), remoteJid: `${testPhone}@s.whatsapp.net`, fromMe: false },
          message: {
            buttonsResponseMessage: {
              selectedButtonId: 'btn_camisetas',
              selectedDisplayText: 'Camisetas',
            },
          },
          messageTimestamp: Math.floor(Date.now() / 1000),
        },
      };

      const res = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send(buttonCamisetasPayload)
        .expect(200);

      expect(res.body.received).toBe(true);

      const execution = await prisma.flowExecution.findUnique({ where: { id: executionId } });
      expect(execution!.status).toBe(ExecutionStatus.WAITING_FOR_INPUT);
      expect(execution!.currentNodeId).toBe('node-7');

      // Verifica pergunta enviada
      const outboxMessages = await prisma.outboxMessage.findMany({
        where: { executionId },
        orderBy: { createdAt: 'asc' },
      });
      const lastOutbox = outboxMessages[outboxMessages.length - 1];
      expect(lastOutbox.payload).toMatchObject({
        text: 'Temos diversas opções. Qual tamanho você procura?',
      });
    });

    it('2.4 Passo 4: Cliente responde "Tamanho M" -> Nó 8 captura em {{contact.product_size}}, Nó 9 envia confirmação e Nó 10 finaliza', async () => {
      const answerPayload = {
        event: 'messages.upsert',
        instance: instanceAlfa,
        data: {
          key: { id: msgId('msg_e2e_004'), remoteJid: `${testPhone}@s.whatsapp.net`, fromMe: false },
          message: { conversation: 'M' },
          messageTimestamp: Math.floor(Date.now() / 1000),
        },
      };

      const res = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send(answerPayload)
        .expect(200);

      expect(res.body.received).toBe(true);

      // Execução deve ter percorrido node-8, node-9 e chegado em node-10 com status COMPLETED
      const execution = await prisma.flowExecution.findUnique({ where: { id: executionId } });
      expect(execution!.status).toBe(ExecutionStatus.COMPLETED);
      expect(execution!.currentNodeId).toBe('node-10');

      // Verifica se a resposta foi gravada no Contact customFields
      const contact = await prisma.contact.findUnique({
        where: { tenantId_phone: { tenantId: tenantAlfa, phone: testPhone } },
      });
      expect(contact).toBeDefined();
      const customFields = contact!.customFields as Record<string, any>;
      expect(customFields.product_size).toBe('M');

      // Verifica mensagens finais enviadas: confirmação (node-9) e despedida (node-10)
      const outboxMessages = await prisma.outboxMessage.findMany({
        where: { executionId },
        orderBy: { createdAt: 'asc' },
      });
      const texts = outboxMessages.map((m) => (m.payload as any).text);
      expect(texts).toContain('Perfeito! Vou encaminhar seu interesse para nosso atendimento.');
      expect(texts).toContain('Atendimento concluído. Tenha um excelente dia!');
    });
  });

  // =========================================================================
  // 3. FLUXOS ALTERNATIVOS: CONSULTAR PREÇOS E ATENDIMENTO HUMANO
  // =========================================================================
  describe('3. Fluxos Alternativos (Consultar Preços & Atendimento Humano)', () => {
    const phonePrecos = '5511977770001';
    const phoneAtendente = '5511977770002';

    it('3.1 Alternativo 1: Cliente escolhe "Consultar preços" -> Envia tabela de preços e encerra', async () => {
      // Inicia novo atendimento
      await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('alt_precos_01'), remoteJid: `${phonePrecos}@s.whatsapp.net`, fromMe: false },
            message: { conversation: 'Quero comprar' },
          },
        })
        .expect(200);

      // Cliente clica em "Consultar preços"
      await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('alt_precos_02'), remoteJid: `${phonePrecos}@s.whatsapp.net`, fromMe: false },
            message: {
              buttonsResponseMessage: {
                selectedButtonId: 'btn_precos',
                selectedDisplayText: 'Consultar preços',
              },
            },
          },
        })
        .expect(200);

      const exec = await prisma.flowExecution.findFirst({
        where: { tenantId: tenantAlfa, contactPhone: phonePrecos },
        orderBy: { startedAt: 'desc' },
      });
      expect(exec!.status).toBe(ExecutionStatus.COMPLETED);

      const outbox = await prisma.outboxMessage.findMany({
        where: { executionId: exec!.id },
      });
      const messages = outbox.map((o) => (o.payload as any).text);
      expect(messages).toContain('Nossos preços: Camisetas R$ 49,90 | Calças R$ 99,90 | Acessórios R$ 29,90.');
    });

    it('3.2 Alternativo 2: Cliente escolhe "Falar com atendente" -> Transfere para HUMAN_HANDOFF e silencia o bot', async () => {
      // Inicia
      await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('alt_atend_01'), remoteJid: `${phoneAtendente}@s.whatsapp.net`, fromMe: false },
            message: { conversation: 'Quero comprar' },
          },
        })
        .expect(200);

      // Clica em "Falar com atendente"
      await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('alt_atend_02'), remoteJid: `${phoneAtendente}@s.whatsapp.net`, fromMe: false },
            message: {
              buttonsResponseMessage: {
                selectedButtonId: 'btn_atendente',
                selectedDisplayText: 'Falar com atendente',
              },
            },
          },
        })
        .expect(200);

      const exec = await prisma.flowExecution.findFirst({
        where: { tenantId: tenantAlfa, contactPhone: phoneAtendente },
        orderBy: { startedAt: 'desc' },
      });
      expect(exec!.status).toBe(ExecutionStatus.HUMAN_HANDOFF);

      // Mensagem subsequente do cliente: o bot DEVE ignorar e não disparar novo fluxo
      const subsequentRes = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('alt_atend_03'), remoteJid: `${phoneAtendente}@s.whatsapp.net`, fromMe: false },
            message: { conversation: 'Alô, alguém aí me ajuda?' },
          },
        })
        .expect(200);

      // Verifica que o bot se manteve inativo
      const outboxCountBefore = await prisma.outboxMessage.count({
        where: { executionId: exec!.id },
      });
      // Nenhuma mensagem automatizada a mais foi despachada
      expect(subsequentRes.body.received).toBe(true);
      const outboxCountAfter = await prisma.outboxMessage.count({
        where: { executionId: exec!.id },
      });
      expect(outboxCountAfter).toBe(outboxCountBefore);
    });
  });

  // =========================================================================
  // 4. TESTES DE RESILIÊNCIA E TRATAMENTO DE FALHAS
  // =========================================================================
  describe('4. Testes de Resiliência', () => {
    const phoneResilience = '5511966660001';

    it('4.1 Sobrevivência à reinicialização: Execução em WAITING_FOR_INPUT retoma sem perda de variáveis', async () => {
      // Inicia execução
      await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('resil_reboot_01'), remoteJid: `${phoneResilience}@s.whatsapp.net`, fromMe: false },
            message: { conversation: 'Quero comprar' },
          },
        })
        .expect(200);

      const exec = await prisma.flowExecution.findFirst({
        where: { tenantId: tenantAlfa, contactPhone: phoneResilience },
        orderBy: { startedAt: 'desc' },
      });
      expect(exec!.status).toBe(ExecutionStatus.WAITING_FOR_INPUT);

      // Simula retomada após reboot (o motor lê direto do PostgreSQL sem depender de memória volátil)
      await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('resil_reboot_02'), remoteJid: `${phoneResilience}@s.whatsapp.net`, fromMe: false },
            message: {
              buttonsResponseMessage: {
                selectedButtonId: 'btn_produtos',
                selectedDisplayText: 'Conhecer produtos',
              },
            },
          },
        })
        .expect(200);

      const updatedExec = await prisma.flowExecution.findUnique({ where: { id: exec!.id } });
      expect(updatedExec!.currentNodeId).toBe('node-5');
      expect(updatedExec!.status).toBe(ExecutionStatus.WAITING_FOR_INPUT);
    });

    it('4.2 Webhook duplicado: Mesma mensagem enviada duas vezes é idempotente e ignorada na segunda vez', async () => {
      const duplicateMsgId = msgId('msg_dup');
      const duplicatePayload = {
        event: 'messages.upsert',
        instance: instanceAlfa,
        data: {
          key: { id: duplicateMsgId, remoteJid: `${phoneResilience}@s.whatsapp.net`, fromMe: false },
          message: { conversation: 'Conhecer produtos' },
        },
      };

      // Primeiro envio
      const firstRes = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send(duplicatePayload)
        .expect(200);
      expect(firstRes.body.received).toBe(true);

      // Segundo envio com o MESMO messageId
      const secondRes = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send(duplicatePayload)
        .expect(200);

      expect(secondRes.body.received).toBe(true);
      expect(secondRes.body.reason).toMatch(/duplicate_/);
    });

    it('4.3 Cliente digitando texto em vez de clicar no botão: Motor reconhece "1" ou rótulo do botão', async () => {
      const phoneManualText = '5511966660002';
      // Inicia
      await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('manual_01'), remoteJid: `${phoneManualText}@s.whatsapp.net`, fromMe: false },
            message: { conversation: 'Quero comprar' },
          },
        })
        .expect(200);

      // Em vez de clicar, cliente digita "1" (correspondente ao primeiro botão "Conhecer produtos")
      await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('manual_02'), remoteJid: `${phoneManualText}@s.whatsapp.net`, fromMe: false },
            message: { conversation: '1' },
          },
        })
        .expect(200);

      const exec = await prisma.flowExecution.findFirst({
        where: { tenantId: tenantAlfa, contactPhone: phoneManualText },
        orderBy: { startedAt: 'desc' },
      });
      // Avançou corretamente para o nó 5 de categorias!
      expect(exec!.currentNodeId).toBe('node-5');
    });

    it('4.4 Falha temporária da Evolution API: Outbox registra tentativas de retry e DLQ se esgotado', async () => {
      const phoneDlq = '5511966660003';
      mockProvider.simulateFailureNext('503 Service Unavailable no Gateway WhatsApp');

      const outbox = await outboxService.recordOutgoingMessage(
        tenantAlfa,
        null,
        instanceAlfa,
        phoneDlq,
        'text',
        { text: 'Mensagem de teste de falha' },
      );

      // Tenta despachar com retry via outboxService
      const result = await outboxService.dispatch(outbox.id, 1);
      expect(result.success).toBe(false);

      const failedOutbox = await prisma.outboxMessage.findUnique({ where: { id: outbox.id } });
      // Registrou a tentativa e gravou status de falha
      expect(failedOutbox!.attempts).toBeGreaterThanOrEqual(1);
      expect(failedOutbox!.status).toBe(OutboxStatus.FAILED);
    });
  });

  // =========================================================================
  // 5. TESTES DE SEGURANÇA E MULTI-TENANCY
  // =========================================================================
  describe('5. Testes de Segurança e Isolamento Multi-Tenant', () => {
    let betaAutomationId: string;

    beforeAll(async () => {
      // Cria automação no Tenant Beta
      const res = await request(app.getHttpServer())
        .post('/automations')
        .set('x-tenant-id', tenantBeta)
        .send({ name: 'Fluxo Secreto Beta' })
        .expect(201);
      betaAutomationId = res.body.id;
    });

    it('5.1 Isolamento Multi-Tenant: Tenant Alfa NÃO pode consultar automações do Tenant Beta', async () => {
      await request(app.getHttpServer())
        .get(`/automations/${betaAutomationId}`)
        .set('x-tenant-id', tenantAlfa)
        .expect(404);
    });

    it('5.2 Isolamento Multi-Tenant: Tenant Alfa NÃO pode publicar fluxo do Tenant Beta', async () => {
      await request(app.getHttpServer())
        .post(`/automations/${betaAutomationId}/publish`)
        .set('x-tenant-id', tenantAlfa)
        .expect(404);
    });

    it('5.3 Proteção de Credenciais: Chaves de API de instâncias WhatsApp são criptografadas com AES-256-GCM', async () => {
      const inst = await prisma.whatsAppInstance.findFirst({
        where: { tenantId: tenantAlfa, instanceName: realInstanceName },
      });

      expect(inst!.apiKeyEncrypted).toBeDefined();
      // Não deve estar em texto puro
      expect(inst!.apiKeyEncrypted).not.toBe(realEvolutionKey);
      // Formato IV.authTag.ciphertext
      expect(inst!.apiKeyEncrypted!.split('.').length).toBe(3);

      // Decriptografia reversa autorizada
      const decrypted = cryptoService.decrypt(inst!.apiKeyEncrypted!);
      expect(decrypted).toBe(realEvolutionKey);
    });
  });

  // =========================================================================
  // 6. TESTES DE CONFORMIDADE (WHATSAPP BUSINESS / META POLICIES)
  // =========================================================================
  describe('6. Testes de Conformidade (Meta WhatsApp Policies)', () => {
    const phoneOptOut = '5511944440001';

    it('6.1 Descadastramento (Opt-out): Cliente enviando "SAIR" cancela execução, atualiza tag para OPT_OUT e confirma', async () => {
      // Inicia conversa
      await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('optout_01'), remoteJid: `${phoneOptOut}@s.whatsapp.net`, fromMe: false },
            message: { conversation: 'Quero comprar' },
          },
        })
        .expect(200);

      // Cliente envia "SAIR"
      const optOutRes = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('optout_02'), remoteJid: `${phoneOptOut}@s.whatsapp.net`, fromMe: false },
            message: { conversation: 'SAIR' },
          },
        })
        .expect(200);

      expect(optOutRes.body.received).toBe(true);

      // Contato deve possuir tag OPT_OUT e customFields.optOut = true
      const contact = await prisma.contact.findUnique({
        where: { tenantId_phone: { tenantId: tenantAlfa, phone: phoneOptOut } },
      });
      expect(contact!.tags).toContain('OPT_OUT');
      expect((contact!.customFields as any).optOut).toBe(true);

      // Execução cancelada
      const exec = await prisma.flowExecution.findFirst({
        where: { tenantId: tenantAlfa, contactPhone: phoneOptOut },
        orderBy: { startedAt: 'desc' },
      });
      expect(exec!.status).toBe(ExecutionStatus.CANCELLED);

      // Mensagens subsequentes são bloqueadas
      const blockedRes = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('optout_03'), remoteJid: `${phoneOptOut}@s.whatsapp.net`, fromMe: false },
            message: { conversation: 'Quero comprar' },
          },
        })
        .expect(200);

      expect(blockedRes.body.status).toBe('ignored');
      expect(blockedRes.body.reason).toBe('contact_opted_out');
    });

    it('6.2 Reativação de Consentimento (Opt-in): Cliente enviando "QUERO VOLTAR" remove OPT_OUT e registra consentGivenAt', async () => {
      const optInRes = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${instanceAlfa}`)
        .set('apikey', realEvolutionKey)
        .send({
          event: 'messages.upsert',
          instance: instanceAlfa,
          data: {
            key: { id: msgId('optin_01'), remoteJid: `${phoneOptOut}@s.whatsapp.net`, fromMe: false },
            message: { conversation: 'QUERO VOLTAR' },
          },
        })
        .expect(200);

      expect(optInRes.body.received).toBe(true);

      const contact = await prisma.contact.findUnique({
        where: { tenantId_phone: { tenantId: tenantAlfa, phone: phoneOptOut } },
      });
      expect(contact!.tags).not.toContain('OPT_OUT');
      expect((contact!.customFields as any).optOut).toBe(false);
      expect((contact!.customFields as any).consentGivenAt).toBeDefined();
    });

    it('6.3 Janela de 24 horas: Mensagem comum bloqueada quando última interação tem mais de 24 horas', async () => {
      const phoneExpired24h = '5511933330001';
      // Contato com última interação há 26 horas
      const expiredDate = new Date(Date.now() - 26 * 60 * 60 * 1000);
      await prisma.contact.upsert({
        where: { tenantId_phone: { tenantId: tenantAlfa, phone: phoneExpired24h } },
        update: { lastInteractionAt: expiredDate },
        create: {
          tenantId: tenantAlfa,
          phone: phoneExpired24h,
          lastInteractionAt: expiredDate,
        },
      });

      // Instância Cloud API para a qual a política de 24h é estritamente obrigatória
      await prisma.whatsAppInstance.upsert({
        where: { tenantId_instanceName: { tenantId: tenantAlfa, instanceName: 'zap-cloud-24h' } },
        update: { providerType: WhatsAppProviderType.CLOUD_API },
        create: {
          tenantId: tenantAlfa,
          instanceName: 'zap-cloud-24h',
          phoneNumber: '551155552222',
          providerType: WhatsAppProviderType.CLOUD_API,
          status: 'CONNECTED',
        },
      });

      // Cria outbox de mensagem comum
      const outbox = await outboxService.recordOutgoingMessage(
        tenantAlfa,
        null,
        'zap-cloud-24h',
        phoneExpired24h,
        'text',
        { text: 'Promoção relâmpago!' },
      );

      // Despacho deve ser recusado pela política de 24h
      const dispatchResult = await outboxService.dispatch(outbox.id, 1);
      expect(dispatchResult.success).toBe(false);
      expect(dispatchResult.error).toMatch(/Janela de 24h expirada/);
    });
  });

  // =========================================================================
  // 7. INTEGRAÇÃO REAL COM O CONTAINER DOCKER EVOLUTION API (SEM MOCKS)
  // =========================================================================
  describe('7. Integração Real com o Container Evolution API v2 (Sem Mocks)', () => {
    it('7.1 Deve se comunicar via HTTP real com a Evolution API e verificar instâncias ativas', async () => {
      const res = await axios.get(`${realEvolutionUrl}/instance/fetchInstances`, {
        headers: { apikey: realEvolutionKey },
        timeout: 5000,
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);

      const liveInstance = res.data.find((i: any) => i.name === realInstanceName);
      expect(liveInstance).toBeDefined();
      expect(liveInstance.connectionStatus).toBe('open');
      expect(liveInstance.integration).toBe('WHATSAPP-BAILEYS');
    });

    it('7.2 Deve invocar sendPresence e markAsRead no container real sem mock', async () => {
      const configServiceMock: any = {
        get: (key: string) => {
          if (key === 'EVOLUTION_SERVER_URL') return realEvolutionUrl;
          if (key === 'EVOLUTION_API_KEY') return realEvolutionKey;
          return null;
        },
      };
      const capService = new WhatsAppCapabilitiesService();
      const realAdapter = new EvolutionApiV2Adapter(configServiceMock, capService);

      // Usa o número do proprietário da instância real para garantir que o número existe no WhatsApp
      const liveOwnerPhone = '551156640500';

      // 1. sendPresence
      await expect(
        realAdapter.sendPresence({
          instanceName: realInstanceName,
          recipient: liveOwnerPhone,
          presence: 'composing',
        }),
      ).resolves.not.toThrow();

      // 2. markAsRead
      await expect(
        realAdapter.markAsRead({
          instanceName: realInstanceName,
          recipient: liveOwnerPhone,
          messageId: 'MSG_REAL_E2E_001',
          fromMe: false,
        }),
      ).resolves.not.toThrow();
    });

    it('7.3 Deve processar webhook autêntico da Evolution API e executar o motor até a conclusão', async () => {
      // Dispara webhook HTTP real no endpoint da aplicação simulando mensagem de cliente real
      const realWebhookPayload = {
        event: 'messages.upsert',
        instance: realInstanceName,
        data: {
          key: {
            remoteJid: '551156640500@s.whatsapp.net',
            fromMe: false,
            id: `real_evt_${Date.now()}`,
          },
          pushName: 'Cliente Real WhatsApp',
          message: {
            conversation: 'Quero comprar',
          },
          messageType: 'conversation',
          messageTimestamp: Math.floor(Date.now() / 1000),
        },
      };

      const webhookRes = await request(app.getHttpServer())
        .post(`/webhooks/whatsapp/${realInstanceName}`)
        .set('apikey', realEvolutionKey)
        .send(realWebhookPayload)
        .expect(200);

      expect(webhookRes.body.received).toBe(true);
      expect(webhookRes.body.eventId).toBeDefined();

      // Verifica auditoria na tabela webhook_events
      const auditRecord = await prisma.webhookEvent.findUnique({
        where: { id: webhookRes.body.eventId },
      });
      expect(auditRecord).toBeDefined();
      expect(auditRecord!.status).toBe(WebhookEventStatus.PROCESSED);
      expect(auditRecord!.instanceName).toBe(realInstanceName);
    });
  });
});
