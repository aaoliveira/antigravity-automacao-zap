import { ConditionEvaluatorService } from './condition-evaluator.service';
import { VariableResolverService } from '../variables/variable-resolver.service';
import { VariableContext } from '../types/execution.types';
import { ExecutionStatus } from '@prisma/client';

describe('ConditionEvaluatorService', () => {
  let evaluator: ConditionEvaluatorService;
  let resolver: VariableResolverService;

  const mockContext: VariableContext = {
    contact: {
      phone: '5511999999999',
      name: 'Carlos Silva',
      tags: ['vip', 'cliente_antigo'],
      customFields: { saldo: 150, score: 75.5, ativo: true },
    },
    conversation: {
      id: 'conv_1',
      lastMessage: 'Quero comprar',
      lastInteractionAt: new Date(),
    },
    execution: {
      id: 'exec_1',
      status: ExecutionStatus.RUNNING,
      startedAt: new Date(),
      variables: {
        opcao: '2',
        tentativas: 3,
        cidade: 'São Paulo',
        email: 'carlos@exemplo.com',
        vazio: '',
        nulo: null,
      },
    },
    company: { id: 'comp_1', name: 'Empresa Teste' },
    flow: { id: 'flow_1', name: 'Fluxo Teste', version: 1, versionId: 'v1' },
  };

  beforeEach(() => {
    resolver = new VariableResolverService();
    evaluator = new ConditionEvaluatorService(resolver);
  });

  describe('Operadores Relacionais', () => {
    it('EQUALS / NOT_EQUALS para strings e números', () => {
      // String exata
      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'cidade', operator: 'EQUALS', value: 'São Paulo' }] },
          mockContext,
        ),
      ).toBe(true);

      // Case-insensitive
      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'cidade', operator: 'EQUALS', value: 'são paulo' }] },
          mockContext,
        ),
      ).toBe(true);

      // Número
      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'tentativas', operator: 'EQUALS', value: 3 }] },
          mockContext,
        ),
      ).toBe(true);

      // NOT_EQUALS
      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'cidade', operator: 'NOT_EQUALS', value: 'Rio de Janeiro' }] },
          mockContext,
        ),
      ).toBe(true);
    });

    it('CONTAINS e NOT_CONTAINS', () => {
      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'email', operator: 'CONTAINS', value: 'exemplo.com' }] },
          mockContext,
        ),
      ).toBe(true);

      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'email', operator: 'NOT_CONTAINS', value: 'gmail' }] },
          mockContext,
        ),
      ).toBe(true);
    });

    it('STARTS_WITH e ENDS_WITH', () => {
      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'contact.name', operator: 'STARTS_WITH', value: 'Carlos' }] },
          mockContext,
        ),
      ).toBe(true);

      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'email', operator: 'ENDS_WITH', value: '.com' }] },
          mockContext,
        ),
      ).toBe(true);
    });

    it('GREATER_THAN, LESS_THAN, GREATER_OR_EQUAL, LESS_OR_EQUAL', () => {
      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'contact.customFields.saldo', operator: 'GREATER_THAN', value: 100 }] },
          mockContext,
        ),
      ).toBe(true);

      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'contact.customFields.saldo', operator: 'LESS_THAN', value: 200 }] },
          mockContext,
        ),
      ).toBe(true);

      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'contact.customFields.saldo', operator: 'GREATER_OR_EQUAL', value: 150 }] },
          mockContext,
        ),
      ).toBe(true);

      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'contact.customFields.saldo', operator: 'LESS_OR_EQUAL', value: 150 }] },
          mockContext,
        ),
      ).toBe(true);
    });

    it('IS_EMPTY e IS_NOT_EMPTY', () => {
      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'vazio', operator: 'IS_EMPTY' }] },
          mockContext,
        ),
      ).toBe(true);

      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'nulo', operator: 'IS_EMPTY' }] },
          mockContext,
        ),
      ).toBe(true);

      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'inexistente', operator: 'IS_EMPTY' }] },
          mockContext,
        ),
      ).toBe(true);

      expect(
        evaluator.evaluate(
          { logicalOperator: 'AND', rules: [{ variable: 'contact.name', operator: 'IS_NOT_EMPTY' }] },
          mockContext,
        ),
      ).toBe(true);
    });
  });

  describe('Condições Compostas com AND e OR', () => {
    it('deve avaliar condição composta com AND (todas precisam ser verdadeiras)', () => {
      // Ambas verdadeiras
      expect(
        evaluator.evaluate(
          {
            logicalOperator: 'AND',
            rules: [
              { variable: 'cidade', operator: 'EQUALS', value: 'São Paulo' },
              { variable: 'contact.customFields.saldo', operator: 'GREATER_THAN', value: 100 },
            ],
          },
          mockContext,
        ),
      ).toBe(true);

      // Uma falsa
      expect(
        evaluator.evaluate(
          {
            logicalOperator: 'AND',
            rules: [
              { variable: 'cidade', operator: 'EQUALS', value: 'São Paulo' },
              { variable: 'contact.customFields.saldo', operator: 'GREATER_THAN', value: 500 }, // Falso!
            ],
          },
          mockContext,
        ),
      ).toBe(false);
    });

    it('deve avaliar condição composta com OR (basta uma ser verdadeira)', () => {
      // Primeira falsa, segunda verdadeira
      expect(
        evaluator.evaluate(
          {
            logicalOperator: 'OR',
            rules: [
              { variable: 'cidade', operator: 'EQUALS', value: 'Belo Horizonte' }, // Falso
              { variable: 'contact.customFields.saldo', operator: 'GREATER_THAN', value: 100 }, // Verdadeiro
            ],
          },
          mockContext,
        ),
      ).toBe(true);

      // Ambas falsas
      expect(
        evaluator.evaluate(
          {
            logicalOperator: 'OR',
            rules: [
              { variable: 'cidade', operator: 'EQUALS', value: 'Curitiba' }, // Falso
              { variable: 'contact.customFields.saldo', operator: 'GREATER_THAN', value: 1000 }, // Falso
            ],
          },
          mockContext,
        ),
      ).toBe(false);
    });
  });
});
