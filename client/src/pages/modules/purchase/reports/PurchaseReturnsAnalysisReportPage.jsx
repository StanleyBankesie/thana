/**
 * @fileoverview PurchaseReturnsAnalysisReportPage component.
 * Provides functionality for PurchaseReturnsAnalysisReportPage.
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
export default function PurchaseReturnsAnalysisReportPage() {
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
      const res = await api.get("/purchase/reports/purchase-returns-analysis");
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
        return_no: r.return_no,
        return_date: r.return_date ? new Date(r.return_date).toLocaleDateString() : "-",
        supplier: r.supplier_name,
        item: r.item,
        return_qty: Number(r.return_qty || 0),
        return_value: Number(r.return_value || 0),
        reason: r.reason || "-",
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PurchaseReturnsAnalysis");
    XLSX.writeFile(wb, "purchase-returns-analysis.xlsx");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Purchase Returns Analysis</h1>
            <p className="text-sm mt-1">Identify quality issues</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            <button className="btn-secondary" onClick={exportExcel} disabled={loading || items.length === 0}>Export Excel</button>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Return No</th>
                  <th>Return Date</th>
                  <th>Supplier</th>
                  <th>Item</th>
                  <th className="text-right">Return Qty</th>
                  <th className="text-right">Return Value</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.return_no}</td>
                    <td>{r.return_date ? new Date(r.return_date).toLocaleDateString() : "-"}</td>
                    <td>{r.supplier_name || "-"}</td>
                    <td>{r.item || "-"}</td>
                    <td className="text-right">{Number(r.return_qty || 0)}</td>
                    <td className="text-right">{Number(r.return_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>{r.reason || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-500">No records</td>
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

