import { Observable } from "rxjs";

export type ImmediateObservable<T> = Observable<T> & {
  getValue: () => T;
};
