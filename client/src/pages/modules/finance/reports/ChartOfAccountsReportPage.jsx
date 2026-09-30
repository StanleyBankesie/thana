/**
 * @fileoverview ChartOfAccountsReportPage component.
 * Provides functionality for ChartOfAccountsReportPage.
 */

import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../../../api/client.js";
import * as XLSX from "xlsx";
import { autosizeWorksheetColumns } from "../../../../utils/xlsxUtils.js";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { Link } from "react-router-dom";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ChartOfAccountsReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) =>
        String(r.code || "").toLowerCase().includes(q) ||
        String(r.name || "").toLowerCase().includes(q) ||
        String(r.group_name || "").toLowerCase().includes(q) ||
        String(r.parent_group_name || "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/finance/reports/chart-of-accounts", {
        params: { search },
      });
      setItems(res.data?.items || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollingCounter]);

  const exportExcel = () => {
    const rows = filtered.map((r) => ({
      Code: r.code,
      Name: r.name,
      Group: r.group_name,
      GroupNature: r.nature,
      ParentGroup: r.parent_group_name || "",
      Postable: r.is_postable ? "Yes" : "No",
      Active: r.is_active ? "Yes" : "No",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    autosizeWorksheetColumns(ws, { min: 12, max: 40 });
    XLSX.utils.book_append_sheet(wb, ws, "Chart of Accounts");
    XLSX.writeFile(wb, "Chart_of_Accounts.xlsx");
  };

  return (
    <Guard moduleKey="finance">
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Chart of Accounts</h1>
            <p className="text-sm text-slate-500">
              Visual table of accounts grouped by parent groups. Export to Excel.
            </p>
          </div>
          <button onClick={() => window.history.back()} className="font-sans btn-secondary text-sm">
            Back to Finance
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="label text-[10px]">Search</label>
            <input
              className="input h-9 text-sm"
              placeholder="Search code/name/group"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-primary h-9 px-4 text-sm" onClick={load}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button className="btn-secondary h-9 px-4 text-sm" onClick={exportExcel}>
            Export Excel
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase">Accounts</h2>
            <span className="text-xs text-slate-500">{filtered.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr className="text-left text-[10px] font-bold uppercase text-slate-500 border-b">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Group</th>
                  <th className="px-4 py-3">Nature</th>
                  <th className="px-4 py-3">Parent Group</th>
                  <th className="px-4 py-3">Postable</th>
                  <th className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-mono">{r.code}</td>
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3">{r.group_name}</td>
                    <td className="px-4 py-3">{r.nature}</td>
                    <td className="px-4 py-3">{r.parent_group_name || "-"}</td>
                    <td className="px-4 py-3">{r.is_postable ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{r.is_active ? "Yes" : "No"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500 italic">
                      No accounts match the search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Guard>
  );
}
