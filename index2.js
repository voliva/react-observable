
const getAction = type => ({
    type: 'GET_ACTION',
    actionType: type
});
const getState = (selector, props) => ({
    type: 'GET_STATE',
    selector,
    props
});
const setState = (state) => ({
    type: 'SET_STATE',
    state
});

const todoStore = declareStore(
    [],
    function* () {
        while (true) {
            const action = yield getAction();
            // const state = yield getState(todoStore);

            switch (action.type) {
                case 'ADD':
                    yield setState(state => [
                        ...state,
                        action.payload
                    ]);
                    break;
            }
        }
    }
);

function declareStore(state, updateFn) {
    return {
        getState: () => state,
        setState: newState => {
            state = newState
        },
        updateFn
    }
}

function combineStores(stores) {
    return {
        getState: () => stores.map(store => store.getState()),
        setState: state => state.forEach((state, i) => stores[i].setState(state)),
        updateFn: function* () {
            const updateIterators = stores.map((store, i) => store.updateFn());

            const next = updateIterators.map(() => undefined);
            for(let i=0; updateIterators.length > 0; i = (i+1) % updateIterators.length) {
                const res = updateIterators[i].next(next[i]);
                if(!res.done) {
                    let value = res.value;
                    if(value.type === 'SET_STATE') {
                        value = setState(state => state.map((s, j) => i === j ? runStateAction(action, s) : s));
                    }
                    next[i] = yield res.value;
                } else {
                    updateIterators.splice(i, 1);
                    next.splice(i, 1);
                }
            }
        }
    }
}

function runStateAction(action, oldState) {
    if (typeof action.state === 'function') {
        return action.state(oldState);
    }
    return action.state;
}

function runStore({ getState, setState, updateFn }) {
    const updateGenerator = updateFn();

    function runSelector(selector, props) {
        const selectorGenerator = selector(props);
    
        let res;
        let next = undefined;
        while (!(res = selectorGenerator.next(next)).done) {
            const action = res.value;
            switch (action.type) {
                case 'GET_STATE':
                    if('getState' in action.selector) {
                        next = action.selector.getState();
                    } else {
                        next = runSelector(action.selector, action.props);
                    }
                    break;
                default:
                    throw new Error('unknown action ' + action.type);
            }
        }
    
        return action.value;
    }

    function runUpdateUntilAction(prevAction = undefined) {
        let res;
        let next = prevAction;
        while(!(res = updateGenerator.next(next)).done && res.value.type !== GET_ACTION) {
            const action = res.value;
            switch(action.type) {
                case 'GET_STATE':
                    next = runSelector(action.selector, action.props);
                    break;
                case 'SET_STATE':
                    setState(
                        runStateAction(action.state, getState())
                    );
                    next = undefined;
                    break;
                default:
                    throw new Error('unknown action ' + action.type);
            }
        }
        return res;
    }
    runUpdateUntilAction();


    return {
        dispatch: runUpdateUntilAction,
        getState: () => state,
        // Subscribe
    };
}
