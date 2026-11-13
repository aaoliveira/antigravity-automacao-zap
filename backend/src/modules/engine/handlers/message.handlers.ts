import { Injectable } from '@nestjs/common';
import { WorkflowNodeHandler } from './node-handler.interface';
import { NodeExecutionContext, NodeResult } from '../types/execution.types';
import { VariableResolverService } from '../variables/variable-resolver.service';
import { ExecutionStatus } from '@prisma/client';

@Injectable()
export class MessageTextHandler implements WorkflowNodeHandler {
  readonly type = ['message.text', 'message_text'];

  constructor(private readonly variableResolver: VariableResolverService) {}

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const rawText = context.node.config?.text || context.node.data?.text || '';
    const interpolatedText = this.variableResolver.interpolate(rawText, context.variables);

    if (context.outboxMessage) {
      await context.outboxMessage('text', context.variables.contact.phone, {
        text: interpolatedText,
        previewUrl: context.node.config?.previewUrl ?? false,
      });
    }

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { sentText: interpolatedText },
    };
  }
}

@Injectable()
export class MessageImageHandler implements WorkflowNodeHandler {
  readonly type = ['message.image', 'message_media'];

  constructor(private readonly variableResolver: VariableResolverService) {}

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const mediaUrl = context.node.config?.mediaUrl || context.node.config?.url || '';
    const rawCaption = context.node.config?.caption || '';
    const caption = this.variableResolver.interpolate(rawCaption, context.variables);

    if (context.outboxMessage) {
      await context.outboxMessage('media', context.variables.contact.phone, {
        mediaType: 'image',
        mediaUrl,
        caption,
      });
    }

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { mediaType: 'image', mediaUrl, caption },
    };
  }
}

@Injectable()
export class MessageVideoHandler implements WorkflowNodeHandler {
  readonly type = ['message.video'];

  constructor(private readonly variableResolver: VariableResolverService) {}

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const mediaUrl = context.node.config?.mediaUrl || context.node.config?.url || '';
    const caption = this.variableResolver.interpolate(context.node.config?.caption || '', context.variables);

    if (context.outboxMessage) {
      await context.outboxMessage('media', context.variables.contact.phone, {
        mediaType: 'video',
        mediaUrl,
        caption,
      });
    }

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { mediaType: 'video', mediaUrl },
    };
  }
}

@Injectable()
export class MessageAudioHandler implements WorkflowNodeHandler {
  readonly type = ['message.audio'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const mediaUrl = context.node.config?.mediaUrl || context.node.config?.url || '';
    const isPtt = context.node.config?.ptt ?? true;

    if (context.outboxMessage) {
      await context.outboxMessage('media', context.variables.contact.phone, {
        mediaType: 'audio',
        mediaUrl,
        ptt: isPtt,
      });
    }

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { mediaType: 'audio', mediaUrl, isPtt },
    };
  }
}

@Injectable()
export class MessageDocumentHandler implements WorkflowNodeHandler {
  readonly type = ['message.document'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const mediaUrl = context.node.config?.mediaUrl || context.node.config?.url || '';
    const fileName = context.node.config?.fileName || 'documento.pdf';

    if (context.outboxMessage) {
      await context.outboxMessage('media', context.variables.contact.phone, {
        mediaType: 'document',
        mediaUrl,
        fileName,
      });
    }

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { mediaType: 'document', mediaUrl, fileName },
    };
  }
}

@Injectable()
export class MessageStickerHandler implements WorkflowNodeHandler {
  readonly type = ['message.sticker'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const mediaUrl = context.node.config?.mediaUrl || context.node.config?.url || '';

    if (context.outboxMessage) {
      await context.outboxMessage('media', context.variables.contact.phone, {
        mediaType: 'sticker',
        mediaUrl,
      });
    }

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { mediaType: 'sticker', mediaUrl },
    };
  }
}

@Injectable()
export class MessageLocationHandler implements WorkflowNodeHandler {
  readonly type = ['message.location'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const { latitude, longitude, name, address } = context.node.config || {};

    if (context.outboxMessage) {
      await context.outboxMessage('location', context.variables.contact.phone, {
        latitude,
        longitude,
        name,
        address,
      });
    }

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { latitude, longitude },
    };
  }
}

@Injectable()
export class MessageContactHandler implements WorkflowNodeHandler {
  readonly type = ['message.contact'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const { fullName, phoneNumber } = context.node.config || {};

    if (context.outboxMessage) {
      await context.outboxMessage('contact', context.variables.contact.phone, {
        fullName,
        phoneNumber,
      });
    }

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { fullName, phoneNumber },
    };
  }
}

@Injectable()
export class MessageTemplateHandler implements WorkflowNodeHandler {
  readonly type = ['message.template'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const { templateName, language, components } = context.node.config || {};

    if (context.outboxMessage) {
      await context.outboxMessage('template', context.variables.contact.phone, {
        templateName,
        language: language || 'pt_BR',
        components: components || [],
      });
    }

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { templateName },
    };
  }
}

