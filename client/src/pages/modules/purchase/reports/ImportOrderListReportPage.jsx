/**
 * @fileoverview ImportOrderListReportPage component.
 * Provides functionality for ImportOrderListReportPage.
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
export default function ImportOrderListReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/purchase/reports/import-order-list", {
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
  }, [pollingCounter]);

  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        po_no: r.po_no,
        po_date: r.po_date ? new Date(r.po_date).toLocaleDateString() : "-",
        supplier: r.supplier_name,
        status: r.status,
        total_amount: Number(r.total_amount || 0),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ImportOrderList");
    XLSX.writeFile(wb, "import-order-list.xlsx");
  }

  function exportCSV() {
    if (!items.length) return;
    const headers = ["PO No", "Date", "Supplier", "Status", "Amount"];
    const rows = items.map((r) => [
      r.po_no || "-",
      r.po_date ? new Date(r.po_date).toLocaleDateString() : "-",
      r.supplier_name || "-",
      r.status || "-",
      Number(r.total_amount || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-order-list.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Import Order List", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("PO No", 10, y);
    doc.text("Date", 50, y);
    doc.text("Supplier", 85, y);
    doc.text("Status", 155, y);
    doc.text("Amount", 190, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      const po = String(r.po_no || "-");
      const dt = r.po_date ? new Date(r.po_date).toLocaleDateString() : "-";
      const sup = String(r.supplier_name || "-");
      const st = String(r.status || "-");
      const amt = Number(r.total_amount || 0).toFixed(2);
      doc.text(po.slice(0, 30), 10, y);
      doc.text(dt, 50, y);
      doc.text(sup.slice(0, 60), 85, y);
      doc.text(st.slice(0, 20), 155, y);
      doc.text(amt, 190, y, { align: "right" });
      y += 5;
    });
    doc.save("import-order-list.pdf");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Import Order List
            </h1>
            <p className="text-sm mt-1">All import purchase orders</p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="label">From</label>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <button
                type="button"
                className="btn"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Running..." : "Run"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>PO No</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.po_no}</td>
                    <td>
                      {r.po_date
                        ? new Date(r.po_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{r.supplier_name}</td>
                    <td>{r.status}</td>
                    <td className="text-right">
                      {Number(r.total_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
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
