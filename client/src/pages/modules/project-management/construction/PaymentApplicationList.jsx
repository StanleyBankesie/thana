/**
 * @file PaymentApplicationList.jsx
 * @description Interim Payment Applications (IPAs) register, certification workflow,
 * deductions breakdown, and payment settlement tracking connected to Finance.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Plus,
  ArrowLeft,
  Calendar,
  CheckCircle,
  X,
  Search,
  RefreshCw,
  Building,
  DollarSign,
  ShieldCheck,
  CreditCard,
  Printer,
  ChevronRight,
  Send,
  Eye,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
  FileCheck2
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ProjectModal from "../components/ProjectModal.jsx";

export default function PaymentApplicationList() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [activeProject, setActiveProject] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Approved valuations for dropdown when creating a new IPA
  const [availableValuations, setAvailableValuations] = useState([]);

  // Modals
  const [showAppModal, setShowAppModal] = useState(false);
  const [modalMode, setModalMode] = useState("CREATE"); // CREATE | EDIT | VIEW
  const [activeTab, setActiveTab] = useState("statement"); // statement | certification | finance | history
  const [submitting, setSubmitting] = useState(false);

  // Certification Modal
  const [showCertifyModal, setShowCertifyModal] = useState(false);
  const [certifyForm, setCertifyForm] = useState({
    id: null,
    certified_amount: 0,
    assessed_amount: 0,
    rejected_amount: 0,
    certification_doc_no: "",
    adjustment_reason: "",
    qs_comments: "",
    pm_comments: "",
  });

  // Record Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    id: null,
    payment_amount: 0,
    payment_voucher_ref: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "BANK_TRANSFER",
    finance_notes: "",
  });

  // Main Form Data
  const [formData, setFormData] = useState({
    id: null,
    project_id: "",
    contract_ref: "",
    client_name: "",
    contractor_name: "",
    valuation_id: null,
    valuation_no: "",
    application_number: "",
    application_date: new Date().toISOString().split("T")[0],
    period_from: "",
    period_to: "",
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    payment_terms: "",
    currency: "GHS",
    application_type: "INTERIM",
    status: "DRAFT",
    work_completed_value: 0,
    approved_variations_value: 0,
    materials_on_site_value: 0,
    other_additions_value: 0,
    gross_amount_assessed: 0,
    retention_amount: 0,
    advance_recovery_amount: 0,
    other_deductions_amount: 0,
    previous_certified_amount: 0,
    adjustments_amount: 0,
    net_amount_requested: 0,
    certified_amount: 0,
    amount_paid: 0,
    outstanding_balance: 0,
    payment_status: "UNPAID",
    qs_comments: "",
    pm_comments: "",
    certification_doc_no: "",
    payment_voucher_ref: "",
    approval_history: [],
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
    fetchApplications();
    fetchAvailableValuations();
  }, [selectedProjectId]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await api.get("/construction/payment-applications", {
        params: selectedProjectId ? { project_id: selectedProjectId } : {},
      });
      setApplications(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to load payment applications");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableValuations = async () => {
    if (!selectedProjectId) return;
    try {
      const res = await api.get("/construction/client-valuations", {
        params: { project_id: selectedProjectId },
      });
      setAvailableValuations(res.data?.items || []);
    } catch (_) {}
  };

  const openNewApplicationModal = () => {
    const curProj = projects.find((p) => String(p.id) === String(selectedProjectId)) || activeProject;
    const projApps = applications.filter(
      (a) => !selectedProjectId || String(a.project_id) === String(selectedProjectId)
    );

    setFormData({
      id: null,
      project_id: selectedProjectId || (projects[0]?.id ? String(projects[0].id) : ""),
      contract_ref: curProj?.contract_ref_no || "CTR-001",
      client_name: curProj?.client_name || "Client",
      contractor_name: "",
      valuation_id: null,
      valuation_no: "",
      application_number: `IPA-${curProj?.project_code || "PRJ"}-${projApps.length + 1}`,
      application_date: new Date().toISOString().split("T")[0],
      period_from: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
      period_to: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      payment_terms: "30 Days from Certification",
      currency: "GHS",
      application_type: "INTERIM",
      status: "DRAFT",
      work_completed_value: 0,
      approved_variations_value: 0,
      materials_on_site_value: 0,
      other_additions_value: 0,
      gross_amount_assessed: 0,
      retention_amount: 0,
      advance_recovery_amount: 0,
      other_deductions_amount: 0,
      previous_certified_amount: 0,
      adjustments_amount: 0,
      net_amount_requested: 0,
      certified_amount: 0,
      amount_paid: 0,
      outstanding_balance: 0,
      payment_status: "UNPAID",
      qs_comments: "",
      pm_comments: "",
      certification_doc_no: "",
      payment_voucher_ref: "",
      approval_history: [],
    });

    setModalMode("CREATE");
    setActiveTab("statement");
    setShowAppModal(true);
  };

  const openViewOrEditModal = async (id, mode = "VIEW") => {
    try {
      const res = await api.get(`/construction/payment-applications/${id}`);
      const item = res.data?.item || {};

      let history = [];
      try {
        history =
          typeof item.approval_history === "string"
            ? JSON.parse(item.approval_history || "[]")
            : item.approval_history || [];
      } catch (_) {}

      setFormData({
        ...item,
        approval_history: history,
      });

      setModalMode(mode);
      setActiveTab("statement");
      setShowAppModal(true);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to load payment application");
    }
  };

  // When linking a valuation to this application
  const handleValuationSelect = (valId) => {
    const val = availableValuations.find((v) => String(v.id) === String(valId));
    if (!val) return;

    const workVal = Number(val.current_certified || val.gross_claimed - val.previous_certified || 0);
    const varsVal = Number(val.approved_variations_total || 0);
    const matVal = Number(val.materials_on_site_value || 0);
    const otherVal = Number(val.other_additions_value || 0);
    const gross = Number(val.gross_assessed_value || workVal + varsVal + matVal + otherVal);
    const ret = Number(val.retention_deducted || 0);
    const adv = Number(val.advance_recovered || 0);
    const otherDed = Number(val.other_deductions || 0);
    const net = Number(val.current_assessed_amount ?? val.net_amount_due ?? gross - ret - adv - otherDed);

    setFormData((prev) => ({
      ...prev,
      valuation_id: val.id,
      valuation_no: val.valuation_no || val.application_no,
      period_from: val.period_from ? String(val.period_from).split("T")[0] : prev.period_from,
      period_to: val.period_to ? String(val.period_to).split("T")[0] : prev.period_to,
      work_completed_value: workVal,
      approved_variations_value: varsVal,
      materials_on_site_value: matVal,
      other_additions_value: otherVal,
      gross_amount_assessed: gross,
      retention_amount: ret,
      advance_recovery_amount: adv,
      other_deductions_amount: otherDed,
      net_amount_requested: net,
    }));
  };

  // Recompute net amount requested
  const grossTotal =
    Number(formData.work_completed_value || 0) +
    Number(formData.approved_variations_value || 0) +
    Number(formData.materials_on_site_value || 0) +
    Number(formData.other_additions_value || 0);

  const netRequested = Math.max(
    0,
    grossTotal -
      Number(formData.retention_amount || 0) -
      Number(formData.advance_recovery_amount || 0) -
      Number(formData.other_deductions_amount || 0) -
      Number(formData.previous_certified_amount || 0) +
      Number(formData.adjustments_amount || 0)
  );

  const handleSaveApplication = async (targetStatus = formData.status) => {
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        status: targetStatus,
        gross_amount_assessed: grossTotal,
        net_amount_requested: netRequested,
      };

      if (formData.id) {
        await api.put(`/construction/payment-applications/${formData.id}`, payload);
        toast.success("Payment application updated successfully");
      } else {
        await api.post("/construction/payment-applications", payload);
        toast.success("Payment application submitted successfully");
      }
      setShowAppModal(false);
      fetchApplications();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to save payment application");
    } finally {
      setSubmitting(false);
    }
  };

  // Certify Application Trigger
  const openCertifyModal = (app) => {
    setCertifyForm({
      id: app.id,
      certified_amount: Number(app.certified_amount || app.net_amount_requested || 0),
      assessed_amount: Number(app.net_amount_requested || 0),
      rejected_amount: 0,
      certification_doc_no: app.certification_doc_no || `IPC-${app.project_code || "PRJ"}-${app.id}`,
      adjustment_reason: "",
      qs_comments: app.qs_comments || "",
      pm_comments: app.pm_comments || "",
    });
    setShowCertifyModal(true);
  };

  const handleCertifySubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/construction/payment-applications/${certifyForm.id}/certify`, certifyForm);
      toast.success(res.data?.message || "Payment application certified successfully");
      setShowCertifyModal(false);
      fetchApplications();
      if (showAppModal) setShowAppModal(false);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to certify application");
    }
  };

  // Record Payment Trigger
  const openPaymentModal = (app) => {
    const outstanding = Number(app.outstanding_balance || app.certified_amount || 0);
    setPaymentForm({
      id: app.id,
      payment_amount: outstanding > 0 ? outstanding : 0,
      payment_voucher_ref: `PV-REC-${Date.now().toString().slice(-4)}`,
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "BANK_TRANSFER",
      finance_notes: "Settlement received into company operations account",
    });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/construction/payment-applications/${paymentForm.id}/record-payment`, paymentForm);
      toast.success(res.data?.message || "Payment recorded successfully");
      setShowPaymentModal(false);
      fetchApplications();
      if (showAppModal) setShowAppModal(false);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to record payment");
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || "DRAFT").toUpperCase();
    switch (s) {
      case "CERTIFIED":
      case "PAID":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
      case "PARTIALLY_CERTIFIED":
      case "PARTIALLY_PAID":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
      case "SUBMITTED":
      case "UNDER_REVIEW":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800";
      case "REJECTED":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  const filteredApplications = applications.filter((a) => {
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      a.application_number?.toLowerCase().includes(q) ||
      a.project_name?.toLowerCase().includes(q) ||
      a.project_code?.toLowerCase().includes(q) ||
      a.client_name?.toLowerCase().includes(q) ||
      a.valuation_no?.toLowerCase().includes(q) ||
      a.certification_doc_no?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileCheck2 size={24} className="text-brand-900 dark:text-brand-400" /> Interim Payment Applications (IPAs)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Formal payment requests, client engineering certifications, statutory deductions, and receipts tracking
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
              placeholder="Search applications..."
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
            <option value="CERTIFIED">Certified</option>
            <option value="PARTIALLY_CERTIFIED">Partially Certified</option>
            <option value="PAID">Paid</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button onClick={fetchApplications} className="btn btn-secondary p-2" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={openNewApplicationModal} className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> New Application
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Requested</span>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            GH₵{" "}
            {applications
              .reduce((a, c) => a + Number(c.net_amount_requested || 0), 0)
              .toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4 space-y-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Certified (IPCs)</span>
          <p className="text-xl font-bold font-mono text-brand-700 dark:text-brand-400">
            GH₵{" "}
            {applications
              .reduce((a, c) => a + Number(c.certified_amount || 0), 0)
              .toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4 space-y-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Paid by Client</span>
          <p className="text-xl font-bold font-mono text-emerald-600">
            GH₵{" "}
            {applications
              .reduce((a, c) => a + Number(c.amount_paid || 0), 0)
              .toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-4 space-y-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding Balance</span>
          <p className="text-xl font-bold font-mono text-rose-600">
            GH₵{" "}
            {applications
              .reduce((a, c) => a + Number(c.outstanding_balance || 0), 0)
              .toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Payment Applications Register */}
      <div className="card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <FileText size={16} className="text-brand-700 dark:text-brand-400" />
            Interim Payment Applications Register ({filteredApplications.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 text-left">Application #</th>
                <th className="py-3 px-4 text-left">Project</th>
                <th className="py-3 px-4 text-left">Valuation Ref</th>
                <th className="py-3 px-4 text-left">Date</th>
                <th className="py-3 px-4 text-right">Gross Claim</th>
                <th className="py-3 px-4 text-right">Net Requested (GH₵)</th>
                <th className="py-3 px-4 text-right">Certified (GH₵)</th>
                <th className="py-3 px-4 text-right">Paid (GH₵)</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 italic">
                    {applications.length === 0
                      ? 'No payment applications created yet. Click "+ New Application" or create one from an approved Client Valuation.'
                      : "No applications match your search criteria."}
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand-900 dark:text-brand-300">
                      {app.application_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{app.project_code || "-"}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[150px]">{app.project_name}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {app.valuation_no || app.linked_valuation_no || "Manual"}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {app.application_date ? String(app.application_date).split("T")[0] : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {Number(app.gross_amount_assessed || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-brand-800 dark:text-brand-300">
                      GH₵{" "}
                      {Number(app.net_amount_requested || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {Number(app.certified_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-600">
                      {Number(app.amount_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                      GH₵{" "}
                      {Number(app.outstanding_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                          app.status
                        )}`}
                      >
                        {app.status || "DRAFT"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openViewOrEditModal(app.id, "VIEW")}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="View Application Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => openViewOrEditModal(app.id, "EDIT")}
                          className="btn btn-secondary text-xs py-1 px-2.5"
                          title="Edit"
                        >
                          Edit
                        </button>
                        {["SUBMITTED", "UNDER_REVIEW", "DRAFT"].includes(app.status) && (
                          <button
                            onClick={() => openCertifyModal(app)}
                            className="btn btn-primary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                            title="Certify Payment Application"
                          >
                            <ShieldCheck size={12} /> Certify
                          </button>
                        )}
                        {["CERTIFIED", "PARTIALLY_CERTIFIED"].includes(app.status) &&
                          Number(app.outstanding_balance) > 0 && (
                            <button
                              onClick={() => openPaymentModal(app)}
                              className="btn btn-secondary text-xs py-1 px-2.5 text-emerald-700 border-emerald-300 dark:border-emerald-700 inline-flex items-center gap-1"
                              title="Record Client Payment"
                            >
                              <CreditCard size={12} /> Record Pay
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

      {/* Main Payment Application Modal */}
      <ProjectModal
        open={showAppModal}
        onClose={() => setShowAppModal(false)}
        title={
          modalMode === "CREATE"
            ? "New Interim Payment Application (IPA)"
            : modalMode === "EDIT"
            ? `Edit Payment Application ${formData.application_number}`
            : `Payment Application: ${formData.application_number}`
        }
        subtitle="Formal contractor payment request, financial statement, certification, and settlement tracking"
        icon={FileCheck2}
        maxWidth="max-w-5xl"
        showFooter={false}
      >
        <div className="space-y-6">
          {/* Section 1: Header */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Section 1. Payment Application Header & Contract Data
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Application Ref <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  readOnly={modalMode === "VIEW"}
                  className="input text-sm font-mono w-full"
                  value={formData.application_number}
                  onChange={(e) => setFormData({ ...formData, application_number: e.target.value })}
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
                  onChange={(e) => {
                    const pId = e.target.value;
                    const p = projects.find((x) => String(x.id) === String(pId));
                    setSelectedProjectId(pId);
                    setFormData((prev) => ({
                      ...prev,
                      project_id: pId,
                      contract_ref: p?.contract_ref_no || prev.contract_ref,
                      client_name: p?.client_name || prev.client_name,
                    }));
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
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Linked Client Valuation
                </label>
                <select
                  disabled={modalMode === "VIEW"}
                  className="input text-sm w-full font-mono"
                  value={formData.valuation_id || ""}
                  onChange={(e) => handleValuationSelect(e.target.value)}
                >
                  <option value="">Select Valuation</option>
                  {availableValuations.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.valuation_no || v.application_no} (GH₵{" "}
                      {Number(v.current_assessed_amount || v.net_amount_due || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
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
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Application Date
                </label>
                <input
                  type="date"
                  readOnly={modalMode === "VIEW"}
                  className="input text-sm font-mono w-full"
                  value={formData.application_date}
                  onChange={(e) => setFormData({ ...formData, application_date: e.target.value })}
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
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Payment Due Date
                </label>
                <input
                  type="date"
                  readOnly={modalMode === "VIEW"}
                  className="input text-sm font-mono w-full"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Payment Terms</label>
                <input
                  type="text"
                  readOnly={modalMode === "VIEW"}
                  className="input text-sm w-full"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Currency</label>
                <input
                  type="text"
                  readOnly={modalMode === "VIEW"}
                  className="input text-sm font-mono w-full"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Workflow Status</label>
                <select
                  disabled={modalMode === "VIEW"}
                  className="input text-sm font-semibold w-full"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SUBMITTED">Submitted to Client</option>
                  <option value="UNDER_REVIEW">Under Review / Audit</option>
                  <option value="CERTIFIED">Certified by Engineer</option>
                  <option value="PARTIALLY_CERTIFIED">Partially Certified</option>
                  <option value="PAID">Paid / Settled</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-200 dark:border-slate-800 flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("statement")}
              className={`py-2 px-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "statement"
                  ? "border-brand-900 text-brand-900 dark:border-brand-400 dark:text-brand-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Statement of Claim
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("certification")}
              className={`py-2 px-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "certification"
                  ? "border-brand-900 text-brand-900 dark:border-brand-400 dark:text-brand-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Certification & Engineer Assessment
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("finance")}
              className={`py-2 px-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "finance"
                  ? "border-brand-900 text-brand-900 dark:border-brand-400 dark:text-brand-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Finance & Settlements
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`py-2 px-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "history"
                  ? "border-brand-900 text-brand-900 dark:border-brand-400 dark:text-brand-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Audit Trail ({formData.approval_history?.length || 0})
            </button>
          </div>

          {/* TAB 1: Statement of Claim */}
          {activeTab === "statement" && (
            <div className="space-y-4">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Section 2. Breakdown of Work Done & Contract Deductions
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Physical Work Completed Value (GH₵)
                    </label>
                    <input
                      type="number"
                      step="any"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono w-full"
                      value={formData.work_completed_value}
                      onChange={(e) =>
                        setFormData({ ...formData, work_completed_value: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Approved Variations Claimed (GH₵)
                    </label>
                    <input
                      type="number"
                      step="any"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono w-full"
                      value={formData.approved_variations_value}
                      onChange={(e) =>
                        setFormData({ ...formData, approved_variations_value: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Materials On-Site (MOS) (GH₵)
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
                      Other Additions / Dayworks (GH₵)
                    </label>
                    <input
                      type="number"
                      step="any"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono w-full"
                      value={formData.other_additions_value}
                      onChange={(e) =>
                        setFormData({ ...formData, other_additions_value: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-rose-600 block mb-1">Less Retention Amount (GH₵)</label>
                    <input
                      type="number"
                      step="any"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono text-rose-600 w-full"
                      value={formData.retention_amount}
                      onChange={(e) => setFormData({ ...formData, retention_amount: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-amber-600 block mb-1">
                      Less Advance Recovery (GH₵)
                    </label>
                    <input
                      type="number"
                      step="any"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono text-amber-600 w-full"
                      value={formData.advance_recovery_amount}
                      onChange={(e) =>
                        setFormData({ ...formData, advance_recovery_amount: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Less Other Deductions (GH₵)
                    </label>
                    <input
                      type="number"
                      step="any"
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm font-mono w-full"
                      value={formData.other_deductions_amount}
                      onChange={(e) =>
                        setFormData({ ...formData, other_deductions_amount: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Net Claim Banner */}
              <div className="p-4 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 rounded-xl flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900 dark:text-brand-300">
                    Net Payment Requested (Claim Amount)
                  </h4>
                  <p className="text-xs text-slate-500">Gross assessed value less statutory and advance deductions</p>
                </div>
                <div className="text-2xl font-bold font-mono text-brand-900 dark:text-brand-200">
                  GH₵ {netRequested.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Certification & Engineer Assessment */}
          {activeTab === "certification" && (
            <div className="space-y-4">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Supervising Engineer / Quantity Surveyor Certification
                  </h4>
                  {["SUBMITTED", "UNDER_REVIEW", "DRAFT"].includes(formData.status) && (
                    <button
                      type="button"
                      onClick={() => openCertifyModal(formData)}
                      className="btn btn-primary text-xs py-1 px-3 inline-flex items-center gap-1.5"
                    >
                      <ShieldCheck size={14} /> Open Certification Form
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-400 block">Certificate Document / IPC #</span>
                    <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formData.certification_doc_no || "Pending Certification"}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-400 block">Certified Amount</span>
                    <span className="text-base font-mono font-bold text-emerald-600">
                      GH₵{" "}
                      {Number(formData.certified_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-400 block">Under-assessment / Rejected</span>
                    <span className="text-base font-mono font-bold text-rose-500">
                      GH₵{" "}
                      {Number(formData.rejected_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      QS Assessment Comments
                    </label>
                    <textarea
                      rows={2}
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm w-full py-2"
                      value={formData.qs_comments || ""}
                      onChange={(e) => setFormData({ ...formData, qs_comments: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Project Manager Comments
                    </label>
                    <textarea
                      rows={2}
                      readOnly={modalMode === "VIEW"}
                      className="input text-sm w-full py-2"
                      value={formData.pm_comments || ""}
                      onChange={(e) => setFormData({ ...formData, pm_comments: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Finance & Settlements */}
          {activeTab === "finance" && (
            <div className="space-y-4">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Finance Module Integration & Payment Status
                  </h4>
                  {Number(formData.outstanding_balance) > 0 && (
                    <button
                      type="button"
                      onClick={() => openPaymentModal(formData)}
                      className="btn btn-secondary text-xs py-1 px-3 text-emerald-700 border-emerald-300 inline-flex items-center gap-1.5"
                    >
                      <CreditCard size={14} /> Record Payment
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-400 block">Total Certified</span>
                    <span className="text-base font-mono font-bold text-slate-800 dark:text-slate-200">
                      GH₵{" "}
                      {Number(formData.certified_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-400 block">Total Paid by Client</span>
                    <span className="text-base font-mono font-bold text-emerald-600">
                      GH₵{" "}
                      {Number(formData.amount_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-400 block">Outstanding Due</span>
                    <span className="text-base font-mono font-bold text-rose-600">
                      GH₵{" "}
                      {Number(formData.outstanding_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 block">Payment Voucher Reference / Notes</span>
                  <p className="text-sm font-mono text-slate-700 dark:text-slate-300">
                    {formData.payment_voucher_ref || "No receipt voucher recorded yet."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: History */}
          {activeTab === "history" && (
            <div className="space-y-3">
              {(!formData.approval_history || formData.approval_history.length === 0) ? (
                <div className="p-8 text-center text-slate-400 italic">No activity history recorded yet.</div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {formData.approval_history.map((h, i) => (
                    <div key={i} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{h.action}</span>
                        {h.certified_amount !== undefined && (
                          <span className="ml-2 font-mono text-emerald-600">
                            Certified: GH₵ {Number(h.certified_amount).toLocaleString()}
                          </span>
                        )}
                        <p className="text-slate-400 mt-0.5">{h.reason || h.remarks || "No remarks"}</p>
                      </div>
                      <div className="text-right text-slate-400 font-mono">
                        <div>{h.username || "System"}</div>
                        <div>{h.timestamp ? new Date(h.timestamp).toLocaleString() : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-2">
            <div>
              {formData.status === "CERTIFIED" && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-secondary text-sm inline-flex items-center gap-1.5"
                >
                  <Printer size={16} /> Print Certificate
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAppModal(false)}
                className="btn btn-secondary text-sm"
              >
                Close
              </button>
              {modalMode !== "VIEW" && (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSaveApplication("DRAFT")}
                    className="btn btn-secondary text-sm"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSaveApplication("SUBMITTED")}
                    className="btn btn-primary text-sm inline-flex items-center gap-1.5"
                  >
                    <Send size={16} /> Submit Application
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </ProjectModal>

      {/* Certify Payment Application Modal */}
      <ProjectModal
        open={showCertifyModal}
        onClose={() => setShowCertifyModal(false)}
        title="Certify Interim Payment Application"
        subtitle="Confirm assessed amount, rejected adjustments, and issue engineering certificate"
        icon={ShieldCheck}
        maxWidth="max-w-xl"
        onSubmit={handleCertifySubmit}
        submitLabel="Confirm & Issue Certificate"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Net Claimed (GH₵)
              </label>
              <input
                type="text"
                readOnly
                className="input text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 w-full"
                value={Number(certifyForm.assessed_amount || 0).toFixed(2)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Certified Amount (GH₵) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                className="input text-sm font-mono font-bold text-emerald-600 w-full"
                value={certifyForm.certified_amount}
                onChange={(e) => {
                  const cert = Number(e.target.value) || 0;
                  setCertifyForm({
                    ...certifyForm,
                    certified_amount: cert,
                    rejected_amount: Math.max(0, Number(certifyForm.assessed_amount || 0) - cert),
                  });
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Certificate Document No / IPC Ref <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              className="input text-sm font-mono w-full"
              value={certifyForm.certification_doc_no}
              onChange={(e) => setCertifyForm({ ...certifyForm, certification_doc_no: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Adjustment / Under-assessment Reason
            </label>
            <input
              type="text"
              placeholder="e.g. Disputed site measurement on line 3"
              className="input text-sm w-full"
              value={certifyForm.adjustment_reason}
              onChange={(e) => setCertifyForm({ ...certifyForm, adjustment_reason: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Quantity Surveyor / Engineer Notes
            </label>
            <textarea
              rows={2}
              placeholder="Comments on verified quantities and site tests..."
              className="input text-sm w-full py-2"
              value={certifyForm.qs_comments}
              onChange={(e) => setCertifyForm({ ...certifyForm, qs_comments: e.target.value })}
            />
          </div>
        </div>
      </ProjectModal>

      {/* Record Payment Settlement Modal */}
      <ProjectModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Record Client Payment"
        subtitle="Log settlement receipt from client and update outstanding balance"
        icon={CreditCard}
        maxWidth="max-w-xl"
        onSubmit={handlePaymentSubmit}
        submitLabel="Record Payment"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Payment Amount (GH₵) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                className="input text-sm font-mono font-bold text-emerald-600 w-full"
                value={paymentForm.payment_amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_amount: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Payment Date</label>
              <input
                type="date"
                required
                className="input text-sm font-mono w-full"
                value={paymentForm.payment_date}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Receipt / Voucher Ref <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                className="input text-sm font-mono w-full"
                value={paymentForm.payment_voucher_ref}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_voucher_ref: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Payment Method</label>
              <select
                className="input text-sm w-full"
                value={paymentForm.payment_method}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
              >
                <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="DIRECT_DEPOSIT">Direct Deposit</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Finance Notes / Bank Reference
            </label>
            <input
              type="text"
              placeholder="e.g. Stanbic Bank payment slip ref # 4819"
              className="input text-sm w-full"
              value={paymentForm.finance_notes}
              onChange={(e) => setPaymentForm({ ...paymentForm, finance_notes: e.target.value })}
            />
          </div>
        </div>
      </ProjectModal>
    </div>
  );
}
