/**
 * @fileoverview Global Redux store configuration.
 * Combines all application reducers and sets up the root store.
 */

import { configureStore, combineReducers } from "@reduxjs/toolkit";
import inventoryRefReducer from "./inventoryRefSlice";
import customersReducer from "../modules/customers/customerSlice.js";
import loadingReducer from "./ui/loadingSlice.js";
import notificationsReducer from "./ui/notificationsSlice.js";
import modalsReducer from "./ui/modalsSlice.js";
import refreshReducer from "./ui/refreshSlice.js";

const appReducer = combineReducers({
  inventoryRef: inventoryRefReducer,
  entities: combineReducers({
    customers: customersReducer,
  }),
  ui: combineReducers({
    loading: loadingReducer,
    notifications: notificationsReducer,
    modals: modalsReducer,
    refresh: refreshReducer,
  }),
});

const rootReducer = (state, action) => {
  if (action.type === "RESET_STORE") {
    state = undefined;
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
});

