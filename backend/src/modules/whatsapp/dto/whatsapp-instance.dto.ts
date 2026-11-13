import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUrl } from 'class-validator';
import { WhatsAppProviderType } from '@prisma/client';

export class CreateWhatsAppInstanceDto {
  @ApiProperty({ description: 'Nome identificador da instância na Evolution API', example: 'atendimento-principal' })
  @IsString()
  @IsNotEmpty()
  instanceName: string;

  @ApiPropertyOptional({ description: 'Número do WhatsApp conectado com DDI e DDD', example: '5511999999999' })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Tipo de conector/provedor',
    enum: WhatsAppProviderType,
    default: WhatsAppProviderType.BAILEYS,
  })
  @IsEnum(WhatsAppProviderType)
  @IsOptional()
  providerType?: WhatsAppProviderType = WhatsAppProviderType.BAILEYS;

  @ApiPropertyOptional({ description: 'URL do servidor da Evolution API (caso não use a global)' })
  @IsUrl()
  @IsOptional()
  serverUrl?: string;

  @ApiPropertyOptional({ description: 'Chave de API da Evolution API (será criptografada com AES-256-GCM)' })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Segredo para validação de assinatura dos webhooks recebidos' })
  @IsString()
  @IsOptional()
  webhookSecret?: string;
}

export class UpdateWhatsAppInstanceDto {
  @ApiPropertyOptional({ description: 'Número do WhatsApp conectado com DDI e DDD' })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ enum: WhatsAppProviderType })
  @IsEnum(WhatsAppProviderType)
  @IsOptional()
  providerType?: WhatsAppProviderType;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  serverUrl?: string;

  @ApiPropertyOptional({ description: 'Nova chave de API (será criptografada)' })
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  webhookSecret?: string;

  @ApiPropertyOptional({ description: 'Status da conexão', example: 'CONNECTED' })
  @IsString()
  @IsOptional()
  status?: string;
}
