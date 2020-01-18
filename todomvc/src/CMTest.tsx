import React from "react";
import {
  createStore,
  createActionCreator,
  useSelector,
  useAction,
  Provider
} from "./react-observable";
import { Subject } from "rxjs";
import { map } from "rxjs/operators";

const increment = createActionCreator("increment");
const [getCounter, counterStore] = createStore(
  0,
  (state, action) => {
    if (increment.isCreatorOf(action)) {
      return state + 1;
    }
    return state;
  },
  () => {
    const actionSubject = new Subject();
    (window as any).increment = () => actionSubject.next();
    return actionSubject.pipe(map(increment));
  }
);

export function CMTest() {
  return (
    <Provider store={counterStore}>
      <App />
    </Provider>
  );
}

const suspenseContinueListeners = new Set();
const suspenseFailListeners = new Set();
const promise = {
  then(suspenseContinue: any, suspenseFail: any) {
    suspenseContinueListeners.add(suspenseContinue);
    suspenseFailListeners.add(suspenseFail);
  }
};

const notifySuspense = () => {
  suspenseContinueListeners.forEach((l: any) => l());
  suspenseFailListeners.forEach((l: any) => l());
  suspenseContinueListeners.clear();
  suspenseFailListeners.clear();
};

const Counter = ({ interrupt }: { interrupt: boolean }) => {
  const value = useSelector(getCounter);

  if (interrupt) throw promise;

  return <div>{value}</div>;
};

function App() {
  const [interrupt, setInterrupt] = React.useState(false);
  const [t, isPending] = (React as any).useTransition({ timeoutMs: 60e3 });
  const handleIncrement = useAction(increment);

  const startSuspense = React.useCallback(() => t(() => setInterrupt(true)), [
    t
  ]);
  const stopSuspense = React.useCallback(
    () =>
      t(() => {
        setInterrupt(false);
        notifySuspense();
      }),
    [t]
  );

  return (
    <div className="App">
      <h1>IsPending: {isPending.toString()}</h1>
      <button onClick={startSuspense} disabled={isPending}>
        Start Suspense
      </button>
      <button onClick={stopSuspense} disabled={!isPending}>
        Stop Suspense
      </button>
      <button onClick={() => t(handleIncrement)}>
        Increment with transition
      </button>
      <button onClick={handleIncrement}>Increment without transition</button>
      <React.Suspense fallback="Waiting...">
        <Counter interrupt={interrupt} />
      </React.Suspense>
    </div>
  );
}