@Injectable()
export class MessageButtonsHandler implements WorkflowNodeHandler {
  readonly type = ['message.buttons', 'buttons'];

  constructor(private readonly variableResolver: VariableResolverService) {}

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const buttons = context.node.config?.buttons || [];

    // FASE 2: Retomada após clique do botão ou resposta do cliente
    if (context.incomingInteraction) {
      const interaction = context.incomingInteraction;
      const clickedBtnId = interaction.buttonId;
      const clickedPayload = interaction.buttonPayload;
      const typedText = (interaction.value || '').trim().toLowerCase();

      // 1. Casamento direto por ID ou Payload do botão
      let matchedButton = buttons.find(
        (b: any) =>
          b.id === clickedBtnId ||
          (b.payload && b.payload === clickedPayload) ||
          b.id === clickedPayload,
      );

      // 2. Se o cliente digitou manualmente (em vez de clicar), compara por índice numérico ou rótulo
      if (!matchedButton && typedText) {
        matchedButton = buttons.find((b: any, index: number) => {
          const indexMatch = String(index + 1) === typedText;
          const labelMatch = (b.label || '').toLowerCase().trim() === typedText;
          const payloadMatch = (b.payload || '').toLowerCase().trim() === typedText;
          return indexMatch || labelMatch || payloadMatch;
        });
      }

      if (matchedButton) {
        return {
          success: true,
          nextHandle: matchedButton.id,
          outputPayload: {
            selectedButtonId: matchedButton.id,
            selectedButtonLabel: matchedButton.label,
            selectedPayload: matchedButton.payload,
          },
          variableUpdates: {
            last_selected_button_id: matchedButton.id,
            last_selected_button_label: matchedButton.label,
          },
        };
      }

      // Resposta inválida: se não casar com nenhum botão, retorna fallback se configurado
      return {
        success: false,
        nextHandle: 'invalid',
        error: `Resposta "${typedText}" não corresponde a nenhum dos botões configurados.`,
      };
    }

    // FASE 1: Envio inicial e pausa para espera
    const rawBody = context.node.config?.body || context.node.config?.text || '';
    const body = this.variableResolver.interpolate(rawBody, context.variables);

    if (context.outboxMessage) {
      await context.outboxMessage('buttons', context.variables.contact.phone, {
        body,
        title: context.node.config?.title,
        footer: context.node.config?.footer,
        buttons: buttons.map((b: any) => ({
          id: b.id,
          label: b.label,
          payload: b.payload || b.id,
        })),
        fallbackToTextList: context.node.config?.fallbackToTextList ?? true,
      });
    }

    return {
      success: true,
      waitingForInput: true,
      statusTransition: ExecutionStatus.WAITING_FOR_INPUT,
      outputPayload: { sentBody: body, buttonsCount: buttons.length },
    };
  }
}

@Injectable()
export class MessageListHandler implements WorkflowNodeHandler {
  readonly type = ['message.list', 'list_interactive'];

  constructor(private readonly variableResolver: VariableResolverService) {}

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const sections = context.node.config?.sections || [];
    const allRows: any[] = [];
    for (const sec of sections) {
      if (Array.isArray(sec.rows)) allRows.push(...sec.rows);
    }

    // FASE 2: Retomada após seleção da lista
    if (context.incomingInteraction) {
      const interaction = context.incomingInteraction;
      const selectedRowId = interaction.rowId || interaction.value;
      const typedText = (interaction.value || '').trim().toLowerCase();

      let matchedRow = allRows.find(
        (r: any) =>
          r.id === selectedRowId ||
          (r.payload && r.payload === selectedRowId) ||
          r.id === interaction.rowPayload,
      );

      // Casamento por texto ou número
      if (!matchedRow && typedText) {
        matchedRow = allRows.find((r: any, idx: number) => {
          const indexMatch = String(idx + 1) === typedText;
          const titleMatch = (r.title || '').toLowerCase().trim() === typedText;
          return indexMatch || titleMatch;
        });
      }

      if (matchedRow) {
        return {
          success: true,
          nextHandle: matchedRow.id,
          outputPayload: {
            selectedRowId: matchedRow.id,
            selectedRowTitle: matchedRow.title,
          },
          variableUpdates: {
            last_selected_row_id: matchedRow.id,
            last_selected_row_title: matchedRow.title,
          },
        };
      }

      return {
        success: false,
        nextHandle: 'invalid',
        error: `Opção "${typedText}" não encontrada na lista.`,
      };
    }

    // FASE 1: Envio da lista interativa
    const rawBody = context.node.config?.body || '';
    const body = this.variableResolver.interpolate(rawBody, context.variables);

    if (context.outboxMessage) {
      await context.outboxMessage('list', context.variables.contact.phone, {
        body,
        buttonText: context.node.config?.buttonText || 'Ver Opções',
        sections,
      });
    }

    return {
      success: true,
      waitingForInput: true,
      statusTransition: ExecutionStatus.WAITING_FOR_INPUT,
      outputPayload: { sentBody: body, rowsCount: allRows.length },
    };
  }
}
