import { Controller, Post, Body, Param, HttpCode, HttpStatus, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { WorkflowEngineService } from './core/workflow-engine.service';
import { InboundEvent } from './types/execution.types';

@ApiTags('Workflow Engine')
@Controller('engine')
export class EngineController {
  constructor(private readonly engineService: WorkflowEngineService) {}

  @Post('webhook/:tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recebimento de webhook de mensagens recebidas do WhatsApp' })
  @ApiParam({ name: 'tenantId', description: 'ID da empresa/tenant destinatária' })
  @ApiResponse({ status: 200, description: 'Evento processado ou enfileirado com sucesso.' })
  async handleWebhook(
    @Param('tenantId') tenantId: string,
    @Body() payload: any,
  ) {
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
