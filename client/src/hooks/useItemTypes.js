/**
 * @file useItemTypes.js
 * @description Hook to fetch and provide item types from the Redux store.
 */

import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchItemTypes as fetchItemTypesThunk } from "../store/inventoryRefSlice";

/**
 * Hook to retrieve item types, automatically fetching them if not already loaded.
 * @returns {Object} An object containing the item types and fetching state.
 * @returns {Array} returns.itemTypes - The list of item types.
 * @returns {boolean} returns.loading - Indicates if item types are currently being fetched.
 * @returns {string|null} returns.error - Error message if fetching item types fails.
 * @returns {Function} returns.refresh - Function to manually trigger a fetch of item types.
 */
export function useItemTypes() {
  const dispatch = useDispatch();
  const itemTypes = useSelector((s) => s.inventoryRef.itemTypes);
  const status = useSelector((s) => s.inventoryRef.status?.itemTypes);
  const error = useSelector((s) => s.inventoryRef.error?.itemTypes);

  const refresh = useCallback(() => {
    dispatch(fetchItemTypesThunk());
  }, [dispatch]);

  useEffect(() => {
    const hasData = Array.isArray(itemTypes) && itemTypes.length > 0;
    if (status == null) {
      dispatch(fetchItemTypesThunk());
      return;
    }
    if (status === "idle") {
      dispatch(fetchItemTypesThunk());
      return;
    }
    if (status === "failed" && !hasData) {
      dispatch(fetchItemTypesThunk());
    }
  }, [dispatch, itemTypes, status]);

  return { itemTypes, loading: status === "loading", error, refresh };
}
