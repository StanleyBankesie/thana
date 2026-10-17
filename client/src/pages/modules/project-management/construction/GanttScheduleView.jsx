/**
 * @file GanttScheduleView.jsx
 * @description Project Schedule & Critical Path Method (CPM) visualizer.
 * Displays Early/Late dates, Total Float, Critical Path activities, and Extension of Time (EOT) tracking.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Play,
  AlertCircle,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Flag,
  Plus,
  RefreshCw,
  Sliders,
  X
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function GanttScheduleView() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [cpmMeta, setCpmMeta] = useState({ projectDurationDays: 0, criticalPathIds: [] });
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // EOT Requests State
  const [eotRequests, setEotRequests] = useState([]);
  const [showEOTModal, setShowEOTModal] = useState(false);
  const [eotForm, setEotForm] = useState({
    delay_cause: "",
    delay_category: "CLIENT_CHANGE",
    days_requested: 7,
    financial_claim_amount: 0,
    justification: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
        if (prjs.length > 0) {
          setSelectedProjectId(String(prjs[0].id));
        }
      } catch (e) {
        toast.error("Failed to load projects");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    fetchTasksAndSchedule();
    fetchEOTRequests();
  }, [selectedProjectId]);

  const fetchTasksAndSchedule = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/tasks`, { params: { project_id: selectedProjectId } });
      const items = res.data?.items || [];
      setTasks(items);
    } catch (e) {
      toast.error("Failed to load project schedule tasks");
    } finally {
      setLoading(false);
    }
  };

  const fetchEOTRequests = async () => {
    try {
      const res = await api.get("/construction/eot-requests", { params: { project_id: selectedProjectId } });
      setEotRequests(res.data?.items || []);
    } catch (e) {}
  };

  const runCPMCalculation = async () => {
    setCalculating(true);
    try {
      const res = await api.post(`/construction/cpm/${selectedProjectId}/calculate`);
      setCpmMeta({
        projectDurationDays: res.data?.projectDurationDays || 0,
        criticalPathIds: res.data?.criticalPathIds || [],
      });
      if (res.data?.tasks?.length) {
        setTasks(res.data.tasks);
      }
      toast.success(`CPM Calculated: ${res.data?.criticalPathIds?.length || 0} critical tasks identified`);
    } catch (e) {
      toast.error("Failed to compute CPM schedule");
    } finally {
      setCalculating(false);
    }
  };

  const handleCreateEOT = async (e) => {
    e.preventDefault();
    try {
      await api.post("/construction/eot-requests", {
        ...eotForm,
        project_id: selectedProjectId,
      });
      toast.success("Extension of Time claim submitted");
      setShowEOTModal(false);
      setEotForm({
        delay_cause: "",
        delay_category: "CLIENT_CHANGE",
        days_requested: 7,
        financial_claim_amount: 0,
        justification: "",
      });
      fetchEOTRequests();
    } catch (e) {
      toast.error("Failed to submit EOT request");
    }
  };

  const criticalCount = tasks.filter(t => t.is_critical).length;

  return (
    <div className="space-y-6">
      {/* Canonical Schedule Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar size={24} className="text-brand-900 dark:text-brand-400" /> Project Schedule & Critical Path (CPM)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Forward/Backward pass network analysis, float monitoring, and schedule baselining
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input text-sm py-1.5 h-auto min-w-[180px]"
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_code} - {p.project_name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowEOTModal(true)}
            className="btn btn-secondary inline-flex items-center gap-1.5"
          >
            <Plus size={16} /> EOT Claim
          </button>
          <button
            onClick={runCPMCalculation}
            disabled={calculating || !tasks.length}
            className="btn btn-primary inline-flex items-center gap-1.5"
          >
            <RefreshCw size={16} className={calculating ? "animate-spin" : ""} />
            {calculating ? "Calculating CPM..." : "Compute CPM"}
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-3 bg-brand-50 dark:bg-brand-900/30 text-brand-600 rounded-xl">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Total Schedule Duration</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {cpmMeta.projectDurationDays || tasks.length * 3} Days
            </p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className={`p-3 rounded-xl ${criticalCount > 0 ? "bg-rose-50 text-rose-600 dark:bg-rose-900/30" : "bg-emerald-50 text-emerald-600"}`}>
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Critical Path Activities</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{criticalCount} Tasks</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl">
            <Sliders size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Scheduled Activities</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{tasks.length} Work Items</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-xl">
            <Flag size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Extension of Time (EOT)</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{eotRequests.length} Requests</p>
          </div>
        </div>
      </div>

      {/* CPM Schedule Table & Interactive Visualizer */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            Network Activity Analysis & Float
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            Zero Float = Critical Path (Directly dictates project completion)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b">
              <tr>
                <th className="p-3">WBS / Task</th>
                <th className="p-3">Start Date</th>
                <th className="p-3">Target Finish</th>
                <th className="p-3 text-center">Early Start (ES)</th>
                <th className="p-3 text-center">Late Finish (LF)</th>
                <th className="p-3 text-center">Total Float</th>
                <th className="p-3 text-center">Critical Path</th>
                <th className="p-3 w-32">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                    No tasks found for this project. Create tasks under Task Management to establish schedule.
                  </td>
                </tr>
              ) : (
                tasks.map(t => (
                  <tr
                    key={t.id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 ${
                      t.is_critical ? "bg-rose-50/30 dark:bg-rose-900/10 font-semibold" : ""
                    }`}
                  >
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-white">{t.task_title}</div>
                      {t.assigned_to_name && (
                        <div className="text-[10px] text-slate-400">Assigned: {t.assigned_to_name}</div>
                      )}
                    </td>
                    <td className="p-3 font-mono">{t.start_date ? t.start_date.split("T")[0] : "-"}</td>
                    <td className="p-3 font-mono">{t.end_date ? t.end_date.split("T")[0] : "-"}</td>
                    <td className="p-3 text-center font-mono text-slate-500">
                      {t.early_start ? t.early_start.split("T")[0] : "-"}
                    </td>
                    <td className="p-3 text-center font-mono text-slate-500">
                      {t.late_finish ? t.late_finish.split("T")[0] : "-"}
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.total_float === 0 || t.is_critical
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {t.total_float !== null && t.total_float !== undefined ? `${t.total_float} d` : "-"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {t.is_critical ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-600 text-white animate-pulse">
                          CRITICAL
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-slate-100 text-slate-500">
                          Non-Critical
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${t.is_critical ? "bg-rose-500" : "bg-brand-500"}`}
                            style={{ width: `${Math.min(100, Number(t.completion_percent || 0))}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 w-8 text-right">
                          {Number(t.completion_percent || 0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extension of Time (EOT) Register */}
      {eotRequests.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
              Extension of Time (EOT) Claims Register
            </h3>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Request #</th>
                <th className="p-3">Category</th>
                <th className="p-3">Cause of Delay</th>
                <th className="p-3 text-right">Days Claimed</th>
                <th className="p-3 text-right">Cost Claim (GHS)</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {eotRequests.map(r => (
                <tr key={r.id}>
                  <td className="p-3 font-mono font-bold text-brand-600">{r.request_number}</td>
                  <td className="p-3 uppercase text-[10px] font-bold text-slate-500">{r.delay_category}</td>
                  <td className="p-3">{r.delay_cause}</td>
                  <td className="p-3 text-right font-mono font-bold">{r.days_requested} Days</td>
                  <td className="p-3 text-right font-mono">
                    {Number(r.financial_claim_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: EOT Claim */}
      {showEOTModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Flag size={18} className="text-brand-600" /> Extension of Time (EOT) Claim
              </h3>
              <button onClick={() => setShowEOTModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateEOT} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Delay Category</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  value={eotForm.delay_category}
                  onChange={e => setEotForm({ ...eotForm, delay_category: e.target.value })}
                >
                  <option value="CLIENT_CHANGE">Client / Employer Variation</option>
                  <option value="WEATHER">Inclement Weather Event</option>
                  <option value="SITE_CONDITION">Unforeseen Ground / Site Condition</option>
                  <option value="STATUTORY">Statutory / Permit Delay</option>
                  <option value="MATERIAL_SHORTAGE">Industry Material Supply Disruption</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Cause of Delay</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Late issuance of revised foundation drawings"
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  value={eotForm.delay_cause}
                  onChange={e => setEotForm({ ...eotForm, delay_cause: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Calendar Days Claimed</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={eotForm.days_requested}
                    onChange={e => setEotForm({ ...eotForm, days_requested: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Financial Claim (GHS)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={eotForm.financial_claim_amount}
                    onChange={e => setEotForm({ ...eotForm, financial_claim_amount: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Justification & Contract Clause</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 min-h-[90px]"
                  placeholder="Reference contract clause, timeline impact, and supporting site records..."
                  value={eotForm.justification}
                  onChange={e => setEotForm({ ...eotForm, justification: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowEOTModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Submit EOT Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
