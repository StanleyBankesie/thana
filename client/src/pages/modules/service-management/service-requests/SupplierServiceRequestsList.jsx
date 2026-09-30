/**
 * @fileoverview SupplierServiceRequestsList component.
 * Provides functionality for SupplierServiceRequestsList.
 */

import React, { useEffect, useMemo, useState } from "react";
import PendingApprovalTooltip from "@/components/PendingApprovalTooltip.jsx";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import { printDocument, downloadDocumentPdf } from "@/utils/pdfUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SupplierServiceRequestsList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const { hasExceptional, canReverseApproval } = usePermission();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardComments, setForwardComments] = useState("");
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);

  const [exCancelAllowed, setExCancelAllowed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  function normalizeStatus(s) {
    return String(s || "DRAFT").toUpperCase();
  }
  function statusLabel(s) {
    const k = normalizeStatus(s);
    if (k === "PENDING_APPROVAL") return "Pending Approval";
    return k;
  }
  function getStatusBadge(s) {
    const k = normalizeStatus(s);
    const map = {
      DRAFT: "badge-warning",
      PENDING_APPROVAL: "badge-warning",
      APPROVED: "badge-info",
      REJECTED: "badge-error",
      CANCELLED: "badge-error",
      FULFILLED: "badge-success",
    };
    return map[k] || "badge-info";
  }

  useEffect(() => {
    let cancelled = false;
    async function loadExceptional() {
      try {
        const me = await api.get("/admin/me");
        const uid = Number(me?.data?.user?.id || me?.data?.user?.sub || 0);
        setCurrentUserId(uid || null);
        if (!uid || cancelled) return;
        const resp = await api.get(`/admin/users/${uid}/exceptional-permissions`);
        const arr = Array.isArray(resp?.data?.data?.items)
          ? resp.data.data.items
          : Array.isArray(resp?.data?.items)
          ? resp.data.items
          : [];
        const allowedCancel = arr.some((p) => {
          const effect = String(p.effect || "").toUpperCase();
          const active = Number(p.is_active || p.isActive) === 1;
          const code = String(p.permission_code || p.permissionCode || "").toUpperCase();
          return effect === "ALLOW" && active && code === "PURCHASE.GENERAL_REQUISITION.CANCEL";
        });
        if (!cancelled) {
          setExCancelAllowed(allowedCancel);
        }
      } catch {
        if (!cancelled) {
          setExCancelAllowed(false);
        }
      }
    }
    loadExceptional();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onWorkflowStatus(e) {
      try {
        const d = e.detail || {};
        const id = Number(d.documentId || d.document_id);
        const status = String(d.status || "").toUpperCase();
        if (!id || !status) return;
        const normalized = status === "RETURNED" ? "DRAFT" : status;
        setItems((prev) =>
          prev.map((x) =>
            Number(x.id) === id
              ? {
                  ...x,
                  status: normalized,
                  ...(normalized === "DRAFT" ? { forwarded_to_username: null } : {}),
                }
              : x,
          ),
        );
        if (normalized === "APPROVED") {
          (async () => {
            try {
              await api.put(`/service-management/supplier-service-requests/${id}/status`, {
                status: "APPROVED",
              });
            } catch {}
          })();
        }
      } catch {}
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () => window.removeEventListener("omni.workflow.status", onWorkflowStatus);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/purchase/general-requisitions");
      const all = Array.isArray(res.data?.items) ? res.data.items : [];
      setItems(all);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load general requisitions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const base = statusFilter === "ALL" ? items.slice() : items.filter((r) => normalizeStatus(r.status) === statusFilter);
    if (!searchTerm.trim()) return base;
    const q = searchTerm.toLowerCase();
    return base.filter(
      (r) =>
        String(r.requisition_no || "").toLowerCase().includes(q) ||
        String(r.department || "").toLowerCase().includes(q) ||
        String(r.requested_by || "").toLowerCase().includes(q),
    );
  }, [items, statusFilter, searchTerm]);

  const { sorted: sortedFiltered, sortKey, sortDir, toggle } = useSort(filtered, "created_at", "desc");

  const workflowDisabled = hasInactiveWorkflow && !candidateWorkflow;

  const openForwardModal = async (doc) => {
    setSelectedDoc(doc);
    setShowForwardModal(true);
    setWfError("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        const arr = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(arr);
        await computeCandidateFromList(arr);
      } catch (e) {
        setWfError(e?.response?.data?.message || "Failed to load workflows");
      } finally {
        setWfLoading(false);
      }
    } else {
      await computeCandidate();
    }
  };

  const computeCandidate = async () => {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/purchase/general-requisitions";
    const normalize = (s) =>
      String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const matching = workflowsCache.filter(
      (w) => String(w.document_route) === route || normalize(w.document_type) === "GENERAL_REQUISITION",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find((w) => Number(w.is_active) === 1 && String(w.document_route) === route) ||
      workflowsCache.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "GENERAL_REQUISITION") ||
      null;
    setCandidateWorkflow(chosen || null);
    setHasInactiveWorkflow(!chosen && hasInactive);
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null,
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  const computeCandidateFromList = async (arr) => {
    if (!arr || !arr.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/purchase/general-requisitions";
    const normalize = (s) =>
      String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const matching = arr.filter(
      (w) => String(w.document_route) === route || normalize(w.document_type) === "GENERAL_REQUISITION",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      arr.find((w) => Number(w.is_active) === 1 && String(w.document_route) === route) ||
      arr.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "GENERAL_REQUISITION") ||
      null;
    setCandidateWorkflow(chosen || null);
    setHasInactiveWorkflow(!chosen && hasInactive);
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null,
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  const forwardDocument = async () => {
    if (!selectedDoc) return;
    const hasSteps = Array.isArray(workflowSteps) && workflowSteps.length > 0;
    const first = hasSteps ? workflowSteps[0] : null;
    const opts = first
      ? Array.isArray(first.approvers) && first.approvers.length
        ? first.approvers
        : first.approver_user_id
        ? [{ id: first.approver_user_id }]
        : []
      : [];
    if (candidateWorkflow && opts.length > 0 && !targetApproverId) {
      setWfError("Please select target approver");
      return;
    }
    setSubmittingForward(true);
    setWfError("");
    let optimisticApprover = null;
    try {
      const options = first
        ? Array.isArray(first.approvers) && first.approvers.length
          ? first.approvers.map((u) => ({ id: u.id, name: u.username }))
          : first.approver_user_id
          ? [
              {
                id: first.approver_user_id,
                name: first.approver_name || String(first.approver_user_id),
              },
            ]
          : []
        : [];
      if (targetApproverId && options.length) {
        const hit = options.find((u) => Number(u.id) === Number(targetApproverId));
        optimisticApprover = hit ? hit.name : null;
      }
    } catch {}
    setItems((prev) =>
      prev.map((r) =>
        r.id === selectedDoc.id
          ? {
              ...r,
              status: "PENDING_APPROVAL",
              forwarded_to_username: optimisticApprover || r.forwarded_to_username || "Approver",
            }
          : r,
      ),
    );
    setShowForwardModal(false);
    const amount =
      selectedDoc.total_estimated_cost == null ? null : Number(selectedDoc.total_estimated_cost || 0);
    try {
      const res = await api.post(`/service-management/supplier-service-requests/${selectedDoc.id}/submit`, {
        amount,
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
        comments: forwardComments,
        });
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      setItems((prev) =>
        prev.map((x) => (x.id === selectedDoc.id ? { ...x, status: newStatus } : x)),
      );
      toast.success("General requisition forwarded for approval");
      const instanceId = res?.data?.instanceId;
      if (instanceId && targetApproverId && currentUserId && Number(targetApproverId) === Number(currentUserId)) {
        navigate(`/administration/workflows/approvals/${instanceId}`);
      }
      try { await loadData(); } catch {}
    } catch (e1) {
      try {
        const wfRes = await api.post("/workflows/start", {
          document_type: "GENERAL_REQUISITION",
          document_id: selectedDoc.id,
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
          amount,
        
          comments: forwardComments || "Forwarded for Approval",
        });
        const newStatus = wfRes?.data?.status || "PENDING_APPROVAL";
        setItems((prev) =>
          prev.map((x) => (x.id === selectedDoc.id ? { ...x, status: newStatus } : x)),
        );
        toast.success("General requisition forwarded for approval");
        const instanceId = wfRes?.data?.instanceId;
        if (instanceId && targetApproverId && currentUserId && Number(targetApproverId) === Number(currentUserId)) {
          navigate(`/administration/workflows/approvals/${instanceId}`);
        }
        try { await loadData(); } catch {}
      } catch (e2) {
        await api.put(`/service-management/supplier-service-requests/${selectedDoc.id}/status`, {
          status: "PENDING_APPROVAL",
        });
        toast.success("General requisition forwarded for approval");
        try { await loadData(); } catch {}
      }
    } finally {
      setSubmittingForward(false);
    }
  };

  const reverseApproval = async (id) => {
    try {
      await api.post("/workflows/reverse-by-document", {
        document_type: "GENERAL_REQUISITION",
        document_id: id,
        desired_status: "DRAFT",
      });
    } catch (e1) {
      try {
        await api.put(`/service-management/supplier-service-requests/${id}/status`, { status: "DRAFT" });
      } catch {}
    }
    toast.success("Approval reversed");
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: "DRAFT", forwarded_to_username: null } : x)),
    );
    try { await loadData(); } catch {}
  };

  const cancelDoc = async (id) => {
    if (!window.confirm("Cancel this requisition?")) return;
    try {
      await api.put(`/service-management/supplier-service-requests/${id}/status`, { status: "CANCELLED" });
      toast.success("Supplier Service Request cancelled");
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: "CANCELLED" } : x)));
      try { await loadData(); } catch {}
    } catch (e) {
      toast.error(e?.response?.data?.message || "Unable to cancel requisition");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600">
            ← Back to Service Management
          </button>
          <h1 className="text-2xl font-bold mt-2">Purchase Supplier Service Requests</h1>
          <p className="text-sm text-slate-600">Request items for purchase or services to be rendered</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/service-management/supplier-service-requests/new")}>
          + New Supplier Service Request
        </button>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Status</label>
              <select className="input h-9 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">All</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="FULFILLED">Fulfilled</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Search</label>
              <input
                className="input h-9 text-sm w-full"
                placeholder="Search by requisition no, department, requested by"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr>
                <SortableHeader label="Req. No" sortKey="requisition_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Date" sortKey="requisition_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Type" sortKey="requisition_type" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Department" sortKey="department" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Requested By" sortKey="requested_by" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Priority" sortKey="priority" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Est. Cost" sortKey="total_estimated_cost" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <th className="text-right whitespace-nowrap">Actions</th>
                <SortableHeader label="Created By" sortKey="created_by_username" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-slate-500 whitespace-nowrap">
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-red-600 whitespace-nowrap">
                    {error}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-slate-500 whitespace-nowrap">
                    No requisitions found
                  </td>
                </tr>
              ) : (
                sortedFiltered.map((r) => {
                  const nrStatus = normalizeStatus(r.status);
                  const autoApproved = workflowDisabled && nrStatus !== "CANCELLED" && nrStatus !== "REVERSED";
                  const displayStatus = autoApproved ? "APPROVED" : nrStatus;
                  return (
                  <tr key={r.id}>
                    <td className="font-mono text-sm text-brand whitespace-nowrap">{r.requisition_no}</td>
                    <td className="text-sm whitespace-nowrap">{String(r.requisition_date || "").slice(0, 10)}</td>
                    <td className="text-xs whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.requisition_type === "SERVICE"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {r.requisition_type}
                      </span>
                    </td>
                    <td className="text-sm whitespace-nowrap">{r.department || "-"}</td>
                    <td className="text-sm whitespace-nowrap">{r.requested_by || "-"}</td>
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase">
                        {r.priority || "-"}
                      </span>
                    </td>
                    <td className="text-right font-mono text-sm whitespace-nowrap">
                      {Number(r.total_estimated_cost || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={`badge ${getStatusBadge(displayStatus)}`}>{statusLabel(displayStatus)}</span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="min-w-[80px]">
                          <button
                            type="button"
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                            onClick={() => navigate(`/service-management/supplier-service-requests/${r.id}`)}
                          >
                            View
                          </button>
                        </div>

                        {/* Slot 2: Edit + Forward */}
                        <div className="min-w-[220px]">
                          <div className="flex items-center gap-2">
                            {["DRAFT", "REJECTED"].includes(displayStatus) ? (
                              <Link
                                to={`/service-management/supplier-service-requests/${r.id}/edit`}
                                className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                              >
                                Edit
                              </Link>
                            ) : (
                              <div className="h-9" />
                            )}
                            {displayStatus === "APPROVED" ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">
                                  Approved
                                </span>
                                {!autoApproved && canReverseApproval() && (
                                  <button
                                    type="button"
                                    className="list-approval-reverse-btn"
                                    onClick={() => reverseApproval(r.id)}
                                  >
                                    Reverse
                                  </button>
                                )}
                              </div>
                            ) : r.forwarded_to_username || displayStatus === "PENDING_APPROVAL" ? (
                              <PendingApprovalTooltip documentType="SERVICE_REQUEST" documentId={r.id}><span className="list-approval-forwarded-pill">
                                Forwarded to {r.forwarded_to_username || "Approver"}
                              </span></PendingApprovalTooltip>
                            ) : ["DRAFT", "REJECTED"].includes(displayStatus) ? (
                              <button
                                type="button"
                                className="list-approval-forward-btn"
                                onClick={() => openForwardModal(r)}
                                disabled={workflowDisabled}
                              >
                                Forward for Approval
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {/* Slot 3: Print */}
                        <div className="min-w-[80px]">
                          <ListPrintIconButton
                            onClick={() => printDocument(api, "general-requisition", r.id, toast)}
                          />
                        </div>

                        {/* Slot 4: PDF */}
                        <div className="min-w-[80px]">
                          <ListPdfIconButton
                            onClick={() => downloadDocumentPdf(api, "general-requisition", r.id, `GenReq-${r.requisition_no || r.id}.pdf`, toast)}
                          />
                        </div>

                        {/* Slot 5: Attachments */}
                        <div className="min-w-[80px]">
                          <ListAttachmentIconButton
                            onClick={() => {
                              setActiveDocId(r.id);
                              setShowAttach(true);
                            }}
                          />
                        </div>

                        {/* Slot 6: (reserved) */}
                        <div className="min-w-[80px]" />

                        {/* Slot 7: exceptional cancel — fixed cell */}
                        <div className="min-w-[80px]">
                          {(hasExceptional("PURCHASE.GENERAL_REQUISITION.CANCEL") ||
                            exCancelAllowed) &&
                          !["CANCELLED", "FULFILLED", "APPROVED"].includes(
                            displayStatus,
                          ) ? (
                            <button
                              type="button"
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-white bg-[#990000] rounded-lg hover:bg-[#770000] transition-colors h-9"
                              onClick={() => cancelDoc(r.id)}
                            >
                              Cancel
                            </button>
                          ) : (
                            <div className="w-full h-9" aria-hidden />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{r.created_by_username || r.created_by_name || "-"}</td>
                    <td className="whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForwardModal ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedDoc(null);
                    setForwardComments("");
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Document No: <span className="font-semibold">{selectedDoc?.requisition_no || "-"}</span>
              </div>
              <div className="text-sm text-slate-700">
                Workflow:{" "}
                <span className="font-semibold">
                  {candidateWorkflow
                    ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})`
                    : "None (inactive)"}
                </span>
              </div>
              <div>{wfLoading ? <div className="text-sm">Loading workflow...</div> : null}</div>
              <div>{wfError ? <div className="text-sm text-red-600">{wfError}</div> : null}</div>
              <div className="text-sm">
                <div className="font-medium">Target Approver</div>
                {(() => {
                  const hasSteps = Array.isArray(workflowSteps) && workflowSteps.length > 0;
                  const first = hasSteps ? workflowSteps[0] : null;
                  const opts = first
                    ? Array.isArray(first.approvers) && first.approvers.length
                      ? first.approvers.map((u) => ({
                          id: u.id,
                          name: u.username,
                        }))
                      : first.approver_user_id
                      ? [
                          {
                            id: first.approver_user_id,
                            name: first.approver_name || String(first.approver_user_id),
                          },
                        ]
                      : []
                    : [];
                  return opts.length > 0 ? (
                    <div className="mt-1">
                      <select
                        className="input w-full"
                        value={targetApproverId || ""}
                        onChange={(e) => setTargetApproverId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Select target approver</option>
                        {opts.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(firstApprover.approvalLimit).toLocaleString()}`
                                : ""
                            }`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      {candidateWorkflow
                        ? "No approver found in workflow definition"
                        : "No active workflow; default behavior will apply"}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedDoc(null);
                    setForwardComments("");
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
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardDocument}
                disabled={
                  submittingForward ||
                  !selectedDoc ||
                  (Array.isArray(workflowSteps) &&
                    workflowSteps.length > 0 &&
                    candidateWorkflow &&
                    !targetApproverId)
                }
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setActiveDocId(null);
        }}
        docType="general-requisition"
        docId={activeDocId}
      />
    </div>
  );
}
