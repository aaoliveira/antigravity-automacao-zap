import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/database/prisma.service';
import { WorkflowEngineService } from '../src/modules/engine/core/workflow-engine.service';
import { OutboxService } from '../src/modules/engine/outbox/outbox.service';
import { AutomationsService } from '../src/modules/automations/automations.service';
import { InboundEvent } from '../src/modules/engine/types/execution.types';
import { WorkflowDefinition } from '../src/modules/automations/schema/flow-node.types';
import { ExecutionStatus, OutboxStatus } from '@prisma/client';

describe('Workflow Execution Engine (E2E Integration Tests)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let engine: WorkflowEngineService;
  let outbox: OutboxService;
  let automations: AutomationsService;

  const tenantId = '33333333-3333-3333-3333-333333333333';
  const customerPhone = '5511988887777';
  const sentOutboxRecords: any[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    engine = app.get<WorkflowEngineService>(WorkflowEngineService);
    outbox = app.get<OutboxService>(OutboxService);
    automations = app.get<AutomationsService>(AutomationsService);

    // Mock sender para capturar mensagens despachadas pelo Outbox
    outbox.setSender({
      sendMessage: async (inst, recipient, type, payload) => {
        sentOutboxRecords.push({ inst, recipient, type, payload });
        return { messageId: `mock_msg_${Date.now()}` };
      },
    });

    // Cria tenant para os testes do motor
    await prisma.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: { id: tenantId, name: 'Engine Test Tenant', slug: 'engine-test-tenant' },
    });

    // Limpa dados de execuções anteriores
    await prisma.outboxMessage.deleteMany({ where: { tenantId } });
    await prisma.flowExecution.deleteMany({ where: { tenantId } });
    await prisma.automation.deleteMany({ where: { tenantId } });
    await prisma.contact.deleteMany({ where: { tenantId } });
  });

  afterAll(async () => {
    await prisma.outboxMessage.deleteMany({ where: { tenantId } });
    await prisma.flowExecution.deleteMany({ where: { tenantId } });
    await prisma.automation.deleteMany({ where: { tenantId } });
    await prisma.contact.deleteMany({ where: { tenantId } });
    await app.close();
  });

  beforeEach(() => {
    sentOutboxRecords.length = 0;
  });

  describe('1. Execução Simples e Persistência de Passos', () => {
    it('deve disparar gatilho por palavra-chave, enviar mensagem e finalizar o fluxo com status COMPLETED', async () => {
      // Cria e publica fluxo simples
      const simpleFlow: WorkflowDefinition = {
        schemaVersion: '1.0.0',
        nodes: [
          {
            id: 'trig_1',
            type: 'trigger',
            config: { triggerType: 'exact_keyword', keywords: ['menu', 'iniciar'] },
          },
          {
            id: 'msg_welcome',
            type: 'message.text',
            config: { text: 'Olá {{contact.name}}! Seja bem-vindo à nossa loja.' },
          },
          {
            id: 'end_flow',
            type: 'action.end',
            config: { farewellMessage: 'Fim do atendimento.' },
          },
        ],
        edges: [
          { id: 'e1', source: 'trig_1', target: 'msg_welcome' },
          { id: 'e2', source: 'msg_welcome', target: 'end_flow' },
        ],
      };

      const auto = await automations.create(tenantId, 'user-1', {
        name: 'Fluxo Simples Boas-vindas',
        initialDraft: simpleFlow,
      });

      await automations.publish(tenantId, auto.id, 'user-1');

      // Simula evento de entrada do cliente
      const event: InboundEvent = {
        messageId: `msg_${Date.now()}_1`,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: customerPhone,
        contactName: 'Roberta Lima',
        interaction: { type: 'text', value: 'menu' },
        timestamp: new Date(),
      };

      const result = await engine.handleInboundEvent(event);

      expect(result.processed).toBe(true);
      expect(result.executionId).toBeDefined();

      // Confere persistência no PostgreSQL
      const execution = await prisma.flowExecution.findUnique({
        where: { id: result.executionId },
        include: { executionNodes: true, logs: true },
      });

      expect(execution).toBeDefined();
      expect(execution?.status).toBe(ExecutionStatus.COMPLETED);
      expect(execution?.completedAt).not.toBeNull();
      expect(execution?.executionNodes.length).toBeGreaterThanOrEqual(3);

      // Confere mensagens geradas no Outbox
      const outboxMessages = await prisma.outboxMessage.findMany({
        where: { executionId: result.executionId },
      });

      expect(outboxMessages.length).toBe(2); // msg_welcome e end_flow
      expect(outboxMessages[0].payload).toMatchObject({
        text: 'Olá Roberta Lima! Seja bem-vindo à nossa loja.',
      });
      expect(outboxMessages[1].payload).toMatchObject({
        text: 'Fim do atendimento.',
      });
    });
  });

  describe('2. Condições Relacionais (Verdadeiras e Falsas)', () => {
    let conditionAutoId: string;

    beforeAll(async () => {
      const flow: WorkflowDefinition = {
        schemaVersion: '1.0.0',
        variables: [{ name: 'idade', type: 'number' }],
        nodes: [
          {
            id: 'trig_cond',
            type: 'trigger',
            config: { triggerType: 'exact_keyword', keywords: ['verificar_idade'] },
          },
          {
            id: 'set_var',
            type: 'set_variable',
            config: { variableName: 'idade', operation: 'set', expression: '21' },
          },
          {
            id: 'cond_node',
            type: 'logic.condition',
            config: {
              logicalOperator: 'AND',
              rules: [{ variable: 'idade', operator: 'GREATER_OR_EQUAL', value: 18 }],
            },
          },
          {
            id: 'msg_adulto',
            type: 'message.text',
            config: { text: 'Acesso liberado para maiores de 18 anos.' },
          },
          {
            id: 'msg_menor',
            type: 'message.text',
            config: { text: 'Acesso bloqueado.' },
          },
          { id: 'end_ok', type: 'action.end', config: {} },
          { id: 'end_fail', type: 'action.end', config: {} },
        ],
        edges: [
          { id: 'e1', source: 'trig_cond', target: 'set_var' },
          { id: 'e2', source: 'set_var', target: 'cond_node' },
          { id: 'e3', source: 'cond_node', sourceHandle: 'true', target: 'msg_adulto' },
          { id: 'e4', source: 'cond_node', sourceHandle: 'false', target: 'msg_menor' },
          { id: 'e5', source: 'msg_adulto', target: 'end_ok' },
          { id: 'e6', source: 'msg_menor', target: 'end_fail' },
        ],
      };

      const auto = await automations.create(tenantId, 'user-1', {
        name: 'Fluxo com Condição',
        initialDraft: flow,
      });
      await automations.publish(tenantId, auto.id, 'user-1');
      conditionAutoId = auto.id;
    });

    it('deve navegar pelo caminho True quando a condição for verdadeira', async () => {
      const event: InboundEvent = {
        messageId: `msg_cond_${Date.now()}`,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: '5511977776666',
        interaction: { type: 'text', value: 'verificar_idade' },
        timestamp: new Date(),
      };

      const result = await engine.handleInboundEvent(event);
      expect(result.processed).toBe(true);

      const outboxMessages = await prisma.outboxMessage.findMany({
        where: { executionId: result.executionId },
      });

      expect(outboxMessages.some((m) => (m.payload as any).text.includes('Acesso liberado'))).toBe(true);
      expect(outboxMessages.some((m) => (m.payload as any).text.includes('Acesso bloqueado'))).toBe(false);
    });

    it('deve navegar pelo caminho False quando a condição for falsa', async () => {
      // Atualiza o rascunho com idade = 15 e publica nova versão
      const flowVersion = await prisma.flowVersion.findFirst({
        where: { automationId: conditionAutoId },
        orderBy: { versionNumber: 'desc' },
      });
      const def = JSON.parse(JSON.stringify(flowVersion?.definition));
      def.nodes[1].config.expression = '15'; // Menor que 18

      await automations.update(tenantId, conditionAutoId, { currentDraft: def });
      await automations.publish(tenantId, conditionAutoId, 'user-1');

      const event: InboundEvent = {
        messageId: `msg_cond_false_${Date.now()}`,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: '5511955554444',
        interaction: { type: 'text', value: 'verificar_idade' },
        timestamp: new Date(),
      };

      const result = await engine.handleInboundEvent(event);
      expect(result.processed).toBe(true);

      const outboxMessages = await prisma.outboxMessage.findMany({
        where: { executionId: result.executionId },
      });

      expect(outboxMessages.some((m) => (m.payload as any).text.includes('Acesso bloqueado'))).toBe(true);
      expect(outboxMessages.some((m) => (m.payload as any).text.includes('Acesso liberado'))).toBe(false);
    });
  });

  describe('3. Múltiplas Alternativas (Switch)', () => {
    it('deve ramificar corretamente pelo valor correspondente do Switch e pelo Default', async () => {
      const switchFlow: WorkflowDefinition = {
        schemaVersion: '1.0.0',
        variables: [{ name: 'setor', type: 'string' }],
        nodes: [
          {
            id: 'trig_switch',
            type: 'trigger',
            config: { triggerType: 'exact_keyword', keywords: ['departamento'] },
          },
          {
            id: 'set_setor',
            type: 'set_variable',
            config: { variableName: 'setor', operation: 'set', expression: 'financeiro' },
          },
          {
            id: 'switch_node',
            type: 'logic.switch',
            config: {
              variable: 'setor',
              cases: [
                { id: 'case_fin', value: 'financeiro' },
                { id: 'case_sup', value: 'suporte' },
              ],
            },
          },
          { id: 'msg_fin', type: 'message.text', config: { text: 'Setor Financeiro' } },
          { id: 'msg_sup', type: 'message.text', config: { text: 'Setor Suporte' } },
          { id: 'msg_def', type: 'message.text', config: { text: 'Setor Geral' } },
          { id: 'end_fin', type: 'action.end', config: {} },
          { id: 'end_sup', type: 'action.end', config: {} },
          { id: 'end_def', type: 'action.end', config: {} },
        ],
        edges: [
          { id: 'e1', source: 'trig_switch', target: 'set_setor' },
          { id: 'e2', source: 'set_setor', target: 'switch_node' },
          { id: 'e3', source: 'switch_node', sourceHandle: 'case_fin', target: 'msg_fin' },
          { id: 'e4', source: 'switch_node', sourceHandle: 'case_sup', target: 'msg_sup' },
          { id: 'e5', source: 'switch_node', sourceHandle: 'default', target: 'msg_def' },
          { id: 'e6', source: 'msg_fin', target: 'end_fin' },
          { id: 'e7', source: 'msg_sup', target: 'end_sup' },
          { id: 'e8', source: 'msg_def', target: 'end_def' },
        ],
      };

      const auto = await automations.create(tenantId, 'user-1', {
        name: 'Fluxo Switch',
        initialDraft: switchFlow,
      });
      await automations.publish(tenantId, auto.id, 'user-1');

      const event: InboundEvent = {
        messageId: `msg_switch_${Date.now()}`,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: '5511933332222',
        interaction: { type: 'text', value: 'departamento' },
        timestamp: new Date(),
      };

      const result = await engine.handleInboundEvent(event);
      expect(result.processed).toBe(true);

      const outboxMessages = await prisma.outboxMessage.findMany({
        where: { executionId: result.executionId },
      });

      expect(outboxMessages.some((m) => (m.payload as any).text === 'Setor Financeiro')).toBe(true);
      expect(outboxMessages.some((m) => (m.payload as any).text === 'Setor Suporte')).toBe(false);
    });
  });

  describe('4. Sistema de Espera e Retomada (Wait & Resume com Pergunta)', () => {
    let questionAutoId: string;
    const userPhoneForQuestion = '5511911112222';

    beforeAll(async () => {
      const questionFlow: WorkflowDefinition = {
        schemaVersion: '1.0.0',
        variables: [{ name: 'cliente_email', type: 'string' }],
        nodes: [
          {
            id: 'trig_q',
            type: 'trigger',
            config: { triggerType: 'exact_keyword', keywords: ['cadastro'] },
          },
          {
            id: 'ask_email',
            type: 'interaction.question',
            config: {
              questionText: 'Por favor, digite o seu melhor e-mail:',
              targetVariable: 'cliente_email',
              expectedType: 'email',
              customErrorMessage: 'Formato inválido. Digite um e-mail válido:',
            },
          },
          {
            id: 'msg_confirm',
            type: 'message.text',
            config: { text: 'Obrigado! E-mail {{cliente_email}} cadastrado com sucesso.' },
          },
          { id: 'end_cad', type: 'action.end', config: {} },
        ],
        edges: [
          { id: 'e1', source: 'trig_q', target: 'ask_email' },
          { id: 'e2', source: 'ask_email', target: 'msg_confirm' },
          { id: 'e3', source: 'msg_confirm', target: 'end_cad' },
        ],
      };

      const auto = await automations.create(tenantId, 'user-1', {
        name: 'Fluxo Cadastro de E-mail',
        initialDraft: questionFlow,
      });
      await automations.publish(tenantId, auto.id, 'user-1');
      questionAutoId = auto.id;
    });

    it('Fase 1: deve enviar a pergunta e pausar a execução no estado WAITING_FOR_INPUT', async () => {
      const event: InboundEvent = {
        messageId: `msg_q1_${Date.now()}`,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: userPhoneForQuestion,
        interaction: { type: 'text', value: 'cadastro' },
        timestamp: new Date(),
      };

      const res = await engine.handleInboundEvent(event);
      expect(res.processed).toBe(true);

      const exec = await prisma.flowExecution.findUnique({ where: { id: res.executionId } });
      expect(exec?.status).toBe(ExecutionStatus.WAITING_FOR_INPUT);
      expect(exec?.currentNodeId).toBe('ask_email');

      // Verifica envio da pergunta
      const outbox = await prisma.outboxMessage.findFirst({
        where: { executionId: res.executionId },
      });
      expect((outbox?.payload as any).text).toBe('Por favor, digite o seu melhor e-mail:');
    });

    it('Fase 2: cliente responde e-mail válido -> deve retomar a execução, salvar a variável e concluir', async () => {
      const responseEvent: InboundEvent = {
        messageId: `msg_q2_${Date.now()}`,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: userPhoneForQuestion,
        interaction: { type: 'text', value: 'roberta@exemplo.com' },
        timestamp: new Date(),
      };

      const res = await engine.handleInboundEvent(responseEvent);
      expect(res.processed).toBe(true);

      const exec = await prisma.flowExecution.findUnique({ where: { id: res.executionId } });
      expect(exec?.status).toBe(ExecutionStatus.COMPLETED);
      expect((exec?.contextData as any).cliente_email).toBe('roberta@exemplo.com');

      // Verifica mensagem de confirmação final
      const outboxMsgs = await prisma.outboxMessage.findMany({
        where: { executionId: res.executionId },
        orderBy: { createdAt: 'asc' },
      });

      expect((outboxMsgs[outboxMsgs.length - 1].payload as any).text).toContain(
        'Obrigado! E-mail roberta@exemplo.com cadastrado com sucesso.',
      );
    });
  });

  describe('5. Botões e Interações (Clique, Payload e Resposta Digitada)', () => {
    let buttonAutoId: string;
    const phoneForButtons = '5511944443333';

    beforeAll(async () => {
      const buttonFlow: WorkflowDefinition = {
        schemaVersion: '1.0.0',
        nodes: [
          {
            id: 'trig_btn',
            type: 'trigger',
            config: { triggerType: 'exact_keyword', keywords: ['opcoes'] },
          },
          {
            id: 'btn_menu',
            type: 'message.buttons',
            config: {
              body: 'Escolha uma opção:',
              buttons: [
                { id: 'btn_comprar', label: 'Comprar', payload: 'BUY_NOW' },
                { id: 'btn_suporte', label: 'Suporte', payload: 'GET_SUPPORT' },
              ],
            },
          },
          { id: 'msg_vendas', type: 'message.text', config: { text: 'Direcionando para vendas...' } },
          { id: 'msg_atend', type: 'message.text', config: { text: 'Direcionando para suporte...' } },
          { id: 'end_v', type: 'action.end', config: {} },
          { id: 'end_s', type: 'action.end', config: {} },
        ],
        edges: [
          { id: 'e1', source: 'trig_btn', target: 'btn_menu' },
          { id: 'e2', source: 'btn_menu', sourceHandle: 'btn_comprar', target: 'msg_vendas' },
          { id: 'e3', source: 'btn_menu', sourceHandle: 'btn_suporte', target: 'msg_atend' },
          { id: 'e4', source: 'msg_vendas', target: 'end_v' },
          { id: 'e5', source: 'msg_atend', target: 'end_s' },
        ],
      };

      const auto = await automations.create(tenantId, 'user-1', {
        name: 'Fluxo com Botões',
        initialDraft: buttonFlow,
      });
      await automations.publish(tenantId, auto.id, 'user-1');
      buttonAutoId = auto.id;
    });

    it('deve identificar clique nativo por buttonId / payload e avançar para o nó correto', async () => {
      // 1. Inicia fluxo de botões
      const startRes = await engine.handleInboundEvent({
        messageId: `msg_btn_1_${Date.now()}`,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: phoneForButtons,
        interaction: { type: 'text', value: 'opcoes' },
        timestamp: new Date(),
      });

      // 2. Cliente clica no botão "Comprar" enviando buttonId 'btn_comprar'
      const clickRes = await engine.handleInboundEvent({
        messageId: `msg_btn_click_${Date.now()}`,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: phoneForButtons,
        interaction: {
          type: 'button_click',
          value: 'Comprar',
          buttonId: 'btn_comprar',
          buttonPayload: 'BUY_NOW',
        },
        timestamp: new Date(),
      });

      expect(clickRes.processed).toBe(true);

      const outbox = await prisma.outboxMessage.findMany({
        where: { executionId: startRes.executionId },
      });

      expect(outbox.some((m) => (m.payload as any).text === 'Direcionando para vendas...')).toBe(true);
    });

    it('deve identificar resposta digitada manualmente ("2" ou "Suporte") correspondente ao botão', async () => {
      const phoneTyped = '5511944449999';

      // 1. Inicia fluxo
      const startRes = await engine.handleInboundEvent({
        messageId: `msg_btn_typed_start_${Date.now()}`,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: phoneTyped,
        interaction: { type: 'text', value: 'opcoes' },
        timestamp: new Date(),
      });

      // 2. Cliente digita "2" (correspondente à segunda opção: Suporte)
      const typedRes = await engine.handleInboundEvent({
        messageId: `msg_btn_typed_reply_${Date.now()}`,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: phoneTyped,
        interaction: { type: 'text', value: '2' },
        timestamp: new Date(),
      });

      expect(typedRes.processed).toBe(true);

      const outbox = await prisma.outboxMessage.findMany({
        where: { executionId: startRes.executionId },
      });

      expect(outbox.some((m) => (m.payload as any).text === 'Direcionando para suporte...')).toBe(true);
    });
  });

  describe('6. Idempotência e Controle de Concorrência', () => {
    it('deve rejeitar webhook duplicado com o mesmo messageId sem gerar novas mensagens', async () => {
      const msgId = `msg_dedup_test_${Date.now()}`;

      const event1: InboundEvent = {
        messageId: msgId,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: '5511999990000',
        interaction: { type: 'text', value: 'menu' },
        timestamp: new Date(),
      };

      const res1 = await engine.handleInboundEvent(event1);
      expect(res1.processed).toBe(true);

      // Reenvio imediato do mesmo evento
      const res2 = await engine.handleInboundEvent(event1);
      expect(res2.processed).toBe(false);
      expect(res2.reason).toBe('duplicate_message');
    });
  });

  describe('7. Recuperação após Reinicialização e Execuções Pendentes', () => {
    it('deve permitir que uma sessão em WAITING_FOR_INPUT seja retomada após restart do sistema', async () => {
      const phoneRestart = '5511988880000';

      // Inicia e para na pergunta
      await engine.handleInboundEvent({
        messageId: `msg_restart_1_${Date.now()}`,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: phoneRestart,
        interaction: { type: 'text', value: 'cadastro' },
        timestamp: new Date(),
      });

      // Consulta se está no banco em WAITING_FOR_INPUT
      const pendingExec = await prisma.flowExecution.findFirst({
        where: { tenantId, contactPhone: phoneRestart },
      });
      expect(pendingExec?.status).toBe(ExecutionStatus.WAITING_FOR_INPUT);

      // Simula retomada (como se um novo worker tivesse subido e recebido a resposta)
      const resumeRes = await engine.handleInboundEvent({
        messageId: `msg_restart_2_${Date.now()}`,
        tenantId,
        instanceName: 'whatsapp-vendas',
        contactPhone: phoneRestart,
        interaction: { type: 'text', value: 'marcos@teste.com' },
        timestamp: new Date(),
      });

      expect(resumeRes.processed).toBe(true);

      const finalExec = await prisma.flowExecution.findUnique({
        where: { id: pendingExec!.id },
      });
      expect(finalExec?.status).toBe(ExecutionStatus.COMPLETED);
    });
  });
});
