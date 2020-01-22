import {
  createStore,
  createSelector,
  createStandardAction
} from "@voliva/react-observable";
import { getVisibilityFilter, TodoFilter } from "./visibilityFilter";

export const addTodo = createStandardAction<string>("addTodo");
export const deleteTodo = createStandardAction<number>("deleteTodo");
export const editTodo = createStandardAction<{ id: number; text: string }>(
  "editTodo"
);

export const completeTodo = createStandardAction<number>("completeTodo");

export const completeAllTodos = createStandardAction("completeAll");
export const clearCompleted = createStandardAction("clearCompleted");

type State = Array<{
  text: string;
  completed: boolean;
  id: number;
}>;

const [getTodos, todosStore] = createStore<State>([], (state, action) => {
  if (addTodo.isCreatorOf(action)) {
    return [
      ...state,
      {
        id: state.reduce((maxId, todo) => Math.max(todo.id, maxId), -1) + 1,
        completed: false,
        text: action.payload
      }
    ];
  }
  if (deleteTodo.isCreatorOf(action)) {
    return state.filter(todo => todo.id !== action.payload);
  }
  if (editTodo.isCreatorOf(action)) {
    return state.map(todo =>
      todo.id === action.payload.id
        ? { ...todo, text: action.payload.text }
        : todo
    );
  }
  if (completeTodo.isCreatorOf(action)) {
    return state.map(todo =>
      todo.id === action.payload
        ? { ...todo, completed: !todo.completed }
        : todo
    );
  }
  if (completeAllTodos.isCreatorOf(action)) {
    const areAllMarked = state.every(todo => todo.completed);
    return state.map(todo => ({
      ...todo,
      completed: !areAllMarked
    }));
  }
  if (clearCompleted.isCreatorOf(action)) {
    return state.filter(todo => todo.completed === false);
  }

  return state;
});
export { getTodos, todosStore };

export const getVisibleTodos = createSelector(
  [getVisibilityFilter, getTodos],
  (visibilityFilter, todos) => {
    switch (visibilityFilter) {
      case TodoFilter.SHOW_ALL:
        return todos;
      case TodoFilter.SHOW_COMPLETED:
        return todos.filter(t => t.completed);
      case TodoFilter.SHOW_ACTIVE:
        return todos.filter(t => !t.completed);
      default:
        throw new Error("Unknown filter: " + visibilityFilter);
    }
  }
);

export const getCompletedTodoCount = createSelector([getTodos], todos =>
  todos.reduce((count, todo) => (todo.completed ? count + 1 : count), 0)
);

export const getTodosCount = createSelector([getTodos], todos => todos.length);
