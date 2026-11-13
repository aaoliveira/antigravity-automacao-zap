import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiSecurity } from '@nestjs/swagger';
import { WorkflowEngineService } from './core/workflow-engine.service';
import { InboundEvent } from './types/execution.types';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('Workflow Engine')
@ApiSecurity('tenant-id')
@UseGuards(TenantGuard)
@Controller('engine')
export class EngineController {
  constructor(private readonly engineService: WorkflowEngineService) {}

  @Post('webhook/:tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recebimento de webhook interno de mensagens recebidas do WhatsApp' })
  @ApiParam({ name: 'tenantId', description: 'ID da empresa/tenant destinatária' })
  @ApiResponse({ status: 200, description: 'Evento processado ou enfileirado com sucesso.' })
  async handleWebhook(
    @Param('tenantId') tenantId: string,
    @CurrentTenant() currentTenantId: string,
    @Body() payload: any,
  ) {
    if (tenantId !== currentTenantId) {
      throw new ForbiddenException('Não é permitido despachar webhooks para outro tenant.');
    }
    // Normaliza payload recebido (ex: formato Evolution API v2 messages.upsert)
    const remoteJid = payload.data?.key?.remoteJid || payload.remoteJid || payload.from || '5511999999999';
    const contactPhone = remoteJid.replace(/@s\.whatsapp\.net|@g\.us/, '');
    const messageId = payload.data?.key?.id || payload.messageId || `msg_${Date.now()}_${Math.random()}`;

    // Determina tipo e conteúdo da interação
    let type: any = 'text';
    let value = '';
    let buttonId: string | undefined;
    let buttonPayload: string | undefined;
    let rowId: string | undefined;

    if (payload.data?.message?.buttonsResponseMessage) {
      type = 'button_click';
      buttonId = payload.data.message.buttonsResponseMessage.selectedButtonId;
      value = payload.data.message.buttonsResponseMessage.selectedDisplayText || buttonId;
    } else if (payload.data?.message?.listResponseMessage) {
      type = 'list_selection';
      rowId = payload.data.message.listResponseMessage.singleSelectReply?.selectedRowId;
      value = payload.data.message.listResponseMessage.title || rowId;
    } else if (payload.buttonId) {
      type = 'button_click';
      buttonId = payload.buttonId;
      buttonPayload = payload.buttonPayload;
      value = payload.value || buttonId;
    } else if (payload.rowId) {
      type = 'list_selection';
      rowId = payload.rowId;
      value = payload.value || rowId;
    } else {
      value =
        payload.data?.message?.conversation ||
        payload.data?.message?.extendedTextMessage?.text ||
        payload.text ||
        payload.value ||
        '';
    }

    const event: InboundEvent = {
      messageId,
      tenantId,
      instanceName: payload.instance || payload.instanceName || 'whatsapp-default',
      contactPhone,
      contactName: payload.data?.pushName || payload.contactName || 'Cliente WhatsApp',
      interaction: {
        type,
        value,
        buttonId,
        buttonPayload,
        rowId,
        rawPayload: payload,
      },
      timestamp: new Date(),
    };

    return this.engineService.handleInboundEvent(event);
  }
}
