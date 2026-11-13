import { Injectable } from '@nestjs/common';
import { WorkflowNodeHandler } from './node-handler.interface';
import { NodeExecutionContext, NodeResult } from '../types/execution.types';
import { VariableResolverService } from '../variables/variable-resolver.service';
import { ExecutionStatus } from '@prisma/client';

@Injectable()
export class ActionAddTagHandler implements WorkflowNodeHandler {
  readonly type = ['action.add_tag'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const tag = context.node.config?.tag;
    const currentTags = context.variables.contact.tags || [];

    const newTags = currentTags.includes(tag) ? currentTags : [...currentTags, tag];
    context.variables.contact.tags = newTags;

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { addedTag: tag, currentTags: newTags },
    };
  }
}

@Injectable()
export class ActionRemoveTagHandler implements WorkflowNodeHandler {
  readonly type = ['action.remove_tag'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const tag = context.node.config?.tag;
    const currentTags = context.variables.contact.tags || [];

    const newTags = currentTags.filter((t) => t !== tag);
    context.variables.contact.tags = newTags;

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { removedTag: tag, currentTags: newTags },
    };
  }
}

@Injectable()
export class ActionUpdateContactHandler implements WorkflowNodeHandler {
  readonly type = ['action.update_contact'];

  constructor(private readonly variableResolver: VariableResolverService) {}

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const fieldsToUpdate = context.node.config?.fields || {};
    const updated: Record<string, any> = {};

    for (const [key, val] of Object.entries(fieldsToUpdate)) {
      const resolved = typeof val === 'string'
        ? this.variableResolver.interpolate(val, context.variables)
        : val;

      if (key === 'name') {
        context.variables.contact.name = String(resolved);
      } else {
        context.variables.contact.customFields[key] = resolved;
      }
      updated[key] = resolved;
    }

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { updatedFields: updated },
    };
  }
}

@Injectable()
export class ActionStartFlowHandler implements WorkflowNodeHandler {
  readonly type = ['action.start_flow'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const targetFlowId = context.node.config?.flowId;

    return {
      success: true,
      nextHandle: 'default',
      outputPayload: { targetFlowId },
    };
  }
}

@Injectable()
export class ActionHumanHandoffHandler implements WorkflowNodeHandler {
  readonly type = ['action.human_handoff', 'human_transfer'];

  constructor(private readonly variableResolver: VariableResolverService) {}

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const department = context.node.config?.department || 'Geral';
    const rawClosing =
      context.node.config?.closingMessage ||
      context.node.config?.message ||
      'Transferindo seu atendimento para nossa equipe...';

    if (rawClosing && context.outboxMessage) {
      const closingMessage = this.variableResolver.interpolate(rawClosing, context.variables);
      await context.outboxMessage('text', context.variables.contact.phone, {
        text: closingMessage,
      });
    }

    return {
      success: true,
      statusTransition: ExecutionStatus.HUMAN_HANDOFF,
      outputPayload: { department },
    };
  }
}

@Injectable()
export class ActionEndHandler implements WorkflowNodeHandler {
  readonly type = ['action.end', 'end_flow'];

  constructor(private readonly variableResolver: VariableResolverService) {}

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const rawFarewell = context.node.config?.farewellMessage;

    if (rawFarewell && context.outboxMessage) {
      const farewellMessage = this.variableResolver.interpolate(rawFarewell, context.variables);
      await context.outboxMessage('text', context.variables.contact.phone, {
        text: farewellMessage,
      });
    }

    return {
      success: true,
      statusTransition: ExecutionStatus.COMPLETED,
      outputPayload: { finishedAt: new Date() },
    };
  }
}

@Injectable()
export class ActionSetVariableHandler implements WorkflowNodeHandler {
  readonly type = ['set_variable', 'data.set_variable'];

  constructor(private readonly variableResolver: VariableResolverService) {}

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const varName = context.node.config?.variableName;
    const op = context.node.config?.operation || 'set';
    const rawExpression = context.node.config?.expression;

    let computedValue: any = null;
    if (op === 'clear') {
      computedValue = null;
    } else {
      computedValue = typeof rawExpression === 'string'
        ? this.variableResolver.interpolate(rawExpression, context.variables)
        : rawExpression;
    }

    return {
      success: true,
      nextHandle: 'default',
      variableUpdates: {
        [varName]: computedValue,
      },
      outputPayload: { variable: varName, value: computedValue, operation: op },
    };
  }
}
