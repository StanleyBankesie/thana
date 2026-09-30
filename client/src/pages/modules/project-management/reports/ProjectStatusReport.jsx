/**
 * @fileoverview ProjectStatusReport component.
 * Provides functionality for ProjectStatusReport.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Download, RefreshCw, Layers, Target, Wallet, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const statusStyles = {
  PLANNING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ON_HOLD: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
};

const progressColor = (pct) => {
  if (pct >= 100) return "from-emerald-500 to-emerald-400";
  if (pct >= 75) return "from-blue-500 to-blue-400";
  if (pct >= 50) return "from-indigo-500 to-indigo-400";
  if (pct >= 25) return "from-amber-500 to-amber-400";
  return "from-slate-400 to-slate-300";
};

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProjectStatusReport() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get("/projects/reports/project-status");
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);

  const overallCompletion = items.length
    ? (items.reduce((s, p) => s + Number(p.completion_percent || 0), 0) / items.length).toFixed(1)
    : 0;

  const totalBudget = items.reduce((s, p) => s + Number(p.budget || 0), 0);
  const totalHours = items.reduce((s, p) => s + Number(p.total_estimated_hours || 0), 0);
  const totalActualHours = items.reduce((s, p) => s + Number(p.total_actual_hours || 0), 0);
  const totalCompletedTasks = items.reduce((s, p) => s + Number(p.completed_tasks || 0), 0);
  const totalBlockedTasks = items.reduce((s, p) => s + Number(p.blocked_tasks || 0), 0);

  const exportExcel = () => {
    const headers = ["Project Code", "Project Name", "Status", "Completion %", "Manager", "Client", "Budget", "Total Tasks", "Completed", "In Progress", "Blocked", "Pending", "Est. Hours", "Actual Hours"];
    const rows = items.map(p => [
      p.project_code, p.project_name, p.project_status, p.completion_percent,
      p.manager_name, p.client_name, p.budget, p.total_tasks, p.completed_tasks,
      p.in_progress_tasks, p.blocked_tasks, p.pending_tasks,
      p.total_estimated_hours, p.total_actual_hours
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `project-status-report-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportPdf = () => {
    const headers = ["Project Code", "Project Name", "Status", "Completion %", "Manager", "Client", "Budget", "Total Tasks", "Completed", "In Progress", "Blocked", "Pending", "Est. Hours", "Actual Hours"];
    const rows = items.map(p => [
      p.project_code, p.project_name, p.project_status, p.completion_percent,
      p.manager_name, p.client_name, p.budget, p.total_tasks, p.completed_tasks,
      p.in_progress_tasks, p.blocked_tasks, p.pending_tasks,
      p.total_estimated_hours, p.total_actual_hours
    ]);
    const doc = new jsPDF();
    doc.autoTable({
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });
    doc.save(`project-status-report-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/project-management?section=Reports%20%26%20Analytics" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Project Status Report</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Overview of all projects with completion metrics and task breakdown</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchReport} className="btn btn-secondary p-2" title="Refresh"><RefreshCw size={18} /></button>
          <div className="flex items-center gap-2">
              <button onClick={exportExcel} className="btn-success px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2">Excel</button>
              <button onClick={exportPdf} className="btn-error px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 flex items-center gap-2">PDF</button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl"><Layers size={20} /></div>
          </div>
          <div className="text-3xl font-bold">{items.length}</div>
          <div className="text-indigo-100 text-xs uppercase tracking-wider font-semibold mt-1">Total Projects</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl"><Target size={20} /></div>
          </div>
          <div className="text-3xl font-bold">{overallCompletion}%</div>
          <div className="text-emerald-100 text-xs uppercase tracking-wider font-semibold mt-1">Avg Completion</div>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl"><Wallet size={20} /></div>
          </div>
          <div className="text-lg font-bold">{Number(totalBudget).toLocaleString()}</div>
          <div className="text-violet-100 text-xs uppercase tracking-wider font-semibold mt-1">Total Budget</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl"><Clock size={20} /></div>
          </div>
          <div className="text-lg font-bold">{Number(totalActualHours).toFixed(1)}h / {Number(totalHours).toFixed(1)}h</div>
          <div className="text-amber-100 text-xs uppercase tracking-wider font-semibold mt-1">Hours (Actual/Est.)</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Project</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Progress</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Tasks</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">
                  <span className="flex items-center gap-1 justify-center"><CheckCircle size={12} /> Done</span>
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">
                  <span className="flex items-center gap-1 justify-center"><AlertTriangle size={12} /> Blocked</span>
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Est. Hours</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actual Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="8" className="px-6 py-20 text-center animate-pulse text-slate-400 dark:text-slate-500 font-semibold">Loading...</td></tr>
              ) : items.length > 0 ? items.map(p => {
                const pct = Number(p.completion_percent || 0);
                return (
                  <tr key={p.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all duration-200">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{p.project_name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">{p.project_code} {p.manager_name ? <span className="text-slate-300">· {p.manager_name}</span> : ""}</div>
                    </td>
                    <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${statusStyles[p.project_status] || statusStyles.PLANNING}`}>{p.project_status}</span></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-2.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner">
                          <div className={`h-full rounded-full bg-gradient-to-r ${progressColor(pct)} transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 min-w-[2.5rem] text-right">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-900 dark:text-white">{p.total_tasks || 0}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle size={12} /> {p.completed_tasks || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                        <AlertTriangle size={12} /> {p.blocked_tasks || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-slate-700 dark:text-slate-300">{Number(p.total_estimated_hours || 0).toFixed(1)}h</td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-slate-700 dark:text-slate-300">{Number(p.total_actual_hours || 0).toFixed(1)}h</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="8" className="px-6 py-20 text-center text-slate-400 dark:text-slate-500 italic">No projects found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
