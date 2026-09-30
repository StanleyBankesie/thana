/**
 * @fileoverview CustomerServiceRequestsList component.
 * Provides functionality for CustomerServiceRequestsList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import ReverseApprovalButton from "../../../../components/ReverseApprovalButton.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import { ListAttachmentIconButton } from "@/components/list/ListDocActionIconButtons.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CustomerServiceRequestsList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState("request_date");
  const [sortDir, setSortDir] = useState("desc");
  const [activeDocId, setActiveDocId] = useState(null);
  const [showAttach, setShowAttach] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewItem, setViewItem] = useState(null);
  const { canPerformAction } = usePermission();

  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);


  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get("/purchase/service-requests");
        const rows = Array.isArray(res.data?.items) ? res.data.items : [];
        if (mounted) setItems(rows);

        try {
          const wfRes = await api.get("/workflows");
          const wfs = Array.isArray(wfRes.data?.items) ? wfRes.data.items : [];
          if (mounted) {
            setWorkflowsCache(wfs);
            await computeCandidateFromList(wfs);
          }
        } catch (e) {
          console.error("Failed to load workflows", e);
        }
      } catch (e) {
        const msg =
          e?.response?.data?.message || "Failed to load service requests";
        setError(msg);
        toast.error(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    const ref = location.state?.highlightRef;
    const hid = location.state?.highlightId;
    const refresh = location.state?.refresh;
    if (!ref && !hid && !refresh) return;
    let cancelled = false;
    async function ensureVisible() {
      const start = Date.now();
      while (!cancelled && Date.now() - start < 5000) {
        try {
          const res = await api.get("/purchase/service-requests");
          const arr = Array.isArray(res.data?.items) ? res.data.items : [];
          setItems(arr);
          let hit = false;
          if (ref) {
            hit = arr.some(
              (r) =>
                String(r.request_no || "").toLowerCase() ===
                String(ref).toLowerCase(),
            );
          } else if (hid) {
            hit = arr.some((r) => Number(r.id) === Number(hid));
          } else {
            hit = arr.length > 0;
          }
          if (hit) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    ensureVisible();
    return () => {
      cancelled = true;
    };
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
        setItems((prev) =>
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

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, {
      query: searchTerm,
      getKeys: (r) => [
        r.request_no,
        r.requester_company,
        r.requester_full_name,
        r.service_type,
        r.status,
      ],
    });
  }, [items, searchTerm]);

  
  const workflowDisabled = hasInactiveWorkflow && !candidateWorkflow;

  const computeCandidateFromList = async (wfs) => {
    if (!wfs || !wfs.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
                    setForwardComments("");
      setHasInactiveWorkflow(false);
      return;
    }
    const normalize = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const docType = "SERVICE_REQUEST";
    const docRoute = "/service-management/service-requests";
    const matchesDoc = (w) => {
      const nType = normalize(w.document_type);
      const nRoute = String(w.document_route || "").trim();
      return nType === docType || nRoute === docRoute;
    };
    const hasInactive = wfs.some((w) => matchesDoc(w));
    const chosen = wfs.find((w) => Number(w.is_active) === 1 && matchesDoc(w)) || null;
    
    setCandidateWorkflow(chosen);
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
        first ? {
          stepOrder: first.step_order,
          stepName: first.step_name,
          approvalLimit: first.approval_limit,
          approverUserId: first.approver_user_id,
        } : null
      );
      if (first && first.approver_user_id && !targetApproverId) {
        setTargetApproverId(Number(first.approver_user_id));
      } else if (first && Array.isArray(first.approvers) && first.approvers.length > 0) {
        setTargetApproverId(Number(first.approvers[0].id));
      }
    } catch (e) {
      setWfError("Failed to fetch candidate workflow steps");
    } finally {
      setWfLoading(false);
    }
  };

  const openForwardModal = async (doc) => {
    setSelectedDoc(doc);
    setShowForwardModal(true);
    setWfError("");
                    setForwardComments("");
    setTargetApproverId(null);
    setWfLoading(true);
    await computeCandidateFromList(workflowsCache || []);
    setWfLoading(false);
  };

  const forwardDocument = async () => {
    if (!selectedDoc) return;
    setSubmittingForward(true);
    setWfError("");
    try {
      const res = await api.post(
        `/purchase/service-requests/${selectedDoc.id}/submit`,
        {
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
        comments: forwardComments,
        }
      );
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      
      setItems((prev) =>
        prev.map((x) => {
          if (x.id !== selectedDoc.id) return x;
          const up = { ...x, status: newStatus };
          if (newStatus === "PENDING_APPROVAL") {
            up.has_workflow = true;
            up.forwarded_to_username = "-";
          }
          return up;
        })
      );
      toast.success(newStatus === "APPROVED" ? "Auto-approved" : "Forwarded for approval");
      setShowForwardModal(false);
      setSelectedDoc(null);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to forward";
      setWfError(msg);
      toast.error(msg);
    } finally {
      setSubmittingForward(false);
    }
  };

  const { sorted: sortedItems, sortKey: currentSortKey, sortDir: currentSortDir, toggle } = useSort(filtered, "created_at", "desc");

  return (
    <div className="p-6 space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Customer Service Requests</div>
            <div className="flex gap-2">
              <Link to="/service-management?section=Reports%20%26%20Parameters" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/service-management/customer-service-requests/new"
                className="btn-success"
              >
                + New Request
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
              placeholder="Search by no, customer, service, status..."
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
                  <SortableHeader label="No" sortKey="request_no" currentKey={currentSortKey} direction={currentSortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="request_date" currentKey={currentSortKey} direction={currentSortDir} onToggle={toggle} />
                  <SortableHeader label="Customer" sortKey="requester_company" currentKey={currentSortKey} direction={currentSortDir} onToggle={toggle} />
                  <SortableHeader label="Service" sortKey="service_type" currentKey={currentSortKey} direction={currentSortDir} onToggle={toggle} />
                  <SortableHeader label="Priority" sortKey="priority" currentKey={currentSortKey} direction={currentSortDir} onToggle={toggle} />
                  <SortableHeader label="Status" sortKey="status" currentKey={currentSortKey} direction={currentSortDir} onToggle={toggle} />
                  <th className="w-1 whitespace-nowrap">Actions</th>
                  <SortableHeader label="Created By" sortKey="created_by_username" currentKey={currentSortKey} direction={currentSortDir} onToggle={toggle} />
                  <SortableHeader label="Created Date" sortKey="created_at" currentKey={currentSortKey} direction={currentSortDir} onToggle={toggle} />
                  <th className="whitespace-nowrap">Attachments</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="text-center py-8 text-slate-500 dark:text-slate-400 whitespace-nowrap"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading &&
                  sortedItems.map((r) => {
                    const upperStatus = String(r.status || "").toUpperCase();
                    const autoApproved = workflowDisabled && upperStatus !== "CANCELLED" && upperStatus !== "REVERSED";
                    const displayStatus = autoApproved ? "APPROVED" : upperStatus;
                    return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">{r.request_no}</td>
                      <td className="whitespace-nowrap">{r.request_date}</td>
                      <td className="whitespace-nowrap">{r.requester_company || r.requester_full_name}</td>
                      <td className="whitespace-nowrap">{String(r.service_type || "").replace(/_/g, " ")}</td>
                      <td className="capitalize whitespace-nowrap">{r.priority}</td>
                      <td className="whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          displayStatus === 'APPROVED' ? 'bg-green-100 text-green-800' : 
                          displayStatus === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {displayStatus || "PENDING"}
                        </span>
                      </td>
                      <td className="px-6 py-4 w-1 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={async () => {
                              try {
                                const resp = await api.get(`/purchase/service-requests/${r.id}`);
                                setViewItem(resp.data?.item || null);
                              } catch (e) {
                                toast.error("Failed to load request");
                              }
                            }}
                          >
                            View
                          </button>

                          {canPerformAction("service-management:service-requests", "edit") && !["APPROVED", "POSTED"].includes(String(r.status || "").toUpperCase()) && (
                            <Link
                              to={`/service-management/customer-service-requests/new?id=${r.id}`}
                              className="btn btn-sm btn-outline"
                            >
                              Edit
                            </Link>
                          )}

                          <div className="min-w-[160px]">
                            <div className="list-approval-slot">
                              {["APPROVED", "POSTED"].includes(displayStatus) ? (
                                <div className="flex items-center gap-2">
                                  <span className="list-approval-approved-pill">
                                    Approved
                                  </span>
                                  {!autoApproved && (
                                    <ReverseApprovalButton
                                      docType="SERVICE_REQUEST"
                                      docId={r.id}
                                      className="list-approval-reverse-btn"
                                      onDone={() =>
                                        setItems((prev) =>
                                          prev.map((x) =>
                                            x.id === r.id
                                              ? { ...x, status: "DRAFT" }
                                              : x
                                          )
                                        )
                                      }
                                    />
                                  )}
                                </div>
                              ) : r.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(r.status || "").toUpperCase()) ? (
                                <span className="list-approval-forwarded-pill">
                                  Forwarded to {r.forwarded_to_username}
                                </span>
                              ) : ["DRAFT", "PENDING", "RETURNED", "REJECTED"].includes(String(r.status || "PENDING").toUpperCase()) && r.has_workflow ? (
                                <button
                                  type="button"
                                  className="list-approval-forward-btn"
                                  onClick={() => openForwardModal(r)}
                                >
                                  Forward for Approval
                                </button>
                              ) : ["DRAFT", "PENDING", "RETURNED", "REJECTED"].includes(String(r.status || "PENDING").toUpperCase()) && !r.has_workflow ? (
                                <button
                                  type="button"
                                  className="list-approval-forward-btn"
                                  onClick={() => openForwardModal(r)}
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
                      <td className="whitespace-nowrap">{r.created_by_username || r.created_by_name || "-"}</td>
                      <td className="whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                      <td className="whitespace-nowrap">
                        <ListAttachmentIconButton
                          onClick={() => {
                            setActiveDocId(r.id);
                            setShowAttach(true);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {viewItem && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="card w-full max-w-lg">
            <div className="card-header bg-brand text-white rounded-t-lg">
              <div className="font-semibold">Service Request Details</div>
            </div>
            <div className="card-body space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500">Request No</div>
                  <div className="text-sm">{viewItem.request_no}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Date</div>
                  <div className="text-sm">{viewItem.request_date}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500">Customer</div>
                  <div className="text-sm">{viewItem.requester_full_name}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500">Address</div>
                  <div className="text-sm">{viewItem.requester_address}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Email</div>
                  <div className="text-sm">{viewItem.requester_email}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Phone</div>
                  <div className="text-sm">{viewItem.requester_phone}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Service Type</div>
                  <div className="text-sm">{viewItem.service_type}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Priority</div>
                  <div className="text-sm capitalize">{viewItem.priority}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500">Title</div>
                  <div className="text-sm">{viewItem.request_title}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500">Description</div>
                  <div className="text-sm">{viewItem.description}</div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setViewItem(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedDoc(null);
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
                Document No:{" "}
                <span className="font-semibold">
                  {selectedDoc?.request_no}
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
                  setSelectedDoc(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
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
        docType="service-request"
        docId={activeDocId}
      />
    </div>
  );
}
