import { ImmediateObservable } from "./observables";
import { Action } from "./actions";
import { combineLatest } from "rxjs";
import { map, distinctUntilChanged } from "rxjs/operators";

export type Selector<T> = (args?: {
  readSelector?: ReadSelectorFnType;
}) => ImmediateObservable<T>;

export type ParametricSelector<P, T> = (args: {
  prop$: ImmediateObservable<P>;
  readSelector?: ReadSelectorFnType;
}) => ImmediateObservable<T>;

export interface ReadSelectorFnType {
  <T>(selector: Selector<T>): ImmediateObservable<T>;
  <P, T>(
    selector: ParametricSelector<P, T>,
    prop$: ImmediateObservable<P>
  ): ImmediateObservable<T>;
}

export type BaseSelector<T> = Selector<T> & {
  initialState: T;
  reducerFn: (state: T, action: Action, readSelector: ReadSelectorFnType) => T;
};

export const defaultReadSelector: ReadSelectorFnType = <P, T>(
  selector: Selector<T> | ParametricSelector<P, T>,
  prop$?: ImmediateObservable<P>
) => selector({ prop$: prop$!, readSelector: defaultReadSelector });

export function createSelector<T, R1>(
  deps: [Selector<R1>],
  computeFn: (dep1: R1) => T
): Selector<T>;
export function createSelector<T, R1, R2>(
  deps: [Selector<R1>, Selector<R2>],
  computeFn: (dep1: R1, dep2: R2) => T
): Selector<T>;
export function createSelector<T, P1, R1>(
  deps: [ParametricSelector<P1, R1>],
  computeFn: (dep1: R1) => T
): ParametricSelector<P1, T>;
export function createSelector<T, P1, R1, P2, R2>(
  deps: [ParametricSelector<P1, R1>, ParametricSelector<P2, R2>],
  computeFn: (dep1: R1, dep2: R2) => T
): ParametricSelector<P1 & P2, T>;
export function createSelector<T>(
  deps: (Selector<any> | ParametricSelector<any, any>)[],
  computeFn: (...args: any) => T
): Selector<T> | ParametricSelector<any, T> {
  return ({
    prop$,
    readSelector = defaultReadSelector
  }: {
    prop$?: ImmediateObservable<any>;
    readSelector?: ReadSelectorFnType;
  }) => {
    const depStreams = deps.map(dep => readSelector(dep, prop$!));
    const stream = combineLatest(depStreams).pipe(
      map(deps => computeFn(...deps)),
      distinctUntilChanged()
    );

    return Object.assign(stream, {
      getValue: () => computeFn(...depStreams.map(dep => dep.getValue()))
    });
  };
}

export function createPropSelector<T, K extends string>(
  propName: K
): ParametricSelector<
  {
    [key in K]: T;
  },
  T
> {
  return ({ prop$ }) => {
    const stream = prop$.pipe(
      map(props => props[propName]),
      distinctUntilChanged()
    );

    return Object.assign(stream, {
      getValue: () => prop$.getValue()[propName]
    });
  };
}
