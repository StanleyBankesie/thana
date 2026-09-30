/**
 * @fileoverview AllowanceList component.
 * Provides functionality for AllowanceList.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function AllowanceList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/allowances");
      setItems(res.data.items || []);
    } catch {
      toast.error("Failed to load allowances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Employee Allowances</h1>
            <p className="text-sm text-slate-500">Manage recurring employee allowances</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.history.back()} className="btn-secondary">Back</button>
            <Link to="/human-resources/allowances/new" className="btn-primary">+ New Allowance</Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
          <div className="flex justify-end mb-4">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
          <table className={"min-w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
              <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Code</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Amount</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Taxable</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created By</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created Date</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{r.allowance_code}</td>
                  <td className="px-4 py-3 text-sm">{r.allowance_name}</td>
                  <td className="px-4 py-3 text-sm">{r.amount_type}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono">
                    {Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    {r.amount_type === 'PERCENTAGE' ? '%' : ''}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.is_taxable ? 'Yes' : 'No'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {r.is_active ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{r.created_by_name || "-"}</td>
                  <td className="px-4 py-3 text-sm">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    <Link to={`/human-resources/allowances/${r.id}`} className="text-brand hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    No allowances found. Click "+ New Allowance" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Guard>
  );
}







