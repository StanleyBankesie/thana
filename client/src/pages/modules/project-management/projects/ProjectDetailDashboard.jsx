/**
 * @fileoverview ProjectDetailDashboard component.
 * Provides functionality for ProjectDetailDashboard.
 */

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Briefcase, DollarSign, Clock, CheckCircle2, Calendar, User, AlertTriangle, Loader2, Activity, Layout, Flag } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const statusBadge = (status) => {
  const m = { PLANNING: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", IN_PROGRESS: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", ON_HOLD: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" };
  return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${m[status] || m.PLANNING}`}>{status}</span>;
};

const BudgetBar = ({ budget, spent }) => {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const color = pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  const label = pct >= 90 ? "Over budget" : pct >= 70 ? "Near limit" : "On track";
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-semibold text-slate-700 dark:text-slate-300">GHS {spent.toLocaleString()} / GHS {budget.toLocaleString()}</span>
        <span className={`text-xs font-bold ${pct >= 90 ? 'text-rose-600 dark:text-rose-400' : pct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{label}</span>
      </div>
      <div className="w-full h-3 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right text-xs font-bold text-slate-500">{pct.toFixed(1)}% spent</div>
    </div>
  );
};

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProjectDetailDashboard() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/projects/projects/${id}/detail`);
        setData(res.data);
      } catch { toast.error("Failed to load project detail"); }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  if (loading) {
    return <div className="p-20 flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" size={32} /></div>;
  }
  if (!data) {
    return <div className="p-20 text-center text-slate-400">Project not found</div>;
  }

  const { project, tasks, totalHours, totalExpenses, totalLaborCost, totalSpent, remaining, spendPct, dependencies } = data;
  const taskSummary = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'COMPLETED').length,
    inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    blocked: tasks.filter(t => t.status === 'BLOCKED').length,
    pending: tasks.filter(t => t.status === 'PENDING').length,
  };
  const totalEstHours = tasks.reduce((s, t) => s + Number(t.estimated_hours || 0), 0);
  const totalActHours = tasks.reduce((s, t) => s + Number(t.actual_hours || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/project-management/projects" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">{project.project_name}</h1>
              {statusBadge(project.project_status)}
            </div>
            <p className="text-slate-500 text-sm">{project.project_code} {project.manager_name ? `· Managed by ${project.manager_name}` : ""}</p>
          </div>
        </div>
        <Link to={`/project-management/projects/${id}`} className="btn btn-secondary flex items-center gap-2"><Briefcase size={18} /> Edit Project</Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 mb-2"><Activity size={20} /></div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{taskSummary.total}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">Total Tasks</div>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 mb-2"><CheckCircle2 size={20} /></div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{taskSummary.completed}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">Completed</div>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 mb-2"><Clock size={20} /></div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{taskSummary.inProgress}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">In Progress</div>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 mb-2"><AlertTriangle size={20} /></div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{taskSummary.blocked}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">Blocked</div>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 mb-2"><Layout size={20} /></div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{taskSummary.pending}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mt-1">Pending</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Budget vs Actual */}
        <div className="lg:col-span-2 card p-8 space-y-6">
          <div className="flex items-center gap-3 text-brand-600 border-b border-slate-50 dark:border-slate-700 pb-3">
            <DollarSign size={18} /><h2 className="font-bold uppercase text-xs tracking-wider">Budget vs Actual</h2>
          </div>
          <BudgetBar budget={Number(project.budget || 0)} spent={totalSpent} />
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expenses</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">GHS {Number(totalExpenses).toLocaleString()}</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Labor (@50/hr)</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">GHS {Number(totalLaborCost).toLocaleString()}</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remaining</p>
              <p className={`text-lg font-bold ${remaining > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>GHS {Number(remaining).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Project Info Sidebar */}
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3 text-brand-600"><Flag size={18} /><h2 className="font-bold uppercase text-xs tracking-wider">Details</h2></div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Client</span><span className="font-semibold text-slate-900 dark:text-white">{project.client_name || "Internal"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Priority</span><span className="font-semibold text-slate-900 dark:text-white">{project.project_priority || "MEDIUM"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Progress</span><span className="font-semibold text-slate-900 dark:text-white">{Number(project.completion_percent || 0).toFixed(0)}%</span></div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3 text-brand-600"><Calendar size={18} /><h2 className="font-bold uppercase text-xs tracking-wider">Timeline</h2></div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm"><Calendar size={14} className="text-slate-400" /><span className="text-slate-500">Start:</span><span className="font-semibold text-slate-900 dark:text-white">{project.start_date ? new Date(project.start_date).toLocaleDateString() : "TBD"}</span></div>
              <div className="flex items-center gap-2 text-sm"><Calendar size={14} className="text-slate-400" /><span className="text-slate-500">End:</span><span className="font-semibold text-slate-900 dark:text-white">{project.end_date ? new Date(project.end_date).toLocaleDateString() : "TBD"}</span></div>
              <div className="flex items-center gap-2 text-sm"><Clock size={14} className="text-slate-400" /><span className="text-slate-500">Hours:</span><span className="font-semibold text-slate-900 dark:text-white">{Number(totalActHours).toFixed(1)}h / {Number(totalEstHours).toFixed(1)}h</span></div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3 text-brand-600"><User size={18} /><h2 className="font-bold uppercase text-xs tracking-wider">Manager</h2></div>
            <p className="font-semibold text-slate-900 dark:text-white">{project.manager_name || "Not assigned"}</p>
            {project.remarks && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{project.remarks}</p>}
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="card p-8 space-y-6">
        <h2 className="font-bold uppercase text-xs tracking-wider text-brand-600 border-b border-slate-50 dark:border-slate-700 pb-3">Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No tasks for this project.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/30">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Task</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Completion</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {tasks.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-all duration-300">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${t.status === 'COMPLETED' ? 'bg-emerald-500' : t.status === 'IN_PROGRESS' ? 'bg-blue-500' : t.status === 'BLOCKED' ? 'bg-rose-500' : 'bg-slate-300'}`} />
                        <span className="font-medium text-sm text-slate-900 dark:text-white">{t.task_title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center"><span className="text-[10px] font-bold text-slate-500 uppercase">{t.status?.replace('_', ' ')}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${t.completion_percent >= 100 ? 'bg-emerald-500' : t.completion_percent >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${t.completion_percent || 0}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{t.completion_percent || 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-slate-700 dark:text-slate-300">{Number(t.actual_hours || 0).toFixed(1)}h / {Number(t.estimated_hours || 0).toFixed(1)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
