import { WhatsAppProviderType } from '@prisma/client';

export interface ProviderCapabilities {
  providerType: WhatsAppProviderType;
  text: boolean;
  image: boolean;
  video: boolean;
  audio: boolean;
  document: boolean;
  sticker: boolean;
  location: boolean;
  contact: boolean;
  buttons: boolean;
  list: boolean;
  template: boolean;
  poll: boolean;
  requires24hWindow: boolean;
  requiresApprovedTemplates: boolean;
  supportsPresenceSimulation: boolean;
  maxButtonsCount: number;
  maxListSectionsCount: number;
  maxListRowsCount: number;
}

export class IncompatibleCapabilityException extends Error {
  constructor(
    public readonly capability: string,
    public readonly providerType: WhatsAppProviderType,
    public readonly reason: string,
  ) {
    super(`Capacidade incompatível [${capability}] para o provedor ${providerType}: ${reason}`);
    this.name = 'IncompatibleCapabilityException';
  }
}
