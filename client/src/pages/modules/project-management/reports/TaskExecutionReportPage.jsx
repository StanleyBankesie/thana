/**
 * @fileoverview TaskExecutionReportPage component.
 * Senior Data Analyst report page for Task Management & Execution Analytics in Project Management.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity,
  User,
  Folder,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
  ShieldAlert,
  BarChart3,
  PieChart,
  CheckSquare
} from "lucide-react";
import { api } from "../../../../api/client.js";

export default function TaskExecutionReportPage({ isEmbedded = false }) {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter States
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (selectedProject) params.project_id = selectedProject;
      if (selectedPriority) params.priority = selectedPriority;
      if (selectedStatus) params.status = selectedStatus;

      const res = await api.get("/projects/reports/task-execution", { params });
      setData(res.data);
    } catch (err) {
      console.error("Failed to load task execution report:", err);
      setError(err?.response?.data?.message || "Failed to load task execution report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedProject, selectedPriority, selectedStatus]);

  // Client-side search filtering on tasks
  const filteredTasks = useMemo(() => {
    if (!data?.items) return [];
    if (!searchQuery.trim()) return data.items;
    const q = searchQuery.toLowerCase();
    return data.items.filter(
      (t) =>
        t.task_name?.toLowerCase().includes(q) ||
        t.project_name?.toLowerCase().includes(q) ||
        t.assigned_to_name?.toLowerCase().includes(q)
    );
  }, [data?.items, searchQuery]);

  const handleExportCSV = () => {
    if (!filteredTasks || filteredTasks.length === 0) return;
    const headers = [
      "Task ID",
      "Task Name",
      "Project Code",
      "Project Name",
      "Assignee",
      "Priority",
      "Status",
      "Progress %",
      "Start Date",
      "Due Date",
      "Due Status"
    ];

    const rows = filteredTasks.map((t) => [
      t.id,
      `"${(t.task_name || "").replace(/"/g, '""')}"`,
      t.project_code || "",
      `"${(t.project_name || "").replace(/"/g, '""')}"`,
      `"${(t.assigned_to_name || "").replace(/"/g, '""')}"`,
      t.priority || "MEDIUM",
      t.status || "PENDING",
      `${t.completion_percent || 0}%`,
      t.start_date ? String(t.start_date).split("T")[0] : "",
      t.end_date ? String(t.end_date).split("T")[0] : "",
      t.due_label || ""
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Task_Execution_Report_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const analytics = data?.analytics || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Bar */}
      {!isEmbedded && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-4">
            <Link
              to="/project-management?section=Reports%20%26%20Analytics"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <span className="text-xs text-slate-400">Project Management</span>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                Task Management & Execution Analytics
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Throughput velocity, SLA risk monitoring, assignee workload, and operational performance metrics.
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={loadReport}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!data || !filteredTasks.length}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={!data}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            <Printer size={16} />
            Print Report
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadReport} className="underline font-semibold">
            Retry
          </button>
        </div>
      ) : null}

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Tasks */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Managed Tasks
            </span>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <CheckSquare size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {loading ? "..." : analytics.totalTasks || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Across {data?.projects?.length || 0} active projects
          </p>
        </div>

        {/* Completion Rate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Completion Rate
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {loading ? "..." : `${analytics.completionRate || 0}%`}
          </p>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${Math.min(100, analytics.completionRate || 0)}%` }}
            />
          </div>
        </div>

        {/* Overdue SLA Risk */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Overdue Risk
            </span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
            {loading ? "..." : analytics.overdueTasks || 0}
          </p>
          <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1 font-medium">
            {analytics.overdueRate || 0}% SLA breach rate
          </p>
        </div>

        {/* On-Time Rate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              On-Time Rate
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Clock size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
            {loading ? "..." : `${analytics.onTimeRate || 0}%`}
          </p>
          <p className="text-xs text-slate-500 mt-1">On or before due date</p>
        </div>

        {/* Blocked / In Progress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Execution
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <Activity size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
            {loading ? "..." : (analytics.inProgressTasks || 0) + (analytics.blockedTasks || 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {analytics.blockedTasks || 0} currently blocked
          </p>
        </div>
      </div>

      {/* Control Panel / Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Filter size={18} className="text-brand-500" />
            <span>Analytical Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 max-w-4xl">
            {/* Project Selector */}
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Projects</option>
              {(data?.projects || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name} ({p.project_code || "PRJ"})
                </option>
              ))}
            </select>

            {/* Priority Selector */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Priorities</option>
              <option value="URGENT">Urgent Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>

            {/* Status Selector */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="REVIEW">Under Review</option>
              <option value="COMPLETED">Completed</option>
              <option value="BLOCKED">Blocked</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search tasks or assignees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Visual Data Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Status Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <PieChart size={18} className="text-brand-500" />
              Status Breakdown
            </h3>
            <span className="text-xs text-slate-400 font-medium">Distribution</span>
          </div>

          <div className="space-y-3">
            {/* Completed */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-emerald-700 dark:text-emerald-400">Completed</span>
                <span>
                  {analytics.completedTasks || 0} (
                  {analytics.totalTasks ? ((analytics.completedTasks / analytics.totalTasks) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full"
                  style={{
                    width: `${analytics.totalTasks ? (analytics.completedTasks / analytics.totalTasks) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* In Progress */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-blue-700 dark:text-blue-400">In Progress</span>
                <span>
                  {analytics.inProgressTasks || 0} (
                  {analytics.totalTasks ? ((analytics.inProgressTasks / analytics.totalTasks) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full"
                  style={{
                    width: `${analytics.totalTasks ? (analytics.inProgressTasks / analytics.totalTasks) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* Pending */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-600 dark:text-slate-400">Pending</span>
                <span>
                  {analytics.pendingTasks || 0} (
                  {analytics.totalTasks ? ((analytics.pendingTasks / analytics.totalTasks) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-slate-400 h-full"
                  style={{
                    width: `${analytics.totalTasks ? (analytics.pendingTasks / analytics.totalTasks) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* Review */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-purple-700 dark:text-purple-400">Under Review</span>
                <span>
                  {analytics.reviewTasks || 0} (
                  {analytics.totalTasks ? ((analytics.reviewTasks / analytics.totalTasks) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full"
                  style={{
                    width: `${analytics.totalTasks ? (analytics.reviewTasks / analytics.totalTasks) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* Blocked */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-rose-700 dark:text-rose-400">Blocked / At Risk</span>
                <span>
                  {analytics.blockedTasks || 0} (
                  {analytics.totalTasks ? ((analytics.blockedTasks / analytics.totalTasks) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full"
                  style={{
                    width: `${analytics.totalTasks ? (analytics.blockedTasks / analytics.totalTasks) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Priority & SLA Risk Breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <ShieldAlert size={18} className="text-rose-500" />
              Priority Matrix & SLA
            </h3>
            <span className="text-xs text-slate-400 font-medium">Risk Level</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase">
                Urgent
              </span>
              <p className="text-2xl font-extrabold text-rose-800 dark:text-rose-300 mt-1">
                {analytics.priorityDistribution?.URGENT || 0}
              </p>
              <p className="text-[10px] text-rose-600/70 dark:text-rose-400/70">
                Requires immediate action
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">
                High
              </span>
              <p className="text-2xl font-extrabold text-amber-800 dark:text-amber-300 mt-1">
                {analytics.priorityDistribution?.HIGH || 0}
              </p>
              <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">
                Critical path deliverables
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase">
                Medium
              </span>
              <p className="text-2xl font-extrabold text-blue-800 dark:text-blue-300 mt-1">
                {analytics.priorityDistribution?.MEDIUM || 0}
              </p>
              <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">
                Standard execution
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">
                Low
              </span>
              <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-200 mt-1">
                {analytics.priorityDistribution?.LOW || 0}
              </p>
              <p className="text-[10px] text-slate-400">Non-blocking backlog</p>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              Due Today Tasks:
            </span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {analytics.dueTodayTasks || 0} tasks
            </span>
          </div>
        </div>

        {/* Top Assignee Throughput Matrix */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <User size={18} className="text-indigo-500" />
              Assignee Workload Matrix
            </h3>
            <span className="text-xs text-slate-400 font-medium">Throughput</span>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {(analytics.assigneeWorkload || []).slice(0, 5).map((a, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs"
              >
                <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  <span>{a.name}</span>
                  <span>
                    {a.completed} / {a.total} done ({a.completionRate}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full"
                    style={{ width: `${Math.min(100, Number(a.completionRate))}%` }}
                  />
                </div>
                {a.overdue > 0 ? (
                  <span className="text-[10px] text-rose-500 font-semibold mt-1 inline-block">
                    ⚠️ {a.overdue} overdue task{a.overdue > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>
            ))}

            {(!analytics.assigneeWorkload || analytics.assigneeWorkload.length === 0) && (
              <p className="text-xs text-slate-400 italic text-center py-6">
                No task workload data recorded.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
