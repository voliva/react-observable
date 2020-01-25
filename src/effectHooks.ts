import { Observable } from "rxjs";
import { useEffect, useCallback } from "react";
import { Action, ActionCreator, filterAction } from "./actions";
import { useReactObservable } from "./context";
import { tap } from "rxjs/operators";

export const useActionEffect = (
  effect: (action$: Observable<Action>) => Observable<any>
) => {
  const { action$ } = useReactObservable();

  useEffect(() => {
    const subscription = effect(action$).subscribe();
    return () => subscription.unsubscribe();
  }, [effect]);
};

export const useDispatchedAction = <TAction extends Action>(
  actionCreator: ActionCreator<any, TAction>,
  handler: (action: TAction) => void
) =>
  useActionEffect(
    useCallback(
      action$ => action$.pipe(filterAction(actionCreator), tap(handler)),
      [actionCreator, handler]
    )
  );
