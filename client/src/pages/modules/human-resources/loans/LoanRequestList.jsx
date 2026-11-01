/**
 * @fileoverview LoanRequestList component.
 * Provides full approval workflow for employee loan requests (matching the Sales Order approval workflow):
 * - Create loan request as Draft or Pending Approval
 * - Forward for approval with target approver selection
 * - Approve, Reject with reason, Reverse Approval
 * - Direct Disburse with Payment Voucher (PV) generation
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import Modal from "@/components/Modal";
import {
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Plus,
  ArrowRight,
  ArrowLeft,
  Clock,
  Filter,
  DollarSign,
  AlertTriangle,
  Search,
  User,
  X,
} from "lucide-react";
import LoanDisbursementModal from "./LoanDisbursementModal.jsx";

export default function LoanRequestList() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useViewMode();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Approval Workflow State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [targetApproverId, setTargetApproverId] = useState("");
  const [forwardComment, setForwardComment] = useState("");
  const [approverUsers, setApproverUsers] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);

  // Load requests
  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/loan-requests");
      setRequests(res.data?.items || []);
    } catch {
      toast.error("Failed to load loan requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // Load candidate workflows and approvers (matching Sales Order workflow mechanism)
  useEffect(() => {
    async function initWorkflowData() {
      try {
        const [wfRes, usrRes] = await Promise.allSettled([
          api.get("/workflows"),
          api.get("/users"),
        ]);

        if (wfRes.status === "fulfilled") {
          const list = wfRes.value.data?.items || [];
          setWorkflows(list);
          const route = "/human-resources/loan-requests";
          const matching = list.find(
            (w) =>
              Number(w.is_active) === 1 &&
              (String(w.document_route) === route ||
                String(w.document_type || "").toUpperCase() === "LOAN_REQUEST" ||
                String(w.document_type || "").toUpperCase() === "HR_LOAN")
          );
          setCandidateWorkflow(matching || null);
        }

        if (usrRes.status === "fulfilled") {
          setApproverUsers(usrRes.value.data?.items || usrRes.value.data || []);
        }
      } catch {}
    }
    initWorkflowData();
  }, []);

  // Action: Open Forward Modal
  const openForwardModal = (req) => {
    setSelectedRequest(req);
    setForwardComment("");
    setTargetApproverId("");
    setShowForwardModal(true);
  };

  // Action: Submit Forward for Approval
  const handleForwardForApproval = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setProcessingAction(true);
    try {
      await api.post(`/hr/loans/${selectedRequest.id}/forward`, {
        target_approver_id: targetApproverId ? Number(targetApproverId) : null,
        workflow_id: candidateWorkflow?.id || null,
        notes: forwardComment,
      });

      toast.success(
        `Loan Request #${selectedRequest.id} forwarded for approval successfully`
      );
      setShowForwardModal(false);
      loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to forward loan request");
    } finally {
      setProcessingAction(false);
    }
  };

  // Action: Direct Approve
  const handleApprove = async (req) => {
    if (
      !window.confirm(
        `Approve staff loan request for ${req.first_name} ${req.last_name} (${Number(req.amount).toLocaleString()} GHS)?`
      )
    ) {
      return;
    }
    setProcessingAction(true);
    try {
      await api.post(`/hr/loans/${req.id}/approve`, {});
      toast.success(`Loan Request #${req.id} approved successfully! It is now ready for disbursement.`);
      loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve loan request");
    } finally {
      setProcessingAction(false);
    }
  };

  // Action: Open Reject Modal
  const openRejectModal = (req) => {
    setSelectedRequest(req);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  // Action: Submit Rejection
  const handleReject = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (!rejectionReason.trim()) {
      toast.error("Please enter a reason for rejecting this loan request");
      return;
    }

    setProcessingAction(true);
    try {
      await api.post(`/hr/loans/${selectedRequest.id}/reject`, {
        rejection_reason: rejectionReason,
      });
      toast.success(`Loan Request #${selectedRequest.id} rejected`);
      setShowRejectModal(false);
      loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject loan request");
    } finally {
      setProcessingAction(false);
    }
  };

  // Action: Reverse Approval
  const handleReverseApproval = async (req) => {
    if (
      !window.confirm(
        `Reverse approval for Loan Request #${req.id}? This will revert the request back to Pending Approval.`
      )
    ) {
      return;
    }
    setProcessingAction(true);
    try {
      await api.post(`/hr/loans/${req.id}/reverse-approval`, {});
      toast.success(`Approval reversed for Loan Request #${req.id}`);
      loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reverse approval");
    } finally {
      setProcessingAction(false);
    }
  };

  // Filter & Stats calculations
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter(
      (r) => r.status === "PENDING" || r.status === "PENDING_APPROVAL"
    ).length;
    const approved = requests.filter((r) => r.status === "APPROVED").length;
    const disbursed = requests.filter(
      (r) => r.status === "ACTIVE" || r.status === "COMPLETED"
    ).length;
    const rejected = requests.filter((r) => r.status === "REJECTED").length;
    const drafts = requests.filter((r) => r.status === "DRAFT").length;
    const totalPrincipal = requests.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

    return {
      total,
      pending,
      approved,
      disbursed,
      rejected,
      drafts,
      totalPrincipal,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Tab filter
      if (activeTab === "PENDING_APPROVAL") {
        if (r.status !== "PENDING" && r.status !== "PENDING_APPROVAL") return false;
      } else if (activeTab === "APPROVED") {
        if (r.status !== "APPROVED") return false;
      } else if (activeTab === "DISBURSED") {
        if (r.status !== "ACTIVE" && r.status !== "COMPLETED") return false;
      } else if (activeTab === "REJECTED") {
        if (r.status !== "REJECTED") return false;
      } else if (activeTab === "DRAFT") {
        if (r.status !== "DRAFT") return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const fullName = `${r.first_name || ""} ${r.last_name || ""}`.toLowerCase();
        const code = String(r.emp_code || r.employee_code || "").toLowerCase();
        const loanType = String(r.loan_type || "").toLowerCase();
        const purpose = String(r.purpose || "").toLowerCase();
        const reqNo = `lr-${r.id}`.toLowerCase();
        return (
          fullName.includes(s) ||
          code.includes(s) ||
          loanType.includes(s) ||
          purpose.includes(s) ||
          reqNo.includes(s)
        );
      }
      return true;
    });
  }, [requests, activeTab, searchTerm]);

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/human-resources"
              className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <ArrowLeft size={16} />
              Back
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="text-brand-600 dark:text-brand-400" />
                Staff Loan Requests
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Submit, review, and approve staff loan applications with multi-tier approval workflows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/human-resources/loans"
              className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <DollarSign size={16} />
              Loan Disbursements
            </Link>
            <Link
              to="/human-resources/loan-requests/new"
              className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <Plus size={16} />
              New Loan Request
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div
            onClick={() => setActiveTab("ALL")}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all bg-white dark:bg-slate-800 ${
              activeTab === "ALL"
                ? "border-slate-900 dark:border-white ring-1 ring-slate-900 dark:ring-white shadow-xs"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Total Requests
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
              {stats.total}
            </span>
          </div>

          <div
            onClick={() => setActiveTab("PENDING_APPROVAL")}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all bg-white dark:bg-slate-800 ${
              activeTab === "PENDING_APPROVAL"
                ? "border-slate-900 dark:border-white ring-1 ring-slate-900 dark:ring-white shadow-xs"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Pending Approval
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
              {stats.pending}
            </span>
          </div>

          <div
            onClick={() => setActiveTab("APPROVED")}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all bg-white dark:bg-slate-800 ${
              activeTab === "APPROVED"
                ? "border-slate-900 dark:border-white ring-1 ring-slate-900 dark:ring-white shadow-xs"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Approved
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
              {stats.approved}
            </span>
          </div>

          <div
            onClick={() => setActiveTab("DISBURSED")}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all bg-white dark:bg-slate-800 ${
              activeTab === "DISBURSED"
                ? "border-slate-900 dark:border-white ring-1 ring-slate-900 dark:ring-white shadow-xs"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Disbursed (Active)
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
              {stats.disbursed}
            </span>
          </div>

          <div
            onClick={() => setActiveTab("REJECTED")}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all bg-white dark:bg-slate-800 ${
              activeTab === "REJECTED"
                ? "border-slate-900 dark:border-white ring-1 ring-slate-900 dark:ring-white shadow-xs"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Rejected
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
              {stats.rejected}
            </span>
          </div>
        </div>

        {/* Tab & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: "ALL", label: `All (${stats.total})` },
              { id: "PENDING_APPROVAL", label: `Pending Approval (${stats.pending})` },
              { id: "APPROVED", label: `Approved (${stats.approved})` },
              { id: "DISBURSED", label: `Disbursed (${stats.disbursed})` },
              { id: "REJECTED", label: `Rejected (${stats.rejected})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                className="input pl-8 py-1.5 text-xs w-full"
                placeholder="Search employee, request no, or purpose..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>

        {/* List / Table */}
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading loan requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <FileText className="mx-auto w-12 h-12 text-slate-300 dark:text-slate-600" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
              No Loan Requests Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are no loan requests matching the selected filter. Click below to submit a new loan request.
            </p>
            <Link to="/human-resources/loan-requests/new" className="btn-primary inline-flex items-center gap-1.5 text-xs">
              <Plus size={15} />
              New Loan Request
            </Link>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  {/* Card Header: Request No & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                      LR-{String(req.id).padStart(5, "0")}
                    </span>
                    <StatusBadge req={req} />
                  </div>

                  {/* Employee Info */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {req.first_name} {req.last_name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {req.emp_code || `Emp #${req.employee_id}`} • {req.loan_type}
                    </p>
                  </div>

                  {/* Amounts */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Requested
                      </span>
                      <span className="font-bold font-mono text-slate-800 dark:text-slate-100">
                        GHS {Number(req.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Installment
                      </span>
                      <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                        GHS {Number(req.monthly_installment || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} / mo
                      </span>
                    </div>
                  </div>

                  {req.purpose && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 italic">
                      "{req.purpose}"
                    </p>
                  )}

                  {req.rejection_reason && req.status === "REJECTED" && (
                    <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-200">
                      <strong>Reason:</strong> {req.rejection_reason}
                    </div>
                  )}
                </div>

                {/* Workflow Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                  <WorkflowActionButtons
                    req={req}
                    onForward={() => openForwardModal(req)}
                    onApprove={() => handleApprove(req)}
                    onReject={() => openRejectModal(req)}
                    onReverse={() => handleReverseApproval(req)}
                    onDisburse={() => {
                      setSelectedRequest(req);
                      setShowDisburseModal(true);
                    }}
                    processing={processingAction}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Req No</th>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Loan Facility</th>
                    <th className="px-4 py-3 text-right">Amount (GHS)</th>
                    <th className="px-4 py-3 text-right">Installment</th>
                    <th className="px-4 py-3">Status / Approver</th>
                    <th className="px-4 py-3">Purpose</th>
                    <th className="px-4 py-3 text-center">Approval Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-sans">
                  {filteredRequests.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-600 dark:text-slate-300">
                        LR-{String(req.id).padStart(5, "0")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {req.first_name} {req.last_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {req.emp_code || `Emp #${req.employee_id}`}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {req.loan_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {Number(req.amount || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {Number(req.monthly_installment || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {req.repayment_period_months} mos
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge req={req} />
                        {req.approved_by_name && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            by {req.approved_by_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-xs text-slate-600 dark:text-slate-400" title={req.purpose}>
                        {req.purpose || "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <WorkflowActionButtons
                            req={req}
                            onForward={() => openForwardModal(req)}
                            onApprove={() => handleApprove(req)}
                            onReject={() => openRejectModal(req)}
                            onReverse={() => handleReverseApproval(req)}
                            onDisburse={() => {
                              setSelectedRequest(req);
                              setShowDisburseModal(true);
                            }}
                            processing={processingAction}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FORWARD FOR APPROVAL MODAL (matching SalesOrderList) */}
        {showForwardModal && selectedRequest && (
          <Modal
            open={showForwardModal}
            onClose={() => setShowForwardModal(false)}
            title="Forward Loan Request for Approval"
            subtitle={`Submit LR-${String(selectedRequest.id).padStart(5, "0")} (${selectedRequest.first_name} ${selectedRequest.last_name}) into approval workflow`}
            icon={<Send size={20} />}
            maxWidth="max-w-md"
            showFooter={false}
          >
            <form onSubmit={handleForwardForApproval} className="space-y-4 text-sm">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Document No:</span>
                  <span className="font-mono font-bold">LR-{String(selectedRequest.id).padStart(5, "0")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested Amount:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">
                    GHS {Number(selectedRequest.amount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Workflow:</span>
                  <span className="font-semibold text-brand-600 dark:text-brand-400">
                    {candidateWorkflow
                      ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})`
                      : "Standard Staff Loan Workflow"}
                  </span>
                </div>
              </div>

              <div>
                <label className="label">Target Approver / Manager</label>
                <select
                  className="input w-full"
                  value={targetApproverId}
                  onChange={(e) => setTargetApproverId(e.target.value)}
                >
                  <option value="">-- Select Target Approver (or Auto-assign) --</option>
                  {approverUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.name || u.username} ({u.role || u.email || "Approver"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Submission Notes / Comments</label>
                <textarea
                  className="input w-full"
                  rows="2.5"
                  placeholder="Optional justification or comments for the approver..."
                  value={forwardComment}
                  onChange={(e) => setForwardComment(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowForwardModal(false)}
                  className="btn-secondary"
                  disabled={processingAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-1.5"
                  disabled={processingAction}
                >
                  <Send size={15} />
                  {processingAction ? "Forwarding..." : "Forward for Approval"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* REJECT MODAL */}
        {showRejectModal && selectedRequest && (
          <Modal
            open={showRejectModal}
            onClose={() => setShowRejectModal(false)}
            title="Reject Loan Request"
            subtitle={`LR-${String(selectedRequest.id).padStart(5, "0")} for ${selectedRequest.first_name} ${selectedRequest.last_name}`}
            icon={<XCircle size={20} className="text-rose-600" />}
            maxWidth="max-w-md"
            showFooter={false}
          >
            <form onSubmit={handleReject} className="space-y-4 text-sm">
              <div className="bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-200 dark:border-rose-800/50 text-xs text-rose-800 dark:text-rose-300">
                Please provide a reason for rejecting this loan request. This will be visible on the request record.
              </div>

              <div>
                <label className="label">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="input w-full"
                  rows="3"
                  required
                  placeholder="State the reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="btn-secondary"
                  disabled={processingAction}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5"
                  disabled={processingAction}
                >
                  <XCircle size={15} />
                  {processingAction ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* LOAN DISBURSEMENT MODAL (Payment Voucher Direct Payment) */}
        {showDisburseModal && selectedRequest && (
          <LoanDisbursementModal
            open={showDisburseModal}
            onClose={() => {
              setShowDisburseModal(false);
              setSelectedRequest(null);
            }}
            loan={selectedRequest}
            onSuccess={() => {
              loadRequests();
            }}
          />
        )}
      </div>
    </Guard>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({ req }) {
  const status = req.status;

  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60">
        <CheckCircle2 size={12} />
        Approved
      </span>
    );
  }

  if (status === "PENDING_APPROVAL" || status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60">
        <Clock size={12} />
        {req.forwarded_to_user_name
          ? `Forwarded to ${req.forwarded_to_user_name}`
          : "Pending Approval"}
      </span>
    );
  }

  if (status === "ACTIVE" || status === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300/60">
        <DollarSign size={12} />
        Disbursed {req.disbursement_voucher_no ? `(${req.disbursement_voucher_no})` : ""}
      </span>
    );
  }

  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/60">
        <XCircle size={12} />
        Rejected
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/60">
      Draft
    </span>
  );
}

/**
 * Workflow Action Buttons Component
 */
function WorkflowActionButtons({ req, onForward, onApprove, onReject, onReverse, onDisburse, processing }) {
  const status = req.status;

  if (status === "DRAFT") {
    return (
      <button
        type="button"
        onClick={onForward}
        disabled={processing}
        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1 shadow-sm transition-colors"
      >
        <Send size={12} />
        Forward for Approval
      </button>
    );
  }

  if (status === "PENDING_APPROVAL" || status === "PENDING") {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onApprove}
          disabled={processing}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-sm transition-colors"
          title="Approve this loan request"
        >
          <CheckCircle2 size={12} />
          Approve
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={processing}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 shadow-sm transition-colors"
          title="Reject this loan request"
        >
          <XCircle size={12} />
          Reject
        </button>
      </div>
    );
  }

  if (status === "APPROVED") {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onDisburse}
          disabled={processing}
          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-sm transition-colors"
          title="Disburse this approved loan with Payment Voucher"
        >
          <DollarSign size={12} />
          Disburse Loan
        </button>
        <button
          type="button"
          onClick={onReverse}
          disabled={processing}
          className="px-2 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors"
          title="Reverse approval back to Pending"
        >
          <RotateCcw size={12} />
          Reverse
        </button>
      </div>
    );
  }

  if (status === "ACTIVE" || status === "COMPLETED") {
    return (
      <Link
        to="/human-resources/loans"
        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1"
      >
        Disbursements <ArrowRight size={12} />
      </Link>
    );
  }

  return null;
}
