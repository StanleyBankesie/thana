/**
 * @fileoverview MaterialUtilizationList component.
 * Provides functionality for MaterialUtilizationList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowLeft, RefreshCw, Wrench, Search } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
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
export default function MaterialUtilizationList() {
  const [viewMode, setViewMode] = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);

  const fetchItems = () => {
    setLoading(true);
    api.get("/projects/material-utilizations")
      .then(res => { setItems(Array.isArray(res.data?.items) ? res.data.items : []); })
      .catch(e => setError(e?.response?.data?.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const handleConfirm = async (id) => {
    setConfirmingId(id);
    try {
      await api.post(`/projects/material-utilizations/${id}/confirm`);
      toast.success("Utilization confirmed and stock deducted");
      fetchItems();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to confirm");
    } finally {
      setConfirmingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, { query: searchTerm, getKeys: (r) => [r.utilization_no, r.project_name, r.task_summary, r.warehouse_name, r.status] });
  }, [items, searchTerm]);

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, "created_at", "desc");

  return (
    <div className="space-y-6">
      {/* Canonical ERP Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <Wrench size={26} className="text-brand-900 dark:text-brand-400" />
              Material Utilization
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Track material consumption against projects and tasks
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={fetchItems} className="btn btn-secondary p-2.5" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <Link
            to="/project-management/material-utilizations/new"
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> New Utilization
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search utilization..."
              className="input pl-9 w-full text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>

          
                
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <SortableHeader label="Utilization No" sortKey="utilization_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="utilization_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th>Project</th>
                  <th>Task Summary</th>
                  <th>Storage/Warehouse</th>
                  <th>Status</th>
                  <SortableHeader label="Created By" sortKey="created_by_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="w-px whitespace-nowrap pl-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" className="text-center py-8 text-slate-400">Loading...</td></tr>
                ) : sorted.length > 0 ? sorted.map(r => (
                  <tr key={r.id}>
                    <td className="font-medium text-sm">{r.utilization_no}</td>
                    <td className="text-sm whitespace-nowrap">{r.utilization_date ? new Date(r.utilization_date).toLocaleDateString() : "—"}</td>
                    <td className="text-sm">{r.project_name || "—"}</td>
                    <td className="text-sm max-w-[200px] truncate">{r.task_summary || "—"}</td>
                    <td className="text-sm">{r.warehouse_name || "—"}</td>
                    <td className="text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        r.status === "POSTED" ? "bg-green-100 text-green-700" :
                        r.status === "DRAFT" ? "bg-yellow-100 text-yellow-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {r.status || "DRAFT"}
                      </span>
                    </td>
                    <td className="text-sm">{r.created_by_name || "—"}</td>
                    <td className="text-sm whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                    <td className="w-px whitespace-nowrap pl-4">
                      <div className="flex items-center gap-2">
                        {r.status === "DRAFT" && (
                          <button
                            type="button"
                            className="btn btn-primary text-xs px-2.5 py-1 disabled:opacity-50"
                            disabled={confirmingId === r.id}
                            onClick={() => handleConfirm(r.id)}
                          >
                            {confirmingId === r.id ? "Confirming..." : "Confirm"}
                          </button>
                        )}
                        <Link to={`/project-management/material-utilizations/${r.id}`}
                          className="btn btn-outline text-xs px-2.5 py-1 inline-block">View</Link>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="9" className="text-center py-8 text-slate-400">No utilization records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
}