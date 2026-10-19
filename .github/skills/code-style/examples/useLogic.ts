import { useReducer } from 'react';
import { createInitialLogicState, logicReducer } from './logic';

export function useLogic() {
  const [state, dispatch] = useReducer(logicReducer, undefined, createInitialLogicState);

  return {
    state,
    submit(value: number) {
      dispatch({ type: 'submit', value });
    },
    restart() {
      dispatch({ type: 'restart' });
    },
  };
}