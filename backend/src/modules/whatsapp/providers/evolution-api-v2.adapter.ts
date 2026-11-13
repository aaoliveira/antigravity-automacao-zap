import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
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
export class EvolutionApiV2Adapter implements WhatsAppProvider {
  private readonly logger = new Logger(EvolutionApiV2Adapter.name);
  private readonly defaultServerUrl: string;
  private readonly defaultApiKey: string;
  private readonly httpClient: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    private readonly capabilitiesService: WhatsAppCapabilitiesService,
  ) {
    this.defaultServerUrl =
      this.configService.get<string>('EVOLUTION_SERVER_URL') || 'http://localhost:8080';
    this.defaultApiKey =
      this.configService.get<string>('EVOLUTION_API_KEY') || 'evolution_dev_global_api_key_change_in_prod';

    this.httpClient = axios.create({
      timeout: 15000, // 15 segundos timeout
    });
  }

  private resolveUrl(customUrl?: string): string {
    return (customUrl || this.defaultServerUrl).replace(/\/+$/, '');
  }

  private resolveApiKey(customKey?: string): string {
    return customKey || this.defaultApiKey;
  }

  private cleanPhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private handleAxiosError(err: any, endpoint: string): never {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError<any>;
      const status = axiosErr.response?.status;
      const responseData = axiosErr.response?.data;
      const errorMsg =
        responseData?.response?.message ||
        responseData?.error ||
        responseData?.message ||
        axiosErr.message;

      this.logger.error(
        `Evolution API Erro HTTP ${status} em [${endpoint}]: ${JSON.stringify(errorMsg)}`,
      );
      throw new Error(`Evolution API Error (${status || 'Network'}): ${JSON.stringify(errorMsg)}`);
    }

    this.logger.error(`Erro inesperado ao chamar Evolution API em [${endpoint}]: ${err.message}`);
    throw err;
  }

  private async postToEvolution(
    endpoint: string,
    body: any,
    serverUrl?: string,
    apiKey?: string,
  ): Promise<any> {
    const baseUrl = this.resolveUrl(serverUrl);
    const key = this.resolveApiKey(apiKey);
    const fullUrl = `${baseUrl}${endpoint}`;

    try {
      const response = await this.httpClient.post(fullUrl, body, {
        headers: {
          apikey: key,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (err) {
      this.handleAxiosError(err, endpoint);
    }
  }

  async sendText(params: SendTextParams): Promise<SendResult> {
    const endpoint = `/message/sendText/${params.instanceName}`;
    const payload = {
      number: this.cleanPhone(params.recipient),
      text: params.text,
      delay: params.delay,
      linkPreview: params.linkPreview ?? true,
    };

    const data = await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
    const messageId = data?.key?.id || data?.id || `evo_${Date.now()}`;

    return {
      success: true,
      messageId,
      providerResponse: data,
    };
  }

  async sendImage(params: SendImageParams): Promise<SendResult> {
    const endpoint = `/message/sendMedia/${params.instanceName}`;
    const payload = {
      number: this.cleanPhone(params.recipient),
      mediatype: 'image',
      media: params.imageUrl,
      caption: params.caption,
      fileName: params.fileName,
    };

    const data = await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
    const messageId = data?.key?.id || data?.id || `evo_${Date.now()}`;

    return {
      success: true,
      messageId,
      providerResponse: data,
    };
  }

  async sendVideo(params: SendVideoParams): Promise<SendResult> {
    const endpoint = `/message/sendMedia/${params.instanceName}`;
    const payload = {
      number: this.cleanPhone(params.recipient),
      mediatype: 'video',
      media: params.videoUrl,
      caption: params.caption,
      fileName: params.fileName,
    };

    const data = await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
    const messageId = data?.key?.id || data?.id || `evo_${Date.now()}`;

    return {
      success: true,
      messageId,
      providerResponse: data,
    };
  }

  async sendAudio(params: SendAudioParams): Promise<SendResult> {
    const endpoint = params.isPtt
      ? `/message/sendWhatsAppAudio/${params.instanceName}`
      : `/message/sendMedia/${params.instanceName}`;

    const payload = params.isPtt
      ? {
          number: this.cleanPhone(params.recipient),
          audio: params.audioUrl,
        }
      : {
          number: this.cleanPhone(params.recipient),
          mediatype: 'audio',
          media: params.audioUrl,
        };

    const data = await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
    const messageId = data?.key?.id || data?.id || `evo_${Date.now()}`;

    return {
      success: true,
      messageId,
      providerResponse: data,
    };
  }

  async sendDocument(params: SendDocumentParams): Promise<SendResult> {
    const endpoint = `/message/sendMedia/${params.instanceName}`;
    const payload = {
      number: this.cleanPhone(params.recipient),
      mediatype: 'document',
      media: params.documentUrl,
      fileName: params.fileName,
      caption: params.caption,
    };

    const data = await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
    const messageId = data?.key?.id || data?.id || `evo_${Date.now()}`;

    return {
      success: true,
      messageId,
      providerResponse: data,
    };
  }

  async sendSticker(params: SendStickerParams): Promise<SendResult> {
    const endpoint = `/message/sendSticker/${params.instanceName}`;
    const payload = {
      number: this.cleanPhone(params.recipient),
      sticker: params.stickerUrl,
    };

    const data = await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
    const messageId = data?.key?.id || data?.id || `evo_${Date.now()}`;

    return {
      success: true,
      messageId,
      providerResponse: data,
    };
  }

  async sendLocation(params: SendLocationParams): Promise<SendResult> {
    const endpoint = `/message/sendLocation/${params.instanceName}`;
    const payload = {
      number: this.cleanPhone(params.recipient),
      name: params.name || 'Localização',
      address: params.address || '',
      latitude: params.latitude,
      longitude: params.longitude,
    };

    const data = await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
    const messageId = data?.key?.id || data?.id || `evo_${Date.now()}`;

    return {
      success: true,
      messageId,
      providerResponse: data,
    };
  }

  async sendContact(params: SendContactParams): Promise<SendResult> {
    const endpoint = `/message/sendContact/${params.instanceName}`;
    const payload = {
      number: this.cleanPhone(params.recipient),
      contact: params.contacts.map((c) => ({
        fullName: c.fullName,
        phoneNumber: this.cleanPhone(c.phoneNumber),
        wuid: c.wuid || `${this.cleanPhone(c.phoneNumber)}@s.whatsapp.net`,
      })),
    };

    const data = await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
    const messageId = data?.key?.id || data?.id || `evo_${Date.now()}`;

    return {
      success: true,
      messageId,
      providerResponse: data,
    };
  }

  async sendButtons(params: SendButtonsParams): Promise<SendResult> {
    const endpoint = `/message/sendButtons/${params.instanceName}`;
    const payload = {
      number: this.cleanPhone(params.recipient),
      title: params.title,
      description: params.description,
      footer: params.footer,
      buttons: params.buttons.map((b) => ({
        id: b.id,
        displayText: b.displayText,
        type: 'reply',
      })),
    };

    const data = await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
    const messageId = data?.key?.id || data?.id || `evo_${Date.now()}`;

    return {
      success: true,
      messageId,
      providerResponse: data,
    };
  }

  async sendList(params: SendListParams): Promise<SendResult> {
    const endpoint = `/message/sendList/${params.instanceName}`;
    const payload = {
      number: this.cleanPhone(params.recipient),
      title: params.title,
      description: params.description,
      buttonText: params.buttonText,
      footerText: params.footerText || '',
      sections: params.sections.map((s) => ({
        title: s.title,
        rows: s.rows.map((r) => ({
          title: r.title,
          description: r.description || '',
          rowId: r.rowId,
        })),
      })),
    };

    const data = await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
    const messageId = data?.key?.id || data?.id || `evo_${Date.now()}`;

    return {
      success: true,
      messageId,
      providerResponse: data,
    };
  }

  async sendTemplate(params: SendTemplateParams): Promise<SendResult> {
    // Template oficial Meta Cloud API
    const endpoint = `/message/sendTemplate/${params.instanceName}`;
    const payload = {
      number: this.cleanPhone(params.recipient),
      name: params.templateName,
      language: {
        code: params.languageCode,
      },
      components: params.components || [],
    };

    const data = await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
    const messageId = data?.key?.id || data?.id || `evo_${Date.now()}`;

    return {
      success: true,
      messageId,
      providerResponse: data,
    };
  }

  async sendPoll(params: SendPollParams): Promise<SendResult> {
    const endpoint = `/message/sendPoll/${params.instanceName}`;
    const payload = {
      number: this.cleanPhone(params.recipient),
      name: params.name,
      selectableCount: params.selectableCount,
      values: params.values,
    };

    const data = await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
    const messageId = data?.key?.id || data?.id || `evo_${Date.now()}`;

    return {
      success: true,
      messageId,
      providerResponse: data,
    };
  }

  async sendPresence(params: SendPresenceParams): Promise<void> {
    const endpoint = `/chat/sendPresence/${params.instanceName}`;
    const payload = {
      presence: params.presence,
      delay: params.delay || 1200,
    };

    await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
  }

  async markAsRead(params: MarkAsReadParams): Promise<void> {
    const endpoint = `/chat/markMessageAsRead/${params.instanceName}`;
    const payload = {
      readMessages: [
        {
          remoteJid: `${this.cleanPhone(params.recipient)}@s.whatsapp.net`,
          id: params.messageId,
          fromMe: params.fromMe,
        },
      ],
    };

    await this.postToEvolution(endpoint, payload, params.serverUrl, params.apiKey);
  }

  async getCapabilities(
    providerType: WhatsAppProviderType = WhatsAppProviderType.BAILEYS,
  ): Promise<ProviderCapabilities> {
    return this.capabilitiesService.getCapabilities(providerType);
  }
}
