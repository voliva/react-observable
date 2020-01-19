import { useContext, useEffect, useMemo, useReducer, useState } from "react";
import { BehaviorSubject, EMPTY } from "rxjs";
import { Action, ActionCreator } from "./actions";
import { useReactObservable } from "./context";
import { ImmediateObservable } from "./observables";
import { ParametricSelector, Selector, ReadSelectorFnType } from "./selectors";
import { usePropsObservable } from "./lib";

export const useAction = <TArg extends Array<any>, TAction extends Action>(
  actionCreator: ActionCreator<TArg, TAction>
) => {
  const { dispatch } = useReactObservable();
  return (...args: TArg) => dispatch(actionCreator(...args));
};

export function useSelector<T>(
  selector: Selector<T> | ParametricSelector<undefined | {}, T>
): T;
export function useSelector<P, T>(
  selector: Selector<T> | ParametricSelector<P, T>,
  props: P
): T;
export function useSelector<P, T>(
  selector: Selector<T> | ParametricSelector<P, T>,
  props?: P
): T {
  const { readSelector } = useReactObservable();
  const prop$ = usePropsObservable(props!);
  const state$ = useMemo(() => readSelector(selector, prop$), [selector]);
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
  const {
    readSelector: ctxReadSelector,
    baseSelectors,
    action$
  } = useReactObservable();
  const prop$ = usePropsObservable(props!);

  const readSelector: ReadSelectorFnType = <P, T>(
    selector: Selector<T> | ParametricSelector<P, T>,
    prop$?: ImmediateObservable<P>
  ) => {
    if (!baseSelectors.includes(selector as any)) {
      return selector({ prop$: prop$!, readSelector });
    }
    return Object.assign(
      selector({
        prop$: EMPTY as any,
        readSelector
      }),
      {
        getValue: () => reactState.get(selector as any)
      }
    );
  };

  const [reactState, reactDispatch] = useReducer(
    (state: WeakMap<Selector<any>, any>, action: Action) => {
      const newState = new WeakMap<Selector<any>, any>();
      baseSelectors.forEach(selector => {
        const subState = state.get(selector);
        const newSubState = selector.reducerFn(subState, action, readSelector);
        newState.set(selector, newSubState);
      });
      return newState;
    },
    new WeakMap<Selector<any>, any>(),
    state => {
      baseSelectors.forEach(selector =>
        state.set(selector, ctxReadSelector(selector, EMPTY as any).getValue())
      );
      return state;
    }
  );

  useEffect(() => {
    const subscription = action$.subscribe(reactDispatch);
    return () => subscription.unsubscribe();
  }, [action$]);

  return readSelector(selector, prop$).getValue();
}
