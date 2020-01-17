import { Observable, EMPTY, Subject } from "rxjs";
import { scan, filter, map } from 'rxjs/operators';

interface Action {
    type: symbol;
}
type ArgumentTypes<T> = T extends (... args: infer U ) => infer R ? U: never;
type ReplaceReturnType<T, TNewReturn> = (...a: ArgumentTypes<T>) => TNewReturn;

function createActionCreator<
    TS extends symbol,
    TFn extends (...args) => any
>(
    s: TS,
    fn: TFn
) {
    const actionCreator = (...args) => ({
        type: s,
        ...fn(...args)
    });

    type ThisAction = {
        type: TS
    } & ReturnType<TFn>;
    const typeCheck = {
        isAction: (action: Action): action is ThisAction => {
            return action.type === s
        }
    }

    return Object.assign(
        actionCreator,
        typeCheck
    ) as ReplaceReturnType<TFn, ReturnType<TFn> & {
        type: TS
    }> & typeof typeCheck;
}

const actionCreator = createActionCreator(
    Symbol('MyAction'),
    (firstArg: string, secondArg: number) => ({
        payload: {
            firstArg,
            secondArg
        }
    })
);

const action = actionCreator('hey', 3);
let action2: Action = action;

if(actionCreator.isAction(action2)) {
    // Tela fina!!!
}

const [state, store] = createStore(
    action$ => action$.pipe(
        filter(actionCreator.isAction), /// TELA FINAAAAA!!!!
        map(action => action.payload)
    ),
    action$ => EMPTY
);

function createStore<T>(
    stateFn: (action$: Observable<Action>) => Observable<T>,
    effectFn: (action$: Observable<Action>) => Observable<Action>
) {
    const stateSubject = new Subject<T>();
    const connect = (
        action$: Observable<Action>,
        dispatch: (action: Action) => void
    ) => {
        const stateSubscription = stateFn(action$).subscribe(stateSubject);
        const effectSubscription = effectFn(action$).subscribe(dispatch);
        return () => {
            stateSubscription.unsubscribe();
            effectSubscription.unsubscribe();
        }
    }

    const stateObservable = stateSubject.asObservable();

    return [stateObservable, connect] as [typeof stateObservable, typeof connect];
}

function createReducerStore<T>(
    initialState: T,
    reducerFn: (state: T, action: Action) => T,
    effectFn: (action$: Observable<Action>) => Observable<Action>
) {
    return createStore(
        action$ => action$.pipe(
            scan(reducerFn, initialState)
        ),
        effectFn
    );
}
