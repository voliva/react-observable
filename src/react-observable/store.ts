import { Observable, EMPTY, BehaviorSubject } from "rxjs";
import { Action } from "./actions";
import { ReadSelectorFnType, BaseSelector } from "./selectors";
import { scan, distinctUntilChanged } from "rxjs/operators";

export interface Store<T = any> {
  connect: (
    action$: Observable<Action>,
    dispatch: (action: Action) => void,
    readSelector: ReadSelectorFnType
  ) => () => void;
  baseSelectors: BaseSelector<T>[];
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
  const stateSelector: BaseSelector<T> = Object.assign(() => stateSubject, {
    initialState,
    reducerFn
  });

  const store: Store<T> = {
    connect: (action$, dispatch, readSelector) => {
      const stateSubscription = action$
        .pipe(
          scan(
            (state, action) => reducerFn(state, action, readSelector),
            initialState
          ),
          distinctUntilChanged()
        )
        .subscribe(stateSubject);
      const effectSubscription = effectFn(action$, readSelector).subscribe(
        dispatch
      );
      return () => {
        stateSubscription.unsubscribe();
        effectSubscription.unsubscribe();
      };
    },
    baseSelectors: [stateSelector]
  };

  return [stateSelector, store] as [typeof stateSelector, Store<T>];
}

export function combineStores(stores: Store[]): Store {
  return {
    connect: (action$, dispatch, readSelector) => {
      const unsubs = stores.map(store =>
        store.connect(action$, dispatch, readSelector)
      );
      return () => unsubs.forEach(fn => fn());
    },
    baseSelectors: stores.reduce<BaseSelector<any>[]>(
      (selectors, store) => selectors.concat(store.baseSelectors),
      []
    )
  };
}
