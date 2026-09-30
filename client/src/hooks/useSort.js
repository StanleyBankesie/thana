/**
 * @fileoverview React hook for managing client-side sorting of arrays.
 * Provides sort state (key, direction) and sorting functions for data tables.
 */

import { useState, useMemo, useCallback } from "react";

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  // Check if both values can be treated as numbers
  const aClean = String(a).replace(/,/g, "").trim();
  const bClean = String(b).replace(/,/g, "").trim();
  if (aClean !== "" && bClean !== "" && !isNaN(Number(aClean)) && !isNaN(Number(bClean))) {
    const aNum = Number(aClean);
    const bNum = Number(bClean);
    return aNum - bNum;
  }

  // Check if both values are valid ISO date strings
  const aDate = Date.parse(a);
  const bDate = Date.parse(b);
  if (!isNaN(aDate) && !isNaN(bDate) && String(a).includes("-") && String(b).includes("-")) {
    return aDate - bDate;
  }

  const aStr = String(a).toLowerCase();
  const bStr = String(b).toLowerCase();

  if (aStr < bStr) return -1;
  if (aStr > bStr) return 1;
  return 0;
}

/**
 * useSort hook
 * Manages sort configuration and applies sorting logic to a dataset.
 * 
 * @param {Array} data - The array of objects to sort.
 * @param {string} defaultKey - The default property key to sort by.
 * @param {string} defaultDir - The default sort direction ('asc' or 'desc').
 * @returns {Object} An object containing the sorted data, current sortKey, sortDir, and a toggle function.
 */
export default function useSort(data, defaultKey = "", defaultDir = "asc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const toggle = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sortKey || !Array.isArray(data)) return data;
    return [...data].sort((a, b) => {
      const result = compareValues(a[sortKey], b[sortKey]);
      return sortDir === "asc" ? result : -result;
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggle };
}
