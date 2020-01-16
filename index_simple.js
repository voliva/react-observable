
const [
    todoStore,
    todoSelector,
] = createStore([], (state, action) => {
    switch(action.type) {
        case 'ADD':
            return [
                ...state,
                action.payload
            ];
    }
});

function createStore(state, reducer) {
    const subscribers = [];

    return {
        dispatch: (action) => {
            const newState = reducer(state, action)

            if(state !== newState) {
                state = newState;
                subscribers.forEach(sub => sub());
            }
        },
        getState: () => state,
        subscribe: (sub) => {
            subscribers.push(sub);
            return () => {
                const idx = subscribers.indexOf(sub);
                subscribers.splice(idx, 1);
            }
        }
    };
}

function combineStores(stores) {
    const subscribers = [];
    let notify = false;

    const receiveNotification = () => notify = true;
    const subscriptions = stores.map(store => store.subscribe(receiveNotification));

    return {
        dispatch: action => {
            notify = false;
            stores.forEach(store => store.dispatch(action));
            if(notify) {
                subscriptions.forEach(sub => sub());
            }
        },
        subscribe: (sub) => {
            subscribers.push(sub);
            return () => {
                const idx = subscribers.indexOf(sub);
                subscribers.splice(idx, 1);
            }
        }
    }
}

/**
 * A bridge to make this compatible with react-redux and redux-observable is posible.
 * 
 * But the main idea is to break the dependency of a component to the whole state, by making subscribable selectors
 * (In here, the selectors don't take the state, because they get it from the closure).
 * 
 * Although this looks nice, the idea of using generators is because in connect it would be posible to delegate the
 * actual fetch of data to another one. So by default the data will get from a store, but you can run a storybook
 * and set the data to come from some fakes instead.
 */