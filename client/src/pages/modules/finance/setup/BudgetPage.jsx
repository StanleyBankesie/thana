/**
 * @fileoverview BudgetPage component.
 * Enterprise Financial Budget Management with multi-dimensional allocations,
 * formal approval workflows, controlled revisions/amendments, and historical audit trail.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import {
  DollarSign,
  ArrowLeft,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  BarChart2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
  Send,
  History,
  Layers,
  Briefcase,
  Building,
  Check,
  X,
  Lock,
} from "lucide-react";

const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function BudgetPage() {
  const [budgets, setBudgets] = useState([]);
  const [fiscalYears, setFiscalYears] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterFy, setFilterFy] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  // Create / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Rejection Reason Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Revision / Amendment Modal
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [revisingBudget, setRevisingBudget] = useState(null);
  const [revisionReason, setRevisionReason] = useState("");

  // Revision History Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyBudget, setHistoryBudget] = useState(null);

  const [formData, setFormData] = useState({
    fiscal_year_id: "",
    budget_code: "",
    budget_name: "",
    budget_type: "OPEX",
    cost_center_id: "",
    department_id: "",
    project_id: "",
    currency_id: "",
    start_date: "",
    end_date: "",
    description: "",
    notes: "",
    lines: [],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [budgetsRes, fyRes, ccRes, deptRes, projRes, accRes] = await Promise.allSettled([
        api.get("/finance/budgets", {
          params: {
            fiscal_year_id: filterFy || undefined,
            status: filterStatus || undefined,
            budget_type: filterType || undefined,
          },
        }),
        api.get("/finance/fiscal-years"),
        api.get("/finance/cost-centers"),
        api.get("/admin/departments"),
        api.get("/projects"),
        api.get("/finance/chart-of-accounts"),
      ]);

      if (budgetsRes.status === "fulfilled") {
        setBudgets(budgetsRes.value.data?.data || []);
      }
      if (fyRes.status === "fulfilled") {
        setFiscalYears(fyRes.value.data?.items || []);
      }
      if (ccRes.status === "fulfilled") {
        setCostCenters(ccRes.value.data?.items || []);
      }
      if (deptRes.status === "fulfilled") {
        setDepartments(deptRes.value.data?.data || deptRes.value.data?.items || []);
      }
      if (projRes.status === "fulfilled") {
        setProjects(projRes.value.data?.projects || projRes.value.data?.data || []);
      }
      if (accRes.status === "fulfilled") {
        setAccounts(accRes.value.data?.items || []);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load budget data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterFy, filterStatus, filterType]);

  const handleOpenCreate = () => {
    setEditingId(null);
    const openFy = fiscalYears.find((fy) => fy.is_open) || fiscalYears[0];
    setFormData({
      fiscal_year_id: openFy?.id || "",
      budget_code: `BUD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      budget_name: "",
      budget_type: "OPEX",
      cost_center_id: "",
      department_id: "",
      project_id: "",
      currency_id: "",
      start_date: openFy?.start_date?.substring(0, 10) || "",
      end_date: openFy?.end_date?.substring(0, 10) || "",
      description: "",
      notes: "",
      lines: [
        {
          account_id: "",
          cost_center_id: "",
          project_id: "",
          department_id: "",
          period_month: "",
          planned_quantity: 1,
          unit_cost: 0,
          budget_amount: 0,
          notes: "",
        },
      ],
    });
    setShowModal(true);
  };

  const handleOpenEdit = async (budget) => {
    try {
      setLoading(true);
      const res = await api.get(`/finance/budgets/${budget.id}`);
      const b = res.data?.data;
      setEditingId(budget.id);
      setFormData({
        fiscal_year_id: b.fiscal_year_id || "",
        budget_code: b.budget_code || "",
        budget_name: b.budget_name || "",
        budget_type: b.budget_type || "OPEX",
        cost_center_id: b.cost_center_id || "",
        department_id: b.department_id || "",
        project_id: b.project_id || "",
        currency_id: b.currency_id || "",
        start_date: b.start_date ? String(b.start_date).substring(0, 10) : "",
        end_date: b.end_date ? String(b.end_date).substring(0, 10) : "",
        description: b.description || "",
        notes: b.notes || "",
        lines: (b.lines || []).map((l) => ({
          account_id: l.account_id,
          cost_center_id: l.cost_center_id || "",
          project_id: l.project_id || "",
          department_id: l.department_id || "",
          period_month: l.period_month || "",
          planned_quantity: Number(l.planned_quantity) || 1,
          unit_cost: Number(l.unit_cost) || 0,
          budget_amount: Number(l.budget_amount) || 0,
          notes: l.notes || "",
        })),
      });
      setShowModal(true);
    } catch (err) {
      toast.error("Failed to fetch budget details");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApproval = async (id) => {
    if (!window.confirm("Submit this budget for official approval?")) return;
    try {
      await api.post(`/finance/budgets/${id}/submit`);
      toast.success("Budget submitted for approval");
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to submit budget");
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm("Approve this budget and lock it as the official financial baseline?")) return;
    try {
      await api.post(`/finance/budgets/${id}/approve`);
      toast.success("Budget approved successfully and locked as baseline.");
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to approve budget");
    }
  };

  const handleOpenReject = (id) => {
    setRejectingId(id);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please enter a rejection reason");
      return;
    }
    try {
      await api.post(`/finance/budgets/${rejectingId}/reject`, { reason: rejectionReason });
      toast.success("Budget rejected with reason recorded");
      setShowRejectModal(false);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to reject budget");
    }
  };

  const handleOpenRevise = async (budget) => {
    try {
      setLoading(true);
      const res = await api.get(`/finance/budgets/${budget.id}`);
      setRevisingBudget(res.data?.data);
      setRevisionReason("");
      setShowReviseModal(true);
    } catch (err) {
      toast.error("Failed to load budget details for revision");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRevision = async () => {
    if (!revisionReason.trim()) {
      toast.error("Please provide a reason/justification for this revision");
      return;
    }
    try {
      await api.post(`/finance/budgets/${revisingBudget.id}/revise`, {
        reason: revisionReason,
        lines: revisingBudget.lines,
      });
      toast.success("Budget revised successfully. New revision created and baseline preserved.");
      setShowReviseModal(false);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to revise budget");
    }
  };

  const handleViewHistory = async (budget) => {
    try {
      setLoading(true);
      const res = await api.get(`/finance/budgets/${budget.id}`);
      setHistoryBudget(res.data?.data);
      setShowHistoryModal(true);
    } catch (err) {
      toast.error("Failed to fetch revision history");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this draft budget?")) return;
    try {
      await api.delete(`/finance/budgets/${id}`);
      toast.success("Budget deleted successfully");
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to delete budget");
    }
  };

  const handleAddLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          account_id: "",
          cost_center_id: prev.cost_center_id || "",
          project_id: prev.project_id || "",
          department_id: prev.department_id || "",
          period_month: "",
          planned_quantity: 1,
          unit_cost: 0,
          budget_amount: 0,
          notes: "",
        },
      ],
    }));
  };

  const handleRemoveLine = (idx) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== idx),
    }));
  };

  const handleLineChange = (idx, field, val) => {
    setFormData((prev) => {
      const nextLines = [...prev.lines];
      const updatedLine = { ...nextLines[idx], [field]: val };
      if (field === "planned_quantity" || field === "unit_cost") {
        const qty = field === "planned_quantity" ? Number(val) || 0 : Number(updatedLine.planned_quantity) || 0;
        const uc = field === "unit_cost" ? Number(val) || 0 : Number(updatedLine.unit_cost) || 0;
        if (qty > 0 && uc > 0) {
          updatedLine.budget_amount = Math.round(qty * uc * 100) / 100;
        }
      }
      nextLines[idx] = updatedLine;
      return { ...prev, lines: nextLines };
    });
  };

  const totalCalculated = (formData.lines || []).reduce(
    (acc, l) => acc + (Number(l.budget_amount) || 0),
    0
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fiscal_year_id) {
      toast.error("Please select a Fiscal Year");
      return;
    }
    if (!formData.budget_name.trim()) {
      toast.error("Please provide a Budget Name");
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await api.put(`/finance/budgets/${editingId}`, formData);
        toast.success("Budget updated successfully");
      } else {
        await api.post("/finance/budgets", formData);
        toast.success("Draft budget created successfully");
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Error saving budget");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/finance" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-7 h-7 text-emerald-600" /> Budget Management
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create, allocate, approve, and revise corporate, project, and departmental financial budgets with version control.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/finance/budget-dashboard"
            className="btn btn-outline border-indigo-600 text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
          >
            <BarChart2 className="w-4 h-4" /> Executive Dashboard
          </Link>
          <Link
            to="/finance/reports/budget-vs-actual"
            className="btn btn-outline border-blue-600 text-blue-600 hover:bg-blue-50 flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" /> Variance Report
          </Link>
          <button
            onClick={loadData}
            className="btn btn-outline text-gray-700 dark:text-gray-300 flex items-center gap-2"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-none text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Budget
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase">Fiscal Year:</label>
          <select
            value={filterFy}
            onChange={(e) => setFilterFy(e.target.value)}
            className="select select-bordered select-sm w-44 font-medium"
          >
            <option value="">All Fiscal Years</option>
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.code} {fy.is_open ? "(Open)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase">Type:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="select select-bordered select-sm w-40 font-medium"
          >
            <option value="">All Types</option>
            <option value="OPEX">Operating (OPEX)</option>
            <option value="CAPEX">Capital (CAPEX)</option>
            <option value="PROJECT">Project Budget</option>
            <option value="DEPARTMENTAL">Departmental</option>
            <option value="REVENUE">Revenue Target</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase">Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="select select-bordered select-sm w-44 font-medium"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved (Baseline)</option>
            <option value="REJECTED">Rejected</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Budgets Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 text-xs uppercase">
              <tr>
                <th>Code & Version</th>
                <th>Budget Name</th>
                <th>Type</th>
                <th>Fiscal Year</th>
                <th>Dimension Scope</th>
                <th className="text-right">Total Budget</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading budgets...
                  </td>
                </tr>
              ) : budgets.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-gray-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    No budgets configured yet. Click "Create Budget" to start budgeting.
                  </td>
                </tr>
              ) : (
                budgets.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td>
                      <div className="font-mono font-medium text-blue-600 dark:text-blue-400">
                        {b.budget_code}
                      </div>
                      <span className="text-[11px] text-gray-400">
                        v{b.version || "1.0"} (Rev #{b.revision_no || 0})
                      </span>
                    </td>
                    <td>
                      <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {b.budget_name}
                      </div>
                      {b.description && (
                        <div className="text-xs text-gray-400 truncate max-w-xs">{b.description}</div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-sm badge-ghost font-semibold">
                        {b.budget_type || "OPEX"}
                      </span>
                    </td>
                    <td>{b.fiscal_year_code || `FY #${b.fiscal_year_id}`}</td>
                    <td className="text-xs">
                      {b.project_name ? (
                        <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                          <Briefcase className="w-3.5 h-3.5" /> {b.project_name}
                        </span>
                      ) : b.department_name ? (
                        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                          <Building className="w-3.5 h-3.5" /> {b.department_name}
                        </span>
                      ) : b.cost_center_name ? (
                        <span>{b.cost_center_name}</span>
                      ) : (
                        <span className="text-gray-400 italic">Corporate Global</span>
                      )}
                    </td>
                    <td className="text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                      GH₵{fmt(b.calculated_total || b.total_budget)}
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge badge-sm font-semibold ${
                          b.status === "APPROVED" || b.status === "ACTIVE"
                            ? "badge-success text-white"
                            : b.status === "PENDING_APPROVAL"
                            ? "badge-warning"
                            : b.status === "REJECTED"
                            ? "badge-error text-white"
                            : "badge-ghost"
                        }`}
                      >
                        {b.status}
                      </span>
                      {b.rejection_reason && (
                        <div className="text-[10px] text-red-500 truncate max-w-xs">
                          {b.rejection_reason}
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Submit for Approval (Draft/Rejected) */}
                        {(b.status === "DRAFT" || b.status === "REJECTED") && (
                          <button
                            onClick={() => handleSubmitApproval(b.id)}
                            className="btn btn-xs btn-outline border-blue-600 text-blue-600 hover:bg-blue-50"
                            title="Submit for Approval"
                          >
                            <Send className="w-3.5 h-3.5" /> Submit
                          </button>
                        )}

                        {/* Approve & Reject (Pending Approval) */}
                        {b.status === "PENDING_APPROVAL" && (
                          <>
                            <button
                              onClick={() => handleApprove(b.id)}
                              className="btn btn-xs btn-success text-white"
                              title="Approve Budget"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenReject(b.id)}
                              className="btn btn-xs btn-error text-white"
                              title="Reject Budget"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {/* Create Revision (Approved) */}
                        {(b.status === "APPROVED" || b.status === "ACTIVE") && (
                          <button
                            onClick={() => handleOpenRevise(b)}
                            className="btn btn-xs btn-outline border-purple-600 text-purple-600 hover:bg-purple-50"
                            title="Create Revision / Amendment"
                          >
                            Revise
                          </button>
                        )}

                        {/* View Revision History */}
                        <button
                          onClick={() => handleViewHistory(b)}
                          className="btn btn-xs btn-ghost text-gray-500"
                          title="Revision History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>

                        {/* Variance Report Link */}
                        <Link
                          to={`/finance/reports/budget-vs-actual?fiscal_year_id=${b.fiscal_year_id}&budget_id=${b.id}`}
                          className="btn btn-xs btn-ghost text-blue-600"
                          title="View Variance Report"
                        >
                          <BarChart2 className="w-3.5 h-3.5" />
                        </Link>

                        {/* Edit (Draft only) */}
                        {b.status === "DRAFT" && (
                          <button
                            onClick={() => handleOpenEdit(b)}
                            className="btn btn-xs btn-ghost text-gray-600"
                            title="Edit Draft"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete (Draft or Rejected only) */}
                        {(b.status === "DRAFT" || b.status === "REJECTED") && (
                          <button
                            onClick={() => handleDelete(b.id)}
                            className="btn btn-xs btn-ghost text-red-600 hover:bg-red-50"
                            title="Delete Draft"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Budget Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-600" />
                {editingId ? "Edit Draft Budget" : "Create Financial Budget"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-sm btn-circle btn-ghost text-gray-500"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-5">
              {/* Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Fiscal Year *</label>
                  <select
                    value={formData.fiscal_year_id}
                    onChange={(e) => setFormData({ ...formData, fiscal_year_id: e.target.value })}
                    className="select select-bordered select-sm w-full mt-1"
                    required
                  >
                    <option value="">Select Fiscal Year</option>
                    {fiscalYears.map((fy) => (
                      <option key={fy.id} value={fy.id}>
                        {fy.code} ({fy.start_date?.substring(0, 10)} to {fy.end_date?.substring(0, 10)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Budget Code</label>
                  <input
                    type="text"
                    value={formData.budget_code}
                    onChange={(e) => setFormData({ ...formData, budget_code: e.target.value })}
                    className="input input-bordered input-sm w-full mt-1 font-mono"
                    placeholder="e.g. BUD-2026-001"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Budget Name *</label>
                  <input
                    type="text"
                    value={formData.budget_name}
                    onChange={(e) => setFormData({ ...formData, budget_name: e.target.value })}
                    className="input input-bordered input-sm w-full mt-1"
                    placeholder="e.g. FY2026 Operations Budget"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Budget Type</label>
                  <select
                    value={formData.budget_type}
                    onChange={(e) => setFormData({ ...formData, budget_type: e.target.value })}
                    className="select select-bordered select-sm w-full mt-1"
                  >
                    <option value="OPEX">Operating Expense (OPEX)</option>
                    <option value="CAPEX">Capital Expenditure (CAPEX)</option>
                    <option value="PROJECT">Project Specific Budget</option>
                    <option value="DEPARTMENTAL">Departmental Budget</option>
                    <option value="REVENUE">Revenue Target</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Project Dimension (Optional)</label>
                  <select
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                    className="select select-bordered select-sm w-full mt-1"
                  >
                    <option value="">None / Corporate</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_code} - {p.project_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Cost Center</label>
                  <select
                    value={formData.cost_center_id}
                    onChange={(e) => setFormData({ ...formData, cost_center_id: e.target.value })}
                    className="select select-bordered select-sm w-full mt-1"
                  >
                    <option value="">All / Entire Company</option>
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.code} - {cc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Line Items */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Account Allocations ({formData.lines.length})
                  </h4>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-gray-500">
                      Total Allocated: <strong className="text-emerald-700 dark:text-emerald-400 font-mono text-sm">GH₵{fmt(totalCalculated)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="btn btn-xs btn-outline border-emerald-600 text-emerald-600 hover:bg-emerald-50 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Account Line
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-64 border rounded-lg border-gray-200 dark:border-gray-700">
                  <table className="table table-compact w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="w-1/3">GL Account *</th>
                        <th className="w-20">Period</th>
                        <th className="w-20 text-right">Planned Qty</th>
                        <th className="w-24 text-right">Unit Cost</th>
                        <th className="w-28 text-right">Budget Amount *</th>
                        <th>Notes</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {formData.lines.map((line, idx) => (
                        <tr key={idx}>
                          <td>
                            <select
                              value={line.account_id}
                              onChange={(e) => handleLineChange(idx, "account_id", e.target.value)}
                              className="select select-bordered select-xs w-full"
                              required
                            >
                              <option value="">Select Account</option>
                              {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} - {acc.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={line.period_month}
                              onChange={(e) => handleLineChange(idx, "period_month", e.target.value)}
                              className="select select-bordered select-xs w-full"
                            >
                              <option value="">Full Year</option>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                <option key={m} value={m}>M{m}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="1"
                              value={line.planned_quantity}
                              onChange={(e) => handleLineChange(idx, "planned_quantity", e.target.value)}
                              className="input input-bordered input-xs w-full text-right"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={line.unit_cost}
                              onChange={(e) => handleLineChange(idx, "unit_cost", e.target.value)}
                              className="input input-bordered input-xs w-full text-right"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={line.budget_amount}
                              onChange={(e) => handleLineChange(idx, "budget_amount", e.target.value)}
                              className="input input-bordered input-xs w-full text-right font-mono font-medium"
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={line.notes}
                              onChange={(e) => handleLineChange(idx, "notes", e.target.value)}
                              className="input input-bordered input-xs w-full"
                              placeholder="Remarks"
                            />
                          </td>
                          <td className="text-center">
                            {formData.lines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Total Budget: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">GH₵{fmt(totalCalculated)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn btn-sm btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-sm btn-primary bg-emerald-600 hover:bg-emerald-700 border-none text-white"
                  >
                    {saving ? "Saving..." : editingId ? "Update Draft" : "Save Draft"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" /> Reject Budget Submission
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Please enter the official reason for rejecting this budget submission. The creator will be notified to revise it.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="textarea textarea-bordered w-full h-24 mb-4 text-sm"
              placeholder="e.g. Travel and accommodation allocation exceeds quarterly company limits..."
              required
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="btn btn-sm btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="btn btn-sm btn-error text-white"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {showReviseModal && revisingBudget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-600" /> Create Budget Revision / Amendment
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Controlled budget amendment for <strong>{revisingBudget.budget_name}</strong>. A snapshot of baseline v{revisingBudget.version} will be preserved in the audit log.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                  Revision Justification *
                </label>
                <textarea
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  className="textarea textarea-bordered w-full h-20 text-sm"
                  placeholder="e.g. Scope variation approval #VO-04 requiring increased materials budget..."
                  required
                />
              </div>

              <div className="overflow-x-auto max-h-52 border rounded-lg p-2">
                <table className="table table-compact w-full text-xs">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th className="text-right">Current Amount</th>
                      <th className="text-right">New Revised Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(revisingBudget.lines || []).map((l, idx) => (
                      <tr key={idx}>
                        <td>{l.account_code} - {l.account_name}</td>
                        <td className="text-right font-mono text-gray-500">GH₵{fmt(l.budget_amount)}</td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            value={l.budget_amount}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              const updated = [...revisingBudget.lines];
                              updated[idx].budget_amount = val;
                              setRevisingBudget({ ...revisingBudget, lines: updated });
                            }}
                            className="input input-bordered input-xs w-full text-right font-mono"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowReviseModal(false)}
                className="btn btn-sm btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevision}
                className="btn btn-sm btn-primary bg-purple-600 hover:bg-purple-700 border-none text-white"
              >
                Authorize Revision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revision History Modal */}
      {showHistoryModal && historyBudget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" /> Revision History: {historyBudget.budget_name}
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="btn btn-sm btn-circle btn-ghost"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {(!historyBudget.revisions || historyBudget.revisions.length === 0) ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No revisions on record. Budget is at original baseline.
                </div>
              ) : (
                historyBudget.revisions.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 space-y-1"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-indigo-600">Revision #{rev.revision_no}</span>
                      <span className="text-gray-400">
                        {rev.revision_date ? new Date(rev.revision_date).toLocaleString() : ""}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      Reason: <span className="font-normal">{rev.reason || "N/A"}</span>
                    </p>
                    <div className="flex gap-4 text-xs font-mono pt-1 text-gray-500">
                      <span>Previous: GH₵{fmt(rev.previous_total)}</span>
                      <span>&rarr;</span>
                      <span className="font-bold text-emerald-600">New Total: GH₵{fmt(rev.new_total)}</span>
                    </div>
                    {rev.revised_by_name && (
                      <p className="text-[11px] text-gray-400">Authorized by: {rev.revised_by_name}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="btn btn-sm btn-ghost"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
