/**
 * @fileoverview StockUpdationList component.
 * Provides functionality for StockUpdationList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import { api } from "api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";
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
export default function StockUpdationList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const { canReverseApproval } = usePermission();
  const [searchTerm, setSearchTerm] = useState("");
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  const fetchAdjustments = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/inventory/stock-updation");
      setAdjustments(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load stock updations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
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
          const res = await api.get("/inventory/stock-updation");
          const arr = Array.isArray(res.data?.items) ? res.data.items : [];
          setAdjustments(arr);
          let hit = false;
          if (ref) {
            hit = arr.some(
              (a) =>
                String(a.adjustment_no || "").toLowerCase() ===
                String(ref).toLowerCase(),
            );
          } else if (hid) {
            hit = arr.some((a) => Number(a.id) === Number(hid));
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
        setAdjustments((prev) =>
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

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge-info",
      PENDING_APPROVAL: "badge-warning",
      APPROVED: "badge-success",
      POSTED: "badge-success",
      REJECTED: "badge-error",
      CANCELLED: "badge-error",
      RETURNED: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  const filteredAdjustments = useMemo(() => {
    if (!searchTerm.trim()) return adjustments.slice();
    return filterAndSort(adjustments, {
      query: searchTerm,
      getKeys: (adj) => [adj.updation_no],
    });
  }, [adjustments, searchTerm]);

  const { sorted: sortedAdjustments, sortKey, sortDir, toggle } = useSort(filteredAdjustments, "created_at", "desc");

  const formatDateOnly = (v) => {
    if (!v) return "";
    let d = new Date(v);
    if (isNaN(d.getTime())) {
      if (!isNaN(Number(v))) {
        d = new Date(Number(v));
      }
    }
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString();
  };

  // Workflow Logic


  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Stock Updation
              </h1>
              <p className="text-sm mt-1">
                Add stock items to the system
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/inventory/stock-updation/new" className="btn-success">
                + New Updation
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by document number..."
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
                  <SortableHeader label="Document No" sortKey="updation_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="updation_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th>Type</th>
                  <SortableHeader label="Items" sortKey="item_count" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
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
                      colSpan="8"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-red-600">
                      {error}
                    </td>
                  </tr>
                ) : null}

                {sortedAdjustments.map((adj) => (
                  <tr key={adj.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {adj.updation_no}
                    </td>
                    <td>{adj.updation_date ? String(adj.updation_date).slice(0, 10) : "-"}</td>
                    <td>
                      <span className="badge badge-success">
                        STOCK IN
                      </span>
                    </td>
                    <td>{adj.item_count}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(adj.status)} `}>
                        {adj.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="min-w-[80px]">
                          <Link
                            to={`/inventory/stock-updation/${adj.id}?mode=view`}
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                          >
                            View
                          </Link>
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="min-w-[80px]">
                          {!["APPROVED", "POSTED"].includes(String(adj.status || "").toUpperCase()) ? (
                            <Link
                              to={`/inventory/stock-updation/${adj.id}?mode=edit`}
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
                                `/inventory/stock-updation/${adj.id}?mode=view`,
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
                                "PDF export is not configured for stock updation.",
                              )
                            }
                          />
                        </div>

                        {/* Slot 5: Attachments */}
                        <div className="w-9">
                          <ListAttachmentIconButton
                            onClick={() => {
                              setActiveDocId(adj.id);
                              setShowAttach(true);
                            }}
                          />
                        </div>

                        {/* Slot 6: Workflow */}
                        <div className="min-w-[160px]">
                          <div className="list-approval-slot">
                            {String(adj.status || "").toUpperCase() === "APPROVED" ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">
                                  Approved
                                </span>
                                {String(adj.status || "").toUpperCase() === "APPROVED" && canReverseApproval() && (
                                  <button
                                    type="button"
                                    className="list-approval-reverse-btn"
                                    onClick={async () => {
                                      try {
                                        await api.post("/workflows/reverse-by-document", { document_type: "STOCK_UPDATION", document_id: adj.id });
                                        toast.success("Approval reversed");
                                        setAdjustments((prev) => prev.map((x) => x.id === adj.id ? { ...x, status: "RETURNED", forwarded_to_username: null } : x));
                                      } catch (e) {
                                        toast.error("Reverse approval failed");
                                      }
                                    }}
                                  >
                                    Reverse Approval
                                  </button>
                                )}
                              </div>
                            ) : adj.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(adj.status || "").toUpperCase()) ? (
                              <span className="list-approval-forwarded-pill">
                                Forwarded to {adj.forwarded_to_username}
                              </span>
                            ) : ["DRAFT", "RETURNED", "REJECTED"].includes(String(adj.status || "").toUpperCase()) && adj.has_workflow ? (
                              <button
                                type="button"
                                className="list-approval-forward-btn"
                              >
                                Forward for Approval
                              </button>
                            ) : <div className="w-full h-9" />}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{adj.created_by_name || "-"}</td>
                    <td>{adj.created_at ? new Date(adj.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setActiveDocId(null);
        }}
        docType="stock-updation"
        docId={activeDocId}
      />
    </div>
  );
}
