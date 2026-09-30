/**
 * @fileoverview Redux selectors for the customers module.
 * Provides memoized functions to access customer data from the global store.
 */

import { createSelector } from "@reduxjs/toolkit";
import { filterAndSort } from "../../utils/searchUtils.js";
import { customerAdapter } from "./customerSlice.js";

const selectSlice = (state) => state.entities?.customers;

const baseSelectors = customerAdapter.getSelectors(selectSlice);

export const selectAllCustomers = baseSelectors.selectAll;
export const selectCustomerById = baseSelectors.selectById;
export const selectCustomerIds = baseSelectors.selectIds;
export const selectCustomersLoading = (state) =>
  state.entities?.customers?.loading;
export const selectCustomersError = (state) => state.entities?.customers?.error;

/**
 * Creates a memoized selector to filter customers based on a search term.
 * Filters across customer_code, customer_name, and email.
 * 
 * @returns {Function} Memoized selector function.
 */
export const makeSelectCustomersBySearch = () =>
  createSelector(
    [selectAllCustomers, (_, term) => String(term || "")],
    (items, term) => {
      const t = String(term || "").trim();
      if (!t) return items.slice();
      return filterAndSort(items, {
        query: t,
        getKeys: (r) => [r.customer_code, r.customer_name, r.email],
      });
    },
  );
