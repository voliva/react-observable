import React, { FC } from "react";

const FILTER_TITLES = {
  //   [SHOW_ALL]: 'All',
  //   [SHOW_ACTIVE]: 'Active',
  //   [SHOW_COMPLETED]: 'Completed'
};

const Footer: FC<{
  activeCount: number;
  completedCount: number;
  onClearCompleted: () => void;
}> = props => {
  const { activeCount, completedCount, onClearCompleted } = props;
  const itemWord = activeCount === 1 ? "item" : "items";
  return (
    <footer className="footer">
      <span className="todo-count">
        <strong>{activeCount || "No"}</strong> {itemWord} left
      </span>
      <ul className="filters">
        {Object.keys(FILTER_TITLES).map(filter => (
          <li key={filter}>
            {/* <FilterLink filter={filter}>
              {FILTER_TITLES[filter]}
            </FilterLink> */}
          </li>
        ))}
      </ul>
      {!!completedCount && (
        <button className="clear-completed" onClick={onClearCompleted}>
          Clear completed
        </button>
      )}
    </footer>
  );
};

export default Footer;
