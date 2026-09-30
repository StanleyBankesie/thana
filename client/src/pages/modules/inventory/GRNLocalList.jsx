/**
 * @fileoverview GRNLocalList component.
 * Provides functionality for GRNLocalList.
 */

import React, { useEffect, useMemo, useState } from "react";
import PendingApprovalTooltip from "@/components/PendingApprovalTooltip.jsx";
import { Link, useLocation } from "react-router-dom";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";
import { toast } from "react-toastify";
import { printDocument, downloadDocumentPdf } from "@/utils/pdfUtils.js";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

import { api } from "api/client";
import FloatingCreateButton from "@/components/FloatingCreateButton.jsx";
import { usePermission } from "@/auth/PermissionContext.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function GRNLocalList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const { canReverseApproval, exceptionalPerms, hasExceptional } =
    usePermission();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardComments, setForwardComments] = useState("");
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const [viewDoc, setViewDoc] = useState(null);
  const [viewDetails, setViewDetails] = useState([]);
  const [viewPoNo, setViewPoNo] = useState("");
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkflowFlags() {
      try {
        const res = await api.get("/workflows");
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        if (cancelled) return;
        setWorkflowsCache(list);
        const route = "/inventory/grn-local";
        const normalize = (s) =>
          String(s || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "_");
        const matching = list.filter(
          (w) =>
            String(w.document_route) === route ||
            ["GOODS_RECEIPT", "GRN", "GOODS_RECEIPT_NOTE"].includes(
              normalize(w.document_type),
            ),
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
              ["GOODS_RECEIPT", "GRN", "GOODS_RECEIPT_NOTE"].includes(
                normalize(w.document_type),
              ),
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

  // fetchGrns is handled above
  const fetchGrns = async (currentPage) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/inventory/grn", {
        params: { grn_type: "LOCAL", page: currentPage, limit: 50 },
      });
      const arr = Array.isArray(res.data?.items) ? res.data.items : [];
      setGrns(arr);
      if (res.data?.pagination) {
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalCount(res.data.pagination.total || 0);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load GRNs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrns(page);
  }, [page]);

  useEffect(() => {
    const ref = location.state?.highlightRef;
    const hid = location.state?.highlightId;
    const refresh = location.state?.refresh;
    if (!ref && !hid && !refresh) return;
    fetchGrns(1);
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
        setGrns((prev) =>
          prev.map((g) =>
            Number(g.id) === id
              ? {
                  ...g,
                  status,
                  ...(status === "DRAFT"
                    ? { forwarded_to_username: null }
                    : {}),
                }
              : g,
          ),
        );
      } catch {}
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () =>
      window.removeEventListener("omni.workflow.status", onWorkflowStatus);
  }, []);

  const filtered = useMemo(() => {
    const base = grns.slice();
    if (!searchTerm.trim()) return base;
    return filterAndSort(base, {
      query: searchTerm,
      getKeys: (g) => [g.grn_no, g.supplier_name, g.warehouse_name, g.status],
    });
  }, [grns, searchTerm]);

  const {
    sorted: sortedGrns,
    sortKey,
    sortDir,
    toggle,
  } = useSort(filtered, "created_at", "desc");

  const workflowDisabled = hasInactiveWorkflow && !candidateWorkflow;

  const canForward = (status) => {
    const s = String(status || "").toUpperCase();
    return s !== "PENDING_APPROVAL" && s !== "APPROVED" && s !== "CANCELLED";
  };
  const openForwardModal = async (grn) => {
    setSelectedDoc(null);
    setShowForwardModal(true);
    setWfError("");
    try {
      const detail = await api.get(`/inventory/grn/${grn.id}`);
      const item = detail?.data?.item || {};
      const amountRaw = item?.invoice_amount;
      const amount =
        amountRaw === "" || amountRaw == null ? null : Number(amountRaw || 0);
      setSelectedDoc({
        id: grn.id,
        grn_no: grn.grn_no,
        invoice_amount: amount,
        status: grn.status,
      });
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to load GRN");
    }
    if (!workflowsCache) {
      try {
        setWfLoading(true);
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
  };
  const computeCandidate = async () => {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/inventory/grn-local";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = workflowsCache.filter(
      (w) =>
        String(w.document_route) === route ||
        ["GOODS_RECEIPT", "GRN", "GOODS_RECEIPT_NOTE"].includes(
          normalize(w.document_type),
        ),
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          ["GOODS_RECEIPT", "GRN", "GOODS_RECEIPT_NOTE"].includes(
            normalize(w.document_type),
          ),
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
  };
  const computeCandidateFromList = async (items) => {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/inventory/grn-local";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = items.filter(
      (w) =>
        String(w.document_route) === route ||
        ["GOODS_RECEIPT", "GRN", "GOODS_RECEIPT_NOTE"].includes(
          normalize(w.document_type),
        ),
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          ["GOODS_RECEIPT", "GRN", "GOODS_RECEIPT_NOTE"].includes(
            normalize(w.document_type),
          ),
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
  };
  const forwardForApproval = async () => {
    if (!selectedDoc) return;
    setSubmittingId(selectedDoc.id);
    setWfError("");
    setShowForwardModal(false);
    try {
      await api.post(`/inventory/grn/${selectedDoc.id}/submit`, {
        amount: selectedDoc.invoice_amount,
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
        comments: forwardComments,
        });
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
      setGrns((prev) =>
        prev.map((g) =>
          g.id === selectedDoc.id
            ? {
                ...g,
                status: "PENDING_APPROVAL",
                forwarded_to_username:
                  approverName || g.forwarded_to_username || "Approver",
              }
            : g,
        ),
      );
      try {
        toast.success("GRN forwarded for approval");
      } catch {}
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to forward for approval",
      );
    } finally {
      setSubmittingId(null);
    }
  };

  const openViewDetails = async (grn) => {
    setShowViewModal(true);
    setViewLoading(true);
    setViewError("");
    setViewDoc(null);
    setViewDetails([]);
    setViewPoNo("");
    try {
      const res = await api.get(`/inventory/grn/${grn.id}`);
      const item = res?.data?.item || {};
      const details = Array.isArray(item?.details) ? item.details : [];
      setViewDoc(item);
      setViewDetails(details);
      const poId = Number(item?.po_id || 0) || 0;
      if (poId) {
        try {
          const poRes = await api.get("/purchase/orders");
          const pos = Array.isArray(poRes?.data?.items) ? poRes.data.items : [];
          const po = pos.find((p) => Number(p.id) === poId);
          setViewPoNo(po ? po.po_no || String(po.id) : String(poId));
        } catch {
          setViewPoNo(String(poId));
        }
      }
    } catch (e) {
      setViewError(e?.response?.data?.message || "Failed to load GRN details");
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Material Receipt (GRN) - Local
              </h1>
              <p className="text-sm mt-1">Receive local purchase deliveries</p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/inventory/grn-local/new" className="btn-success">
                + New GRN
              </Link>
            </div>
          </div>
        </div>

        <div className="card-body">
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by GRN no, supplier, status..."
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
                  <SortableHeader
                    label="GRN No"
                    sortKey="grn_no"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Date"
                    sortKey="grn_date"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Supplier"
                    sortKey="supplier_name"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Warehouse"
                    sortKey="warehouse_name"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <th className="text-right">Actions</th>
                  <SortableHeader
                    label="Created By"
                    sortKey="created_by_username"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                  <SortableHeader
                    label="Created Date"
                    sortKey="created_at"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                  />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && !filtered.length ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No GRNs found
                    </td>
                  </tr>
                ) : null}

                {filtered.map((g) => (
                  <tr key={g.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {g.grn_no}
                    </td>
                    <td>
                      {g.grn_date ? String(g.grn_date).slice(0, 10) : "-"}
                    </td>
                    <td>{g.supplier_name || "-"}</td>
                    <td>{g.warehouse_name || "-"}</td>
                    <td>
                      <span className="badge badge-info">
                        {g.status || "DRAFT"}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="min-w-[80px]">
                          <Link
                            to={`/inventory/grn-local/${g.id}?mode=view`}
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                          >
                            View
                          </Link>
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="min-w-[80px]">
                          {String(g.status || "").toUpperCase() !==
                          "APPROVED" ? (
                            <Link
                              to={`/inventory/grn-local/${g.id}?mode=edit`}
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
                              printDocument(api, "grn", g.id, toast)
                            }
                          />
                        </div>

                        {/* Slot 4: PDF */}
                        <div className="min-w-[80px]">
                          <ListPdfIconButton
                            onClick={() =>
                              downloadDocumentPdf(
                                api,
                                "grn",
                                g.id,
                                `GRN-${g.grn_no || g.id}.pdf`,
                                toast,
                              )
                            }
                          />
                        </div>

                        {/* Slot 5: Attachments */}
                        <div className="w-9">
                          <ListAttachmentIconButton
                            onClick={() => {
                              setActiveDocId(g.id);
                              setShowAttach(true);
                            }}
                          />
                        </div>

                        {/* Slot 6: Workflow */}
                        <div className="min-w-[160px]">
                          <div className="list-approval-slot">
                            {workflowDisabled &&
                            String(g.status || "").toUpperCase() !==
                              "APPROVED" ? (
                              <span className="list-approval-approved-pill">
                                Approved
                              </span>
                            ) : String(g.status || "").toUpperCase() ===
                              "APPROVED" ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">
                                  Approved
                                </span>
                                {/* Slot 7: Reverse Approval */}
                                {String(g.status || "").toUpperCase() ===
                                  "APPROVED" &&
                                  typeof canReverseApproval !== "undefined" &&
                                  (canReverseApproval() ||
                                    hasExceptional("PURCHASE.GRN.REVERSE")) && (
                                    <button
                                      type="button"
                                      className="list-approval-reverse-btn"
                                      onClick={async () => {
                                        try {
                                          await api.post(
                                            "/workflows/reverse-by-document",
                                            {
                                              document_type: "GOODS_RECEIPT",
                                              document_id: g.id,
                                            },
                                          );
                                          toast.success("Approval reversed");
                                          setGrns((prev) =>
                                            prev.map((x) =>
                                              x.id === g.id
                                                ? {
                                                    ...x,
                                                    status: "RETURNED",
                                                    forwarded_to_username: null,
                                                  }
                                                : x,
                                            ),
                                          );
                                        } catch (e) {
                                          toast.error(
                                            e?.response?.data?.message ||
                                              "Reverse approval failed",
                                          );
                                        }
                                      }}
                                    >
                                      Reverse Approval
                                    </button>
                                  )}
                              </div>
                            ) : g.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(g.status || "").toUpperCase()) ? (
                              <PendingApprovalTooltip documentType="GOODS_RECEIPT" documentId={g.id}><span className="list-approval-forwarded-pill">
                                Forwarded to {g.forwarded_to_username}
                              </span></PendingApprovalTooltip>
                            ) : (
                              <button
                                type="button"
                                className="list-approval-forward-btn"
                                onClick={() => openForwardModal(g)}
                                disabled={
                                  submittingId === g.id ||
                                  !canForward(g.status) ||
                                  hasInactiveWorkflow
                                }
                              >
                                {submittingId === g.id
                                  ? "Forwarding..."
                                  : "Forward for Approval"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{g.created_by_username || g.created_by_name || "-"}</td>
                    <td>
                      {g.created_at
                        ? new Date(g.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 p-4 bg-base-100 rounded-lg shadow-sm border border-base-200">
              <span className="text-sm text-base-content/70">
                Showing page {page} of {totalPages}
                {totalCount > 0 && ` (${totalCount} total GRNs)`}
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
      {showForwardModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
              <div className="font-semibold">Forward GRN for Approval</div>
              <button
                type="button"
                onClick={() => {
                  setShowForwardModal(false);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setWfError("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Document No:{" "}
                <span className="font-semibold">{selectedDoc?.grn_no}</span>
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
              </div>
              <div>
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
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setWfError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardForApproval}
                disabled={submittingId != null}
              >
                {submittingId != null ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showViewModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-[900px] max-w-[95%]">
            <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
              <div className="font-semibold">View GRN Details</div>
              <button
                type="button"
                onClick={() => {
                  setShowViewModal(false);
                  setViewDoc(null);
                  setViewDetails([]);
                  setViewError("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-4">
              {viewLoading ? <div className="text-sm">Loading...</div> : null}
              {viewError ? (
                <div className="text-sm text-red-600">{viewError}</div>
              ) : null}
              {viewDoc ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500">GRN No</div>
                    <div className="font-semibold">{viewDoc.grn_no}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Date</div>
                    <div className="font-semibold">
                      {viewDoc.grn_date
                        ? String(viewDoc.grn_date).slice(0, 10)
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Supplier</div>
                    <div className="font-semibold">
                      {viewDoc.supplier_name || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Warehouse</div>
                    <div className="font-semibold">
                      {viewDoc.warehouse_name || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Status</div>
                    <div className="font-semibold">
                      {viewDoc.status || "DRAFT"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Purchase Order</div>
                    <div className="font-semibold">
                      {viewPoNo ||
                        (viewDoc.po_id ? String(viewDoc.po_id) : "-")}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Delivery No</div>
                    <div className="font-semibold">
                      {viewDoc.delivery_number || "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Delivery Date</div>
                    <div className="font-semibold">
                      {viewDoc.delivery_date
                        ? String(viewDoc.delivery_date).slice(0, 10)
                        : "-"}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Ordered Qty</th>
                      <th>Received Qty</th>
                      <th>Accepted Qty</th>
                      <th>UOM</th>
                      <th>Unit Price</th>
                      <th>Amount</th>
                      <th>Batch/Serial</th>
                      <th>Remarks</th>
                      <th>Created By</th>
                      <th>Created Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!viewDetails.length ? (
                      <tr>
                        <td
                          colSpan="10"
                          className="text-center py-6 text-slate-500 dark:text-slate-400"
                        >
                          No item details
                        </td>
                      </tr>
                    ) : null}
                    {viewDetails.map((d, i) => {
                      const amount =
                        d.line_amount == null || d.line_amount === ""
                          ? Number(d.qty_accepted || 0) *
                            Number(d.unit_price || 0)
                          : Number(d.line_amount || 0);
                      return (
                        <tr key={i}>
                          <td className="font-medium">{d.item_code || ""}</td>
                          <td>{d.item_name || ""}</td>
                          <td>{d.qty_ordered ?? ""}</td>
                          <td>{d.qty_received ?? ""}</td>
                          <td>{d.qty_accepted ?? ""}</td>
                          <td>{d.uom || ""}</td>
                          <td>
                            {Number(d.unit_price || 0).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </td>
                          <td>
                            {Number(amount || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td>{d.batch_serial || d.batch_number || ""}</td>
                          <td>{d.remarks || ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => {
                  setShowViewModal(false);
                  setViewDoc(null);
                  setViewDetails([]);
                  setViewError("");
                }}
              >
                Close
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
        docType="grn-local"
        docId={activeDocId}
      />
      <FloatingCreateButton
        to="/inventory/grn-local/new"
        title="New GRN (Local)"
      />
    </div>
  );
}
