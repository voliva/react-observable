import { useEffect, useRef } from "react";
import { BehaviorSubject } from "rxjs";
import { ImmediateObservable } from "./observables";

export type ArgumentTypes<T> = T extends (...args: infer U) => infer R
  ? U
  : never;

export const useInstanceValue = <T>(fn: () => T) => {
  const ref = useRef<T>((undefined as any) as T);
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
