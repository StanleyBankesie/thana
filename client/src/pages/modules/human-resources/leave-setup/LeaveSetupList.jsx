/**
 * @fileoverview LeaveSetupList component.
 * Provides functionality for LeaveSetupList.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LeaveSetupList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/leave/types");
      setItems(res?.data?.items || []);
    } catch {
      toast.error("Failed to load leave types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            Back
          </button>
          <h2 className="text-lg font-semibold">Leave Setup</h2>
        </div>
        <Link to="/human-resources/leave-setup/new" className="btn-primary">
          + New Leave Type
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
        
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
          <table className={ "min-w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
            <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
              <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type Name</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Days Per Year</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Paid</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created By</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created Date</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-2 font-medium">{r.type_name}</td>
                  <td className="px-4 py-2">{r.max_days}</td>
                  <td className="px-4 py-2">
                    {r.is_paid ? <span className="text-green-600">Yes</span> : <span className="text-red-600">No</span>}
                  </td>
                  <td className="px-4 py-2">{r.created_by_name || "-"}</td>
                  <td className="px-4 py-2">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/human-resources/leave-setup/${r.id}`} className="text-brand hover:underline text-sm">Edit</Link>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">No leave types configured</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}







