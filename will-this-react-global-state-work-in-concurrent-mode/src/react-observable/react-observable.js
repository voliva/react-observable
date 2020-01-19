import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import { BehaviorSubject, combineLatest, EMPTY, Subject } from "rxjs";
import { distinctUntilChanged, map, scan } from "rxjs/operators";
export function createActionCreator(s, fn) {
  fn = fn || (() => { });
  const type = typeof s === "string" ? Symbol(s) : s;
  const actionCreator = (...args) => (Object.assign({ type }, fn(...args)));
  const typeCheck = {
    actionType: type,
    isCreatorOf: (action) => {
      return action.type === type;
    }
  };
  const ret = Object.assign(actionCreator, typeCheck);
  return ret;
}
export function createStore(initialState, reducerFn, effectFn = () => EMPTY) {
  const stateSubject = new BehaviorSubject(initialState);
  const stateSelector = Object.assign(() => stateSubject, {
    initialState,
    reducerFn
  });
  const store = {
    connect: (action$, dispatch, readSelector) => {
      const stateSubscription = action$
        .pipe(scan((state, action) => reducerFn(state, action, readSelector), initialState), distinctUntilChanged())
        .subscribe(stateSubject);
      const effectSubscription = effectFn(action$, readSelector).subscribe(dispatch);
      return () => {
        stateSubscription.unsubscribe();
        effectSubscription.unsubscribe();
      };
    },
    baseSelectors: [stateSelector]
  };
  return [stateSelector, store];
}
const defaultReadSelector = (selector, prop$) => selector(prop$);
export function createSelector(deps, computeFn) {
  return (prop$, readSelector = defaultReadSelector) => {
    const depStreams = deps.map(dep => readSelector(dep, prop$));
    const stream = combineLatest(depStreams).pipe(map(deps => computeFn(...deps)), distinctUntilChanged());
    return Object.assign(stream, {
      getValue: () => computeFn(...depStreams.map(dep => dep.getValue()))
    });
  };
}
export function createPropSelector(propName) {
  return prop$ => {
    const stream = prop$.pipe(map(props => props[propName]), distinctUntilChanged());
    return Object.assign(stream, {
      getValue: () => prop$.getValue()[propName]
    });
  };
}
export function combineStores(stores) {
  return {
    connect: (action$, dispatch, readSelector) => {
      const unsubs = stores.map(store => store.connect(action$, dispatch, readSelector));
      return () => unsubs.forEach(fn => fn());
    },
    baseSelectors: stores.reduce((selectors, store) => selectors.concat(store.baseSelectors), [])
  };
}
const ctx = createContext(undefined);
export const Provider = ({ store, children }) => {
  const { baseSelectors } = store;
  const [action$, dispatch] = useMemo(() => {
    const subject = new Subject();
    const action$ = subject.asObservable();
    const dispatch = subject.next.bind(subject);
    return [action$, dispatch];
  }, []);
  const selectorSubjects = useMemo(() => {
    const map = new WeakMap();
    baseSelectors.forEach(selector => map.set(selector, selector()));
    return map;
  }, []);
  const readSelector = (selector, prop$) => {
    if (!baseSelectors.includes(selector)) {
      return selector(prop$, readSelector);
    }
    return selectorSubjects.get(selector);
  };
  const value = useMemo(() => ({
    dispatch,
    readSelector
  }), []);
  useEffect(() => store.connect(action$, dispatch, readSelector), []);
  return createElement(ctx.Provider, {
    value
  }, children);
};
export const Consumer = ctx.Consumer;
export const useDispatch = () => useContext(ctx).dispatch;
export const useAction = (actionCreator) => {
  const dispatch = useDispatch();
  return (...args) => dispatch(actionCreator(...args));
};
const usePropsObservable = (props) => {
  const propSubject = useMemo(() => new BehaviorSubject(props), []);
  useEffect(() => {
    propSubject.next(props);
  }, [props]);
  return propSubject;
};
export function useSelector(selector, props) {
  const { readSelector } = useContext(ctx);
  const prop$ = usePropsObservable(props);
  const state$ = useMemo(() => readSelector(selector, prop$), [selector]);
  const [state, setState] = useState(() => state$.getValue());
  useEffect(() => {
    setState(state$.getValue());
    const subscription = state$.subscribe(setState);
    return () => subscription.unsubscribe();
  }, [state$]);
  return state;
}
