/**
 * @fileoverview InvoiceSummaryReportPage component.
 * Provides functionality for InvoiceSummaryReportPage.
 */

import React, { useEffect, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import { autosizeWorksheetColumns } from "../../../../utils/xlsxUtils.js";
import jsPDF from "jspdf";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function InvoiceSummaryReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customer, setCustomer] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/invoice-summary", {
        params: {
          from: from || null,
          to: to || null,
          customer: customer || null,
          paymentStatus: paymentStatus || null,
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
  }, [from, to, customer, paymentStatus, pollingCounter]);

  function exportCSV() {
    if (!items.length) return;
    const headers = [
      "Invoice No",
      "Invoice Date",
      "Customer",
      "Total Amount",
      "VAT",
      "Paid Amount",
      "Balance",
      "Payment Status",
      "Status",
    ];
    const rows = items.map((r) => [
      r.invoice_no || "-",
      r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : "-",
      r.customer_name || "-",
      Number(r.total_amount || 0).toFixed(2),
      Number(r.vat_amount || 0).toFixed(2),
      Number(r.paid_amount || 0).toFixed(2),
      Number(r.balance_amount || 0).toFixed(2),
      r.payment_status || "-",
      r.status || "-",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoice-summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        invoice_no: r.invoice_no,
        invoice_date: r.invoice_date
          ? new Date(r.invoice_date).toLocaleDateString()
          : "-",
        customer: r.customer_name,
        total_amount: Number(r.total_amount || 0),
        vat_amount: Number(r.vat_amount || 0),
        paid_amount: Number(r.paid_amount || 0),
        balance: Number(r.balance_amount || 0),
        payment_status: r.payment_status,
        status: r.status,
      })),
    );
    autosizeWorksheetColumns(ws);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "InvoiceSummary");
    XLSX.writeFile(wb, "invoice-summary.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Invoice Summary", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Invoice", 10, y);
    doc.text("Date", 40, y);
    doc.text("Customer", 70, y);
    doc.text("Total", 140, y);
    doc.text("Paid", 170, y);
    doc.text("Bal", 200, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.invoice_no || "-").slice(0, 18), 10, y);
      doc.text(
        r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : "-",
        40,
        y,
      );
      doc.text(String(r.customer_name || "-").slice(0, 50), 70, y);
      doc.text(String(Number(r.total_amount || 0).toFixed(2)), 140, y);
      doc.text(String(Number(r.paid_amount || 0).toFixed(2)), 170, y);
      doc.text(String(Number(r.balance_amount || 0).toFixed(2)), 200, y, {
        align: "right",
      });
      y += 5;
    });
    doc.save("invoice-summary.pdf");
  }


  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "date", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Invoice Summary
            </h1>
            <p className="text-sm mt-1">Revenue tracking by invoices</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            <button
              className="btn-success"
              onClick={exportCSV}
              disabled={loading || items.length === 0}
            >
              Export CSV
            </button>
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
              <label className="label">Customer</label>
              <input
                className="input"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Customer contains..."
              />
            </div>
            <div>
              <label className="label">Payment Status</label>
              <select
                className="input"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            <div className="md:col-span-1 flex items-end">
              
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full table-fixed">
              <thead>
                <tr>
                  <SortableHeader label="Invoice No" sortKey="invoice_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Total" sortKey="total" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="VAT" sortKey="vat" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Paid" sortKey="paid" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Balance" sortKey="balance" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Payment Status" sortKey="payment_status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.invoice_no}</td>
                    <td>
                      {r.invoice_date
                        ? new Date(r.invoice_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{r.customer_name}</td>
                    <td className="text-right">
                      {Number(r.total_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {Number(r.vat_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {Number(r.paid_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {Number(r.balance_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>{r.payment_status}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-slate-500">
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
