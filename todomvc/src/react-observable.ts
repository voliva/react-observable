import {
  createContext,
  createElement,
  FC,
  useContext,
  useEffect,
  useMemo,
  useState,
  useReducer,
  useCallback
} from "react";
import {
  BehaviorSubject,
  combineLatest,
  EMPTY,
  Observable,
  Subject
} from "rxjs";
import { distinctUntilChanged, map, scan } from "rxjs/operators";

export interface Action {
  type: symbol;
}
type ArgumentTypes<T> = T extends (...args: infer U) => infer R ? U : never;
// type ReplaceReturnType<T, TNewReturn> = (...a: ArgumentTypes<T>) => TNewReturn;

type ActionCreator<T extends Array<any>, A extends Action> = ((
  ...args: T
) => A) & {
  actionType: symbol;
  isCreatorOf: (action: Action) => action is A;
};
export function createActionCreator<
  TS extends symbol,
  TFn extends (...args: any) => any
>(s: TS | string, fn?: TFn) {
  fn = fn || ((() => {}) as any);

  const type = typeof s === "string" ? Symbol(s) : s;

  type ThisAction = {
    type: symbol;
  } & ReturnType<TFn>;

  const actionCreator = (...args: ArgumentTypes<TFn>): ThisAction => ({
    type,
    ...fn!(...args)
  });

  const typeCheck = {
    actionType: type,
    isCreatorOf: (action: Action): action is ThisAction => {
      return action.type === type;
    }
  };

  const ret: ActionCreator<ArgumentTypes<TFn>, ThisAction> = Object.assign(
    actionCreator,
    typeCheck
  );
  return ret;
}

type ImmediateObservable<T> = Observable<T> & {
  getValue: () => T;
};
type Selector<T> = (
  prop$?: undefined,
  readSelector?: ReadSelector
) => ImmediateObservable<T>;

type ParametricSelector<P, T> = (
  prop$: ImmediateObservable<P>,
  readSelector?: ReadSelector
) => ImmediateObservable<T>;

type ReadSelector = <P, T>(
  selector: Selector<T> | ParametricSelector<P, T>,
  prop$: ImmediateObservable<P>
) => ImmediateObservable<T>;

type Store = {
  connect: (
    action$: Observable<Action>,
    dispatch: (action: Action) => void,
    readSelector: ReadSelector
  ) => () => void;
  baseSelectors: Selector<any>[];
};

