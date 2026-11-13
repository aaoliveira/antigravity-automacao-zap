import { Injectable } from '@nestjs/common';
import { WorkflowNodeHandler } from './node-handler.interface';
import { NodeExecutionContext, NodeResult } from '../types/execution.types';
import { VariableResolverService } from '../variables/variable-resolver.service';
import { ExecutionStatus } from '@prisma/client';

@Injectable()
export class InteractionQuestionHandler implements WorkflowNodeHandler {
  readonly type = ['interaction.question', 'question_input'];

  constructor(private readonly variableResolver: VariableResolverService) {}

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const config = context.node.config || {};
    const targetVariable =
      config.targetVariable || config.saveVariable || config.variableName || 'input_response';

    // FASE 2: Retomada com a resposta do cliente
    if (context.incomingInteraction) {
      const rawInput = context.incomingInteraction.value ?? '';
      const validationError = this.validateInput(rawInput, config.expectedType, config.validationRegex);

      if (validationError) {
        // Envia mensagem de erro se configurada e mantém em espera
        if (config.customErrorMessage && context.outboxMessage) {
          await context.outboxMessage('text', context.variables.contact.phone, {
            text: config.customErrorMessage,
          });
        }

        return {
          success: false,
          waitingForInput: true,
          statusTransition: ExecutionStatus.WAITING_FOR_INPUT,
          error: validationError,
        };
      }

      // Validação passou com sucesso!
      const cleanTarget = targetVariable.replace(/^\{\{|\}\}$/g, '').trim();
      const updates: Record<string, any> = {
        [cleanTarget]: rawInput,
        last_input: rawInput,
        last_response: rawInput,
      };

      if (cleanTarget.startsWith('contact.')) {
        const field = cleanTarget.replace(/^contact\.(customFields\.)?/, '');
        if (field === 'name') {
          context.variables.contact.name = rawInput;
        } else {
          context.variables.contact.customFields = context.variables.contact.customFields || {};
          context.variables.contact.customFields[field] = rawInput;
        }
      }

      return {
        success: true,
        nextHandle: 'default',
        variableUpdates: updates,
        outputPayload: {
          capturedVariable: cleanTarget,
          capturedValue: rawInput,
        },
      };
    }

    // FASE 1: Disparo da pergunta e pausa
    const rawQuestion = config.questionText || config.question || config.text || '';
    const questionText = this.variableResolver.interpolate(rawQuestion, context.variables);

    if (context.outboxMessage) {
      await context.outboxMessage('text', context.variables.contact.phone, {
        text: questionText,
      });
    }

    return {
      success: true,
      waitingForInput: true,
      statusTransition: ExecutionStatus.WAITING_FOR_INPUT,
      outputPayload: {
        sentQuestion: questionText,
        targetVariable,
      },
    };
  }

  private validateInput(val: string, expectedType?: string, regexPattern?: string): string | null {
    if (!val || val.trim() === '') {
      return 'Entrada não pode ser vazia.';
    }

    switch (expectedType) {
      case 'number':
        if (isNaN(Number(val.trim()))) {
          return 'Valor informado deve ser um número.';
        }
        break;

      case 'email': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val.trim())) {
          return 'Formato de e-mail inválido.';
        }
        break;
      }

      case 'phone': {
        const phoneDigits = val.replace(/\D/g, '');
        if (phoneDigits.length < 8 || phoneDigits.length > 15) {
          return 'Formato de telefone inválido.';
        }
        break;
      }

      case 'regex':
        if (regexPattern) {
          const reg = new RegExp(regexPattern);
          if (!reg.test(val)) {
            return 'Entrada não coincide com o padrão esperado.';
          }
        }
        break;
    }

    return null;
  }
}

@Injectable()
export class InteractionCaptureHandler implements WorkflowNodeHandler {
  readonly type = ['interaction.capture'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const rawTarget =
      context.node.config?.targetVariable ||
      context.node.config?.variable ||
      context.node.config?.variableName ||
      'captured_value';
    const targetVariable = rawTarget.replace(/^\{\{|\}\}$/g, '').trim();

    const value =
      context.incomingInteraction?.value ??
      context.variables?.execution?.variables?.last_input ??
      context.variables?.execution?.variables?.last_response ??
      (context.variables as any)?.last_input ??
      '';

    const updates: Record<string, any> = {
      [targetVariable]: value,
    };

    if (targetVariable.startsWith('contact.')) {
      const field = targetVariable.replace(/^contact\.(customFields\.)?/, '');
      if (field === 'name') {
        context.variables.contact.name = String(value);
      } else {
        context.variables.contact.customFields = context.variables.contact.customFields || {};
        context.variables.contact.customFields[field] = value;
      }
    }

    return {
      success: true,
      nextHandle: 'default',
      variableUpdates: updates,
      outputPayload: {
        targetVariable,
        value,
      },
    };
  }
}

@Injectable()
export class InteractionChoiceHandler implements WorkflowNodeHandler {
  readonly type = ['interaction.choice'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const choices: any[] = context.node.config?.choices || [];

    if (context.incomingInteraction) {
      const selected = context.incomingInteraction.value?.trim().toLowerCase();
      const matched = choices.find(
        (c: any) =>
          c.id === context.incomingInteraction?.buttonId ||
          c.id?.toLowerCase() === selected ||
          c.label?.toLowerCase() === selected,
      );

      if (matched) {
        return {
          success: true,
          nextHandle: matched.id,
          variableUpdates: {
            selected_choice: matched.id,
          },
        };
      }

      return {
        success: false,
        nextHandle: 'default',
        error: 'Opção escolhida não encontrada.',
      };
    }

    return {
      success: true,
      waitingForInput: true,
      statusTransition: ExecutionStatus.WAITING_FOR_INPUT,
    };
  }
}
