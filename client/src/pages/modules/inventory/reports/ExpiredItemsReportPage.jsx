/**
 * @fileoverview ExpiredItemsReportPage component.
 * Comprehensive report for tracking expired inventory, near-expiry shelf-life risks,
 * batch lots, and financial loss valuation across warehouses.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import {
  AlertTriangle,
  Clock,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
  ShieldAlert,
  Layers,
  Calendar,
  DollarSign,
  Package,
  Building2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { fetchReportHeader, buildExcelHeaderRows } from "@/utils/pdfUtils.js";

export default function ExpiredItemsReportPage() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    expired_items_count: 0,
    expired_batches_count: 0,
    total_expired_qty: 0,
    total_expired_value: 0,
    total_expiring_30_qty: 0,
    total_expiring_30_value: 0,
    total_expiring_60_qty: 0,
    total_expiring_60_value: 0,
    total_expiring_90_qty: 0,
    total_expiring_90_value: 0,
  });
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [status, setStatus] = useState("ALL_RISK");
  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Load Warehouses once
  useEffect(() => {
    api
      .get("/inventory/warehouses")
      .then((res) => {
        setWarehouses(Array.isArray(res?.data?.items) ? res.data.items : []);
      })
      .catch(() => setWarehouses([]));
  }, []);

  // Fetch report data
  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        status,
        warehouse_id: warehouseId || undefined,
        search: search.trim() || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      };
      const res = await api.get("/inventory/reports/expired-items", { params });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
      if (res?.data?.summary) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error("Failed to load expired items report", err);
      setError(err?.response?.data?.message || "Failed to load report data");
      toast.error("Failed to load expired items report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, warehouseId, fromDate, toDate]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Sorting
  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(items, {
    key: "days_until_expiry",
    dir: "asc",
  });

  // Calculate filtered totals
  const filteredTotalQty = useMemo(() => {
    return items.reduce((acc, it) => acc + Number(it.qty || 0), 0);
  }, [items]);

  const filteredTotalValue = useMemo(() => {
    return items.reduce((acc, it) => acc + Number(it.total_cost_value || 0), 0);
  }, [items]);

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `GHS ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (item) => {
    const days = item.days_until_expiry;
    if (days < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          <ShieldAlert className="w-3 h-3 text-rose-600" />
          Expired ({Math.abs(days)}d ago)
        </span>
      );
    }
    if (days === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-200 text-rose-900 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-rose-700" />
          Expires Today
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <Clock className="w-3 h-3 text-amber-600" />
          {days} days left (Critical)
        </span>
      );
    }
    if (days <= 60) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300">
          <Clock className="w-3 h-3 text-yellow-600" />
          {days} days left (Warning)
        </span>
      );
    }
    if (days <= 90) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
          {days} days left (Watch)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
        {days} days left
      </span>
    );
  };

  // Export to Excel
  const exportExcel = async () => {
    try {
      const headerInfo = await fetchReportHeader(api);
      const headerRows = buildExcelHeaderRows(headerInfo, {
        title: "EXPIRED & NEAR-EXPIRY INVENTORY REPORT",
        period: `Status: ${status} | As of: ${new Date().toLocaleDateString()}`,
      });

      const exportRows = sortedItems.map((r) => ({
        "Item Code": r.item_code || "-",
        "Item Name": r.item_name || "-",
        "Category / Group": r.category_name || "-",
        "Batch / Lot No": r.batch_no || "-",
        Warehouse: r.warehouse_name || "-",
        "On-Hand Qty": Number(r.qty || 0),
        "Reserved Qty": Number(r.reserved_qty || 0),
        UOM: r.uom || "PCS",
        "Unit Cost (GHS)": Number(r.unit_cost || 0),
        "Total Value (GHS)": Number(r.total_cost_value || 0),
        "Expiry Date": r.expiry_date ? String(r.expiry_date).slice(0, 10) : "-",
        "Days Overdue / Remaining": r.days_until_expiry,
        "Expiry Status": r.expiry_status,
      }));

      const ws = XLSX.utils.aoa_to_sheet(headerRows);
      XLSX.utils.sheet_add_json(ws, exportRows, {
        origin: `A${headerRows.length + 2}`,
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Expired Items");
      XLSX.writeFile(wb, `Expired_Items_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel exported successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export Excel");
    }
  };

  // Export to PDF
  const exportPDF = async () => {
    try {
      const doc = new jsPDF("l", "mm", "a4");
      const headerInfo = await fetchReportHeader(api);

      doc.setFontSize(16);
      doc.text(headerInfo?.companyName || "Company", 14, 15);
      doc.setFontSize(11);
      doc.text("EXPIRED & NEAR-EXPIRY ITEMS REPORT", 14, 22);
      doc.setFontSize(8);
      doc.text(
        `Generated: ${new Date().toLocaleString()} | Scope: ${status} | Total Loss/Risk: ${formatCurrency(filteredTotalValue)}`,
        14,
        28,
      );

      const tableData = sortedItems.map((r) => [
        r.item_code || "-",
        r.item_name || "-",
        r.batch_no || "-",
        r.warehouse_name || "-",
        `${Number(r.qty || 0).toLocaleString()} ${r.uom || ""}`,
        Number(r.unit_cost || 0).toFixed(2),
        Number(r.total_cost_value || 0).toFixed(2),
        r.expiry_date ? String(r.expiry_date).slice(0, 10) : "-",
        r.days_until_expiry < 0
          ? `Expired (${Math.abs(r.days_until_expiry)}d ago)`
          : `${r.days_until_expiry}d left`,
      ]);

      doc.autoTable({
        startY: 32,
        head: [
          [
            "Item Code",
            "Item Name",
            "Batch No",
            "Warehouse",
            "Qty",
            "Unit Cost",
            "Total Value",
            "Expiry Date",
            "Status",
          ],
        ],
        body: tableData,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [185, 28, 28] }, // Red header for expired risk
      });

      doc.save(`Expired_Items_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF exported successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export PDF");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const resetFilters = () => {
    setStatus("ALL_RISK");
    setWarehouseId("");
    setSearch("");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 print:p-0 print:max-w-none">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <Link
            to="/inventory/reports"
            className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1 mb-1 print:hidden"
          >
            ← Back to Inventory Reports
          </Link>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <ShieldAlert className="w-7 h-7 text-rose-600" />
            Expired & Near-Expiry Items Report
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time audit of expired batches, shelf-life deterioration, near-expiry risks, and stock loss valuation.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 print:hidden flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="btn btn-outline btn-sm border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={exportExcel}
            className="btn btn-outline btn-sm border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 flex items-center gap-1.5 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={exportPDF}
            className="btn btn-outline btn-sm border-rose-600 text-rose-700 hover:bg-rose-50 dark:border-rose-500 dark:text-rose-400 flex items-center gap-1.5 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Already Expired */}
        <div className="card p-4 border-l-4 border-rose-600 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Already Expired
              </span>
              <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {formatCurrency(summary.total_expired_value)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                <strong className="text-rose-600">{Number(summary.total_expired_qty).toLocaleString()}</strong> units in{" "}
                <strong>{summary.expired_items_count}</strong> items
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Card 2: Expiring in 30 Days (Critical Risk) */}
        <div className="card p-4 border-l-4 border-amber-500 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Critical (≤ 30 Days)
              </span>
              <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {formatCurrency(summary.total_expiring_30_value)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                <strong className="text-amber-600">{Number(summary.total_expiring_30_qty).toLocaleString()}</strong> units at risk
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Card 3: Expiring in 60 Days */}
        <div className="card p-4 border-l-4 border-yellow-500 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
                Warning (≤ 60 Days)
              </span>
              <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {formatCurrency(summary.total_expiring_60_value)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                <strong className="text-yellow-600">{Number(summary.total_expiring_60_qty).toLocaleString()}</strong> units remaining
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-yellow-50 text-yellow-600 dark:bg-yellow-950/60">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Card 4: Expiring in 90 Days */}
        <div className="card p-4 border-l-4 border-blue-500 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Extended (≤ 90 Days)
              </span>
              <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                {formatCurrency(summary.total_expiring_90_value)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                <strong className="text-blue-600">{Number(summary.total_expiring_90_qty).toLocaleString()}</strong> units tracked
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60">
              <Calendar className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-4 bg-white dark:bg-slate-900 shadow-sm print:hidden">
        <div className="flex flex-col gap-3">
          {/* Status Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Scope:
            </span>
            <button
              onClick={() => setStatus("ALL_RISK")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                status === "ALL_RISK"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              All at Risk (≤ 90d)
            </button>
            <button
              onClick={() => setStatus("EXPIRED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                status === "EXPIRED"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              Expired Only
            </button>
            <button
              onClick={() => setStatus("EXPIRING_30")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                status === "EXPIRING_30"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              Expiring in 30 Days
            </button>
            <button
              onClick={() => setStatus("EXPIRING_60")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                status === "EXPIRING_60"
                  ? "bg-yellow-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              Expiring in 60 Days
            </button>
            <button
              onClick={() => setStatus("EXPIRING_90")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                status === "EXPIRING_90"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              Expiring in 90 Days
            </button>
            <button
              onClick={() => setStatus("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                status === "ALL"
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              All Batches
            </button>
          </div>

          {/* Search and Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                className="input input-sm pl-9 w-full text-xs"
                placeholder="Search item code, name, or batch #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <select
                className="input input-sm w-full text-xs"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name || w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <input
                type="date"
                className="input input-sm w-full text-xs"
                placeholder="Expiry From"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                title="Expiry Date From"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input input-sm w-full text-xs"
                placeholder="Expiry To"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                title="Expiry Date To"
              />
              {(warehouseId || search || fromDate || toDate || status !== "ALL_RISK") && (
                <button
                  onClick={resetFilters}
                  className="btn btn-ghost btn-sm text-xs text-rose-600 hover:bg-rose-50 px-2"
                  title="Clear Filters"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-600 mb-2" />
              <p className="text-sm font-semibold">Loading expired and near-expiry stock...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-600">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-80" />
              <p className="font-semibold">{error}</p>
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-base font-bold text-slate-700 dark:text-slate-300">
                No expired or near-expiry items found
              </p>
              <p className="text-xs text-slate-400 mt-1">
                There are currently no items matching the selected expiry status or criteria.
              </p>
            </div>
          ) : (
            <table className="table table-compact w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <SortableHeader
                    label="Item Code & Name"
                    sortKey="item_code"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Batch / Lot #"
                    sortKey="batch_no"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Warehouse"
                    sortKey="warehouse_name"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="On-Hand Qty"
                    sortKey="qty"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Unit Cost"
                    sortKey="unit_cost"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Total Value / Loss"
                    sortKey="total_cost_value"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Expiry Date"
                    sortKey="expiry_date"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Shelf-Life Status"
                    sortKey="days_until_expiry"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedItems.map((item) => (
                  <tr
                    key={item.balance_id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                      item.days_until_expiry < 0 ? "bg-rose-50/30 dark:bg-rose-950/20" : ""
                    }`}
                  >
                    <td className="py-2.5">
                      <div className="font-bold text-slate-800 dark:text-slate-100">{item.item_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {item.item_code}
                        {item.category_name && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {item.category_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {item.batch_no || "-"}
                      {item.serial_no && (
                        <div className="text-[10px] text-slate-400">S/N: {item.serial_no}</div>
                      )}
                    </td>
                    <td className="text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {item.warehouse_name || "-"}
                      </div>
                    </td>
                    <td className="text-right font-bold text-slate-900 dark:text-slate-100">
                      {Number(item.qty || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-500">{item.uom}</span>
                      {Number(item.reserved_qty || 0) > 0 && (
                        <div className="text-[10px] text-orange-600">
                          ({Number(item.reserved_qty).toLocaleString()} res)
                        </div>
                      )}
                    </td>
                    <td className="text-right text-slate-600 dark:text-slate-300 font-mono">
                      GHS {Number(item.unit_cost || 0).toFixed(2)}
                    </td>
                    <td className="text-right font-mono font-bold text-rose-700 dark:text-rose-400">
                      {formatCurrency(item.total_cost_value)}
                    </td>
                    <td className="font-medium text-slate-800 dark:text-slate-200">
                      {item.expiry_date ? String(item.expiry_date).slice(0, 10) : "-"}
                    </td>
                    <td>{getStatusBadge(item)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-700">
                <tr>
                  <td colSpan={3} className="py-2.5 uppercase text-[11px] text-slate-600 dark:text-slate-400">
                    Filtered Total ({items.length} records)
                  </td>
                  <td className="text-right text-slate-900 dark:text-slate-100">
                    {filteredTotalQty.toLocaleString()} units
                  </td>
                  <td></td>
                  <td className="text-right text-rose-700 dark:text-rose-400 font-mono text-sm">
                    {formatCurrency(filteredTotalValue)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
