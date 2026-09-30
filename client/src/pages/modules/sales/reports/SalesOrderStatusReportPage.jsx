/**
 * @fileoverview SalesOrderStatusReportPage component.
 * Provides functionality for SalesOrderStatusReportPage.
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
export default function SalesOrderStatusReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [customer, setCustomer] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/sales-order-status", {
        params: {
          from: from || null,
          to: to || null,
          status: status || null,
          customer: customer || null,
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
  }, [from, to, status, customer, salesperson, pollingCounter]);

  function exportCSV() {
    if (!items.length) return;
    const headers = [
      "Sales Order No",
      "Order Date",
      "Customer",
      "Total Amount",
      "Status",
      "Salesperson",
      "Linked Quotation",
    ];
    const rows = items.map((r) => [
      r.order_no || "-",
      r.order_date ? new Date(r.order_date).toLocaleDateString() : "-",
      r.customer_name || "-",
      Number(r.total_amount || 0).toFixed(2),
      r.status || "-",
      r.salesperson || "-",
      r.linked_quotation || "-",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales-order-status.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        order_no: r.order_no,
        order_date: r.order_date ? new Date(r.order_date).toLocaleDateString() : "-",
        customer: r.customer_name,
        total_amount: Number(r.total_amount || 0),
        status: r.status,
        salesperson: r.salesperson,
        linked_quotation: r.linked_quotation,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SalesOrderStatus");
    XLSX.writeFile(wb, "sales-order-status.xlsx");
  }
  function exportPDF() {
    if (!items.length) return;
    const doc = new jsPDF("p", "mm", "a4");
    let y = 15;
    doc.setFontSize(14);
    doc.text("Sales Order Status", 10, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Order", 10, y);
    doc.text("Date", 40, y);
    doc.text("Customer", 70, y);
    doc.text("Amount", 150, y);
    doc.text("Status", 180, y);
    y += 4;
    doc.line(10, y, 200, y);
    y += 5;
    items.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.text(String(r.order_no || "-").slice(0, 18), 10, y);
      doc.text(
        r.order_date ? new Date(r.order_date).toLocaleDateString() : "-",
        40,
        y,
      );
      doc.text(String(r.customer_name || "-").slice(0, 50), 70, y);
      doc.text(String(Number(r.total_amount || 0).toFixed(2)), 150, y);
      doc.text(String(r.status || "-").slice(0, 12), 180, y);
      y += 5;
    });
    doc.save("sales-order-status.pdf");
  }


  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "date", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Sales Order Status
            </h1>
            <p className="text-sm mt-1">Monitor active orders</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
            <button className="btn-success" onClick={exportCSV} disabled={loading || items.length === 0}>
              Export CSV
            </button>
            <button className="btn-secondary" onClick={exportExcel} disabled={loading || items.length === 0}>
              Export Excel
            </button>
            <button className="btn-primary" onClick={exportPDF} disabled={loading || items.length === 0}>
              Export PDF
            </button>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="label">From</label>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <input className="input" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status..." />
            </div>
            <div>
              <label className="label">Customer</label>
              <input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer..." />
            </div>
            <div>
              <label className="label">Salesperson</label>
              <input className="input" value={salesperson} onChange={(e) => setSalesperson(e.target.value)} placeholder="Username..." />
            </div>
            
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full table-fixed">
              <thead>
                <tr>
                  <SortableHeader label="Sales Order No" sortKey="sales_order_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Order Date" sortKey="order_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Total Amount" sortKey="total_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Salesperson" sortKey="salesperson" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Linked Quotation" sortKey="linked_quotation" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.order_no}</td>
                    <td>{r.order_date ? new Date(r.order_date).toLocaleDateString() : "-"}</td>
                    <td>{r.customer_name}</td>
                    <td className="text-right">
                      {Number(r.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td>{r.status}</td>
                    <td>{r.salesperson || "-"}</td>
                    <td>{r.linked_quotation || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-500">No records</td>
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

