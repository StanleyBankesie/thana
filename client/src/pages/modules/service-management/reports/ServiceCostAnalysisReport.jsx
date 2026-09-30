/**
 * @fileoverview ServiceCostAnalysisReport component.
 * Provides functionality for ServiceCostAnalysisReport.
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
export default function ServiceCostAnalysisReport() {
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
      const res = await api.get("/service-management/reports/cost-analysis");
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
        order_no: r.order_no,
        estimated_cost: Number(r.estimated_cost || 0),
        actual_labor_cost: Number(r.actual_labor_cost || 0),
        material_cost: Number(r.material_cost || 0),
        total_cost: Number(r.total_cost || 0),
        billed_amount: Number(r.billed_amount || 0),
        profit_loss: Number(r.profit_loss || 0),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ServiceCostAnalysis");
    XLSX.writeFile(wb, "service-cost-analysis.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Service Cost Analysis", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Order", 10, y);
    doc.text("Est", 55, y);
    doc.text("Labor", 80, y);
    doc.text("Mat", 110, y);
    doc.text("Total", 140, y);
    doc.text("Billed", 170, y);
    doc.text("P/L", 200, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.order_no || "-").slice(0, 25), 10, y);
      doc.text(String(Number(r.estimated_cost || 0).toFixed(2)), 55, y);
      doc.text(String(Number(r.actual_labor_cost || 0).toFixed(2)), 80, y);
      doc.text(String(Number(r.material_cost || 0).toFixed(2)), 110, y);
      doc.text(String(Number(r.total_cost || 0).toFixed(2)), 140, y);
      doc.text(String(Number(r.billed_amount || 0).toFixed(2)), 170, y);
      doc.text(String(Number(r.profit_loss || 0).toFixed(2)), 200, y, {
        align: "right",
      });
      y += 5;
    });
    doc.save("service-cost-analysis.pdf");
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
              Service Cost Analysis
            </h1>
            <p className="text-sm mt-1">Profitability per job</p>
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
                  <th>Service Order No</th>
                  <th className="text-right">Estimated Cost</th>
                  <th className="text-right">Actual Labor Cost</th>
                  <th className="text-right">Material Cost</th>
                  <th className="text-right">Total Cost</th>
                  <th className="text-right">Billed Amount</th>
                  <th className="text-right">Profit / Loss</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.order_no}</td>
                    <td className="text-right">{r.estimated_cost || "-"}</td>
                    <td className="text-right">{r.actual_labor_cost || "-"}</td>
                    <td className="text-right">{r.material_cost || "-"}</td>
                    <td className="text-right">{r.total_cost || "-"}</td>
                    <td className="text-right">{r.billed_amount || "-"}</td>
                    <td className="text-right">{r.profit_loss || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-500">
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
