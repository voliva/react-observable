import React, { FC, useState } from "react";
import classnames from "classnames";
import TodoTextInput from "./TodoTextInput";
import { useAction } from "@voliva/react-observable";
import { editTodo, deleteTodo, completeTodo } from "./todos";

const TodoItem: FC<{
  todo: any;
}> = ({ todo }) => {
  const handleEdit = useAction(editTodo);
  const handleDelete = useAction(deleteTodo);
  const handleComplete = useAction(completeTodo);
  const [editing, setEditing] = useState(false);

  const handleDoubleClick = () => setEditing(true);

  const handleSave = (text: string) => {
    if (text.length === 0) {
      handleDelete(todo.id);
    } else {
      handleEdit({ id: todo.id, text });
    }
    setEditing(false);
  };

  let element;
  if (editing) {
    element = (
      <TodoTextInput
        initialText={todo.text}
        editing={editing}
        onSave={handleSave}
      />
    );
  } else {
    element = (
      <div className="view">
        <input
          className="toggle"
          type="checkbox"
          checked={todo.completed}
          onChange={() => handleComplete(todo.id)}
        />
        <label onDoubleClick={handleDoubleClick}>{todo.text}</label>
        <button className="destroy" onClick={() => handleDelete(todo.id)} />
      </div>
    );
  }

  return (
    <li
      className={classnames({
        completed: todo.completed,
        editing
      })}
    >
      {element}
    </li>
  );
};

export default TodoItem;
