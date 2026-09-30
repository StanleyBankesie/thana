/**
 * @fileoverview SupplierQuotationsList component.
 * Provides functionality for SupplierQuotationsList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import useSort from "../../../../hooks/useSort.js";
import SortableHeader from "../../../../components/SortableHeader.jsx";
import { X, Eye } from "lucide-react";
import { ListPrintIconButton, ListPdfIconButton, ListAttachmentIconButton } from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

const statusColors = { DRAFT:"bg-slate-100 text-slate-600", UNDER_REVIEW:"bg-amber-100 text-amber-700", APPROVED:"bg-green-100 text-green-700", REJECTED:"bg-red-100 text-red-600", PENDING_APPROVAL:"bg-amber-100 text-amber-700" };
function Badge({ value, colorMap }) {
  const v = String(value || "").toUpperCase();
  return <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${colorMap[v] || "bg-slate-100 text-slate-600"}`}>{v}</span>;
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SupplierQuotationsList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const { canPerformAction } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get("/maintenance/supplier-quotations").then(r => { if (mounted) setItems(Array.isArray(r.data?.items) ? r.data.items : []); })
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load"))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [location.state?.refresh]);

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

  const loadWorkflows = async () => {
    try {
      const res = await api.get("/workflows");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setWorkflowsCache(items);
      const route = "/maintenance/supplier-quotations";
      const normalize = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
      const chosen =
        items.find((w) => Number(w.is_active) === 1 && String(w.document_route) === route) ||
        items.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "SUPPLIER_QUOTATION") ||
        null;
      setCandidateWorkflow(chosen);
      setHasInactiveWorkflow(
        !chosen && items.some((w) => normalize(w.document_type) === "SUPPLIER_QUOTATION" && Number(w.is_active) === 0),
      );
    } catch {
      setCandidateWorkflow(null);
    }
  };

  const filteredBase = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r => String(r.quotation_no || "").toLowerCase().includes(q) || String(r.supplier_name || "").toLowerCase().includes(q) || String(r.status || "").toLowerCase().includes(q));
  }, [items, search]);

  const { sorted: filtered, sortKey, sortDir, toggle } = useSort(filteredBase, "created_at", "desc");

  const workflowDisabled = hasInactiveWorkflow && !candidateWorkflow;

  const canForward = (status) => {
    const s = String(status || "").toUpperCase();
    return s === "DRAFT" || s === "REJECTED";
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
        await computeCandidateFromList(Array.isArray(res.data?.items) ? res.data.items : []);
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
      setCandidateWorkflow(null); setFirstApprover(null); setWfError("");
                    setForwardComments(""); setHasInactiveWorkflow(false);
      return;
    }
    const route = "/maintenance/supplier-quotations";
    const normalize = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const matching = workflowsCache.filter((w) => String(w.document_route) === route || normalize(w.document_type) === "SUPPLIER_QUOTATION");
    const chosen =
      workflowsCache.find((w) => Number(w.is_active) === 1 && String(w.document_route) === route) ||
      workflowsCache.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "SUPPLIER_QUOTATION") ||
      null;
    setCandidateWorkflow(chosen || null);
    setHasInactiveWorkflow(!chosen && matching.some((w) => Number(w.is_active) === 0));
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(first ? { step_id: first.id || first.step_id, name: first.step_name || first.name || "First Approver", approvers: Array.isArray(first.approvers) ? first.approvers : [] } : null);
      const defaultApprover = Array.isArray(first?.approvers) && first.approvers.length ? first.approvers[0] : null;
      if (defaultApprover) setTargetApproverId(String(defaultApprover.user_id || ""));
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  const computeCandidateFromList = async (items) => {
    if (!items || !items.length) { setCandidateWorkflow(null); setFirstApprover(null); setWfError("");
                    setForwardComments(""); setHasInactiveWorkflow(false); return; }
    const route = "/maintenance/supplier-quotations";
    const normalize = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const matching = items.filter((w) => String(w.document_route) === route || normalize(w.document_type) === "SUPPLIER_QUOTATION");
    const chosen =
      items.find((w) => Number(w.is_active) === 1 && String(w.document_route) === route) ||
      items.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "SUPPLIER_QUOTATION") ||
      null;
    setCandidateWorkflow(chosen || null);
    setHasInactiveWorkflow(!chosen && matching.some((w) => Number(w.is_active) === 0));
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(first ? { step_id: first.id || first.step_id, name: first.step_name || first.name || "First Approver", approvers: Array.isArray(first.approvers) ? first.approvers : [] } : null);
      const defaultApprover = Array.isArray(first?.approvers) && first.approvers.length ? first.approvers[0] : null;
      if (defaultApprover) setTargetApproverId(String(defaultApprover.user_id || ""));
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
      const first = Array.isArray(workflowSteps) && workflowSteps.length ? workflowSteps[0] : null;
      const opts = first ? (Array.isArray(first.approvers) && first.approvers.length ? first.approvers : []) : [];
      if (targetApproverId) { const hit = opts.find((a) => String(a.user_id) === String(targetApproverId)); if (hit) optimisticApprover = hit.username || hit.name || "Approver"; }
      if (!optimisticApprover && opts.length) optimisticApprover = opts[0].username || opts[0].name || "Approver";
    } catch {}
    setItems((prev) => prev.map((r) => Number(r.id) === Number(selectedQuot.id) ? { ...r, status: "PENDING_APPROVAL", forwarded_to_username: optimisticApprover || r.forwarded_to_username || "Approver" } : r));
    try {
      const resp = await api.post(`/maintenance/supplier-quotations/${selectedQuot.id}/submit`, { amount: null, workflow_id: candidateWorkflow ? candidateWorkflow.id : null, target_user_id: targetApproverId || null,   comments: forwardComments,
        });
      toast.success(resp.data?.message || "Forwarded for approval");
      const newStatus = resp.data?.status || "PENDING_APPROVAL";
      let approverName = null;
      try {
        const first = Array.isArray(workflowSteps) && workflowSteps.length ? workflowSteps[0] : null;
        const opts = first ? (Array.isArray(first.approvers) && first.approvers.length ? first.approvers : []) : [];
        const hit = targetApproverId ? opts.find((a) => String(a.user_id) === String(targetApproverId)) : opts[0] || null;
        approverName = hit?.username || hit?.name || null;
      } catch {}
      setItems((prev) => prev.map((r) => Number(r.id) === Number(selectedQuot.id) ? { ...r, status: newStatus, forwarded_to_username: approverName || r.forwarded_to_username || "Approver" } : r));
      setShowForwardModal(false); setSelectedQuot(null);
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to forward for approval");
      setItems((prev) => prev.map((r) => Number(r.id) === Number(selectedQuot.id) ? { ...r, status: selectedQuot.status } : r));
    } finally { setSubmittingForward(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Supplier Quotations</div>
            <div className="flex gap-2">
              <button onClick={() => (window.location.href = "/maintenance?section=Procurement %26 Materials")} className="btn btn-secondary">Back</button>
              <button onClick={() => (window.location.href = "/maintenance/supplier-quotations/new")} className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700">+ New Quotation</button>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <input className="input max-w-md" placeholder="Search by no, supplier, status..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <SortableHeader label="Quotation No" sortKey="quotation_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="quotation_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="RFQ Ref" sortKey="rfq_id" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Supplier" sortKey="supplier_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Total" sortKey="total_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Currency" sortKey="currency" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-right whitespace-nowrap">Actions</th>
                  <SortableHeader label="Created By" sortKey="created_by_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="11" className="text-center py-8 text-slate-500 whitespace-nowrap">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="11" className="text-center py-8 text-slate-500 whitespace-nowrap">No quotations found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm whitespace-nowrap">{r.quotation_no}</td>
                    <td className="whitespace-nowrap">{r.quotation_date}</td>
                    <td className="whitespace-nowrap">{r.rfq_id}</td>
                    <td className="whitespace-nowrap">{r.supplier_name}</td>
                    <td className="text-right whitespace-nowrap">{Number(r.total_amount || 0).toFixed(2)}</td>
                    <td className="whitespace-nowrap">{r.currency}</td>
                    <td className="whitespace-nowrap"><Badge value={r.status} colorMap={statusColors} /></td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="View" onClick={() => navigate(`/maintenance/supplier-quotations/${r.id}?mode=view`)}><Eye size={15} /></button>
                        <ListPrintIconButton onClick={() => toast.info("Print coming soon")} />
                        <ListPdfIconButton onClick={() => toast.info("PDF coming soon")} />
                        <ListAttachmentIconButton onClick={() => { setActiveDocId(r.id); setShowAttach(true); }} />
                        <div className="min-w-[80px]">
                          <Link to={`/maintenance/supplier-quotations/${r.id}`} className="btn-secondary btn-sm w-full inline-flex items-center justify-center">Edit</Link>
                        </div>
                        <div className="min-w-[120px]">
                          <Link to={`/maintenance/job-orders/new?quotation_id=${r.id}`} className="btn-primary btn-sm w-full inline-flex items-center justify-center">Create Job Order</Link>
                        </div>
                        <div className="min-w-[160px]">
                          <div className="list-approval-slot">
                            {workflowDisabled && r.status !== "ACCEPTED" && r.status !== "APPROVED" ? (
                              <span className="list-approval-approved-pill">Approved</span>
                            ) : r.status === "ACCEPTED" || r.status === "APPROVED" ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">
                                  {r.status === "APPROVED" ? "Approved" : "Accepted"}
                                </span>
                              </div>
                            ) : r.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(r.status || "").toUpperCase()) ? (
                              <span className="list-approval-forwarded-pill">
                                Forwarded to {r.forwarded_to_username}
                              </span>
                            ) : canForward(r.status) && candidateWorkflow ? (
                              <button type="button" className="list-approval-forward-btn" onClick={() => openForwardModal(r)}>
                                Forward for Approval
                              </button>
                            ) : (
                              <div className="w-full h-9" />
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{r.created_by_name || "-"}</td>
                    <td className="whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAttach && activeDocId && (
        <DocumentAttachmentsModal
          open={showAttach}
          onClose={() => { setShowAttach(false); setActiveDocId(null); }}
          docType="maintenance"
          docId={activeDocId}
        />
      )}
      {/* Forward for Approval Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button onClick={() => { setShowForwardModal(false); setSelectedQuot(null); setWfError("");
                    setForwardComments(""); }} className="text-white/80 hover:text-white">
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
                    <div className="text-amber-600 text-sm">No active workflow found. Please configure a workflow.</div>
                  )}
                  {candidateWorkflow && (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">Workflow: <span className="font-medium">{candidateWorkflow.name}</span></div>
                      {firstApprover && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Approver</label>
                          {firstApprover.approvers && firstApprover.approvers.length > 1 ? (
                            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                              value={targetApproverId} onChange={(e) => setTargetApproverId(e.target.value)}>
                              <option value="">Select Approver</option>
                              {firstApprover.approvers.map((a) => (
                                <option key={a.user_id} value={a.user_id}>{a.username || a.name || `User ${a.user_id}`}</option>
                              ))}
                            </select>
                          ) : firstApprover.approvers && firstApprover.approvers.length === 1 ? (
                            <div className="text-sm text-gray-900 py-2">{firstApprover.approvers[0].username || firstApprover.approvers[0].name}</div>
                          ) : (
                            <div className="text-sm text-gray-500 py-2">No specific approver assigned</div>
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
              <button type="button" className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                onClick={() => { setShowForwardModal(false); setSelectedQuot(null); setWfError("");
                    setForwardComments(""); }}>Cancel</button>
              <button type="button" className="px-4 py-2 text-white rounded-lg hover:opacity-90" style={{ backgroundColor: "#0E3646" }}
                onClick={submitForward} disabled={!candidateWorkflow || submittingForward}>
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
