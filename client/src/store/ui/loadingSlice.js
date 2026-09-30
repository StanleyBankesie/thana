/**
 * @file loadingSlice.js
 * @description Redux slice for managing global loading states.
 */

import { createSlice } from "@reduxjs/toolkit";

const slice = createSlice({
  name: "loading",
  initialState: {},
  reducers: {
    setLoading(state, action) {
      const { key, value } = action.payload || {};
      if (!key) return;
      state[key] = !!value;
    },
    clearLoading(state, action) {
      const key = action.payload;
      if (key && Object.prototype.hasOwnProperty.call(state, key)) {
        delete state[key];
      }
    },
  },
});

/**
 * Action creators for managing loading state.
 * @type {Object}
 * @property {Function} setLoading - Action to set loading state for a specific key.
 * @property {Function} clearLoading - Action to clear loading state for a specific key.
 */
export const { setLoading, clearLoading } = slice.actions;
export default slice.reducer;
