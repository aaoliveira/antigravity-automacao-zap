import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppProviderType } from '@prisma/client';
import {
  WhatsAppProvider,
  SendResult,
  SendTextParams,
  SendImageParams,
  SendVideoParams,
  SendAudioParams,
  SendDocumentParams,
  SendStickerParams,
  SendLocationParams,
  SendContactParams,
  SendButtonsParams,
  SendListParams,
  SendTemplateParams,
  SendPollParams,
  SendPresenceParams,
  MarkAsReadParams,
} from './whatsapp-provider.interface';
import { ProviderCapabilities } from '../capabilities/whatsapp-capabilities.types';
import { WhatsAppCapabilitiesService } from '../capabilities/whatsapp-capabilities.service';

@Injectable()
export class MockWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(MockWhatsAppProvider.name);
  public sentMessages: Array<{ type: string; params: any; timestamp: Date; messageId: string }> = [];
  public presenceLog: Array<{ instanceName: string; presence: string; timestamp: Date }> = [];
  public readLog: Array<{ messageId: string; recipient: string; timestamp: Date }> = [];
  private failureNext?: string;
  private readonly capabilitiesService: WhatsAppCapabilitiesService;

  constructor(capabilitiesService?: WhatsAppCapabilitiesService) {
    this.capabilitiesService = capabilitiesService || new WhatsAppCapabilitiesService();
  }

  simulateFailureNext(reason = 'Simulated Provider Error 500'): void {
    this.failureNext = reason;
  }

  clear(): void {
    this.sentMessages = [];
    this.presenceLog = [];
    this.readLog = [];
    this.failureNext = undefined;
  }

  private checkFailure(): void {
    if (this.failureNext) {
      const err = this.failureNext;
      this.failureNext = undefined;
      throw new Error(err);
    }
  }

  private record(type: string, params: any): SendResult {
    this.checkFailure();
    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.sentMessages.push({
      type,
      params,
      timestamp: new Date(),
      messageId,
    });

    this.logger.debug(`[MockWhatsAppProvider] Enviado ${type} para ${params.recipient}: ${messageId}`);
    return {
      success: true,
      messageId,
      providerResponse: {
        key: { id: messageId, remoteJid: `${params.recipient}@s.whatsapp.net`, fromMe: true },
        messageTimestamp: Math.floor(Date.now() / 1000),
        status: 'PENDING',
      },
    };
  }

  async sendText(params: SendTextParams): Promise<SendResult> {
    return this.record('text', params);
  }

  async sendImage(params: SendImageParams): Promise<SendResult> {
    return this.record('image', params);
  }

  async sendVideo(params: SendVideoParams): Promise<SendResult> {
    return this.record('video', params);
  }

  async sendAudio(params: SendAudioParams): Promise<SendResult> {
    return this.record('audio', params);
  }

  async sendDocument(params: SendDocumentParams): Promise<SendResult> {
    return this.record('document', params);
  }

  async sendSticker(params: SendStickerParams): Promise<SendResult> {
    return this.record('sticker', params);
  }

  async sendLocation(params: SendLocationParams): Promise<SendResult> {
    return this.record('location', params);
  }

  async sendContact(params: SendContactParams): Promise<SendResult> {
    return this.record('contact', params);
  }

  async sendButtons(params: SendButtonsParams): Promise<SendResult> {
    return this.record('buttons', params);
  }

  async sendList(params: SendListParams): Promise<SendResult> {
    return this.record('list', params);
  }

  async sendTemplate(params: SendTemplateParams): Promise<SendResult> {
    return this.record('template', params);
  }

  async sendPoll(params: SendPollParams): Promise<SendResult> {
    return this.record('poll', params);
  }

  async sendPresence(params: SendPresenceParams): Promise<void> {
    this.presenceLog.push({
      instanceName: params.instanceName,
      presence: params.presence,
      timestamp: new Date(),
    });
  }

  async markAsRead(params: MarkAsReadParams): Promise<void> {
    this.readLog.push({
      messageId: params.messageId,
      recipient: params.recipient,
      timestamp: new Date(),
    });
  }

  async getCapabilities(providerType: WhatsAppProviderType = WhatsAppProviderType.BAILEYS): Promise<ProviderCapabilities> {
    return this.capabilitiesService.getCapabilities(providerType);
  }
}
