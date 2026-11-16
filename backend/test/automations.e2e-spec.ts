import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/database/prisma.service';
import { WorkflowDefinition } from '../src/modules/automations/schema/flow-node.types';

describe('Automations API (E2E Integration & Multi-tenant Tests)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  const validFlow: WorkflowDefinition = {
    schemaVersion: '1.0.0',
    viewport: { x: 0, y: 0, zoom: 1 },
    variables: [{ name: 'user_email', type: 'string' }],
    nodes: [
      {
        id: 'node_trigger',
        type: 'trigger',
        position: { x: 100, y: 200 },
        config: {
          triggerType: 'exact_keyword',
          keywords: ['oi', 'ola'],
        },
      },
      {
        id: 'node_msg',
        type: 'message_text',
        position: { x: 400, y: 200 },
        config: {
          text: 'Olá! Como posso ajudar você hoje?',
        },
      },
      {
        id: 'node_end',
        type: 'end_flow',
        position: { x: 700, y: 200 },
        config: {
          farewellMessage: 'Até logo!',
        },
      },
    ],
    edges: [
      {
        id: 'edge_trig_msg',
        source: 'node_trigger',
        target: 'node_msg',
      },
      {
        id: 'edge_msg_end',
        source: 'node_msg',
        target: 'node_end',
      },
    ],
  };

  const invalidFlow: WorkflowDefinition = {
    schemaVersion: '1.0.0',
    nodes: [
      {
        id: 'node_trigger',
        type: 'trigger',
        config: { triggerType: 'any_message' },
      },
      {
        id: 'node_cond',
        type: 'condition', // Falta conexão true e false
        config: {
          logicalOperator: 'AND',
          rules: [{ variable: 'contact.name', operator: 'is_not_empty' }],
        },
      },
    ],
    edges: [
      {
        id: 'edge_trig_cond',
        source: 'node_trigger',
        target: 'node_cond',
      },
    ],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Garante que os tenants A e B existem no banco
    await prisma.tenant.upsert({
      where: { id: tenantA },
      update: {},
      create: { id: tenantA, name: 'Empresa Alfa Ltda', slug: 'empresa-alfa' },
    });

    await prisma.tenant.upsert({
      where: { id: tenantB },
      update: {},
      create: { id: tenantB, name: 'Empresa Beta S/A', slug: 'empresa-beta' },
    });

    // Limpa automações anteriores desses tenants
    await prisma.automation.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
  });

  afterAll(async () => {
    await prisma.automation.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await app.close();
  });

  describe('1. Segurança e Multi-tenancy Estrito', () => {
    it('deve rejeitar requisição sem cabeçalho x-tenant-id com HTTP 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/automations')
        .expect(401);
    });

    it('deve isolar dados entre empresas (Tenant B não pode acessar automação do Tenant A)', async () => {
      // 1. Tenant A cria uma automação
      const createRes = await request(app.getHttpServer())
        .post('/automations')
        .set('x-tenant-id', tenantA)
        .send({
          name: 'Fluxo Sigiloso Tenant A',
          initialDraft: validFlow,
        })
        .expect(201);

      const autoId = createRes.body.id;

      // 2. Tenant B tenta consultar a automação do Tenant A -> Deve retornar 404 Not Found
      await request(app.getHttpServer())
        .get(`/automations/${autoId}`)
        .set('x-tenant-id', tenantB)
        .expect(404);

      // 3. Tenant B tenta atualizar a automação do Tenant A -> 404 Not Found
      await request(app.getHttpServer())
        .put(`/automations/${autoId}`)
        .set('x-tenant-id', tenantB)
        .send({ name: 'Hackeado' })
        .expect(404);

      // 4. Tenant B tenta publicar a automação do Tenant A -> 404 Not Found
      await request(app.getHttpServer())
        .post(`/automations/${autoId}/publish`)
        .set('x-tenant-id', tenantB)
        .expect(404);

      // 5. Tenant B tenta excluir a automação do Tenant A -> 404 Not Found
      await request(app.getHttpServer())
        .delete(`/automations/${autoId}`)
        .set('x-tenant-id', tenantB)
        .expect(404);

      // 6. Tenant B lista automações -> Não deve conter o fluxo do Tenant A
      const listB = await request(app.getHttpServer())
        .get('/automations')
        .set('x-tenant-id', tenantB)
        .expect(200);

      expect(listB.body.some((a: any) => a.id === autoId)).toBe(false);
    });
  });

  describe('2. Ciclo de Vida Completo do Fluxo (CRUD, Validação, Publicação e Versionamento)', () => {
    let automationId: string;
    let version1Id: string;
    let version2Id: string;

    it('POST /automations: deve criar automação em rascunho', async () => {
      const res = await request(app.getHttpServer())
        .post('/automations')
        .set('x-tenant-id', tenantA)
        .send({
          name: 'Atendimento e Vendas',
          description: 'Fluxo principal de qualificação',
          initialDraft: validFlow,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Atendimento e Vendas');
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.currentDraft).toBeDefined();

      automationId = res.body.id;
    });

    it('GET /automations/:id: deve consultar os detalhes da automação criada', async () => {
      const res = await request(app.getHttpServer())
        .get(`/automations/${automationId}`)
        .set('x-tenant-id', tenantA)
        .expect(200);

      expect(res.body.id).toBe(automationId);
      expect(res.body.name).toBe('Atendimento e Vendas');
    });

    it('POST /automations/:id/validate: deve validar rascunho com sucesso', async () => {
      const res = await request(app.getHttpServer())
        .post(`/automations/${automationId}/validate`)
        .set('x-tenant-id', tenantA)
        .expect(200);

      expect(res.body.isValid).toBe(true);
      expect(res.body.errors).toHaveLength(0);
    });

    it('PUT /automations/:id: deve atualizar rascunho com fluxo inválido', async () => {
      await request(app.getHttpServer())
        .put(`/automations/${automationId}`)
        .set('x-tenant-id', tenantA)
        .send({
          currentDraft: invalidFlow,
        })
        .expect(200);
    });

    it('POST /automations/:id/validate: deve identificar erros estruturais no fluxo inválido', async () => {
      const res = await request(app.getHttpServer())
        .post(`/automations/${automationId}/validate`)
        .set('x-tenant-id', tenantA)
        .expect(200);

      expect(res.body.isValid).toBe(false);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('POST /automations/:id/publish: deve barrar publicação de fluxo com erros (HTTP 400)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/automations/${automationId}/publish`)
        .set('x-tenant-id', tenantA)
        .expect(400);

      expect(res.body.message).toContain('erros estruturais');
      expect(res.body.errors).toBeDefined();
    });

    it('PUT /automations/:id: deve corrigir rascunho com fluxo válido', async () => {
      await request(app.getHttpServer())
        .put(`/automations/${automationId}`)
        .set('x-tenant-id', tenantA)
        .send({
          currentDraft: validFlow,
        })
        .expect(200);
    });

    it('POST /automations/:id/publish: deve publicar com sucesso gerando a Versão 1', async () => {
      const res = await request(app.getHttpServer())
        .post(`/automations/${automationId}/publish`)
        .set('x-tenant-id', tenantA)
        .send({
          releaseNotes: 'Primeiro lançamento oficial do fluxo',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.version).toBeDefined();
      expect(res.body.version.versionNumber).toBe(1);
      expect(res.body.version.isPublished).toBe(true);
      expect(res.body.automation.status).toBe('PUBLISHED');
      expect(res.body.automation.activeVersionId).toBe(res.body.version.id);

      version1Id = res.body.version.id;
    });

    it('POST /automations/:id/pause: deve pausar a automação', async () => {
      const res = await request(app.getHttpServer())
        .post(`/automations/${automationId}/pause`)
        .set('x-tenant-id', tenantA)
        .expect(200);

      expect(res.body.status).toBe('PAUSED');
    });

    it('POST /automations/:id/publish: deve publicar Versão 2 incrementando versionNumber', async () => {
      // Modifica rascunho
      const modifiedFlow = JSON.parse(JSON.stringify(validFlow));
      modifiedFlow.nodes[1].config.text = 'Olá! Esta é a versão 2 com novas opções.';

      await request(app.getHttpServer())
        .put(`/automations/${automationId}`)
        .set('x-tenant-id', tenantA)
        .send({ currentDraft: modifiedFlow })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/automations/${automationId}/publish`)
        .set('x-tenant-id', tenantA)
        .send({ releaseNotes: 'Lançamento v2 com texto atualizado' })
        .expect(201);

      expect(res.body.version.versionNumber).toBe(2);
      expect(res.body.automation.activeVersionId).toBe(res.body.version.id);

      version2Id = res.body.version.id;
    });

    it('GET /automations/:id/versions: deve listar o histórico completo com v2 e v1', async () => {
      const res = await request(app.getHttpServer())
        .get(`/automations/${automationId}/versions`)
        .set('x-tenant-id', tenantA)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].versionNumber).toBe(2);
      expect(res.body[1].versionNumber).toBe(1);
    });

    it('POST /automations/:id/restore/:versionId: deve restaurar o rascunho para a Versão 1', async () => {
      const res = await request(app.getHttpServer())
        .post(`/automations/${automationId}/restore/${version1Id}`)
        .set('x-tenant-id', tenantA)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.restoredFromVersionNumber).toBe(1);

      // Confere se o rascunho atual da automação voltou a ter o texto da v1
      const autoRes = await request(app.getHttpServer())
        .get(`/automations/${automationId}`)
        .set('x-tenant-id', tenantA)
        .expect(200);

      expect(autoRes.body.currentDraft.nodes[1].config.text).toBe('Olá! Como posso ajudar você hoje?');
    });

    it('POST /automations/:id/duplicate: deve duplicar a automação e manter integridade', async () => {
      const res = await request(app.getHttpServer())
        .post(`/automations/${automationId}/duplicate`)
        .set('x-tenant-id', tenantA)
        .send({
          newName: 'Atendimento e Vendas - Black Friday',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.id).not.toBe(automationId);
      expect(res.body.name).toBe('Atendimento e Vendas - Black Friday');
      expect(res.body.status).toBe('DRAFT');
    });

    it('POST /automations/:id/publish: deve auto-provisionar e publicar fluxo iniciado diretamente por ID não cadastrado quando enviada a definição', async () => {
      const newAutoId = '00000000-0000-4000-b000-000000000099';
      const flowDef = JSON.parse(JSON.stringify(validFlow));
      flowDef.flowId = newAutoId;

      const res = await request(app.getHttpServer())
        .post(`/automations/${newAutoId}/publish`)
        .set('x-tenant-id', tenantA)
        .send({
          releaseNotes: 'Publicação direta de novo fluxo demonstrativo',
          definition: flowDef,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.version.versionNumber).toBe(1);

      // Confirma que a automação agora existe no banco
      const getRes = await request(app.getHttpServer())
        .get(`/automations/${newAutoId}`)
        .set('x-tenant-id', tenantA)
        .expect(200);

      expect(getRes.body.id).toBe(newAutoId);
      expect(getRes.body.status).toBe('PUBLISHED');
    });

    it('Regra de Negócio: deve impedir edição de automação enquanto ativa (PUBLISHED)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/automations/${automationId}`)
        .set('x-tenant-id', tenantA)
        .send({ name: 'Tentativa de alteração de fluxo ativo' })
        .expect(400);

      expect(res.body.message).toContain('pausá-la ou inativá-la previamente');
    });

    it('Regra de Negócio: deve impedir exclusão de automação enquanto ativa (PUBLISHED)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/automations/${automationId}`)
        .set('x-tenant-id', tenantA)
        .expect(400);

      expect(res.body.message).toContain('pausá-la ou inativá-la previamente');
    });

    it('POST /automations/:id/activate: deve permitir alternar entre pausado e ativo', async () => {
      // 1. Pausa o fluxo
      const pauseRes = await request(app.getHttpServer())
        .post(`/automations/${automationId}/pause`)
        .set('x-tenant-id', tenantA)
        .expect(200);
      expect(pauseRes.body.status).toBe('PAUSED');

      // 2. Reativa o fluxo
      const activateRes = await request(app.getHttpServer())
        .post(`/automations/${automationId}/activate`)
        .set('x-tenant-id', tenantA)
        .expect(200);
      expect(activateRes.body.status).toBe('PUBLISHED');

      // 3. Pausa novamente para permitir edição e exclusão
      await request(app.getHttpServer())
        .post(`/automations/${automationId}/pause`)
        .set('x-tenant-id', tenantA)
        .expect(200);
    });

    it('DELETE /automations/:id: deve excluir a automação quando pausada/inativa', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/automations/${automationId}`)
        .set('x-tenant-id', tenantA)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verificação de que não existe mais
      await request(app.getHttpServer())
        .get(`/automations/${automationId}`)
        .set('x-tenant-id', tenantA)
        .expect(404);
    });
  });
});
