import React, { useTransition } from 'react';
import { createStore, Provider, useSelector, useAction, createActionCreator, createSelector, useBranchingStateSelector } from '@voliva/react-observable';

import {
  syncBlock,
  useRegisterIncrementDispatcher,
  ids,
  useCheckTearing,
  shallowEqual,
} from '../common';

const increment = createActionCreator('increment');
const reducer = (state, action) => {
  if (increment.isCreatorOf(action)) {
    return {
      ...state,
      dummy: state.dummy + 1,
      // only update once in two
      count: state.dummy % 2 === 1 ? state.count + 1 : state.count,
    };
  }
  return state;
};
const [baseSelector, store] = createStore({
  count: 0,
  dummy: 0,
}, reducer);

const getCount = createSelector([baseSelector], base => base.count);

// const CounterWrapper = () => {
//   const count = useBranchingStateSelector(getCount);
//   return <Counter count={count} />
// }

const Counter = React.memo(() => {
  const count = useBranchingStateSelector(getCount);
  syncBlock();
  return <div className="count">{count}</div>;
}, shallowEqual);

const Main = () => {
  const dispatchIncrement = useAction(increment);
  const count = useBranchingStateSelector(getCount);
  useCheckTearing();
  useRegisterIncrementDispatcher(React.useCallback(() => {
    dispatchIncrement();
  }, [dispatchIncrement]));
  const [localCount, localIncrement] = React.useReducer((c) => c + 1, 0);
  const normalIncrement = () => {
    dispatchIncrement();
  };
  const [startTransition, isPending] = useTransition();
  const transitionIncrement = () => {
    startTransition(() => {
      dispatchIncrement();
    });
  };
  return (
    <div>
      <button type="button" id="normalIncrement" onClick={normalIncrement}>Increment shared count normally (two clicks to increment one)</button>
      <button type="button" id="transitionIncrement" onClick={transitionIncrement}>Increment shared count in transition (two clicks to increment one)</button>
      <span id="pending">{isPending && 'Pending...'}</span>
      <h1>Shared Count</h1>
      {ids.map((id) => <Counter key={id} />)}
      <div className="count">{count}</div>
      <h1>Local Count</h1>
      {localCount}
      <button type="button" id="localIncrement" onClick={localIncrement}>Increment local count</button>
    </div>
  );
};

const App = () => (
  <Provider>
    <Main />
  </Provider>
);

export default App;
