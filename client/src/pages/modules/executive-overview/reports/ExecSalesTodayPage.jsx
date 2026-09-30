/**
 * @fileoverview ExecSalesTodayPage component.
 * Provides functionality for ExecSalesTodayPage.
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
export default function ExecSalesTodayPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, []);

  const [items, setItems] = useState([]);
  const [cards, setCards] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const today = new Date().toISOString().slice(0, 10);
        const res = await api.get("/sales/dashboard/metrics", { params: { topProducts: 20, topCustomers: 10, from: today, to: today } });
        if (mounted) {
          setCards(res.data?.cards || {});
          setItems(res.data?.top_products || []);
        }
      } catch (e) { toast.error("Failed to load today's sales"); }
      finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [pollingCounter]);

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <button onClick={() => window.history.back()} className="text-xs font-bold text-brand uppercase tracking-wider">← Back to Executive Overview</button>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2">📅 Today's Sales</h1>
          <p className="text-slate-500 text-sm mt-1">{new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => { const ws = XLSX.utils.json_to_sheet(items); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "TodaySales"); XLSX.writeFile(wb, "today-sales.xlsx"); }} disabled={!items.length}>📊 Excel</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today Sales", value: cards.today_sales, color: "from-blue-500 to-blue-600" },
          { label: "Today Gross Profit", value: cards.today_gross_profit, color: "from-emerald-500 to-emerald-600" },
          { label: "WTD Sales", value: cards.wtd_sales, color: "from-violet-500 to-violet-600" },
          { label: "MTD Sales", value: cards.mtd_sales, color: "from-cyan-500 to-cyan-600" },
        ].map((c, i) => (
          <div key={i} className={`bg-gradient-to-br ${c.color} text-white p-5 rounded-xl shadow-lg`}>
            <p className="text-xs font-bold opacity-80 uppercase tracking-wider">{c.label}</p>
            <h3 className="text-2xl font-black mt-2">{loading ? "..." : `₵${fmt(c.value)}`}</h3>
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="font-bold text-slate-700 dark:text-slate-200">Top Products Sold Today</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full text-sm">
            <thead className="bg-blue-700 text-white">
              <tr>
                <th className="py-3 text-xs uppercase">#</th>
                <th className="py-3 text-xs uppercase">Product</th>
                <th className="text-right py-3 text-xs uppercase">Value</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && <tr><td colSpan={3} className="text-center py-10 text-slate-400">No sales recorded today</td></tr>}
              {items.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                  <td className="text-slate-400 text-xs">{i + 1}</td>
                  <td className="font-medium text-slate-700 dark:text-slate-200">{r.label || r.item_name || "—"}</td>
                  <td className="text-right font-black font-mono text-blue-700 dark:text-blue-400">₵{fmt(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
