/**
 * @fileoverview A table header component that supports clickable sorting.
 * Displays interactive up/down arrows indicating the current sort direction.
 */

import React from "react";
import { ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";

/**
 * Determines the justify-content class based on text alignment classes.
 * @param {string} className - The CSS classes.
 * @returns {string} The justify class string.
 */
function getJustifyClass(className) {
  if (className.includes("text-right")) return "justify-end";
  if (className.includes("text-center")) return "justify-center";
  return "justify-start";
}

/**
 * SortableHeader component
 * 
 * @param {Object} props
 * @param {string} props.label - The visible text label for the column header.
 * @param {string} props.sortKey - The underlying data key associated with this column.
 * @param {string} props.currentKey - The key that is currently being sorted by the table.
 * @param {string} props.direction - The current sort direction ('asc' or 'desc').
 * @param {Function} props.onToggle - Callback triggered when the header is clicked, passing the `sortKey`.
 * @param {string} [props.className=""] - Additional CSS classes.
 * @returns {JSX.Element} The rendered table header cell (`<th>`).
 */
export default function SortableHeader({
  label,
  sortKey,
  currentKey,
  direction,
  onToggle,
  className = "",
}) {
  const active = currentKey === sortKey;
  const justifyClass = getJustifyClass(className);
  const ariaSort = active
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  const renderIcon = () => {
    if (!active) {
      return <ArrowUpDown className="h-4 w-4 opacity-0 group-hover:opacity-40 transition-opacity duration-200" />;
    }
    return direction === "asc" ? (
      <ArrowUp className="h-4 w-4 text-brand-600 dark:text-brand-400 opacity-100 transition-transform duration-200" />
    ) : (
      <ArrowDown className="h-4 w-4 text-brand-600 dark:text-brand-400 opacity-100 transition-transform duration-200" />
    );
  };

  const textColorClass = className.includes("text-white") 
    ? (active ? "text-white font-extrabold" : "text-white font-bold group-hover:text-white")
    : (active ? "text-slate-900 dark:text-slate-100 font-bold" : "text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-slate-200");

  return (
    <th
      className={`select-none font-bold transition-colors group ${active ? "bg-white/10 dark:bg-slate-800/50" : "hover:bg-white/5 dark:hover:bg-slate-800/30"} ${className}`}
      title={`Sort by ${label}`}
      aria-sort={ariaSort}
    >
      <button
        type="button"
        className={`flex w-full items-center gap-2 ${justifyClass} bg-transparent py-3 px-2 outline-none rounded-md`}
        onClick={() => onToggle(sortKey)}
      >
        <span className={textColorClass}>
          {label}
        </span>
        <span className="inline-flex items-center" aria-hidden="true">
          {renderIcon()}
        </span>
      </button>
    </th>
  );
}
