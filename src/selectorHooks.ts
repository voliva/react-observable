import { useEffect, useMemo, useReducer, useState } from "react";
import { Action, createActionCreator } from "./actions";
import { useReactObservable } from "./context";
import { ImmediateObservable, usePropsObservable } from "./lib";
import { ParametricSelector, ReadSelectorFnType, Selector } from "./selectors";
import { BaseSelector, Store } from "./store";

export function useSelector<T>(
  selector: Selector<T> | ParametricSelector<undefined | {}, T>
): T;
export function useSelector<P, T>(
  selector: ParametricSelector<P, T>,
  props: P
): T;
export function useSelector<P, T>(
  selector: Selector<T> | ParametricSelector<P, T>,
  props?: P
): T {
  const { readSelector } = useReactObservable();
  const prop$ = usePropsObservable(props!);
  const state$ = useMemo(() => readSelector(selector, prop$), [
    selector,
    readSelector,
    prop$
  ]);
  const [state, setState] = useState<T>(() => state$.getValue());

  useEffect(() => {
    setState(state$.getValue());
    const subscription = state$.subscribe(setState);
    return () => subscription.unsubscribe();
  }, [state$]);

  return state;
}

export function useBranchingStateSelector<T>(
  selector: Selector<T> | ParametricSelector<undefined | {}, T>
): T;
export function useBranchingStateSelector<P, T>(
  selector: Selector<T> | ParametricSelector<P, T>,
  props: P
): T;
export function useBranchingStateSelector<P, T>(
  selector: Selector<T> | ParametricSelector<P, T>,
  props?: P
): T {
  const { readSelector: ctxReadSelector, action$ } = useReactObservable();
  const prop$ = usePropsObservable(props!);

  const readSelector: ReadSelectorFnType = <P, T>(
    selector: Selector<T> | ParametricSelector<P, T> | BaseSelector<T>,
    prop$?: ImmediateObservable<P>
  ) => {
    const baseStream = selector({ prop$: prop$!, readSelector }); // It doesn't really matter - In here we're just getting immediate values

    if ("store" in selector) {
      if (!reactState.has(selector.store)) {
        const value = ctxReadSelector(selector).getValue();

        reactDispatch(registerLocalStore(selector.store, value));
        return Object.assign(baseStream, {
          getValue: () => value
        });
      }
      return Object.assign(baseStream, {
        getValue: () => reactState.get(selector.store)
      });
    }
    return baseStream;
  };

  const [reactState, reactDispatch] = useReducer(
    (state: Map<Store, any>, action: Action) => {
      let hasChanged = false;

      const newState = new Map<Store, any>();
      if (registerLocalStore.isCreatorOf(action)) {
        hasChanged = true;
        newState.set(action.store, action.value);
      }
      for (let store of state.keys()) {
        const subState = state.get(store);
        const newSubState = store.reducerFn(subState, action, readSelector);
        hasChanged = hasChanged || subState !== newSubState;
        newState.set(store, newSubState);
      }
      return hasChanged ? newState : state;
    },
    new Map<Store, any>()
  );

  useEffect(() => {
    const subscription = action$.subscribe(reactDispatch);
    return () => subscription.unsubscribe();
  }, [action$]);

  return readSelector(selector, prop$).getValue();
}

const registerLocalStore = createActionCreator(
  "register local store",
  (store: Store, value: any) => ({ store, value })
);
