import {
  createContext,
  createElement,
  FC,
  useContext,
  useEffect,
  useMemo
} from "react";
import { Observable, Subject } from "rxjs";
import { Action } from "./actions";
import { ImmediateObservable } from "./observables";
import {
  BaseSelector,
  ParametricSelector,
  ReadSelectorFnType,
  Selector
} from "./selectors";
import { Store } from "./store";
import { useInstanceValue } from "./lib";

interface ReactObservableContext {
  dispatch: (action: Action) => void;
  readSelector: ReadSelectorFnType;
  baseSelectors: BaseSelector<any>[];
  action$: Observable<Action>;
}

const ctx = createContext<ReactObservableContext | undefined>(undefined);
export const Provider: FC<{
  store: Store;
}> = ({ store, children }) => {
  const [action$, dispatch] = useInstanceValue(() => {
    const subject = new Subject<Action>();
    const action$ = subject.asObservable();
    const dispatch = subject.next.bind(subject);
    return [action$, dispatch] as [typeof action$, typeof dispatch];
  });

  const { baseSelectors } = store;

  const selectorSubjects = useMemo(() => {
    const map = new WeakMap<Selector<any>, ImmediateObservable<any>>();
    baseSelectors.forEach(selector => map.set(selector, selector()));
    return map;
  }, [baseSelectors]);

  const readSelector: ReadSelectorFnType = <P, T>(
    selector: Selector<T> | ParametricSelector<P, T>,
    prop$?: ImmediateObservable<P>
  ) => {
    if (!baseSelectors.includes(selector as any)) {
      return selector({ prop$: prop$!, readSelector });
    }
    return selectorSubjects.get(selector as any)!;
  };

  const value = useMemo(
    () => ({
      dispatch,
      readSelector,
      baseSelectors,
      action$
    }),
    [baseSelectors]
  );

  useEffect(() => store.connect(action$, dispatch, readSelector), [store]);

  return createElement(
    ctx.Provider,
    {
      value
    },
    children
  );
};

export const Consumer = ctx.Consumer;
export const useReactObservable = () => useContext(ctx)!;
