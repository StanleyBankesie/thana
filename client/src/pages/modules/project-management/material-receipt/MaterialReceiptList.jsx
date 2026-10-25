/**
 * @fileoverview MaterialReceiptList component.
 * Provides functionality for MaterialReceiptList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RefreshCw, ArrowLeft, PackageCheck, Search } from "lucide-react";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 * MaterialReceiptList component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaterialReceiptList() {
  const [viewMode, setViewMode] = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [pendingIssues, setPendingIssues] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    let mounted = true;
    setLoading(true);
    try {
      const [res, pendRes] = await Promise.all([
        api.get("/projects/material-receipts"),
        api.get("/projects/issue-to-requirement/pm")
      ]);
      if (mounted) {
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
        const allPending = Array.isArray(pendRes.data?.items) ? pendRes.data.items : [];
        const projectPending = allPending.filter(
          (iss) => (iss.department_name || "").toLowerCase().includes("project"),
        );
        setPendingIssues(projectPending.length);
      }
    } catch (e) {
      if (mounted) setError(e?.response?.data?.message || "Failed to load");
    } finally {
      if (mounted) setLoading(false);
    }
    return () => { mounted = false; };
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, { query: searchTerm, getKeys: (r) => [r.receipt_no, r.warehouse_name, r.department_name] });
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
              <PackageCheck size={26} className="text-brand-900 dark:text-brand-400" />
              Materials Receipt
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Receive materials issued from Inventory (Project Management department)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={loadData} className="btn btn-secondary p-2.5" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <Link
            to="/project-management/material-receipts/new"
            className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> Receive{pendingIssues > 0 ? ` (${pendingIssues})` : ""}
          </Link>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm">
          {error}
        </div>
      ) : null}

      <div className="card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipts..."
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
          <table className={"table w-full text-sm " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <SortableHeader label="Receipt No" sortKey="receipt_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Date" sortKey="receipt_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <th>Warehouse</th>
                <th>Department</th>
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan="6" className="text-center py-10 text-slate-400">Loading receipts...</td></tr>
              ) : sorted.length > 0 ? sorted.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="font-semibold text-slate-900 dark:text-slate-100">{r.receipt_no}</td>
                  <td className="text-slate-600 dark:text-slate-300 whitespace-nowrap">{r.receipt_date ? new Date(r.receipt_date).toLocaleDateString() : "—"}</td>
                  <td className="text-slate-600 dark:text-slate-300">{r.warehouse_name || "—"}</td>
                  <td className="text-slate-600 dark:text-slate-300">{r.department_name || "—"}</td>
                  <td>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {r.status}
                    </span>
                  </td>
                  <td className="text-center">
                    <Link
                      to={`/project-management/material-receipts/${r.id}`}
                      className="btn btn-outline text-xs px-3 py-1.5"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    {pendingIssues > 0 ? `${pendingIssues} pending issue(s) from inventory. Create a receipt to receive them.` : "No receipts found."}
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
