/**
 * @fileoverview ImportCostBreakdownReportPage component.
 * Provides functionality for ImportCostBreakdownReportPage.
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
export default function ImportCostBreakdownReportPage() {
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
      const res = await api.get("/purchase/reports/import-cost-breakdown");
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
    const headers = ["Bill No", "Bill Date", "Supplier", "PO No", "PO Value", "Freight", "Insurance", "Port Charges", "Clearance Fees", "Duties", "Total Landed Cost"];
    const rows = items.map((r) => [
      r.bill_no || "-",
      r.bill_date ? new Date(r.bill_date).toLocaleDateString() : "-",
      r.supplier_name || "-",
      r.po_no || "-",
      Number(r.po_value || 0).toFixed(2),
      Number(r.freight || 0).toFixed(2),
      Number(r.insurance || 0).toFixed(2),
      Number(r.port_charges || 0).toFixed(2),
      Number(r.clearance_fees || 0).toFixed(2),
      Number(r.duties || 0).toFixed(2),
      Number(r.total_landed_cost || 0).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-cost-breakdown.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        bill_no: r.bill_no,
        bill_date: r.bill_date ? new Date(r.bill_date).toLocaleDateString() : "-",
        supplier: r.supplier_name,
        po_no: r.po_no,
        po_value: Number(r.po_value || 0),
        freight: Number(r.freight || 0),
        insurance: Number(r.insurance || 0),
        port_charges: Number(r.port_charges || 0),
        clearance_fees: Number(r.clearance_fees || 0),
        duties: Number(r.duties || 0),
        total_landed_cost: Number(r.total_landed_cost || 0),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ImportCostBreakdown");
    XLSX.writeFile(wb, "import-cost-breakdown.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Import Cost Breakdown", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Bill", 10, y);
    doc.text("Date", 30, y);
    doc.text("Supplier", 60, y);
    doc.text("PO", 120, y);
    doc.text("Landed Cost", 200, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.bill_no || "-").slice(0, 16), 10, y);
      doc.text(r.bill_date ? new Date(r.bill_date).toLocaleDateString() : "-", 30, y);
      doc.text(String(r.supplier_name || "-").slice(0, 50), 60, y);
      doc.text(String(r.po_no || "-").slice(0, 16), 120, y);
      doc.text(String(Number(r.total_landed_cost || 0).toFixed(2)), 200, y, { align: "right" });
      y += 5;
    });
    doc.save("import-cost-breakdown.pdf");
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Import Cost Breakdown</h1>
            <p className="text-sm mt-1">Full landed cost transparency</p>
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
                  <th>Bill No</th>
                  <th>Bill Date</th>
                  <th>Supplier</th>
                  <th>PO No</th>
                  <th className="text-right">PO Value</th>
                  <th className="text-right">Freight</th>
                  <th className="text-right">Insurance</th>
                  <th className="text-right">Port Charges</th>
                  <th className="text-right">Clearance Fees</th>
                  <th className="text-right">Duties</th>
                  <th className="text-right">Total Landed Cost</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.bill_no}</td>
                    <td>{r.bill_date ? new Date(r.bill_date).toLocaleDateString() : "-"}</td>
                    <td>{r.supplier_name || "-"}</td>
                    <td>{r.po_no || "-"}</td>
                    <td className="text-right">{Number(r.po_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.freight || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.insurance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.port_charges || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.clearance_fees || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.duties || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">{Number(r.total_landed_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="11" className="text-center py-8 text-slate-500">No records</td>
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

