import { ArgumentTypes } from "./lib";
import { useReactObservable } from "./context";
import { useEffect } from "react";
import { filter, take } from "rxjs/operators";

export interface Action {
  type: symbol;
}

export type ActionCreator<T extends Array<any>, A extends Action> = ((
  ...args: T
) => A) & {
  actionType: symbol;
  isCreatorOf: (action: Action) => action is A;
};
export function createActionCreator<TFn extends (...args: any[]) => any>(
  s: string,
  fn: TFn = (() => {}) as any
) {
  const type = Symbol(s);

  const actionCreator = (...args: ArgumentTypes<TFn>) => ({
    type,
    ...fn!(...args)
  });

  type SpecificAction = Action & ReturnType<TFn>;
  const ret: ActionCreator<ArgumentTypes<TFn>, SpecificAction> = Object.assign(
    actionCreator,
    {
      actionType: type,
      isCreatorOf: (action: Action): action is SpecificAction => {
        return action.type === type;
      }
    }
  );
  return ret;
}

export const createStandardAction = <TPayload = undefined>(name: string) => {
  type PayloadFn = TPayload extends undefined
    ? () => {}
    : (payload: TPayload) => { payload: TPayload };
  return createActionCreator(name, ((payload: TPayload) => ({
    payload
  })) as PayloadFn);
};

export const useAction = <TArg extends Array<any>, TAction extends Action>(
  actionCreator: ActionCreator<TArg, TAction>
) => {
  const { dispatch } = useReactObservable();
  return (...args: TArg) => dispatch(actionCreator(...args));
};

export const filterAction = <A extends Action>(
  actionCreator: ActionCreator<any, A>
) => filter(actionCreator.isCreatorOf);

export const useDispatchedAction = <TAction extends Action>(
  actionCreator: ActionCreator<any, TAction>,
  handler?: (action: TAction) => void
): (() => Promise<TAction>) => {
  const { action$ } = useReactObservable();

  useEffect(() => {
    if (!handler) return;

    const subscription = action$
      .pipe(filterAction(actionCreator))
      .subscribe(handler);
    return () => subscription.unsubscribe();
  }, [actionCreator, handler]);

  return () => action$.pipe(take(1), filterAction(actionCreator)).toPromise();
};

interface Case {
  actionCreator: ActionCreator<any, any>;
  resultFn: (action: any) => any;
}
export const switchAction = <T>(
  action: Action,
  caseFn: (
    typeCase: <A extends Action>(
      actionCreator: ActionCreator<any, A>,
      resultFn: (action: A) => T
    ) => Case
  ) => Array<Case>,
  defaultValue: T
): T => {
  const cases = caseFn((actionCreator, resultFn) => ({
    actionCreator,
    resultFn
  }));
  const matchingCase = cases.find(
    typeCase => typeCase.actionCreator.actionType === action.type
  );
  return matchingCase ? matchingCase.resultFn(action) : defaultValue;
};
