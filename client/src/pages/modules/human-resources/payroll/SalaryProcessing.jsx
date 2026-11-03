/**
 * @fileoverview SalaryProcessing component.
 * Provides functionality for SalaryProcessing.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";
import { SkipForward, CheckCircle2, Clock, Lock, Send, X, AlertCircle } from "lucide-react";
import ReverseApprovalButton from "../../../../components/ReverseApprovalButton.jsx";
import LoanPeriodSkipsModal from "./LoanPeriodSkipsModal";

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// ─── stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = "blue" }) {
  const textColors = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-emerald-600 dark:text-emerald-400",
    red: "text-rose-600 dark:text-rose-400",
    amber: "text-amber-600 dark:text-amber-400",
    purple: "text-purple-600 dark:text-purple-400",
  };
  const textColor = textColors[color] || textColors.blue;

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
      <span className={`text-xs font-bold uppercase tracking-wider block ${textColor}`}>
        {label}
      </span>
      <div className={`text-2xl font-bold font-mono mt-1 ${textColor}`}>
        {value}
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function SalaryProcessing() {
  const navigate = useNavigate();
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [previewData, setPreviewData] = useState(null); // { source, items }
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [expandedLoans, setExpandedLoans] = useState({});
  const [components, setComponents] = useState([]);
  const [showLoanSkipsModal, setShowLoanSkipsModal] = useState(false);

  // ── Approval Workflow State ───────────────────────────────────────────────
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardComments, setForwardComments] = useState("");
  const [submittingForward, setSubmittingForward] = useState(false);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [approvingDirect, setApprovingDirect] = useState(false);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [firstApprover, setFirstApprover] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");

  // load payroll periods and components on mount
  useEffect(() => {
    api
      .get("/hr/payroll/periods")
      .then((r) => {
        const periodList = r?.data?.items || [];
        setPeriods(periodList);
        if (periodList.length > 0) {
          setSelectedPeriod((prev) => {
            if (prev) return prev;
            const openPeriod = periodList.find((p) => p.status === "OPEN") || periodList[0];
            return openPeriod ? String(openPeriod.id) : "";
          });
        }
      })
      .catch(() => toast.error("Failed to load payroll periods"));
    api
      .get("/hr/salary-components")
      .then((r) => setComponents(r?.data?.items || []))
      .catch(() => toast.warn("Failed to load salary components"));
    api
      .get("/workflows/users", { params: { active: 1, limit: 100 } })
      .then((res) => setCompanyUsers(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => {});
  }, []);

  // ── preview ────────────────────────────────────────────────────────────────
  const loadPreview = useCallback(async (periodIdArg, showToast = false) => {
    const periodToUse = periodIdArg !== undefined ? periodIdArg : selectedPeriod;
    if (!periodToUse) {
      if (showToast) toast.error("Select a payroll period first");
      return;
    }
    setLoading(true);
    try {
      // Primary: try the actual computed breakdown (from hr_payroll_items)
      const bRes = await api.get(
        `/hr/payroll/breakdown?period_id=${periodToUse}`,
      );
      const breakdownItems = bRes?.data?.items || [];

      if (breakdownItems.length > 0) {
        setPreviewData({
          source: "actual",
          ...bRes.data,
          items: breakdownItems,
        });
        if (showToast) {
          toast.success(
            `Loaded actual breakdown for ${breakdownItems.length} employee(s)`,
          );
        }
      } else {
        // Fallback: no payroll generated yet → show employees with base salary estimate
        const eRes = await api.get("/hr/employees");
        const emps = (eRes?.data?.items || []).filter(
          (e) => e.status === "ACTIVE" || !e.status,
        );
        const estimated = emps.map((e) => ({
          employee_id: e.id,
          emp_code: e.emp_code,
          first_name: e.first_name,
          last_name: e.last_name,
          basic_salary: Number(e.base_salary || 0),
          allowances_total: 0,
          ssf_employee: 0,
          tier3_employee: 0,
          income_tax: 0,
          deductions: 0,
          net_salary: Number(e.base_salary || 0),
        }));
        setPreviewData({
          source: "estimate",
          ...(bRes?.data || {}),
          items: estimated,
        });
        if (showToast) {
          toast.info("No payroll generated yet — showing base salary estimates");
        }
      }
    } catch (err) {
      if (showToast) toast.error("Failed to load preview");
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  // Automatically fetch preview / approval status whenever selectedPeriod changes
  useEffect(() => {
    if (selectedPeriod) {
      loadPreview(selectedPeriod, false);
    } else {
      setPreviewData(null);
    }
  }, [selectedPeriod, loadPreview]);

  // ── generate payroll ───────────────────────────────────────────────────────
  const processSalaries = async () => {
    if (!selectedPeriod) return toast.error("Select a payroll period first");
    setProcessing(true);
    try {
      await api.post("/hr/payroll/generate", {
        period_id: Number(selectedPeriod),
      });
      toast.success("Payroll generated successfully!");
      setTimeout(() => loadPreview(), 800);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to process salaries";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };
  // ── Approval Workflow Logic ───────────────────────────────────────────────
  const openForwardModal = async () => {
    if (!selectedPeriod) return toast.error("Select a payroll period first");
    setShowForwardModal(true);
    setWfError("");
    setForwardComments("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        const wItems = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(wItems);
        await computeCandidateFromList(wItems);
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
      setWorkflowSteps([]);
      return;
    }
    const synonyms = [
      "SALARY_PROCESSING", "PAYROLL", "HR_PAYROLL", "Salary Processing", "Payroll",
      "PAYROLL_PROCESSING", "Payroll Processing", "PAYROLL PROCESSING"
    ];
    const normalize = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route || "").startsWith("/human-resources/payroll")
      ) ||
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && (
          (synonyms.some(syn => normalize(w.document_type) === normalize(syn)) || synonyms.some(syn => normalize(w.workflow_name) === normalize(syn))) ||
          synonyms.some(syn => normalize(w.workflow_name) === normalize(syn))
        )
      ) || null;

    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    setTargetApproverId(null);
    setWorkflowSteps([]);
    if (!chosen) return;

    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res?.data?.item || {};
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first ? {
          userId: first.approver_user_id,
          name: first.approver_name,
          stepName: first.step_name,
          stepOrder: first.step_order,
          approvalLimit: first.approval_limit,
        } : null
      );
      if (first) {
        const defaultTarget = (Array.isArray(first.approvers) && first.approvers.length ? first.approvers[0].id : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget || (companyUsers.length > 0 ? companyUsers[0].id : null));
      }
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  const computeCandidateFromList = async (wList) => {
    if (!wList || !wList.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWorkflowSteps([]);
      return;
    }
    const synonyms = [
      "SALARY_PROCESSING", "PAYROLL", "HR_PAYROLL", "Salary Processing", "Payroll",
      "PAYROLL_PROCESSING", "Payroll Processing", "PAYROLL PROCESSING"
    ];
    const normalize = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
    const chosen =
      wList.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route || "").startsWith("/human-resources/payroll")
      ) ||
      wList.find(
        (w) => Number(w.is_active) === 1 && (
          (synonyms.some(syn => normalize(w.document_type) === normalize(syn)) || synonyms.some(syn => normalize(w.workflow_name) === normalize(syn))) ||
          synonyms.some(syn => normalize(w.workflow_name) === normalize(syn))
        )
      ) || null;

    setCandidateWorkflow(chosen || null);
    if (!chosen) return;

    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res?.data?.item || {};
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first ? {
          userId: first.approver_user_id,
          name: first.approver_name,
          stepName: first.step_name,
          stepOrder: first.step_order,
          approvalLimit: first.approval_limit,
        } : null
      );
      if (first) {
        const defaultTarget = (Array.isArray(first.approvers) && first.approvers.length ? first.approvers[0].id : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget || (companyUsers.length > 0 ? companyUsers[0].id : null));
      }
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  const forwardDocument = async () => {
    if (!selectedPeriod) return;
    setSubmittingForward(true);
    setWfError("");
    let optimisticApprover = null;
    try {
      const first = Array.isArray(workflowSteps) && workflowSteps.length ? workflowSteps[0] : null;
      const opts = first ? (Array.isArray(first.approvers) && first.approvers.length ? first.approvers.map(u => ({ id: u.id, name: u.username })) : (first.approver_user_id ? [{ id: first.approver_user_id, name: first.approver_name || String(first.approver_user_id) }] : [])) : [];
      if (targetApproverId && opts.length) {
        const hit = opts.find(u => Number(u.id) === Number(targetApproverId));
        optimisticApprover = hit ? hit.name : null;
      }
    } catch {}

    setPreviewData(prev => prev ? ({ ...prev, payroll_status: "PENDING_APPROVAL", forwarded_to_username: optimisticApprover || "Approver", is_approved: false }) : prev);
    setShowForwardModal(false);

    try {
      const first = Array.isArray(workflowSteps) && workflowSteps.length ? workflowSteps[0] : null;
      let effectiveTargetId = targetApproverId;
      if (!effectiveTargetId) {
        if (first && Array.isArray(first.approvers) && first.approvers.length > 0) {
          effectiveTargetId = Number(first.approvers[0].id);
        } else if (first && first.approver_user_id) {
          effectiveTargetId = Number(first.approver_user_id);
        }
      }

      const res = await api.post("/hr/payroll/submit", {
        period_id: Number(selectedPeriod),
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: effectiveTargetId || null,
        comments: forwardComments,
      });
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      const approverName = res?.data?.forwarded_to_username || optimisticApprover || "Approver";
      setPreviewData(prev => prev ? ({ ...prev, payroll_status: newStatus, forwarded_to_username: approverName, is_approved: newStatus === 'APPROVED' }) : prev);
      toast.success(res?.data?.message || "Processed salary forwarded for approval");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to forward payroll for approval");
      loadPreview();
    } finally {
      setSubmittingForward(false);
    }
  };

  const handleApprovePayroll = async () => {
    if (!selectedPeriod) return;
    setApprovingDirect(true);
    try {
      const res = await api.post("/hr/payroll/approve", {
        period_id: Number(selectedPeriod),
        payroll_id: previewData?.payroll_id || null,
      });
      setPreviewData(prev => prev ? ({ ...prev, payroll_status: "APPROVED", is_approved: true, forwarded_to_username: null }) : prev);
      toast.success(res?.data?.message || "Payroll approved successfully! Payslips are now unlocked.");
      loadPreview();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to approve payroll");
    } finally {
      setApprovingDirect(false);
    }
  };

  const items = previewData?.items || [];

  // Identify dynamic columns (allowances and loans) present in the data
  const dynamicAllowCols = Array.from(
    new Set(
      items.flatMap((r) =>
        Object.keys(r.allowances || {}).map((id) => `allowance_${id}`),
      ),
    ),
  );
  const dynamicLoanCols = Array.from(
    new Set(
      items.flatMap((r) =>
        Object.keys(r.loan_items || {}).map((id) => `loan_${id}`),
      ),
    ),
  );
  const employeeComponentColumns = Array.from(
    new Map(
      items
        .flatMap((row) => row.employee_components || [])
        .map((component) => [component.column_name, component]),
    ).values(),
  );
  const employeeEarningColumns = employeeComponentColumns.filter(
    (component) => component.is_earning,
  );
  const employeeDeductionColumns = employeeComponentColumns.filter(
    (component) => !component.is_earning,
  );

  const totals = items.reduce(
    (acc, r) => {
      const next = {
        basic: acc.basic + Number(r.basic_salary || 0),
        allowances: acc.allowances + Number(r.allowances_total || 0),
        employeeEarnings:
          acc.employeeEarnings +
          (r.employee_components || [])
            .filter((component) => component.is_earning)
            .reduce((sum, component) => sum + Number(component.amount || 0), 0),
        ssf: acc.ssf + Number(r.ssf_employee || 0),
        tier3: acc.tier3 + Number(r.tier3_employee || 0),
        tax_relief: acc.tax_relief + Number(r.tax_relief || 0),
        loans: acc.loans + Number(r.loan_deductions || 0),
        income_tax: acc.income_tax + Number(r.income_tax || 0),
        deductions: acc.deductions + Number(r.deductions || 0),
        net: acc.net + Number(r.net_salary || 0),
      };
      // Sum for dynamic allowance cols
      dynamicAllowCols.forEach((col) => {
        const aid = col.replace("allowance_", "");
        acc.dynamicAllowances[aid] =
          (acc.dynamicAllowances[aid] || 0) + Number(r.allowances?.[aid] || 0);
      });
      // Sum for dynamic loan cols
      dynamicLoanCols.forEach((col) => {
        const lid = col.replace("loan_", "");
        const val = r.loan_items?.[lid]?.amount ?? r.loan_items?.[lid] ?? 0;
        acc.dynamicLoans[lid] = (acc.dynamicLoans[lid] || 0) + Number(val);
      });
      return {
        ...next,
        dynamicAllowances: acc.dynamicAllowances,
        dynamicLoans: acc.dynamicLoans,
        dynamicEmployeeComponents: Object.assign(
          acc.dynamicEmployeeComponents,
          Object.fromEntries(
            (r.employee_components || []).map((component) => [
              component.column_name,
              (acc.dynamicEmployeeComponents[component.column_name] || 0) +
                Number(component.amount || 0),
            ]),
          ),
        ),
      };
    },
    {
      basic: 0,
      allowances: 0,
      employeeEarnings: 0,
      ssf: 0,
      tier3: 0,
      tax_relief: 0,
      loans: 0,
      income_tax: 0,
      deductions: 0,
      net: 0,
      dynamicAllowances: {},
      dynamicLoans: {},
      dynamicEmployeeComponents: {},
    },
  );

  const selectedPeriodObj = periods.find(
    (p) => String(p.id) === String(selectedPeriod),
  );

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-5">
        {/* ── header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="btn-secondary text-sm"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Process Salaries
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a payroll period, preview computed salaries, then generate
              payroll.
            </p>
          </div>
        </div>

        {/* ── period selector + actions ────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Payroll Period <span className="text-red-500">*</span>
              </label>
              <select
                className="input w-full"
                value={selectedPeriod}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value);
                }}
              >
                <option value="">— Select Period —</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.period_name} ({fmtDate(p.start_date)} →{" "}
                    {fmtDate(p.end_date)})
                    {p.status === "CLOSED" ? " ✓ Closed" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-secondary h-10 px-4 flex items-center gap-2 border-slate-300 dark:border-slate-600"
              onClick={() => setShowLoanSkipsModal(true)}
              disabled={!selectedPeriod}
              title="Review or skip loan deductions for this payroll month"
            >
              <SkipForward className="w-4 h-4 text-brand" />
              <span>Loan Deductions</span>
            </button>

            {!previewData?.is_approved && (
              <button
                className="btn-primary h-10 px-5 flex items-center gap-2"
                onClick={processSalaries}
                disabled={processing || !selectedPeriod}
              >
                {processing ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />{" "}
                    Generating…
                  </>
                ) : (
                  <>
                    <span>⚡</span> Generate Payroll
                  </>
                )}
              </button>
            )}

            {(previewData?.source === "actual" || previewData?.payroll_id) && (
              <div className="flex items-center gap-2">
                {previewData.is_approved ? (
                  <>
                    <span className="list-approval-approved-pill h-10 px-3.5 flex items-center gap-1.5 font-medium text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Approved {previewData.approved_by_username ? `by ${previewData.approved_by_username}` : ""}
                    </span>
                    <ReverseApprovalButton
                      docType="PAYROLL"
                      docId={previewData.payroll_id}
                      onDone={() => loadPreview(selectedPeriod, false)}
                      className="list-approval-reverse-btn h-10 px-3.5 text-xs"
                    >
                      Reverse Approval
                    </ReverseApprovalButton>
                    <button
                      className="btn-success h-10 px-4 flex items-center gap-2 text-xs font-semibold"
                      onClick={() => navigate("/human-resources/payslips")}
                      title="View and distribute generated payslips"
                    >
                      <span>📄</span> View Payslips
                    </button>
                  </>
                ) : previewData.payroll_status === "PENDING_APPROVAL" ? (
                  <>
                    <span className="list-approval-forwarded-pill h-10 px-3.5 flex items-center gap-1.5 text-xs font-medium">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Forwarded to {previewData.forwarded_to_username || "Approver"}
                    </span>
                    <button
                      disabled
                      className="btn-secondary h-10 px-4 flex items-center gap-2 text-xs opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border border-dashed border-amber-300 dark:border-amber-700"
                      title="Approval required: Payslips cannot be viewed or sent until payroll is approved on Homepage"
                    >
                      <Lock className="w-4 h-4 text-amber-500" />
                      Payslips Locked (Pending Approval)
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="list-approval-forward-btn h-10 px-4 flex items-center gap-2 text-xs font-semibold"
                      onClick={openForwardModal}
                      disabled={submittingForward}
                    >
                      <Send className="w-4 h-4" />
                      Forward for Approval
                    </button>
                    <button
                      disabled
                      className="btn-secondary h-10 px-4 flex items-center gap-2 text-xs opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border border-dashed border-slate-300 dark:border-slate-700"
                      title="Forward for approval first. Payslips cannot be viewed or sent until payroll is approved"
                    >
                      <Lock className="w-4 h-4 text-slate-400" />
                      Payslips Locked (Unapproved)
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── preview section ──────────────────────────────────────────────── */}
        {previewData && (
          <>
            {/* Approval Workflow Status Banner */}
            {(previewData.source === "actual" || previewData.payroll_id) && (
              !previewData.is_approved ? (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3 shadow-sm">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-lg text-amber-700 dark:text-amber-300 mt-0.5 shrink-0">
                    <Lock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                        Approval Required — Salary Slips Restricted
                      </h4>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-200 dark:bg-amber-850 text-amber-900 dark:text-amber-100 uppercase tracking-wide border border-amber-300 dark:border-amber-700">
                        {previewData.payroll_status || "PENDING"}
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-1 leading-relaxed">
                      This payroll has been calculated and processed, but has not yet been formally approved.
                      Employee salary slips are locked and cannot be viewed, printed, or emailed until this payroll is authorized.
                      {previewData.forwarded_to_username && (
                        <span className="block mt-1 font-medium text-amber-900 dark:text-amber-100">
                          Currently forwarded to: <span className="underline">{previewData.forwarded_to_username}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between gap-3 shadow-sm flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 rounded-lg text-emerald-700 dark:text-emerald-300 shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                          Payroll Fully Approved
                        </h4>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-200 dark:bg-emerald-850 text-emerald-900 dark:text-emerald-100 uppercase tracking-wide">
                          APPROVED
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 dark:text-emerald-300/90 mt-0.5">
                        Authorized {previewData.approved_by_username ? `by ${previewData.approved_by_username}` : ""} {previewData.approved_at ? `on ${fmtDate(previewData.approved_at)}` : ""}. Salary slips are unlocked and ready for viewing and employee distribution.
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-success h-9 px-4 text-xs font-semibold flex items-center gap-1.5 shrink-0"
                    onClick={() => navigate("/human-resources/payslips")}
                  >
                    <span>📄</span> Distribute Salary Slips
                  </button>
                </div>
              )
            )}

            {/* source badge */}
            <div className="flex items-center gap-2">
              {previewData.source !== "actual" && (
                <span className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold px-3 py-1 rounded-full border border-amber-200 dark:border-amber-700">
                  ⚠ Estimated preview — source:{" "}
                  <code className="font-mono">hr_employees.base_salary</code> ·
                  Click Generate to compute actual values
                </span>
              )}
            </div>

            {/* summary stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Employees" value={items.length} color="blue" />
              <StatCard
                label="Gross Payroll"
                value={fmt(
                  totals.basic + totals.allowances + totals.employeeEarnings,
                )}
                color="green"
              />
              <StatCard
                label="Total SSF"
                value={fmt(totals.ssf)}
                color="amber"
              />
              <StatCard
                label="Total Tier 3"
                value={fmt(totals.tier3)}
                color="purple"
              />
              {totals.tax_relief > 0 && (
                <StatCard
                  label="Tax Relief"
                  value={fmt(totals.tax_relief)}
                  color="purple"
                />
              )}
              <StatCard
                label="Total PAYE"
                value={fmt(totals.income_tax)}
                color="red"
              />
              <StatCard
                label="Net Payroll"
                value={fmt(totals.net)}
                color="green"
              />
            </div>

            {/* breakdown table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Salary Breakdown — {items.length} employee
                  {items.length !== 1 ? "s" : ""}
                </h3>
                <span className="text-[10px] text-slate-400">
                  All amounts in base currency
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-2.5 text-left sticky left-0 bg-slate-50 dark:bg-slate-900/50 z-10">
                        Employee
                      </th>
                      <th className="px-3 py-2.5 text-left">Code</th>
                      <th className="px-3 py-2.5 text-right">Basic Salary</th>

                      {/* Dynamic Allowance Columns */}
                      {dynamicAllowCols.length > 0 ? (
                        dynamicAllowCols.map((col) => {
                          const comp = components.find(
                            (c) => c.column_name === col,
                          );
                          return (
                            <th
                              key={col}
                              className="px-3 py-2.5 text-right font-bold text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/10"
                            >
                              {comp?.label ||
                                col.replace("allowance_", "Allow. ")}
                            </th>
                          );
                        })
                      ) : employeeEarningColumns.length === 0 ? (
                        <th className="px-3 py-2.5 text-right">Allowances</th>
                      ) : null}

                      {employeeEarningColumns.map((component) => (
                        <th
                          key={component.column_name}
                          className="px-3 py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/10"
                        >
                          {component.label}
                        </th>
                      ))}

                      <th className="px-3 py-2.5 text-right bg-amber-50/50 dark:bg-amber-900/10">
                        SSF (Emp)
                      </th>
                      <th className="px-3 py-2.5 text-right bg-amber-50/50 dark:bg-amber-900/10">
                        Tier 3
                      </th>
                      <th className="px-3 py-2.5 text-right bg-teal-50/50 dark:bg-teal-900/10 text-teal-800 dark:text-teal-300">
                        Tax Relief
                      </th>
                      <th className="px-3 py-2.5 text-right bg-red-50/50 dark:bg-red-900/10">
                        PAYE Tax
                      </th>

                      {/* Dynamic Loan Columns */}
                      {dynamicLoanCols.length > 0 ? (
                        dynamicLoanCols.map((col) => {
                          const comp = components.find(
                            (c) => c.column_name === col,
                          );
                          return (
                            <th
                              key={col}
                              className="px-3 py-2.5 text-right font-bold text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10"
                            >
                              {comp?.label || col.replace("loan_", "Loan ")}
                            </th>
                          );
                        })
                      ) : (
                        <th className="px-3 py-2.5 text-right bg-red-50/50 dark:bg-red-900/10">
                          Loan Deductions
                        </th>
                      )}
                      {employeeDeductionColumns.map((component) => (
                        <th
                          key={component.column_name}
                          className="px-3 py-2.5 text-right font-bold text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10"
                        >
                          {component.label}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-right bg-red-50/50 dark:bg-red-900/10">
                        Total Deductions
                      </th>
                      <th className="px-3 py-2.5 text-right bg-green-50/50 dark:bg-green-900/10 font-extrabold text-green-700 dark:text-green-400">
                        Net Salary
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map((row) => (
                      <tr
                        key={row.employee_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-800 z-10 whitespace-nowrap">
                          {row.first_name} {row.last_name}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap">
                          {row.emp_code}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {fmt(row.basic_salary)}
                        </td>

                        {/* Dynamic Allowance Cells */}
                        {dynamicAllowCols.length > 0 ? (
                          dynamicAllowCols.map((col) => {
                            const aid = col.replace("allowance_", "");
                            const val = row.allowances?.[aid] || 0;
                            return (
                              <td
                                key={col}
                                className="px-3 py-2.5 text-right font-mono text-blue-700 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-900/5"
                              >
                                {fmt(val)}
                              </td>
                            );
                          })
                        ) : employeeEarningColumns.length === 0 ? (
                          <td className="px-3 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                            {fmt(row.allowances_total)}
                          </td>
                        ) : null}

                        {employeeEarningColumns.map((component) => (
                          <td
                            key={component.column_name}
                            className="px-3 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-900/5"
                          >
                            {fmt(
                              row.employee_components?.find(
                                (item) =>
                                  item.column_name === component.column_name,
                              )?.amount || 0,
                            )}
                          </td>
                        ))}

                        <td className="px-3 py-2.5 text-right font-mono text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/10">
                          {fmt(row.ssf_employee)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/10">
                          {fmt(row.tier3_employee)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-teal-700 dark:text-teal-400 bg-teal-50/20 dark:bg-teal-900/5">
                          {Number(row.tax_relief || 0) > 0 ? (
                            <span className="font-semibold">{fmt(row.tax_relief)}</span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-red-600 dark:text-red-400 bg-red-50/30 dark:bg-red-900/10">
                          {fmt(row.income_tax)}
                        </td>

                        {/* Dynamic Loan Cells */}
                        {dynamicLoanCols.length > 0 ? (
                          dynamicLoanCols.map((col) => {
                            const lid = col.replace("loan_", "");
                            const val =
                              row.loan_items?.[lid]?.amount ??
                              row.loan_items?.[lid] ??
                              0;
                            return (
                              <td
                                key={col}
                                className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-400 bg-red-50/30 dark:bg-red-900/10"
                              >
                                {fmt(val)}
                              </td>
                            );
                          })
                        ) : (
                          <td className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-300 bg-red-50/30 dark:bg-red-900/10">
                            <span>{fmt(row.loan_deductions || 0)}</span>
                          </td>
                        )}
                        {employeeDeductionColumns.map((component) => (
                          <td
                            key={component.column_name}
                            className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-400 bg-red-50/30 dark:bg-red-900/10"
                          >
                            {fmt(
                              row.employee_components?.find(
                                (item) =>
                                  item.column_name === component.column_name,
                              )?.amount || 0,
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-300 bg-red-50/30 dark:bg-red-900/10 font-semibold">
                          {fmt(row.deductions)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-green-700 dark:text-green-400 bg-green-50/30 dark:bg-green-900/10">
                          {fmt(row.net_salary)}
                        </td>
                      </tr>
                    ))}
                    {items.map((row) =>
                      expandedLoans[row.employee_id] &&
                      row.loan_items &&
                      Object.keys(row.loan_items).length > 0 ? (
                        <tr
                          key={`${row.employee_id}-loans`}
                          className="bg-slate-50/70 dark:bg-slate-700/40"
                        >
                          <td
                            colSpan={
                              8 +
                              dynamicAllowCols.length +
                              dynamicLoanCols.length +
                              employeeEarningColumns.length +
                              employeeDeductionColumns.length
                            }
                            className="px-3 py-2"
                          >
                            <div className="text-xs">
                              <div className="font-semibold mb-1">
                                Loan Breakdown
                              </div>
                              <div className="flex flex-wrap gap-3">
                                {Object.entries(row.loan_items || {}).map(
                                  ([lid, item]) => (
                                    <div
                                      key={lid}
                                      className="px-2 py-1 border rounded bg-white dark:bg-slate-800 shadow-sm"
                                    >
                                      <span className="mr-2 text-slate-600 dark:text-slate-300 font-semibold">
                                        {item.loan_type
                                          ? `${item.loan_type}`
                                          : `Loan ${lid}`}
                                      </span>
                                      <span className="font-mono text-slate-900 dark:text-slate-100 italic">
                                        {fmt(
                                          item.amount !== undefined
                                            ? item.amount
                                            : item,
                                        )}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    )}
                  </tbody>

                  {/* grand totals row */}
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-700 text-[11px] font-bold uppercase text-slate-600 dark:text-slate-200 border-t-2 border-slate-300 dark:border-slate-600">
                      <td className="px-3 py-2.5 sticky left-0 bg-slate-100 dark:bg-slate-700 z-10">
                        TOTAL ({items.length})
                      </td>
                      <td className="px-3 py-2.5" />
                      <td className="px-3 py-2.5 text-right font-mono">
                        {fmt(totals.basic)}
                      </td>

                      {/* Dynamic Allowance Totals */}
                      {dynamicAllowCols.length > 0 ? (
                        dynamicAllowCols.map((col) => {
                          const aid = col.replace("allowance_", "");
                          return (
                            <td
                              key={col}
                              className="px-3 py-2.5 text-right font-mono bg-blue-50/50 dark:bg-blue-900/20"
                            >
                              {fmt(totals.dynamicAllowances?.[aid] || 0)}
                            </td>
                          );
                        })
                      ) : employeeEarningColumns.length === 0 ? (
                        <td className="px-3 py-2.5 text-right font-mono">
                          {fmt(totals.allowances)}
                        </td>
                      ) : null}

                      {employeeEarningColumns.map((component) => (
                        <td
                          key={component.column_name}
                          className="px-3 py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/20"
                        >
                          {fmt(
                            totals.dynamicEmployeeComponents[
                              component.column_name
                            ] || 0,
                          )}
                        </td>
                      ))}

                      <td className="px-3 py-2.5 text-right font-mono text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/20">
                        {fmt(totals.ssf)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/20">
                        {fmt(totals.tier3)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/20">
                        {fmt(totals.income_tax)}
                      </td>

                      {/* Dynamic Loan Totals */}
                      {dynamicLoanCols.length > 0 ? (
                        dynamicLoanCols.map((col) => {
                          const lid = col.replace("loan_", "");
                          return (
                            <td
                              key={col}
                              className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-900/20"
                            >
                              {fmt(totals.dynamicLoans?.[lid] || 0)}
                            </td>
                          );
                        })
                      ) : (
                        <td className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-900/20">
                          {fmt(totals.loans)}
                        </td>
                      )}

                      {employeeDeductionColumns.map((component) => (
                        <td
                          key={component.column_name}
                          className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-900/20"
                        >
                          {fmt(
                            totals.dynamicEmployeeComponents[
                              component.column_name
                            ] || 0,
                          )}
                        </td>
                      ))}

                      <td className="px-3 py-2.5 text-right font-mono text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-900/20">
                        {fmt(totals.deductions)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-900/20 text-sm">
                        {fmt(totals.net)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── empty state ─────────────────────────────────────────────────── */}
        {!previewData && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 dark:text-slate-500">
            <span className="text-5xl mb-4">📊</span>
            <p className="text-base font-medium">
              Select a payroll period and click{" "}
              <strong>Preview Salaries</strong>
            </p>
            <p className="text-sm mt-1">
              If payroll has already been generated for the period, you'll see
              actual computed values.
              <br />
              Otherwise a base-salary estimate is shown and you can click{" "}
              <strong>Generate Payroll</strong> to compute exact figures.
            </p>
          </div>
        )}
      </div>
      {/* ── FORWARD FOR APPROVAL MODAL ────────────────────────────────────── */}
      {showForwardModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-8 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto sm:my-8 transition-all flex flex-col max-h-[90vh]">
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-900 dark:text-brand-400 flex items-center justify-center font-bold flex-shrink-0 border border-brand-200/50 dark:border-brand-800/50">
                  <Send size={20} className="text-brand" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Forward Payroll for Approval</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Submit processed salaries into the approval workflow</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForwardModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {wfLoading && (
                <div className="text-center py-4 text-slate-500">
                  <span className="animate-spin inline-block w-5 h-5 border-2 border-brand border-t-transparent rounded-full mb-2" />
                  <p>Resolving approval workflow...</p>
                </div>
              )}

              {wfError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
                  {wfError}
                </div>
              )}

              {!wfLoading && (
                <>
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Document:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        Payroll — {selectedPeriodObj?.period_name || `Period #${selectedPeriod}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Net Amount:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {fmt(totals.net)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Workflow:</span>
                      <span className="font-medium text-brand">
                        {candidateWorkflow ? candidateWorkflow.workflow_name || candidateWorkflow.document_type : "Default Salary Approval Workflow"}
                      </span>
                    </div>
                  </div>

                  {workflowSteps.length > 0 && (
                    <div className="space-y-2">
                      <label className="font-semibold text-slate-700 dark:text-slate-200 block">
                        Approval Routing Steps ({workflowSteps.length})
                      </label>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-850">
                        {workflowSteps.map((s, idx) => (
                          <div
                            key={s.id || idx}
                            className={`flex items-center justify-between p-2 rounded text-xs ${
                              idx === 0
                                ? "bg-brand/10 border border-brand/20 text-brand font-medium"
                                : "text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                                {s.step_order}
                              </span>
                              {s.step_name}
                            </span>
                            <span className="text-[11px] opacity-80">
                              {s.approver_name || (s.approver_user_id ? `User #${s.approver_user_id}` : "Assigned Approver")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Approver / User Selection */}
                  {(() => {
                    const firstStep = Array.isArray(workflowSteps) && workflowSteps.length ? workflowSteps[0] : null;
                    let opts = [];
                    if (firstStep && Array.isArray(firstStep.approvers) && firstStep.approvers.length > 0) {
                      opts = firstStep.approvers.map(u => ({ id: Number(u.id), name: u.username || u.name, email: u.email || "", fullName: u.full_name || "" }));
                    } else if (firstStep && firstStep.approver_user_id) {
                      opts = [{ id: Number(firstStep.approver_user_id), name: firstStep.approver_name || `User #${firstStep.approver_user_id}`, email: "", fullName: "" }];
                    }
                    // ONLY fallback to companyUsers if the workflow step has zero approvers configured
                    if (opts.length === 0 && companyUsers.length > 0) {
                      opts = companyUsers.map(u => ({ id: Number(u.id), name: u.username, email: u.email || "", fullName: u.full_name || "" }));
                    }
                    return (
                      <div>
                        <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                          Select Approver / User <span className="text-rose-500">*</span>
                        </label>
                        {opts.length > 0 ? (
                          <select
                            value={targetApproverId || (opts[0] ? opts[0].id : "")}
                            onChange={(e) => setTargetApproverId(e.target.value ? Number(e.target.value) : null)}
                            className="input w-full h-9 text-xs bg-white dark:bg-slate-800 font-medium"
                            required
                          >
                            {opts.length > 1 && <option value="">-- Choose Approver / User --</option>}
                            {opts.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} {u.fullName ? `(${u.fullName})` : ""} {u.email ? `• ${u.email}` : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-xs text-slate-500 p-2 bg-slate-100 dark:bg-slate-800 rounded">
                            Loading available approvers...
                          </div>
                        )}
                        {firstApprover && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Routing to Step {firstApprover.stepOrder || 1}: <span className="font-medium text-slate-700 dark:text-slate-200">{firstApprover.stepName}</span>
                            {firstApprover.approvalLimit != null && ` • Limit: ${firstApprover.approvalLimit}`}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                      Forwarding Notes / Remarks (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={forwardComments}
                      onChange={(e) => setForwardComments(e.target.value)}
                      placeholder="Add any context, summary or notes for the approver..."
                      className="input w-full text-xs"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setShowForwardModal(false)}
                className="btn-secondary h-9 px-4 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={forwardDocument}
                disabled={submittingForward || wfLoading}
                className="btn-primary h-9 px-5 text-xs flex items-center gap-1.5 font-semibold"
              >
                {submittingForward ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    Forwarding...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Confirm & Forward
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
          {showLoanSkipsModal && selectedPeriod && (
        <LoanPeriodSkipsModal
          open={showLoanSkipsModal}
          onClose={() => setShowLoanSkipsModal(false)}
          periodId={selectedPeriod}
          periodName={selectedPeriodObj?.period_name}
          onRefresh={loadPreview}
        />
      )}
    </Guard>
  );
}
