import { ExecutionStateMachine, InvalidStateTransitionException } from './execution-state-machine';
import { ExecutionStatus } from '@prisma/client';

describe('ExecutionStateMachine', () => {
  it('deve permitir transições válidas no ciclo de vida', () => {
    // PENDING -> RUNNING
    expect(() =>
      ExecutionStateMachine.validateTransition(ExecutionStatus.PENDING, ExecutionStatus.RUNNING),
    ).not.toThrow();

    // RUNNING -> WAITING_FOR_INPUT
    expect(() =>
      ExecutionStateMachine.validateTransition(ExecutionStatus.RUNNING, ExecutionStatus.WAITING_FOR_INPUT),
    ).not.toThrow();

    // WAITING_FOR_INPUT -> RUNNING
    expect(() =>
      ExecutionStateMachine.validateTransition(ExecutionStatus.WAITING_FOR_INPUT, ExecutionStatus.RUNNING),
    ).not.toThrow();

    // RUNNING -> WAITING_FOR_DELAY
    expect(() =>
      ExecutionStateMachine.validateTransition(ExecutionStatus.RUNNING, ExecutionStatus.WAITING_FOR_DELAY),
    ).not.toThrow();

    // RUNNING -> HUMAN_HANDOFF
    expect(() =>
      ExecutionStateMachine.validateTransition(ExecutionStatus.RUNNING, ExecutionStatus.HUMAN_HANDOFF),
    ).not.toThrow();

    // RUNNING -> COMPLETED
    expect(() =>
      ExecutionStateMachine.validateTransition(ExecutionStatus.RUNNING, ExecutionStatus.COMPLETED),
    ).not.toThrow();

    // RUNNING -> FAILED
    expect(() =>
      ExecutionStateMachine.validateTransition(ExecutionStatus.RUNNING, ExecutionStatus.FAILED),
    ).not.toThrow();
  });

  it('deve proibir transições inválidas a partir de estados terminais', () => {
    // COMPLETED -> RUNNING (Inválido!)
    expect(() =>
      ExecutionStateMachine.validateTransition(ExecutionStatus.COMPLETED, ExecutionStatus.RUNNING),
    ).toThrow(InvalidStateTransitionException);

    // FAILED -> WAITING_FOR_INPUT (Inválido!)
    expect(() =>
      ExecutionStateMachine.validateTransition(ExecutionStatus.FAILED, ExecutionStatus.WAITING_FOR_INPUT),
    ).toThrow(InvalidStateTransitionException);

    // CANCELLED -> RUNNING (Inválido!)
    expect(() =>
      ExecutionStateMachine.validateTransition(ExecutionStatus.CANCELLED, ExecutionStatus.RUNNING),
    ).toThrow(InvalidStateTransitionException);
  });

  it('deve proibir transição direta de PENDING para COMPLETED sem execução', () => {
    expect(() =>
      ExecutionStateMachine.validateTransition(ExecutionStatus.PENDING, ExecutionStatus.COMPLETED),
    ).toThrow(InvalidStateTransitionException);
  });

  it('deve identificar corretamente estados terminais e de espera', () => {
    expect(ExecutionStateMachine.isTerminal(ExecutionStatus.COMPLETED)).toBe(true);
    expect(ExecutionStateMachine.isTerminal(ExecutionStatus.FAILED)).toBe(true);
    expect(ExecutionStateMachine.isTerminal(ExecutionStatus.CANCELLED)).toBe(true);
    expect(ExecutionStateMachine.isTerminal(ExecutionStatus.RUNNING)).toBe(false);

    expect(ExecutionStateMachine.isWaiting(ExecutionStatus.WAITING_FOR_INPUT)).toBe(true);
    expect(ExecutionStateMachine.isWaiting(ExecutionStatus.WAITING_FOR_DELAY)).toBe(true);
    expect(ExecutionStateMachine.isWaiting(ExecutionStatus.RUNNING)).toBe(false);
  });
});
