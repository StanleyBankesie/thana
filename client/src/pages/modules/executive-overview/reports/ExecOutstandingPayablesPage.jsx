/**
 * @fileoverview ExecOutstandingPayablesPage component.
 * Provides functionality for ExecOutstandingPayablesPage.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import * as XLSX from "xlsx";

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ExecOutstandingPayablesPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const totalOutstanding = items.reduce((s, r) => s + Number(r.outstanding || 0), 0);
  const totalOverdue = items.filter(r => r.status === "OVERDUE").reduce((s, r) => s + Number(r.outstanding || 0), 0);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/payment-due", { params: { from: from || null, to: to || null } });
      setItems(res.data?.items || []);
    } catch (e) { toast.error("Failed to load report"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const today = new Date();
    const jan1 = new Date(today.getFullYear(), 0, 1);
    setFrom(jan1.toISOString().slice(0, 10));
    setTo(today.toISOString().slice(0, 10));
  }, []);
  useEffect(() => { run(); }, [from, to, pollingCounter]); // eslint-disable-line

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <button onClick={() => window.history.back()} className="text-xs font-bold text-brand uppercase tracking-wider">← Back to Executive Overview</button>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2">Outstanding Payables</h1>
          <p className="text-slate-500 text-sm mt-1">Supplier payments due and overdue</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => { const ws = XLSX.utils.json_to_sheet(items); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Payables"); XLSX.writeFile(wb, "outstanding-payables.xlsx"); }} disabled={!items.length}>📊 Excel</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Payables", value: totalOutstanding, color: "border-orange-500", text: "text-slate-900 dark:text-slate-100" },
          { label: "Overdue", value: totalOverdue, color: "border-rose-500", text: "text-rose-600" },
          { label: "Transactions", value: items.length, color: "border-blue-500", text: "text-slate-900 dark:text-slate-100", raw: true },
        ].map((k, i) => (
          <div key={i} className={`bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 ${k.color} border-y border-r border-slate-200 dark:border-slate-700 shadow-sm`}>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{k.label}</p>
            <h3 className={`text-2xl font-black mt-1 ${k.text}`}>{k.raw ? k.value : `₵${fmt(k.value)}`}</h3>
          </div>
        ))}
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
          {loading && <span className="loading loading-spinner loading-sm text-brand"></span>}
        </div>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full text-sm">
            <thead className="bg-orange-700 text-white">
              <tr>
                <th className="py-3 text-xs uppercase">Due Date</th>
                <th className="py-3 text-xs uppercase">Reference</th>
                <th className="py-3 text-xs uppercase">Party</th>
                <th className="text-right py-3 text-xs uppercase">Amount</th>
                <th className="text-right py-3 text-xs uppercase">Outstanding</th>
                <th className="py-3 text-xs uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && <tr><td colSpan={6} className="text-center py-10 text-slate-400">No records found</td></tr>}
              {items.map((r, i) => (
                <tr key={i} className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 ${r.status === "OVERDUE" ? "bg-rose-50/30 dark:bg-rose-900/10" : ""}`}>
                  <td className="text-xs text-slate-500">{r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"}</td>
                  <td className="font-mono text-xs text-brand">{r.ref_no || "—"}</td>
                  <td className="font-medium text-slate-700 dark:text-slate-200">{r.party_name || "—"}</td>
                  <td className="text-right font-mono">₵{fmt(r.amount)}</td>
                  <td className="text-right font-black font-mono">₵{fmt(r.outstanding)}</td>
                  <td><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "OVERDUE" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{r.status || "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
