/**
 * @file ClientValuationList.jsx
 * @description Client Valuations workspace for measuring, verifying, and calculating
 * the value of physical work completed against approved BOQ, variations, and site materials.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileCheck2,
  Plus,
  ArrowLeft,
  Calendar,
  CheckCircle,
  X,
  Search,
  RefreshCw,
  Building,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  TrendingUp,
  Percent,
  Calculator,
  ShieldCheck,
  Send,
  Eye,
  FileText,
  Paperclip,
  Check,
  DollarSign
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import ProjectModal from "../components/ProjectModal.jsx";

export default function ClientValuationList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [activeProject, setActiveProject] = useState(null);
  const [valuations, setValuations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const { canReverseApproval } = usePermission();
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedValuation, setSelectedValuation] = useState(null);
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [submittingForward, setSubmittingForward] = useState(false);
  const [forwardedTo, setForwardedTo] = useState({});

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("CREATE"); // CREATE | EDIT | VIEW
  const [activeTab, setActiveTab] = useState("boq_items"); // boq_items | variations | materials | deductions | attachments
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    id: null,
    project_id: "",
    valuation_no: "",
    contract_ref: "",
    client_name: "",
    contractor_name: "",
    valuation_date: new Date().toISOString().split("T")[0],
    period_from: "",
    period_to: "",
    valuation_type: "INTERIM",
    boq_id: null,
    boq_title: "",
    previous_valuation_id: null,
    previous_valuation_no: "",
    prepared_by_name: "",
    status: "DRAFT",
    remarks: "",
    retention_percent: 5,
    advance_recovery_percent: 10,
    other_deductions: 0,
    materials_on_site_value: 0,
    dayworks_value: 0,
    other_additions_value: 0,
    approved_variations_total: 0,
    items: [],
    materials: [],
    attachments: [],
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
        if (prjs.length > 0) {
          setSelectedProjectId(String(prjs[0].id));
          setActiveProject(prjs[0]);
        } else {
          setLoading(false);
        }
      } catch (e) {
        toast.error("Failed to load projects");
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const prj = projects.find((p) => String(p.id) === String(selectedProjectId));
    setActiveProject(prj || null);
    fetchValuations();
  }, [selectedProjectId]);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkflowFlags() {
      try {
        const res = await api.get("/workflows");
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        if (cancelled) return;
        setWorkflowsCache(list);
        const route = "/project-management/client-valuations";
        const normalize = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
        const chosen = list.find((w) => Number(w.is_active) === 1 && String(w.document_route) === route) ||
          list.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "CLIENT_VALUATION") ||
          null;
        setCandidateWorkflow(chosen || null);
      } catch {}
    }
    loadWorkflowFlags();
    return () => { cancelled = true; };
  }, []);

  const openForwardModal = async (val) => {
    setSelectedValuation(val);
    setShowForwardModal(true);
    setWfError("");
    try {
      setWfLoading(true);
      let list = workflowsCache;
      if (!list) {
        const res = await api.get("/workflows");
        list = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(list);
      }
      const route = "/project-management/client-valuations";
      const normalize = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
      const chosen = list.find((w) => Number(w.is_active) === 1 && String(w.document_route) === route) ||
        list.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "CLIENT_VALUATION") ||
        null;
      setCandidateWorkflow(chosen || null);
      if (chosen) {
        const dRes = await api.get(`/workflows/${chosen.id}`);
        const steps = Array.isArray(dRes.data?.item?.steps) ? dRes.data.item.steps : [];
        setWorkflowSteps(steps);
        const first = steps[0] || null;
        setFirstApprover(first ? {
          userId: first.approver_user_id,
          name: first.approver_name,
          stepName: first.step_name,
          stepOrder: first.step_order,
          approvalLimit: first.approval_limit,
        } : null);
        const defaultTarget = (Array.isArray(first?.approvers) && first.approvers.length ? first.approvers[0].id : first?.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setWorkflowSteps([]);
        setFirstApprover(null);
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  async function forwardDocument() {
    if (!selectedValuation) return;
    setSubmittingForward(true);
    setWfError("");
    try {
      let approverName = "Approver";
      if (firstApprover) {
        const first = workflowSteps[0];
        const opts = first?.approvers?.length ? first.approvers : (first?.approver_user_id ? [{ id: first.approver_user_id, username: first.approver_name }] : []);
        const match = opts.find((u) => Number(u.id) === Number(targetApproverId));
        if (match) approverName = match.username || match.name || approverName;
      }

      setValuations((prev) =>
        prev.map((x) =>
          x.id === selectedValuation.id
            ? { ...x, status: "PENDING_APPROVAL", forwarded_to_username: approverName }
            : x
        )
      );
      setForwardedTo((prev) => ({ ...prev, [selectedValuation.id]: approverName }));
      setShowForwardModal(false);

      const amt = Number(selectedValuation.current_assessed_amount ?? selectedValuation.net_amount_due ?? 0);

      await api.post(`/construction/client-valuations/${selectedValuation.id}/status`, {
        status: "PENDING_APPROVAL",
        forwarded_to_username: approverName,
        remarks: "Forwarded for approval",
      });

      try {
        await api.post("/workflows/start", {
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          document_id: selectedValuation.id,
          document_type: "CLIENT_VALUATION",
          target_user_id: targetApproverId || null,
          amount: amt,
        });
      } catch (wfErr) {
        console.warn("Workflow start warning:", wfErr);
      }

      toast.success("Client valuation forwarded for approval");
      fetchValuations();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to forward valuation");
    } finally {
      setSubmittingForward(false);
    }
  }

  async function reverseValuation(valId) {
    try {
      try {
        await api.post("/workflows/reverse-by-document", {
          document_type: "CLIENT_VALUATION",
          document_id: valId,
          desired_status: "DRAFT",
        });
      } catch (wfErr) {
        await api.post(`/construction/client-valuations/${valId}/status`, {
          status: "DRAFT",
          forwarded_to_username: null,
          remarks: "Valuation approval reversed",
        });
      }

      setValuations((prev) =>
        prev.map((x) =>
          x.id === valId
            ? { ...x, status: "DRAFT", forwarded_to_username: null }
            : x
        )
      );
      setForwardedTo((prev) => {
        const next = { ...prev };
        delete next[valId];
        return next;
      });
      toast.success("Client valuation reversed to draft");
      fetchValuations();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to reverse valuation");
    }
  }
  const fetchValuations = async () => {
    setLoading(true);
    try {
      const res = await api.get("/construction/client-valuations", {
        params: selectedProjectId ? { project_id: selectedProjectId } : {},
      });
      const items = res.data?.items || [];
      const fwd = {};
      items.forEach((it) => {
        if (it.forwarded_to_username) fwd[it.id] = it.forwarded_to_username;
      });
      setForwardedTo(fwd);
      setValuations(items);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to load client valuations");
    } finally {
      setLoading(false);
    }
  };

  const openNewValuationModal = async () => {
    const targetProjId = selectedProjectId || (projects[0]?.id ? String(projects[0].id) : "");
    if (!targetProjId) {
      toast.warning("Please select a project first");
      return;
    }
    const curProj = projects.find((p) => String(p.id) === String(targetProjId)) || activeProject;

    try {
      // Fetch baseline from server
      const bRes = await api.get(`/construction/client-valuations/baseline/${targetProjId}`);
      const base = bRes.data || {};

      const baselineItems = (base.items || []).map((it) => ({
        ...it,
        current_period_qty: 0,
        cumulative_qty: Number(it.prev_cumulative_qty || 0),
        percentage_complete:
          Number(it.contract_qty) > 0
            ? Number(((Number(it.prev_cumulative_qty || 0) / Number(it.contract_qty)) * 100).toFixed(2))
            : 0,
        cumulative_value: Number((Number(it.prev_cumulative_qty || 0) * Number(it.contract_rate || 0)).toFixed(2)),
        current_period_value: 0,
        assessed_value: 0,
        remarks: "",
      }));

      setFormData({
        id: null,
        project_id: targetProjId,
        valuation_no: base.next_valuation_no || `VAL-${curProj?.project_code || "PRJ"}-01`,
        contract_ref: base.contract_ref || curProj?.contract_ref_no || "CTR-001",
        client_name: base.client_name || curProj?.client_name || "Client",
        contractor_name: base.contractor_name || "",
        valuation_date: new Date().toISOString().split("T")[0],
        period_from: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
        period_to: new Date().toISOString().split("T")[0],
        valuation_type: "INTERIM",
        boq_id: base.boq?.id || null,
        boq_title: base.boq?.title || "Project BOQ",
        previous_valuation_id: base.previousValuation?.id || null,
        previous_valuation_no: base.previousValuation?.valuation_no || "None (Initial Valuation)",
        prepared_by_name: "Project QS",
        status: "DRAFT",
        remarks: "",
        retention_percent: Number(base.retention_percent ?? curProj?.retention_percent ?? 5),
        advance_recovery_percent: Number(base.advance_recovery_percent ?? curProj?.advance_recovery_percent ?? 10),
        other_deductions: 0,
        materials_on_site_value: 0,
        dayworks_value: 0,
        other_additions_value: 0,
        approved_variations_total: (base.approvedVariations || []).reduce(
          (acc, v) => acc + Number(v.net_amount || 0),
          0
        ),
        items: baselineItems,
        materials: [],
        attachments: [],
      });

      setModalMode("CREATE");
      setActiveTab("boq_items");
      setShowModal(true);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to initialize valuation baseline");
    }
  };

  const openViewOrEditModal = async (valId, mode = "VIEW") => {
    try {
      const res = await api.get(`/construction/client-valuations/${valId}`);
      const v = res.data?.item || {};
      const lines = res.data?.lines || [];

      setFormData({
        id: v.id,
        project_id: String(v.project_id),
        valuation_no: v.valuation_no || v.application_no,
        contract_ref: v.contract_ref || "",
        client_name: v.client_name || "",
        contractor_name: v.contractor_name || "",
        valuation_date: v.valuation_date ? String(v.valuation_date).split("T")[0] : "",
        period_from: v.period_from ? String(v.period_from).split("T")[0] : "",
        period_to: v.period_to ? String(v.period_to).split("T")[0] : "",
        valuation_type: v.valuation_type || "INTERIM",
        boq_id: v.boq_id || null,
        boq_title: v.boq_title || "Project BOQ",
        previous_valuation_id: v.previous_valuation_id || null,
        previous_valuation_no: v.previous_valuation_no || "None",
        prepared_by_name: v.prepared_by_name || "",
        status: v.status || "DRAFT",
        remarks: v.remarks || "",
        retention_percent: Number(v.retention_percent ?? 5),
        advance_recovery_percent: Number(v.advance_recovery_percent ?? 10),
        other_deductions: Number(v.other_deductions || 0),
        materials_on_site_value: Number(v.materials_on_site_value || 0),
        dayworks_value: Number(v.dayworks_value || 0),
        other_additions_value: Number(v.other_additions_value || 0),
        approved_variations_total: Number(v.approved_variations_total || 0),
        items: lines.map((l) => ({
          ...l,
          contract_qty: Number(l.contract_qty || l.boq_qty || 0),
          contract_rate: Number(l.contract_rate || l.unit_rate || 0),
          prev_cumulative_qty: Number(l.prev_cumulative_qty || 0),
          current_period_qty: Number(l.current_period_qty || 0),
          cumulative_qty: Number(l.cumulative_qty || 0),
          percentage_complete: Number(l.percentage_complete || 0),
          cumulative_value: Number(l.cumulative_value || 0),
          prev_certified_value: Number(l.prev_certified_value || 0),
          current_period_value: Number(l.current_period_value || 0),
          assessed_value: Number(l.assessed_value || 0),
        })),
        materials: [],
        attachments: [],
      });

      setModalMode(mode);
      setActiveTab("boq_items");
      setShowModal(true);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to load valuation details");
    }
  };

  // Calculations for line items
  const handleItemQtyChange = (index, newQty) => {
    const qty = Math.max(0, Number(newQty) || 0);
    const updated = [...formData.items];
    const it = { ...updated[index] };

    it.current_period_qty = qty;
    it.cumulative_qty = Number((Number(it.prev_cumulative_qty || 0) + qty).toFixed(4));
    it.percentage_complete =
      Number(it.contract_qty) > 0
        ? Number(((it.cumulative_qty / Number(it.contract_qty)) * 100).toFixed(2))
        : 100;
    it.cumulative_value = Number((it.cumulative_qty * Number(it.contract_rate || 0)).toFixed(2));
    it.current_period_value = Number((qty * Number(it.contract_rate || 0)).toFixed(2));
    // Default assessed value to current period value unless manually entered
    it.assessed_value = it.current_period_value;

    updated[index] = it;
    setFormData({ ...formData, items: updated });
  };

  const handleItemAssessedValueChange = (index, val) => {
    const assessed = Math.max(0, Number(val) || 0);
    const updated = [...formData.items];
    updated[index] = { ...updated[index], assessed_value: assessed };
    setFormData({ ...formData, items: updated });
  };

  const handleItemRemarksChange = (index, val) => {
    const updated = [...formData.items];
    updated[index] = { ...updated[index], remarks: val };
    setFormData({ ...formData, items: updated });
  };

  const handleAddNonBoqItem = () => {
    const newItem = {
      boq_item_id: null,
      item_code: `VAR-${formData.items.length + 1}`,
      description: "Non-BOQ / Variation Extra Work",
      uom: "ITEM",
      contract_qty: 1,
      contract_rate: 0,
      contract_amount: 0,
      prev_cumulative_qty: 0,
      current_period_qty: 1,
      cumulative_qty: 1,
      percentage_complete: 100,
      cumulative_value: 0,
      prev_certified_value: 0,
      current_period_value: 0,
      assessed_value: 0,
      remarks: "Extra work approved by client instruction",
      is_variation: 1,
    };
    setFormData({ ...formData, items: [...formData.items, newItem] });
  };

  // Summary Totals Calculation
  const totalBoqWorkCompleted = formData.items.reduce((acc, it) => acc + Number(it.assessed_value || 0), 0);
  const totalVariations = Number(formData.approved_variations_total || 0);
  const totalMaterialsOnSite = Number(formData.materials_on_site_value || 0);
  const totalDayworks = Number(formData.dayworks_value || 0) + Number(formData.other_additions_value || 0);

  const grossValuationAmount = totalBoqWorkCompleted + totalVariations + totalMaterialsOnSite + totalDayworks;

  const retentionPercent = Number(formData.retention_percent || 0);
  const retentionDeducted = Number(((grossValuationAmount * retentionPercent) / 100).toFixed(2));

  const advanceRecoveryPercent = Number(formData.advance_recovery_percent || 0);
  const advanceRecovered = Number(((grossValuationAmount * advanceRecoveryPercent) / 100).toFixed(2));

  const otherDeductions = Number(formData.other_deductions || 0);

  const previousCertifiedTotal = formData.items.reduce(
    (acc, it) => acc + Number(it.prev_certified_value || 0),
    0
  );

  const netAssessedValue = Math.max(
    0,
    grossValuationAmount - retentionDeducted - advanceRecovered - otherDeductions
  );

  // Submit Valuation Handler
  const handleSaveValuation = async (targetStatus = formData.status) => {
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        status: targetStatus,
        gross_claimed: grossValuationAmount,
        gross_certified: grossValuationAmount,
        gross_assessed_value: grossValuationAmount,
        current_certified: totalBoqWorkCompleted,
        current_assessed_amount: netAssessedValue,
        net_amount_due: netAssessedValue,
        retention_deducted: retentionDeducted,
        advance_recovered: advanceRecovered,
        other_deductions: otherDeductions,
      };

      if (formData.id) {
        await api.put(`/construction/client-valuations/${formData.id}`, payload);
        toast.success("Client Valuation updated successfully");
      } else {
        await api.post("/construction/client-valuations", payload);
        toast.success("Client Valuation saved successfully");
      }
      setShowModal(false);
      fetchValuations();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to save valuation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (valId, newStatus) => {
    try {
      await api.post(`/construction/client-valuations/${valId}/status`, {
        status: newStatus,
        remarks: `Status changed to ${newStatus}`,
      });
      toast.success(`Valuation status changed to ${newStatus}`);
      fetchValuations();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to update valuation status");
    }
  };

  // Convert to Interim Payment Application
  const handleCreatePaymentApplication = async (valId) => {
    try {
      const res = await api.post(`/construction/client-valuations/${valId}/create-payment-application`);
      toast.success(res.data?.message || "Payment application created successfully!");
      setShowModal(false);
      navigate("/project-management/payment-applications");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to create payment application from valuation");
    }
  };

  // Filters
  const filteredValuations = valuations.filter((v) => {
    if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      v.valuation_no?.toLowerCase().includes(q) ||
      v.application_no?.toLowerCase().includes(q) ||
      v.project_name?.toLowerCase().includes(q) ||
      v.project_code?.toLowerCase().includes(q) ||
      v.client_name?.toLowerCase().includes(q) ||
      v.contract_ref?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status) => {
    const s = (status || "DRAFT").toUpperCase();
    switch (s) {
      case "APPROVED":
      case "CERTIFIED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
      case "SUBMITTED":
      case "UNDER_REVIEW":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800";
      case "REJECTED":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calculator size={24} className="text-brand-900 dark:text-brand-400" /> Client Valuations
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Physical work measurement, contract BOQ items, site materials, variations, and assessed value
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input text-sm py-1.5 h-auto min-w-[200px]"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_code} - {p.project_name}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search valuations..."
              className="input pl-9 pr-3 py-1.5 text-sm h-auto w-48"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="input text-sm py-1.5 h-auto w-32"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button onClick={fetchValuations} className="btn btn-secondary p-2" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={openNewValuationModal} className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> New Valuation
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {activeProject ? "Contract Sum" : "Active Projects"}
          </span>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            {activeProject
              ? `GH₵ ${Number(activeProject.revised_contract_sum || activeProject.contract_sum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : `${projects.length} Projects`}
          </p>
        </div>
        <div className="card p-4 space-y-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gross Assessed to Date</span>
          <p className="text-xl font-bold font-mono text-brand-700 dark:text-brand-400">
            GH₵{" "}
            {valuations
              .reduce((a, c) => a + Number(c.gross_assessed_value ?? c.gross_claimed ?? 0), 0)
              .toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4 space-y-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Retention Withheld</span>
          <p className="text-xl font-bold font-mono text-rose-600">
            GH₵{" "}
            {valuations
              .reduce((a, c) => a + Number(c.retention_deducted || 0), 0)
              .toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4 space-y-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Assessed (Due)</span>
          <p className="text-xl font-bold font-mono text-emerald-600">
            GH₵{" "}
            {valuations
              .reduce((a, c) => a + Number(c.current_assessed_amount ?? c.net_amount_due ?? 0), 0)
              .toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Valuations Register Table */}
      <div className="card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-brand-700 dark:text-brand-400" />
            Client Valuations Register ({filteredValuations.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 text-left">Valuation #</th>
                <th className="py-3 px-4 text-left">Project</th>
                <th className="py-3 px-4 text-left">Period</th>
                <th className="py-3 px-4 text-left">Valuation Date</th>
                <th className="py-3 px-4 text-right">Gross Assessed (GH₵)</th>
                <th className="py-3 px-4 text-right">Retention</th>
                <th className="py-3 px-4 text-right">Advance Rec</th>
                <th className="py-3 px-4 text-right">Net Assessed (GH₵)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredValuations.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                    {valuations.length === 0
                      ? 'No client valuations created yet. Click "+ New Valuation" to measure project work.'
                      : "No valuations match your search or filter."}
                  </td>
                </tr>
              ) : (
                filteredValuations.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand-900 dark:text-brand-300">
                      {v.valuation_no || v.application_no}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{v.project_code || "-"}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[160px]">{v.project_name}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                      {v.period_from ? String(v.period_from).split("T")[0] : "-"} to{" "}
                      {v.period_to ? String(v.period_to).split("T")[0] : "-"}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {v.valuation_date ? String(v.valuation_date).split("T")[0] : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium">
                      {Number(v.gross_assessed_value ?? v.gross_claimed ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-500">
                      -{Number(v.retention_deducted || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-500">
                      -{Number(v.advance_recovered || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      GH₵{" "}
                      {Number(v.current_assessed_amount ?? v.net_amount_due ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                          v.status
                        )}`}
                      >
                        {v.status || "DRAFT"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openViewOrEditModal(v.id, "VIEW")}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="View Measurement Sheet"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openViewOrEditModal(v.id, "EDIT")}
                          className="btn btn-secondary text-xs py-1 px-2.5"
                          title="Edit Valuation"
                        >
                          Edit
                        </button>
                        {/* Unified Workflow Slot */}
                        <div className="list-approval-slot inline-flex items-center gap-1.5">
                          {v.status === "APPROVED" || v.status === "CERTIFIED" ? (
                            <div className="flex items-center gap-1.5">
                              <span className="list-approval-approved-pill">Approved</span>
                              {canReverseApproval() && (
                                <button
                                  type="button"
                                  onClick={() => reverseValuation(v.id)}
                                  className="list-approval-reverse-btn"
                                >
                                  Reverse Approval
                                </button>
                              )}
                              <button
                                onClick={() => handleCreatePaymentApplication(v.id)}
                                className="btn btn-primary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                                title="Generate Interim Payment Application"
                              >
                                <Send size={12} /> Create IPA
                              </button>
                            </div>
                          ) : v.status === "PENDING_APPROVAL" ? (
                            <div className="flex items-center gap-1.5">
                              <span className="list-approval-forwarded-pill">
                                Forwarded to {v.forwarded_to_username || forwardedTo[v.id] || "Approver"}
                              </span>
                              {canReverseApproval() && (
                                <button
                                  type="button"
                                  onClick={() => reverseValuation(v.id)}
                                  className="list-approval-reverse-btn"
                                >
                                  Reverse
                                </button>
                              )}
                            </div>
                          ) : v.status === "SUBMITTED" ? (
                            <span className="list-approval-forwarded-pill">Submitted</span>
                          ) : v.status === "REJECTED" ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                Rejected
                              </span>
                              {canReverseApproval() && (
                                <button
                                  type="button"
                                  onClick={() => reverseValuation(v.id)}
                                  className="list-approval-reverse-btn"
                                >
                                  Reset to Draft
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openForwardModal(v)}
                              className="list-approval-forward-btn"
                              disabled={submittingForward}
                            >
                              Forward for Approval
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Valuation Workspace Modal */}
      <ProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={
          modalMode === "CREATE"
            ? "New Client Valuation Measurement"
            : modalMode === "EDIT"
            ? `Edit Valuation ${formData.valuation_no}`
            : `Valuation Assessment: ${formData.valuation_no}`
        }
        subtitle="Measure physical work completed, calculate earned values against BOQ, and assess net period valuation"
        icon={Calculator}
        maxWidth="max-w-6xl"
        showFooter={false}
      >
        <div className="space-y-6">
          {/* Section A: Valuation Header Form */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Section 1. Valuation Identification & Contract References
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Valuation Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  readOnly={modalMode === "VIEW"}
                  className="input text-sm font-mono w-full"
                  value={formData.valuation_no}
                  onChange={(e) => setFormData({ ...formData, valuation_no: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Project <span className="text-rose-500">*</span>
                </label>
                <select
                  disabled={modalMode !== "CREATE"}
                  className="input text-sm w-full"
                  value={formData.project_id}
                  onChange={async (e) => {
                    const pId = e.target.value;
                    setSelectedProjectId(pId);
                    try {
                      const bRes = await api.get(`/construction/client-valuations/baseline/${pId}`);
                      const base = bRes.data || {};
                      const baselineItems = (base.items || []).map((it) => ({
                        ...it,
                        current_period_qty: 0,
                        cumulative_qty: Number(it.prev_cumulative_qty || 0),
                        percentage_complete:
                          Number(it.contract_qty) > 0
                            ? Number(((Number(it.prev_cumulative_qty || 0) / Number(it.contract_qty)) * 100).toFixed(2))
                            : 0,
                        cumulative_value: Number(
                          (Number(it.prev_cumulative_qty || 0) * Number(it.contract_rate || 0)).toFixed(2)
                        ),
                        current_period_value: 0,
                        assessed_value: 0,
                        remarks: "",
                      }));
                      setFormData((prev) => ({
                        ...prev,
                        project_id: pId,
                        valuation_no: base.next_valuation_no || prev.valuation_no,
                        contract_ref: base.contract_ref || prev.contract_ref,
                        client_name: base.client_name || prev.client_name,
                        boq_id: base.boq?.id || null,
                        boq_title: base.boq?.title || "Project BOQ",
                        previous_valuation_id: base.previousValuation?.id || null,
                        previous_valuation_no: base.previousValuation?.valuation_no || "None",
                        items: baselineItems,
                      }));
                    } catch (_) {}
                  }}
                >
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_code} - {p.project_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Contract Ref</label>
                <input
                  type="text"
                  readOnly={modalMode === "VIEW"}
                  className="input text-sm font-mono w-full"
                  value={formData.contract_ref}
                  onChange={(e) => setFormData({ ...formData, contract_ref: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Client Name</label>
                <input
                  type="text"
                  readOnly
                  className="input text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 w-full"
                  value={formData.client_name}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Valuation Date</label>
                <input
                  type="date"
                  readOnly={modalMode === "VIEW"}
                  className="input text-sm font-mono w-full"
                  value={formData.valuation_date}
                  onChange={(e) => setFormData({ ...formData, valuation_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Period From</label>
                <input
                  type="date"
                  readOnly={modalMode === "VIEW"}
                  className="input text-sm font-mono w-full"
                  value={formData.period_from}
                  onChange={(e) => setFormData({ ...formData, period_from: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Period To</label>
                <input
                  type="date"
                  readOnly={modalMode === "VIEW"}
                  className="input text-sm font-mono w-full"
                  value={formData.period_to}
                  onChange={(e) => setFormData({ ...formData, period_to: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Valuation Type</label>
                <select
                  disabled={modalMode === "VIEW"}
                  className="input text-sm w-full"
                  value={formData.valuation_type}
                  onChange={(e) => setFormData({ ...formData, valuation_type: e.target.value })}
                >
                  <option value="INTERIM">Interim Valuation</option>
                  <option value="FINAL">Final Valuation</option>
                  <option value="REVALUATION">Revaluation / Audit</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Related BOQ</label>
                <input
                  type="text"
                  readOnly
                  className="input text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 w-full"
                  value={formData.boq_title || "Approved BOQ"}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Previous Valuation Ref
                </label>
                <input
                  type="text"
                  readOnly
                  className="input text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 w-full"
                  value={formData.previous_valuation_no || "Initial"}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Prepared By</label>
                <input
                  type="text"
                  readOnly={modalMode === "VIEW"}
                  className="input text-sm w-full"
                  value={formData.prepared_by_name}
                  onChange={(e) => setFormData({ ...formData, prepared_by_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Status</label>
                <select
                  disabled={modalMode === "VIEW"}
                  className="input text-sm font-semibold w-full"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted for Review</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section B & C: Tabs Navigation */}
          <div className="border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("boq_items")}
                className={`py-2 px-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === "boq_items"
                    ? "border-brand-900 text-brand-900 dark:border-brand-400 dark:text-brand-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                BOQ Work Items ({formData.items.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("variations")}
                className={`py-2 px-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === "variations"
                    ? "border-brand-900 text-brand-900 dark:border-brand-400 dark:text-brand-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Approved Variations
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("materials")}
                className={`py-2 px-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === "materials"
                    ? "border-brand-900 text-brand-900 dark:border-brand-400 dark:text-brand-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Materials On-Site (MOS)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("deductions")}
                className={`py-2 px-3 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === "deductions"
                    ? "border-brand-900 text-brand-900 dark:border-brand-400 dark:text-brand-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Deductions & Retention
              </button>
            </div>

            {modalMode !== "VIEW" && activeTab === "boq_items" && (
              <button
                type="button"
                onClick={handleAddNonBoqItem}
                className="btn btn-secondary text-xs py-1 px-3 inline-flex items-center gap-1.5 mb-1"
              >
                <Plus size={14} /> Add Extra Work Line
              </button>
            )}
          </div>

          {/* TAB 1: BOQ Work Items Table */}
          {activeTab === "boq_items" && (
            <div className="space-y-3">
              <div className="max-h-[380px] overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="table w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
                    <tr className="border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-slate-600 dark:text-slate-300 font-semibold">
                      <th className="p-2 text-left w-16">Code</th>
                      <th className="p-2 text-left">Description of Work</th>
                      <th className="p-2 text-center w-12">UoM</th>
                      <th className="p-2 text-right w-16">Contract Qty</th>
                      <th className="p-2 text-right w-20">Rate (GH₵)</th>
                      <th className="p-2 text-right w-20">Prev Qty</th>
                      <th className="p-2 text-right w-24 bg-brand-50/50 dark:bg-brand-950/20">Period Qty</th>
                      <th className="p-2 text-right w-20">Cumul Qty</th>
                      <th className="p-2 text-right w-14">% Done</th>
                      <th className="p-2 text-right w-24">Cumul Val</th>
                      <th className="p-2 text-right w-24 bg-emerald-50/40 dark:bg-emerald-950/20">Assessed Val</th>
                      <th className="p-2 text-left w-32">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {formData.items.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-6 text-center text-slate-400 italic">
                          No BOQ items loaded for this project. Ensure an approved BOQ exists.
                        </td>
                      </tr>
                    ) : (
                      formData.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-2 font-mono font-bold text-brand-800 dark:text-brand-300">{it.item_code}</td>
                          <td className="p-2 font-medium max-w-[200px] truncate" title={it.description}>
                            {it.description}
                          </td>
                          <td className="p-2 text-center font-mono">{it.uom}</td>
                          <td className="p-2 text-right font-mono">{Number(it.contract_qty).toFixed(2)}</td>
                          <td className="p-2 text-right font-mono">{Number(it.contract_rate).toFixed(2)}</td>
                          <td className="p-2 text-right font-mono text-slate-500">
                            {Number(it.prev_cumulative_qty).toFixed(2)}
                          </td>
                          <td className="p-2 text-right bg-brand-50/30 dark:bg-brand-950/10">
                            {modalMode === "VIEW" ? (
                              <span className="font-mono font-bold">{Number(it.current_period_qty).toFixed(2)}</span>
                            ) : (
                              <input
                                type="number"
                                step="any"
                                min="0"
                                className="input py-1 px-1.5 text-right font-mono text-xs w-20"
                                value={it.current_period_qty}
                                onChange={(e) => handleItemQtyChange(idx, e.target.value)}
                              />
                            )}
                          </td>
                          <td className="p-2 text-right font-mono font-semibold">
                            {Number(it.cumulative_qty).toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-mono font-semibold text-brand-700 dark:text-brand-400">
                            {Number(it.percentage_complete).toFixed(1)}%
                          </td>
                          <td className="p-2 text-right font-mono font-medium">
                            {Number(it.cumulative_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-right bg-emerald-50/30 dark:bg-emerald-950/10">
                            {modalMode === "VIEW" ? (
                              <span className="font-mono font-bold text-emerald-600">
                                {Number(it.assessed_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <input
                                type="number"
                                step="any"
                                min="0"
                                className="input py-1 px-1.5 text-right font-mono text-xs w-24 font-bold text-emerald-600"
                                value={it.assessed_value}
                                onChange={(e) => handleItemAssessedValueChange(idx, e.target.value)}
                              />
                            )}
                          </td>
                          <td className="p-2">
                            {modalMode === "VIEW" ? (
                              <span className="text-slate-500 truncate block max-w-[120px]">{it.remarks || "-"}</span>
                            ) : (
                              <input
                                type="text"
                                placeholder="Notes..."
                                className="input py-1 px-1.5 text-xs w-full"
                                value={it.remarks || ""}
                                onChange={(e) => handleItemRemarksChange(idx, e.target.value)}
                              />
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center px-2 text-xs font-semibold text-slate-500">
                <span>Total Items: {formData.items.length}</span>
                <span className="font-mono text-sm text-slate-900 dark:text-white">
                  Total BOQ Work Measured: GH₵{" "}
                  {totalBoqWorkCompleted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: Approved Variations */}
          {activeTab === "variations" && (
            <div className="space-y-4">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Approved Variations Claimed in Period
                  </h4>
                  <span className="text-xs font-mono text-brand-700 dark:text-brand-400 font-bold">
                    GH₵ {totalVariations.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Approved scope changes and variations automatically linked from the Variations & Change Orders register.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Approved Variations Claim Amount (GH₵)
                    </label>
                    <input
                      type="number"
                      step="any"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono w-full"
                      value={formData.approved_variations_total}
                      onChange={(e) =>
                        setFormData({ ...formData, approved_variations_total: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Materials On-Site (MOS) */}
          {activeTab === "materials" && (
            <div className="space-y-4">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Materials Stored On-Site (MOS)
                  </h4>
                  <span className="text-xs font-mono text-brand-700 dark:text-brand-400 font-bold">
                    GH₵ {totalMaterialsOnSite.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Eligible materials delivered and stored safely on site before permanent incorporation into works.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Assessed Materials on Site Value (GH₵)
                    </label>
                    <input
                      type="number"
                      step="any"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono w-full"
                      value={formData.materials_on_site_value}
                      onChange={(e) =>
                        setFormData({ ...formData, materials_on_site_value: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Approved Dayworks Total (GH₵)
                    </label>
                    <input
                      type="number"
                      step="any"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono w-full"
                      value={formData.dayworks_value}
                      onChange={(e) => setFormData({ ...formData, dayworks_value: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Other Contractual Adjustments (GH₵)
                    </label>
                    <input
                      type="number"
                      step="any"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono w-full"
                      value={formData.other_additions_value}
                      onChange={(e) => setFormData({ ...formData, other_additions_value: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Deductions & Retention */}
          {activeTab === "deductions" && (
            <div className="space-y-4">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Contractual Deductions & Advance Mobilisation Recoveries
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Retention Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono w-full"
                      value={formData.retention_percent}
                      onChange={(e) => setFormData({ ...formData, retention_percent: Number(e.target.value) || 0 })}
                    />
                    <div className="text-xs text-rose-500 font-mono font-bold">
                      Withholding: -GH₵ {retentionDeducted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Advance Mobilisation Recovery Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono w-full"
                      value={formData.advance_recovery_percent}
                      onChange={(e) =>
                        setFormData({ ...formData, advance_recovery_percent: Number(e.target.value) || 0 })
                      }
                    />
                    <div className="text-xs text-amber-500 font-mono font-bold">
                      Recovery: -GH₵ {advanceRecovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Other Statutory / Penalty Deductions (GH₵)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono w-full"
                      value={formData.other_deductions}
                      onChange={(e) => setFormData({ ...formData, other_deductions: Number(e.target.value) || 0 })}
                    />
                    <div className="text-xs text-slate-500 font-mono">
                      Total Other Deductions: GH₵ {otherDeductions.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Valuation Remarks / Site Notes
                  </label>
                  <textarea
                    rows={2}
                    readOnly={modalMode === "VIEW"}
                    placeholder="General observations, engineering measurement notes..."
                    className="input text-sm w-full py-2"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section D: Valuation Summary Panel */}
          <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 rounded-2xl border border-slate-800 shadow-apple-md space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Section 3. Comprehensive Period Valuation Summary
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[11px]">BOQ Work Done:</span>
                <span className="font-bold text-sm">
                  GH₵ {totalBoqWorkCompleted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Approved Variations:</span>
                <span className="font-bold text-sm text-brand-300">
                  +GH₵ {totalVariations.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Materials On-Site & Dayworks:</span>
                <span className="font-bold text-sm text-brand-300">
                  +GH₵ {(totalMaterialsOnSite + totalDayworks).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Gross Valuation:</span>
                <span className="font-bold text-sm text-cyan-400">
                  GH₵ {grossValuationAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[11px]">Less Retention ({retentionPercent}%):</span>
                <span className="text-rose-400 font-bold">
                  -GH₵ {retentionDeducted.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Less Advance Recovery ({advanceRecoveryPercent}%):</span>
                <span className="text-amber-400 font-bold">
                  -GH₵ {advanceRecovered.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Less Other Deductions:</span>
                <span className="text-slate-300 font-bold">
                  -GH₵ {otherDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-emerald-950/50 border border-emerald-500/40 p-2.5 rounded-xl">
                <span className="text-emerald-300 block text-[11px] font-semibold uppercase">
                  Net Period Assessed Value:
                </span>
                <span className="text-base font-extrabold text-emerald-400">
                  GH₵ {netAssessedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Section E: Modal Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
            <div>
              {formData.id && formData.status === "APPROVED" && (
                <button
                  type="button"
                  onClick={() => handleCreatePaymentApplication(formData.id)}
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  <Send size={16} /> Create Interim Payment Application
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn btn-secondary text-sm"
              >
                Close
              </button>
              {modalMode !== "VIEW" && (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSaveValuation("DRAFT")}
                    className="btn btn-secondary text-sm"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSaveValuation("SUBMITTED")}
                    className="btn btn-primary text-sm inline-flex items-center gap-1.5"
                  >
                    <CheckCircle size={16} /> Submit Valuation
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </ProjectModal>
      {/* Forward for Approval Modal (Sales Order Model) */}
      {showForwardModal ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-900 dark:text-brand-400 flex items-center justify-center font-bold flex-shrink-0 border border-brand-200/50 dark:border-brand-800/50">
                  <Send size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Forward for Approval</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Submit valuation into the approval workflow</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedValuation(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <div className="text-sm text-slate-700 dark:text-slate-300">
                Valuation No: <span className="font-semibold font-mono text-slate-900 dark:text-white">{selectedValuation?.valuation_no || selectedValuation?.application_no || "-"}</span>
              </div>
              <div className="text-sm text-slate-700 dark:text-slate-300">
                Workflow: <span className="font-semibold text-slate-900 dark:text-white">{candidateWorkflow ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})` : "Standard Client Valuation Approval"}</span>
              </div>
              {wfLoading && <div className="text-sm text-slate-500">Loading workflow details...</div>}
              {wfError && <div className="text-sm text-red-600 font-medium">{wfError}</div>}
              <div className="text-sm">
                <div className="font-medium text-slate-800 dark:text-slate-200 mb-1">Target Approver</div>
                {(() => {
                  const hasSteps = Array.isArray(workflowSteps) && workflowSteps.length > 0;
                  const first = hasSteps ? workflowSteps[0] : null;
                  const opts = first
                    ? Array.isArray(first.approvers) && first.approvers.length
                      ? first.approvers.map((u) => ({ id: u.id, name: u.username }))
                      : first.approver_user_id
                        ? [{ id: first.approver_user_id, name: first.approver_name || String(first.approver_user_id) }]
                        : []
                    : [];
                  return opts.length > 0 ? (
                    <div>
                      <select
                        className="input w-full"
                        value={targetApproverId || ""}
                        onChange={(e) => setTargetApproverId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Select target approver</option>
                        {opts.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                      {firstApprover && (
                        <div className="text-xs text-slate-500 mt-1">
                          Step {firstApprover.stepOrder} • {firstApprover.stepName}
                          {firstApprover.approvalLimit != null ? ` • Limit: GH₵ ${Number(firstApprover.approvalLimit).toLocaleString()}` : ""}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">
                      {candidateWorkflow ? "No specific approver assigned to first step. Will route to department head." : "Standard approval routing will apply upon forward."}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                className="btn btn-secondary px-4 py-2 text-sm font-medium"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedValuation(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary px-5 py-2 text-sm font-medium"
                onClick={forwardDocument}
                disabled={submittingForward || !selectedValuation}
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
