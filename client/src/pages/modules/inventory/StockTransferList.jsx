/**
 * @fileoverview StockTransferList component.
 * Provides functionality for StockTransferList.
 */

import React, { useEffect, useMemo, useState } from "react";
import ReverseApprovalButton from "../../../components/ReverseApprovalButton.jsx";
import { Printer, FileText, Paperclip } from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import FloatingCreateButton from "@/components/FloatingCreateButton.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function StockTransferList() {
  const [viewMode, setViewMode] = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [transfers, setTransfers] = useState([]);

  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState("");
  const [forwardNotes, setForwardNotes] = useState("");
  const [forwarding, setForwarding] = useState(false);
  const [forwardError, setForwardError] = useState("");
  const [forwardedTo, setForwardedTo] = useState({});

  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [wfLoading, setWfLoading] = useState(false);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [wfError, setWfError] = useState("");

  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);

  useEffect(() => {
    async function loadWorkflowFlags() {
      try {
        const res = await api.get("/workflows");
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setWorkflowsCache(list);
        const matching = list.filter(
          (w) => w.document_type === "STOCK_TRANSFER" && w.is_active === 1
        );
        const hasInactive = list.some(
          (w) => w.document_type === "STOCK_TRANSFER" && w.is_active === 0
        );
        const chosen =
          matching.find((w) => w.company_id && w.branch_id) ||
          matching.find((w) => w.company_id && !w.branch_id) ||
          matching.find((w) => !w.company_id && !w.branch_id);
        setCandidateWorkflow(chosen || null);
        setHasInactiveWorkflow(!chosen && hasInactive);
      } catch (e) {
        console.error("Failed to load workflow flags", e);
      }
    }
    loadWorkflowFlags();
  }, []);

  const openForwardModal = async (doc) => {
    setForwardError("");
    setForwardNotes("");
    setTargetApproverId("");
    setSelectedDoc(doc);
    setForwardModalOpen(true);
    setWfLoading(true);
    setWfError("");
    try {
      let list = workflowsCache;
      if (!list) {
        const res = await api.get("/workflows");
        list = Array.isArray(res.data?.data) ? res.data.data : [];
        setWorkflowsCache(list);
      }
      const matching = list.filter(
        (w) => w.document_type === "STOCK_TRANSFER" && w.is_active === 1
      );
      const chosen =
        matching.find((w) => w.company_id && w.branch_id) ||
        matching.find((w) => w.company_id && !w.branch_id) ||
        matching.find((w) => !w.company_id && !w.branch_id);
      setCandidateWorkflow(chosen || null);
      if (chosen) {
        const res = await api.get(`/workflows/${chosen.id}`);
        setWorkflowSteps(res.data?.data?.steps || []);
      }
    } catch (e) {
      setWfError("Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  const handleForward = async () => {
    if (!selectedDoc) return;
    const hasSteps = Array.isArray(workflowSteps) && workflowSteps.length > 0;
    const first = hasSteps ? workflowSteps[0] : null;
    const opts = first?.approvers || [];
    if (candidateWorkflow && opts.length > 0 && !targetApproverId) {
      setForwardError("Please select an approver");
      return;
    }
    setForwarding(true);
    setForwardError("");
    try {
      const payload = {
        document_type: "STOCK_TRANSFER",
        document_id: selectedDoc.id,
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
        notes: forwardNotes || "",
      };
      const wfRes = await api.post("/workflows/start", payload);
      const assigned = wfRes.data?.data?.assigned_user_id;
      let newForwardedToUser = null;
      if (assigned) {
        const found = opts.find((o) => String(o.id) === String(assigned));
        if (found) newForwardedToUser = found.username || found.name;
      }
      setForwardedTo((prev) => ({
        ...prev,
        [selectedDoc.id]: newForwardedToUser || "Approver",
      }));
      setTransfers((prev) =>
        prev.map((x) =>
          x.id === selectedDoc.id
            ? {
                ...x,
                status: "PENDING_APPROVAL",
                forwarded_to_username: newForwardedToUser || "Approver",
              }
            : x
        )
      );
      setForwardModalOpen(false);
    } catch (e) {
      setForwardError(e?.response?.data?.message || "Failed to forward document");
    } finally {
      setForwarding(false);
    }
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshData = (currentPage) => {
    setLoading(true);
    setError("");
    api
      .get("/inventory/stock-transfers", { params: { page: currentPage, limit: 50 } })
      .then((res) => {
        setTransfers(Array.isArray(res.data?.items) ? res.data.items : []);
        if (res.data?.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalCount(res.data.pagination.total || 0);
        }
      })
      .catch((e) => {
        setError(e?.response?.data?.message || "Failed to load stock transfers");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    refreshData(page);
  }, [page]);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    id: null,
    loading: false,
  });

  const handleConfirm = async () => {
    const { id } = confirmDialog;
    if (!id) return;
    setConfirmDialog((prev) => ({ ...prev, loading: true }));
    try {
      await api.put(`/inventory/stock-transfers/${id}/status`, {
        status: "IN_TRANSIT",
      });
      refreshData();
      setConfirmDialog({ open: false, id: null, loading: false });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to dispatch transfer");
      setConfirmDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge-info",
      IN_TRANSIT: "badge-warning",
      "IN TRANSIT": "badge-warning",
      RECEIVED: "badge-success",
      CANCELLED: "badge-error",
      APPROVED: "badge-success",
      PENDING_APPROVAL: "badge-warning",
    };
    return badges[status] || "badge-info";
  };

  const filteredTransfers = useMemo(() => {
    if (!searchTerm.trim()) return transfers.slice();
    return filterAndSort(transfers, {
      query: searchTerm,
      getKeys: (t) => [
        t.transfer_no,
        t.from_branch,
        t.to_branch,
        t.from_warehouse,
        t.to_warehouse,
        t.status,
      ],
    });
  }, [transfers, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Stock Transfers
              </h1>
              <p className="text-sm mt-1">
                Transfer stock between warehouses and branches
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/inventory/stock-transfers/new" className="btn-success">
                + New Transfer
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by transfer number, from or to branch..."
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
                  <th>Transfer No</th>
                  <th>Date</th>
                  <th>From Branch</th>
                  <th>From Warehouse</th>
                  <th>To Branch</th>
                  <th>To Warehouse</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Actions</th>
                  <th>Created By</th>
                  <th>Created Date</th>
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
                {filteredTransfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {transfer.transfer_no}
                    </td>
                    <td>
                      {transfer.transfer_date
                        ? new Date(transfer.transfer_date).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )
                        : "-"}
                    </td>
                    <td>{transfer.from_branch || "-"}</td>
                    <td>{transfer.from_warehouse || "-"}</td>
                    <td>{transfer.to_branch || "-"}</td>
                    <td>{transfer.to_warehouse || "-"}</td>
                    <td>{transfer.item_count}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(transfer.status)}`}>
                        {transfer.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* View */}
                        <Link
                          to={`/inventory/stock-transfers/${transfer.id}?mode=view`}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          View
                        </Link>

                        {/* Edit — only for DRAFT */}
                        {transfer.status === "DRAFT" ? (
                          <Link
                            to={`/inventory/stock-transfers/${transfer.id}?mode=edit`}
                            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          >
                            Edit
                          </Link>
                        ) : null}

                        {/* Dispatch — move to IN_TRANSIT */}
                        {["DRAFT", "APPROVED"].includes(transfer.status) ? (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-full hover:bg-blue-700 transition-colors"
                            onClick={() =>
                              setConfirmDialog({
                                open: true,
                                id: transfer.id,
                                loading: false,
                              })
                            }
                            title="Dispatch — mark as IN TRANSIT so it appears in Transfer Acceptance"
                          >
                            Dispatch
                          </button>
                        ) : null}

                        {/* Workflow / Approval slot */}
                        <div className="list-approval-slot">
                          {(hasInactiveWorkflow && !candidateWorkflow) &&
                          transfer.status !== "APPROVED" ? (
                            <span className="list-approval-approved-pill">
                              Approved
                            </span>
                          ) : transfer.status === "APPROVED" ? (
                            <div className="flex items-center gap-2">
                              <span className="list-approval-approved-pill">
                                Approved
                              </span>
                              <ReverseApprovalButton
                                docType="STOCK_TRANSFER"
                                docId={transfer.id}
                                className="list-approval-reverse-btn"
                                onDone={() =>
                                  setTransfers((prev) =>
                                    prev.map((x) =>
                                      x.id === transfer.id
                                        ? {
                                            ...x,
                                            status: "DRAFT",
                                            forwarded_to_username: null,
                                          }
                                        : x
                                    )
                                  )
                                }
                              >
                                Reverse Approval
                              </ReverseApprovalButton>
                            </div>
                          ) : transfer.status === "PENDING_APPROVAL" ||
                            transfer.forwarded_to_username ||
                            forwardedTo[transfer.id] ? (
                            <span className="list-approval-forwarded-pill">
                              Forwarded to{" "}
                              {transfer.forwarded_to_username ||
                                forwardedTo[transfer.id] ||
                                "Approver"}
                            </span>
                          ) : transfer.status === "DRAFT" ? (
                            <button
                              type="button"
                              className="list-approval-forward-btn"
                              onClick={() => openForwardModal(transfer)}
                            >
                              Forward for Approval
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>{transfer.created_by_name || "-"}</td>
                    <td>
                      {transfer.created_at
                        ? new Date(transfer.created_at).toLocaleDateString()
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
                {totalCount > 0 && ` (${totalCount} total transfers)`}
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

      {/* Dispatch Confirmation Dialog */}
      {confirmDialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 text-blue-600">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Dispatch Transfer</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                This will mark the transfer as <strong>IN TRANSIT</strong> and
                reserve the stock. It will then appear in the Transfer Acceptance
                page for the receiving branch to confirm.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                  onClick={() =>
                    setConfirmDialog({ open: false, id: null, loading: false })
                  }
                  disabled={confirmDialog.loading}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                  onClick={handleConfirm}
                  disabled={confirmDialog.loading}
                >
                  {confirmDialog.loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Dispatching...
                    </>
                  ) : (
                    "Dispatch"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FloatingCreateButton
        to="/inventory/stock-transfers/new"
        title="New Stock Transfer"
      />
    </div>
  );
}
