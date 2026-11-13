import { WhatsAppCapabilitiesService } from './whatsapp-capabilities.service';
import { WhatsAppProviderType } from '@prisma/client';
import { IncompatibleCapabilityException } from './whatsapp-capabilities.types';

describe('WhatsAppCapabilitiesService', () => {
  let service: WhatsAppCapabilitiesService;

  beforeEach(() => {
    service = new WhatsAppCapabilitiesService();
  });

  it('deve retornar capacidades corretas para conexão BAILEYS', () => {
    const caps = service.getCapabilities(WhatsAppProviderType.BAILEYS);
    expect(caps.providerType).toBe(WhatsAppProviderType.BAILEYS);
    expect(caps.text).toBe(true);
    expect(caps.buttons).toBe(false);
    expect(caps.poll).toBe(true);
    expect(caps.requires24hWindow).toBe(false);
  });

  it('deve retornar capacidades corretas para conexão CLOUD_API', () => {
    const caps = service.getCapabilities(WhatsAppProviderType.CLOUD_API);
    expect(caps.providerType).toBe(WhatsAppProviderType.CLOUD_API);
    expect(caps.text).toBe(true);
    expect(caps.buttons).toBe(true);
    expect(caps.poll).toBe(false);
    expect(caps.requires24hWindow).toBe(true);
  });

  it('deve lançar exceção ao tentar enviar template no Baileys', () => {
    expect(() => {
      service.assertCompatibility(WhatsAppProviderType.BAILEYS, 'template');
    }).toThrow(IncompatibleCapabilityException);
  });

  it('deve formatar menu textual de fallback para botões no Baileys', () => {
    const fallback = service.formatFallbackTextMenu('Menu de Opções', 'Escolha abaixo:', [
      { id: 'btn_1', displayText: 'Comprar' },
      { id: 'btn_2', displayText: 'Suporte' },
    ]);

    expect(fallback).toContain('*Menu de Opções*');
    expect(fallback).toContain('1️⃣ Comprar');
    expect(fallback).toContain('2️⃣ Suporte');
    expect(fallback).toContain('👉 *Responda com o número ou nome da opção desejada.*');
  });

  it('deve lançar exceção se fallback estiver desabilitado para botões no Baileys', () => {
    expect(() => {
      service.assertCompatibility(WhatsAppProviderType.BAILEYS, 'buttons', false);
    }).toThrow(IncompatibleCapabilityException);
  });
});
