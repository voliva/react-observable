import { combineLatest } from "rxjs";
import { distinctUntilChanged, map, switchMap } from "rxjs/operators";
import { ImmediateObservable } from "./lib";

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
  } = {}) => {
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

export function combineSelectors<T>(
  selectors: { [K in keyof T]: Selector<T[K]> }
): Selector<T>;
export function combineSelectors<P, T>(
  selectors: { [K in keyof T]: ParametricSelector<P, T[K]> }
): ParametricSelector<P, T>;
export function combineSelectors<T>(
  selectors: { [K in keyof T]: Selector<T[K]> | ParametricSelector<any, T[K]> }
): Selector<T> | ParametricSelector<any, T> {
  const keys = Object.keys(selectors);

  return createSelector(Object.values(selectors) as any, (...values: any[]) => {
    const ret: any = {};
    values.forEach((value, i) => (ret[keys[i]] = value));
    return ret;
  });
}

export function createPropSelector<TProps, TRet>(
  propFn: (props: TProps) => TRet
): ParametricSelector<TProps, TRet> {
  return ({ prop$ }) => {
    const stream = prop$.pipe(map(propFn), distinctUntilChanged());

    return Object.assign(stream, {
      getValue: () => propFn(prop$.getValue())
    });
  };
}

export function createTypedPropSelector<K extends string>(
  propName: K
): <T>() => ParametricSelector<
  {
    [key in K]: T;
  },
  T
> {
  return () => createPropSelector(props => props[propName]);
}

export function mapSelectorProps<PSelector, PMap, T>(
  selector: ParametricSelector<PSelector, T>,
  mapFn: (props: PMap) => PSelector
): PMap extends {} ? ParametricSelector<PMap, T> : Selector<T> {
  const parametricSelector: ParametricSelector<PMap, T> = ({
    prop$,
    readSelector = defaultReadSelector
  }: {
    prop$: ImmediateObservable<any>;
    readSelector?: ReadSelectorFnType;
  }) =>
    selector({
      prop$: Object.assign(prop$?.pipe(map(mapFn)), {
        getValue: () => mapFn(prop$.getValue())
      }),
      readSelector
    });
  return parametricSelector as any;
}

// TODO parametric selector
export function selectSelector<T>(
  selectingSelector: Selector<Selector<T>>
): Selector<T> {
  return ({
    readSelector = defaultReadSelector
  }: {
    readSelector?: ReadSelectorFnType;
  } = {}) => {
    const selectingSelector$ = selectingSelector({
      readSelector
    });

    const stream = selectingSelector$.pipe(
      switchMap(selected =>
        selected({
          readSelector
        })
      )
    );
    return Object.assign(stream, {
      getValue: () =>
        selectingSelector$
          .getValue()({ readSelector })
          .getValue()
    });
  };
}
