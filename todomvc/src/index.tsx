import React from 'react';
import ReactDOM from 'react-dom';
import 'todomvc-app-css/index.css'
// import App from './App';
import { createReducerStore, createActionCreator, connectStore, Provider, useStoreState, useDispatch, createSelector } from './react-observable';

const addA = createActionCreator(Symbol('addA'), (value: number) => ({ value }));
const [stateA, storeA] = createReducerStore(
    {
        a: 0
    },
    (state, action) => {
        if(addA.isAction(action)) {
            return {
                a: state.a + action.value
            }
        }
        return state;
    }
);
const getAValue = createSelector([stateA], state => {
    console.log(state);
    return state.a as number
});

const connectedStore = connectStore(storeA);

const App = () => {
    const state = useStoreState(getAValue);
    const dispatch = useDispatch();

    const handleClick = () => dispatch(addA(1));

    return <div>
        {state}
        <br />
        <button onClick={handleClick}>Add</button>
    </div>
}

ReactDOM.render(<Provider value={connectedStore}><App /></Provider>, document.getElementById('root'));
