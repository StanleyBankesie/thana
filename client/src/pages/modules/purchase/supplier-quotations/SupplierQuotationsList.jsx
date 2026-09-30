/**
 * @fileoverview SupplierQuotationsList component.
 * Provides functionality for SupplierQuotationsList.
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { toast } from "react-toastify";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";
import useSort from "../../../../hooks/useSort.js";
import SortableHeader from "../../../../components/SortableHeader.jsx";
import { X } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SupplierQuotationsList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { canPerformAction } = usePermission();
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  // Workflow states
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedQuot, setSelectedQuot] = useState(null);
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

  const fetchQuotations = useCallback(async (currentPage, currentStatus) => {
    setLoading(true);
    setError("");
    try {
      let url = `/purchase/supplier-quotations?page=${currentPage}&limit=50`;
      if (currentStatus !== "ALL") {
        url += `&status=${currentStatus}`;
      }
      const res = await api.get(url);
      setQuotations(Array.isArray(res.data?.items) ? res.data.items : []);
      if (res.data?.pagination) {
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalCount(res.data.pagination.total || 0);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load supplier quotations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotations(page, statusFilter);
  }, [page, statusFilter, fetchQuotations]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    loadWorkflows();
  }, []);

  useEffect(() => {
    function onWorkflowStatus(e) {
      try {
        const d = e.detail || {};
        const id = Number(d.documentId || d.document_id);
        const status = d.status;
        if (!id || !status) return;
        setQuotations((prev) =>
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

  const loadWorkflows = async () => {
    try {
      const res = await api.get("/workflows");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setWorkflowsCache(items);
      const route = "/purchase/supplier-quotations";
      const normalize = (s) =>
        String(s || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "_");
      const chosen =
        items.find(
          (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
        ) ||
        items.find(
          (w) =>
            Number(w.is_active) === 1 &&
            normalize(w.document_type) === "SUPPLIER_QUOTATION",
        ) ||
        null;
      setCandidateWorkflow(chosen);
      setHasInactiveWorkflow(
        !chosen && items.some((w) => normalize(w.document_type) === "SUPPLIER_QUOTATION" && Number(w.is_active) === 0),
      );
    } catch {
      setCandidateWorkflow(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      DRAFT: "badge-neutral",
      SUBMITTED: "badge-info",
      RECEIVED: "badge-info",
      UNDER_REVIEW: "badge-warning",
      ACCEPTED: "badge-success",
      REJECTED: "badge-error",
      APPROVED: "badge-success",
      PENDING_APPROVAL: "badge-warning",
    };
    return statusConfig[status] || "badge-info";
  };

  const filteredQuotations = useMemo(() => {
    const base = quotations;
    if (!searchTerm.trim()) return base;
    return filterAndSort(base, {
      query: searchTerm,
      getKeys: (q) => [q.quotation_no, q.supplier_name, q.rfq_no],
    });
  }, [quotations, searchTerm]);

  const { sortKey, sortDir, toggle } = useSort(filteredQuotations, "created_at", "desc");

  const workflowDisabled = hasInactiveWorkflow && !candidateWorkflow;

  async function printQuotation(id) {
    try {
      const resp = await api.post(
        `/documents/supplier-quotation/${id}/render`,
        { format: "html", feature_name: "supplier-quotation" },
        { headers: { "Content-Type": "application/json" } },
      );
      const html = typeof resp.data === "string" ? resp.data : String(resp.data || "");
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document || iframe.contentDocument || null;
      if (!doc) { document.body.removeChild(iframe); return; }
      doc.open();
      const patchCss = `<style>@media print{img{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
      doc.write(patchCss + html);
      doc.close();
      const win = iframe.contentWindow || window;
      const doPrint = () => {
        win.focus();
        try { win.print(); } catch {}
        setTimeout(() => { document.body.removeChild(iframe); }, 100);
      };
      setTimeout(doPrint, 200);
    } catch {}
  }

  async function downloadQuotationPdf(id) {
    try {
      const resp = await api.post(
        `/documents/supplier-quotation/${id}/render`,
        { format: "html", feature_name: "supplier-quotation" },
        { headers: { "Content-Type": "application/json" } },
      );
      const html = typeof resp.data === "string" ? resp.data : String(resp.data || "");
      const { renderHtmlToPdf } = await import("@/utils/pdfUtils.js");
      await renderHtmlToPdf(html, `supplier-quotation-${id}.pdf`);
    } catch (err) {
      console.error("PDF Download Error:", err);
      toast.error(err?.response?.data?.message || "Failed to download PDF");
    }
  }

  // Workflow functions
  const canForward = (status) => {
    const s = String(status || "").toUpperCase();
    return s === "DRAFT" || s === "SUBMITTED" || s === "REJECTED";
  };

  const openForwardModal = async (quot) => {
    setSelectedQuot(quot);
    setShowForwardModal(true);
    setWfError("");
                    setForwardComments("");
    setTargetApproverId("");
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
    const route = "/purchase/supplier-quotations";
    const normalize = (s) =>
      String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const matching = workflowsCache.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "SUPPLIER_QUOTATION",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "SUPPLIER_QUOTATION",
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
              step_id: first.id || first.step_id,
              name: first.step_name || first.name || "First Approver",
              approvers: Array.isArray(first.approvers) ? first.approvers : [],
            }
          : null,
      );
      const defaultApprover =
        Array.isArray(first?.approvers) && first.approvers.length
          ? first.approvers[0]
          : null;
      if (defaultApprover) {
        setTargetApproverId(String(defaultApprover.user_id || ""));
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
    const route = "/purchase/supplier-quotations";
    const normalize = (s) =>
      String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const matching = items.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "SUPPLIER_QUOTATION",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "SUPPLIER_QUOTATION",
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
              step_id: first.id || first.step_id,
              name: first.step_name || first.name || "First Approver",
              approvers: Array.isArray(first.approvers) ? first.approvers : [],
            }
          : null,
      );
      const defaultApprover =
        Array.isArray(first?.approvers) && first.approvers.length
          ? first.approvers[0]
          : null;
      if (defaultApprover) {
        setTargetApproverId(String(defaultApprover.user_id || ""));
      }
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  const submitForward = async () => {
    if (!selectedQuot || !candidateWorkflow) return;
    setSubmittingForward(true);
    let optimisticApprover = null;
    try {
      const first =
        Array.isArray(workflowSteps) && workflowSteps.length
          ? workflowSteps[0]
          : null;
      const opts = first
        ? Array.isArray(first.approvers) && first.approvers.length
          ? first.approvers
          : []
        : [];
      if (targetApproverId) {
        const hit = opts.find(
          (a) => String(a.user_id) === String(targetApproverId),
        );
        if (hit) optimisticApprover = hit.username || hit.name || "Approver";
      }
      if (!optimisticApprover && opts.length) {
        optimisticApprover = opts[0].username || opts[0].name || "Approver";
      }
    } catch {}
    setQuotations((prev) =>
      prev.map((r) =>
        Number(r.id) === Number(selectedQuot.id)
          ? {
              ...r,
              status: "PENDING_APPROVAL",
              forwarded_to_username:
                optimisticApprover || r.forwarded_to_username || "Approver",
            }
          : r,
      ),
    );
    try {
      const resp = await api.post(
        `/purchase/supplier-quotations/${selectedQuot.id}/submit`,
        {
          amount: null,
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
        comments: forwardComments,
        },
      );
      toast.success(resp.data?.message || "Forwarded for approval");
      const newStatus = resp.data?.status || "PENDING_APPROVAL";
      let approverName = null;
      try {
        const first =
          Array.isArray(workflowSteps) && workflowSteps.length
            ? workflowSteps[0]
            : null;
        const opts = first
          ? Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers
            : []
          : [];
        const hit = targetApproverId
          ? opts.find((a) => String(a.user_id) === String(targetApproverId))
          : opts[0] || null;
        approverName = hit?.username || hit?.name || null;
      } catch {}
      setQuotations((prev) =>
        prev.map((r) =>
          Number(r.id) === Number(selectedQuot.id)
            ? {
                ...r,
                status: newStatus,
                forwarded_to_username:
                  approverName || r.forwarded_to_username || "Approver",
              }
            : r,
        ),
      );
      setShowForwardModal(false);
      setSelectedQuot(null);
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to forward for approval");
      setQuotations((prev) =>
        prev.map((r) =>
          Number(r.id) === Number(selectedQuot.id)
            ? { ...r, status: selectedQuot.status }
            : r,
        ),
      );
    } finally {
      setSubmittingForward(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Supplier Quotations
          </h1>
          <p className="text-sm mt-1">Receive and manage supplier quotations</p>
        </div>
        <div className="flex gap-2 items-center">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          <Link to="/purchase?section=Procurement" className="btn btn-secondary">
            Return to Menu
          </Link>
          {canPerformAction("purchase:supplier-quotations", "create") && (
            <Link
              to="/purchase/supplier-quotations/new"
              className="btn-success"
            >
              + New Quotation
            </Link>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by quotation no, supplier, or RFQ no..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="RECEIVED">Received</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr>
                <SortableHeader label="Quotation No" sortKey="quotation_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Date" sortKey="quotation_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Supplier" sortKey="supplier_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="RFQ No" sortKey="rfq_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Valid Until" sortKey="valid_until" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Total Amount" sortKey="total_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <th className="text-right">Actions</th>
                <SortableHeader label="Created By" sortKey="created_by_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="11"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="11" className="text-center py-8 text-red-600">
                    {error}
                  </td>
                </tr>
              ) : null}
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td
                    colSpan="11"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    No quotations found
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((quotation) => (
                  <tr key={quotation.id}>
                    <td className="font-medium">{quotation.quotation_no}</td>
                    <td>
                      {new Date(quotation.quotation_date).toLocaleDateString()}
                    </td>
                    <td>{quotation.supplier_name}</td>
                    <td>{quotation.rfq_no}</td>
                    <td>
                      {quotation.valid_until
                        ? new Date(quotation.valid_until).toLocaleDateString()
                        : ""}
                    </td>
                    <td className="text-right font-medium">
                      {quotation.total_amount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <span
                        className={`badge ${getStatusBadge(quotation.status)}`}
                      >
                        {quotation.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <div className="min-w-[80px]">
                          <Link
                            to={`/purchase/supplier-quotations/${quotation.id}`}
                            className={`w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9 ${
                              !canPerformAction(
                                "purchase:supplier-quotations",
                                "view",
                              )
                                ? "invisible pointer-events-none"
                                : ""
                            }`}
                          >
                            View
                          </Link>
                        </div>
                        <div className="min-w-[80px]">
                          <Link
                            to={`/purchase/supplier-quotations/${quotation.id}/edit`}
                            className={`w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9 ${
                              !canPerformAction(
                                "purchase:supplier-quotations",
                                "edit",
                              )
                                ? "invisible pointer-events-none"
                                : ""
                            }`}
                          >
                            Edit
                          </Link>
                        </div>
                        <div className="min-w-[80px]">
                          <ListPrintIconButton onClick={() => printQuotation(quotation.id)} />
                        </div>
                        <div className="min-w-[80px]">
                          <ListPdfIconButton onClick={() => downloadQuotationPdf(quotation.id)} />
                        </div>
                        <div className="w-9">
                          <ListAttachmentIconButton
                            disabled={
                              !canPerformAction(
                                "purchase:supplier-quotations",
                                "view",
                              )
                            }
                            onClick={() => {
                              setActiveDocId(quotation.id);
                              setShowAttach(true);
                            }}
                          />
                        </div>
                        {/* Slot: Workflow / Status */}
                        <div className="min-w-[160px]">
                          <div className="list-approval-slot">
                            {workflowDisabled && quotation.status !== "ACCEPTED" && quotation.status !== "APPROVED" ? (
                              <span className="list-approval-approved-pill">Approved</span>
                            ) : quotation.status === "ACCEPTED" || quotation.status === "APPROVED" ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">
                                  {quotation.status === "APPROVED" ? "Approved" : "Accepted"}
                                </span>
                              </div>
                            ) : quotation.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(quotation.status || "").toUpperCase()) ? (
                              <span className="list-approval-forwarded-pill">
                                Forwarded to {quotation.forwarded_to_username}
                              </span>
                            ) : canForward(quotation.status) && candidateWorkflow ? (
                              <button
                                type="button"
                                className="list-approval-forward-btn"
                                onClick={() => openForwardModal(quotation)}
                              >
                                Forward for Approval
                              </button>
                            ) : (
                              <div className="w-full h-9" />
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{quotation.created_by_name || "-"}</td>
                    <td>
                      {quotation.created_at
                        ? new Date(quotation.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 p-4 bg-base-100 rounded-lg shadow-sm border border-base-200">
            <span className="text-sm text-base-content/70">
              Showing page {page} of {totalPages}
              {totalCount > 0 && ` (${totalCount} total quotations)`}
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
      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setActiveDocId(null);
        }}
        docType="supplier-quotation"
        docId={activeDocId}
        readOnly={!canPerformAction("purchase:supplier-quotations", "edit")}
      />

      {/* Forward for Approval Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedQuot(null);
                  setWfError("");
                    setForwardComments("");
                }}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {wfLoading ? (
                <div className="text-center py-4 text-gray-500">Loading workflows...</div>
              ) : wfError ? (
                <div className="text-red-600 text-sm">{wfError}</div>
              ) : (
                <>
                  {hasInactiveWorkflow && !candidateWorkflow && (
                    <div className="text-amber-600 text-sm">
                      No active workflow found for supplier quotations. Please configure a workflow.
                    </div>
                  )}
                  {candidateWorkflow && (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">
                        Workflow: <span className="font-medium">{candidateWorkflow.name}</span>
                      </div>
                      {firstApprover && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Approver
                          </label>
                          {firstApprover.approvers && firstApprover.approvers.length > 1 ? (
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                              value={targetApproverId}
                              onChange={(e) => setTargetApproverId(e.target.value)}
                            >
                              <option value="">Select Approver</option>
                              {firstApprover.approvers.map((a) => (
                                <option key={a.user_id} value={a.user_id}>
                                  {a.username || a.name || `User ${a.user_id}`}
                                </option>
                              ))}
                            </select>
                          ) : firstApprover.approvers && firstApprover.approvers.length === 1 ? (
                            <div className="text-sm text-gray-900 py-2">
                              {firstApprover.approvers[0].username || firstApprover.approvers[0].name}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 py-2">
                              No specific approver assigned
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
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
              <div className="p-4 border-t flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedQuot(null);
                  setWfError("");
                    setForwardComments("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-white rounded-lg hover:opacity-90"
                style={{ backgroundColor: "#0E3646" }}
                onClick={submitForward}
                disabled={!candidateWorkflow || submittingForward}
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
