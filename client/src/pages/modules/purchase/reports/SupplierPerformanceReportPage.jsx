/**
 * @fileoverview SupplierPerformanceReportPage component.
 * Provides functionality for SupplierPerformanceReportPage.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SupplierPerformanceReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/purchase/reports/supplier-performance");
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, [pollingCounter]);

  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        supplier: r.supplier_name,
        total_pos_issued: Number(r.total_pos_issued || 0),
        on_time_delivery_percent: Number(r.on_time_delivery_percent || 0),
        avg_delivery_delay_days: Number(r.avg_delivery_delay_days || 0),
        total_purchase_value: Number(r.total_purchase_value || 0),
        return_rate_percent: Number(r.return_rate_percent || 0),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SupplierPerformance");
    XLSX.writeFile(wb, "supplier-performance.xlsx");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Supplier Performance
            </h1>
            <p className="text-sm mt-1">Evaluate supplier reliability</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            <button className="btn-secondary" onClick={exportExcel} disabled={loading || items.length === 0}>
              Export Excel
            </button>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th className="text-right">Total POs Issued</th>
                  <th className="text-right">On-Time Delivery %</th>
                  <th className="text-right">Avg Delivery Delay (days)</th>
                  <th className="text-right">Total Purchase Value</th>
                  <th className="text-right">Return Rate %</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.supplier_name}</td>
                    <td className="text-right">{Number(r.total_pos_issued || 0)}</td>
                    <td className="text-right">{Number(r.on_time_delivery_percent || 0)}</td>
                    <td className="text-right">{Number(r.avg_delivery_delay_days || 0)}</td>
                    <td className="text-right">{Number(r.total_purchase_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.return_rate_percent || 0)}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-500">
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

