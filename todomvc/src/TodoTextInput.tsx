import { FC, useState } from "react";
import React from "react";
import classnames from "classnames";

export const TodoTextInput: FC<{
  onSave: (text: string) => void;
  initialText?: string;
  placeholder?: string;
  editing?: boolean;
  newTodo?: boolean;
}> = ({ initialText, onSave, placeholder, editing, newTodo }) => {
  const [text, setText] = useState(initialText || "");

  const handleSubmit = (e: any) => {
    const text = e.target.value.trim();
    if (e.which === 13) {
      onSave(text);
      if (newTodo) {
        setText("");
      }
    }
  };

  const handleChange = (e: any) => {
    setText(e.target.value);
  };

  const handleBlur = (e: any) => {
    if (!newTodo) {
      onSave(e.target.value);
    }
  };

  return (
    <input
      className={classnames({
        edit: editing,
        "new-todo": newTodo
      })}
      type="text"
      placeholder={placeholder}
      autoFocus={true}
      value={text}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleSubmit}
    />
  );
};

export default TodoTextInput;
