import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OutboxService, MessageSender } from '../../engine/outbox/outbox.service';
import { WhatsAppProvider, SendResult, WHATSAPP_PROVIDER } from '../providers/whatsapp-provider.interface';
import { WhatsAppCapabilitiesService } from '../capabilities/whatsapp-capabilities.service';
import { CryptoService } from '../security/crypto.service';
import { WhatsAppProviderType } from '@prisma/client';

@Injectable()
export class WhatsAppOutboxDispatcherService implements MessageSender, OnModuleInit {
  private readonly logger = new Logger(WhatsAppOutboxDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly capabilitiesService: WhatsAppCapabilitiesService,
    private readonly cryptoService: CryptoService,
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
  ) {}

  onModuleInit() {
    this.outboxService.setSender(this);
    this.logger.log('WhatsAppOutboxDispatcher registrado com sucesso no OutboxService.');
  }

  /**
   * Envia a mensagem através do adapter do provedor (Evolution API ou Mock)
   */
  async sendMessage(
    instanceName: string,
    recipient: string,
    messageType: string,
    payload: any,
  ): Promise<{ messageId: string; providerResponse?: any }> {
    // 1. Busca configurações da conexão WhatsApp
    const instance = await this.prisma.whatsAppInstance.findFirst({
      where: { instanceName },
    });

    const providerType = instance?.providerType || WhatsAppProviderType.BAILEYS;
    let apiKey: string | undefined;

    if (instance?.apiKeyEncrypted) {
      try {
        apiKey = this.cryptoService.decrypt(instance.apiKeyEncrypted);
      } catch {
        this.logger.error(`Não foi possível decriptografar a chave da instância ${instanceName}`);
      }
    }

    const serverUrl = instance?.serverUrl || undefined;

    // 2. Validação da Janela de 24 Horas (Exclusiva para Meta Cloud API)
    if (providerType === WhatsAppProviderType.CLOUD_API) {
      await this.validate24hWindow(instance?.tenantId, recipient, messageType);
    }

    // 3. Validação de capacidades e fallback automático
    const result = await this.dispatchWithCapabilityFallback(
      providerType,
      instanceName,
      recipient,
      messageType,
      payload,
      serverUrl,
      apiKey,
    );

    return {
      messageId: result.messageId,
      providerResponse: result.providerResponse,
    };
  }

  private async validate24hWindow(
    tenantId: string | undefined,
    recipient: string,
    messageType: string,
  ): Promise<void> {
    if (!tenantId) return;

    const contact = await this.prisma.contact.findUnique({
      where: {
        tenantId_phone: {
          tenantId,
          phone: recipient.replace(/\D/g, ''),
        },
      },
    });

    if (contact?.lastInteractionAt) {
      const hoursSinceLastInteraction =
        (Date.now() - contact.lastInteractionAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastInteraction > 24 && messageType !== 'template') {
        throw new Error(
          `Janela de 24h expirada (${hoursSinceLastInteraction.toFixed(1)}h desde última interação). ` +
            `O provedor Cloud API exige envio de modelo aprovado (Template).`,
        );
      }
    }
  }

