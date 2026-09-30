/**
 * @fileoverview ExecFastMovingItemsPage component.
 * Provides functionality for ExecFastMovingItemsPage.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import * as XLSX from "xlsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ExecFastMovingItemsPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/inventory/reports/fast-moving", { params: { from: from || null, to: to || null } });
      setItems(res.data?.items || []);
    } catch (e) { toast.error("Failed to load report"); }
    finally { setLoading(false); }
  }

  useEffect(() => { run(); }, [pollingCounter]); // eslint-disable-line
  useEffect(() => { if (from || to) run(); }, [from, to, pollingCounter]); // eslint-disable-line

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <button onClick={() => window.history.back()} className="text-xs font-bold text-brand uppercase tracking-wider">← Back to Executive Overview</button>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2">🚀 Fast Moving Items</h1>
          <p className="text-slate-500 text-sm mt-1">Items with highest stock turnover in the period</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => { const ws = XLSX.utils.json_to_sheet(items); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "FastMoving"); XLSX.writeFile(wb, "fast-moving.xlsx"); }} disabled={!items.length}>📊 Excel</button>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">From:</span>
            <input className="input input-bordered input-sm" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">To:</span>
            <input className="input input-bordered input-sm" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button className="btn btn-ghost btn-sm text-brand" onClick={() => { setFrom(""); setTo(""); run(); }}>Reset</button>
          {loading && <span className="loading loading-spinner loading-sm text-brand"></span>}
        </div>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full text-sm">
            <thead className="bg-cyan-700 text-white">
              <tr>
                <th className="py-3 text-xs uppercase">#</th>
                <th className="py-3 text-xs uppercase">Item</th>
                <th className="text-right py-3 text-xs uppercase">Issued Qty</th>
                <th className="text-right py-3 text-xs uppercase">Turnover</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && <tr><td colSpan={4} className="text-center py-10 text-slate-400">No records found</td></tr>}
              {items.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                  <td className="text-slate-400 text-xs">{i + 1}</td>
                  <td className="font-medium text-slate-700 dark:text-slate-200">{r.item_name || r.item_code}</td>
                  <td className="text-right font-mono">{Number(r.issued_qty || 0).toLocaleString()}</td>
                  <td className="text-right font-mono font-bold text-cyan-700 dark:text-cyan-400">{Number(r.turnover || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
