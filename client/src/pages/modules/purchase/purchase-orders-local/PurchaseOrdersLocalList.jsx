/**
 * @fileoverview PurchaseOrdersLocalList component.
 * Provides functionality for PurchaseOrdersLocalList.
 */

import React, { useState, useEffect, useMemo } from "react";
import PendingApprovalTooltip from "@/components/PendingApprovalTooltip.jsx";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { printDocument, downloadDocumentPdf } from "@/utils/pdfUtils.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";
import ReverseApprovalButton from "../../../../components/ReverseApprovalButton.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import addNotification from "../../../../utils/addNotification.js";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";
import NotificationModal from "../../../../components/NotificationModal.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PurchaseOrdersLocalList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [exceptionalAllowed, setExceptionalAllowed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardComments, setForwardComments] = useState("");
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [forwardedTo, setForwardedTo] = useState({});
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);
  const [sendingEmailId, setSendingEmailId] = useState(null);

  const { canPerformAction, hasExceptional } = usePermission();
  const [cancelDenied, setCancelDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkflowFlags() {
      try {
        const res = await api.get("/workflows");
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        if (cancelled) return;
        setWorkflowsCache(list);
        const route = "/purchase/purchase-orders-local";
        const normalize = (s) =>
          String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
        const matching = list.filter(
          (w) =>
            String(w.document_route) === route ||
            normalize(w.document_type) === "PURCHASE_ORDER",
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
              normalize(w.document_type) === "PURCHASE_ORDER",
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

  async function reversePo(id) {
    try {
      await api.post(`/purchase/orders/${id}/reverse`, {
        desired_status: "DRAFT",
      });
    } catch (e1) {
      try {
        await api.post("/workflows/reverse-by-document", {
          document_type: "PURCHASE_ORDER",
          document_id: id,
          desired_status: "DRAFT",
        });
      } catch (e2) {
        await api.put(`/purchase/orders/${id}/status`, { status: "DRAFT" });
      }
    }
    toast.success("Purchase order reversed successfully");
    setPurchaseOrders((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, status: "DRAFT", forwarded_to_username: null }
          : x,
      ),
    );
    try {
      const po = purchaseOrders.find((p) => Number(p.id) === Number(id));
      const icon = "/OMNISUITE_ICON_CLEAR.png";
      const link = `/purchase/purchase-orders-local/${id}`;
      addNotification({
        title: "Purchase Order reversed",
        message: `PO ${po?.po_no || id} is now ready to forward for approval`,
        native:
          typeof window !== "undefined" &&
          "Notification" in window &&
          window.Notification?.permission === "granted",
        icon,
        onClick: () => {
          navigate(link);
        },
      });
    } catch {}
  }
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
        let allowed = items.some((p) => {
          const effect = String(p.effect || "").toUpperCase();
          const active = Number(p.is_active || p.isActive) === 1;
          const code = String(
            p.permission_code || p.permissionCode || "",
          ).toUpperCase();
          const codeOk = code === "PURCHASE.ORDER.CANCEL";
          return effect === "ALLOW" && active && codeOk;
        });
        const denied = items.some((p) => {
          const effect = String(p.effect || "").toUpperCase();
          const active = Number(p.is_active || p.isActive) === 1;
          const code = String(
            p.permission_code || p.permissionCode || "",
          ).toUpperCase();
          return (
            effect === "DENY" && active && code === "PURCHASE.ORDER.CANCEL"
          );
        });
        if (!cancelled) setExceptionalAllowed(allowed);
        if (!cancelled) setCancelDenied(denied);
      } catch {
        if (!cancelled) setExceptionalAllowed(false);
        if (!cancelled) setCancelDenied(false);
      }
    }
    checkExceptional();
    return () => {
      cancelled = true;
    };
  }, []);
  const fetchOrders = async (currentPage, currentStatus) => {
    setLoading(true);
    setError("");
    try {
      let url = `/purchase/orders?page=${currentPage}&limit=50`;
      if (currentStatus !== "ALL") {
        url += `&status=${currentStatus}`;
      }
      const res = await api.get(url);
      const all = Array.isArray(res.data?.items) ? res.data.items : [];
      setPurchaseOrders(
        all.filter((po) => String(po.po_type || "").toUpperCase() === "LOCAL")
      );
      if (res.data?.pagination) {
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalCount(res.data.pagination.total || 0);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(page, statusFilter);
  }, [page, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // Ensure highlight logic works by reloading orders when needed
  useEffect(() => {
    const ref = location.state?.highlightRef;
    const hid = location.state?.highlightId;
    const refresh = location.state?.refresh;
    if (!ref && !hid && !refresh) return;
    fetchOrders(1, statusFilter);
  }, [location.state?.highlightRef, location.state?.highlightId, location.state?.refresh]);
  // Removed local visibility loop to prefer fetchOrders
  useEffect(() => {
    function onWorkflowStatus(e) {
      try {
        const d = e.detail || {};
        const id = Number(d.documentId || d.document_id);
        const status = String(d.status || "").toUpperCase();
        if (!id || !status) return;
        setPurchaseOrders((prev) =>
          prev.map((po) =>
            Number(po.id) === id
              ? {
                  ...po,
                  status,
                  ...(status === "DRAFT"
                    ? { forwarded_to_username: null }
                    : {}),
                }
              : po,
          ),
        );
      } catch {}
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () =>
      window.removeEventListener("omni.workflow.status", onWorkflowStatus);
  }, []);

  const getStatusBadge = (status) => {
    const statusConfig = {
      DRAFT: "badge-warning",
      PENDING_APPROVAL: "badge-warning",
      APPROVED: "badge-info",
      RECEIVED: "badge-success",
      RETURNED: "badge-error",
      CANCELLED: "badge-error",
    };
    return statusConfig[status] || "badge-info";
  };

  const filteredOrders = useMemo(() => {
    const base = purchaseOrders;
    if (!searchTerm.trim()) return base;
    return filterAndSort(base, {
      query: searchTerm,
      getKeys: (po) => [po.po_no, po.supplier_name],
    });
  }, [purchaseOrders, searchTerm, statusFilter]);

  const { sorted: sortedOrders, sortKey, sortDir, toggle } = useSort(filteredOrders, "created_at", "desc");

  const workflowDisabled = hasInactiveWorkflow && !candidateWorkflow;

  const openForwardModal = async (po) => {
    setSelectedPO(po);
    setShowForwardModal(true);
    setWfError("");
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

  const sendEmail = async (id) => {
    if (sendingEmailId) return;
    setSendingEmailId(id);
    try {
      await api.post(`/api/purchase/orders/${id}/send-notification`, { type: 'email' });
      toast.success("Email sent successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send email");
    } finally {
      setSendingEmailId(null);
    }
  };

  const computeCandidate = async () => {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWorkflowSteps([]);
      setTargetApproverId(null);
      setWfError("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/purchase/purchase-orders-local";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = workflowsCache.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "PURCHASE_ORDER",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "PURCHASE_ORDER",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setHasInactiveWorkflow(!chosen && hasInactive);
    setFirstApprover(null);
    setWorkflowSteps([]);
    setTargetApproverId(null);
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
      setWorkflowSteps([]);
      setTargetApproverId(null);
      setWfError("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/purchase/purchase-orders-local";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = items.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "PURCHASE_ORDER",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "PURCHASE_ORDER",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setHasInactiveWorkflow(!chosen && hasInactive);
    setFirstApprover(null);
    setWorkflowSteps([]);
    setTargetApproverId(null);
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
    if (!selectedPO) return;
    const hasSteps = Array.isArray(workflowSteps) && workflowSteps.length > 0;
    const first = hasSteps ? workflowSteps[0] : null;
    const opts = first
      ? Array.isArray(first.approvers) && first.approvers.length
        ? first.approvers
        : first.approver_user_id
          ? [{ id: first.approver_user_id }]
          : []
      : [];
    if (candidateWorkflow && opts.length > 0 && !targetApproverId) {
      setWfError("Please select target approver");
      return;
    }
    setSubmittingForward(true);
    setWfError("");
    // Optimistic UI update: set row to PENDING_APPROVAL and show 'Forwarded to {username}'
    let optimisticApprover = null;
    try {
      const options = first
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
      if (targetApproverId && options.length) {
        const hit = options.find(
          (u) => Number(u.id) === Number(targetApproverId),
        );
        optimisticApprover = hit ? hit.name : null;
      }
    } catch {}
    setPurchaseOrders((prev) =>
      prev.map((po) =>
        po.id === selectedPO.id
          ? {
              ...po,
              status: "PENDING_APPROVAL",
              forwarded_to_username:
                optimisticApprover || po.forwarded_to_username || "Approver",
            }
          : po,
      ),
    );
    setForwardedTo((prev) => ({
      ...prev,
      [selectedPO.id]: optimisticApprover || "Approver",
    }));
    setShowForwardModal(false);
    setSelectedPO(null);
    try {
      const res = await api.post(`/purchase/orders/${selectedPO.id}/submit`, {
        amount:
          selectedPO.total_amount === undefined ||
          selectedPO.total_amount === null
            ? null
            : Number(selectedPO.total_amount || 0),
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
        comments: forwardComments,
        });
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      let approverName = null;
      try {
        const firstStep = first;
        const options = firstStep
          ? Array.isArray(firstStep.approvers) && firstStep.approvers.length
            ? firstStep.approvers.map((u) => ({
                id: u.id,
                name: u.username,
              }))
            : firstStep.approver_user_id
              ? [
                  {
                    id: firstStep.approver_user_id,
                    name:
                      firstStep.approver_name ||
                      String(firstStep.approver_user_id),
                  },
                ]
              : []
          : [];
        if (targetApproverId && options.length) {
          const hit = options.find(
            (u) => Number(u.id) === Number(targetApproverId),
          );
          approverName = hit ? hit.name : null;
        }
      } catch {}
      setPurchaseOrders((prev) =>
        prev.map((po) =>
          po.id === selectedPO.id
            ? {
                ...po,
                status: newStatus,
                forwarded_to_username:
                  approverName || po.forwarded_to_username || "Approver",
              }
            : po,
        ),
      );
      try {
        toast.success("Purchase order forwarded for approval");
      } catch {}
    } catch (e) {
      try {
        const amount =
          selectedPO.total_amount === undefined ||
          selectedPO.total_amount === null
            ? null
            : Number(selectedPO.total_amount || 0);
        const wfRes = await api.post("/workflows/start", {
          document_type: "PURCHASE_ORDER",
          document_id: selectedPO.id,
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
        comments: forwardComments,
          amount,
        });
        const newStatus = wfRes?.data?.status || "PENDING_APPROVAL";
        setPurchaseOrders((prev) =>
          prev.map((po) =>
            po.id === selectedPO.id ? { ...po, status: newStatus } : po,
          ),
        );
        try {
          toast.success("Purchase order forwarded for approval");
        } catch {}
      } catch (e2) {
        try {
          await api.put(`/purchase/orders/${selectedPO.id}/status`, {
            status: "PENDING_APPROVAL",
          });
          toast.success("Purchase order forwarded for approval");
        } catch (e3) {
          setWfError(
            e?.response?.data?.message ||
              e2?.response?.data?.message ||
              e3?.response?.data?.message ||
              "Failed to forward for approval",
          );
        }
      }
    } finally {
      setSubmittingForward(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Purchase Orders - Local
          </h1>
          <p className="text-sm mt-1">Manage local purchase orders</p>
        </div>
        <div className="flex gap-2 items-center">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          <Link to="/purchase?section=Procurement" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link
            to="/purchase/purchase-orders-local/new"
            className="btn-success"
          >
            + New Purchase Order
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by PO no or supplier..."
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
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="RECEIVED">Received</option>
                <option value="RETURNED">Returned</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr>
                <SortableHeader label="PO No" sortKey="po_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="PO Date" sortKey="po_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Supplier" sortKey="supplier_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Total Amount" sortKey="total_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <th className="text-right">Actions</th>
                <SortableHeader label="Created By" sortKey="created_by_username" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
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
              ) : error ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-red-600">
                    {error}
                  </td>
                </tr>
              ) : null}
              {!loading && filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    No purchase orders found
                  </td>
                </tr>
              ) : (
                sortedOrders.map((po) => (
                  <tr key={po.id}>
                    <td className="font-medium">{po.po_no}</td>
                    <td>
                      {po.po_date
                        ? new Date(po.po_date).toLocaleDateString()
                        : ""}
                    </td>
                    <td>{po.supplier_name}</td>
                    <td className="text-right font-medium">
                      {Number(po.total_amount || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(po.status)}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="min-w-[80px]">
                          <Link
                            to={`/purchase/purchase-orders-local/${po.id}?mode=view`}
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                          >
                            View
                          </Link>
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="min-w-[80px]">
                          {po.status !== 'APPROVED' ? (
                            <Link
                              to={`/purchase/purchase-orders-local/${po.id}/edit`}
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
                            onClick={() => printDocument(api, "purchase-order", po.id, toast)}
                          />
                        </div>

                        {/* Slot 4: PDF */}
                        <div className="min-w-[80px]">
                          <ListPdfIconButton
                            onClick={() => downloadDocumentPdf(api, "purchase-order", po.id, `PO-${po.po_no || po.id}.pdf`, toast)}
                          />
                        </div>

                        {/* Slot 5: Attachments */}
                        <div className="min-w-[80px]">
                          <ListAttachmentIconButton
                            onClick={() => {
                              setActiveDocId(po.id);
                              setShowAttach(true);
                            }}
                          />
                        </div>

                        {/* Slot 6: Workflow */}
                        <div className="min-w-[160px]">
                          <div className="list-approval-slot">
                            {workflowDisabled && po.status !== "APPROVED" ? (
                              <span className="list-approval-approved-pill">
                                Approved
                              </span>
                            ) : po.status === "APPROVED" ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">
                                  Approved
                                </span>
                                {po.status === "APPROVED" && (
                                  <ReverseApprovalButton
                                    docType="PURCHASE_ORDER"
                                    docId={po.id}
                                    className="list-approval-reverse-btn"
                                    onDone={() =>
                                      setPurchaseOrders((prev) =>
                                        prev.map((x) =>
                                          x.id === po.id
                                            ? {
                                                ...x,
                                                status: "RETURNED",
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
                            ) : po.status === "PENDING_APPROVAL" || po.forwarded_to_username || forwardedTo[po.id] ? (
                              <PendingApprovalTooltip documentType="PURCHASE_ORDER" documentId={po.id}><span className="list-approval-forwarded-pill">
                                Forwarded to {po.forwarded_to_username || forwardedTo[po.id] || "Approver"}
                              </span></PendingApprovalTooltip>
                            ) : (
                              <button
                                type="button"
                                className="list-approval-forward-btn"
                                onClick={() => openForwardModal(po)}
                              >
                                Forward for Approval
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Slot 7: Send Email */}
                        <div className="min-w-[80px]">
                          <button
                            type="button"
                            disabled={sendingEmailId === po.id}
                            className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors h-9 disabled:opacity-50"
                            onClick={() => sendEmail(po.id)}
                          >
                            {sendingEmailId === po.id ? 'Sending...' : 'Send Email'}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td>{po.created_by_username || po.created_by_name || "-"}</td>
                    <td>{po.created_at ? new Date(po.created_at).toLocaleDateString() : "-"}</td>
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
              {totalCount > 0 && ` (${totalCount} total orders)`}
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

        <div className="card-body border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <span>
              Showing {filteredOrders.length} of {purchaseOrders.length} orders
            </span>
            <div className="flex gap-2">
              <button className="btn-success px-3 py-1.5" disabled>
                Previous
              </button>
              <button className="btn-success px-3 py-1.5" disabled>
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
      {showForwardModal ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
              <div className="font-semibold">
                Forward Purchase Order for Approval
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForwardModal(false);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setWfError("");
                  setSelectedPO(null);
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Document No:{" "}
                <span className="font-semibold">{selectedPO?.po_no || ""}</span>
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
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => {
                  setShowForwardModal(false);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setWfError("");
                  setSelectedPO(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardForApproval}
                disabled={
                  submittingForward ||
                  !selectedPO ||
                  (Array.isArray(workflowSteps) &&
                    workflowSteps.length > 0 &&
                    candidateWorkflow &&
                    !targetApproverId)
                }
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <DocumentAttachmentsModal
        open={!!activeDocId}
        documentId={activeDocId}
        documentType="PURCHASE_ORDER"
        onClose={() => setActiveDocId(null)}
      />
    </div>
  );
}
