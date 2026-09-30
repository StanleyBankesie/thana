/**
 * @fileoverview SubmitAppraisals component.
 * Provides functionality for SubmitAppraisals.
 */

import React, { useEffect, useState, useCallback } from "react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import {
  CheckCircle, XCircle, AlertCircle, Send, Eye, Search, Filter,
  RefreshCw, Download, ChevronDown, Clock, Users, Award, TrendingUp,
  FileText, Activity, ArrowUpRight, ArrowDownRight, BarChart3, PieChart,
  MessageSquare, ThumbsUp, ThumbsDown, CornerUpLeft, Forward, AlertTriangle,
} from "lucide-react";

const STATUS_CONFIG = {
  DRAFT: { label: "Draft", color: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200" },
  PENDING_SUPERVISOR: { label: "Pending Supervisor", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  PENDING_HR: { label: "Pending HR", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  CLOSED: { label: "Closed", color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
};

function fmtDate(d) {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}>
      {status === "PENDING_SUPERVISOR" && <Clock size={12} />}
      {status === "PENDING_HR" && <Clock size={12} />}
      {status === "APPROVED" && <CheckCircle size={12} />}
      {status === "REJECTED" && <XCircle size={12} />}
      {status === "CLOSED" && <CheckCircle size={12} />}
      {cfg.label}
    </span>
  );
}

function ScoreBar({ value, max = 100, size = "sm" }) {
  const v = Math.min(Math.max(Number(value) || 0, 0), max);
  const pct = max > 0 ? (v / max) * 100 : 0;
  const color =
    pct >= 80 ? "bg-emerald-500" :
    pct >= 60 ? "bg-amber-500" :
    pct >= 40 ? "bg-orange-500" :
    "bg-red-500";
  const h = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${h} rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden`}>
        <div className={`${h} ${color} rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 w-8 text-right">
        {Number(value || 0).toFixed(0)}
      </span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, loading: isLoading }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-erp p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}
        </div>
        {isLoading ? (
          <div className="h-7 w-16 mt-1 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        ) : (
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            {typeof value === "number" ? (label === "Average Score" ? `${value.toFixed(1)}%` : value.toLocaleString()) : "-"}
          </div>
        )}
        {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function EmptyState({ search, onClear }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-700 mb-4">
        <FileText size={40} className="text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">
        {search ? "No matching appraisals found" : "No appraisals yet"}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-4">
        {search
          ? `No results for "${search}". Try adjusting your filters.`
          : "Appraisal records will appear here once they are created and submitted for review."}
      </p>
      {search && (
        <button onClick={onClear} className="btn-secondary text-sm">
          Clear filters
        </button>
      )}
    </div>
  );
}

function WorkflowTimeline({ log }) {
  if (!log || !log.length) {
    return <p className="text-sm text-slate-400 italic py-4 text-center">No workflow history available</p>;
  }
  return (
    <div className="relative pl-6 py-2">
      {log.map((entry, i) => {
        const isLast = i === log.length - 1;
        return (
          <div key={entry.id || i} className="relative pb-5 last:pb-0">
            {!isLast && (
              <div className="absolute left-[7px] top-3 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-600" />
            )}
            <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 flex items-center justify-center
              ${entry.action === 'APPROVE' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' :
                entry.action === 'REJECT' ? 'border-red-500 bg-red-50 dark:bg-red-900/30' :
                entry.action === 'SEND_BACK' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' :
                'border-blue-500 bg-blue-50 dark:bg-blue-900/30'}">
              <div className={`w-[7px] h-[7px] rounded-full
                ${entry.action === 'APPROVE' ? 'bg-emerald-500' :
                  entry.action === 'REJECT' ? 'bg-red-500' :
                  entry.action === 'SEND_BACK' ? 'bg-amber-500' :
                  'bg-blue-500'}`} />
            </div>
            <div className="ml-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {entry.action === "APPROVE" ? "Approved" :
                   entry.action === "REJECT" ? "Rejected" :
                   entry.action === "SEND_BACK" ? "Sent Back" :
                   entry.action === "SUBMIT" ? "Submitted" :
                   entry.action || "-"}
                </span>
                <span className="text-[10px] text-slate-400">
                  by {entry.actor_name || "System"}
                </span>
                <span className="text-[10px] text-slate-400">
                  {fmtDate(entry.created_at)}
                </span>
              </div>
              {entry.comments && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic">
                  "{entry.comments}"
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AppraisalDetail({ appraisal, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!appraisal?.id) return;
    let mounted = true;
    setLoading(true);
    api.get(`/hr/performance/appraisals/${appraisal.id}`)
      .then((res) => { if (mounted) setDetail(res.data); })
      .catch(() => { if (mounted) toast.error("Failed to load appraisal details"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [appraisal?.id]);

  if (loading) {
    return (
      <div className="border-t border-slate-200 dark:border-slate-600 p-8">
        <div className="flex items-center justify-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading details...</span>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="border-t border-slate-200 dark:border-slate-600 p-8 text-center text-sm text-slate-400">
        No detail data available
      </div>
    );
  }

  const { item, details, competencies, goals, workflowLog } = detail;

  return (
    <div className="border-t border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
      <div className="p-4 md:p-6 space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Employee</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <Users size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.employee_name}</div>
                    <div className="text-[10px] text-slate-400">{item.emp_code}</div>
                  </div>
                </div>
                <div className="pt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between"><span className="text-slate-400">Department</span><span>{item.dept_name || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Position</span><span>{item.pos_name || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Period</span><span>{item.review_period || "-"}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Scores</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">KPI Score</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{Number(item.kpi_score || 0).toFixed(1)}%</span>
                  </div>
                  <ScoreBar value={item.kpi_score} max={100} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Competency Score</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{Number(item.competency_score || 0).toFixed(1)}%</span>
                  </div>
                  <ScoreBar value={item.competency_score} max={100} />
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Overall</span>
                    <span className={`font-bold text-lg ${Number(item.overall_score || 0) >= 80 ? 'text-emerald-600' : Number(item.overall_score || 0) >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {Number(item.overall_score || 0).toFixed(1)}%
                    </span>
                  </div>
                  <ScoreBar value={item.overall_score} max={100} size="md" />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Status</h4>
              <div className="flex items-center gap-2 mb-3">
                <StatusBadge status={item.status} />
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                {item.supervisor_approved_at && <div>Supervisor: {fmtDate(item.supervisor_approved_at)}</div>}
                {item.hr_approved_at && <div>HR Approved: {fmtDate(item.hr_approved_at)}</div>}
                <div>Created: {fmtDate(item.created_at)}</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Period</h4>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div><span className="text-slate-400">Review Period:</span><br /><span className="font-medium">{item.review_period || "-"}</span></div>
                <div><span className="text-slate-400">Start:</span><br /><span className="font-medium">{fmtDate(item.start_date)}</span></div>
                <div><span className="text-slate-400">End:</span><br /><span className="font-medium">{fmtDate(item.end_date)}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <BarChart3 size={14} /> KPI Evaluation Scores
            </h4>
            {details && details.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-700">
                      <th className="pb-2 pr-2 font-medium">KPI</th>
                      <th className="pb-2 pr-2 font-medium text-right">Target</th>
                      <th className="pb-2 pr-2 font-medium text-right">Actual</th>
                      <th className="pb-2 pr-2 font-medium text-right">%</th>
                      <th className="pb-2 font-medium text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d) => (
                      <tr key={d.id} className="border-b border-slate-50 dark:border-slate-700/50">
                        <td className="py-1.5 pr-2 text-slate-700 dark:text-slate-200">{d.kpi_name || d.kpi_code || "-"}</td>
                        <td className="py-1.5 pr-2 text-right text-slate-500">{d.target_value != null ? d.target_value : "-"}</td>
                        <td className="py-1.5 pr-2 text-right text-slate-500">{d.actual_value != null ? d.actual_value : "-"}</td>
                        <td className="py-1.5 pr-2 text-right">
                          <span className={`font-medium ${Number(d.achievement_pct) >= 80 ? 'text-emerald-600' : Number(d.achievement_pct) >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {d.achievement_pct != null ? `${d.achievement_pct}%` : "-"}
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-semibold text-slate-700 dark:text-slate-200">{d.score != null ? d.score : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-2">No KPI scores recorded</p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Award size={14} /> Competency Scores
            </h4>
            {competencies && competencies.length > 0 ? (
              <div className="space-y-2">
                {competencies.map((c) => (
                  <div key={c.id}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-600 dark:text-slate-300">{c.competency_name}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{c.rating}/5</span>
                    </div>
                    <ScoreBar value={c.rating} max={5} />
                    {c.remarks && <p className="text-[10px] text-slate-400 italic mt-0.5">{c.remarks}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-2">No competency scores recorded</p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <TrendingUp size={14} /> Goals Progress
            </h4>
            {goals && goals.length > 0 ? (
              <div className="space-y-2">
                {goals.map((g) => (
                  <div key={g.id}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-600 dark:text-slate-300">{g.goal_name}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{g.completion_pct}%</span>
                    </div>
                    <ScoreBar value={g.completion_pct} max={100} />
                    {g.remarks && <p className="text-[10px] text-slate-400 italic mt-0.5">{g.remarks}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-2">No goals tracked</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <Activity size={14} /> Workflow History
          </h4>
          <WorkflowTimeline log={workflowLog} />
        </div>

      </div>
    </div>
  );
}

function ActionModal({ appraisal, onClose, onAction }) {
  const [action, setAction] = useState(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const status = appraisal?.status;
  const actions = status === "PENDING_SUPERVISOR" || status === "PENDING_HR"
    ? [
        { key: "APPROVE", label: "Approve", icon: ThumbsUp, color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
        { key: "REJECT", label: "Reject", icon: ThumbsDown, color: "bg-red-600 hover:bg-red-700 text-white" },
        { key: "SEND_BACK", label: "Send Back", icon: CornerUpLeft, color: "bg-amber-500 hover:bg-amber-600 text-white" },
      ]
    : [];

  const needsComment = action === "REJECT" || action === "SEND_BACK";

  const handleSubmit = async () => {
    if (!action) return;
    if (needsComment && !comments.trim()) {
      toast.warning("Please provide comments for this action");
      return;
    }
    setSubmitting(true);
    try {
      await onAction(appraisal.id, action, comments);
      onClose();
    } catch {
      toast.error("Failed to process action");
    } finally {
      setSubmitting(false);
      setConfirm(false);
    }
  };

  if (!appraisal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send size={18} className="text-blue-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Workflow Action</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <XCircle size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Users size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{appraisal.employee_name}</div>
                <div className="text-[11px] text-slate-400">{appraisal.dept_name} &middot; {appraisal.pos_name}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-600">
              <div><span className="text-slate-400">Period:</span> <span className="font-medium text-slate-700 dark:text-slate-300">{appraisal.review_period || "-"}</span></div>
              <div><span className="text-slate-400">Status:</span> <StatusBadge status={appraisal.status} /></div>
              <div><span className="text-slate-400">KPI Score:</span> <span className="font-medium">{Number(appraisal.kpi_score || 0).toFixed(1)}%</span></div>
              <div><span className="text-slate-400">Overall:</span> <span className="font-semibold">{Number(appraisal.overall_score || 0).toFixed(1)}%</span></div>
            </div>
          </div>

          {actions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Select Action
              </label>
              <div className="flex gap-2">
                {actions.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => { setAction(a.key); setConfirm(false); }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      action === a.key ? `${a.color} ring-2 ring-offset-2 dark:ring-offset-slate-800` : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                    }`}
                  >
                    <a.icon size={14} />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(needsComment || (action && !needsComment)) && (
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                {needsComment ? "Comments (required)" : "Comments (optional)"}
              </label>
              <textarea
                className="input w-full text-sm min-h-[80px]"
                placeholder={needsComment ? "Please provide a reason for this action..." : "Add a note..."}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>
          )}

          {!confirm && action && (
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="btn-secondary text-sm px-4">Cancel</button>
              <button
                onClick={() => {
                  if (needsComment && !comments.trim()) {
                    toast.warning("Comments are required for this action");
                    return;
                  }
                  setConfirm(true);
                }}
                disabled={submitting}
                className="btn-primary text-sm px-4 flex items-center gap-1.5"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Proceed
              </button>
            </div>
          )}

          {confirm && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Confirm Action</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Are you sure you want to <strong>{action === "APPROVE" ? "approve" : action === "REJECT" ? "reject" : "send back"}</strong> the appraisal for <strong>{appraisal.employee_name}</strong>?
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setConfirm(false)} className="btn-secondary text-xs px-3">Cancel</button>
                    <button onClick={handleSubmit} disabled={submitting} className={`text-xs px-3 py-1.5 rounded-lg font-semibold text-white flex items-center gap-1 ${
                      action === "APPROVE" ? "bg-emerald-600 hover:bg-emerald-700" :
                      action === "REJECT" ? "bg-red-600 hover:bg-red-700" :
                      "bg-amber-500 hover:bg-amber-600"
                    }`}>
                      {submitting && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      Confirm {action === "APPROVE" ? "Approve" : action === "REJECT" ? "Reject" : "Send Back"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {actions.length === 0 && (
            <div className="text-center py-4">
              <AlertCircle size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No actions available for <StatusBadge status={status} /> status.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BulkConfirmModal({ count, action, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle size={18} className="text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Bulk {action === "APPROVE" ? "Approve" : action === "REJECT" ? "Reject" : "Action"}</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Are you sure you want to <strong>{action === "APPROVE" ? "approve" : action === "REJECT" ? "reject" : "process"}</strong> <strong>{count}</strong> selected appraisal{count !== 1 ? "s" : ""}?
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={onCancel} className="btn-secondary text-sm px-4">Cancel</button>
            <button onClick={onConfirm} disabled={loading} className={`text-sm px-4 py-2 rounded-lg font-semibold text-white flex items-center gap-1.5 ${
              action === "APPROVE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
            }`}>
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Yes, {action === "APPROVE" ? "Approve" : "Reject"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SubmitAppraisals() {
  const [appraisals, setAppraisals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [expandedId, setExpandedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [actionTarget, setActionTarget] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const res = await api.get("/hr/performance/dashboard");
      setDashboard(res.data);
    } catch {
      setDashboard(null);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadAppraisals = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (search.trim()) params.q = search.trim();
      const res = await api.get("/hr/performance/appraisals", { params });
      setAppraisals(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      toast.error("Failed to load appraisals");
      setAppraisals([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    loadAppraisals();
  }, [loadAppraisals]);

  const handleAction = async (id, action, comments) => {
    try {
      await api.post(`/hr/performance/appraisals/${id}/action`, { action, comments });
      toast.success(`Appraisal ${action.toLowerCase()}d successfully`);
      loadAppraisals();
      loadDashboard();
    } catch (e) {
      const msg = e?.response?.data?.message || `Failed to ${action.toLowerCase()} appraisal`;
      toast.error(msg);
      throw e;
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    setBulkLoading(true);
    let success = 0, fail = 0;
    for (const id of selectedIds) {
      try {
        await api.post(`/hr/performance/appraisals/${id}/action`, { action: bulkAction, comments: "Bulk action" });
        success++;
      } catch {
        fail++;
      }
    }
    setBulkLoading(false);
    setBulkAction(null);
    setSelectedIds(new Set());
    if (success > 0) toast.success(`${success} appraisal(s) ${bulkAction.toLowerCase()}d successfully`);
    if (fail > 0) toast.error(`${fail} appraisal(s) failed`);
    loadAppraisals();
    loadDashboard();
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === appraisals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(appraisals.map((a) => a.id)));
    }
  };

  const pendingCount = (() => {
    let sup = 0, hr = 0;
    for (const a of appraisals) {
      if (a.status === "PENDING_SUPERVISOR") sup++;
      if (a.status === "PENDING_HR") hr++;
    }
    return { supervisor: sup, hr };
  })();

  const pendingSup =
    dashboard && appraisals.length > 0
      ? pendingCount.supervisor
      : (() => { try { return appraisals.filter((a) => a.status === "PENDING_SUPERVISOR").length; } catch { return 0; } })();

  const pendingHr =
    dashboard && appraisals.length > 0
      ? pendingCount.hr
      : (() => { try { return appraisals.filter((a) => a.status === "PENDING_HR").length; } catch { return 0; } })();

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText size={22} className="text-blue-600" />
            Submit Appraisals
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage and review employee performance appraisals
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={FileText} label="Total Appraisals" value={dashboard?.total} color="bg-blue-600" loading={dashboardLoading} />
        <StatCard icon={Clock} label="Pending Reviews" value={dashboard?.pending} color="bg-amber-500" loading={dashboardLoading} />
        <StatCard icon={CheckCircle} label="Completed" value={dashboard?.completed} color="bg-emerald-600" loading={dashboardLoading} />
        <StatCard icon={Award} label="Average Score" value={dashboard?.avgScore} color="bg-purple-600" loading={dashboardLoading} />
        <StatCard icon={Users} label="Pending Supervisor" value={pendingSup} color="bg-orange-500" loading={dashboardLoading} />
        <StatCard icon={AlertCircle} label="Pending HR" value={pendingHr} color="bg-red-600" loading={dashboardLoading} />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-erp overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
              <div className="relative flex-1 sm:min-w-[260px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by employee name or code..."
                  className="input pl-9 w-full text-sm h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") loadAppraisals(); }}
                />
              </div>
              <div className="relative">
                <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  className="input pl-9 pr-8 text-sm h-9 min-w-[140px] appearance-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_SUPERVISOR">Pending Supervisor</option>
                  <option value="PENDING_HR">Pending HR</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CLOSED">Closed</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-xs text-slate-500">{selectedIds.size} selected</span>
                  <button
                    onClick={() => setBulkAction("APPROVE")}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1"
                  >
                    <ThumbsUp size={12} />
                    Bulk Approve
                  </button>
                </div>
              )}
              <button onClick={loadAppraisals} className="btn-secondary text-sm h-9 px-3 flex items-center gap-1.5" title="Refresh">
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-left">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 dark:border-slate-600 accent-blue-600"
                    checked={appraisals.length > 0 && selectedIds.size === appraisals.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employee</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Department</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Position</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Review Period</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">KPI Score</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Comp Score</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Overall</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Submitted</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-12">
                    <div className="flex items-center justify-center gap-3 text-slate-400">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Loading appraisals...</span>
                    </div>
                  </td>
                </tr>
              ) : appraisals.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-0">
                    <EmptyState search={search} onClear={() => { setSearch(""); setStatusFilter("ALL"); }} />
                  </td>
                </tr>
              ) : (
                appraisals.map((a) => {
                  const isExpanded = expandedId === a.id;
                  const isSelected = selectedIds.has(a.id);
                  return (
                    <React.Fragment key={a.id}>
                      <tr
                        className={`border-b border-slate-100 dark:border-slate-700/50 transition-colors ${
                          isSelected ? "bg-blue-50/50 dark:bg-blue-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"
                        } ${isExpanded ? "bg-slate-50 dark:bg-slate-700/20" : ""} cursor-pointer`}
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 dark:border-slate-600 accent-blue-600"
                            checked={isSelected}
                            onChange={() => toggleSelect(a.id)}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                              <Users size={13} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                                {a.employee_name}
                              </div>
                              <div className="text-[10px] text-slate-400">{a.emp_code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">{a.dept_name || "-"}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">{a.pos_name || "-"}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">{a.review_period || "-"}</td>
                        <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                        <td className="px-3 py-2.5 min-w-[120px]">
                          <ScoreBar value={a.kpi_score} max={100} />
                        </td>
                        <td className="px-3 py-2.5 min-w-[120px]">
                          <ScoreBar value={a.competency_score} max={100} />
                        </td>
                        <td className="px-3 py-2.5 min-w-[120px]">
                          <ScoreBar value={a.overall_score} max={100} />
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{fmtDate(a.created_at)}</td>
                        <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          {(a.status === "PENDING_SUPERVISOR" || a.status === "PENDING_HR") ? (
                            <button
                              onClick={() => setActionTarget(a)}
                              className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                              title="Take action"
                            >
                              <Send size={14} />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">-</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`detail-${a.id}`}>
                          <td colSpan={11} className="p-0">
                            <AppraisalDetail appraisal={a} onClose={() => setExpandedId(null)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <span>{appraisals.length} appraisal(s)</span>
          {selectedIds.size > 0 && (
            <span>{selectedIds.size} selected</span>
          )}
        </div>
      </div>

      {actionTarget && (
        <ActionModal
          appraisal={actionTarget}
          onClose={() => setActionTarget(null)}
          onAction={handleAction}
        />
      )}

      {bulkAction && (
        <BulkConfirmModal
          count={selectedIds.size}
          action={bulkAction}
          onConfirm={handleBulkAction}
          onCancel={() => setBulkAction(null)}
          loading={bulkLoading}
        />
      )}
    </div>
  );
}
