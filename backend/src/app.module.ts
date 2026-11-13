import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './modules/database/database.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { EngineModule } from './modules/engine/engine.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    DatabaseModule,
    AutomationsModule,
    EngineModule,
    WhatsAppModule,
  ],
})
export class AppModule {}
