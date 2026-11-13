import { Injectable, Logger } from '@nestjs/common';
import {
  NormalizedMessageEvent,
  NormalizedMessage,
  NormalizedContact,
  NormalizedMessageType,
} from './normalized-event.types';

@Injectable()
export class EventNormalizerService {
  private readonly logger = new Logger(EventNormalizerService.name);

  /**
   * Normaliza qualquer payload bruto recebido da Evolution API v2 em modelo padronizado
   */
  normalize(rawWebhookPayload: any, tenantId?: string): NormalizedMessageEvent {
    const eventType = rawWebhookPayload.event || 'messages.upsert';
    const instanceName =
      rawWebhookPayload.instance ||
      rawWebhookPayload.instanceName ||
      rawWebhookPayload.data?.instance ||
      'whatsapp-default';

    const data = rawWebhookPayload.data || rawWebhookPayload;
    const key = data.key || {};
    const remoteJid = key.remoteJid || data.remoteJid || data.from || '';
    const phone = this.extractPhone(remoteJid);
    const fromMe = Boolean(key.fromMe || data.fromMe);
    const messageId = key.id || data.id || data.messageId || `evt_${Date.now()}`;

    const contact: NormalizedContact = {
      phone,
      name: data.pushName || data.name || undefined,
      profilePicUrl: data.profilePicUrl || undefined,
    };

    let message: NormalizedMessage;

    if (eventType === 'messages.update') {
      message = this.parseStatusUpdate(data, messageId, fromMe);
    } else {
      message = this.parseIncomingMessage(data, messageId, fromMe);
    }

    return {
      eventId: rawWebhookPayload.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      instanceName,
      eventType,
      contact,
      message,
      receivedAt: new Date(),
    };
  }

  private parseIncomingMessage(data: any, messageId: string, fromMe: boolean): NormalizedMessage {
    const msg = data.message || {};
    const timestamp = data.messageTimestamp
      ? new Date(data.messageTimestamp * 1000)
      : new Date();

    // 1. Resposta de Botão (Quick Reply)
    if (msg.buttonsResponseMessage || msg.templateButtonReplyMessage) {
      const btn = msg.buttonsResponseMessage || msg.templateButtonReplyMessage;
      const buttonId = btn.selectedButtonId || btn.selectedId;
      const buttonText = btn.selectedDisplayText || buttonId;
      return {
        id: messageId,
        type: 'button_reply',
        buttonId,
        buttonText,
        buttonPayload: btn.payload || buttonId,
        text: buttonText,
        fromMe,
        timestamp,
        raw: data,
      };
    }

    // 2. Resposta de Lista Interativa
    if (msg.listResponseMessage) {
      const list = msg.listResponseMessage;
      const rowId = list.singleSelectReply?.selectedRowId;
      const title = list.title || rowId;
      return {
        id: messageId,
        type: 'list_reply',
        listRowId: rowId,
        listTitle: title,
        listDescription: list.description,
        text: title,
        fromMe,
        timestamp,
        raw: data,
      };
    }

    // 3. Voto em Enquete (Poll Update)
    if (msg.pollUpdateMessage) {
      const poll = msg.pollUpdateMessage;
      const selectedOptions = poll.vote?.selectedOptions || [];
      return {
        id: messageId,
        type: 'poll_vote',
        pollSelectedOptions: selectedOptions,
        text: selectedOptions.join(', '),
        fromMe,
        timestamp,
        raw: data,
      };
    }

    // 4. Mídia: Imagem
    if (msg.imageMessage) {
      const img = msg.imageMessage;
      return {
        id: messageId,
        type: 'image',
        mediaUrl: img.url,
        mimeType: img.mimetype,
        text: img.caption || '',
        fromMe,
        timestamp,
        raw: data,
      };
    }

    // 5. Mídia: Vídeo
    if (msg.videoMessage) {
      const vid = msg.videoMessage;
      return {
        id: messageId,
        type: 'video',
        mediaUrl: vid.url,
        mimeType: vid.mimetype,
        text: vid.caption || '',
        fromMe,
        timestamp,
        raw: data,
      };
    }

    // 6. Mídia: Áudio
    if (msg.audioMessage) {
      const aud = msg.audioMessage;
      return {
        id: messageId,
        type: 'audio',
        mediaUrl: aud.url,
        mimeType: aud.mimetype,
        fromMe,
        timestamp,
        raw: data,
      };
    }

    // 7. Mídia: Documento
    if (msg.documentMessage) {
      const doc = msg.documentMessage;
      return {
        id: messageId,
        type: 'document',
        mediaUrl: doc.url,
        mimeType: doc.mimetype,
        fileName: doc.fileName || doc.title,
        text: doc.caption || '',
        fromMe,
        timestamp,
        raw: data,
      };
    }

    // 8. Figurinha (Sticker)
    if (msg.stickerMessage) {
      const stk = msg.stickerMessage;
      return {
        id: messageId,
        type: 'sticker',
        mediaUrl: stk.url,
        mimeType: stk.mimetype,
        fromMe,
        timestamp,
        raw: data,
      };
    }

    // 9. Localização
    if (msg.locationMessage) {
      const loc = msg.locationMessage;
      return {
        id: messageId,
        type: 'location',
        latitude: loc.degreesLatitude,
        longitude: loc.degreesLongitude,
        locationName: loc.name,
        locationAddress: loc.address,
        text: loc.name || loc.address || `${loc.degreesLatitude}, ${loc.degreesLongitude}`,
        fromMe,
        timestamp,
        raw: data,
      };
    }

    // 10. Contato / Cartão Virtual
    if (msg.contactMessage || msg.contactsArrayMessage) {
      const contactMsg = msg.contactMessage || msg.contactsArrayMessage;
      return {
        id: messageId,
        type: 'contact',
        text: contactMsg.displayName || 'Contato compartilhado',
        fromMe,
        timestamp,
        raw: data,
      };
    }

    // 11. Texto Simples ou Estendido
    const text =
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      data.text ||
      (typeof data.body === 'string' ? data.body : '');

    return {
      id: messageId,
      type: 'text',
      text: text || '',
      fromMe,
      timestamp,
      raw: data,
    };
  }

  private parseStatusUpdate(data: any, messageId: string, fromMe: boolean): NormalizedMessage {
    const rawStatus = data.status || data.update?.status;
    let status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' = 'SENT';

    if (rawStatus === 'DELIVERY_ACK' || rawStatus === 'RECEIPT') {
      status = 'DELIVERED';
    } else if (rawStatus === 'READ' || rawStatus === 'PLAYED') {
      status = 'READ';
    } else if (rawStatus === 'ERROR' || rawStatus === 'FAILED') {
      status = 'FAILED';
    }

    return {
      id: messageId,
      type: 'status_update',
      status,
      fromMe,
      timestamp: new Date(),
      raw: data,
    };
  }

  private extractPhone(remoteJid: string): string {
    if (!remoteJid) return '';
    return remoteJid.replace(/@s\.whatsapp\.net|@g\.us/, '').replace(/\D/g, '');
  }
}
