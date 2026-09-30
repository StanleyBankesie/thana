/**
 * @fileoverview DiscountUtilizationReportPage component.
 * Provides functionality for DiscountUtilizationReportPage.
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
export default function DiscountUtilizationReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customer, setCustomer] = useState("");
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/discount-utilization", {
        params: { from: from || null, to: to || null, customer: customer || null },
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
  }, [from, to, customer, pollingCounter]);

  function exportCSV() {
    if (!items.length) return;
    const headers = ["Discount Scheme Name", "Customer", "Invoice No", "Discount %", "Discount Amount", "Approved By"];
    const rows = items.map((r) => [
      r.discount_scheme_name || "-",
      r.customer || "-",
      r.invoice_no || "-",
      Number(r.discount_percent || 0).toFixed(2),
      Number(r.discount_amount || 0).toFixed(2),
      r.approved_by || "-",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "discount-utilization.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        scheme: r.discount_scheme_name,
        customer: r.customer,
        invoice_no: r.invoice_no,
        discount_percent: Number(r.discount_percent || 0),
        discount_amount: Number(r.discount_amount || 0),
        approved_by: r.approved_by,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DiscountUtilization");
    XLSX.writeFile(wb, "discount-utilization.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Discount Utilization", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Scheme", 10, y);
    doc.text("Customer", 70, y);
    doc.text("Invoice", 130, y);
    doc.text("%", 160, y);
    doc.text("Amount", 190, y, { align: "right" });
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.discount_scheme_name || "-").slice(0, 50), 10, y);
      doc.text(String(r.customer || "-").slice(0, 50), 70, y);
      doc.text(String(r.invoice_no || "-").slice(0, 20), 130, y);
      doc.text(String(Number(r.discount_percent || 0).toFixed(2)), 160, y);
      doc.text(String(Number(r.discount_amount || 0).toFixed(2)), 190, y, { align: "right" });
      y += 5;
    });
    doc.save("discount-utilization.pdf");
  }


  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "id", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Discount Utilization</h1>
            <p className="text-sm mt-1">Control discount abuse</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            <button className="btn-success" onClick={exportCSV} disabled={loading || items.length === 0}>Export CSV</button>
            <button className="btn-secondary" onClick={exportExcel} disabled={loading || items.length === 0}>Export Excel</button>
            <button className="btn-primary" onClick={exportPDF} disabled={loading || items.length === 0}>Export PDF</button>
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="label">From</label>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <label className="label">Customer</label>
              <input className="input" type="text" placeholder="Search customer..." value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </div>
          </div>
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="overflow-x-auto">
            <table className="table w-full table-fixed">
              <thead>
                <tr>
                  <SortableHeader label="Discount Scheme Name" sortKey="discount_scheme_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Invoice No" sortKey="invoice_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Discount %" sortKey="discount_" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Discount Amount" sortKey="discount_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Approved By" sortKey="approved_by" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.discount_scheme_name}</td>
                    <td>{r.customer}</td>
                    <td>{r.invoice_no}</td>
                    <td className="text-right">{Number(r.discount_percent || 0).toFixed(2)}</td>
                    <td className="text-right">{Number(r.discount_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>{r.approved_by || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-500">No records</td>
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

