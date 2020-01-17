import React from "react";
import { useSelector, useAction } from "./react-observable";
import { getCompletedTodoCount, getTodosCount, clearCompleted, completeAllTodos } from "./todos";
import Footer from './Footer';
import TodoList from './TodoList';

const MainSection = () => {
  const completedCount = useSelector(getCompletedTodoCount);
  const todosCount = useSelector(getTodosCount);
  const onClearCompleted = useAction(clearCompleted);
  const onCompleteAll = useAction(completeAllTodos);

  return (
    <section className="main">
      {!!todosCount && (
        <span>
          <input
            className="toggle-all"
            type="checkbox"
            checked={completedCount === todosCount}
            readOnly
          />
          <label onClick={onCompleteAll} />
        </span>
      )}
      <TodoList />
      {!!todosCount && (
        <Footer
          completedCount={completedCount}
          activeCount={todosCount - completedCount}
          onClearCompleted={onClearCompleted}
        />
      )}
    </section>
  );
};

export default MainSection;
