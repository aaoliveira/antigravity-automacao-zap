import { FlowValidatorService } from './flow-validator.service';
import { ValidationCodes } from './flow-validator.types';
import { WorkflowDefinition } from '../schema/flow-node.types';

describe('FlowValidatorService', () => {
  let validator: FlowValidatorService;

  beforeEach(() => {
    validator = new FlowValidatorService();
  });

  const getValidFlow = (): WorkflowDefinition => ({
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
          text: 'Olá! Seja bem-vindo.',
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
  });

  it('deve validar com sucesso um fluxo bem estruturado', () => {
    const flow = getValidFlow();
    const result = validator.validate(flow);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('deve reprovar fluxo vazio sem nós (FLOW_EMPTY)', () => {
    const flow: WorkflowDefinition = {
      schemaVersion: '1.0.0',
      nodes: [],
      edges: [],
    };
    const result = validator.validate(flow);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ValidationCodes.FLOW_EMPTY)).toBe(true);
  });

  it('deve reprovar fluxo sem nó de gatilho (MISSING_TRIGGER)', () => {
    const flow = getValidFlow();
    flow.nodes = flow.nodes.filter((n) => n.type !== 'trigger');

    const result = validator.validate(flow);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ValidationCodes.MISSING_TRIGGER)).toBe(true);
  });

  it('deve reprovar nó sem identificador (NODE_MISSING_ID)', () => {
    const flow = getValidFlow();
    flow.nodes[0].id = '';

    const result = validator.validate(flow);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ValidationCodes.NODE_MISSING_ID)).toBe(true);
  });

  it('deve reprovar identificador de nó duplicado (DUPLICATE_NODE_ID)', () => {
    const flow = getValidFlow();
    flow.nodes.push({
      id: 'node_msg', // Duplicado
      type: 'message_text',
      config: { text: 'Outra mensagem' },
    });

    const result = validator.validate(flow);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ValidationCodes.DUPLICATE_NODE_ID)).toBe(true);
  });

  it('deve reprovar aresta referenciando nó inexistente (EDGE_INVALID_SOURCE / TARGET)', () => {
    const flow = getValidFlow();
    flow.edges.push({
      id: 'edge_invalid',
      source: 'node_inexistente_1',
      target: 'node_inexistente_2',
    });

    const result = validator.validate(flow);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ValidationCodes.EDGE_INVALID_SOURCE)).toBe(true);
    expect(result.errors.some((e) => e.code === ValidationCodes.EDGE_INVALID_TARGET)).toBe(true);
  });

  it('deve reprovar conexão entrando em nó de gatilho (TRIGGER_HAS_INCOMING)', () => {
    const flow = getValidFlow();
    flow.edges.push({
      id: 'edge_reverse',
      source: 'node_msg',
      target: 'node_trigger',
    });

    const result = validator.validate(flow);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ValidationCodes.TRIGGER_HAS_INCOMING)).toBe(true);
  });

  it('deve reprovar conexão saindo de nó de encerramento (END_NODE_HAS_OUTGOING)', () => {
    const flow = getValidFlow();
    flow.edges.push({
      id: 'edge_from_end',
      source: 'node_end',
      target: 'node_msg',
    });

    const result = validator.validate(flow);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ValidationCodes.END_NODE_HAS_OUTGOING)).toBe(true);
  });

  it('deve reprovar auto-conexão direta (SELF_CONNECTION)', () => {
    const flow = getValidFlow();
    flow.edges.push({
      id: 'edge_self',
      source: 'node_msg',
      target: 'node_msg',
    });

    const result = validator.validate(flow);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ValidationCodes.SELF_CONNECTION)).toBe(true);
  });

  it('deve validar nó de condição e exigir saídas true e false (MISSING_MANDATORY_OUTPUT_EDGE)', () => {
    const flow: WorkflowDefinition = {
      schemaVersion: '1.0.0',
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          config: { triggerType: 'any_message' },
        },
        {
          id: 'cond_1',
          type: 'condition',
          config: {
            logicalOperator: 'AND',
            rules: [{ variable: 'contact.name', operator: 'is_not_empty' }],
          },
        },
        {
          id: 'end_true',
          type: 'end_flow',
          config: {},
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'cond_1' },
        // Apenas conexão 'true', faltando 'false'
        { id: 'e2', source: 'cond_1', sourceHandle: 'true', target: 'end_true' },
      ],
    };

    const result = validator.validate(flow);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ValidationCodes.MISSING_MANDATORY_OUTPUT_EDGE && e.message.includes('false'))).toBe(true);
  });

  it('deve reprovar condição com regra incompleta (INCOMPLETE_CONDITION)', () => {
    const flow: WorkflowDefinition = {
      schemaVersion: '1.0.0',
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          config: { triggerType: 'any_message' },
        },
        {
          id: 'cond_1',
          type: 'condition',
          config: {
            logicalOperator: 'AND',
            rules: [{ variable: '', operator: 'equals', value: '' }],
          },
        },
      ],
      edges: [],
    };

    const result = validator.validate(flow);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ValidationCodes.INCOMPLETE_CONDITION)).toBe(true);
  });

  it('deve reprovar nó de botões com mais de 3 botões (INVALID_BUTTON)', () => {
    const flow: WorkflowDefinition = {
      schemaVersion: '1.0.0',
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          config: { triggerType: 'any_message' },
        },
        {
          id: 'btn_node',
          type: 'buttons',
          config: {
            body: 'Escolha uma opção',
            buttons: [
              { id: 'b1', label: 'Opção 1' },
              { id: 'b2', label: 'Opção 2' },
              { id: 'b3', label: 'Opção 3' },
              { id: 'b4', label: 'Opção 4' }, // 4 botões excede o limite do WhatsApp
            ],
          },
        },
      ],
      edges: [],
    };

    const result = validator.validate(flow);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ValidationCodes.INVALID_BUTTON)).toBe(true);
  });

  it('deve detectar ciclo não permitido sem nó bloqueante (UNPERMITTED_CYCLE)', () => {
    const flow: WorkflowDefinition = {
      schemaVersion: '1.0.0',
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          config: { triggerType: 'any_message' },
        },
        {
          id: 'msg_a',
          type: 'message_text',
          config: { text: 'A' },
        },
        {
          id: 'msg_b',
          type: 'message_text',
          config: { text: 'B' },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'msg_a' },
        { id: 'e2', source: 'msg_a', target: 'msg_b' },
        { id: 'e3', source: 'msg_b', target: 'msg_a' }, // Ciclo fechado sem delay ou pergunta!
      ],
    };

    const result = validator.validate(flow);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ValidationCodes.UNPERMITTED_CYCLE)).toBe(true);
  });

  it('deve aceitar ciclo que passe por nó bloqueante (ex: question_input ou delay)', () => {
    const flow: WorkflowDefinition = {
      schemaVersion: '1.0.0',
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger',
          config: { triggerType: 'any_message' },
        },
        {
          id: 'msg_a',
          type: 'message_text',
          config: { text: 'Menu Principal' },
        },
        {
          id: 'ask_user',
          type: 'question_input', // Nó bloqueante de input
          config: {
            questionText: 'Digite 1 para voltar ao menu ou 2 para sair:',
            targetVariable: 'opcao',
            expectedType: 'text',
          },
        },
        {
          id: 'cond_node',
          type: 'condition',
          config: {
            logicalOperator: 'AND',
            rules: [{ variable: 'opcao', operator: 'equals', value: '1' }],
          },
        },
        {
          id: 'end_node',
          type: 'end_flow',
          config: { farewellMessage: 'Fim' },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'msg_a' },
        { id: 'e2', source: 'msg_a', target: 'ask_user' },
        { id: 'e3', source: 'ask_user', target: 'cond_node' },
        { id: 'e4', source: 'cond_node', sourceHandle: 'true', target: 'msg_a' }, // Loop permitido porque passa por ask_user
        { id: 'e5', source: 'cond_node', sourceHandle: 'false', target: 'end_node' },
      ],
    };

    const result = validator.validate(flow);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
