/**
 * @fileoverview ServiceTypePerformanceReport component.
 * Provides functionality for ServiceTypePerformanceReport.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ServiceTypePerformanceReport() {
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
      const res = await api.get(
        "/service-management/reports/service-type-performance",
      );
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        service_type: r.service_type,
        total_orders: Number(r.total_orders || 0),
        total_revenue: Number(r.total_revenue || 0),
        avg_completion_time: r.avg_completion_time,
        avg_cost: Number(r.avg_cost || 0),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ServiceTypePerformance");
    XLSX.writeFile(wb, "service-type-performance.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Service Type Performance", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Service Type", 10, y);
    doc.text("Orders", 90, y);
    doc.text("Revenue", 120, y);
    doc.text("Avg Time", 160, y);
    doc.text("Avg Cost", 200, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.service_type || "-").slice(0, 60), 10, y);
      doc.text(String(Number(r.total_orders || 0)), 90, y);
      doc.text(String(Number(r.total_revenue || 0).toFixed(2)), 120, y);
      doc.text(String(r.avg_completion_time || "-"), 160, y);
      doc.text(String(Number(r.avg_cost || 0).toFixed(2)), 200, y, {
        align: "right",
      });
      y += 5;
    });
    doc.save("service-type-performance.pdf");
  }

  useEffect(() => {
    run();
  }, [pollingCounter]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Service Type Performance
            </h1>
            <p className="text-sm mt-1">
              Analyze service revenue and cycle times
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            
            <button
              className="btn-secondary"
              onClick={exportExcel}
              disabled={loading || items.length === 0}
            >
              Export Excel
            </button>
            <button
              className="btn-primary"
              onClick={exportPDF}
              disabled={loading || items.length === 0}
            >
              Export PDF
            </button>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Service Type</th>
                  <th className="text-right">Total Orders</th>
                  <th className="text-right">Total Revenue</th>
                  <th className="text-right">Avg Completion Time</th>
                  <th className="text-right">Avg Cost</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.service_type}</td>
                    <td className="text-right">{r.total_orders || 0}</td>
                    <td className="text-right">{r.total_revenue || 0}</td>
                    <td className="text-right">
                      {r.avg_completion_time || "-"}
                    </td>
                    <td className="text-right">{r.avg_cost || 0}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
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
