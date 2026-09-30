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

export default function TaskManagementAndExecutionPage() {
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
              Task Management & Execution
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

      {error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadReport} className="underline font-semibold">
            Retry
          </button>
        </div>
      ) : null}


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



      {/* Main Execution Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Task Execution Log ({filteredTasks.length})
            </h3>
            <p className="text-xs text-slate-500">
              Detailed tracking of operational tasks, SLA schedule, and milestone completion.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Loading task execution intelligence...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No task execution records match the selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-3 px-4">Task Name</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">SLA Schedule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTasks.map((task) => {
                  const priorityColor =
                    task.priority === "URGENT"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                      : task.priority === "HIGH"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                      : task.priority === "LOW"
                      ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300";

                  const statusColor =
                    task.status === "COMPLETED"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : task.status === "IN_PROGRESS"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      : task.status === "BLOCKED"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                      : task.status === "REVIEW"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

                  const dueStatusBadge =
                    task.due_status === "COMPLETED" ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Completed
                      </span>
                    ) : task.due_status === "OVERDUE" ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center gap-1 w-fit">
                        <AlertTriangle size={11} /> {task.due_label}
                      </span>
                    ) : task.due_status === "DUE_TODAY" ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        Due Today
                      </span>
                    ) : (
                      <span className="text-slate-400">{task.due_label || "—"}</span>
                    );

                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {task.task_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        <span className="font-medium">{task.project_name}</span>
                        {task.project_code ? (
                          <span className="text-[10px] text-slate-400 block">
                            #{task.project_code}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {task.assigned_to_name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${priorityColor}`}
                        >
                          {task.priority || "MEDIUM"}
                        </span>
                      </td>
                      <td className="py-3 px-4 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-brand-500 h-full"
                              style={{ width: `${task.completion_percent || 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {task.completion_percent || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${statusColor}`}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {task.end_date ? String(task.end_date).split("T")[0] : "—"}
                      </td>
                      <td className="py-3 px-4">{dueStatusBadge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
