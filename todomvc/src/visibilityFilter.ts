import { createActionCreator, createStore } from "./react-observable";

export enum TodoFilter {
  SHOW_ALL = "SHOW_ALL",
  SHOW_COMPLETED = "SHOW_COMPLETED",
  SHOW_ACTIVE = "SHOW_ACTIVE"
}

const setVisibilityFilter = createActionCreator(
  "setVisibilityFilter",
  (filter: TodoFilter) => ({ filter })
);

const [getVisibilityFilter, visibilityFilterStore] = createStore<TodoFilter>(
  TodoFilter.SHOW_ALL,
  (state, action) => {
    if (setVisibilityFilter.isCreatorOf(action)) {
      return action.filter;
    }
    return state;
  }
);

export { getVisibilityFilter, visibilityFilterStore };
