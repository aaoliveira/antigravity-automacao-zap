export type NormalizedMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'button_reply'
  | 'list_reply'
  | 'poll_vote'
  | 'status_update'
  | 'unknown';

export interface NormalizedContact {
  phone: string;
  name?: string;
  profilePicUrl?: string;
}

export interface NormalizedMessage {
  id: string; // identificador único externo da mensagem
  type: NormalizedMessageType;
  text?: string;
  buttonId?: string;
  buttonText?: string;
  buttonPayload?: string;
  listRowId?: string;
  listTitle?: string;
  listDescription?: string;
  pollSelectedOptions?: string[];
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  fromMe: boolean;
  timestamp: Date;
  status?: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  raw?: any;
}

export interface NormalizedMessageEvent {
  eventId: string;
  tenantId?: string;
  instanceName: string;
  eventType: string; // messages.upsert, messages.update, etc.
  contact: NormalizedContact;
  message: NormalizedMessage;
  receivedAt: Date;
}
