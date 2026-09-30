/**
 * @fileoverview SuppliersList component.
 * Provides functionality for SuppliersList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SuppliersList() {
  const [viewMode, setViewMode] = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { canPerformAction } = usePermission();
  const location = useLocation();

  const loadSuppliers = () => {
    let mounted = true;
    setLoading(true);
    setError("");
    api
      .get("/purchase/suppliers")
      .then((res) => {
        if (!mounted) return;
        setSuppliers(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load suppliers");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  };

  useEffect(() => {
    const cleanup = loadSuppliers();
    return cleanup;
  }, []);

  useEffect(() => {
    const s = location.state && location.state.afterSave;
    if (!s || s.entity !== "suppliers") return;
    loadSuppliers();
    setTimeout(() => loadSuppliers(), 500);
    try {
      window.history.replaceState({}, "");
    } catch {}
  }, [location.state]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return suppliers.slice();
    return filterAndSort(suppliers, {
      query: searchTerm,
      getKeys: (s) => [s.supplier_code, s.supplier_name, s.phone, s.email],
    });
  }, [suppliers, searchTerm]);

  const { sorted: sortedFiltered, sortKey, sortDir, toggle } = useSort(filtered, "created_at", "desc");

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Supplier Details Setup
              </h1>
              <p className="text-sm mt-1">
                Add and manage supplier master data
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/purchase?section=Procurement" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/purchase/suppliers/new" className="btn-success">
                + New Supplier
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
              placeholder="Search by code, name, phone, email..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <SortableHeader label="Code" sortKey="supplier_code" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Name" sortKey="supplier_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Phone" sortKey="phone" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Email" sortKey="email" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Status" sortKey="is_active" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th>Actions</th>
                  <SortableHeader label="Created By" sortKey="created_by_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && !filtered.length ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No suppliers found
                    </td>
                  </tr>
                ) : null}

                {sortedFiltered.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {s.supplier_code || "-"}
                    </td>
                    <td>{s.supplier_name}</td>
                    <td>{s.phone || "-"}</td>
                    <td>{s.email || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          s.is_active ? "badge-success" : "badge-error"
                        }`}
                      >
                        {s.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/purchase/suppliers/${s.id}?mode=view`}
                        className={`text-brand hover:text-brand-700 text-sm font-medium ${!canPerformAction("purchase:suppliers", "view") ? 'invisible pointer-events-none' : ''}`}
                      >
                        View
                      </Link>
                      <Link
                        to={`/purchase/suppliers/${s.id}?mode=edit`}
                        className={`text-blue-600 hover:text-blue-700 text-sm font-medium ml-2 ${!canPerformAction("purchase:suppliers", "edit") ? 'invisible pointer-events-none' : ''}`}
                      >
                        Edit
                      </Link>
                    </td>
                    <td>{s.created_by_name || "-"}</td>
                    <td>{s.created_at ? new Date(s.created_at).toLocaleDateString() : "-"}</td>
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
