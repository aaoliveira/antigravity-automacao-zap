import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EvolutionApiV2Adapter } from './evolution-api-v2.adapter';
import { WhatsAppCapabilitiesService } from '../capabilities/whatsapp-capabilities.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('EvolutionApiV2Adapter', () => {
  let adapter: EvolutionApiV2Adapter;
  let mockPost: jest.Mock;

  beforeEach(async () => {
    mockPost = jest.fn();
    mockedAxios.create.mockReturnValue({
      post: mockPost,
    } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvolutionApiV2Adapter,
        WhatsAppCapabilitiesService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'EVOLUTION_SERVER_URL') return 'http://localhost:8080';
              if (key === 'EVOLUTION_API_KEY') return 'test_api_key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<EvolutionApiV2Adapter>(EvolutionApiV2Adapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve enviar mensagem de texto chamando endpoint oficial /message/sendText/{instance}', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        key: { id: 'evo_msg_123', remoteJid: '5511999999999@s.whatsapp.net', fromMe: true },
        status: 'PENDING',
      },
    });

    const result = await adapter.sendText({
      instanceName: 'test-inst',
      recipient: '5511999999999',
      text: 'Olá mundo!',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('evo_msg_123');
    expect(mockPost).toHaveBeenCalledWith(
      'http://localhost:8080/message/sendText/test-inst',
      expect.objectContaining({
        number: '5511999999999',
        text: 'Olá mundo!',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ apikey: 'test_api_key' }),
      }),
    );
  });

  it('deve enviar botões chamando endpoint oficial /message/sendButtons/{instance}', async () => {
    mockPost.mockResolvedValueOnce({
      data: { key: { id: 'evo_btn_123' } },
    });

    const result = await adapter.sendButtons({
      instanceName: 'test-inst',
      recipient: '5511999999999',
      title: 'Menu',
      description: 'Escolha uma opção',
      buttons: [
        { id: 'btn_1', displayText: 'Opção 1' },
        { id: 'btn_2', displayText: 'Opção 2' },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('evo_btn_123');
    expect(mockPost).toHaveBeenCalledWith(
      'http://localhost:8080/message/sendButtons/test-inst',
      expect.objectContaining({
        number: '5511999999999',
        description: 'Escolha uma opção',
        buttons: [
          { id: 'btn_1', displayText: 'Opção 1', type: 'reply' },
          { id: 'btn_2', displayText: 'Opção 2', type: 'reply' },
        ],
      }),
      expect.any(Object),
    );
  });

  it('deve lançar erro estruturado quando a Evolution API retornar erro HTTP', async () => {
    const errorResponse = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          error: 'Bad Request',
          response: { message: ['instance requires property number'] },
        },
      },
    };
    mockPost.mockRejectedValueOnce(errorResponse);
    (axios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(true);

    await expect(
      adapter.sendText({
        instanceName: 'test-inst',
        recipient: '',
        text: 'Teste',
      }),
    ).rejects.toThrow('Evolution API Error (400)');
  });
});
