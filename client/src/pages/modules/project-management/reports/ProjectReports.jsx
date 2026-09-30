/**
 * @fileoverview ProjectReports component.
 * Provides functionality for ProjectReports.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Activity, DollarSign, Clock, Briefcase, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { api } from "../../../../api/client.js";

const StatCard = ({ icon, label, value, color }) => (
  <div className="card p-6 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  </div>
);

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProjectReports() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, []);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/projects/dashboard/detail");
        setStats(res.data);
      } catch {}
      setLoading(false);
    }
    load();
  }, [pollingCounter]);

  const reportLinks = [
    {
      title: "Project Status Report",
      description: "Completion metrics, task breakdown, and milestone tracking for all projects.",
      icon: <Activity size={20} />,
      path: "/project-management/reports/project-status",
      color: "text-brand-600 bg-brand-50 dark:bg-brand-900/30"
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center gap-4">
        <Link to="/project-management?section=Reports%20%26%20Analytics" className="btn btn-secondary p-2"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Analytics & Reports</h1>
          <p className="text-slate-500 text-sm">Portfolio KPIs and project intelligence</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard icon={<Briefcase size={20} className="text-brand-600" />} label="Total Projects" value={stats.projects?.total || 0} color="text-brand-600 bg-brand-50" />
          <StatCard icon={<Activity size={20} className="text-blue-600" />} label="Active Projects" value={stats.projects?.active || 0} color="text-blue-600 bg-blue-50" />
          <StatCard icon={<Clock size={20} className="text-amber-600" />} label="Total Hours" value={`${Number(stats.totalLoggedHours).toFixed(1)}h`} color="text-amber-600 bg-amber-50" />
          <StatCard icon={<DollarSign size={20} className="text-emerald-600" />} label="Total Expenses" value={`GHS ${Number(stats.totalExpenses).toLocaleString()}`} color="text-emerald-600 bg-emerald-50" />
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/project-management/reports/task-management-and-execution" className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-brand-200 dark:hover:border-brand-900 transition-all duration-300 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 shadow-sm group-hover:scale-105 transition-transform">
            <Activity size={20} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">Task Management & Execution</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Throughput velocity, SLA risk monitoring, assignee workload, and operational task metrics</p>
          </div>
        </Link>
        <Link to="/project-management/reports/project-status" className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-brand-200 dark:hover:border-brand-900 transition-all duration-300 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 shadow-sm group-hover:scale-105 transition-transform">
            <Briefcase size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">Project Status Report</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Completion metrics and task breakdown across all projects</p>
          </div>
        </Link>
        <Link to="/project-management/reports/project-income" className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-brand-200 dark:hover:border-brand-900 transition-all duration-300 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 shadow-sm group-hover:scale-105 transition-transform">
            <TrendingUp size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">Project Income Report</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Receipt vouchers linked to each project</p>
          </div>
        </Link>
        <Link to="/project-management/reports/project-expense" className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-brand-200 dark:hover:border-brand-900 transition-all duration-300 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 shadow-sm group-hover:scale-105 transition-transform">
            <TrendingDown size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-rose-600 transition-colors">Project Expense Report</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Payment vouchers linked to each project</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
