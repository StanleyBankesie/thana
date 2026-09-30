/**
 * @fileoverview MonthlySalesTrendReportPage component.
 * Provides functionality for MonthlySalesTrendReportPage.
 */

import React, { useEffect, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { Link } from "react-router-dom";
import { api } from "api/client";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MonthlySalesTrendReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/monthly-sales-trend", {
        params: { from: from || null, to: to || null },
      });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, [from, to, pollingCounter]);

  function growthPercent(cur, prev) {
    if (!prev) return 0;
    return Math.round(((cur - prev) * 100) / prev);
  }

  const rows = items
    .map((r) => ({
      month_start: r.month_start,
      total_invoices: Number(r.total_invoices || 0),
      total_revenue: Number(r.total_revenue || 0),
      total_discounts: Number(r.total_discounts || 0),
    }))
    .sort((a, b) => new Date(a.month_start) - new Date(b.month_start))
    .map((r, idx, arr) => {
      const prev = idx > 0 ? arr[idx - 1] : null;
      const g = prev ? growthPercent(r.total_revenue, prev.total_revenue) : 0;
      return { ...r, growth_percent: g };
    });


  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "id", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Monthly Sales Trend
            </h1>
            <p className="text-sm mt-1">
              Executive overview of monthly performance
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="label">From</label>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="overflow-x-auto">
            <table className="table w-full table-fixed">
              <thead>
                <tr>
                  <SortableHeader label="Month" sortKey="month" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Total Invoices" sortKey="total_invoices" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Total Revenue" sortKey="total_revenue" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Total Discounts" sortKey="total_discounts" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Growth %" sortKey="growth_" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">
                      {r.month_start
                        ? new Date(r.month_start).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                          })
                        : "-"}
                    </td>
                    <td className="text-right">{r.total_invoices}</td>
                    <td className="text-right">
                      {r.total_revenue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {r.total_discounts.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">{r.growth_percent}%</td>
                  </tr>
                ))}
                {!rows.length && !loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
                      No records
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

