/**
 * @fileoverview A reusable data table component with search, filtering, and pagination support.
 */

import React from "react";

/**
 * DataTable component
 * Renders a data grid with optional search input, action buttons, and pagination controls.
 * 
 * @param {Object} props
 * @param {Array} props.columns - Column definitions.
 * @param {Array} props.rows - Data objects to display.
 * @param {boolean} props.loading - Loading state indicator.
 * @param {Function} props.onSearch - Callback for the search input.
 * @param {Function} props.onFilter - Callback for filtering (if implemented).
 * @param {JSX.Element} props.actions - Additional action buttons to display.
 * @param {Object} props.pagination - Pagination configuration and callbacks.
 * @returns {JSX.Element} The rendered data table.
 */
export default function DataTable({
  columns,
  rows,
  loading,
  onSearch,
  onFilter,
  actions,
  pagination,
}) {
  const [q, setQ] = React.useState("");
  return (
    <div className="bg-white dark:bg-slate-800 rounded shadow-sm">
      <div className="p-3 flex items-center gap-3">
        <input
          className="input w-64"
          placeholder="Search..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn-secondary" onClick={() => onSearch?.(q)}>
          Search
        </button>
        <div className="ml-auto">{actions}</div>
      </div>
      <table className="min-w-full">
        <thead>
          <tr className="text-left">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="px-3 py-6 text-center text-sm" colSpan={columns.length}>
                Loading...
              </td>
            </tr>
          ) : rows.length ? (
            rows.map((r, i) => (
              <tr key={r.id || i} className="border-t">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2">
                    {c.render ? c.render(r[c.key], r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-6 text-center text-sm" colSpan={columns.length}>
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {pagination ? (
        <div className="p-3 flex items-center justify-end gap-2">
          <button type="button" className="btn-outline" onClick={pagination.prev} disabled={!pagination.hasPrev}>
            Prev
          </button>
          <button type="button" className="btn-outline" onClick={pagination.next} disabled={!pagination.hasNext}>
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
