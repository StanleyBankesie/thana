/**
 * @fileoverview PhysicalStockTakeForm component.
 * Enterprise Physical Stock Take Creation Wizard & Interactive Audit/Reconciliation Workspace.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ClipboardCheck,
  Play,
  Save,
  Send,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileSpreadsheet,
  Download,
  Printer,
  FileText,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  History,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import {
  fetchReportHeader,
  applyPdfHeader,
  applyPdfFooter,
  buildExcelHeaderRows,
} from "../../../utils/pdfUtils.js";

const VARIANCE_REASONS = [
  "Damaged Stock",
  "Lost Stock / Shrinkage",
  "Unrecorded Stock Issue",
  "Unrecorded Stock Receipt",
  "Counting Error",
  "Warehouse Transfer Error",
  "Expired Stock",
  "Wrong Item Pack / UOM",
  "Data Entry Error",
  "Other",
];

const STATUS_STEPS = [
  { key: "DRAFT", label: "1. Scope & Setup" },
  { key: "COUNTING", label: "2. Physical Count" },
  { key: "UNDER_REVIEW", label: "3. Discrepancy Review" },
  { key: "APPROVED", label: "4. Supervisor Approval" },
  { key: "ADJUSTMENT_POSTED", label: "5. Adjustment Posted" },
];

function toISODate(v) {
  if (!v) return "";
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function PhysicalStockTakeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  // Lookups
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);

  // Creation state
  const [createForm, setCreateForm] = useState({
    stock_take_type: "PHYSICAL",
    stock_take_date: toISODate(new Date()),
    warehouse_id: "",
    count_type: "FULL_COUNT",
    count_scope: "FULL_WAREHOUSE",
    category_id: "",
    is_blind_count: false,
    remarks: "",
  });

  // Workspace stock take data (when id !== "new")
  const [stockTake, setStockTake] = useState(null);
  const [details, setDetails] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // UI Tabs & Filters
  const [activeTab, setActiveTab] = useState("ALL"); // ALL, VARIANCES, MATCHED, LOGS
  const [searchTerm, setSearchTerm] = useState("");
  const [hideExpected, setHideExpected] = useState(false);

  // Modals
  const [showRecountModal, setShowRecountModal] = useState(false);
  const [recountReason, setRecountReason] = useState("");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  // Load initial lookups
  useEffect(() => {
    (async () => {
      try {
        const whRes = await api.get("/inventory/warehouses").catch(() => null);
        if (whRes?.data) {
          const list = Array.isArray(whRes.data.items) ? whRes.data.items : (Array.isArray(whRes.data) ? whRes.data : []);
          setWarehouses(list);
        }
      } catch {}

      try {
        const catRes = await api.get("/inventory/categories").catch(() => null) 
          || await api.get("/inventory/item-groups").catch(() => null);
        if (catRes?.data) {
          const list = Array.isArray(catRes.data.items) ? catRes.data.items : (Array.isArray(catRes.data) ? catRes.data : []);
          setCategories(list);
        }
      } catch {}
    })();
  }, []);

  // Load stock take workspace details
  async function fetchStockTakeDetails() {
    if (isNew) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/inventory/stock-takes/${id}`);
      setStockTake(res.data?.item || null);
      setDetails(Array.isArray(res.data?.details) ? res.data.details : []);
      setAuditLogs(Array.isArray(res.data?.logs) ? res.data.logs : []);
      if (res.data?.item?.is_blind_count) {
        setHideExpected(true);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load stock take");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStockTakeDetails();
  }, [id, isNew]);

  // Handle line count change
  const handlePhysicalQtyChange = (detailId, val) => {
    setDetails((prev) =>
      prev.map((d) => {
        if (d.id !== detailId) return d;
        const pQty = val === "" ? null : Number(val);
        const expQty = Number(d.expected_qty || d.system_qty || 0);
        const cost = Number(d.effective_unit_cost || d.unit_cost || 0);

        let vQty = 0;
        let vPct = 0;
        let vVal = 0;
        let cStatus = "PENDING";

        if (pQty !== null && !isNaN(pQty)) {
          vQty = pQty - expQty;
          vPct = expQty !== 0 ? (vQty / expQty) * 100 : (vQty === 0 ? 0 : 100);
          vVal = vQty * cost;
          if (Math.abs(vQty) < 0.0001) {
            cStatus = "MATCHED";
          } else if (vQty < 0) {
            cStatus = "SHORTAGE";
          } else {
            cStatus = "SURPLUS";
          }
        }

        return {
          ...d,
          physical_qty: val,
          variance_qty: vQty,
          variance_pct: vPct,
          variance_value: vVal,
          count_status: cStatus,
        };
      }),
    );
  };

  const handleVarianceReasonChange = (detailId, reason) => {
    setDetails((prev) =>
      prev.map((d) => (d.id === detailId ? { ...d, variance_reason: reason } : d)),
    );
  };

  // Metrics summary
  const summary = useMemo(() => {
    const totalLines = details.length;
    const countedLines = details.filter((d) => d.physical_qty !== null && d.physical_qty !== "" && d.physical_qty !== undefined).length;
    const shortages = details.filter((d) => Number(d.variance_qty || 0) < -0.0001);
    const surpluses = details.filter((d) => Number(d.variance_qty || 0) > 0.0001);
    const matched = details.filter((d) => Math.abs(Number(d.variance_qty || 0)) < 0.0001 && d.physical_qty !== null && d.physical_qty !== "");

    const totalShortageVal = shortages.reduce((acc, c) => acc + Math.abs(Number(c.variance_value || 0)), 0);
    const totalSurplusVal = surpluses.reduce((acc, c) => acc + Math.abs(Number(c.variance_value || 0)), 0);
    const netVarianceVal = surpluses.reduce((acc, c) => acc + Number(c.variance_value || 0), 0) + shortages.reduce((acc, c) => acc + Number(c.variance_value || 0), 0);

    return {
      totalLines,
      countedLines,
      shortagesCount: shortages.length,
      surplusesCount: surpluses.length,
      discrepanciesCount: shortages.length + surpluses.length,
      matchedCount: matched.length,
      totalShortageVal,
      totalSurplusVal,
      netVarianceVal,
    };
  }, [details]);

  // Filtered detail rows
  const filteredDetails = useMemo(() => {
    let list = details;

    if (activeTab === "VARIANCES") {
      list = list.filter((d) => Math.abs(Number(d.variance_qty || 0)) >= 0.0001);
    } else if (activeTab === "MATCHED") {
      list = list.filter((d) => Math.abs(Number(d.variance_qty || 0)) < 0.0001 && d.physical_qty !== null && d.physical_qty !== "");
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (d) =>
          d.item_code?.toLowerCase().includes(term) ||
          d.item_name?.toLowerCase().includes(term) ||
          d.variance_reason?.toLowerCase().includes(term),
      );
    }

    return list;
  }, [details, activeTab, searchTerm]);

  // 1. Create Stock Take Handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.warehouse_id) {
      toast.error("Please select a warehouse for the physical stock take.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post("/inventory/stock-takes", createForm);
      toast.success(`Stock Take ${res.data?.stock_take_no} created successfully`);
      navigate(`/inventory/physical-stock-take/${res.data?.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create stock take");
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Start Counting & Capture Snapshot
  const handleStartCount = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/inventory/stock-takes/${id}/start-count`);
      toast.success(`Physical count started. Baseline snapshot captured for ${res.data?.total_items} items.`);
      await fetchStockTakeDetails();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to start count");
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Save Draft Counts
  const handleSaveCount = async () => {
    setActionLoading(true);
    try {
      await api.put(`/inventory/stock-takes/${id}/save-count`, { details });
      toast.success("Physical counts saved as draft");
      await fetchStockTakeDetails();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save counts");
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Submit for Review
  const handleSubmitCount = async () => {
    // Validate reasons for discrepancies
    const unreasonedVariances = details.filter(
      (d) => Math.abs(Number(d.variance_qty || 0)) >= 0.0001 && !d.variance_reason,
    );
    if (unreasonedVariances.length > 0) {
      toast.warning(`Please provide variance reasons for ${unreasonedVariances.length} discrepancies before submitting.`);
      setActiveTab("VARIANCES");
      return;
    }

    setActionLoading(true);
    try {
      await api.put(`/inventory/stock-takes/${id}/save-count`, { details });
      const res = await api.post(`/inventory/stock-takes/${id}/submit-count`);
      toast.success(`Stock take submitted for review (${res.data?.total_variance_items} discrepancies identified)`);
      await fetchStockTakeDetails();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit count");
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Request Recount
  const handleRequestRecount = async () => {
    if (!recountReason.trim()) {
      toast.error("Please provide a reason for the recount request.");
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/inventory/stock-takes/${id}/request-recount`, { reason: recountReason });
      toast.info("Recount requested. Stock take unlocked for recount.");
      setShowRecountModal(false);
      setRecountReason("");
      await fetchStockTakeDetails();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to request recount");
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Approve Stock Take
  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await api.post(`/inventory/stock-takes/${id}/approve`);
      toast.success("Stock Take approved. Ready for inventory adjustment posting.");
      setShowApproveModal(false);
      await fetchStockTakeDetails();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to approve stock take");
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Post Inventory Adjustment
  const handlePostAdjustment = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/inventory/stock-takes/${id}/post-adjustment`);
      toast.success(
        res.data?.adjustment_no
          ? `Inventory Adjustment ${res.data.adjustment_no} posted! Balances updated in ledger.`
          : "Stock Take closed. All inventory items matched baseline.",
      );
      setShowAdjustModal(false);
      await fetchStockTakeDetails();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to post adjustment");
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Cancel Stock Take
  const handleCancelStockTake = async () => {
    if (!window.confirm("Are you sure you want to cancel this stock take?")) return;
    setActionLoading(true);
    try {
      await api.post(`/inventory/stock-takes/${id}/cancel`, { reason: "User requested cancellation" });
      toast.warn("Stock Take cancelled");
      await fetchStockTakeDetails();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to cancel");
    } finally {
      setActionLoading(false);
    }
  };

  // Print Blank Count Sheet
  async function printCountSheet() {
    const headerInfo = await fetchReportHeader(api);
    const doc = new jsPDF("p", "mm", "a4");
    const margin = 14;
    const pageW = 210;

    let y = applyPdfHeader(doc, headerInfo, {
      title: "PHYSICAL STOCK COUNT SHEET (BLANK AUDIT)",
      subtitle: `Stock Take: ${stockTake?.stock_take_no || "-"} | Warehouse: ${stockTake?.warehouse_name || "All"} | Date: ${stockTake?.count_date ? String(stockTake.count_date).slice(0, 10) : "-"}`,
      kpis: [
        { label: "AUDIT ITEMS", value: String(details.length), color: [59, 130, 246] },
        { label: "SCOPE", value: String(stockTake?.count_type || "FULL_COUNT"), color: [16, 185, 129] },
      ],
    });

    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, pageW - margin * 2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("ITEM CODE", margin + 2, y + 4.2);
    doc.text("ITEM DESCRIPTION", 55, y + 4.2);
    doc.text("UOM", 130, y + 4.2);
    doc.text("PHYSICAL COUNT", pageW - margin - 2, y + 4.2, { align: "right" });
    y += 8.5;
    doc.setTextColor(51, 65, 85);

    details.forEach((d) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(String(d.item_code || "-"), margin + 2, y);
      doc.text(String(d.item_name || "-").slice(0, 36), 55, y);
      doc.text(String(d.uom_name || d.uom || "PCS"), 130, y);
      doc.rect(pageW - margin - 25, y - 3.5, 25, 4.5);
      y += 6;
    });

    applyPdfFooter(doc);
    doc.save(`count-sheet-${stockTake?.stock_take_no || id}.pdf`);
  }

  // Print Variance Reconciliation Report
  async function printVarianceReport() {
    const headerInfo = await fetchReportHeader(api);
    const doc = new jsPDF("l", "mm", "a4");
    const margin = 14;
    const pageW = 297;

    let y = applyPdfHeader(doc, headerInfo, {
      title: "PHYSICAL STOCK TAKE VARIANCE RECONCILIATION REPORT",
      subtitle: `Stock Take: ${stockTake?.stock_take_no || "-"} | Warehouse: ${stockTake?.warehouse_name || "All"} | Status: ${stockTake?.status}`,
      kpis: [
        { label: "TOTAL ITEMS", value: String(summary.totalLines), color: [59, 130, 246] },
        { label: "SHORTAGES", value: `${summary.shortagesCount} (-GH₵ ${summary.totalShortageVal.toFixed(2)})`, color: [239, 68, 68] },
        { label: "SURPLUSES", value: `${summary.surplusesCount} (+GH₵ ${summary.totalSurplusVal.toFixed(2)})`, color: [16, 185, 129] },
        { label: "NET IMPACT", value: `${headerInfo.currPrefix}${summary.netVarianceVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: [245, 158, 11] },
      ],
    });

    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, pageW - margin * 2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("ITEM CODE & NAME", margin + 2, y + 4.2);
    doc.text("UOM", 85, y + 4.2);
    doc.text("SYSTEM SNAPSHOT", 115, y + 4.2, { align: "right" });
    doc.text("MOVEMENTS", 145, y + 4.2, { align: "right" });
    doc.text("EXPECTED", 175, y + 4.2, { align: "right" });
    doc.text("PHYSICAL", 205, y + 4.2, { align: "right" });
    doc.text("VARIANCE", 235, y + 4.2, { align: "right" });
    doc.text("REASON", 242, y + 4.2);
    y += 8.5;
    doc.setTextColor(51, 65, 85);

    details.forEach((d) => {
      if (y > 190) {
        doc.addPage();
        y = 15;
      }
      const vQty = Number(d.variance_qty || 0);
      const isDiscrepant = Math.abs(vQty) >= 0.0001;

      doc.setFont("helvetica", isDiscrepant ? "bold" : "normal");
      doc.setFontSize(7);
      doc.text(`${d.item_code} - ${String(d.item_name || "").slice(0, 24)}`, margin + 2, y);
      doc.text(String(d.uom_name || d.uom || "PCS"), 85, y);
      doc.text(Number(d.system_qty || 0).toLocaleString(), 115, y, { align: "right" });
      doc.text(Number(d.movement_qty || 0).toLocaleString(), 145, y, { align: "right" });
      doc.text(Number(d.expected_qty || 0).toLocaleString(), 175, y, { align: "right" });
      doc.text(d.physical_qty !== null ? Number(d.physical_qty).toLocaleString() : "-", 205, y, { align: "right" });
      doc.text(vQty.toLocaleString(), 235, y, { align: "right" });
      doc.text(String(d.variance_reason || (isDiscrepant ? "Unspecified" : "Matched")).slice(0, 18), 242, y);
      y += 4.5;
    });

    applyPdfFooter(doc);
    doc.save(`stock-take-variance-report-${stockTake?.stock_take_no || id}.pdf`);
  }

  // ==========================================
  // RENDER: 1. NEW STOCK TAKE CREATION WIZARD
  // ==========================================
  if (isNew) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
        <div className="card shadow-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-lg">
          <div className="card-header bg-brand text-white rounded-t-lg p-5">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <ClipboardCheck className="w-7 h-7" /> New Physical Stock Take
                </h1>
                <p className="text-sm mt-1 opacity-90">
                  Configure stock-take parameters, target warehouse, counting scope, and baseline controls
                </p>
              </div>
              <button onClick={() => window.history.back()} className="btn btn-secondary text-xs">
                Back to List
              </button>
            </div>
          </div>

          <div className="card-body p-6">
            <form onSubmit={handleCreateSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label font-semibold text-slate-700 dark:text-slate-300">
                    Warehouse *
                  </label>
                  <select
                    className="input w-full mt-1"
                    value={createForm.warehouse_id}
                    onChange={(e) => setCreateForm({ ...createForm, warehouse_id: e.target.value })}
                    required
                  >
                    <option value="">Select Warehouse...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={String(w.id)}>
                        {(w.warehouse_code ? `${w.warehouse_code} - ` : "") + w.warehouse_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label font-semibold text-slate-700 dark:text-slate-300">
                    Audit Date *
                  </label>
                  <input
                    type="date"
                    className="input w-full mt-1"
                    value={createForm.stock_take_date}
                    onChange={(e) => setCreateForm({ ...createForm, stock_take_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label font-semibold text-slate-700 dark:text-slate-300">
                    Counting Scope
                  </label>
                  <select
                    className="input w-full mt-1"
                    value={createForm.count_type}
                    onChange={(e) => setCreateForm({ ...createForm, count_type: e.target.value })}
                  >
                    <option value="FULL_COUNT">Full Warehouse Count</option>
                    <option value="CATEGORY_COUNT">Category-Specific Count</option>
                    <option value="CYCLE_COUNT">Cycle / High Value Count</option>
                  </select>
                </div>

                {createForm.count_type === "CATEGORY_COUNT" && (
                  <div>
                    <label className="label font-semibold text-slate-700 dark:text-slate-300">
                      Product Category *
                    </label>
                    <select
                      className="input w-full mt-1"
                      value={createForm.category_id}
                      onChange={(e) => setCreateForm({ ...createForm, category_id: e.target.value })}
                      required
                    >
                      <option value="">Select Category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.category_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Blind Count Option */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-900/30">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary mt-1"
                    checked={createForm.is_blind_count}
                    onChange={(e) => setCreateForm({ ...createForm, is_blind_count: e.target.checked })}
                  />
                  <div>
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      Enable Blind Count (Recommended for Audit Integrity)
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      When enabled, expected system quantities will be hidden from counters during count entry to prevent bias.
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="label font-semibold text-slate-700 dark:text-slate-300">
                  Audit Notes & Scope Description
                </label>
                <textarea
                  className="input w-full mt-1 h-20 text-xs"
                  placeholder="e.g. Annual physical inventory audit across main distribution center..."
                  value={createForm.remarks}
                  onChange={(e) => setCreateForm({ ...createForm, remarks: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-success text-xs flex items-center gap-1.5 font-semibold"
                >
                  {actionLoading ? "Initializing..." : "Create Stock Take"} <ArrowRight size={14} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: 2. WORKSPACE & AUDIT CONSOLE
  // ==========================================
  const currentStatus = (stockTake?.status || "DRAFT").toUpperCase();
  const isCountingMode = currentStatus === "COUNTING" || currentStatus === "RECOUNT_REQUIRED";
  const isReviewMode = currentStatus === "UNDER_REVIEW";
  const isApproved = currentStatus === "APPROVED";
  const isPosted = currentStatus === "ADJUSTMENT_POSTED" || currentStatus === "CLOSED";

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Top Banner */}
      <div className="card shadow-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-lg">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold font-mono">
                  {stockTake?.stock_take_no || `Stock Take #${id}`}
                </h1>
                <span className="px-3 py-0.5 rounded-full text-xs font-semibold uppercase bg-white/20 text-white border border-white/30">
                  {stockTake?.status || "DRAFT"}
                </span>
                {stockTake?.recount_count > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/30 text-white border border-white/20">
                    Recount #{stockTake.recount_count}
                  </span>
                )}
              </div>
              <p className="text-sm mt-1 opacity-90 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>Warehouse: <strong>{stockTake?.warehouse_name || "All"}</strong></span>
                <span>Date: <strong>{stockTake?.count_date ? String(stockTake.count_date).slice(0, 10) : "-"}</strong></span>
                <span>Scope: <strong>{stockTake?.category_name ? `${stockTake.category_name} (${stockTake.count_type})` : stockTake?.count_type || "FULL_COUNT"}</strong></span>
                {stockTake?.adjustment_no && (
                  <span>Adjustment Ref: <strong>{stockTake.adjustment_no}</strong></span>
                )}
              </p>
            </div>

            {/* Top Buttons */}
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={() => navigate("/inventory/physical-stock-take")} className="btn btn-secondary text-xs">
                Back to List
              </button>
              <button onClick={printCountSheet} className="btn btn-outline btn-sm text-white border-white/30 hover:bg-white/10 flex items-center gap-1.5 text-xs">
                <FileText size={14} /> Count Sheet
              </button>
              <button onClick={printVarianceReport} className="btn btn-outline btn-sm text-white border-white/30 hover:bg-white/10 flex items-center gap-1.5 text-xs">
                <Printer size={14} /> Variance Report
              </button>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            {STATUS_STEPS.map((st, idx) => {
              const stepIndex = STATUS_STEPS.findIndex((s) => s.key === currentStatus);
              const isPast = stepIndex > idx || isPosted;
              const isCurrent = currentStatus === st.key;

              return (
                <div
                  key={st.key}
                  className={`p-2 rounded-lg border font-medium transition-all ${
                    isCurrent
                      ? "bg-brand text-white border-brand shadow-sm font-bold"
                      : isPast
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    {isPast && <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />}
                    {st.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="card p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-lg text-center">
          <div className="text-xs text-slate-500 font-semibold uppercase">Total Scope Items</div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{summary.totalLines}</div>
        </div>
        <div className="card p-3 border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 rounded-lg text-center">
          <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase">Counted</div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-0.5">
            {summary.countedLines} <span className="text-xs text-slate-400">/ {summary.totalLines}</span>
          </div>
        </div>
        <div className="card p-3 border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-lg text-center">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase">Matched</div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{summary.matchedCount}</div>
        </div>
        <div className="card p-3 border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 rounded-lg text-center">
          <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold uppercase">Shortages</div>
          <div className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-0.5">
            {summary.shortagesCount} <span className="text-xs font-normal">(-GH₵ {summary.totalShortageVal.toFixed(2)})</span>
          </div>
        </div>
        <div className="card p-3 border border-teal-200 dark:border-teal-900/50 bg-teal-50/40 dark:bg-teal-950/20 rounded-lg text-center">
          <div className="text-xs text-teal-600 dark:text-teal-400 font-semibold uppercase">Surpluses</div>
          <div className="text-xl font-bold text-teal-700 dark:text-teal-300 mt-0.5">
            {summary.surplusesCount} <span className="text-xs font-normal">(+GH₵ {summary.totalSurplusVal.toFixed(2)})</span>
          </div>
        </div>
        <div className="card p-3 border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 rounded-lg text-center">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase">Net Variance</div>
          <div className={`text-xl font-bold mt-0.5 ${summary.netVarianceVal < 0 ? "text-rose-600" : summary.netVarianceVal > 0 ? "text-emerald-600" : "text-slate-800"}`}>
            GH₵ {summary.netVarianceVal.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Main Workflow Action Toolbar */}
      <div className="card p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <span className="font-bold text-brand">Action:</span>
            {currentStatus === "DRAFT" && "Start counting to capture and lock immutable system inventory baseline."}
            {currentStatus === "COUNTING" && "Enter physical quantities. System tracks interim warehouse movements in real-time."}
            {currentStatus === "UNDER_REVIEW" && "Audit discrepancy analysis. Request recount or approve stock take."}
            {currentStatus === "RECOUNT_REQUIRED" && "Recount in progress. Re-verify physical quantities."}
            {currentStatus === "APPROVED" && "Stock Take approved. Generate atomic inventory adjustment."}
            {isPosted && `Stock Take completed. Inventory adjustment ${stockTake?.adjustment_no || ""} posted to ledger.`}
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-end">
            {currentStatus === "DRAFT" && (
              <button
                onClick={handleStartCount}
                disabled={actionLoading}
                className="btn btn-primary text-xs flex items-center gap-1.5 font-semibold"
              >
                <Play size={14} /> Start Count & Lock Baseline
              </button>
            )}

            {isCountingMode && (
              <>
                <button
                  onClick={handleSaveCount}
                  disabled={actionLoading}
                  className="btn btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Save size={14} /> Save Draft
                </button>
                <button
                  onClick={handleSubmitCount}
                  disabled={actionLoading}
                  className="btn btn-success text-xs flex items-center gap-1.5 font-semibold"
                >
                  <Send size={14} /> Submit Count for Review
                </button>
              </>
            )}

            {isReviewMode && (
              <>
                <button
                  onClick={() => setShowRecountModal(true)}
                  disabled={actionLoading}
                  className="btn btn-outline border-amber-500 text-amber-700 hover:bg-amber-500 hover:text-white text-xs flex items-center gap-1.5 font-semibold"
                >
                  <RotateCcw size={14} /> Request Recount
                </button>
                <button
                  onClick={() => setShowApproveModal(true)}
                  disabled={actionLoading}
                  className="btn btn-success text-xs flex items-center gap-1.5 font-semibold"
                >
                  <CheckCircle2 size={14} /> Approve Stock Take
                </button>
              </>
            )}

            {isApproved && (
              <button
                onClick={() => setShowAdjustModal(true)}
                disabled={actionLoading}
                className="btn btn-success text-xs flex items-center gap-1.5 font-semibold shadow-md"
              >
                <FileSpreadsheet size={14} /> Post Inventory Adjustment
              </button>
            )}

            {isPosted && stockTake?.adjustment_id && (
              <Link
                to={`/inventory/stock-adjustments`}
                className="btn btn-outline border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white text-xs flex items-center gap-1.5 font-semibold"
              >
                <FileSpreadsheet size={14} /> View Adjustment {stockTake.adjustment_no}
              </Link>
            )}

            {!isPosted && currentStatus !== "CANCELLED" && (
              <button
                onClick={handleCancelStockTake}
                disabled={actionLoading}
                className="btn btn-outline border-red-300 text-red-600 hover:bg-red-600 hover:text-white text-xs flex items-center gap-1"
              >
                <XCircle size={13} /> Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Grid Card */}
      <div className="card shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                activeTab === "ALL"
                  ? "bg-brand text-white border-brand shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200"
              }`}
            >
              All Items ({summary.totalLines})
            </button>
            <button
              onClick={() => setActiveTab("VARIANCES")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                activeTab === "VARIANCES"
                  ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                  : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 hover:bg-rose-100"
              }`}
            >
              Discrepancies Only ({summary.discrepanciesCount})
            </button>
            <button
              onClick={() => setActiveTab("MATCHED")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                activeTab === "MATCHED"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              Matched ({summary.matchedCount})
            </button>
            <button
              onClick={() => setActiveTab("LOGS")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                activeTab === "LOGS"
                  ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200"
              }`}
            >
              <History size={12} className="inline mr-1" /> Audit Trail ({auditLogs.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {isCountingMode && (
              <button
                type="button"
                onClick={() => setHideExpected(!hideExpected)}
                className="btn btn-outline btn-sm text-xs flex items-center gap-1.5"
                title="Toggle Expected Quantities for blind counting"
              >
                {hideExpected ? <EyeOff size={14} /> : <Eye size={14} />}
                {hideExpected ? "Blind Count (Hidden)" : "Show Expected Qty"}
              </button>
            )}
            <div className="relative min-w-[220px]">
              <input
                type="text"
                placeholder="Search items in table..."
                className="input input-sm w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ITEMS COUNTING TABLE */}
        {activeTab !== "LOGS" ? (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="table w-full text-left">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10 text-xs uppercase text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Item Code & Name</th>
                  <th className="py-2.5 px-2">UOM</th>
                  <th className="py-2.5 px-3 text-right">System Snapshot</th>
                  <th className="py-2.5 px-3 text-right">Interim Movements</th>
                  <th className="py-2.5 px-3 text-right">Expected Qty</th>
                  <th className="py-2.5 px-3 text-center" style={{ width: "160px" }}>Physical Count</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-3 text-right">Variance Value</th>
                  <th className="py-2.5 px-3" style={{ minWidth: "180px" }}>Reason</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-xs">
                {!filteredDetails.length ? (
                  <tr>
                    <td colSpan="10" className="text-center py-10 text-slate-500">
                      {currentStatus === "DRAFT"
                        ? "Stock Take is in Draft status. Click 'Start Count & Lock Baseline' above to capture snapshot."
                        : "No items match the selected filter."}
                    </td>
                  </tr>
                ) : null}

                {filteredDetails.map((d) => {
                  const pQty = d.physical_qty;
                  const hasCount = pQty !== null && pQty !== "" && pQty !== undefined;
                  const vQty = Number(d.variance_qty || 0);
                  const isShortage = vQty < -0.0001;
                  const isSurplus = vQty > 0.0001;
                  const isMatched = Math.abs(vQty) < 0.0001 && hasCount;

                  return (
                    <tr
                      key={d.id}
                      className={`hover:bg-slate-50/90 dark:hover:bg-slate-800/60 transition-colors ${
                        isShortage
                          ? "bg-rose-50/30 dark:bg-rose-950/10"
                          : isSurplus
                          ? "bg-emerald-50/30 dark:bg-emerald-950/10"
                          : ""
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100">{d.item_code}</div>
                        <div className="text-slate-600 dark:text-slate-400 truncate max-w-[220px]" title={d.item_name}>
                          {d.item_name}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-slate-500">{d.uom_name || d.uom || "PCS"}</td>

                      {/* Snapshot & Expected Qty (Masked if blind count) */}
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                        {hideExpected ? (
                          <span className="text-slate-400 italic">Hidden (Blind)</span>
                        ) : (
                          Number(d.system_qty || 0).toLocaleString()
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {hideExpected ? (
                          <span className="text-slate-400 italic">—</span>
                        ) : Number(d.movement_qty || 0) !== 0 ? (
                          <span className={Number(d.movement_qty) > 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                            {Number(d.movement_qty) > 0 ? `+${Number(d.movement_qty)}` : Number(d.movement_qty)}
                          </span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {hideExpected ? (
                          <span className="text-slate-400 italic">Hidden (Blind)</span>
                        ) : (
                          Number(d.expected_qty || d.system_qty || 0).toLocaleString()
                        )}
                      </td>

                      {/* Physical Count Input */}
                      <td className="py-2.5 px-3 text-center">
                        {isCountingMode ? (
                          <input
                            type="number"
                            step="0.001"
                            placeholder="Enter count"
                            className="input input-sm w-full font-mono text-center font-bold text-sm bg-white dark:bg-slate-900 border-brand/50 focus:border-brand"
                            value={pQty ?? ""}
                            onChange={(e) => handlePhysicalQtyChange(d.id, e.target.value)}
                          />
                        ) : (
                          <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                            {hasCount ? Number(pQty).toLocaleString() : "—"}
                          </span>
                        )}
                      </td>

                      {/* Variance Qty */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {hasCount ? (
                          <span
                            className={
                              isShortage
                                ? "text-rose-600 dark:text-rose-400 font-bold"
                                : isSurplus
                                ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                : "text-slate-600"
                            }
                          >
                            {vQty > 0 ? `+${vQty.toLocaleString()}` : vQty.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Variance Value */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {hasCount && Math.abs(vQty) >= 0.0001 ? (
                          <span>
                            GH₵ {Math.abs(Number(d.variance_value || 0)).toFixed(2)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Reason */}
                      <td className="py-2.5 px-3">
                        {Math.abs(vQty) >= 0.0001 ? (
                          isCountingMode || isReviewMode ? (
                            <select
                              className="input input-sm w-full text-xs"
                              value={d.variance_reason || ""}
                              onChange={(e) => handleVarianceReasonChange(d.id, e.target.value)}
                            >
                              <option value="">Select Reason...</option>
                              {VARIANCE_REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-rose-700 dark:text-rose-300">
                              {d.variance_reason || "Unspecified"}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Status Tag */}
                      <td className="py-2.5 px-3 text-center">
                        {!hasCount ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                            PENDING
                          </span>
                        ) : isMatched ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            MATCHED
                          </span>
                        ) : isShortage ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            SHORTAGE
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                            SURPLUS
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 4: AUDIT TRAIL LOGS */
          <div className="space-y-4 max-w-3xl">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <History size={16} /> Audit Trail & Action History
            </h3>
            <div className="border-l-2 border-brand/40 pl-4 space-y-4">
              {!auditLogs.length && (
                <div className="text-sm text-slate-500">No action logs recorded yet.</div>
              )}
              {auditLogs.map((log) => (
                <div key={log.id} className="relative bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex justify-between items-center font-semibold text-slate-800 dark:text-slate-200">
                    <span className="text-brand font-bold uppercase">{log.action}</span>
                    <span className="text-slate-400 font-mono">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : "-"}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-1">
                    Actor: <strong>{log.actor_username || log.actor_name || "User"}</strong>
                    {log.old_status && log.new_status && (
                      <span className="ml-2">
                        Status change: <code>{log.old_status}</code> → <code>{log.new_status}</code>
                      </span>
                    )}
                  </div>
                  {log.comments && (
                    <div className="mt-1 text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                      "{log.comments}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: REQUEST RECOUNT */}
      {showRecountModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <RotateCcw className="text-amber-600" size={18} /> Request Physical Recount
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              The stock take will transition to <strong>RECOUNT_REQUIRED</strong> status. Existing counts will be saved into history, and re-verification will be requested.
            </p>
            <div>
              <label className="label font-semibold text-xs">Recount Reason *</label>
              <textarea
                className="input w-full h-24 mt-1 text-xs"
                placeholder="Specify reason for recount..."
                value={recountReason}
                onChange={(e) => setRecountReason(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowRecountModal(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestRecount}
                disabled={actionLoading}
                className="btn btn-warning text-xs font-semibold text-white"
              >
                {actionLoading ? "Submitting..." : "Confirm Recount Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APPROVE CONFIRMATION */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="text-teal-600" size={18} /> Supervisor Authorization
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Are you sure you want to approve this stock take? Approving authorizes inventory adjustments to be posted.
            </p>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span>Discrepancy Items:</span>
                <strong>{summary.discrepanciesCount} items</strong>
              </div>
              <div className="flex justify-between">
                <span>Net Discrepancy Value:</span>
                <strong className={summary.netVarianceVal < 0 ? "text-rose-600" : "text-emerald-600"}>
                  GH₵ {summary.netVarianceVal.toFixed(2)}
                </strong>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="btn btn-success text-xs font-semibold"
              >
                {actionLoading ? "Approving..." : "Authorize & Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: POST INVENTORY ADJUSTMENT CONFIRMATION */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="text-emerald-600" size={18} /> Post Inventory Adjustments
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              This action will atomically generate an official <strong>Inventory Adjustment</strong> document and post stock ledger entries for all verified discrepancies.
            </p>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="flex justify-between font-medium">
                <span>Warehouse:</span>
                <strong>{stockTake?.warehouse_name || "All"}</strong>
              </div>
              <div className="flex justify-between font-medium">
                <span>Discrepant Items:</span>
                <strong className="text-rose-600">{summary.discrepanciesCount} items</strong>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total Shortage Value:</span>
                <span className="text-rose-600">-GH₵ {summary.totalShortageVal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total Surplus Value:</span>
                <span className="text-emerald-600">+GH₵ {summary.totalSurplusVal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t border-slate-200 dark:border-slate-700 text-sm">
                <span>Net Adjustment Impact:</span>
                <span className={summary.netVarianceVal < 0 ? "text-rose-600" : "text-emerald-600"}>
                  GH₵ {summary.netVarianceVal.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePostAdjustment}
                disabled={actionLoading}
                className="btn btn-success text-xs font-semibold"
              >
                {actionLoading ? "Posting..." : "Confirm & Post Adjustments"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
