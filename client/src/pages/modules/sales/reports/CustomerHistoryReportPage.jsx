/**
 * @fileoverview CustomerHistoryReportPage component.
 * Provides functionality for CustomerHistoryReportPage.
 */

import React, { useEffect, useState, useMemo } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { Link } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CustomerHistoryReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, []);

  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showReturns, setShowReturns] = useState(true);
  const [showInvoices, setShowInvoices] = useState(true);
  const [showOrders, setShowOrders] = useState(true);
  const [showQuotations, setShowQuotations] = useState(true);
  const [showDeliveries, setShowDeliveries] = useState(true);

  // Load customers for dropdown
  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await api.get("/sales/customers", {
          params: { active: false },
        });
        setCustomers(
          Array.isArray(res?.data?.items)
            ? res.data.items
            : Array.isArray(res?.data)
              ? res.data
              : [],
        );
      } catch (e) {
        console.error("Failed to load customers", e);
      }
    }
    loadCustomers();
  }, [pollingCounter]);

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/customer-history", {
        params: {
          customerId: customerId || null,
          from: fromDate || null,
          to: toDate || null,
        },
      });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, [customerId, fromDate, toDate, pollingCounter]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const stage = item.stage?.toUpperCase();
      if (stage === "RETURN" && !showReturns) return false;
      if (stage === "INVOICE" && !showInvoices) return false;
      if (stage === "ORDER" && !showOrders) return false;
      if (stage === "QUOTATION" && !showQuotations) return false;
      if (stage === "DELIVERY" && !showDeliveries) return false;
      return true;
    });
  }, [items, showReturns, showInvoices, showOrders, showQuotations, showDeliveries]);

  const totals = useMemo(() => {
    const totalSales = filteredItems
      .filter((i) => i.stage?.toUpperCase() === "INVOICE")
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const totalReturns = filteredItems
      .filter((i) => i.stage?.toUpperCase() === "RETURN")
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const netAmount = totalSales - totalReturns;
    return { totalSales, totalReturns, netAmount };
  }, [filteredItems]);

  function exportCSV() {
    const headers = [
      "Stage",
      "Reference",
      "Date",
      "Customer",
      "Amount",
      "Status",
      "Notes",
    ];
    const rows = filteredItems.map((r) => [
      r.stage,
      r.ref_no,
      r.txn_date ? new Date(r.txn_date).toLocaleDateString() : "-",
      r.customer_name || "-",
      Number(r.amount || 0).toFixed(2),
      r.status || "-",
      r.notes || "-",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  }

  function exportExcel() {
    const rows = filteredItems.map((r) => ({
      stage: r.stage,
      reference: r.ref_no,
      date: r.txn_date ? new Date(r.txn_date).toLocaleDateString() : "-",
      customer: r.customer_name || "-",
      amount: Number(r.amount || 0),
      status: r.status || "-",
      notes: r.notes || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customer History");
    XLSX.writeFile(wb, `customer_history_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel exported successfully");
  }

  function exportPDF() {
    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.width;
    
    // Title
    doc.setFontSize(16);
    doc.setTextColor(33, 37, 41);
    doc.text("Customer History Report", 14, 20);
    
    // Subtitle with filters
    doc.setFontSize(10);
    doc.setTextColor(108, 117, 125);
    const customerName = customerId
      ? customers.find((c) => String(c.id) === String(customerId))?.customer_name || "Selected Customer"
      : "All Customers";
    doc.text(`Customer: ${customerName} | Period: ${fromDate || "All"} to ${toDate || "All"}`, 14, 28);
    
    // Summary box
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(14, 32, pageWidth - 28, 20, 3, 3, "F");
    doc.setFontSize(10);
    doc.setTextColor(33, 37, 41);
    doc.text(`Total Sales: GH₵ ${totals.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 18, 42);
    doc.text(`Total Returns: GH₵ ${totals.totalReturns.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 80, 42);
    doc.text(`Net Amount: GH₵ ${totals.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 150, 42);
    doc.text(`Total Transactions: ${filteredItems.length}`, 220, 42);

    // Table
    const tableColumn = ["Stage", "Reference", "Date", "Customer", "Amount", "Status", "Notes"];
    const tableRows = filteredItems.map((r) => [
      r.stage,
      r.ref_no,
      r.txn_date ? new Date(r.txn_date).toLocaleDateString() : "-",
      r.customer_name || "-",
      Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
      r.status || "-",
      r.notes || "-",
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 56,
      theme: "grid",
      headStyles: {
        fillColor: [33, 37, 41],
        textColor: 255,
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: 33,
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250],
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 50 },
        4: { cellWidth: 30, halign: "right" },
        5: { cellWidth: 25 },
        6: { cellWidth: "auto" },
      },
    });

    doc.save(`customer_history_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF exported successfully");
  }

  const getStageBadgeColor = (stage) => {
    switch (stage?.toUpperCase()) {
      case "INVOICE":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "RETURN":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "ORDER":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "QUOTATION":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "DELIVERY":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };


  const { sorted: sorted_filteredItems, sortKey, sortDir, toggle } = useSort(filteredItems, "txn_date", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Customer Accounts</h1>
            <p className="text-sm mt-1">Complete sales transaction history including returns</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="label">Customer</label>
              <select
                className="input"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">From Date</label>
              <input
                type="date"
                className="input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To Date</label>
              <input
                type="date"
                className="input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            </div>

          {/* Stage Filters */}
          <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 mr-2">Show:</span>
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showQuotations}
                onChange={(e) => setShowQuotations(e.target.checked)}
              />
              <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs">Quotations</span>
            </label>
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showOrders}
                onChange={(e) => setShowOrders(e.target.checked)}
              />
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs">Orders</span>
            </label>
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showDeliveries}
                onChange={(e) => setShowDeliveries(e.target.checked)}
              />
              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs">Deliveries</span>
            </label>
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showInvoices}
                onChange={(e) => setShowInvoices(e.target.checked)}
              />
              <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">Invoices</span>
            </label>
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showReturns}
                onChange={(e) => setShowReturns(e.target.checked)}
              />
              <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs">Returns</span>
            </label>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              className="btn-success"
              onClick={exportCSV}
              disabled={loading || filteredItems.length === 0}
            >
              Export CSV
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={exportExcel}
              disabled={loading || filteredItems.length === 0}
            >
              Export Excel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={exportPDF}
              disabled={loading || filteredItems.length === 0}
            >
              Export PDF
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-sm text-green-600 dark:text-green-400">Total Sales</div>
              <div className="text-xl font-bold text-green-700 dark:text-green-300">
                GH₵ {totals.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <div className="text-sm text-red-600 dark:text-red-400">Total Returns</div>
              <div className="text-xl font-bold text-red-700 dark:text-red-300">
                GH₵ {totals.totalReturns.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-blue-600 dark:text-blue-400">Net Amount</div>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                GH₵ {totals.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-600 dark:text-slate-400">Transactions</div>
              <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
                {filteredItems.length}
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="table w-full table-fixed">
              <thead>
                <tr>
                  <SortableHeader label="Stage" sortKey="stage" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Reference" sortKey="ref_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="txn_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Amount" sortKey="amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Notes" sortKey="notes" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted_filteredItems.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${getStageBadgeColor(
                          r.stage
                        )}`}
                      >
                        {r.stage}
                      </span>
                    </td>
                    <td className="font-medium">{r.ref_no}</td>
                    <td>{r.txn_date ? new Date(r.txn_date).toLocaleDateString() : "-"}</td>
                    <td>{r.customer_name || "-"}</td>
                    <td
                      className={`text-right font-medium ${
                        r.stage?.toUpperCase() === "RETURN"
                          ? "text-red-600 dark:text-red-400"
                          : ""
                      }`}
                    >
                      {Number(r.amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>{r.status || "-"}</td>
                    <td>{r.notes || "-"}</td>
                  </tr>
                ))}
                {!filteredItems.length && !loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-500">
                      No records found
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
