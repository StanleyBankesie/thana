/**
 * @fileoverview Production Executive Summary Report component.
 * Conforms strictly to standard OmniSuite General Ledger report UI design.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export default function ProductionSummaryReport() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/reports/summary");
      setSummary(res.data?.summary || null);
    } catch {
      toast.error("Failed to load production summary report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  function exportExcel() {
    if (!summary) return;
    const rows = [
      { Metric: "Completed Production Orders", Value: summary.completed_orders || 0 },
      { Metric: "In-Progress Work Orders", Value: summary.in_progress_orders || 0 },
      { Metric: "Pending Manufacturing Requisitions", Value: summary.pending_orders || 0 },
      { Metric: "Total Material Staged (Received)", Value: summary.total_material_received || 0 },
      { Metric: "Total Material Consumed in Production", Value: summary.total_material_consumed || 0 },
      { Metric: "Total Finished Output Produced", Value: summary.total_output_produced || 0 },
      { Metric: "Total Process Scrap Quantity", Value: summary.total_scrap_qty || 0 }
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ProductionSummary");
    XLSX.writeFile(wb, "production-executive-summary.xlsx");
  }

  function exportPDF() {
    if (!summary) return;
    const doc = new jsPDF("p", "mm", "a4");
    doc.setFontSize(14);
    doc.text("Production Executive Summary Report", 10, 15);
    doc.setFontSize(10);
    doc.text(`Completed Orders: ${summary.completed_orders || 0}`, 10, 25);
    doc.text(`In-Progress Work Orders: ${summary.in_progress_orders || 0}`, 10, 32);
    doc.text(`Pending Requisitions: ${summary.pending_orders || 0}`, 10, 39);
    doc.text(`Total Finished Goods Output: ${summary.total_output_produced || 0}`, 10, 46);
    doc.save("production-executive-summary.pdf");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button 
            onClick={() => navigate("/production?section=Reports%20%26%20Costing")} 
            className="font-sans text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Reports & Costing
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Production & Material Executive Summary
          </h1>
          <p className="text-sm mt-1 text-slate-500">Executive overview metrics covering total production output, material consumption, completed and pending orders</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap items-end gap-6 mb-6">
            <div className="flex items-end gap-3 shrink-0 ml-auto">
              <button
                type="button"
                className="btn-secondary px-4 whitespace-nowrap"
                onClick={exportExcel}
                disabled={!summary}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="btn-primary px-4 whitespace-nowrap"
                onClick={exportPDF}
                disabled={!summary}
              >
                Export PDF
              </button>
              <button
                type="button"
                className="btn-primary px-4 whitespace-nowrap"
                onClick={() => window.print()}
              >
                Print
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>Executive Operational Metric</th>
                  <th className="text-right">Recorded Value</th>
                  <th className="text-center">Metric Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {loading ? (
                  <tr>
                    <td colSpan="3" className="py-12 text-center text-slate-400 font-bold animate-pulse">
                      Loading executive summary...
                    </td>
                  </tr>
                ) : summary ? (
                  <>
                    <tr>
                      <td className="font-semibold text-sm text-slate-900 dark:text-slate-100">Completed Orders</td>
                      <td className="text-right font-mono font-bold text-sm text-emerald-600">{summary.completed_orders || 0}</td>
                      <td className="text-center"><span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">Order Execution</span></td>
                    </tr>
                    <tr>
                      <td className="font-semibold text-sm text-slate-900 dark:text-slate-100">In-Progress Work Orders</td>
                      <td className="text-right font-mono font-bold text-sm text-blue-600">{summary.in_progress_orders || 0}</td>
                      <td className="text-center"><span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">Active Work Orders</span></td>
                    </tr>
                    <tr>
                      <td className="font-semibold text-sm text-slate-900 dark:text-slate-100">Pending Orders / Requisitions</td>
                      <td className="text-right font-mono font-bold text-sm text-amber-600">{summary.pending_orders || 0}</td>
                      <td className="text-center"><span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">Pending Planning</span></td>
                    </tr>
                    <tr>
                      <td className="font-semibold text-sm text-slate-900 dark:text-slate-100">Total Raw Materials Staged (Received)</td>
                      <td className="text-right font-mono text-sm text-slate-800 dark:text-slate-200">{Number(summary.total_material_received || 0).toLocaleString()}</td>
                      <td className="text-center"><span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">WIP Staging</span></td>
                    </tr>
                    <tr>
                      <td className="font-semibold text-sm text-slate-900 dark:text-slate-100">Total Raw Materials Consumed</td>
                      <td className="text-right font-mono text-sm text-slate-800 dark:text-slate-200">{Number(summary.total_material_consumed || 0).toLocaleString()}</td>
                      <td className="text-center"><span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800">Shop Floor Usage</span></td>
                    </tr>
                    <tr>
                      <td className="font-semibold text-sm text-slate-900 dark:text-slate-100">Total Finished Output Produced</td>
                      <td className="text-right font-mono font-black text-sm text-brand-600 dark:text-brand-400">{Number(summary.total_output_produced || 0).toLocaleString()}</td>
                      <td className="text-center"><span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">Good Output</span></td>
                    </tr>
                    <tr>
                      <td className="font-semibold text-sm text-slate-900 dark:text-slate-100">Total Process Rejected / Scrap Qty</td>
                      <td className="text-right font-mono font-bold text-sm text-red-500">{Number(summary.total_scrap_qty || 0).toLocaleString()}</td>
                      <td className="text-center"><span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">Scrap Logged</span></td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan="3" className="py-12 text-center text-slate-400 font-medium">
                      No executive summary metrics available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
