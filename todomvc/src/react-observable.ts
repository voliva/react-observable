import {
  createContext,
  createElement,
  FC,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState
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
type BaseSelector<T> = Selector<T> & {
  initialState: T;
  reducerFn: (state: T, action: Action, readSelector: ReadSelector) => T;
};

type ParametricSelector<P, T> = (
  prop$: ImmediateObservable<P>,
  readSelector?: ReadSelector
) => ImmediateObservable<T>;

type ReadSelector = <P, T>(
  selector: Selector<T> | ParametricSelector<P, T>,
  prop$: ImmediateObservable<P>
) => ImmediateObservable<T>;

interface Store<T = any> {
  connect: (
    action$: Observable<Action>,
    dispatch: (action: Action) => void,
    readSelector: ReadSelector
  ) => () => void;
  baseSelectors: BaseSelector<T>[];
}

export function createStore<T>(
  initialState: T,
  reducerFn: (state: T, action: Action, readSelector: ReadSelector) => T,
  effectFn: (
    action$: Observable<Action>,
    readSelector: ReadSelector
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
    baseSelectors: stores.reduce<BaseSelector<any>[]>(
      (selectors, store) => selectors.concat(store.baseSelectors),
      []
    )
  };
}

interface ReactObservableContext {
  dispatch: (action: Action) => void;
  readSelector: ReadSelector;
  baseSelectors: BaseSelector<any>[];
  action$: Observable<Action>;
}
const ctx = createContext<ReactObservableContext | undefined>(undefined);
export const Provider: FC<{
  store: Store;
}> = ({ store, children }) => {
  const { baseSelectors } = store;
  const [action$, dispatch] = useMemo(() => {
    const subject = new Subject<Action>();
    const action$ = subject.asObservable();
    const dispatch = subject.next.bind(subject);
    return [action$, dispatch] as [typeof action$, typeof dispatch];
  }, []);

  const selectorSubjects = useMemo(() => {
    const map = new WeakMap<Selector<any>, ImmediateObservable<any>>();
    baseSelectors.forEach(selector => map.set(selector, selector()));
    return map;
  }, []);

  const readSelector: ReadSelector = (selector, prop$) => {
    if (!baseSelectors.includes(selector as any)) {
      return (selector as any)(prop$, readSelector);
    }
    return selectorSubjects.get(selector as any)!;
  };

  const value = useMemo(
    () => ({
      dispatch,
      readSelector,
      baseSelectors,
      action$
    }),
    []
  );

  useEffect(() => store.connect(action$, dispatch, readSelector), []);

  return createElement(
    ctx.Provider,
    {
      value
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
  const { readSelector: ctxReadSelector, baseSelectors, action$ } = useContext(
    ctx
  )!;
  const prop$ = usePropsObservable(props!);

  const readSelector: ReadSelector = (selector, prop$) => {
    if (!baseSelectors.includes(selector as any)) {
      return (selector as any)(prop$, readSelector);
    }
    return Object.assign((selector as any)(EMPTY, readSelector), {
      getValue: () => reactState.get(selector as any)!
    });
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
