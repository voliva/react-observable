import React from "react";
import { useSelector } from "@voliva/react-observable";
import { getVisibleTodos } from "./todos";
import TodoItem from "./TodoItem";

const TodoList = () => {
  const filteredTodos = useSelector(getVisibleTodos);

  return (
    <ul className="todo-list">
      {filteredTodos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
};

export default TodoList;
