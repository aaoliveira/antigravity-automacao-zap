import { Injectable } from '@nestjs/common';
import { WorkflowNodeHandler } from './node-handler.interface';
import { NodeExecutionContext, NodeResult } from '../types/execution.types';
import { ConditionEvaluatorService } from '../conditions/condition-evaluator.service';
import { VariableResolverService } from '../variables/variable-resolver.service';
import { ExecutionStatus } from '@prisma/client';

@Injectable()
export class LogicConditionHandler implements WorkflowNodeHandler {
  readonly type = ['logic.condition', 'condition'];

  constructor(private readonly conditionEvaluator: ConditionEvaluatorService) {}

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const rules = context.node.config?.rules || [];
    const logicalOperator = context.node.config?.logicalOperator || 'AND';

    const isTrue = this.conditionEvaluator.evaluate(
      { logicalOperator, rules },
      context.variables,
    );

    const nextHandle = isTrue ? 'true' : 'false';

    return {
      success: true,
      nextHandle,
      outputPayload: { conditionResult: isTrue, nextHandle },
    };
  }
}

@Injectable()
export class LogicSwitchHandler implements WorkflowNodeHandler {
  readonly type = ['logic.switch', 'switch'];

  constructor(private readonly variableResolver: VariableResolverService) {}

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const variableName = context.node.config?.variable;
    const cases = context.node.config?.cases || [];

    const actualValue = this.variableResolver.resolvePath(variableName, context.variables);
    const actualStr = String(actualValue ?? '').trim().toLowerCase();

    const matchedCase = cases.find(
      (c: any) => String(c.value ?? '').trim().toLowerCase() === actualStr,
    );

    const nextHandle = matchedCase ? matchedCase.id : 'default';

    return {
      success: true,
      nextHandle,
      outputPayload: {
        evaluatedVariable: variableName,
        actualValue,
        matchedCaseId: matchedCase?.id || null,
        nextHandle,
      },
    };
  }
}

@Injectable()
export class LogicDelayHandler implements WorkflowNodeHandler {
  readonly type = ['logic.delay', 'delay'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    const durationSeconds = Number(context.node.config?.durationSeconds || 1);

    return {
      success: true,
      waitingForDelaySeconds: durationSeconds,
      statusTransition: ExecutionStatus.WAITING_FOR_DELAY,
      outputPayload: { durationSeconds },
    };
  }
}

@Injectable()
export class LogicWaitForInputHandler implements WorkflowNodeHandler {
  readonly type = ['logic.wait_for_input', 'wait_reply'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    // Se retomado
    if (context.incomingInteraction) {
      if (context.incomingInteraction.type === 'timeout') {
        return {
          success: true,
          nextHandle: 'timeout',
          outputPayload: { reason: 'timeout_expired' },
        };
      }

      return {
        success: true,
        nextHandle: 'reply',
        outputPayload: {
          receivedValue: context.incomingInteraction.value,
        },
      };
    }

    // Pausa inicial
    return {
      success: true,
      waitingForInput: true,
      statusTransition: ExecutionStatus.WAITING_FOR_INPUT,
      outputPayload: { timeoutMinutes: context.node.config?.timeoutMinutes || 30 },
    };
  }
}
