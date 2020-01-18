import React from "react";
import ReactDOM from "react-dom";
import { combineStores, Provider } from "./react-observable";
import { todosStore } from "./todos";
import { visibilityFilterStore } from "./visibilityFilter";
import { CMTest } from "./CMTest";

const rootStore = combineStores([todosStore, visibilityFilterStore]);

// ReactDOM.render(
//   <Provider store={rootStore}>
//     <App />
//   </Provider>,
//   document.getElementById("root")
// );
const root = (ReactDOM as any).createRoot(document.getElementById("root"));
root.render(<CMTest />);
