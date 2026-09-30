/**
 * @fileoverview PriceVarianceReportPage component.
 * Provides functionality for PriceVarianceReportPage.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PriceVarianceReportPage() {
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
      const res = await api.get("/purchase/reports/price-variance");
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

  function exportCSV() {
    if (!items.length) return;
    const headers = ["Item", "Supplier", "Last Purchase Price", "Current Purchase Price", "Variance %"];
    const rows = items.map((r) => [
      r.item_name || "-",
      r.supplier_name || "-",
      r.last_price == null ? "-" : Number(r.last_price || 0).toFixed(2),
      r.current_price == null ? "-" : Number(r.current_price || 0).toFixed(2),
      r.variance_percent == null ? "-" : String(r.variance_percent),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "price-variance.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        item: r.item_name,
        supplier: r.supplier_name,
        last_price: r.last_price,
        current_price: r.current_price,
        variance_percent: r.variance_percent,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PriceVariance");
    XLSX.writeFile(wb, "price-variance.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Price Variance", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Item", 10, y);
    doc.text("Supplier", 80, y);
    doc.text("Last", 140, y);
    doc.text("Current", 165, y);
    doc.text("%", 200, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.item_name || "-").slice(0, 60), 10, y);
      doc.text(String(r.supplier_name || "-").slice(0, 50), 80, y);
      doc.text(r.last_price == null ? "-" : String(Number(r.last_price || 0).toFixed(2)), 140, y);
      doc.text(r.current_price == null ? "-" : String(Number(r.current_price || 0).toFixed(2)), 165, y);
      doc.text(r.variance_percent == null ? "-" : String(r.variance_percent), 200, y, { align: "right" });
      y += 5;
    });
    doc.save("price-variance.pdf");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Price Variance</h1>
            <p className="text-sm mt-1">Detect price fluctuations</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            <button className="btn-success" onClick={exportCSV} disabled={loading || items.length === 0}>Export CSV</button>
            <button className="btn-secondary" onClick={exportExcel} disabled={loading || items.length === 0}>Export Excel</button>
            <button className="btn-primary" onClick={exportPDF} disabled={loading || items.length === 0}>Export PDF</button>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Supplier</th>
                  <th className="text-right">Last Purchase Price</th>
                  <th className="text-right">Current Purchase Price</th>
                  <th className="text-right">Variance %</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.item_name}</td>
                    <td>{r.supplier_name}</td>
                    <td className="text-right">{r.last_price == null ? "-" : Number(r.last_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{r.current_price == null ? "-" : Number(r.current_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{r.variance_percent == null ? "-" : r.variance_percent}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">No records</td>
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

