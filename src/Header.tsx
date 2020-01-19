import { useAction } from "./react-observable";
import { addTodo } from "./todos";
import React from "react";
import { TodoTextInput } from "./TodoTextInput";

const Header = () => {
  const onSave = useAction(addTodo);

  return (
    <header className="header">
      <h1>todos</h1>
      <TodoTextInput
        newTodo
        onSave={onSave}
        placeholder="What needs to be done?"
      />
    </header>
  );
};

export default Header;
