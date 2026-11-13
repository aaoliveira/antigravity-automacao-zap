import { ExecutionStatus } from '@prisma/client';

export class InvalidStateTransitionException extends Error {
  constructor(public readonly from: ExecutionStatus, public readonly to: ExecutionStatus) {
    super(`Transição de estado inválida para o fluxo de execução: de ${from} para ${to}.`);
    this.name = 'InvalidStateTransitionException';
  }
}

export class ExecutionStateMachine {
  private static readonly VALID_TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
    [ExecutionStatus.PENDING]: [
      ExecutionStatus.RUNNING,
      ExecutionStatus.CANCELLED,
    ],
    [ExecutionStatus.RUNNING]: [
      ExecutionStatus.WAITING_FOR_INPUT,
      ExecutionStatus.WAITING_FOR_DELAY,
      ExecutionStatus.PAUSED,
      ExecutionStatus.COMPLETED,
      ExecutionStatus.FAILED,
      ExecutionStatus.CANCELLED,
      ExecutionStatus.HUMAN_HANDOFF,
      // Legado
      ExecutionStatus.WAITING_INPUT,
      ExecutionStatus.WAITING_DELAY,
      ExecutionStatus.HANDOVER_HUMAN,
    ],
    [ExecutionStatus.WAITING_FOR_INPUT]: [
      ExecutionStatus.RUNNING,
      ExecutionStatus.FAILED,
      ExecutionStatus.CANCELLED,
      ExecutionStatus.HUMAN_HANDOFF,
      ExecutionStatus.PAUSED,
      ExecutionStatus.COMPLETED,
    ],
    [ExecutionStatus.WAITING_FOR_DELAY]: [
      ExecutionStatus.RUNNING,
      ExecutionStatus.FAILED,
      ExecutionStatus.CANCELLED,
      ExecutionStatus.PAUSED,
      ExecutionStatus.COMPLETED,
    ],
    [ExecutionStatus.PAUSED]: [
      ExecutionStatus.RUNNING,
      ExecutionStatus.CANCELLED,
    ],
    [ExecutionStatus.HUMAN_HANDOFF]: [
      ExecutionStatus.COMPLETED,
      ExecutionStatus.CANCELLED,
      ExecutionStatus.RUNNING,
    ],
    [ExecutionStatus.COMPLETED]: [], // Estado terminal
    [ExecutionStatus.FAILED]: [],    // Estado terminal
    [ExecutionStatus.CANCELLED]: [], // Estado terminal

    // Legado
    [ExecutionStatus.WAITING_INPUT]: [ExecutionStatus.RUNNING, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED],
    [ExecutionStatus.WAITING_DELAY]: [ExecutionStatus.RUNNING, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED],
    [ExecutionStatus.HANDOVER_HUMAN]: [ExecutionStatus.COMPLETED, ExecutionStatus.CANCELLED],
  };

  /**
   * Valida se a transição entre dois estados é permitida
   */
  static validateTransition(from: ExecutionStatus, to: ExecutionStatus): void {
    if (from === to) {
      return; // Mesma transição é permitida como no-op
    }

    const allowed = this.VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new InvalidStateTransitionException(from, to);
    }
  }

  /**
   * Informa se um estado é terminal (não aceita novas transições)
   */
  static isTerminal(status: ExecutionStatus): boolean {
    const terminalStatuses: ExecutionStatus[] = [
      ExecutionStatus.COMPLETED,
      ExecutionStatus.FAILED,
      ExecutionStatus.CANCELLED,
    ];
    return terminalStatuses.includes(status);
  }

  /**
   * Informa se a execução está bloqueada aguardando evento externo
   */
  static isWaiting(status: ExecutionStatus): boolean {
    return (
      status === ExecutionStatus.WAITING_FOR_INPUT ||
      status === ExecutionStatus.WAITING_INPUT ||
      status === ExecutionStatus.WAITING_FOR_DELAY ||
      status === ExecutionStatus.WAITING_DELAY
    );
  }
}
