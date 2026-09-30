/**
 * @fileoverview Redux slice for inventory reference data.
 * Fetches and caches UOMs, categories, and item types for the inventory module.
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "api/client";

/**
 * Async thunk to fetch Units of Measure (UOMs) from the server.
 */
export const fetchUoms = createAsyncThunk("inventoryRef/fetchUoms", async () => {
  const res = await api.get("/inventory/uoms");
  return Array.isArray(res.data?.items) ? res.data.items : [];
});

/**
 * Async thunk to fetch item categories from the server.
 */
export const fetchCategories = createAsyncThunk(
  "inventoryRef/fetchCategories",
  async () => {
    const res = await api.get("/inventory/item-categories");
    return Array.isArray(res.data?.items) ? res.data.items : [];
  }
);

/**
 * Async thunk to fetch item types from the server.
 */
export const fetchItemTypes = createAsyncThunk(
  "inventoryRef/fetchItemTypes",
  async () => {
    const res = await api.get("/inventory/item-types");
    return Array.isArray(res.data?.items) ? res.data.items : [];
  }
);

const initialState = {
  uoms: [],
  categories: [],
  itemTypes: [],
  status: {
    uoms: "idle",
    categories: "idle",
    itemTypes: "idle",
  },
  error: {
    uoms: null,
    categories: null,
    itemTypes: null,
  },
  lastFetched: {
    uoms: null,
    categories: null,
    itemTypes: null,
  },
};

const inventoryRefSlice = createSlice({
  name: "inventoryRef",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // UOMs
      .addCase(fetchUoms.pending, (state) => {
        state.status.uoms = "loading";
        state.error.uoms = null;
      })
      .addCase(fetchUoms.fulfilled, (state, action) => {
        state.status.uoms = "succeeded";
        state.uoms = action.payload;
        state.lastFetched.uoms = Date.now();
      })
      .addCase(fetchUoms.rejected, (state, action) => {
        state.status.uoms = "failed";
        state.error.uoms = action.error?.message || "Failed to load UOMs";
      })
      // Categories
      .addCase(fetchCategories.pending, (state) => {
        state.status.categories = "loading";
        state.error.categories = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.status.categories = "succeeded";
        state.categories = action.payload;
        state.lastFetched.categories = Date.now();
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.status.categories = "failed";
        state.error.categories =
          action.error?.message || "Failed to load categories";
      })
      // Item Types
      .addCase(fetchItemTypes.pending, (state) => {
        state.status.itemTypes = "loading";
        state.error.itemTypes = null;
      })
      .addCase(fetchItemTypes.fulfilled, (state, action) => {
        state.status.itemTypes = "succeeded";
        state.itemTypes = action.payload;
        state.lastFetched.itemTypes = Date.now();
      })
      .addCase(fetchItemTypes.rejected, (state, action) => {
        state.status.itemTypes = "failed";
        state.error.itemTypes =
          action.error?.message || "Failed to load item types";
      });
  },
});

export default inventoryRefSlice.reducer;
