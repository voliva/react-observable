import { BehaviorSubject, merge, Observable, Subject, zip } from "rxjs";
import { first, map, switchMap } from "rxjs/operators";
import { Action, createActionCreator } from "./actions";
import { ReadSelectorFnType, Selector } from "./selectors";

export type BaseSelector<T> = Selector<T> & {
  store: Store;
};

export interface StoreRef {
  updateState: (action: Action) => () => void;
  runEffect: (action: Action) => void;
  disconnect: () => void;
}

export interface WithSelectorValues {
  <R1>(selectors: [Selector<R1>]): <T>(
    stream: Observable<T>
  ) => Observable<[T, [R1]]>;
  <R1, R2>(selectors: [Selector<R1>, Selector<R2>]): <T>(
    stream: Observable<T>
  ) => Observable<[T, [R1, R2]]>;
  <R1, R2, R3>(selectors: [Selector<R1>, Selector<R2>, Selector<R3>]): <T>(
    stream: Observable<T>
  ) => Observable<[T, [R1, R2, R3]]>;
  (selectors: Array<Selector<any>>): <T>(
    stream: Observable<T>
  ) => Observable<[T, any[]]>;

  <R1, T>(selectorFn: (value: T) => [Selector<R1>]): (
    stream: Observable<T>
  ) => Observable<[T, [R1]]>;
  <R1, R2, T>(selectorFn: (value: T) => [Selector<R1>, Selector<R2>]): (
    stream: Observable<T>
  ) => Observable<[T, [R1, R2]]>;
  <R1, R2, R3, T>(
    selectorFn: (value: T) => [Selector<R1>, Selector<R2>, Selector<R3>]
  ): (stream: Observable<T>) => Observable<[T, [R1, R2, R3]]>;
  <T>(selectorFn: (value: T) => Array<Selector<any>>): (
    stream: Observable<T>
  ) => Observable<[T, any[]]>;
}
const createWithSelectorValues = (
  readSelector: ReadSelectorFnType
): WithSelectorValues => {
  return (
    selectorFn: Array<Selector<any>> | ((value: any) => Array<Selector<any>>)
  ) => (stream: Observable<any>) =>
    stream.pipe(
      switchMap(value => {
        const selectors = Array.isArray(selectorFn)
          ? selectorFn
          : selectorFn(value);
        const readSelectors = selectors.map(selector =>
          readSelector(selector).pipe(first())
        );
        return zip(readSelectors).pipe(map(result => [value, result]));
      })
    ) as any;
};

export type Epic = (
  action$: Observable<Action>,
  props: {
    readSelector: ReadSelectorFnType;
    withSelectorValues: WithSelectorValues;
  }
) => Observable<Action>;

export interface Store {
  connect: (
    dispatch: (action: Action) => void,
    readSelector: ReadSelectorFnType
  ) => StoreRef;
  reducerFn: (
    state: any,
    action: Action,
    readSelector: ReadSelectorFnType
  ) => any;
  addEpic: (epic: Epic) => void;
}

export function createStore<T>(
  initialState: T,
  reducerFn: (state: T, action: Action, readSelector: ReadSelectorFnType) => T
) {
  const stateSubject = new BehaviorSubject(initialState);
  const epics: Epic[] = [];

  const store: Store = {
    connect: (dispatch, readSelector) => {
      const updateState = (action: Action) => {
        const oldState = stateSubject.getValue();
        const newState = reducerFn(oldState, action, readSelector);
        return () => {
          if (oldState !== newState) {
            stateSubject.next(newState);
          }
        };
      };

      const action$ = new Subject<Action>();
      const effectSubscription = merge(
        ...epics.map(epic =>
          epic(action$, {
            readSelector,
            withSelectorValues: createWithSelectorValues(readSelector)
          })
        )
      ).subscribe(dispatch);
      const runEffect = (action: Action) => {
        action$.next(action);
      };

      const disconnect = () => {
        effectSubscription.unsubscribe();
        action$.unsubscribe();
        stateSubject.unsubscribe();
      };

      dispatch(storeConnected(store));

      return {
        updateState,
        runEffect,
        disconnect
      };
    },
    addEpic: epic => epics.push(epic),
    reducerFn
  };

  const stateSelector: BaseSelector<T> = Object.assign(() => stateSubject, {
    store
  });

  return [stateSelector, store] as [typeof stateSelector, Store];
}

export function createStatelessStore() {
  return createStore(void 0, state => state)[1];
}

export const storeConnected = createActionCreator(
  "store connected",
  (store: Store) => ({ store })
);
