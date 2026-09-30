/**
 * @fileoverview Reusable component for rendering and managing sortable tables.
 * Includes data comparison logic and sort state management.
 */

import React, { useState, useMemo, useCallback } from "react";

export { default as SortableHeader } from "./SortableHeader.jsx";
export { default as useSort } from "../hooks/useSort.js";

/**
 * Compare two values dynamically for table sorting.
 * @param {*} a - First value.
 * @param {*} b - Second value.
 * @returns {number} Comparison result (-1, 0, or 1).
 */
function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  const aStr = String(a).toLowerCase();
  const bStr = String(b).toLowerCase();

  const aNum = parseFloat(aStr);
  const bNum = parseFloat(bStr);
  if (!isNaN(aNum) && !isNaN(bNum) && String(aNum) === aStr && String(bNum) === bStr) {
    return aNum - bNum;
  }

  if (aStr < bStr) return -1;
  if (aStr > bStr) return 1;
  return 0;
}

/**
 * SortableTable component
 * Wraps around children elements to inject sorted data, sort key, direction, and toggle handler.
 * 
 * @param {Object} props
 * @param {Array} props.data - Raw data array to be sorted.
 * @param {string} props.defaultSortKey - Initial key to sort by.
 * @param {string} props.defaultSortDir - Initial sort direction ('asc' or 'desc').
 * @param {Function|React.ReactNode} props.children - Child element or render prop function.
 * @returns {JSX.Element} The rendered sorted table wrapper.
 */
export default function SortableTable({
  data,
  defaultSortKey = "",
  defaultSortDir = "asc",
  children,
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState(defaultSortDir);

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

  if (typeof children === "function") {
    return children({ sorted, sortKey, sortDir, toggle });
  }

  return children;
}
