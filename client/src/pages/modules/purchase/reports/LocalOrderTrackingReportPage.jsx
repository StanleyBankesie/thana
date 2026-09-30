/**
 * @fileoverview LocalOrderTrackingReportPage component.
 * Provides functionality for LocalOrderTrackingReportPage.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LocalOrderTrackingReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/purchase/reports/local-order-tracking", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const headers = [
      "PO No",
      "Supplier",
      "Order Date",
      "Expected Delivery",
      "Status",
      "Value",
    ];
    const rows = (Array.isArray(items) ? items : []).map((r) => [
      r.po_no || "-",
      r.supplier_name || "-",
      r.order_date ? new Date(r.order_date).toLocaleDateString() : "-",
      r.expected_delivery
        ? new Date(r.expected_delivery).toLocaleDateString()
        : "-",
      r.status || "-",
      Number(r.total_value || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "local_order_tracking.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const rows = (Array.isArray(items) ? items : []).map((r) => ({
      po_no: r.po_no || "-",
      supplier: r.supplier_name || "-",
      order_date: r.order_date
        ? new Date(r.order_date).toLocaleDateString()
        : "-",
      expected_delivery: r.expected_delivery
        ? new Date(r.expected_delivery).toLocaleDateString()
        : "-",
      status: r.status || "-",
      value: Number(r.total_value || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LocalOrderTracking");
    XLSX.writeFile(wb, "local-order-tracking.xlsx");
  }

  function exportPDF() {
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Local Order Tracking", 10, y);
    y += 8;
    doc.setFontSize(10);
    const headers = [
      "PO No",
      "Supplier",
      "Order Date",
      "Expected",
      "Status",
      "Value",
    ];
    doc.text(headers[0], 10, y);
    doc.text(headers[1], 40, y);
    doc.text(headers[2], 90, y);
    doc.text(headers[3], 120, y);
    doc.text(headers[4], 150, y);
    doc.text(headers[5], 180, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    (Array.isArray(items) ? items : []).forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      const po = String(r.po_no || "-");
      const sup = String(r.supplier_name || "-");
      const od = r.order_date
        ? new Date(r.order_date).toLocaleDateString()
        : "-";
      const ed = r.expected_delivery
        ? new Date(r.expected_delivery).toLocaleDateString()
        : "-";
      const st = String(r.status || "-");
      const val = Number(r.total_value || 0).toFixed(2);
      doc.text(po, 10, y);
      doc.text(sup.slice(0, 30), 40, y);
      doc.text(od, 90, y);
      doc.text(ed, 120, y);
      doc.text(st, 150, y);
      doc.text(val, 180, y, { align: "right" });
      y += 5;
    });
    doc.save("local-order-tracking.pdf");
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
              Local Order Tracking
            </h1>
            <p className="text-sm mt-1">
              Status tracking for local purchase orders
            </p>
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
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                className="btn-success"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Running..." : "Run Report"}
              </button>
              <button
                type="button"
                className="btn-success"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                disabled={loading}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>PO No</th>
                  <th>Supplier</th>
                  <th>Order Date</th>
                  <th>Expected Delivery</th>
                  <th>Status</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.po_no || "-"}</td>
                    <td>{r.supplier_name || "-"}</td>
                    <td>
                      {r.order_date
                        ? new Date(r.order_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      {r.expected_delivery
                        ? new Date(r.expected_delivery).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{r.status || "-"}</td>
                    <td className="text-right">
                      {Number(r.total_value || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {items.length === 0 && !loading ? (
            <div className="text-center py-10">No rows.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
