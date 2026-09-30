/**
 * @fileoverview List view component for displaying all registered warehouses.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import { filterAndSort } from "@/utils/searchUtils.js";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 * WarehousesList component
 * Fetches and renders a searchable table of warehouses.
 * 
 * @returns {JSX.Element} The warehouse listing page.
 */
export default function WarehousesList() {
  const [viewMode, setViewMode] = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/inventory/warehouses", { params: { active: "all" } })
      .then((res) => {
        if (!mounted) return;
        setWarehouses(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load warehouses");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return warehouses.slice();
    return filterAndSort(warehouses, {
      query: searchTerm,
      getKeys: (w) => [w.warehouse_code, w.warehouse_name, w.location],
    });
  }, [warehouses, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Warehouse Setup
              </h1>
              <p className="text-sm mt-1">
                Configure warehouses for stock operations
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/inventory/warehouses/new" className="btn-success">
                + New Warehouse
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by code, name, location..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={ "table table-fixed " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                                <th>Created By</th>
                <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && !filtered.length ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No warehouses found
                    </td>
                  </tr>
                ) : null}

                {filtered.map((w) => (
                  <tr key={w.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {w.warehouse_code}
                    </td>
                    <td>{w.warehouse_name}</td>
                    <td>{w.location || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          Number(w.is_active) === 1
                            ? "badge-success"
                            : "badge-error"
                        }`}
                      >
                        {Number(w.is_active) === 1 ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Link
                          to={`/inventory/warehouses/${w.id}?mode=view`}
                          className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          View
                        </Link>
                        <Link
                          to={`/inventory/warehouses/${w.id}?mode=edit`}
                          className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                    <td>{w.created_by_name || "-"}</td>
                    <td>{w.created_at ? new Date(w.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
