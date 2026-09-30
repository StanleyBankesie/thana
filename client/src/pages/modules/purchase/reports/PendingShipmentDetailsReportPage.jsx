/**
 * @fileoverview PendingShipmentDetailsReportPage component.
 * Provides functionality for PendingShipmentDetailsReportPage.
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
export default function PendingShipmentDetailsReportPage() {
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
      const res = await api.get("/purchase/reports/pending-shipments");
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
        advice_date: r.advice_date
          ? new Date(r.advice_date).toLocaleDateString()
          : "-",
        po_no: r.po_no,
        supplier: r.supplier_name,
        etd: r.etd_date ? new Date(r.etd_date).toLocaleDateString() : "-",
        eta: r.eta_date ? new Date(r.eta_date).toLocaleDateString() : "-",
        status: r.status,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PendingShipments");
    XLSX.writeFile(wb, "pending-shipment-details.xlsx");
  }

  function exportCSV() {
    if (!items.length) return;
    const headers = [
      "Advice Date",
      "PO No",
      "Supplier",
      "ETD",
      "ETA",
      "Status",
    ];
    const rows = items.map((r) => [
      r.advice_date ? new Date(r.advice_date).toLocaleDateString() : "-",
      r.po_no || "-",
      r.supplier_name || "-",
      r.etd_date ? new Date(r.etd_date).toLocaleDateString() : "-",
      r.eta_date ? new Date(r.eta_date).toLocaleDateString() : "-",
      r.status || "-",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pending-shipment-details.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Pending Shipment Details", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Advice", 10, y);
    doc.text("PO No", 40, y);
    doc.text("Supplier", 70, y);
    doc.text("ETD", 140, y);
    doc.text("ETA", 165, y);
    doc.text("Status", 190, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      const ad = r.advice_date
        ? new Date(r.advice_date).toLocaleDateString()
        : "-";
      const po = String(r.po_no || "-");
      const sup = String(r.supplier_name || "-");
      const etd = r.etd_date ? new Date(r.etd_date).toLocaleDateString() : "-";
      const eta = r.eta_date ? new Date(r.eta_date).toLocaleDateString() : "-";
      const st = String(r.status || "-");
      doc.text(ad, 10, y);
      doc.text(po.slice(0, 20), 40, y);
      doc.text(sup.slice(0, 60), 70, y);
      doc.text(etd, 140, y);
      doc.text(eta, 165, y);
      doc.text(st.slice(0, 20), 190, y, { align: "right" });
      y += 5;
    });
    doc.save("pending-shipment-details.pdf");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Pending Shipment Details
            </h1>
            <p className="text-sm mt-1">Outstanding shipments and statuses</p>
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
                  <th>Advice Date</th>
                  <th>PO No</th>
                  <th>Supplier</th>
                  <th>ETD</th>
                  <th>ETA</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td>
                      {r.advice_date
                        ? new Date(r.advice_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="font-medium">{r.po_no}</td>
                    <td>{r.supplier_name}</td>
                    <td>
                      {r.etd_date
                        ? new Date(r.etd_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      {r.eta_date
                        ? new Date(r.eta_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{r.status}</td>
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
