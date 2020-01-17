import { Observable, Subject, ReplaySubject, BehaviorSubject, combineLatest, EMPTY } from "rxjs";
import { scan, distinctUntilChanged, map } from 'rxjs/operators';
import { createContext, useContext, useState, useEffect, useRef } from "react";

export interface Action {
    type: symbol;
}
type ArgumentTypes<T> = T extends (... args: infer U ) => infer R ? U: never;
// type ReplaceReturnType<T, TNewReturn> = (...a: ArgumentTypes<T>) => TNewReturn;

export function createActionCreator<
    TS extends symbol,
    TFn extends (...args: any) => any
>(
    s: TS,
    fn: TFn
) {
    type ThisAction = {
        type: TS
    } & ReturnType<TFn>;

    const actionCreator = (...args: ArgumentTypes<TFn>): ThisAction => ({
        type: s,
        ...fn(...args)
    });

    const typeCheck = {
        isAction: (action: Action): action is ThisAction => {
            return action.type === s
        }
    }

    return Object.assign(
        actionCreator,
        typeCheck
    );
}

type Store = (
    action$: Observable<Action>,
    dispatch: (action: Action) => void
) => () => void;

type ImmediateObservable<T> = Observable<T> & {
    getValue: () => T
};
type Selector<T> = () => ImmediateObservable<T>;
type ParametricSelector<P, T> = (prop$: ImmediateObservable<P>) => ImmediateObservable<T>;

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
        }
    }

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
        action$ => action$.pipe(
            scan(reducerFn, initialState),
            distinctUntilChanged()
        ),
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
): ParametricSelector<P1  & P2, T>;
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

        return Object.assign(
            stream,
            {
                getValue: () => computeFn(
                    ...depStreams.map(dep => dep.getValue())
                )
            }
        );
    }
}

export function createPropSelector<T, K extends string>(
    propName: K
): ParametricSelector<{
    [key in K]: T
}, T> {
    return prop$ => {
        const stream = prop$.pipe(
            map(props => props[propName]),
            distinctUntilChanged()
        );

        return Object.assign(
            stream,
            {
                getValue: () => prop$.getValue()[propName]
            }
        )
    }
}

export function combineStores(stores: Store[]): Store {
    return (action$, dispatch) => {
        const unsubs = stores.map(store => store(action$, dispatch));
        return () => unsubs.forEach(fn => fn());
    }
}

export function connectStore(store: Store) {
    const actionSubject = new Subject<Action>();
    const dispatch = actionSubject.next.bind(actionSubject);
    store(actionSubject.asObservable(), dispatch);

    return dispatch;
}

const ctx = createContext<ReturnType<typeof connectStore> | undefined>(undefined);
export const Provider = ctx.Provider;
export const Consumer = ctx.Consumer;
export const useDispatch = () => useContext(ctx)!;

export function useSelector<T>(selector: ParametricSelector<undefined | {}, T>): T;
export function useSelector<P, T>(selector: ParametricSelector<P, T>, props: P): T;
export function useSelector<P, T>(selector: ParametricSelector<P, T>, props?: P): T {
    const propSubject = useRef(new BehaviorSubject(props!));
    const state$ = useRef(selector(propSubject.current));

    const [state, setState] = useState<T>(() => state$.current.getValue());

    useEffect(() => {
        const subscription = state$.current.subscribe(setState);
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        propSubject.current.next(props!);
    });

    return state;
}
