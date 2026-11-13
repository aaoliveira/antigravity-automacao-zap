import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppProviderType } from '@prisma/client';
import { ProviderCapabilities, IncompatibleCapabilityException } from './whatsapp-capabilities.types';

@Injectable()
export class WhatsAppCapabilitiesService {
  private readonly logger = new Logger(WhatsAppCapabilitiesService.name);

  private readonly capabilitiesMap: Record<WhatsAppProviderType, ProviderCapabilities> = {
    [WhatsAppProviderType.BAILEYS]: {
      providerType: WhatsAppProviderType.BAILEYS,
      text: true,
      image: true,
      video: true,
      audio: true,
      document: true,
      sticker: true,
      location: true,
      contact: true,
      buttons: false, // Instável no protocolo reverso em dispositivos modernos
      list: false,    // Instável no protocolo reverso em dispositivos modernos
      template: false,
      poll: true,
      requires24hWindow: false,
      requiresApprovedTemplates: false,
      supportsPresenceSimulation: true,
      maxButtonsCount: 3,
      maxListSectionsCount: 10,
      maxListRowsCount: 10,
    },
    [WhatsAppProviderType.CLOUD_API]: {
      providerType: WhatsAppProviderType.CLOUD_API,
      text: true,
      image: true,
      video: true,
      audio: true,
      document: true,
      sticker: true,
      location: true,
      contact: true,
      buttons: true, // Botões de resposta rápida 100% nativos e estáveis
      list: true,    // Listas nativas com seções e linhas
      template: true,
      poll: false,
      requires24hWindow: true, // Janela estrita de 24h da Meta
      requiresApprovedTemplates: true,
      supportsPresenceSimulation: false,
      maxButtonsCount: 3,
      maxListSectionsCount: 10,
      maxListRowsCount: 10,
    },
  };

  /**
   * Retorna as capacidades declaradas para o tipo de conexão WhatsApp
   */
  getCapabilities(providerType: WhatsAppProviderType): ProviderCapabilities {
    const caps = this.capabilitiesMap[providerType];
    if (!caps) {
      throw new Error(`Tipo de provedor desconhecido: ${providerType}`);
    }
    return caps;
  }

  /**
   * Valida se a mensagem/nó pode ser executada na conexão selecionada
   */
  assertCompatibility(
    providerType: WhatsAppProviderType,
    messageType: string,
    allowFallback = true,
  ): void {
    const caps = this.getCapabilities(providerType);

    switch (messageType) {
      case 'text':
      case 'message.text':
        if (!caps.text) throw new IncompatibleCapabilityException('text', providerType, 'Envio de texto não suportado');
        break;

      case 'image':
      case 'message.image':
        if (!caps.image) throw new IncompatibleCapabilityException('image', providerType, 'Envio de imagens não suportado');
        break;

      case 'video':
      case 'message.video':
        if (!caps.video) throw new IncompatibleCapabilityException('video', providerType, 'Envio de vídeos não suportado');
        break;

      case 'audio':
      case 'message.audio':
        if (!caps.audio) throw new IncompatibleCapabilityException('audio', providerType, 'Envio de áudios não suportado');
        break;

      case 'document':
      case 'message.document':
        if (!caps.document) throw new IncompatibleCapabilityException('document', providerType, 'Envio de documentos não suportado');
        break;

      case 'sticker':
      case 'message.sticker':
        if (!caps.sticker) throw new IncompatibleCapabilityException('sticker', providerType, 'Envio de figurinhas não suportado');
        break;

      case 'location':
      case 'message.location':
        if (!caps.location) throw new IncompatibleCapabilityException('location', providerType, 'Envio de localização não suportado');
        break;

      case 'contact':
      case 'message.contact':
        if (!caps.contact) throw new IncompatibleCapabilityException('contact', providerType, 'Envio de contatos não suportado');
        break;

      case 'buttons':
      case 'message.buttons':
        if (!caps.buttons && !allowFallback) {
          throw new IncompatibleCapabilityException(
            'buttons',
            providerType,
            'Botões nativos não são suportados nesta conexão e o fallback textual está desabilitado.',
          );
        }
        break;

      case 'list':
      case 'message.list':
        if (!caps.list && !allowFallback) {
          throw new IncompatibleCapabilityException(
            'list',
            providerType,
            'Listas interativas não são suportadas nesta conexão e o fallback textual está desabilitado.',
          );
        }
        break;

      case 'template':
      case 'message.template':
        if (!caps.template) {
          throw new IncompatibleCapabilityException(
            'template',
            providerType,
            'Modelos aprovados de template são suportados apenas em conexões oficiais Meta Cloud API.',
          );
        }
        break;

      case 'poll':
        if (!caps.poll) {
          throw new IncompatibleCapabilityException('poll', providerType, 'Enquetes não suportadas no provedor selecionado.');
        }
        break;
    }
  }

  /**
   * Converte botões em menu de texto formatado e numerado (Fallback padrão para Baileys)
   */
  formatFallbackTextMenu(
    title: string | undefined,
    description: string,
    buttons: Array<{ id: string; displayText: string; label?: string }>,
  ): string {
    const lines: string[] = [];

    if (title) {
      lines.push(`*${title}*`);
      lines.push('');
    }

    if (description) {
      lines.push(description);
      lines.push('');
    }

    buttons.forEach((btn, index) => {
      const numEmoji = this.getNumberEmoji(index + 1);
      const text = btn.displayText || btn.label || btn.id;
      lines.push(`${numEmoji} ${text}`);
    });

    lines.push('');
    lines.push('👉 *Responda com o número ou nome da opção desejada.*');

    return lines.join('\n');
  }

  /**
   * Converte lista interativa em menu de texto formatado com seções e itens
   */
  formatFallbackListMenu(
    title: string,
    description: string,
    sections: Array<{
      title: string;
      rows: Array<{ rowId: string; title: string; description?: string }>;
    }>,
  ): string {
    const lines: string[] = [];

    if (title) {
      lines.push(`*${title}*`);
      lines.push('');
    }

    if (description) {
      lines.push(description);
      lines.push('');
    }

    let globalIndex = 1;
    sections.forEach((sec) => {
      lines.push(`📋 *${sec.title}*`);
      sec.rows.forEach((row) => {
        const numEmoji = this.getNumberEmoji(globalIndex++);
        lines.push(`${numEmoji} *${row.title}*`);
        if (row.description) {
          lines.push(`   _${row.description}_`);
        }
      });
      lines.push('');
    });

    lines.push('👉 *Responda com o número ou texto da opção desejada.*');

    return lines.join('\n');
  }

  private getNumberEmoji(num: number): string {
    const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[num] || `[${num}]`;
  }
}