  private async dispatchWithCapabilityFallback(
    providerType: WhatsAppProviderType,
    instanceName: string,
    recipient: string,
    messageType: string,
    payload: any,
    serverUrl?: string,
    apiKey?: string,
  ): Promise<SendResult> {
    const caps = this.capabilitiesService.getCapabilities(providerType);

    switch (messageType) {
      case 'text':
      case 'message.text':
        return this.provider.sendText({
          instanceName,
          recipient,
          text: payload.text,
          delay: payload.delay,
          serverUrl,
          apiKey,
        });

      case 'image':
      case 'message.image':
        return this.provider.sendImage({
          instanceName,
          recipient,
          imageUrl: payload.url || payload.imageUrl || payload.mediaUrl,
          caption: payload.caption,
          fileName: payload.fileName,
          serverUrl,
          apiKey,
        });

      case 'video':
      case 'message.video':
        return this.provider.sendVideo({
          instanceName,
          recipient,
          videoUrl: payload.url || payload.videoUrl || payload.mediaUrl,
          caption: payload.caption,
          fileName: payload.fileName,
          serverUrl,
          apiKey,
        });

      case 'audio':
      case 'message.audio':
        return this.provider.sendAudio({
          instanceName,
          recipient,
          audioUrl: payload.url || payload.audioUrl || payload.mediaUrl,
          isPtt: payload.isPtt ?? true,
          serverUrl,
          apiKey,
        });

      case 'document':
      case 'message.document':
        return this.provider.sendDocument({
          instanceName,
          recipient,
          documentUrl: payload.url || payload.documentUrl || payload.mediaUrl,
          fileName: payload.fileName || 'documento.pdf',
          caption: payload.caption,
          serverUrl,
          apiKey,
        });

      case 'sticker':
      case 'message.sticker':
        return this.provider.sendSticker({
          instanceName,
          recipient,
          stickerUrl: payload.url || payload.stickerUrl || payload.mediaUrl,
          serverUrl,
          apiKey,
        });

      case 'location':
      case 'message.location':
        return this.provider.sendLocation({
          instanceName,
          recipient,
          name: payload.name,
          address: payload.address,
          latitude: payload.latitude,
          longitude: payload.longitude,
          serverUrl,
          apiKey,
        });

      case 'contact':
      case 'message.contact':
        return this.provider.sendContact({
          instanceName,
          recipient,
          contacts: payload.contacts || [
            {
              fullName: payload.name || 'Contato',
              phoneNumber: payload.phone || recipient,
            },
          ],
          serverUrl,
          apiKey,
        });

      case 'buttons':
      case 'message.buttons': {
        const buttons = payload.buttons || [];

        // Se a conexão não suporta botões nativos (ex: BAILEYS), aplica fallback para menu textual
        if (!caps.buttons) {
          this.logger.warn(
            `Conexão ${providerType} não suporta botões nativos. Aplicando fallback para menu de texto numerado.`,
          );
          const fallbackText = this.capabilitiesService.formatFallbackTextMenu(
            payload.title,
            payload.text || payload.description || '',
            buttons.map((b: any) => ({
              id: b.id,
              displayText: b.displayText || b.text || b.label,
            })),
          );

          return this.provider.sendText({
            instanceName,
            recipient,
            text: fallbackText,
            serverUrl,
            apiKey,
          });
        }

        return this.provider.sendButtons({
          instanceName,
          recipient,
          title: payload.title,
          description: payload.text || payload.description || '',
          footer: payload.footer,
          buttons: buttons.map((b: any) => ({
            id: b.id,
            displayText: b.displayText || b.text || b.label,
          })),
          serverUrl,
          apiKey,
        });
      }

      case 'list':
      case 'message.list': {
        const sections = payload.sections || [];

        // Se a conexão não suporta listas nativas, aplica fallback textual
        if (!caps.list) {
          this.logger.warn(
            `Conexão ${providerType} não suporta listas nativas. Aplicando fallback para menu de texto estruturado.`,
          );
          const fallbackText = this.capabilitiesService.formatFallbackListMenu(
            payload.title || '',
            payload.description || '',
            sections,
          );

          return this.provider.sendText({
            instanceName,
            recipient,
            text: fallbackText,
            serverUrl,
            apiKey,
          });
        }

        return this.provider.sendList({
          instanceName,
          recipient,
          title: payload.title || 'Opções',
          description: payload.description || '',
          buttonText: payload.buttonText || 'Abrir Menu',
          footerText: payload.footerText,
          sections,
          serverUrl,
          apiKey,
        });
      }

      case 'template':
      case 'message.template':
        if (!caps.template) {
          throw new Error(`Templates oficiais não são suportados no provedor ${providerType}`);
        }
        return this.provider.sendTemplate({
          instanceName,
          recipient,
          templateName: payload.name || payload.templateName,
          languageCode: payload.language || payload.languageCode || 'pt_BR',
          components: payload.components,
          serverUrl,
          apiKey,
        });

      default:
        // Mensagem de texto como fallback genérico
        return this.provider.sendText({
          instanceName,
          recipient,
          text: payload.text || JSON.stringify(payload),
          serverUrl,
          apiKey,
        });
    }
  }
}
