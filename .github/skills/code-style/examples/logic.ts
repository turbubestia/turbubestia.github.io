export interface LogicState {
  target: number;
  attempts: number;
  status: 'active' | 'complete';
}

export type LogicAction =
  | { type: 'submit'; value: number }
  | { type: 'restart' };

export function createInitialLogicState(): LogicState {
  return { target: 7, attempts: 0, status: 'active' };
}

export function logicReducer(state: LogicState, action: LogicAction): LogicState {
  if (action.type === 'restart') return createInitialLogicState();
  if (state.status === 'complete') return state;

  return {
    ...state,
    attempts: state.attempts + 1,
    status: action.value === state.target ? 'complete' : 'active',
  };
}