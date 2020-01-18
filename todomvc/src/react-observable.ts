import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  FC,
  createElement,
  useMemo
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

type Store = (
  action$: Observable<Action>,
  dispatch: (action: Action) => void
) => () => void;

type ImmediateObservable<T> = Observable<T> & {
  getValue: () => T;
};
type Selector<T> = () => ImmediateObservable<T>;
type ParametricSelector<P, T> = (
  prop$: ImmediateObservable<P>
) => ImmediateObservable<T>;

export function createStore<T>(
  initialState: T,
  stateFn: (action$: Observable<Action>) => Observable<T>,
  effectFn: (action$: Observable<Action>) => Observable<Action> = () => EMPTY
) {
  const stateSubject = new BehaviorSubject(initialState);
  const store: Store = (action$, dispatch) => {
    const stateSubscription = stateFn(action$).subscribe(stateSubject);
    const effectSubscription = effectFn(action$).subscribe(dispatch);
    return () => {
      stateSubscription.unsubscribe();
      effectSubscription.unsubscribe();
    };
  };

  const stateObservable: ImmediateObservable<T> = Object.assign(
    stateSubject.asObservable(),
    {
      getValue: () => stateSubject.value
    }
  );
  const stateSelector: Selector<T> = () => stateObservable;

  return [stateSelector, store] as [typeof stateSelector, Store];
}

export function createReducerStore<T>(
  initialState: T,
  reducerFn: (state: T, action: Action) => T,
  effectFn?: (action$: Observable<Action>) => Observable<Action>
) {
  return createStore(
    initialState,
    action$ =>
      action$.pipe(scan(reducerFn, initialState), distinctUntilChanged()),
    effectFn
  );
}

// export function createSelector<T, R1>(
//     deps: [Selector<R1>],
//     computeFn: (dep1: R1) => T
// ): Selector<T>;
// export function createSelector<T, R1, R2>(
//     deps: [Selector<R1>, Selector<R2>],
//     computeFn: (dep1: R1, dep2: R2) => T
// ): Selector<T>;
export function createSelector<T, P1, R1>(
  deps: [ParametricSelector<P1, R1>],
  computeFn: (dep1: R1) => T
): ParametricSelector<P1, T>;
export function createSelector<T, P1, R1, P2, R2>(
  deps: [ParametricSelector<P1, R1>, ParametricSelector<P2, R2>],
  computeFn: (dep1: R1, dep2: R2) => T
): ParametricSelector<P1 & P2, T>;
export function createSelector<T>(
  deps: ParametricSelector<any, any>[],
  computeFn: (...args: any) => T
): ParametricSelector<any, T> {
  return prop$ => {
    const depStreams = deps.map(dep => dep(prop$));
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
  return (action$, dispatch) => {
    const unsubs = stores.map(store => store(action$, dispatch));
    return () => unsubs.forEach(fn => fn());
  };
}

interface ReactObservableContext {
  (action: Action): void;
}
const ctx = createContext<ReactObservableContext | undefined>(undefined);
export const Provider: FC<{
  store: Store;
}> = ({ store, children }) => {
  const actionSubject = new Subject<Action>();
  const dispatch = actionSubject.next.bind(actionSubject);
  store(actionSubject.asObservable(), dispatch);

  return createElement(
    ctx.Provider,
    {
      value: dispatch
    },
    children
  );
};
export const Consumer = ctx.Consumer;
export const useDispatch = () => useContext(ctx)!;
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
  selector: ParametricSelector<undefined | {}, T>
): T;
export function useSelector<P, T>(
  selector: ParametricSelector<P, T>,
  props: P
): T;
export function useSelector<P, T>(
  selector: ParametricSelector<P, T>,
  props?: P
): T {
  const prop$ = usePropsObservable(props!);
  const state$ = useMemo(() => selector(prop$), [selector]);

  const [state, setState] = useState<T>(() => state$.getValue());

  useEffect(() => {
    setState(state$.getValue());
    const subscription = state$.subscribe(setState);
    return () => subscription.unsubscribe();
  }, [state$]);

  return state;
}
