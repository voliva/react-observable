import React from "react";
import ReactDOM from "react-dom";
import "todomvc-app-css/index.css";
import App from "./App";
import { combineStores, Provider } from "./react-observable";
import { todosStore } from "./todos";
import { visibilityFilterStore } from "./visibilityFilter";

const rootStore = combineStores([todosStore, visibilityFilterStore]);

ReactDOM.render(
  <Provider store={rootStore}>
    <App />
  </Provider>,
  document.getElementById("root")
);
