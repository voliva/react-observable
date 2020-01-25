import { BehaviorSubject, merge, Observable, Subject } from "rxjs";
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

export type Epic = (
  action$: Observable<Action>,
  readSelector: ReadSelectorFnType
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
        ...epics.map(epic => epic(action$, readSelector))
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
