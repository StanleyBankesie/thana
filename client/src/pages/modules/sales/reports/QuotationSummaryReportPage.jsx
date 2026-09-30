/**
 * @fileoverview QuotationSummaryReportPage component.
 * Provides functionality for QuotationSummaryReportPage.
 */

import React, { useEffect, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function QuotationSummaryReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/quotation-summary", {
        params: {
          from: from || null,
          to: to || null,
          status: status || null,
          salesperson: salesperson || null,
        },
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
  }, [from, to, status, salesperson, pollingCounter]);

  function exportCSV() {
    if (!items.length) return;
    const headers = [
      "Quotation No",
      "Date",
      "Customer",
      "Amount",
      "Valid Until",
      "Status",
      "Salesperson",
      "Converted",
    ];
    const rows = items.map((r) => [
      r.quotation_no || "-",
      r.quotation_date
        ? new Date(r.quotation_date).toLocaleDateString()
        : "-",
      r.customer_name || "-",
      Number(r.total_amount || 0).toFixed(2),
      r.valid_until ? new Date(r.valid_until).toLocaleDateString() : "-",
      r.status || "-",
      r.salesperson || "-",
      r.converted_to_order || "NO",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales-quotation-summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        quotation_no: r.quotation_no,
        quotation_date: r.quotation_date
          ? new Date(r.quotation_date).toLocaleDateString()
          : "-",
        customer_name: r.customer_name,
        total_amount: Number(r.total_amount || 0),
        valid_until: r.valid_until
          ? new Date(r.valid_until).toLocaleDateString()
          : "-",
        status: r.status,
        salesperson: r.salesperson,
        converted_to_order: r.converted_to_order,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "QuotationSummary");
    XLSX.writeFile(wb, "sales-quotation-summary.xlsx");
  }

  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Sales Quotation Summary", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Quote", 10, y);
    doc.text("Date", 45, y);
    doc.text("Customer", 70, y);
    doc.text("Amount", 145, y);
    doc.text("Status", 175, y);
    doc.text("Conv.", 200, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.quotation_no || "-").slice(0, 18), 10, y);
      doc.text(
        r.quotation_date ? new Date(r.quotation_date).toLocaleDateString() : "-",
        45,
        y,
      );
      doc.text(String(r.customer_name || "-").slice(0, 50), 70, y);
      doc.text(
        Number(r.total_amount || 0).toFixed(2),
        145,
        y,
      );
      doc.text(String(r.status || "-").slice(0, 12), 175, y);
      doc.text(String(r.converted_to_order || "NO"), 200, y, { align: "right" });
      y += 5;
    });
    doc.save("sales-quotation-summary.pdf");
  }


  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "date", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Sales Quotation Summary
            </h1>
            <p className="text-sm mt-1">Track pipeline by quotation status</p>
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
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="DRAFT">Draft</option>
                <option value="OPEN">Open</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CONVERTED">Converted</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Salesperson</label>
              <input
                className="input"
                value={salesperson}
                onChange={(e) => setSalesperson(e.target.value)}
                placeholder="Username contains..."
              />
            </div>
            
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full table-fixed">
              <thead>
                <tr>
                  <SortableHeader label="Quotation No" sortKey="quotation_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Amount" sortKey="amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Valid Until" sortKey="valid_until" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Salesperson" sortKey="salesperson" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Converted" sortKey="converted" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.quotation_no}</td>
                    <td>
                      {r.quotation_date
                        ? new Date(r.quotation_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{r.customer_name}</td>
                    <td className="text-right">
                      {Number(r.total_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      {r.valid_until
                        ? new Date(r.valid_until).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{r.status}</td>
                    <td>{r.salesperson || "-"}</td>
                    <td>{r.converted_to_order}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-slate-500">
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

