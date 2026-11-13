import { NodeExecutionContext, NodeResult } from '../types/execution.types';

export interface WorkflowNodeHandler {
  /**
   * Tipo ou lista de identificadores de nós suportados pelo handler
   */
  readonly type: string | string[];

  /**
   * Executa a lógica de negócio do nó
   */
  execute(context: NodeExecutionContext): Promise<NodeResult>;
}
