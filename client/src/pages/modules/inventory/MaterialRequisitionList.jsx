/**
 * @fileoverview MaterialRequisitionList component.
 * Provides functionality for MaterialRequisitionList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { api } from "../../../api/client";
import { toast } from "react-toastify";
import { usePermission } from "../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
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
export default function MaterialRequisitionList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const { canReverseApproval, hasExceptional } = usePermission();
  const [exCancelAllowed, setExCancelAllowed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requisitions, setRequisitions] = useState([]);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  const fetchRequisitions = async (currentPage) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/inventory/material-requisitions", {
        params: { page: currentPage, limit: 50 },
      });
      const arr = Array.isArray(res.data?.items) ? res.data.items : [];
      setRequisitions(arr);
      if (res.data?.pagination) {
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalCount(res.data.pagination.total || 0);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load material requisitions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions(page);
  }, [page]);

  useEffect(() => {
    const ref = location.state?.highlightRef;
    const hid = location.state?.highlightId;
    const refresh = location.state?.refresh;
    if (!ref && !hid && !refresh) return;
    fetchRequisitions(1);
  }, [
    location.state?.highlightRef,
    location.state?.highlightId,
    location.state?.refresh,
  ]);
  useEffect(() => {
    function onWorkflowStatus(e) {
      try {
        const d = e.detail || {};
        const id = Number(d.documentId || d.document_id);
        const status = String(d.status || "").toUpperCase();
        if (!id || !status) return;
        setRequisitions((prev) =>
          prev.map((r) =>
            Number(r.id) === id
              ? {
                  ...r,
                  status,
                  ...(status === "DRAFT"
                    ? { forwarded_to_username: null }
                    : {}),
                }
              : r,
          ),
        );
      } catch {}
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () =>
      window.removeEventListener("omni.workflow.status", onWorkflowStatus);
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function checkExceptional() {
      try {
        const me = await api.get("/admin/me");
        const uid = Number(me?.data?.user?.id || me?.data?.user?.sub || 0);
        if (!uid || cancelled) return;
        const resp = await api.get(
          `/admin/users/${uid}/exceptional-permissions`,
        );
        const items = Array.isArray(resp?.data?.data?.items)
          ? resp.data.data.items
          : Array.isArray(resp?.data?.items)
            ? resp.data.items
            : [];
        const allowed = items.some((p) => {
          const effect = String(p.effect || "").toUpperCase();
          const active = Number(p.is_active || p.isActive) === 1;
          const code = String(
            p.permission_code || p.permissionCode || "",
          ).toUpperCase();
          return (
            effect === "ALLOW" &&
            active &&
            code === "INVENTORY.MATERIAL_REQUISITION.CANCEL"
          );
        });
        if (!cancelled) {
          setExCancelAllowed(allowed);
        }
      } catch {
        if (!cancelled) {
          setExCancelAllowed(false);
        }
      }
    }
    checkExceptional();
    return () => {
      cancelled = true;
    };
  }, []);

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge-info",
      PENDING: "badge-warning",
      PENDING_APPROVAL: "badge-warning",
      SUBMITTED: "badge-warning",
      APPROVED: "badge-success",
      ISSUED: "badge-success",
      REJECTED: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  const filteredRequisitions = useMemo(() => {
    if (!searchTerm.trim()) return requisitions.slice();
    return filterAndSort(requisitions, {
      query: searchTerm,
      getKeys: (r) => [r.requisition_no, r.requested_by],
    });
  }, [requisitions, searchTerm]);

  const { sorted: sortedRequisitions, sortKey, sortDir, toggle } = useSort(filteredRequisitions, "created_at", "desc");

  const workflowDisabled = hasInactiveWorkflow && !candidateWorkflow;

  const openForwardModal = async (req) => {
    setSelectedReq(req);
    setShowForwardModal(true);
    setWfError("");
                    setForwardComments("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        setWorkflowsCache(Array.isArray(res.data?.items) ? res.data.items : []);
        await computeCandidateFromList(
          Array.isArray(res.data?.items) ? res.data.items : [],
        );
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
                    setForwardComments("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/inventory/material-requisitions";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = workflowsCache.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "MATERIAL_REQUISITION",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "MATERIAL_REQUISITION",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setHasInactiveWorkflow(!chosen && hasInactive);
    setFirstApprover(null);
    if (!chosen) return;
    if (chosen) {
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
  };

  const computeCandidateFromList = async (items) => {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
                    setForwardComments("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/inventory/material-requisitions";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = items.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "MATERIAL_REQUISITION",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "MATERIAL_REQUISITION",
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
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  };

  const forwardDocument = async () => {
    if (!selectedReq) return;
    setSubmittingForward(true);
    setWfError("");
    // Optimistic UI update
    let optimisticApprover = null;
    try {
      const first =
        Array.isArray(workflowSteps) && workflowSteps.length
          ? workflowSteps[0]
          : null;
      const opts = first
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
      if (targetApproverId && opts.length) {
        const hit = opts.find((u) => Number(u.id) === Number(targetApproverId));
        optimisticApprover = hit ? hit.name : null;
      }
    } catch {}
    setRequisitions((prev) =>
      prev.map((r) =>
        r.id === selectedReq.id
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
    setSelectedReq(null);
    try {
      const res = await api.post(
        `/inventory/material-requisitions/${selectedReq.id}/submit`,
        {
          amount: null,
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
        comments: forwardComments,
        },
      );
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      const instanceId = res?.data?.instanceId;
      let approverName = null;
      try {
        const first =
          Array.isArray(workflowSteps) && workflowSteps.length
            ? workflowSteps[0]
            : null;
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
        if (targetApproverId && opts.length) {
          const hit = opts.find(
            (u) => Number(u.id) === Number(targetApproverId),
          );
          approverName = hit ? hit.name : null;
        }
      } catch {}
      setRequisitions((prev) =>
        prev.map((r) =>
          r.id === selectedReq.id
            ? {
                ...r,
                status: newStatus,
                forwarded_to_username:
                  approverName || r.forwarded_to_username || "Approver",
              }
            : r,
        ),
      );
      try {
        toast.success("Material requisition forwarded for approval");
      } catch {}
      // Do not auto-navigate to approvals; stay on list
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to forward for approval",
      );
    } finally {
      setSubmittingForward(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Material Requisitions
              </h1>
              <p className="text-sm mt-1">
                Request materials from warehouse inventory
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/inventory/material-requisitions/new"
                className="btn-success"
              >
                + New Requisition
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {loading ? <div className="text-sm mb-4">Loading...</div> : null}
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by requisition number or requested by..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <SortableHeader label="Requisition No" sortKey="requisition_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="requisition_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Requested By" sortKey="requested_by" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Department" sortKey="department_id" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Warehouse" sortKey="warehouse_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-right">Actions</th>
                  <SortableHeader label="Created By" sortKey="created_by_username" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sortedRequisitions.map((req) => {
                  const upperStatus = String(req.status || "").toUpperCase();
                  const autoApproved = workflowDisabled && upperStatus !== "CANCELLED" && upperStatus !== "REVERSED";
                  const displayStatus = autoApproved ? "APPROVED" : upperStatus;
                  return (
                  <tr key={req.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {req.requisition_no}
                    </td>
                    <td>{String(req.requisition_date || "").slice(0, 10)}</td>
                    <td>{req.requested_by || "-"}</td>
                    <td>{req.department_id || "-"}</td>
                    <td>{req.warehouse_name || "-"}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(displayStatus)}`}>
                        {displayStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="min-w-[80px]">
                          <Link
                            to={`/inventory/material-requisitions/${req.id}?mode=view`}
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                          >
                            View
                          </Link>
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="min-w-[80px]">
                          {!['APPROVED', 'ISSUED', 'CANCELLED'].includes(displayStatus) ? (
                            <Link
                              to={`/inventory/material-requisitions/${req.id}?mode=edit`}
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                            >
                              Edit
                            </Link>
                          ) : (
                            <div className="w-full h-9" />
                          )}
                        </div>

                        {/* Slot 3: Print */}
                        <div className="min-w-[80px]">
                          <ListPrintIconButton
                            onClick={() =>
                              window.open(
                                `/inventory/material-requisitions/${req.id}?mode=view`,
                                "_blank",
                                "noopener,noreferrer",
                              )
                            }
                          />
                        </div>

                        {/* Slot 4: PDF */}
                        <div className="min-w-[80px]">
                          <ListPdfIconButton
                            onClick={() =>
                              toast.info(
                                "PDF export is not configured for material requisitions.",
                              )
                            }
                          />
                        </div>

                        {/* Slot 5: Attachments */}
                        <div className="w-9">
                          <ListAttachmentIconButton
                            onClick={() => {
                              setActiveDocId(req.id);
                              setShowAttach(true);
                            }}
                          />
                        </div>

                        {/* Slot 6: Workflow */}
                        <div className="min-w-[160px]">
                          <div className="list-approval-slot">
                            {displayStatus === "APPROVED" ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">
                                  Approved
                                </span>
                                {!autoApproved && canReverseApproval() && (
                                  <button
                                    type="button"
                                    className="list-approval-reverse-btn"
                                    onClick={async () => {
                                      try {
                                        await api.post("/workflows/reverse-by-document", { document_type: "MATERIAL_REQUISITION", document_id: req.id });
                                        toast.success("Approval reversed");
                                        setRequisitions((prev) => prev.map((x) => x.id === req.id ? { ...x, status: "RETURNED", forwarded_to_username: null } : x));
                                      } catch (e) {
                                        toast.error("Reverse approval failed");
                                      }
                                    }}
                                  >
                                    Reverse Approval
                                  </button>
                                )}
                              </div>
                            ) : req.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(req.status || "").toUpperCase()) ? (
                              <span className="list-approval-forwarded-pill">
                                Forwarded to {req.forwarded_to_username}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="list-approval-forward-btn"
                                onClick={() => openForwardModal(req)}
                                disabled={workflowDisabled}
                              >
                                Forward for Approval
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{req.created_by_username || req.created_by_name || "-"}</td>
                    <td>{req.created_at ? new Date(req.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 p-4 bg-base-100 rounded-lg shadow-sm border border-base-200">
              <span className="text-sm text-base-content/70">
                Showing page {page} of {totalPages}
                {totalCount > 0 && ` (${totalCount} total requisitions)`}
              </span>
              <div className="join">
                <button
                  className="join-item btn btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  «
                </button>
                <button className="join-item btn btn-sm">Page {page}</button>
                <button
                  className="join-item btn btn-sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showForwardModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-erp w-full max-w-4xl overflow-hidden">
              <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedReq(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setWfError("");
                    setForwardComments("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Requisition:{" "}
                <span className="font-semibold">
                  {selectedReq?.requisition_no}
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
              <div>
                {wfLoading ? (
                  <div className="text-sm">Loading workflow...</div>
                ) : null}
                {wfError ? (
                  <div className="text-sm text-red-600">{wfError}</div>
                ) : null}
              </div>
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
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${
                              firstApprover.stepName
                            }${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(
                                    firstApprover.approvalLimit,
                                  ).toLocaleString()}`
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
                  setSelectedReq(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWfError("");
                    setForwardComments("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardDocument}
                disabled={submittingForward}
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      )}
      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setActiveDocId(null);
        }}
        docType="material-requisition"
        docId={activeDocId}
      />
    </div>
  );
}
