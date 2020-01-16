
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

const [
    todoStore,
    todoSelector,
] = createStore(
    [],
    function *() {
        while(true) {
            const action = yield getAction();
            const state = yield getState(todoSelector);

            switch(action.type) {
                case 'ADD':
                    yield setState([
                        ...state,
                        action.payload
                    ]);
                    break;
            }
        }
    }
);

function createStore(state, updateFn) {
    const updateGenerator = updateFn();

    function runUpdateUntilAction(prevAction = undefined) {
        let action;
        let next = prevAction;
        while((action = updateGenerator.next(next)).value.type !== GET_ACTION) {
            switch(action.value.type) {
                case 'GET_STATE':
                    next = runSelector(action.value.selector, action.value.props);
                    break;
                case 'SET_STATE':
                    state = action.value.state;
                    next = undefined;
                    break;
                default:
                    throw new Error('unknown action ' + action.value.type);
            }
        }
    }
    runUpdateUntilAction();

    const store = {
        dispatch: runUpdateUntilAction,
        getState: () => state
    };

    return [
        store,
        function *() {
            return state;
        }
    ]
}

function runSelector(selector, props) {
    const selectorGenerator = selector(props);

    let action;
    let next = undefined;
    while(!(action = selectorGenerator.next(next)).done) {
        switch(action.value.type) {
            case 'GET_STATE':
                next = runSelector(action.value.selector, action.value.props);
                break;
            default:
                throw new Error('unknown action ' + action.value.type);
        }
    }

    return action.value;
}
