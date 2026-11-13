import { Injectable } from '@nestjs/common';
import { WorkflowNodeHandler } from './node-handler.interface';
import { NodeExecutionContext, NodeResult } from '../types/execution.types';

@Injectable()
export class TriggerMessageHandler implements WorkflowNodeHandler {
  readonly type = ['trigger.message_received', 'trigger.keyword', 'trigger'];

  async execute(context: NodeExecutionContext): Promise<NodeResult> {
    // Nós de gatilho atuam como ponto de partida. A mensagem de entrada já ativou o fluxo.
    return {
      success: true,
      nextHandle: 'default',
      outputPayload: {
        triggeredAt: new Date(),
        incomingInteraction: context.incomingInteraction,
      },
    };
  }
}
