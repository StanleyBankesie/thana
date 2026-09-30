/**
 * @fileoverview Redux slice for managing customer data state.
 * Handles fetching, creating, updating, and deleting customers, with optimistic updates.
 */

import {
  createSlice,
  createEntityAdapter,
  createAsyncThunk,
  nanoid,
} from "@reduxjs/toolkit";
import { customerAPI } from "./customerAPI.js";

const adapter = createEntityAdapter({
  selectId: (e) => e.id,
  sortComparer: (a, b) =>
    String(a.customer_name || "").localeCompare(String(b.customer_name || "")),
});

const initialState = adapter.getInitialState({
  loading: "idle",
  error: null,
  lastFetched: 0,
});

/**
 * Async thunk to fetch all customers from the API.
 * Uses a basic caching mechanism based on lastFetched timestamp.
 */
export const fetchCustomers = createAsyncThunk(
  "customers/fetchAll",
  async (args = {}, { getState, rejectWithValue }) => {
    try {
      const { force = false, params = {} } = args || {};
      const lastFetched = getState()?.entities?.customers?.lastFetched || 0;
      if (!force && Date.now() - lastFetched < 60000) {
        return { items: null, skipped: true };
      }
      const items = await customerAPI.list(params);
      return { items, skipped: false };
    } catch (err) {
      return rejectWithValue(err?.message || "Failed to fetch customers");
    }
  },
);

/**
 * Async thunk to create a new customer.
 */
export const createCustomer = createAsyncThunk(
  "customers/create",
  async (payload, { rejectWithValue }) => {
    try {
      const item = await customerAPI.create(payload);
      return { tempId: payload?.temporaryId, item };
    } catch (err) {
      return rejectWithValue({
        message: err?.message || "Create failed",
        tempId: payload?.temporaryId,
      });
    }
  },
);

export const updateCustomer = createAsyncThunk(
  "customers/update",
  async ({ id, patch }, { rejectWithValue }) => {
    try {
      const item = await customerAPI.update(id, patch);
      return { id, item };
    } catch (err) {
      return rejectWithValue({ message: err?.message || "Update failed", id });
    }
  },
);

export const deleteCustomer = createAsyncThunk(
  "customers/delete",
  async (id, { rejectWithValue }) => {
    try {
      await customerAPI.remove(id);
      return { id };
    } catch (err) {
      return rejectWithValue({ message: err?.message || "Delete failed", id });
    }
  },
);

const slice = createSlice({
  name: "customers",
  initialState,
  reducers: {
    optimisticCreate: {
      reducer(state, action) {
        adapter.addOne(state, action.payload);
      },
      prepare(payload) {
        const temporaryId = payload?.temporaryId || `tmp_${nanoid()}`;
        return {
          payload: {
            ...payload,
            id: temporaryId,
            temporaryId,
            optimistic: true,
          },
        };
      },
    },
    rollbackCreate(state, action) {
      adapter.removeOne(state, action.payload.temporaryId);
    },
    markSaving(state, action) {
      const id = action.payload;
      const existing = state.entities[id];
      if (existing) existing.saving = true;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomers.pending, (state) => {
        state.loading = "pending";
        state.error = null;
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        if (!action.payload?.skipped && Array.isArray(action.payload?.items)) {
          adapter.setAll(state, action.payload.items);
          state.lastFetched = Date.now();
        }
        state.loading = "succeeded";
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = "failed";
        state.error =
          action.payload || action.error?.message || "Failed to load customers";
      })
      .addCase(createCustomer.pending, (state, action) => {
        state.error = null;
      })
      .addCase(createCustomer.fulfilled, (state, action) => {
        const tempId = action.payload?.tempId;
        const item = action.payload?.item;
        if (tempId && state.ids.includes(tempId)) {
          adapter.removeOne(state, tempId);
        }
        if (item) {
          adapter.upsertOne(state, {
            ...item,
            optimistic: false,
            saving: false,
          });
        }
      })
      .addCase(createCustomer.rejected, (state, action) => {
        const tempId = action.payload?.tempId;
        if (tempId) {
          adapter.removeOne(state, tempId);
        }
        state.error =
          action.payload?.message || action.error?.message || "Create failed";
      })
      .addCase(updateCustomer.pending, (state, action) => {
        const id = action.meta?.arg?.id;
        if (id && state.entities[id]) state.entities[id].saving = true;
      })
      .addCase(updateCustomer.fulfilled, (state, action) => {
        const item = action.payload?.item;
        if (item) adapter.upsertOne(state, { ...item, saving: false });
      })
      .addCase(updateCustomer.rejected, (state, action) => {
        const id = action.payload?.id || action.meta?.arg?.id;
        if (id && state.entities[id]) state.entities[id].saving = false;
        state.error =
          action.payload?.message || action.error?.message || "Update failed";
      })
      .addCase(deleteCustomer.pending, (state, action) => {
        const id = action.meta?.arg;
        if (id && state.entities[id]) state.entities[id].deleting = true;
      })
      .addCase(deleteCustomer.fulfilled, (state, action) => {
        const id = action.payload?.id;
        if (id) adapter.removeOne(state, id);
      })
      .addCase(deleteCustomer.rejected, (state, action) => {
        const id = action.payload?.id || action.meta?.arg;
        if (id && state.entities[id]) state.entities[id].deleting = false;
        state.error =
          action.payload?.message || action.error?.message || "Delete failed";
      });
  },
});

export const { optimisticCreate, rollbackCreate, markSaving, clearError } =
  slice.actions;
export default slice.reducer;
export const customerAdapter = adapter;
