import { Observable, Subject, ReplaySubject, BehaviorSubject, combineLatest, EMPTY } from "rxjs";
import { scan, distinctUntilChanged, map } from 'rxjs/operators';
import { createContext, useContext, useState, useEffect } from "react";

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

    return [stateObservable, store] as [typeof stateObservable, Store];
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

export function createSelector<T>(
    deps: ImmediateObservable<any>[],
    computeFn: (...args: any) => T
): ImmediateObservable<T> {
    const stream = combineLatest(deps).pipe(
        map(deps => computeFn(...deps))
    );

    return Object.assign(
        stream,
        {
            getValue: () => computeFn(
                ...deps.map(dep => dep.getValue())
            )
        }
    );
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
export function useStoreState<T>(state$: ImmediateObservable<T>): T;
export function useStoreState<T>(state$: Observable<T>): T | undefined;
export function useStoreState<T>(state$: Observable<T> | ImmediateObservable<T>) {
    const [state, setState] = useState<T | undefined>(() => 'getValue' in state$ ? state$.getValue() : undefined);

    useEffect(() => {
        const subscription = state$.subscribe(setState);
        return () => subscription.unsubscribe();
    }, [state$]);

    return state;
}
