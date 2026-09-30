/**
 * @fileoverview PendingGrnToBillImportReportPage component.
 * Provides functionality for PendingGrnToBillImportReportPage.
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
export default function PendingGrnToBillImportReportPage() {
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
      const res = await api.get("/purchase/reports/pending-grn-to-bill-import");
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
        grn_no: r.grn_no,
        grn_date: r.grn_date ? new Date(r.grn_date).toLocaleDateString() : "-",
        supplier: r.supplier_name,
        grn_value: Number(r.grn_value || 0),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PendingGRNImport");
    XLSX.writeFile(wb, "pending-grn-to-bill-import.xlsx");
  }

  function exportCSV() {
    if (!items.length) return;
    const headers = ["GRN No", "Date", "Supplier", "GRN Value"];
    const rows = items.map((r) => [
      r.grn_no || "-",
      r.grn_date ? new Date(r.grn_date).toLocaleDateString() : "-",
      r.supplier_name || "-",
      Number(r.grn_value || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pending-grn-to-bill-import.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Pending GRN -> Purchase Bill (Import)", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("GRN No", 10, y);
    doc.text("Date", 55, y);
    doc.text("Supplier", 90, y);
    doc.text("GRN Value", 190, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      const no = String(r.grn_no || "-");
      const dt = r.grn_date ? new Date(r.grn_date).toLocaleDateString() : "-";
      const sup = String(r.supplier_name || "-");
      const val = Number(r.grn_value || 0).toFixed(2);
      doc.text(no.slice(0, 30), 10, y);
      doc.text(dt, 55, y);
      doc.text(sup.slice(0, 70), 90, y);
      doc.text(val, 190, y, { align: "right" });
      y += 5;
    });
    doc.save("pending-grn-to-bill-import.pdf");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Pending GRN → Purchase Bill (Import)
            </h1>
            <p className="text-sm mt-1">Import receipts pending billing</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            <button
              type="button"
              className="btn-success"
              onClick={exportCSV}
              disabled={loading || items.length === 0}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={exportExcel}
              disabled={loading || items.length === 0}
            >
              Export Excel
            </button>
            <button
              type="button"
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
                  <th>GRN No</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th className="text-right">GRN Value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.grn_no}</td>
                    <td>
                      {r.grn_date
                        ? new Date(r.grn_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{r.supplier_name}</td>
                    <td className="text-right">
                      {Number(r.grn_value || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-slate-500">
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
