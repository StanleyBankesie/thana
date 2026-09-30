/**
 * @fileoverview ReturnToStoresList component.
 * Provides functionality for ReturnToStoresList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import { api } from "api/client";
import FloatingCreateButton from "@/components/FloatingCreateButton.jsx";
import ReverseApprovalButton from "../../../components/ReverseApprovalButton.jsx";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ReturnToStoresList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [docs, setDocs] = useState([]);
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

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get("/inventory/return-to-stores")
      .then((res) => {
        if (!mounted) return;
        setDocs(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load return to stores",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

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
          const res = await api.get("/inventory/return-to-stores");
          const arr = Array.isArray(res.data?.items) ? res.data.items : [];
          setDocs(arr);
          let hit = false;
          if (ref) {
            hit = arr.some(
              (d) =>
                String(d.rts_no || "").toLowerCase() ===
                String(ref).toLowerCase(),
            );
          } else if (hid) {
            hit = arr.some((d) => Number(d.id) === Number(hid));
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
        setDocs((prev) =>
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

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "bg-slate-100 text-slate-700",
      PENDING: "bg-yellow-100 text-yellow-800",
      PENDING_APPROVAL: "bg-yellow-100 text-yellow-800",
      SUBMITTED: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      POSTED: "bg-blue-100 text-blue-800",
      REJECTED: "bg-red-100 text-red-800",
    };
    return badges[status] || "bg-slate-100 text-slate-700";
  };

  const stats = useMemo(() => {
    const total = docs.length;
    const pending = docs.filter(
      (d) =>
        d.status === "PENDING" ||
        d.status === "PENDING_APPROVAL" ||
        d.status === "SUBMITTED",
    ).length;
    const approved = docs.filter(
      (d) => d.status === "APPROVED" || d.status === "POSTED",
    ).length;
    const rejected = docs.filter((d) => d.status === "REJECTED").length;
    return { total, pending, approved, rejected };
  }, [docs]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return docs.slice();
    return filterAndSort(docs, {
      query: searchTerm,
      getKeys: (d) => [d.rts_no, d.warehouse_name],
    });
  }, [docs, searchTerm]);

  const { sorted: sortedDocs, sortKey, sortDir, toggle } = useSort(filtered, "created_at", "desc");

  const openForwardModal = async (doc) => {
    setSelectedDoc(doc);
    setShowForwardModal(true);
    setWfError("");
                    setForwardComments("");
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
                    setForwardComments("");
      return;
    }
    const route = "/inventory/return-to-stores";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "RETURN_TO_STORES",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
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
                    setForwardComments("");
      return;
    }
    const route = "/inventory/return-to-stores";
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
          normalize(w.document_type) === "RETURN_TO_STORES",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
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
    if (!selectedDoc) return;
    setSubmittingForward(true);
    setWfError("");
    // Optimistic update
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
    setDocs((prev) =>
      prev.map((r) =>
        r.id === selectedDoc.id
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
    setSelectedDoc(null);
    try {
      const res = await api.post(
        `/inventory/return-to-stores/${selectedDoc.id}/submit`,
        {
          amount: null,
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
        comments: forwardComments,
        },
      );
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
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
      setDocs((prev) =>
        prev.map((r) =>
          r.id === selectedDoc.id
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
        toast.success("Return to Stores forwarded for approval");
      } catch {}
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center justify-between bg-white dark:bg-slate-800">
          <div>
            <p className="text-sm text-brand-100 font-medium">
              Total Returns
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {stats.total}
            </p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <svg
              className="w-6 h-6 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between bg-white dark:bg-slate-800">
          <div>
            <p className="text-sm text-brand-100 font-medium">
              Pending Approval
            </p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
              {stats.pending}
            </p>
          </div>
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <svg
              className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between bg-white dark:bg-slate-800">
          <div>
            <p className="text-sm text-brand-100 font-medium">
              Approved
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {stats.approved}
            </p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <svg
              className="w-6 h-6 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between bg-white dark:bg-slate-800">
          <div>
            <p className="text-sm text-brand-100 font-medium">
              Rejected
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {stats.rejected}
            </p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg p-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>↩️</span> Return to Stores
              </h1>
              <p className="text-sm text-brand-100 mt-1">
                Manage material returns and approvals
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/inventory/return-to-stores/new"
                className="btn btn-primary bg-[#2E7D9F] hover:bg-[#24637e] text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <span>+</span> New Return
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">
              <div className="animate-spin w-8 h-8 border-4 border-[#2E7D9F] border-t-transparent rounded-full mx-auto mb-4"></div>
              Loading returns...
            </div>
          ) : null}
          {error ? (
            <div className="p-4 m-4 bg-red-50 text-red-600 rounded-lg border border-red-100 flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {error}
            </div>
          ) : null}

          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="relative max-w-md">
              <input
                type="text"
                placeholder="Search by advice number or warehouse..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E7D9F] focus:border-transparent dark:bg-slate-700 dark:text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg
                className="w-5 h-5 text-slate-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={ "w-full text-left border-collapse " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-xs uppercase font-semibold">
                <tr>
                  <SortableHeader label="Advice No" sortKey="rts_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="rts_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Type" sortKey="return_type" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Department" sortKey="department_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Warehouse" sortKey="warehouse_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Items" sortKey="item_count" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="px-6 py-4 text-right">Actions</th>
                  <SortableHeader label="Created By" sortKey="created_by_username" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-[#2E7D9F] dark:text-[#5fb8e3]">
                      <Link to={`/inventory/return-to-stores/${d.id}`}>
                        {d.rts_no}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {d.rts_date ? d.rts_date.split("T")[0] : "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        {d.return_type || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {d.department_name || "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {d.warehouse_name || "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold">
                        {d.item_count}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                          d.status,
                        )}`}
                      >
                        {d.status}
                      </span>
                    </td>
                                        <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="w-[80px]">
                          <Link
                            to={`/inventory/return-to-stores/${d.id}?mode=view`}
                            className="w-full inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors h-9"
                          >
                            View
                          </Link>
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="min-w-[80px]">
                          {d.status !== "APPROVED" ? (
                            <Link
                              to={`/inventory/return-to-stores/${d.id}?mode=edit`}
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
                                `/inventory/return-to-stores/${d.id}?mode=view`,
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
                                "PDF export is not configured for return to stores.",
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
                            {d.status === "APPROVED" ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">
                                  Approved
                                </span>
                                {d.status === "APPROVED" && (
                                  <ReverseApprovalButton
                                    docType="RETURN_TO_STORES"
                                    docId={d.id}
                                    className="list-approval-reverse-btn"
                                    onDone={() =>
                                      setDocs((prev) =>
                                        prev.map((x) =>
                                          x.id === d.id
                                            ? {
                                                ...x,
                                                status: "REVERSED",
                                                forwarded_to_username: null,
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                  >
                                    Reverse Approval
                                  </ReverseApprovalButton>
                                )}
                              </div>
                            ) : d.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(d.status || "").toUpperCase()) ? (
                              <span className="list-approval-forwarded-pill">
                                Forwarded to {d.forwarded_to_username}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="list-approval-forward-btn"
                                onClick={() => openForwardModal(d)}
                              >
                                Forward for Approval
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{d.created_by_username || d.created_by_name || "-"}</td>
                    <td className="px-6 py-4">{d.created_at ? new Date(d.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-12 text-center text-slate-400"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <svg
                          className="w-12 h-12 text-slate-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <p>No return records found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w/full max-w-md overflow-hidden">
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
                Return Advice:{" "}
                <span className="font-semibold">{selectedDoc?.rts_no}</span>
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
      <FloatingCreateButton
        to="/inventory/return-to-stores/new"
        title="New Return"
        className="btn-primary bg-[#2E7D9F] hover:bg-[#24637e] inline-flex rounded-full w-12 h-12 shadow-erp-lg items-center justify-center text-xl"
      />
    </div>
  );
}

