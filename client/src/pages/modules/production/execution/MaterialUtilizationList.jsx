/**
 * @fileoverview MaterialUtilizationList component.
 * Displays all Material Utilization logs linked to Production Plans and Job Cards.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, RotateCcw, Package, Layers, Eye, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function MaterialUtilizationList() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/execution/material-utilization");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load material utilization list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, { 
      query: searchTerm, 
      getKeys: (r) => [r.utilization_no, r.plan_no, r.job_card_no, r.receipt_no, r.warehouse_name, r.item_names, r.items_summary, r.status] 
    });
  }, [items, searchTerm]);

  const { sorted, sortKey, sortDir, toggle } = useSort(filtered, "utilization_date", "desc");

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="card">
        <div className="card-header bg-brand-900 text-white dark:bg-brand-950 rounded-t-lg flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300 flex items-center gap-2">
              <Package className="h-7 w-7 text-amber-400" />
              Material Utilization Logs
            </h1>
            <p className="text-sm mt-1 text-slate-100">
              Track actual consumed materials against Production Plans, Job Cards, and Production Warehouses.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link to="/production?section=Shop%20Floor%20%26%20Execution" className="font-sans btn btn-secondary text-sm">
              Return to Menu
            </Link>
            <button
              type="button"
              className="btn-success flex items-center gap-1.5 text-sm font-bold"
              onClick={fetchItems}
              disabled={loading}
            >
              <RotateCcw size={15} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <Link to="/production/execution/material-utilization/new" className="btn-success flex items-center gap-1.5 text-sm font-bold">
              <Plus size={16} /> New Material Utilization
            </Link>
          </div>
        </div>
      </div>

      {/* Search and Filter Row */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by utilization #, item, plan #, job card #, warehouse..."
              className="input pl-10 w-full text-sm font-semibold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className={"w-full text-left text-sm " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead className="bg-brand-900 text-white dark:bg-brand-950 font-bold uppercase tracking-wider border-b border-brand-800 text-xs">
              <tr>
                <SortableHeader label="Utilization No" sortKey="utilization_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-white" />
                <SortableHeader label="Date" sortKey="utilization_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-white" />
                <th className="px-4 py-3.5 text-white">Production Plan</th>
                <th className="px-4 py-3.5 text-white">Job Card #</th>
                <th className="px-4 py-3.5 text-white">Item</th>
                <th className="px-4 py-3.5 text-white text-right">Utilized Qty</th>
                <th className="px-4 py-3.5 text-white">Material Receipt</th>
                <th className="px-4 py-3.5 text-white">Production Warehouse</th>
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-4 py-3.5 text-center text-white" />
                <th className="px-4 py-3.5 text-right text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-slate-400 font-bold">
                    <Loader2 className="animate-spin inline-block mr-2" size={18} />
                    Loading material utilization logs...
                  </td>
                </tr>
              ) : sorted.length > 0 ? (
                sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-brand-600 font-mono">
                      {r.utilization_no}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {r.utilization_date ? new Date(r.utilization_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-200">
                      {r.plan_no || "—"}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">
                      {r.job_card_no || "—"}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-slate-100 max-w-[200px] truncate" title={r.items_summary || r.item_names || ""}>
                      {r.item_names || (r.item_count > 0 ? `${r.item_count} item(s)` : "—")}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100 text-right whitespace-nowrap">
                      {r.total_utilized_qty !== undefined && r.total_utilized_qty !== null ? (
                        <span>
                          {Number(r.total_utilized_qty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {r.uom ? <span className="text-xs text-slate-500 font-normal ml-1">{r.uom}</span> : ""}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {r.receipt_no || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                      {r.warehouse_name || "Production Store"}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {r.status || "COMPLETED"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link
                        to={`/production/execution/material-utilization/${r.id}`}
                        className="btn btn-secondary text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Eye size={13} /> View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-slate-400 font-medium">
                    No material utilization logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
