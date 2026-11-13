import { VariableResolverService } from './variable-resolver.service';
import { VariableContext } from '../types/execution.types';
import { ExecutionStatus } from '@prisma/client';

describe('VariableResolverService', () => {
  let resolver: VariableResolverService;

  const mockContext: VariableContext = {
    contact: {
      phone: '5511999999999',
      name: 'Maria Souza',
      tags: ['lead_quente'],
      customFields: { segmento: 'Varejo' },
    },
    conversation: {
      id: 'conv_123',
      lastMessage: 'Quero um desconto',
      lastInteractionAt: new Date(),
    },
    execution: {
      id: 'exec_abc',
      status: ExecutionStatus.RUNNING,
      startedAt: new Date(),
      variables: {
        codigo_cupom: 'PROMO10',
        valor_desconto: 50,
      },
    },
    company: { id: 'comp_1', name: 'Super Loja' },
    flow: { id: 'flow_1', name: 'Fluxo Comercial', version: 2, versionId: 'v2' },
  };

  beforeEach(() => {
    resolver = new VariableResolverService();
  });

  it('deve interpolar variáveis de diferentes escopos na mesma string', () => {
    const template = 'Olá {{contact.name}}, seu cupom na {{company.name}} é {{codigo_cupom}}!';
    const result = resolver.interpolate(template, mockContext);

    expect(result).toBe('Olá Maria Souza, seu cupom na Super Loja é PROMO10!');
  });

  it('deve substituir variáveis inexistentes por string vazia sem lançar exceção', () => {
    const template = 'Olá {{contact.name}}, seu código de rastreio é {{codigo_inexistente}}.';
    const result = resolver.interpolate(template, mockContext);

    expect(result).toBe('Olá Maria Souza, seu código de rastreio é .');
  });

  it('deve resolver propriedades aninhadas em customFields', () => {
    const val = resolver.resolvePath('contact.customFields.segmento', mockContext);
    expect(val).toBe('Varejo');
  });
});
