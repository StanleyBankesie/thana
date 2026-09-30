/**
 * @fileoverview IssueToRequirementList component.
 * Provides functionality for IssueToRequirementList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "api/client";
import { toast } from "react-toastify";
import FloatingCreateButton from "@/components/FloatingCreateButton.jsx";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import { usePermission } from "@/auth/PermissionContext.jsx";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function IssueToRequirementList() {
  const [viewMode, setViewMode] = useViewMode();
  const { canReverseApproval } = usePermission();
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [docs, setDocs] = useState([]);
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/inventory/issue-to-requirement")
      .then((res) => {
        if (!mounted) return;
        setDocs(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load issues");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge-info",
      ISSUED: "badge-warning",
      POSTED: "badge-success",
      CANCELLED: "badge-error",
    };
    return badges[status] || "badge-info";
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return docs.slice();
    return filterAndSort(docs, {
      query: searchTerm,
      getKeys: (d) => [d.issue_no, d.department_name, d.warehouse_name],
    });
  }, [docs, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Issue to Requirement Area
              </h1>
              <p className="text-sm mt-1">
                Issue materials to departments / requirement areas
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/inventory/issue-to-requirement/new"
                className="btn-success"
              >
                + New Issue
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
              placeholder="Search by issue number or department..."
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
                  <th>Issue No</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Warehouse</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                  <th>Created By</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {d.issue_no}
                    </td>
                    <td>
                      {d.issue_date ? String(d.issue_date).slice(0, 10) : "-"}
                    </td>
                    <td>{d.issue_type || "-"}</td>
                    <td>{d.warehouse_name || "-"}</td>
                    <td>{d.department_name || "-"}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(d.status)}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="min-w-[80px]">
                          <Link
                            to={`/inventory/issue-to-requirement/${d.id}?mode=view`}
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                          >
                            View
                          </Link>
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="min-w-[80px]">
                          {d.status !== "POSTED" ? (
                            <Link
                              to={`/inventory/issue-to-requirement/${d.id}?mode=edit`}
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
                                `/inventory/issue-to-requirement/${d.id}?mode=view`,
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
                                "PDF export is not configured for issues to requirement.",
                              )
                            }
                          />
                        </div>

                        {/* Slot 5: Attachments */}
                        <div className="w-9">
                          <ListAttachmentIconButton
                            onClick={() => {
                              setActiveDocId(d.id);
                              setShowAttach(true);
                            }}
                          />
                        </div>

                        {/* Slot 6: Workflow */}
                        <div className="min-w-[160px]">
                          <div className="list-approval-slot">
                            {d.status === "DRAFT" ? (
                              <button
                                onClick={async () => {
                                   try {
                                    await api.put(`/inventory/issue-to-requirement/${d.id}/status`, { status: "POSTED" });
                                    setDocs((prev) =>
                                      prev.map((x) =>
                                        x.id === d.id
                                          ? { ...x, status: "POSTED" }
                                          : x,
                                      ),
                                    );
                                    toast.success("Issue posted");
                                  } catch (e) {
                                    toast.error(
                                      e?.response?.data?.message ||
                                        "Failed to post issue",
                                    );
                                  }
                                }}
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-lg bg-[#3C3E6E] text-white hover:bg-[#2C2E5E] transition-colors whitespace-nowrap h-9"
                              >
                                Post Issue
                              </button>
                            ) : d.status === "POSTED" ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">
                                  Posted
                                </span>
                                {d.status === "POSTED" && canReverseApproval() && (
                                  <button
                                    type="button"
                                    className="list-approval-reverse-btn"
                                    onClick={async () => {
                                       try {
                                        await api.post(`/inventory/issue-to-requirement/${d.id}/cancel`);
                                        setDocs((prev) =>
                                          prev.map((x) =>
                                            x.id === d.id
                                              ? { ...x, status: "CANCELLED" }
                                              : x,
                                          ),
                                        );
                                        toast.success("Issue cancelled");
                                      } catch (e) {
                                        toast.error(
                                          e?.response?.data?.message ||
                                            "Failed to cancel issue",
                                        );
                                      }
                                    }}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="w-full h-9" />
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{d.created_by_username || d.created_by_name || "-"}</td>
                    <td>{d.created_at ? new Date(d.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <FloatingCreateButton
        to="/inventory/issue-to-requirement/new"
        title="New Issue"
      />
      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setActiveDocId(null);
        }}
        docType="issue-to-requirement"
        docId={activeDocId}
      />
    </div>
  );
}
