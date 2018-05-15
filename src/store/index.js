import { applyMiddleware, createStore, compose } from "redux";
import thunk from "redux-thunk";
import unhandledActions from "redux-unhandled-action";
import rootReducer from "../reducers";

// export a function that builds a store... with options!
export default () => {
  const middleware = [thunk];

  // if in dev mode, add unhandled action warnings and devtools
  let composeEnhancers = compose;
  if (window.__DEV__) {
    middleware.push(unhandledActions());
    if (window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) {
      composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
    }
  }

  // build store
  return createStore(
    rootReducer,
    composeEnhancers(applyMiddleware(...middleware))
  );
};
