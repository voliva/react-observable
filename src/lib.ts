import { useEffect, useRef } from "react";
import { Observable, BehaviorSubject } from "rxjs";

export type ImmediateObservable<T> = Observable<T> & {
  getValue: () => T;
};

export type ArgumentTypes<T> = T extends (...args: infer U) => infer R
  ? U
  : never;

export const useInstanceValue = <T>(fn: () => T) => {
  const ref = useRef<T>(undefined as any);
  if (ref.current === undefined) {
    ref.current = fn();
  }
  return ref.current;
};

export const usePropsObservable = <T>(props: T): ImmediateObservable<T> => {
  const propSubject = useInstanceValue(() => new BehaviorSubject(props));

  useEffect(() => {
    propSubject.next(props);
  }, [props]);

  return propSubject;
};
