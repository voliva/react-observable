import {
  createContext,
  createElement,
  FC,
  useContext,
  useEffect,
  useRef
} from "react";
import { Observable, Subject } from "rxjs";
import { Action } from "./actions";
import { ImmediateObservable, useInstanceValue } from "./lib";
import {
  defaultReadSelector,
  ParametricSelector,
  ReadSelectorFnType,
  Selector
} from "./selectors";
import { BaseSelector, Store, StoreRef } from "./store";

interface ReactObservableContext {
  dispatch: (action: Action) => void;
  readSelector: ReadSelectorFnType;
  action$: Observable<Action>;
  registerStore: (store: Store) => void;
}

const ctx = createContext<ReactObservableContext | undefined>(undefined);
export const Consumer = ctx.Consumer;
export const useReactObservable = () => useContext(ctx)!;

export const useRegisterStores = (stores: Store[]) => {
  const { registerStore } = useReactObservable();

  useEffect(() => stores.forEach(registerStore), []);
};

export const Provider: FC<{
  stores?: Store[];
}> = ({ stores = [], children }) => {
  const [action$, dispatch] = useInstanceValue(() => {
    const subject = new Subject<Action>();
    const action$ = subject.asObservable();
    const dispatch = subject.next.bind(subject);
    return [action$, dispatch] as [typeof action$, typeof dispatch];
  });

  const connectedStores = useRef<Map<Store, StoreRef>>(new Map());

  const readSelector: ReadSelectorFnType = <P, T>(
    selector: Selector<T> | ParametricSelector<P, T> | BaseSelector<T>,
    prop$?: ImmediateObservable<P>
  ) => {
    if ("store" in selector && !connectedStores.current.has(selector.store)) {
      console.warn(
        // TODO Maybe throw instead?
        "selector tried to access a store not registered - Registering it.",
        selector,
        selector.store
      );
      registerStore(selector.store);
    }
    return selector({ prop$: prop$!, readSelector });
  };

  const registerStore = (store: Store) => {
    if (connectedStores.current.has(store)) {
      return;
    }
    connectedStores.current.set(store, store.connect(dispatch, readSelector));
  };

  const value = useInstanceValue<ReactObservableContext>(() => ({
    dispatch,
    readSelector,
    action$,
    registerStore
  }));

  useEffect(() => stores.forEach(registerStore), []);

  useEffect(() => {
    const actionSubscription = action$.subscribe(action => {
      const storeRefs = [...connectedStores.current.values()];
      const commitFns = storeRefs.map(ref => ref.updateState(action));
      commitFns.forEach(fn => fn());

      storeRefs.forEach(ref => ref.runEffect(action));
    });
    return () => actionSubscription.unsubscribe();
  }, []);

  // Close all stores when Provider is dismounted
  useEffect(
    () => () =>
      [...connectedStores.current.values()].forEach(ref => ref.disconnect()),
    []
  );

  return createElement(
    ctx.Provider,
    {
      value
    },
    children
  );
};
