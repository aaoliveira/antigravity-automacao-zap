import { PrismaClient, AutomationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = '00000000-0000-4000-a000-000000000001';

  console.log('==> Iniciando Seed de Dados...');

  // 1. Tenant padrão
  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: 'Empresa Demonstração ZapFlow',
      slug: 'empresa-demonstracao',
    },
  });
  console.log(`✓ Tenant configurado: ${tenant.name} (${tenant.id})`);

  // 2. Fluxo 1: Atendimento Comercial Completo
  const commercialDraft = {
    schemaVersion: '1.0.0',
    flowId: '00000000-0000-4000-b000-000000000001',
    name: 'Atendimento Comercial e Vendas',
    nodes: [
      {
        id: 'node-trigger-1',
        type: 'custom',
        position: { x: 100, y: 150 },
        data: {
          nodeType: 'trigger.message_received',
          label: 'Mensagem Recebida',
          category: 'triggers',
          config: { matchType: 'any' },
        },
      },
      {
        id: 'node-msg-welcome',
        type: 'custom',
        position: { x: 450, y: 150 },
        data: {
          nodeType: 'message.text',
          label: 'Mensagem Boas-vindas',
          category: 'messages',
          config: {
            text: 'Olá! Seja muito bem-vindo à nossa loja virtual. Como podemos te ajudar hoje?',
          },
        },
      },
      {
        id: 'node-btn-menu',
        type: 'custom',
        position: { x: 800, y: 150 },
        data: {
          nodeType: 'interaction.buttons',
          label: 'Menu Principal',
          category: 'interactions',
          config: {
            title: 'Menu de Opções',
            buttons: [
              { id: 'btn_products', text: 'Conhecer produtos' },
              { id: 'btn_prices', text: 'Consultar preços' },
              { id: 'btn_human', text: 'Falar com atendente' },
            ],
          },
        },
      },
      {
        id: 'node-handoff',
        type: 'custom',
        position: { x: 1200, y: 300 },
        data: {
          nodeType: 'action.human_handoff',
          label: 'Transferir Atendente',
          category: 'actions',
          config: {
            queue: 'Comercial',
            reason: 'Solicitado pelo cliente via menu',
          },
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'node-trigger-1',
        target: 'node-msg-welcome',
        sourceHandle: 'default',
        targetHandle: 'input',
      },
      {
        id: 'e2',
        source: 'node-msg-welcome',
        target: 'node-btn-menu',
        sourceHandle: 'default',
        targetHandle: 'input',
      },
      {
        id: 'e3',
        source: 'node-btn-menu',
        target: 'node-handoff',
        sourceHandle: 'btn_human',
        targetHandle: 'input',
      },
    ],
  };

  const autoCommercial = await prisma.automation.upsert({
    where: { id: '00000000-0000-4000-b000-000000000001' },
    update: {
      currentDraft: commercialDraft as any,
    },
    create: {
      id: '00000000-0000-4000-b000-000000000001',
      tenantId,
      name: 'Atendimento Comercial e Vendas',
      description: 'Fluxo comercial com opções interativas, captura de dados e transição de atendimento.',
      status: AutomationStatus.DRAFT,
      currentDraft: commercialDraft as any,
    },
  });
  console.log(`✓ Automação 1 configurada: ${autoCommercial.name} (${autoCommercial.id})`);

  // 3. Fluxo 2: Novo Fluxo em Branco (Starter Canvas)
  const blankDraft = {
    schemaVersion: '1.0.0',
    flowId: '00000000-0000-4000-b000-000000000002',
    name: 'Novo Fluxo em Branco',
    nodes: [
      {
        id: 'node-trigger-blank',
        type: 'custom',
        position: { x: 250, y: 200 },
        data: {
          nodeType: 'trigger.message_received',
          label: 'Mensagem Recebida',
          category: 'triggers',
          config: { matchType: 'any' },
        },
      },
      {
        id: 'node-msg-initial',
        type: 'custom',
        position: { x: 650, y: 200 },
        data: {
          nodeType: 'message.text',
          label: 'Primeira Mensagem',
          category: 'messages',
          config: {
            text: 'Olá! Como posso ajudar você hoje?',
          },
        },
      },
    ],
    edges: [
      {
        id: 'edge-initial',
        source: 'node-trigger-blank',
        target: 'node-msg-initial',
        sourceHandle: 'default',
        targetHandle: 'input',
      },
    ],
  };

  const autoBlank = await prisma.automation.upsert({
    where: { id: '00000000-0000-4000-b000-000000000002' },
    update: {
      currentDraft: blankDraft as any,
    },
    create: {
      id: '00000000-0000-4000-b000-000000000002',
      tenantId,
      name: 'Novo Fluxo em Branco',
      description: 'Ponto de partida para novos fluxos com nó inicial já configurado.',
      status: AutomationStatus.DRAFT,
      currentDraft: blankDraft as any,
    },
  });
  console.log(`✓ Automação 2 configurada: ${autoBlank.name} (${autoBlank.id})`);

  console.log('==> Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
