/**
 * @fileoverview MaintenanceRequestsList component.
 * Provides functionality for MaintenanceRequestsList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Plus, Eye } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Guard } from "../../../../hooks/usePermissions";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import ReverseApprovalButton from "../../../../components/ReverseApprovalButton";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

function Badge({ value, colorMap }) {
  const v = String(value || "").toUpperCase();
  const cls = colorMap[v] || "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${cls}`}
    >
      {v}
    </span>
  );
}

const statusColors = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  OPEN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
  RETURNED: "bg-orange-100 text-orange-700",
};
const priorityColors = {
  LOW: "bg-slate-100 text-slate-600",
  NORMAL: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceRequestsList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const { canReverseApproval } = usePermission();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForwardModal, setShowForwardModal] = useState(false);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  const route = "/maintenance/maintenance-requests";
  const workflowDisabled = hasInactiveWorkflow && !candidateWorkflow;

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/maintenance/maintenance-requests");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load maintenance requests",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [location.state?.refresh]);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkflowFlags() {
      try {
        const res = await api.get("/workflows");
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        if (cancelled) return;
        setWorkflowsCache(list);
        const matching = list.filter(
          (w) =>
            String(w.document_route) === route ||
            normalize(w.document_type) === "MAINT_REQUEST",
        );
        const hasInactive = matching.some((w) => Number(w.is_active) === 0);
        const chosen =
          list.find(
            (w) =>
              Number(w.is_active) === 1 && String(w.document_route) === route,
          ) ||
          list.find(
            (w) =>
              Number(w.is_active) === 1 &&
              normalize(w.document_type) === "MAINT_REQUEST",
          ) ||
          null;
        setCandidateWorkflow(chosen || null);
        setHasInactiveWorkflow(!chosen && hasInactive);
      } catch {}
    }
    loadWorkflowFlags();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) =>
        String(r.requester_name || "")
          .toLowerCase()
          .includes(q) ||
        String(r.maintenance_type || "")
          .toLowerCase()
          .includes(q) ||
        String(r.status || "")
          .toLowerCase()
          .includes(q),
    );
  }, [items, search]);

  const normalize = (s) =>
    String(s || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

  async function computeCandidateFromList(items) {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
                    setForwardComments("");
      setHasInactiveWorkflow(false);
      return;
    }
    const matching = items.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "MAINT_REQUEST",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "MAINT_REQUEST",
      ) ||
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
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  }

  async function computeCandidate() {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
                    setForwardComments("");
      setHasInactiveWorkflow(false);
      return;
    }
    const matching = workflowsCache.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "MAINT_REQUEST",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "MAINT_REQUEST",
      ) ||
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
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  }

  async function openForwardModal(req) {
    setSelectedRequest(req);
    setShowForwardModal(true);
    setWfError("");
                    setForwardComments("");
    if (!workflowsCache) {
      setWfLoading(true);
      try {
        const res = await api.get("/workflows");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(items);
        await computeCandidateFromList(items);
      } catch (e) {
        setWfError(e?.response?.data?.message || "Failed to load workflows");
      } finally {
        setWfLoading(false);
      }
    } else {
      await computeCandidate();
    }
  }

  async function forwardForApproval() {
    if (!selectedRequest) return;
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
                    setForwardComments("");

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
        const hit = options.find(
          (u) => Number(u.id) === Number(targetApproverId),
        );
        optimisticApprover = hit ? hit.name : null;
      }
    } catch {}

    setItems((prev) =>
      prev.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              status: "PENDING_APPROVAL",
              forwarded_to_username:
                optimisticApprover || r.forwarded_to_username || "Approver",
            }
          : r,
      ),
    );
    setShowForwardModal(false);

    try {
      await api.post(
        `/maintenance/maintenance-requests/${selectedRequest.id}/submit`,
        {
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
        comments: forwardComments,
        },
      );
      toast.success("Request forwarded for approval");
      await load();
      return;
    } catch (e) {
      try {
        await api.post("/workflows/start", {
          document_type: "MAINT_REQUEST",
          document_id: selectedRequest.id,
          target_user_id: targetApproverId || null,
          comments: forwardComments || "Forwarded for Approval",
        });
        toast.success("Request forwarded for approval");
        await load();
        return;
      } catch (e2) {
        try {
          await api.put(
            `/maintenance/maintenance-requests/${selectedRequest.id}`,
            { status: "PENDING_APPROVAL" },
          );
          toast.success("Request forwarded for approval");
          await load();
          return;
        } catch (e3) {
          setWfError(
            e3?.response?.data?.message || "Failed to forward request",
          );
          await load();
        }
      }
    } finally {
      setSubmittingForward(false);
    }
  }

  return (
    <Guard moduleKey="maintenance">
      <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link to="/maintenance?section=Operations %26 Schedules" className="btn btn-secondary p-2">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">
                Maintenance Requests
              </h1>
              <p className="text-slate-500 text-sm">
                Track and manage service tickets and fault reports
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                className="input pl-10 pr-4 py-2 w-64"
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Link
              to="/maintenance/maintenance-requests/new"
              className="btn-success flex items-center gap-2"
            >
              <Plus size={20} />
              New Request
            </Link>
          </div>
        </div>

        <div className="card bg-white overflow-hidden shadow-sm">
          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Requester</th>
                  <th className="whitespace-nowrap">Department</th>
                  <th className="whitespace-nowrap">Type</th>
                  <th className="whitespace-nowrap">Priority</th>
                  <th className="whitespace-nowrap">Status</th>
                  <th className="whitespace-nowrap">Created By</th>
                  <th className="whitespace-nowrap">Created Date</th>
                  <th className="whitespace-nowrap">Approval</th>
                  <th className="text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {loading ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap"
                    >
                      Fetching Tickets...
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((r) => {
                    const upperStatus = String(r.status || "").toUpperCase();
                    const autoApproved =
                      workflowDisabled &&
                      upperStatus !== "CANCELLED" &&
                      upperStatus !== "RETURNED";
                    const displayStatus = autoApproved
                      ? "APPROVED"
                      : upperStatus || "DRAFT";
                    return (
                      <tr key={r.id} className="group">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {r.requester_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                          {r.department}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                          {r.maintenance_type}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <Badge value={r.priority} colorMap={priorityColors} />
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <Badge
                            value={displayStatus}
                            colorMap={statusColors}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {r.created_by_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {r.created_at
                            ? new Date(r.created_at).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="min-w-[160px]">
                            <div className="list-approval-slot">
                              {displayStatus === "APPROVED" ? (
                                <div className="flex items-center gap-2">
                                  <span className="list-approval-approved-pill">
                                    Approved
                                  </span>
                                  {!autoApproved && canReverseApproval() && (
                                    <ReverseApprovalButton
                                      docType="MAINT_REQUEST"
                                      docId={r.id}
                                      className="list-approval-reverse-btn"
                                      onDone={() => load()}
                                    >
                                      Reverse Approval
                                    </ReverseApprovalButton>
                                  )}
                                </div>
                              ) : displayStatus === "PENDING_APPROVAL" ? (
                                <span className="list-approval-forwarded-pill">
                                  Forwarded to{" "}
                                  {r.forwarded_to_username || "Approver"}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-white bg-brand-900 border border-transparent rounded-lg hover:bg-brand-800 transition-colors h-9"
                                  onClick={() => openForwardModal(r)}
                                  disabled={
                                    submittingForward || workflowDisabled
                                  }
                                >
                                  Forward for Approval
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                              onClick={() =>
                                navigate(
                                  `/maintenance/maintenance-requests/${r.id}?mode=view`,
                                )
                              }
                            >
                              <Eye size={14} /> View
                            </button>
                            {displayStatus !== "APPROVED" &&
                              displayStatus !== "PENDING_APPROVAL" && (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                                  onClick={() =>
                                    navigate(
                                      `/maintenance/maintenance-requests/${r.id}`,
                                    )
                                  }
                                >
                                  Edit
                                </button>
                              )}
                            <ListPrintIconButton
                              onClick={() => toast.info("Print coming soon")}
                            />
                            <ListPdfIconButton
                              onClick={() => toast.info("PDF coming soon")}
                            />
                            <ListAttachmentIconButton
                              onClick={() => {
                                setActiveDocId(r.id);
                                setShowAttach(true);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="9"
                      className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-50 whitespace-nowrap"
                    >
                      No maintenance tickets found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAttach && activeDocId && (
        <DocumentAttachmentsModal
          open={showAttach}
          onClose={() => {
            setShowAttach(false);
            setActiveDocId(null);
          }}
          docType="maintenance"
          docId={activeDocId}
        />
      )}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                type="button"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedRequest(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                    setForwardComments("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Document No:{" "}
                <span className="font-semibold">
                  {selectedRequest?.request_no || ""}
                </span>
              </div>
              <div className="text-sm text-slate-700">
                Workflow:{" "}
                <span className="font-semibold">
                  {candidateWorkflow
                    ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})`
                    : "None (inactive)"}
                </span>
              </div>
              {wfLoading && (
                <div className="text-sm text-slate-500">
                  Loading workflow...
                </div>
              )}
              {wfError && <div className="text-sm text-red-600">{wfError}</div>}
              <div className="text-sm">
                <div className="font-medium">Target Approver</div>
                {(() => {
                  const hasSteps =
                    Array.isArray(workflowSteps) && workflowSteps.length > 0;
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
                              name:
                                first.approver_name ||
                                String(first.approver_user_id),
                            },
                          ]
                        : []
                    : [];
                  return opts.length > 0 ? (
                    <div className="mt-1">
                      <select
                        className="input w-full"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">Select target approver</option>
                        {opts.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      {firstApprover && (
                        <div className="text-xs text-slate-600 mt-1">
                          Step {firstApprover.stepOrder} &bull;{" "}
                          {firstApprover.stepName}
                          {firstApprover.approvalLimit != null &&
                            ` \u2022 Limit: ${Number(firstApprover.approvalLimit).toLocaleString()}`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-600 mt-1">
                      {candidateWorkflow
                        ? "No approver found in workflow definition"
                        : "No active workflow; default behavior will apply"}
                    </div>
                  );
                })()}
              </div>
            </div>
            
                <div className="mt-4 p-4 border-t border-slate-200">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Comments (Optional)</label>
                  <textarea
                    value={forwardComments}
                    onChange={(e) => setForwardComments(e.target.value)}
                    className="w-full border-slate-300 rounded-md focus:ring-brand focus:border-brand sm:text-sm"
                    rows={3}
                    placeholder="Add any comments for the approver..."
                  />
                </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedRequest(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                    setForwardComments("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardForApproval}
                disabled={
                  submittingForward ||
                  !selectedRequest ||
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
      )}
    </Guard>
  );
}
