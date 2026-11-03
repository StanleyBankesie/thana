/**
 * @file DailySiteReportList.jsx
 * @description Daily Site Reports (DSR) and site diary management list with full approval workflow
 * aligned with the enterprise sales order approval standard, Apple HIG, and Impeccable design system.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Plus,
  Calendar,
  CloudSun,
  Users,
  Truck,
  ArrowLeft,
  CheckCircle,
  Eye,
  Edit2,
  Trash2,
  Search,
  RefreshCw,
  Send,
  RotateCcw,
  Printer,
  X,
  FileText,
  Clock,
  ShieldCheck,
  Building,
  UserCheck
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";
import addNotification from "../../../../utils/addNotification.js";

export default function DailySiteReportList() {
  const navigate = useNavigate();
  const {
    canPerformAction,
    canDeleteOnPage,
    canReverseApproval,
  } = usePermission();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Workflow states matching SalesOrderList
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [submittingReverse, setSubmittingReverse] = useState(false);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [forwardComments, setForwardComments] = useState("");
  const [submittingForward, setSubmittingForward] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [forwardedTo, setForwardedTo] = useState({});

  // Print Preview Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printReport, setPrintReport] = useState(null);

  // Load Projects
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
        setSelectedProjectId("");
      } catch (e) {
        toast.error("Failed to load projects");
      }
    })();
  }, []);

  // Fetch Reports
  useEffect(() => {
    fetchReports();
  }, [selectedProjectId]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedProjectId) params.project_id = selectedProjectId;
      const res = await api.get("/construction/daily-reports", { params });
      const items = res.data?.items || [];
      setReports(items);

      // Populate local forwardedTo map
      const fwd = {};
      items.forEach((it) => {
        if (it.forwarded_to_username && !["DRAFT", "RETURNED", "REJECTED"].includes(String(it.status).toUpperCase())) {
          fwd[it.id] = String(it.forwarded_to_username);
        }
      });
      setForwardedTo(fwd);
    } catch (e) {
      toast.error("Failed to load daily site reports");
    } finally {
      setLoading(false);
    }
  };

  // Pre-load Workflow Cache & Flags
  useEffect(() => {
    let cancelled = false;
    async function loadWorkflowFlags() {
      try {
        const res = await api.get("/workflows");
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        if (cancelled) return;
        setWorkflowsCache(list);
        const route = "/project-management/daily-reports";
        const normalize = (s) =>
          String(s || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "_");
        const matching = list.filter(
          (w) =>
            String(w.document_route) === route ||
            normalize(w.document_type) === "DAILY_SITE_REPORT" ||
            normalize(w.document_type) === "SITE_DIARY" ||
            normalize(w.document_type) === "DSR"
        );
        const hasInactive = matching.some((w) => Number(w.is_active) === 0);
        const chosen =
          list.find((w) => Number(w.is_active) === 1 && String(w.document_route) === route) ||
          list.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "DAILY_SITE_REPORT") ||
          list.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "SITE_DIARY") ||
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

  // Listen to Workflow Status Events
  useEffect(() => {
    function onWorkflowStatus(e) {
      try {
        const d = e.detail || {};
        const id = Number(d.documentId || d.document_id);
        const status = String(d.status || "").toUpperCase();
        if (!id || !status) return;
        const normalized = status === "RETURNED" ? "DRAFT" : status;
        setReports((prev) =>
          prev.map((x) =>
            Number(x.id) === id
              ? {
                  ...x,
                  status: normalized,
                  ...(normalized === "DRAFT" ? { forwarded_to_username: null } : {}),
                }
              : x
          )
        );
        if (normalized === "DRAFT") {
          setForwardedTo((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      } catch {}
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () => window.removeEventListener("omni.workflow.status", onWorkflowStatus);
  }, []);

  // Compute Workflow Candidate and Steps
  const computeCandidate = async () => {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/project-management/daily-reports";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = workflowsCache.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "DAILY_SITE_REPORT" ||
        normalize(w.document_type) === "SITE_DIARY" ||
        normalize(w.document_type) === "DSR"
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find((w) => Number(w.is_active) === 1 && String(w.document_route) === route) ||
      workflowsCache.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "DAILY_SITE_REPORT") ||
      workflowsCache.find((w) => Number(w.is_active) === 1 && normalize(w.document_type) === "SITE_DIARY") ||
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
          : null
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

  const openForwardModal = async (report) => {
    setSelectedReport(report);
    setShowForwardModal(true);
    setWfError("");
    setForwardComments("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(items);
        await computeCandidate();
      } catch (e) {
        setWfError(e?.response?.data?.message || "Failed to load workflows");
      } finally {
        setWfLoading(false);
      }
    } else {
      await computeCandidate();
    }
  };

  // Submit into Workflow
  const forwardDocument = async () => {
    if (!selectedReport) return;
    setSubmittingForward(true);
    setWfError("");
    try {
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

      // Optimistic update
      setReports((prev) =>
        prev.map((x) =>
          x.id === selectedReport.id
            ? {
                ...x,
                status: "PENDING_APPROVAL",
                forwarded_to_username: optimisticApprover || x.forwarded_to_username || "Approver",
              }
            : x
        )
      );
      setForwardedTo((prev) => ({
        ...prev,
        [selectedReport.id]: optimisticApprover || prev[selectedReport.id] || "Approver",
      }));
      setShowForwardModal(false);

      // Primary submission
      let success = false;
      try {
        const res = await api.post(`/construction/daily-reports/${selectedReport.id}/submit`, {
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
          comments: forwardComments,
        });
        success = true;
      } catch (e1) {
        // Fallback to central workflow engine
        try {
          await api.post("/workflows/forward-by-document", {
            document_type: "DAILY_SITE_REPORT",
            document_id: selectedReport.id,
            workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
            target_user_id: targetApproverId || null,
            amount: 0,
          });
          success = true;
        } catch (e2) {
          throw new Error(e1?.response?.data?.message || e2?.response?.data?.message || "Failed to forward report");
        }
      }

      toast.success("Daily site report forwarded for approval");
      try {
        addNotification({
          title: "Daily Site Diary forwarded",
          message: `DSR ${selectedReport.report_number || selectedReport.id} forwarded for approval`,
          icon: "/OMNISUITE_ICON_CLEAR.png",
        });
      } catch {}

      await fetchReports();
    } catch (err) {
      toast.error(err.message || "Failed to forward for approval");
      await fetchReports();
    } finally {
      setSubmittingForward(false);
    }
  };

  // Open Reverse Modal
  const openReverseModal = (report) => {
    setSelectedReport(report);
    setReverseReason("");
    setShowReverseModal(true);
  };

  // Reverse Approval
  const confirmReverseReport = async () => {
    if (!selectedReport) return;
    setSubmittingReverse(true);
    try {
      try {
        await api.post(`/construction/daily-reports/${selectedReport.id}/reverse`, {
          desired_status: "DRAFT",
          reason: reverseReason,
        });
      } catch (e1) {
        // Fallback
        await api.post("/workflows/reverse-by-document", {
          document_type: "DAILY_SITE_REPORT",
          document_id: selectedReport.id,
          desired_status: "DRAFT",
        });
      }

      setReports((prev) =>
        prev.map((x) =>
          x.id === selectedReport.id
            ? { ...x, status: "DRAFT", forwarded_to_username: null, approved_by_name: null }
            : x
        )
      );
      setForwardedTo((prev) => {
        const next = { ...prev };
        delete next[selectedReport.id];
        return next;
      });

      setShowReverseModal(false);
      setSelectedReport(null);
      toast.success("Approval reversed; report reverted to Draft");

      try {
        addNotification({
          title: "Daily Site Report reversed",
          message: `DSR ${selectedReport.report_number || selectedReport.id} is now back in Draft status`,
          icon: "/OMNISUITE_ICON_CLEAR.png",
        });
      } catch {}

      await fetchReports();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || "Failed to reverse approval");
    } finally {
      setSubmittingReverse(false);
    }
  };

  // Print Daily Report
  const handlePrint = (report) => {
    setPrintReport(report);
    setShowPrintModal(true);
  };

  // Delete Draft Report
  const handleDeleteReport = async (report) => {
    if (!window.confirm(`Are you sure you want to delete Daily Site Report (${report.report_number || report.id})?`)) {
      return;
    }
    try {
      await api.delete(`/construction/daily-reports/${report.id}`);
      toast.success("Daily site report deleted successfully");
      setReports((prev) => prev.filter((x) => x.id !== report.id));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete daily report");
    }
  };

  // Filtered List
  const filteredReports = reports.filter((r) => {
    const q = searchTerm.toLowerCase().trim();
    const matchSearch =
      !q ||
      r.report_number?.toLowerCase().includes(q) ||
      r.report_no?.toLowerCase().includes(q) ||
      r.site_engineer_name?.toLowerCase().includes(q) ||
      r.site_condition?.toLowerCase().includes(q) ||
      r.project_name?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q);

    const st = String(r.status || "DRAFT").toUpperCase();
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "DRAFT" && (st === "DRAFT" || st === "RETURNED")) ||
      (statusFilter === "PENDING" && (st === "PENDING_APPROVAL" || st === "SUBMITTED" || st === "UNDER_REVIEW")) ||
      (statusFilter === "APPROVED" && st === "APPROVED") ||
      (statusFilter === "REJECTED" && st === "REJECTED");

    return matchSearch && matchStatus;
  });

  const totalHeadcount = reports.reduce((acc, r) => acc + (Number(r.total_headcount) || 0), 0);
  const approvedCount = reports.filter((r) => String(r.status).toUpperCase() === "APPROVED").length;
  const pendingCount = reports.filter((r) =>
    ["PENDING_APPROVAL", "SUBMITTED", "UNDER_REVIEW"].includes(String(r.status).toUpperCase())
  ).length;
  const draftCount = reports.filter((r) =>
    ["DRAFT", "RETURNED", ""].includes(String(r.status || "DRAFT").toUpperCase())
  ).length;

  return (
    <div className="space-y-6">
      {/* Canonical Apple-style Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/project-management"
            className="btn btn-secondary inline-flex items-center gap-1.5 shadow-sm"
          >
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-brand-50 text-brand-900 dark:bg-brand-900/30 dark:text-brand-400 border border-brand-200/50 dark:border-brand-800/50 shadow-sm">
                <BookOpen size={20} />
              </span>
              Daily Site Diary (DSR)
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5 font-normal">
              Site weather, daily workforce headcount, plant deployment, material receipts, and activity logs
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project Filter */}
          <select
            className="input text-sm py-1.5 h-9 min-w-[190px] shadow-sm bg-white dark:bg-slate-800"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_code ? `${p.project_code} - ` : ""}
                {p.project_name || p.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="input text-sm py-1.5 h-9 min-w-[130px] shadow-sm bg-white dark:bg-slate-800"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search reports..."
              className="input pl-9 pr-3 py-1.5 text-sm h-9 w-44 md:w-52 shadow-sm bg-white dark:bg-slate-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchReports}
            className="btn btn-secondary p-2 h-9 w-9 flex items-center justify-center shadow-sm"
            title="Refresh List"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-brand-600" : ""} />
          </button>

          {/* Primary Create Button */}
          <Link
            to={
              selectedProjectId
                ? `/project-management/daily-reports/new?project_id=${selectedProjectId}`
                : `/project-management/daily-reports/new`
            }
            className="btn btn-primary inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> New Daily Report
          </Link>
        </div>
      </div>

      {/* Reports Table Card */}
      <div className="card overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-2xl">
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/80 flex justify-between items-center">
          <h2 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
            Daily Logged Site Diaries ({filteredReports.length})
          </h2>
          {statusFilter !== "ALL" && (
            <span className="text-xs text-slate-500">
              Filtered by: <span className="font-semibold text-slate-700 dark:text-slate-300">{statusFilter}</span>
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="table w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-4">Report #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Weather</th>
                <th className="py-3 px-4">Site Condition</th>
                <th className="py-3 px-4 text-center">Workforce</th>
                <th className="py-3 px-4 text-center">Activities</th>
                <th className="py-3 px-4">Site Engineer</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center min-w-[280px]">Action & Approval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400 italic">
                    {reports.length === 0
                      ? 'No daily reports recorded for this project yet. Click "New Daily Report" to log today\'s site diary.'
                      : 'No daily site reports match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredReports.map((r) => {
                  const displayStatus = String(r.status || "DRAFT").toUpperCase();
                  const isApproved = displayStatus === "APPROVED";
                  const isPending =
                    displayStatus === "PENDING_APPROVAL" ||
                    displayStatus === "SUBMITTED" ||
                    displayStatus === "UNDER_REVIEW";

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Report # */}
                      <td className="py-3 px-4 font-mono font-bold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                        {r.report_number || r.report_no}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {r.report_date ? r.report_date.split("T")[0] : "-"}
                      </td>

                      {/* Weather */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                          <CloudSun size={15} className="text-amber-500 shrink-0" />
                          <span className="text-xs font-medium">
                            {r.weather_morning || "SUNNY"} / {r.weather_afternoon || "SUNNY"}
                          </span>
                        </span>
                      </td>

                      {/* Site Condition */}
                      <td className="py-3 px-4 uppercase text-xs font-semibold text-slate-500 whitespace-nowrap">
                        {r.site_condition || "DRY"}
                      </td>

                      {/* Workforce Headcount */}
                      <td className="py-3 px-4 text-center font-bold text-blue-600 dark:text-blue-400 font-mono whitespace-nowrap">
                        {r.total_headcount || 0} Pers
                      </td>

                      {/* Activity Count */}
                      <td className="py-3 px-4 text-center font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {r.activity_count || 0} Tasks
                      </td>

                      {/* Site Engineer */}
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap">
                        {r.site_engineer_name || r.reporting_officer_name || "Resident Engineer"}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isApproved
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                              : isPending
                              ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                              : displayStatus === "REJECTED"
                              ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                              : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          }`}
                        >
                          {displayStatus === "PENDING_APPROVAL" ? "PENDING APPROVAL" : displayStatus}
                        </span>
                      </td>

                      {/* Action & Approval Workflow Column (Standard Canonical Omnisuite Layout) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5 flex-nowrap">
                          {/* Slot 1: View */}
                          <Link
                            to={`/project-management/daily-reports/${r.id}`}
                            className="p-1.5 h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center justify-center transition-colors shadow-sm"
                            title="View Daily Site Report"
                          >
                            <Eye size={15} />
                          </Link>

                          {/* Slot 2: Edit (if not approved) */}
                          {!isApproved ? (
                            <Link
                              to={`/project-management/daily-reports/${r.id}?mode=edit`}
                              className="p-1.5 h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center justify-center transition-colors shadow-sm"
                              title="Edit Daily Site Report"
                            >
                              <Edit2 size={15} />
                            </Link>
                          ) : (
                            <div className="w-9 h-9" />
                          )}

                          {/* Slot 3: Print */}
                          <button
                            type="button"
                            onClick={() => handlePrint(r)}
                            className="p-1.5 h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center justify-center transition-colors shadow-sm"
                            title="Print / Export Daily Site Diary"
                          >
                            <Printer size={15} />
                          </button>

                          {/* Slot 4: Approval Workflow Slot */}
                          <div className="list-approval-slot inline-flex items-center">
                            {isApproved ? (
                              <div className="flex items-center gap-1.5">
                                <span className="list-approval-approved-pill text-xs px-3 py-1.5 h-9">
                                  Approved
                                </span>
                                {canReverseApproval() && (
                                  <button
                                    type="button"
                                    onClick={() => openReverseModal(r)}
                                    className="list-approval-reverse-btn text-xs px-2.5 py-1.5 h-9 font-medium"
                                    title="Reverse Approval"
                                  >
                                    Reverse
                                  </button>
                                )}
                              </div>
                            ) : isPending ? (
                              <span className="list-approval-forwarded-pill text-xs px-3 py-1.5 h-9 max-w-[190px]">
                                Forwarded to {r.forwarded_to_username || forwardedTo[r.id] || "Approver"}
                              </span>
                            ) : displayStatus !== "REJECTED" ? (
                              <button
                                type="button"
                                onClick={() => openForwardModal(r)}
                                className="list-approval-forward-btn text-xs px-3 py-1.5 h-9 font-medium"
                                disabled={submittingForward}
                              >
                                Forward for Approval
                              </button>
                            ) : null}
                          </div>

                          {/* Slot 5: Delete (if draft & permitted) */}
                          {!isApproved && !isPending && canDeleteOnPage("project-management:daily-reports") && (
                            <button
                              type="button"
                              onClick={() => handleDeleteReport(r)}
                              className="p-1.5 h-9 w-9 rounded-lg text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 dark:border-rose-900 inline-flex items-center justify-center transition-colors shadow-sm"
                              title="Delete Report"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. Forward for Approval Modal (Mirroring SalesOrderList) */}
      {/* ======================================================== */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-900 dark:text-brand-400 flex items-center justify-center font-bold flex-shrink-0 border border-brand-200/50 dark:border-brand-800/50">
                  <Send size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Forward for Approval</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Submit daily site diary into the approval workflow
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedReport(null);
                  setWfError("");
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Document Number:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {selectedReport?.report_number || selectedReport?.report_no || `#${selectedReport?.id}`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Report Date:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {selectedReport?.report_date ? selectedReport.report_date.split("T")[0] : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Site Engineer:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedReport?.site_engineer_name || selectedReport?.reporting_officer_name || "Engineer"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Workflow:</span>
                  <span className="font-semibold text-brand-600 dark:text-brand-400">
                    {candidateWorkflow
                      ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})`
                      : "Default Management Approval"}
                  </span>
                </div>
              </div>

              {wfLoading && (
                <div className="text-xs text-brand-600 font-medium flex items-center gap-2">
                  <RefreshCw size={13} className="animate-spin" /> Loading workflow approvers...
                </div>
              )}

              {wfError && (
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs">
                  {wfError}
                </div>
              )}

              {/* Target Approver Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Target Approver *
                </label>
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
                    <div>
                      <select
                        className="input w-full text-sm h-10"
                        value={targetApproverId || ""}
                        onChange={(e) => setTargetApproverId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Select target approver</option>
                        {opts.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}`
                          : "First review step"}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs border border-amber-200">
                      Standard site supervisor approval will apply upon submission.
                    </div>
                  );
                })()}
              </div>

              {/* Comments */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Submission Notes / Remarks
                </label>
                <textarea
                  className="input w-full min-h-[70px] text-xs p-2.5"
                  placeholder="Notes for the reviewer regarding today's activities..."
                  value={forwardComments}
                  onChange={(e) => setForwardComments(e.target.value)}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900">
              <button
                type="button"
                className="btn btn-secondary px-4 py-2 text-sm font-medium"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedReport(null);
                  setWfError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary px-5 py-2 text-sm font-semibold inline-flex items-center gap-2"
                onClick={forwardDocument}
                disabled={submittingForward}
              >
                <Send size={15} /> {submittingForward ? "Forwarding..." : "Forward for Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. Reverse Approval Confirmation Modal                   */}
      {/* ======================================================== */}
      {showReverseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold flex-shrink-0 border border-rose-200/50 dark:border-rose-800/50">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Reverse Approval</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Revert certified daily report back to Draft status
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReverseModal(false);
                  setSelectedReport(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                You are about to reverse the approval for Daily Site Report{" "}
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {selectedReport?.report_number || selectedReport?.report_no || `#${selectedReport?.id}`}
                </span>
                . This will unlock the report for editing and require a new forward-for-approval cycle.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Reversal Reason / Audit Notes *
                </label>
                <textarea
                  className="input w-full min-h-[80px] text-xs p-2.5"
                  placeholder="State reason for reversal (e.g. incorrect headcount, revision requested by client)..."
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900">
              <button
                type="button"
                className="btn btn-secondary px-4 py-2 text-sm font-medium"
                onClick={() => {
                  setShowReverseModal(false);
                  setSelectedReport(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-sm font-semibold inline-flex items-center gap-2"
                onClick={confirmReverseReport}
                disabled={submittingReverse}
              >
                <RotateCcw size={15} /> {submittingReverse ? "Reversing..." : "Confirm Reversal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. Print Preview Modal                                   */}
      {/* ======================================================== */}
      {showPrintModal && printReport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <Printer size={20} className="text-brand-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Daily Site Diary Print Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
                >
                  <Printer size={14} /> Print Document
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 text-slate-800 dark:text-slate-200">
              {/* Header */}
              <div className="border-b pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">DAILY SITE REPORT (DSR)</h1>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    REPORT #: {printReport.report_number || printReport.report_no}
                  </p>
                  <p className="text-xs text-slate-500">PROJECT: {printReport.project_name || "General Project"}</p>
                </div>
                <div className="text-right text-xs space-y-1">
                  <p><span className="text-slate-500">DATE:</span> <span className="font-mono font-bold">{printReport.report_date?.split("T")[0]}</span></p>
                  <p><span className="text-slate-500">STATUS:</span> <span className="font-bold">{printReport.status}</span></p>
                  <p><span className="text-slate-500">ENGINEER:</span> {printReport.site_engineer_name || printReport.reporting_officer_name}</p>
                </div>
              </div>

              {/* Weather & Site Condition */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
                <div>
                  <p className="text-slate-500 font-semibold uppercase">Morning Weather</p>
                  <p className="font-bold mt-0.5">{printReport.weather_morning || "SUNNY"}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-semibold uppercase">Afternoon Weather</p>
                  <p className="font-bold mt-0.5">{printReport.weather_afternoon || "SUNNY"}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-semibold uppercase">Site Condition</p>
                  <p className="font-bold mt-0.5">{printReport.site_condition || "DRY"}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-semibold uppercase">Working Hours</p>
                  <p className="font-bold font-mono mt-0.5">{printReport.working_hours_from || "08:00"} - {printReport.working_hours_to || "17:00"}</p>
                </div>
              </div>

              {/* Workforce & Summary */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 uppercase font-semibold">Total Workforce Headcount</p>
                  <p className="text-2xl font-medium mt-1 text-blue-600">{printReport.total_headcount || 0} Persons</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 uppercase font-semibold">Total Activities Recorded</p>
                  <p className="text-2xl font-bold font-mono mt-1 text-brand-600">{printReport.activity_count || 0} Items</p>
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-3 text-xs">
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-300 uppercase">HSE Observations & Incidents:</p>
                  <p className="p-3 mt-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {printReport.safety_observations || "No incidents or safety hazards recorded today."}
                  </p>
                </div>
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-300 uppercase">General Remarks / Site Instructions:</p>
                  <p className="p-3 mt-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {printReport.general_remarks || "Normal progression according to site master schedule."}
                  </p>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 border-t grid grid-cols-2 gap-8 text-xs">
                <div>
                  <div className="border-b border-dashed border-slate-400 pb-1 font-bold">
                    {printReport.site_engineer_name || printReport.reporting_officer_name || "Resident Engineer"}
                  </div>
                  <p className="text-slate-400 mt-1">Prepared By (Site Engineer)</p>
                </div>
                <div className="text-right">
                  <div className="border-b border-dashed border-slate-400 pb-1 font-bold">
                    {printReport.approved_by_name || (printReport.status === "APPROVED" ? "Certified Reviewer" : "Pending Signature")}
                  </div>
                  <p className="text-slate-400 mt-1">Reviewed & Approved By (Project Director / Consultant)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
