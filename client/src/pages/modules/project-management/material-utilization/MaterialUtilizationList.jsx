/**
 * @fileoverview MaterialUtilizationList component.
 * Provides functionality for MaterialUtilizationList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
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
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Material Utilization</h1>
              <p className="text-sm mt-1">Track material consumption against projects and tasks</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn btn-secondary">Back</button>
              <Link to="/project-management/material-utilizations/new" className="btn-success flex items-center gap-2"><Plus size={16} />New Utilization</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input type="text" placeholder="Search utilization..." className="input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
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
                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                            disabled={confirmingId === r.id}
                            onClick={() => handleConfirm(r.id)}
                          >
                            {confirmingId === r.id ? "Confirming..." : "Confirm"}
                          </button>
                        )}
                        <Link to={`/project-management/material-utilizations/${r.id}`}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 inline-block">View</Link>
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
    </div>
  );
}
