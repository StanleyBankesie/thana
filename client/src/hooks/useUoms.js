/**
 * @file useUoms.js
 * @description Hook to fetch and provide Units of Measure (UOMs) from the Redux store.
 */

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUoms } from "../store/inventoryRefSlice";

/**
 * Hook to retrieve units of measure, automatically fetching them if not already loaded.
 * @param {number} [refreshTrigger=0] - An optional trigger to force a refresh when it changes.
 * @returns {Object} An object containing the UOMs and fetching state.
 * @returns {Array} returns.uoms - The list of units of measure.
 * @returns {boolean} returns.loading - Indicates if UOMs are currently being fetched.
 * @returns {string|null} returns.error - Error message if fetching UOMs fails.
 * @returns {Function} returns.refresh - Function to manually trigger a fetch of UOMs.
 */
export const useUoms = (refreshTrigger = 0) => {
  const dispatch = useDispatch();
  const uoms = useSelector((s) => s.inventoryRef.uoms);
  const status = useSelector((s) => s.inventoryRef.status.uoms);
  const error = useSelector((s) => s.inventoryRef.error.uoms);

  useEffect(() => {
    if (status === "idle" || refreshTrigger) {
      dispatch(fetchUoms());
    }
  }, [dispatch, status, refreshTrigger]);

  const refresh = () => {
    dispatch(fetchUoms());
  };

  return { uoms, loading: status === "loading", error, refresh };
};
