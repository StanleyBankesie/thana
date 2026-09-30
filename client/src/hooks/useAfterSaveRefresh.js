/**
 * @file useAfterSaveRefresh.js
 * @description Custom hook to refresh data after a save operation.
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { consumeRefresh } from "../store/ui/refreshSlice.js";

/**
 * Hook to trigger a data refresh when navigating back from a save operation.
 * @param {string} entityKey - The key identifying the entity being refreshed.
 * @param {Function} fetchThunk - The thunk or action to dispatch for refreshing data.
 */
export function useAfterSaveRefresh(entityKey, fetchThunk) {
  const location = useLocation();
  const dispatch = useDispatch();
  useEffect(() => {
    const s = location.state && location.state.afterSave;
    if (!s || s.entity !== entityKey) return;

    const executeRefresh = () => {
      const result = fetchThunk({ force: true });
      // If result is a thunk (function) or a plain action object (object with type), dispatch it.
      // If it's a Promise, it's already executing (async function).
      // If it's undefined or something else, we assume it was a regular function that did its job.
      if (
        typeof result === "function" ||
        (typeof result === "object" && result !== null && result.type)
      ) {
        dispatch(result);
      }
    };

    executeRefresh();
    const id = s.id || null;
    if (id) {
      setTimeout(executeRefresh, 500);
    }
    try {
      window.history.replaceState({}, "");
    } catch {}
    dispatch(consumeRefresh(entityKey));
  }, [location.state, dispatch, entityKey, fetchThunk]);
}

export default useAfterSaveRefresh;
