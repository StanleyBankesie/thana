/**
 * @fileoverview PurchaseReturnList component.
 * Provides functionality for PurchaseReturnList.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Search } from "lucide-react";
import { filterAndSort } from "@/utils/searchUtils.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import ReverseApprovalButton from "../../../../components/ReverseApprovalButton.jsx";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PurchaseReturnList() {
  const [viewMode, setViewMode] = useViewMode();
  const { canPerformAction } = usePermission();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [submittingForward, setSubmittingForward] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkflowFlags() {
      try {
        const res = await api.get("/workflows");
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        if (cancelled) return;
        setWorkflowsCache(list);
        const route = "/inventory/purchase-returns";
        const normalize = (s) =>
          String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
        const matching = list.filter(
          (w) =>
            String(w.document_route) === route ||
            normalize(w.document_type) === "PURCHASE_RETURN",
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
              normalize(w.document_type) === "PURCHASE_RETURN",
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

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    api.get("/purchase/returns")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load purchase returns");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    function onWorkflowStatus(e) {
      try {
        const d = e.detail || {};
        const id = Number(d.documentId || d.document_id);
        const status = String(d.status || "").toUpperCase();
        if (!id || !status) return;
        setItems((prev) =>
          prev.map((r) =>
            Number(r.id) === id
              ? { ...r, status, ...(status === "DRAFT" ? { forwarded_to_username: null } : {}) }
              : r,
          ),
        );
      } catch {}
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () => window.removeEventListener("omni.workflow.status", onWorkflowStatus);
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, {
      query: searchTerm,
      getKeys: (r) => [r.return_no, r.supplier_name],
    });
  }, [items, searchTerm]);

  const { sorted: sortedFiltered, sortKey, sortDir, toggle } = useSort(filtered, "created_at", "desc");

  const workflowDisabled = hasInactiveWorkflow && !candidateWorkflow;

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((r) => r.status === "PENDING" || r.status === "PENDING_APPROVAL").length;
    const approved = items.filter((r) => r.status === "APPROVED" || r.status === "POSTED").length;
    const draft = items.filter((r) => r.status === "DRAFT").length;
    return { total, pending, approved, draft };
  }, [items]);

  const computeCandidate = async () => {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
                    setForwardComments("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/inventory/purchase-returns";
    const normalize = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const matching = workflowsCache.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "PURCHASE_RETURN",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "PURCHASE_RETURN",
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
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
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
    const route = "/inventory/purchase-returns";
    const normalize = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const matching = items.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "PURCHASE_RETURN",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      items.find(
        (w) =>
          Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "PURCHASE_RETURN",
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
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  const openForwardModal = async (doc) => {
    setSelectedDoc(doc);
    setShowForwardModal(true);
    setWfError("");
                    setForwardComments("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(list);
        await computeCandidateFromList(list);
      } catch (e) {
        setWfError(e?.response?.data?.message || "Failed to load workflows");
      } finally {
        setWfLoading(false);
      }
    } else {
      await computeCandidate();
    }
  };

  const forwardDocument = async () => {
    if (!selectedDoc) return;
    setSubmittingForward(true);
    setWfError("");
    let optimisticApprover = null;
    try {
      const first = Array.isArray(workflowSteps) && workflowSteps.length ? workflowSteps[0] : null;
      const opts = first
        ? Array.isArray(first.approvers) && first.approvers.length
          ? first.approvers.map((u) => ({ id: u.id, name: u.username }))
          : first.approver_user_id
            ? [{ id: first.approver_user_id, name: first.approver_name || String(first.approver_user_id) }]
            : []
        : [];
      if (targetApproverId && opts.length) {
        const hit = opts.find((u) => Number(u.id) === Number(targetApproverId));
        optimisticApprover = hit ? hit.name : null;
      }
    } catch {}
    setItems((prev) =>
      prev.map((r) =>
        r.id === selectedDoc.id
          ? { ...r, status: "PENDING", forwarded_to_username: optimisticApprover || r.forwarded_to_username || "Approver" }
          : r,
      ),
    );
    setShowForwardModal(false);
    setSelectedDoc(null);
    try {
      const res = await api.post(`/purchase/returns/${selectedDoc.id}/submit`, {
        amount: Number(selectedDoc.total_amount || 0) || null,
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
        comments: forwardComments,
        });
      const newStatus = res?.data?.status || "PENDING";
      let approverName = null;
      try {
        const first = Array.isArray(workflowSteps) && workflowSteps.length ? workflowSteps[0] : null;
        const opts = first
          ? Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers.map((u) => ({ id: u.id, name: u.username }))
            : first.approver_user_id
              ? [{ id: first.approver_user_id, name: first.approver_name || String(first.approver_user_id) }]
              : []
          : [];
        if (targetApproverId && opts.length) {
          const hit = opts.find((u) => Number(u.id) === Number(targetApproverId));
          approverName = hit ? hit.name : null;
        }
      } catch {}
      setItems((prev) =>
        prev.map((r) =>
          r.id === selectedDoc.id
            ? { ...r, status: newStatus, forwarded_to_username: approverName || r.forwarded_to_username || "Approver" }
            : r,
        ),
      );
      try { toast.success("Purchase return forwarded for approval"); } catch {}
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to forward for approval");
    } finally {
      setSubmittingForward(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg p-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>↩️</span> Purchase Returns
              </h1>
              <p className="text-sm text-brand-100 mt-1">
                Process supplier returns
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/purchase" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/purchase/purchase-returns/new" className="btn btn-primary">
                New Purchase Return
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">Total Returns</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
            </div>
            <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">Draft</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.draft}</div>
            </div>
            <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">Pending</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </div>
            <div className="p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">Approved</div>
              <div className="text-2xl font-bold text-emerald-600">{stats.approved}</div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  className="input pl-10"
                  placeholder="Search by return no or supplier"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading purchase returns...</p>
            </div>
          ) : sortedFiltered.length === 0 ? (
            <div className="text-center py-12 text-slate-600">No purchase returns found</div>
          ) : (
            
                <>
<div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
              <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
                <thead>
                  <tr>
                    <SortableHeader label="Return No" sortKey="return_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Return Date" sortKey="return_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Supplier" sortKey="supplier_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Amount" sortKey="total_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                    <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <th className="text-right">Actions</th>
                    <SortableHeader label="Created By" sortKey="created_by_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered.map((r) => {
                    const autoApproved =
                      workflowDisabled &&
                      r.status !== "CANCELLED" &&
                      r.status !== "REVERSED";
                    const displayStatus = autoApproved
                      ? "APPROVED"
                      : r.status || "DRAFT";
                    return (
                    <tr key={r.id}>
                      <td className="font-medium">{r.return_no}</td>
                      <td>{r.return_date ? new Date(r.return_date).toLocaleDateString() : "-"}</td>
                      <td>{r.supplier_name || "-"}</td>
                      <td className="text-right">{Number(r.total_amount || 0).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${
                          displayStatus === "APPROVED" || displayStatus === "POSTED"
                            ? "badge-success"
                            : displayStatus === "PENDING" || displayStatus === "PENDING_APPROVAL" || displayStatus === "SUBMITTED"
                              ? "badge-warning"
                              : displayStatus === "CANCELLED"
                                ? "badge-error"
                                : "badge-info"
                        }`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <div className="min-w-[80px]">
                            {canPerformAction("inventory:purchase-returns", "view") ? (
                              <Link
                                to={`/purchase/purchase-returns/${r.id}?mode=view`}
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                              >
                                View
                              </Link>
                            ) : <div className="w-full h-9" />}
                          </div>
                          <div className="min-w-[160px]">
                            <div className="list-approval-slot">
                              {displayStatus === "APPROVED" || displayStatus === "POSTED" ? (
                                <div className="flex items-center gap-2">
                                  <span className="list-approval-approved-pill">Approved</span>
                                  {!autoApproved && (displayStatus === "APPROVED" || displayStatus === "POSTED") && (
                                    <ReverseApprovalButton
                                      docType="PURCHASE_RETURN"
                                      docId={r.id}
                                      className="list-approval-reverse-btn"
                                      onDone={() =>
                                        setItems((prev) =>
                                          prev.map((x) =>
                                            x.id === r.id
                                              ? { ...x, status: "REVERSED", forwarded_to_username: null }
                                              : x,
                                          ),
                                        )
                                      }
                                    >
                                      Reverse Approval
                                    </ReverseApprovalButton>
                                  )}
                                </div>
                              ) : r.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(r.status || "").toUpperCase()) ? (
                                <span className="list-approval-forwarded-pill" title="Assigned approver">
                                  Forwarded to {r.forwarded_to_username}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openForwardModal(r)}
                                  className="list-approval-forward-btn"
                                  disabled={
                                    submittingForward ||
                                    displayStatus === "PENDING" ||
                                    displayStatus === "PENDING_APPROVAL" ||
                                    displayStatus === "SUBMITTED" ||
                                    displayStatus === "CANCELLED" ||
                                    workflowDisabled
                                  }
                                >
                                  {submittingForward ? "Forwarding..." : "Forward for Approval"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{r.created_by_name || "-"}</td>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          
</>
)}
        </div>
      </div>

      {showForwardModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w/full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => { setShowForwardModal(false); setSelectedDoc(null); setCandidateWorkflow(null); setFirstApprover(null); setWfError("");
                    setForwardComments(""); }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Purchase Return:{" "}
                <span className="font-semibold">{selectedDoc?.return_no || `#${selectedDoc?.id}`}</span>
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
                {wfLoading ? <div className="text-sm">Loading workflow...</div> : null}
                {wfError ? <div className="text-sm text-red-600">{wfError}</div> : null}
              </div>
              <div className="text-sm">
                <div className="font-medium">Target Approver</div>
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
                    <div className="mt-1">
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
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${firstApprover.approvalLimit != null ? ` • Limit: ${Number(firstApprover.approvalLimit).toLocaleString()}` : ""}`
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
                onClick={() => { setShowForwardModal(false); setSelectedDoc(null); setCandidateWorkflow(null); setFirstApprover(null); setWfError("");
                    setForwardComments(""); }}
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
    </div>
  );
}

