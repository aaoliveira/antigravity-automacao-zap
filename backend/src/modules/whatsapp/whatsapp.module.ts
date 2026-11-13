import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EngineModule } from '../engine/engine.module';
import { CryptoService } from './security/crypto.service';
import { WhatsAppCapabilitiesService } from './capabilities/whatsapp-capabilities.service';
import { EvolutionApiV2Adapter } from './providers/evolution-api-v2.adapter';
import { MockWhatsAppProvider } from './providers/mock-whatsapp.provider';
import { WHATSAPP_PROVIDER } from './providers/whatsapp-provider.interface';
import { EventNormalizerService } from './normalization/event-normalizer.service';
import { WhatsAppRouterService } from './routing/whatsapp-router.service';
import { WhatsAppOutboxDispatcherService } from './outbox/whatsapp-outbox-dispatcher.service';
import { WhatsAppInstanceService } from './services/whatsapp-instance.service';
import { WhatsAppWebhookController } from './controllers/whatsapp-webhook.controller';
import { WhatsAppInstanceController } from './controllers/whatsapp-instance.controller';
import { WhatsAppWebhookGuard } from './guards/whatsapp-webhook.guard';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => EngineModule),
  ],
  controllers: [
    WhatsAppWebhookController,
    WhatsAppInstanceController,
  ],
  providers: [
    CryptoService,
    WhatsAppCapabilitiesService,
    EventNormalizerService,
    EvolutionApiV2Adapter,
    MockWhatsAppProvider,
    WhatsAppWebhookGuard,
    // Define o provider de envio padrão como o adapter oficial da Evolution API v2
    {
      provide: WHATSAPP_PROVIDER,
      useClass: EvolutionApiV2Adapter,
    },
    WhatsAppOutboxDispatcherService,
    WhatsAppRouterService,
    WhatsAppInstanceService,
  ],
  exports: [
    CryptoService,
    WhatsAppCapabilitiesService,
    EventNormalizerService,
    WHATSAPP_PROVIDER,
    EvolutionApiV2Adapter,
    MockWhatsAppProvider,
    WhatsAppRouterService,
    WhatsAppInstanceService,
  ],
})
export class WhatsAppModule {}
