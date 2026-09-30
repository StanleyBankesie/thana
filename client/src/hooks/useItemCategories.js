/**
 * @file useItemCategories.js
 * @description Hook to fetch and provide item categories from the Redux store.
 */

import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchCategories as fetchCategoriesThunk } from "../store/inventoryRefSlice";

/**
 * Hook to retrieve item categories, automatically fetching them if not already loaded.
 * @returns {Object} An object containing the categories and fetching state.
 * @returns {Array} returns.categories - The list of item categories.
 * @returns {boolean} returns.loading - Indicates if categories are currently being fetched.
 * @returns {string|null} returns.error - Error message if fetching categories fails.
 * @returns {Function} returns.refresh - Function to manually trigger a fetch of categories.
 */
export function useItemCategories() {
  const dispatch = useDispatch();
  const categories = useSelector((s) => s.inventoryRef.categories);
  const status = useSelector((s) => s.inventoryRef.status.categories);
  const error = useSelector((s) => s.inventoryRef.error.categories);

  const refresh = useCallback(() => {
    dispatch(fetchCategoriesThunk());
  }, [dispatch]);

  useEffect(() => {
    if (
      status === "idle" ||
      (status === "failed" &&
        (!Array.isArray(categories) || categories.length === 0))
    ) {
      dispatch(fetchCategoriesThunk());
    }
  }, [categories, dispatch, status]);

  return { categories, loading: status === "loading", error, refresh };
}
