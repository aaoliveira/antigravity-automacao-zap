import { WhatsAppProviderType } from '@prisma/client';
import { ProviderCapabilities } from '../capabilities/whatsapp-capabilities.types';

export interface BaseSendParams {
  instanceName: string;
  recipient: string; // Phone number e.g. "5511999999999"
  serverUrl?: string;
  apiKey?: string;
}

export interface SendTextParams extends BaseSendParams {
  text: string;
  delay?: number;
  linkPreview?: boolean;
}

export interface SendImageParams extends BaseSendParams {
  imageUrl: string;
  caption?: string;
  fileName?: string;
}

export interface SendVideoParams extends BaseSendParams {
  videoUrl: string;
  caption?: string;
  fileName?: string;
}

export interface SendAudioParams extends BaseSendParams {
  audioUrl: string;
  isPtt?: boolean; // Push to Talk (áudio gravado na hora)
}

export interface SendDocumentParams extends BaseSendParams {
  documentUrl: string;
  fileName: string;
  caption?: string;
}

export interface SendStickerParams extends BaseSendParams {
  stickerUrl: string;
}

export interface SendLocationParams extends BaseSendParams {
  name?: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface SendContactParams extends BaseSendParams {
  contacts: Array<{
    fullName: string;
    phoneNumber: string;
    wuid?: string;
  }>;
}

export interface SendButtonsParams extends BaseSendParams {
  title?: string;
  description: string;
  footer?: string;
  buttons: Array<{
    id: string;
    displayText: string;
  }>;
}

export interface SendListParams extends BaseSendParams {
  title: string;
  description: string;
  buttonText: string;
  footerText?: string;
  sections: Array<{
    title: string;
    rows: Array<{
      rowId: string;
      title: string;
      description?: string;
    }>;
  }>;
}

export interface SendTemplateParams extends BaseSendParams {
  templateName: string;
  languageCode: string;
  components?: any[];
}

export interface SendPollParams extends BaseSendParams {
  name: string;
  selectableCount: number;
  values: string[];
}

export interface SendPresenceParams extends BaseSendParams {
  presence: 'composing' | 'recording' | 'available' | 'unavailable';
  delay?: number;
}

export interface MarkAsReadParams extends BaseSendParams {
  messageId: string;
  fromMe: boolean;
}

export interface SendResult {
  success: boolean;
  messageId: string;
  providerResponse?: any;
  error?: string;
}

export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';

export interface WhatsAppProvider {
  sendText(params: SendTextParams): Promise<SendResult>;
  sendImage(params: SendImageParams): Promise<SendResult>;
  sendVideo(params: SendVideoParams): Promise<SendResult>;
  sendAudio(params: SendAudioParams): Promise<SendResult>;
  sendDocument(params: SendDocumentParams): Promise<SendResult>;
  sendSticker(params: SendStickerParams): Promise<SendResult>;
  sendLocation(params: SendLocationParams): Promise<SendResult>;
  sendContact(params: SendContactParams): Promise<SendResult>;
  sendButtons(params: SendButtonsParams): Promise<SendResult>;
  sendList(params: SendListParams): Promise<SendResult>;
  sendTemplate(params: SendTemplateParams): Promise<SendResult>;
  sendPoll?(params: SendPollParams): Promise<SendResult>;
  sendPresence?(params: SendPresenceParams): Promise<void>;
  markAsRead?(params: MarkAsReadParams): Promise<void>;
  getCapabilities(providerType?: WhatsAppProviderType): Promise<ProviderCapabilities>;
}
