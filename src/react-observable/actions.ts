import { ArgumentTypes } from "./lib";
import { useReactObservable } from "./context";

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
