import { FlowApi, apiClient } from './api';
import axios from 'axios';

jest.mock('axios', () => {
  const mAxiosInstance = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
  return {
    create: jest.fn(() => mAxiosInstance),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
});

describe('FlowApi Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve consultar automação chamando GET /automations/:id', async () => {
    const mockData = { id: 'flow-123', name: 'Atendimento' };
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockData });

    const result = await FlowApi.getAutomation('flow-123');
    expect(result).toEqual(mockData);
    expect(apiClient.get).toHaveBeenCalledWith('/automations/flow-123');
  });

  it('deve atualizar rascunho chamando PUT /automations/:id', async () => {
    const definition: any = { schemaVersion: '1.0', nodes: [], edges: [] };
    (apiClient.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

    await FlowApi.updateDraft('flow-123', definition, 'Novo Nome');
    expect(apiClient.put).toHaveBeenCalledWith('/automations/flow-123', {
      currentDraft: definition,
      name: 'Novo Nome',
    });
  });

  it('deve validar fluxo chamando POST /automations/:id/validate', async () => {
    const mockValidation = { isValid: true, errors: [], warnings: [] };
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: mockValidation });

    const result = await FlowApi.validateFlow('flow-123');
    expect(result.isValid).toBe(true);
    expect(apiClient.post).toHaveBeenCalledWith('/automations/flow-123/validate', {
      definition: undefined,
    });
  });

  it('deve publicar versão chamando POST /automations/:id/publish', async () => {
    const mockPublished = { message: 'Publicado', version: { versionNumber: 2 } };
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: mockPublished });

    const result = await FlowApi.publishFlow('flow-123', 'Notas da versão');
    expect(result.version.versionNumber).toBe(2);
    expect(apiClient.post).toHaveBeenCalledWith('/automations/flow-123/publish', {
      releaseNotes: 'Notas da versão',
      definition: undefined,
    });
  });
});
