/**
 * @fileoverview PhysicalStockTakeList component.
 * Enterprise Formal Physical Stock Take Management & Audit Console.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  Plus,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  Play,
  FileSpreadsheet,
} from "lucide-react";
import { api } from "api/client";
import FloatingCreateButton from "@/components/FloatingCreateButton.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import {
  fetchReportHeader,
  applyPdfHeader,
  applyPdfFooter,
  buildExcelHeaderRows,
} from "../../../utils/pdfUtils.js";

const STATUS_CONFIG = {
  DRAFT: { label: "Draft", color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300" },
  COUNTING: { label: "Counting in Progress", color: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300" },
  COUNT_SUBMITTED: { label: "Count Submitted", color: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300" },
  UNDER_REVIEW: { label: "Under Review", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300" },
  RECOUNT_REQUIRED: { label: "Recount Required", color: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300" },
  APPROVED: { label: "Approved", color: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/40 dark:text-teal-300" },
  ADJUSTMENT_POSTED: { label: "Adjustment Posted", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300" },
  CLOSED: { label: "Closed", color: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400" },
  CANCELLED: { label: "Cancelled", color: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400" },
};

export default function PhysicalStockTakeList() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [takesRes, whRes] = await Promise.all([
        api.get("/inventory/stock-takes?type=PHYSICAL"),
        api.get("/inventory/warehouses"),
      ]);
      setItems(Array.isArray(takesRes.data?.items) ? takesRes.data.items : []);
      setWarehouses(Array.isArray(whRes.data?.items) ? whRes.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load physical stock takes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    let list = items.slice();

    if (statusFilter !== "ALL") {
      list = list.filter((s) => (s.status || "DRAFT").toUpperCase() === statusFilter);
    }

    if (warehouseFilter !== "ALL") {
      list = list.filter((s) => String(s.warehouse_id) === String(warehouseFilter));
    }

    if (searchTerm.trim()) {
      list = filterAndSort(list, {
        query: searchTerm,
        getKeys: (s) => [
          s.stock_take_no,
          s.warehouse_name,
          s.status,
          s.created_by_name,
          s.adjustment_no,
          s.count_type,
        ],
      });
    }

    return list;
  }, [items, searchTerm, statusFilter, warehouseFilter]);

  // Executive KPI summary stats
  const kpis = useMemo(() => {
    const total = items.length;
    const counting = items.filter((i) => ["DRAFT", "COUNTING", "RECOUNT_REQUIRED"].includes(i.status)).length;
    const review = items.filter((i) => ["UNDER_REVIEW", "COUNT_SUBMITTED"].includes(i.status)).length;
    const approved = items.filter((i) => i.status === "APPROVED").length;
    const posted = items.filter((i) => ["ADJUSTMENT_POSTED", "CLOSED"].includes(i.status)).length;
    const totalVarianceVal = items.reduce((acc, curr) => acc + Number(curr.total_variance_value || 0), 0);

    return { total, counting, review, approved, posted, totalVarianceVal };
  }, [items]);

  async function exportExcel() {
    if (!filtered.length) return;
    const headerInfo = await fetchReportHeader(api);
    const headerRows = buildExcelHeaderRows(headerInfo, {
      title: "PHYSICAL STOCK TAKE SUMMARY REPORT",
      period: `Generated on ${new Date().toLocaleDateString()}`,
    });

    const exportRows = filtered.map((s) => ({
      "Stock Take No": s.stock_take_no || "-",
      Date: s.stock_take_date ? String(s.stock_take_date).slice(0, 10) : "-",
      Warehouse: s.warehouse_name || "All Warehouses",
      Scope: s.count_type || "FULL_COUNT",
      Status: s.status || "DRAFT",
      "Total Items": Number(s.total_items || s.detail_lines_count || 0),
      "Discrepancies": Number(s.total_variance_items || 0),
      "Variance Value": Number(s.total_variance_value || 0),
      "Adjustment Ref": s.adjustment_no || "-",
      "Created By": s.created_by_name || "-",
      "Approved By": s.approved_by_name || "-",
    }));

    const ws = XLSX.utils.json_to_sheet([...headerRows, ...exportRows]);
    ws["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PhysicalStockTakes");
    XLSX.writeFile(wb, `physical-stock-takes-${headerInfo.currCode}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportPDF() {
    if (!filtered.length) return;
    const headerInfo = await fetchReportHeader(api);
    const doc = new jsPDF("l", "mm", "a4");
    const margin = 14;
    const pageW = 297;

    let y = applyPdfHeader(doc, headerInfo, {
      title: "PHYSICAL STOCK TAKE SUMMARY REPORT",
      subtitle: `Total Formal Audits: ${filtered.length} | Status Filter: ${statusFilter}`,
      kpis: [
        { label: "TOTAL AUDITS", value: String(kpis.total), color: [59, 130, 246] },
        { label: "IN REVIEW", value: String(kpis.review), color: [245, 158, 11] },
        { label: "ADJUSTMENT POSTED", value: String(kpis.posted), color: [16, 185, 129] },
        { label: "NET VARIANCE", value: `${headerInfo.currPrefix}${kpis.totalVarianceVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: [239, 68, 68] },
      ],
    });

    // Table header
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, pageW - margin * 2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("STOCK TAKE NO", margin + 2, y + 4.2);
    doc.text("DATE", 52, y + 4.2);
    doc.text("WAREHOUSE", 78, y + 4.2);
    doc.text("SCOPE", 130, y + 4.2);
    doc.text("ITEMS", 165, y + 4.2, { align: "right" });
    doc.text("VARIANCE", 195, y + 4.2, { align: "right" });
    doc.text(`VALUE (${headerInfo.currCode})`, 235, y + 4.2, { align: "right" });
    doc.text("STATUS", 248, y + 4.2);
    y += 8.5;
    doc.setTextColor(51, 65, 85);

    filtered.forEach((s) => {
      if (y > 190) {
        doc.addPage();
        y = 15;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(String(s.stock_take_no || "-"), margin + 2, y);
      doc.text(s.stock_take_date ? String(s.stock_take_date).slice(0, 10) : "-", 52, y);
      doc.text(String(s.warehouse_name || "All Warehouses").slice(0, 24), 78, y);
      doc.text(String(s.count_type || "FULL_COUNT"), 130, y);
      doc.text(String(s.total_items || s.detail_lines_count || 0), 165, y, { align: "right" });
      doc.text(String(s.total_variance_items || 0), 195, y, { align: "right" });
      doc.text(Number(s.total_variance_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }), 235, y, { align: "right" });
      doc.text(String(s.status || "DRAFT"), 248, y);
      y += 4.5;
    });

    applyPdfFooter(doc);
    doc.save(`physical-stock-takes-${headerInfo.currCode}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function getActionElement(s) {
    const st = (s.status || "DRAFT").toUpperCase();
    if (st === "DRAFT") {
      return (
        <Link
          to={`/inventory/physical-stock-take/${s.id}`}
          className="btn btn-sm btn-primary inline-flex items-center gap-1.5 text-xs"
        >
          <Play size={13} /> Start Count
        </Link>
      );
    }
    if (st === "COUNTING" || st === "RECOUNT_REQUIRED") {
      return (
        <Link
          to={`/inventory/physical-stock-take/${s.id}`}
          className="btn btn-sm btn-warning inline-flex items-center gap-1.5 text-xs text-white"
        >
          <ClipboardCheck size={13} /> Count Items
        </Link>
      );
    }
    if (st === "UNDER_REVIEW" || st === "COUNT_SUBMITTED") {
      return (
        <Link
          to={`/inventory/physical-stock-take/${s.id}`}
          className="btn btn-sm btn-outline border-amber-500 text-amber-700 hover:bg-amber-500 hover:text-white inline-flex items-center gap-1.5 text-xs"
        >
          <AlertTriangle size={13} /> Review & Approve
        </Link>
      );
    }
    if (st === "APPROVED") {
      return (
        <Link
          to={`/inventory/physical-stock-take/${s.id}`}
          className="btn btn-sm btn-success inline-flex items-center gap-1.5 text-xs"
        >
          <CheckCircle2 size={13} /> Post Adjustment
        </Link>
      );
    }
    return (
      <Link
        to={`/inventory/physical-stock-take/${s.id}`}
        className="btn btn-sm btn-secondary inline-flex items-center gap-1.5 text-xs"
      >
        <Eye size={13} /> View Audit
      </Link>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Top Banner Header */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardCheck className="w-7 h-7" /> Physical Stock Take Management
              </h1>
              <p className="text-sm mt-1 opacity-90">
                Enterprise formal inventory verification, discrepancy reconciliation, and controlled adjustment posting
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary text-xs">
                Return to Menu
              </Link>
              <button onClick={exportExcel} disabled={!filtered.length} className="btn btn-outline btn-sm text-white border-white/30 hover:bg-white/10 flex items-center gap-1.5 text-xs">
                <Download size={14} /> Excel
              </button>
              <button onClick={exportPDF} disabled={!filtered.length} className="btn btn-outline btn-sm text-white border-white/30 hover:bg-white/10 flex items-center gap-1.5 text-xs">
                <Download size={14} /> PDF
              </button>
              <Link to="/inventory/physical-stock-take/new" className="btn btn-success flex items-center gap-1.5 text-xs font-semibold">
                <Plus size={15} /> New Physical Stock Take
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main List Card with Filters & Search */}
      <div className="card shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-lg p-5">
        {error ? <div className="p-3 mb-4 rounded bg-red-100 border border-red-300 text-red-700 text-sm">{error}</div> : null}

        {/* Filter Controls Row */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search stock take no, warehouse, creator..."
                className="input input-sm pl-9 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="input input-sm max-w-[200px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="COUNTING">Counting in Progress</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RECOUNT_REQUIRED">Recount Required</option>
              <option value="APPROVED">Approved</option>
              <option value="ADJUSTMENT_POSTED">Adjustment Posted</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              className="input input-sm max-w-[200px]"
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {(w.warehouse_code ? `${w.warehouse_code} - ` : "") + w.warehouse_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="btn btn-outline btn-sm text-xs flex items-center gap-1">
              <RefreshCw size={13} /> Refresh
            </button>
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className={"table w-full text-left " + (viewMode === "grid" ? "table-grid-mode" : "")}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-600 dark:text-slate-300 uppercase">
                <th className="py-3 px-3">Stock Take No</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Warehouse / Scope</th>
                <th className="py-3 px-3 text-center">Items</th>
                <th className="py-3 px-3 text-center">Variances</th>
                <th className="py-3 px-3 text-right">Variance Value</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3">Adjustment Ref</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-10 text-slate-500">
                    <RefreshCw className="animate-spin inline mr-2" size={16} /> Loading physical stock takes...
                  </td>
                </tr>
              ) : null}

              {!loading && !filtered.length ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-slate-500">
                    <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    No physical stock takes found matching the selected filters.
                  </td>
                </tr>
              ) : null}

              {filtered.map((s) => {
                const st = (s.status || "DRAFT").toUpperCase();
                const stConf = STATUS_CONFIG[st] || { label: st, color: "bg-slate-100 text-slate-700 border-slate-300" };
                const varItems = Number(s.total_variance_items || 0);
                const varVal = Number(s.total_variance_value || 0);

                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-brand-700 dark:text-brand-300">
                      <Link to={`/inventory/physical-stock-take/${s.id}`} className="hover:underline">
                        {s.stock_take_no || `STK-#${s.id}`}
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {s.stock_take_date ? String(s.stock_take_date).slice(0, 10) : "-"}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {s.warehouse_name || "All Warehouses"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Scope: {s.category_name ? `${s.category_name} (${s.count_type})` : s.count_type || "FULL_COUNT"}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-medium">
                      {Number(s.total_items || s.detail_lines_count || 0)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {varItems > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                          {varItems} discrepancies
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          0
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {varVal > 0 ? `GH₵ ${varVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${stConf.color}`}>
                        {stConf.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs">
                      {s.adjustment_no ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {s.adjustment_no}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {getActionElement(s)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <FloatingCreateButton to="/inventory/physical-stock-take/new" title="New Physical Stock Take" />
    </div>
  );
}
