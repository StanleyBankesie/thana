/**
 * @fileoverview SalesRegisterReportPage component.
 * Provides functionality for SalesRegisterReportPage.
 */

import React, { useEffect, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
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
export default function SalesRegisterReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/sales/reports/sales-register", {
        params: { from: from || null, to: to || null, customer: customer || null },
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
      "Date",
      "Invoice No",
      "Customer",
      "Items",
      "Amount",
      "Status",
    ];
    const rows = (Array.isArray(items) ? items : []).map((r) => [
      r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : "-",
      r.invoice_no || "-",
      r.customer_name || "-",
      Number(r.items_count || 0).toString(),
      Number(r.total_amount || 0).toFixed(2),
      r.status || "-",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales_register.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExcel() {
    const rows = (Array.isArray(items) ? items : []).map((r) => ({
      date: r.invoice_date
        ? new Date(r.invoice_date).toLocaleDateString()
        : "-",
      invoice_no: r.invoice_no || "-",
      customer: r.customer_name || "-",
      items: Number(r.items_count || 0),
      amount: Number(r.total_amount || 0),
      status: r.status || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SalesRegister");
    XLSX.writeFile(wb, "sales-register.xlsx");
  }

  function exportPDF() {
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Sales Register", 10, y);
    y += 8;
    doc.setFontSize(10);
    const headers = [
      "Date",
      "Invoice No",
      "Customer",
      "Items",
      "Amount",
      "Status",
    ];
    doc.text(headers[0], 10, y);
    doc.text(headers[1], 35, y);
    doc.text(headers[2], 75, y);
    doc.text(headers[3], 130, y);
    doc.text(headers[4], 160, y);
    doc.text(headers[5], 190, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    (Array.isArray(items) ? items : []).forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      const dt = r.invoice_date
        ? new Date(r.invoice_date).toLocaleDateString()
        : "-";
      const no = String(r.invoice_no || "-");
      const cust = String(r.customer_name || "-");
      const count = String(Number(r.items_count || 0));
      const amt = Number(r.total_amount || 0).toFixed(2);
      const st = String(r.status || "-");
      doc.text(dt, 10, y);
      doc.text(no, 35, y);
      doc.text(cust.slice(0, 45), 75, y);
      doc.text(count, 130, y);
      doc.text(amt, 160, y);
      doc.text(st, 190, y, { align: "right" });
      y += 5;
    });
    doc.save("sales-register.pdf");
  }

  useEffect(() => {
    run();
  }, [from, to, customer, pollingCounter]);

  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "date", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Sales Register
            </h1>
            <p className="text-sm mt-1">
              Invoices and totals within the period
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
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
              <label className="label">Customer</label>
              <input
                className="input"
                type="text"
                placeholder="Search customer..."
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table w-full table-fixed">
              <thead>
                <tr>
                  <SortableHeader label="Date" sortKey="date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Invoice No" sortKey="invoice_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Items" sortKey="items" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Amount" sortKey="amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r) => (
                  <tr key={r.id || Math.random()}>
                    <td>
                      {r.invoice_date
                        ? new Date(r.invoice_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="font-medium">{r.invoice_no || "-"}</td>
                    <td>{r.customer_name || "-"}</td>
                    <td className="text-right">
                      {Number(r.items_count || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(r.total_amount || 0).toLocaleString()}
                    </td>
                    <td>{r.status || "-"}</td>
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
