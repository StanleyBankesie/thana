import React from "react";
import { List, LayoutGrid } from "lucide-react";

/**
 * ViewToggle component
 * Renders modern, responsive List / Grid view switcher buttons across all ERP list pages.
 * 
 * @param {Object} props
 * @param {string} props.viewMode - Current view mode: 'table' (List) or 'grid' (Grid)
 * @param {Function} props.setViewMode - State setter function
 */
export default function ViewToggle({ viewMode, setViewMode }) {
  return (
    <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/70 shadow-sm shrink-0 transition-all">
      <button
        type="button"
        onClick={() => setViewMode("table")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          viewMode === "table"
            ? "bg-white dark:bg-slate-900 text-brand dark:text-brand-400 shadow-sm ring-1 ring-slate-200/60 dark:ring-slate-700/60"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        title="List / Table View"
      >
        <List className="w-3.5 h-3.5" />
        <span>List</span>
      </button>

      <button
        type="button"
        onClick={() => setViewMode("grid")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          viewMode === "grid"
            ? "bg-white dark:bg-slate-900 text-brand dark:text-brand-400 shadow-sm ring-1 ring-slate-200/60 dark:ring-slate-700/60"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        title="Grid Card View"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span>Grid</span>
      </button>
    </div>
  );
}
