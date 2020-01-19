import { useRef, useMemo, useEffect } from "react";
import { ImmediateObservable } from "./observables";
import { BehaviorSubject } from "rxjs";

export const useLazyRef = <T>(fn: () => T) => {
  const ref = useRef<T>();
  if (ref.current === undefined) {
    ref.current = fn();
  }
  return ref;
};

export const usePropsObservable = <T>(props: T): ImmediateObservable<T> => {
  const propSubject = useMemo(() => new BehaviorSubject(props), []);

  useEffect(() => {
    propSubject.next(props);
  }, [props]);

  return propSubject;
};
