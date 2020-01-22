import { createStore, createStandardAction } from "@voliva/react-observable";

export enum TodoFilter {
  SHOW_ALL = "SHOW_ALL",
  SHOW_COMPLETED = "SHOW_COMPLETED",
  SHOW_ACTIVE = "SHOW_ACTIVE"
}

const setVisibilityFilter = createStandardAction<TodoFilter>(
  "setVisibilityFilter"
);

const [getVisibilityFilter, visibilityFilterStore] = createStore<TodoFilter>(
  TodoFilter.SHOW_ALL,
  (state, action) => {
    if (setVisibilityFilter.isCreatorOf(action)) {
      return action.payload;
    }
    return state;
  }
);

export { getVisibilityFilter, visibilityFilterStore };
