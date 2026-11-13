import { EventNormalizerService } from './event-normalizer.service';

describe('EventNormalizerService', () => {
  let service: EventNormalizerService;

  beforeEach(() => {
    service = new EventNormalizerService();
  });

  it('deve normalizar mensagem de texto simples', () => {
    const raw = {
      event: 'messages.upsert',
      instance: 'inst-01',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: 'MSG_123',
        },
        pushName: 'Alexandre',
        message: {
          conversation: 'Olá, gostaria de saber preços',
        },
        messageTimestamp: 1700000000,
      },
    };

    const normalized = service.normalize(raw, 'tenant-01');

    expect(normalized.instanceName).toBe('inst-01');
    expect(normalized.tenantId).toBe('tenant-01');
    expect(normalized.contact.phone).toBe('5511999999999');
    expect(normalized.contact.name).toBe('Alexandre');
    expect(normalized.message.id).toBe('MSG_123');
    expect(normalized.message.type).toBe('text');
    expect(normalized.message.text).toBe('Olá, gostaria de saber preços');
    expect(normalized.message.fromMe).toBe(false);
  });

  it('deve normalizar clique em botão de resposta rápida', () => {
    const raw = {
      event: 'messages.upsert',
      instance: 'inst-01',
      data: {
        key: {
          remoteJid: '5511888888888@s.whatsapp.net',
          fromMe: false,
          id: 'BTN_RESP_1',
        },
        message: {
          buttonsResponseMessage: {
            selectedButtonId: 'btn_comprar',
            selectedDisplayText: 'Comprar Agora',
          },
        },
      },
    };

    const normalized = service.normalize(raw);

    expect(normalized.message.type).toBe('button_reply');
    expect(normalized.message.buttonId).toBe('btn_comprar');
    expect(normalized.message.buttonText).toBe('Comprar Agora');
    expect(normalized.message.text).toBe('Comprar Agora');
  });

  it('deve normalizar seleção de item em lista interativa', () => {
    const raw = {
      event: 'messages.upsert',
      instance: 'inst-01',
      data: {
        key: {
          remoteJid: '5511777777777@s.whatsapp.net',
          fromMe: false,
          id: 'LIST_RESP_1',
        },
        message: {
          listResponseMessage: {
            title: 'Plano Premium',
            singleSelectReply: {
              selectedRowId: 'row_premium_annual',
            },
          },
        },
      },
    };

    const normalized = service.normalize(raw);

    expect(normalized.message.type).toBe('list_reply');
    expect(normalized.message.listRowId).toBe('row_premium_annual');
    expect(normalized.message.listTitle).toBe('Plano Premium');
    expect(normalized.message.text).toBe('Plano Premium');
  });

  it('deve normalizar atualização de status de entrega (DELIVERY_ACK e READ)', () => {
    const rawDelivery = {
      event: 'messages.update',
      instance: 'inst-01',
      data: {
        key: { id: 'OUT_123', remoteJid: '5511999999999@s.whatsapp.net', fromMe: true },
        status: 'DELIVERY_ACK',
      },
    };

    const normalizedDelivery = service.normalize(rawDelivery);
    expect(normalizedDelivery.message.type).toBe('status_update');
    expect(normalizedDelivery.message.status).toBe('DELIVERED');

    const rawRead = {
      event: 'messages.update',
      instance: 'inst-01',
      data: {
        key: { id: 'OUT_123', remoteJid: '5511999999999@s.whatsapp.net', fromMe: true },
        status: 'READ',
      },
    };

    const normalizedRead = service.normalize(rawRead);
    expect(normalizedRead.message.type).toBe('status_update');
    expect(normalizedRead.message.status).toBe('READ');
  });

  it('deve normalizar mensagens de imagem e mídia', () => {
    const raw = {
      event: 'messages.upsert',
      instance: 'inst-01',
      data: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
          id: 'IMG_123',
        },
        message: {
          imageMessage: {
            url: 'https://example.com/photo.jpg',
            mimetype: 'image/jpeg',
            caption: 'Foto do comprovante',
          },
        },
      },
    };

    const normalized = service.normalize(raw);
    expect(normalized.message.type).toBe('image');
    expect(normalized.message.mediaUrl).toBe('https://example.com/photo.jpg');
    expect(normalized.message.mimeType).toBe('image/jpeg');
    expect(normalized.message.text).toBe('Foto do comprovante');
  });
});
