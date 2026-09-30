/**
 * @file notificationsSlice.js
 * @description Redux slice for managing toast notifications state.
 */

import { createSlice, nanoid } from "@reduxjs/toolkit";

const slice = createSlice({
  name: "notifications",
  initialState: [],
  reducers: {
    notify: {
      reducer(state, action) {
        state.push(action.payload);
      },
      prepare({ type = "info", message, duration = 4000 }) {
        return { payload: { id: nanoid(), type, message, duration } };
      },
    },
    dismiss(state, action) {
      const id = action.payload;
      return state.filter((n) => n.id !== id);
    },
    clear() {
      return [];
    },
  },
});

/**
 * Action creators for managing notifications.
 * @type {Object}
 * @property {Function} notify - Action to add a new notification.
 * @property {Function} dismiss - Action to dismiss a specific notification.
 * @property {Function} clear - Action to clear all notifications.
 */
export const { notify, dismiss, clear } = slice.actions;
export default slice.reducer;
