/**
 * @file modalsSlice.js
 * @description Redux slice for managing the state of application modals.
 */

import { createSlice } from "@reduxjs/toolkit";

const slice = createSlice({
  name: "modals",
  initialState: {},
  reducers: {
    openModal(state, action) {
      const { key, props } = action.payload || {};
      if (!key) return;
      state[key] = { open: true, props: props || {} };
    },
    closeModal(state, action) {
      const key = action.payload;
      if (!key) return;
      state[key] = { open: false, props: {} };
    },
  },
});

/**
 * Action creators for managing modals.
 * @type {Object}
 * @property {Function} openModal - Action to open a specific modal with props.
 * @property {Function} closeModal - Action to close a specific modal.
 */
export const { openModal, closeModal } = slice.actions;
export default slice.reducer;
