import { BehaviorSubject, EMPTY, Observable, Subject } from "rxjs";
import { Action, createActionCreator } from "./actions";
import { ReadSelectorFnType, Selector } from "./selectors";
import { useReactObservable } from "./context";
import { useEffect } from "react";

export type BaseSelector<T> = Selector<T> & {
  store: Store;
};

export interface StoreRef {
  updateState: (action: Action) => () => void;
  runEffect: (action: Action) => void;
  disconnect: () => void;
}

export interface Store<T = any> {
  connect: (
    dispatch: (action: Action) => void,
    readSelector: ReadSelectorFnType
  ) => StoreRef;
  reducerFn: (state: T, action: Action, readSelector: ReadSelectorFnType) => T;
}

export function createStore<T>(
  initialState: T,
  reducerFn: (state: T, action: Action, readSelector: ReadSelectorFnType) => T,
  effectFn: (
    action$: Observable<Action>,
    readSelector: ReadSelectorFnType
  ) => Observable<Action> = () => EMPTY
) {
  const stateSubject = new BehaviorSubject(initialState);

  const store: Store<T> = {
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
      const effectSubscription = effectFn(action$, readSelector).subscribe(
        dispatch
      );
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
    reducerFn
  };

  const stateSelector: BaseSelector<T> = Object.assign(() => stateSubject, {
    store
  });

  return [stateSelector, store] as [typeof stateSelector, Store];
}

export const storeConnected = createActionCreator(
  "store connected",
  (store: Store) => ({ store })
);