export function createStore<T>(
  initialState: T,
  stateFn: (
    action$: Observable<Action>,
    readSelector: ReadSelector
  ) => Observable<T>,
  effectFn: (
    action$: Observable<Action>,
    readSelector: ReadSelector
  ) => Observable<Action> = () => EMPTY
) {
  const stateSubject = new BehaviorSubject(initialState);
  const stateSelector: Selector<T> = () => stateSubject;

  const store: Store = {
    connect: (action$, dispatch, readSelector) => {
      const stateSubscription = stateFn(action$, readSelector).subscribe(
        stateSubject
      );
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

  return [stateSelector, store] as [typeof stateSelector, Store];
}

export function createReducerStore<T>(
  initialState: T,
  reducerFn: (state: T, action: Action, readSelector: ReadSelector) => T,
  effectFn?: (
    action$: Observable<Action>,
    readSelector: ReadSelector
  ) => Observable<Action>
) {
  return createStore(
    initialState,
    (action$, readSelector) =>
      action$.pipe(
        scan(
          (state, action) => reducerFn(state, action, readSelector),
          initialState
        ),
        distinctUntilChanged()
      ),
    effectFn
  );
}

const defaultReadSelector: ReadSelector = (selector: any, prop$) =>
  selector(prop$);

export function createSelector<T, R1>(
  deps: [Selector<R1>],
  computeFn: (dep1: R1) => T
): Selector<T>;
export function createSelector<T, R1, R2>(
  deps: [Selector<R1>, Selector<R2>],
  computeFn: (dep1: R1, dep2: R2) => T
): Selector<T>;
export function createSelector<T, P1, R1>(
  deps: [ParametricSelector<P1, R1>],
  computeFn: (dep1: R1) => T
): ParametricSelector<P1, T>;
export function createSelector<T, P1, R1, P2, R2>(
  deps: [ParametricSelector<P1, R1>, ParametricSelector<P2, R2>],
  computeFn: (dep1: R1, dep2: R2) => T
): ParametricSelector<P1 & P2, T>;
export function createSelector<T>(
  deps: (Selector<any> | ParametricSelector<any, any>)[],
  computeFn: (...args: any) => T
): Selector<T> | ParametricSelector<any, T> {
  return (
    prop$: ImmediateObservable<any>,
    readSelector: ReadSelector = defaultReadSelector
  ) => {
    const depStreams = deps.map(dep => readSelector(dep, prop$));
    const stream = combineLatest(depStreams).pipe(
      map(deps => computeFn(...deps)),
      distinctUntilChanged()
    );

    return Object.assign(stream, {
      getValue: () => computeFn(...depStreams.map(dep => dep.getValue()))
    });
  };
}

export function createPropSelector<T, K extends string>(
  propName: K
): ParametricSelector<
  {
    [key in K]: T;
  },
  T
> {
  return prop$ => {
    const stream = prop$.pipe(
      map(props => props[propName]),
      distinctUntilChanged()
    );

    return Object.assign(stream, {
      getValue: () => prop$.getValue()[propName]
    });
  };
}

export function combineStores(stores: Store[]): Store {
  return {
    connect: (action$, dispatch, readSelector) => {
      const unsubs = stores.map(store =>
        store.connect(action$, dispatch, readSelector)
      );
      return () => unsubs.forEach(fn => fn());
    },
    baseSelectors: stores.reduce<Selector<any>[]>(
      (selectors, store) => selectors.concat(store.baseSelectors),
      []
    )
  };
}

interface ReactObservableContext {
  dispatch: (action: Action) => void;
  readSelector: ReadSelector;
}
const ctx = createContext<ReactObservableContext | undefined>(undefined);
export const Provider: FC<{
  store: Store;
}> = ({ store, children }) => {
  const selectorStates = useMemo(
    () =>
      store.baseSelectors.map(selector => ({
        selector,
        state$: selector()
      })),
    []
  );
  const actionSubject = useMemo(() => new Subject<Action>(), []);

  const [reactState, reactDispatch] = useReducer(
    () => {
      const newState = new WeakMap<Selector<any>, any>();
      selectorStates.forEach(({ selector, state$ }) =>
        newState.set(selector, state$.getValue())
      );
      return newState;
    },
    new WeakMap<Selector<any>, any>(),
    state => {
      selectorStates.forEach(({ selector, state$ }) =>
        state.set(selector, state$.getValue())
      );
      return state;
    }
  );

  const dispatch = useCallback(
    (action: Action) => {
      actionSubject.next(action);
      reactDispatch();
    },
    [actionSubject]
  );

  const selectorSubjects = useMemo(
    () => new WeakMap<Selector<any>, BehaviorSubject<any>>(),
    []
  );
  const readSelector: ReadSelector = (selector, prop$) => {
    const baseSelector = selectorStates.find(
      selectorState => selectorState.selector === selector
    );
    if (!baseSelector) {
      return (selector as any)(prop$, readSelector);
    }
    if (!selectorSubjects.has(selector as any)) {
      const subject = new BehaviorSubject(baseSelector.state$.getValue());
      selectorSubjects.set(selector as any, subject);
    }
    return selectorSubjects.get(selector as any);
  };

  useEffect(() => {
    store.connect(actionSubject.asObservable(), dispatch, readSelector);
  }, []);

  useEffect(() => {
    selectorStates.forEach(({ selector }) => {
      if (selectorSubjects.has(selector)) {
        selectorSubjects.get(selector)?.next(reactState.get(selector));
      }
    });
  }, [reactState]);

  return createElement(
    ctx.Provider,
    {
      value: {
        dispatch,
        readSelector
      }
    },
    children
  );
};
export const Consumer = ctx.Consumer;
export const useDispatch = () => useContext(ctx)!.dispatch;
export const useAction = <TArg extends Array<any>, TAction extends Action>(
  actionCreator: ActionCreator<TArg, TAction>
) => {
  const dispatch = useDispatch();
  return (...args: TArg) => dispatch(actionCreator(...args));
};

const usePropsObservable = <T>(props: T): ImmediateObservable<T> => {
  const propSubject = useMemo(() => new BehaviorSubject(props), []);

  useEffect(() => {
    propSubject.next(props);
  }, [props]);

  return propSubject;
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
  const { readSelector } = useContext(ctx)!;
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
