/**
 * @file refreshSlice.js
 * @description Redux slice to manage refresh signals for different entities.
 */

import { createSlice } from "@reduxjs/toolkit";

const slice = createSlice({
  name: "refresh",
  initialState: {},
  reducers: {
    setRefresh(state, action) {
      const { key, id, ts } = action.payload || {};
      if (!key) return;
      state[key] = { id: id ?? null, ts: ts ?? Date.now() };
    },
    consumeRefresh(state, action) {
      const key = action.payload;
      if (key && Object.prototype.hasOwnProperty.call(state, key)) {
        delete state[key];
      }
    },
  },
});

/**
 * Action creators for managing refresh signals.
 * @type {Object}
 * @property {Function} setRefresh - Action to trigger a refresh for an entity.
 * @property {Function} consumeRefresh - Action to clear the refresh signal once consumed.
 */
export const { setRefresh, consumeRefresh } = slice.actions;
export default slice.reducer;
