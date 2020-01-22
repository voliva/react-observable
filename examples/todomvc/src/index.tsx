import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "@voliva/react-observable";
import { todosStore } from "./todos";
import { visibilityFilterStore } from "./visibilityFilter";
import { CMTest } from "./CMTest";
import App from "./App";

ReactDOM.render(
  <Provider stores={[todosStore, visibilityFilterStore]}>
    <App />
  </Provider>,
  document.getElementById("root")
);
// const root = (ReactDOM as any).createRoot(document.getElementById("root"));
// root.render(<CMTest />);
