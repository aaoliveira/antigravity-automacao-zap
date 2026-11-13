import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppOutboxDispatcherService } from './whatsapp-outbox-dispatcher.service';
import { PrismaService } from '../../database/prisma.service';
import { OutboxService } from '../../engine/outbox/outbox.service';
import { WhatsAppCapabilitiesService } from '../capabilities/whatsapp-capabilities.service';
import { CryptoService } from '../security/crypto.service';
import { MockWhatsAppProvider } from '../providers/mock-whatsapp.provider';
import { WhatsAppProvider, WHATSAPP_PROVIDER } from '../providers/whatsapp-provider.interface';
import { WhatsAppProviderType } from '@prisma/client';

describe('WhatsAppOutboxDispatcherService', () => {
  let dispatcher: WhatsAppOutboxDispatcherService;
  let mockProvider: MockWhatsAppProvider;
  let prisma: jest.Mocked<any>;

  beforeEach(async () => {
    mockProvider = new MockWhatsAppProvider();
    prisma = {
      whatsAppInstance: {
        findFirst: jest.fn(),
      },
      contact: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppOutboxDispatcherService,
        WhatsAppCapabilitiesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: OutboxService,
          useValue: {
            setSender: jest.fn(),
          },
        },
        {
          provide: CryptoService,
          useValue: {
            decrypt: jest.fn((k) => `decrypted_${k}`),
          },
        },
        {
          provide: WHATSAPP_PROVIDER,
          useValue: mockProvider,
        },
      ],
    }).compile();

    dispatcher = module.get<WhatsAppOutboxDispatcherService>(WhatsAppOutboxDispatcherService);
    dispatcher.onModuleInit();
  });

  afterEach(() => {
    mockProvider.clear();
  });

  it('deve despachar mensagem de texto para o WhatsAppProvider', async () => {
    prisma.whatsAppInstance.findFirst.mockResolvedValueOnce({
      instanceName: 'inst-01',
      providerType: WhatsAppProviderType.BAILEYS,
    });

    const result = await dispatcher.sendMessage('inst-01', '5511999999999', 'text', {
      text: 'Olá mundo!',
    });

    expect(result.messageId).toBeDefined();
    expect(mockProvider.sentMessages).toHaveLength(1);
    expect(mockProvider.sentMessages[0].type).toBe('text');
    expect(mockProvider.sentMessages[0].params.text).toBe('Olá mundo!');
  });

  it('deve aplicar fallback para menu textual quando enviar botões no provedor BAILEYS', async () => {
    prisma.whatsAppInstance.findFirst.mockResolvedValueOnce({
      instanceName: 'inst-baileys',
      providerType: WhatsAppProviderType.BAILEYS,
    });

    const result = await dispatcher.sendMessage('inst-baileys', '5511999999999', 'buttons', {
      title: 'Menu Inicial',
      description: 'Como podemos ajudar?',
      buttons: [
        { id: 'btn_1', displayText: 'Vendas' },
        { id: 'btn_2', displayText: 'Suporte' },
      ],
    });

    expect(result.messageId).toBeDefined();
    expect(mockProvider.sentMessages).toHaveLength(1);
    // Foi convertido para texto com as opções formatadas
    expect(mockProvider.sentMessages[0].type).toBe('text');
    expect(mockProvider.sentMessages[0].params.text).toContain('1️⃣ Vendas');
    expect(mockProvider.sentMessages[0].params.text).toContain('2️⃣ Suporte');
  });

  it('deve despachar botões nativos quando o provedor for CLOUD_API dentro da janela de 24h', async () => {
    prisma.whatsAppInstance.findFirst.mockResolvedValueOnce({
      instanceName: 'inst-cloud',
      tenantId: 'tenant-123',
      providerType: WhatsAppProviderType.CLOUD_API,
    });

    // Contato interagiu há 2 horas (dentro da janela)
    prisma.contact.findUnique.mockResolvedValueOnce({
      lastInteractionAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    const result = await dispatcher.sendMessage('inst-cloud', '5511999999999', 'buttons', {
      description: 'Escolha uma opção',
      buttons: [{ id: 'b1', displayText: 'Continuar' }],
    });

    expect(result.messageId).toBeDefined();
    expect(mockProvider.sentMessages).toHaveLength(1);
    expect(mockProvider.sentMessages[0].type).toBe('buttons');
  });

  it('deve bloquear envio que não seja template se a janela de 24h estiver expirada na CLOUD_API', async () => {
    prisma.whatsAppInstance.findFirst.mockResolvedValueOnce({
      instanceName: 'inst-cloud',
      tenantId: 'tenant-123',
      providerType: WhatsAppProviderType.CLOUD_API,
    });

    // Contato interagiu há 48 horas (fora da janela)
    prisma.contact.findUnique.mockResolvedValueOnce({
      lastInteractionAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });

    await expect(
      dispatcher.sendMessage('inst-cloud', '5511999999999', 'text', { text: 'Olá' }),
    ).rejects.toThrow('Janela de 24h expirada');
  });
});
