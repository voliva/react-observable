import React from "react";
import ReactDOM from "react-dom";
import "todomvc-app-css/index.css";
import App from "./App";
import { combineStores, connectStore, Provider } from "./react-observable";
import { todosStore } from "./todos";
import { visibilityFilterStore } from "./visibilityFilter";

const rootStore = combineStores([todosStore, visibilityFilterStore]);
const connectedStore = connectStore(rootStore);

ReactDOM.render(
  <Provider value={connectedStore}>
    <App />
  </Provider>,
  document.getElementById("root")
);
