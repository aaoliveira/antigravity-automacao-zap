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

  it('deve listar automações chamando GET /automations', async () => {
    const mockList = [{ id: '1', name: 'Fluxo 1' }];
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockList });

    const result = await FlowApi.listAutomations('PUBLISHED');
    expect(result).toEqual(mockList);
    expect(apiClient.get).toHaveBeenCalledWith('/automations', {
      params: { status: 'PUBLISHED' },
    });
  });

  it('deve criar automação chamando POST /automations', async () => {
    const mockCreated = { id: 'new-id', name: 'Nova Automação' };
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: mockCreated });

    const result = await FlowApi.createAutomation('Nova Automação', 'Desc');
    expect(result).toEqual(mockCreated);
    expect(apiClient.post).toHaveBeenCalledWith('/automations', {
      name: 'Nova Automação',
      description: 'Desc',
    });
  });

  it('deve pausar automação chamando POST /automations/:id/pause', async () => {
    const mockPaused = { id: 'flow-123', status: 'PAUSED' };
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: mockPaused });

    const result = await FlowApi.pauseAutomation('flow-123');
    expect(result.status).toBe('PAUSED');
    expect(apiClient.post).toHaveBeenCalledWith('/automations/flow-123/pause');
  });

  it('deve reativar automação chamando POST /automations/:id/activate', async () => {
    const mockActive = { id: 'flow-123', status: 'PUBLISHED' };
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: mockActive });

    const result = await FlowApi.activateAutomation('flow-123');
    expect(result.status).toBe('PUBLISHED');
    expect(apiClient.post).toHaveBeenCalledWith('/automations/flow-123/activate');
  });

  it('deve excluir automação chamando DELETE /automations/:id', async () => {
    const mockRes = { success: true, message: 'Excluída' };
    (apiClient.delete as jest.Mock).mockResolvedValueOnce({ data: mockRes });

    const result = await FlowApi.deleteAutomation('flow-123');
    expect(result.success).toBe(true);
    expect(apiClient.delete).toHaveBeenCalledWith('/automations/flow-123');
  });

  it('deve fazer upload de arquivo de mídia chamando POST /automations/media/upload', async () => {
    const mockFile = new File(['conteudo teste'], 'manual.pdf', { type: 'application/pdf' });
    const mockUploadResponse = {
      success: true,
      url: 'http://localhost:3000/uploads/tenant/manual.pdf',
      relativeUrl: '/uploads/tenant/manual.pdf',
      fileName: 'manual.pdf',
      mimetype: 'application/pdf',
      size: 14,
      mediaType: 'document',
    };
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: mockUploadResponse });

    const result = await FlowApi.uploadMedia(mockFile);
    expect(result).toEqual(mockUploadResponse);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/automations/media/upload',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  });
});
