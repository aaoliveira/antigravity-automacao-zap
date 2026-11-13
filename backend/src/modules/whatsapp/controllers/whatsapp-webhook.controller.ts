import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiSecurity } from '@nestjs/swagger';
import { WhatsAppRouterService } from '../routing/whatsapp-router.service';
import { WhatsAppWebhookGuard } from '../guards/whatsapp-webhook.guard';

@ApiTags('WhatsApp Webhooks')
@ApiSecurity('apikey')
@Controller('webhooks')
@UseGuards(WhatsAppWebhookGuard)
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private readonly routerService: WhatsAppRouterService) {}

  @Post('whatsapp/:instanceName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recebimento de webhook da Evolution API v2 para uma instância específica',
    description:
      'Recebe eventos da Evolution API (mensagens, cliques em botões, seleção de listas, status de envio). Responde com HTTP 200 OK imediatamente após gravação de auditoria.',
  })
  @ApiParam({ name: 'instanceName', description: 'Nome da instância WhatsApp cadastrada' })
  @ApiResponse({ status: 200, description: 'Evento registrado e processado com sucesso.' })
  async handleInstanceWebhook(
    @Param('instanceName') instanceName: string,
    @Body() payload: any,
  ) {
    const rawPayload = {
      ...payload,
      instance: instanceName,
    };

    // Roteia e persiste evento
    const result = await this.routerService.routeIncomingWebhook(rawPayload);

    return {
      received: true,
      eventId: result.eventId,
      executionId: result.executionId,
      status: result.success && !result.reason?.includes('ignored') ? 'success' : 'ignored',
      reason: result.reason,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('evolution/:instanceName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alias para webhook da Evolution API v2' })
  async handleEvolutionAlias(
    @Param('instanceName') instanceName: string,
    @Body() payload: any,
  ) {
    return this.handleInstanceWebhook(instanceName, payload);
  }

  @Post('whatsapp/tenant/:tenantId/:instanceName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook com validação explícita de tenant e instância' })
  async handleTenantScopedWebhook(
    @Param('tenantId') tenantId: string,
    @Param('instanceName') instanceName: string,
    @Body() payload: any,
  ) {
    const rawPayload = {
      ...payload,
      instance: instanceName,
    };

    const result = await this.routerService.routeIncomingWebhook(rawPayload, tenantId);

    return {
      received: true,
      eventId: result.eventId,
      executionId: result.executionId,
      status: result.success && !result.reason?.includes('ignored') ? 'success' : 'ignored',
      reason: result.reason,
      timestamp: new Date().toISOString(),
    };
  }
}
