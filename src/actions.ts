import { filter } from "rxjs/operators";
import { useReactObservable } from "./context";
import { ArgumentTypes } from "./lib";

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

interface Case {
  condition: (action: Action) => boolean;
  resultFn: (action: any) => any;
}
interface TypeCase<T> {
  <A extends Action>(
    condition: ActionCreator<any, A> | ((action: Action) => boolean),
    resultFn: (action: A) => T
  ): Case;
  <A1 extends Action, A2 extends Action>(
    condition: [ActionCreator<any, A1>, ActionCreator<any, A2>],
    resultFn: (action: A1 | A2) => T
  ): Case;
  <A1 extends Action, A2 extends Action, A3 extends Action>(
    condition: [
      ActionCreator<any, A1>,
      ActionCreator<any, A2>,
      ActionCreator<any, A3>
    ],
    resultFn: (action: A1 | A2 | A3) => T
  ): Case;
  <A1 extends Action, A2 extends Action, A3 extends Action, A4 extends Action>(
    condition: [
      ActionCreator<any, A1>,
      ActionCreator<any, A2>,
      ActionCreator<any, A3>,
      ActionCreator<any, A4>
    ],
    resultFn: (action: A1 | A2 | A3 | A4) => T
  ): Case;
}
export const switchAction = <T>(
  action: Action,
  caseFn: (typeCase: TypeCase<T>) => Array<Case>,
  defaultValue: T
): T => {
  const cases = caseFn(
    (
      condition:
        | ActionCreator<any, Action>
        | Array<ActionCreator<any, Action>>
        | ((action: Action) => boolean),
      resultFn: (action: Action) => T
    ): Case => ({
      condition: action => {
        if (Array.isArray(condition)) {
          return condition.some(creator => creator.actionType === action.type);
        }
        if (!("actionType" in condition)) {
          return condition(action);
        }
        return condition.actionType === action.type;
      },
      resultFn
    })
  );
  const matchingCase = cases.find(typeCase => typeCase.condition(action));
  return matchingCase ? matchingCase.resultFn(action) : defaultValue;
};
