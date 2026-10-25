/**
 * @fileoverview TaskList component.
 * Task Assignment list table with auto-calculated status, completion slider, confirm & cancel actions,
 * and dynamic system date vs due date countdown calculation.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { CheckCircle2, Loader2, Check, X, ListTodo, ArrowLeft, Plus } from "lucide-react";
import ProjectModal from "../components/ProjectModal.jsx";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

const StatusBadge = ({ status }) => {
  const styles = {
    PENDING:     "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
    IN_PROGRESS: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
    COMPLETED:   "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400",
    BLOCKED:     "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/30 dark:text-rose-400",
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${styles[status] || styles.PENDING}`}>
      {status?.replace("_", " ")}
    </span>
  );
};

const DueBadge = ({ status, label }) => {
  if (!label || label === "—") return <span className="text-slate-400 text-xs">—</span>;

  const styles = {
    OVERDUE: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 font-bold",
    DUE_TODAY: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 font-bold",
    ON_SCHEDULE: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 font-medium",
    COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border ${styles[status] || styles.ON_SCHEDULE}`}>
      {status === "OVERDUE" && "🚨 "}
      {status === "DUE_TODAY" && "⚠️ "}
      {status === "ON_SCHEDULE" && "📅 "}
      {status === "COMPLETED" && "✓ "}
      {label}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const colors = {
    CRITICAL: "text-rose-600 dark:text-rose-400",
    HIGH:     "text-orange-600 dark:text-orange-400",
    MEDIUM:   "text-blue-600 dark:text-blue-400",
    LOW:      "text-slate-400 dark:text-slate-500",
  };
  return (
    <div className="flex items-center gap-1">
      <div className={`w-1.5 h-1.5 rounded-full bg-current ${colors[priority] || colors.LOW}`} />
      <span className={`text-[10px] font-bold uppercase tracking-tight ${colors[priority] || colors.LOW}`}>{priority}</span>
    </div>
  );
};

const CompletionSlider = ({ value, taskId, onUpdate }) => {
  const [localVal, setLocalVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => { setLocalVal(value); }, [value]);

  const handleChange = (e) => {
    const v = Number(e.target.value);
    setLocalVal(v);
    const newStatus = v >= 100 ? "COMPLETED" : v > 0 ? "IN_PROGRESS" : "PENDING";
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.put(`/projects/tasks/${taskId}`, { completion_percent: v, status: newStatus });
        if (onUpdate) onUpdate(taskId, v, newStatus);
      } catch { toast.error("Failed to update completion %"); }
      finally { setSaving(false); }
    }, 400);
  };

  const barColor =
    localVal >= 100 ? "bg-emerald-500" :
    localVal >= 50  ? "bg-blue-500" :
    localVal >= 25  ? "bg-amber-500" : "bg-slate-400";

  return (
    <div className="flex items-center gap-2 min-w-[130px]">
      <div className="relative flex-1 h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
        <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${localVal}%` }} />
        <input type="range" min="0" max="100" step="1" value={localVal} onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-9 text-right tabular-nums">{localVal}%</span>
      {saving && <Loader2 size={12} className="animate-spin text-slate-400" />}
    </div>
  );
};

const fmtDate = (v) => {
  if (!v) return "—";
  try {
    const s = String(v).split("T")[0];
    const parts = s.split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString();
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  } catch {
    return "—";
  }
};

const calcDue = (item) => {
  if (item.due_label) return { status: item.due_status, label: item.due_label };
  const endDateVal = item.end_date || item.endDate || item.due_date || item.dueDate;
  const isComplete = Number(item.completion_percent || 0) >= 100 || item.status === "COMPLETED";
  if (isComplete) return { status: "COMPLETED", label: "Completed" };
  if (!endDateVal) return { status: "NO_DUE_DATE", label: "—" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sDate = String(endDateVal).split("T")[0];
  const parts = sDate.split("-");
  let dueDate = null;
  if (parts.length === 3) {
    dueDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    dueDate = new Date(endDateVal);
  }
  dueDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    const daysOver = Math.abs(diffDays);
    return { status: "OVERDUE", label: `Overdue by ${daysOver} day${daysOver > 1 ? "s" : ""}` };
  } else if (diffDays === 0) {
    return { status: "DUE_TODAY", label: "Due Today" };
  }
  return { status: "ON_SCHEDULE", label: `Due in ${diffDays} day${diffDays > 1 ? "s" : ""}` };
};

export default function TaskList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);
  const [viewModalTask, setViewModalTask] = useState(null);

  const fetchTasks = async () => {
    try {
      const [tasksRes] = await Promise.all([
        api.get("/projects/tasks"),
      ]);
      setItems(tasksRes.data?.items || []);
    } catch { toast.error("Failed to load workboard"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);

  const activeItems = items.filter(
    (i) => i.is_active !== "N" && i.is_active !== 0 && i.is_active !== "0",
  );

  const filteredItems = activeItems.filter(i => {
    const title = (i.task_title || i.title || i.name || "").toLowerCase();
    const proj = (i.project_name || "").toLowerCase();
    const query = searchTerm.toLowerCase();
    return title.includes(query) || proj.includes(query);
  });

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "created_at", "desc");

  const handleCompletionUpdate = useCallback((taskId, val, status) => {
    setItems(prev => prev.map(i => i.id === taskId ? { 
      ...i, 
      completion_percent: val,
      status: status || (val >= 100 ? "COMPLETED" : val > 0 ? "IN_PROGRESS" : "PENDING")
    } : i));
  }, []);

  const handleConfirmTask = async (task) => {
    try {
      await api.put(`/projects/tasks/${task.id}`, { status: "COMPLETED", completion_percent: 100 });
      toast.success("Task marked as completed");
      setItems((prev) =>
        prev.map((i) => (i.id === task.id ? { ...i, status: "COMPLETED", completion_percent: 100 } : i)),
      );
    } catch {
      toast.error("Failed to confirm task");
    }
  };

  const handleCancelTask = async (task) => {
    const name = task.task_title || task.title || task.name || "this task";
    if (!window.confirm(`Are you sure you want to cancel task "${name}"?`)) return;
    try {
      await api.put(`/projects/tasks/${task.id}`, { is_active: "N" });
      toast.success("Task cancelled");
      setItems((prev) => prev.filter((i) => i.id !== task.id));
    } catch {
      toast.error("Failed to cancel task");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      {/* Canonical Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ListTodo size={24} className="text-brand-900 dark:text-brand-400" /> Task Management
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              WBS task allocation, scope management & assignment tracking
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/project-management/tasks/new"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> New Task
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Filter tasks by title or project..."
              className="input max-w-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex justify-end mb-4">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
          <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <SortableHeader label="Task"       sortKey="task_title"          currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Project"    sortKey="project_name"        currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Start Date" sortKey="start_date"          currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Due Date"   sortKey="end_date"            currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Task Due"   sortKey="due_status"          currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th>Assignee</th>
                  <SortableHeader label="Completion (%)" sortKey="completion_percent"  currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Hours"      sortKey="estimated_hours"     currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                  <SortableHeader label="Status & Actions" sortKey="status"        currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-center">Docs</th>
                  <th className="text-center text-rose-600 dark:text-rose-400">Cancel</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="11" className="text-center py-8 text-slate-400">Loading...</td></tr>
                ) : sortedItems.length > 0 ? sortedItems.map((item) => {
                  const displayTaskTitle = item.task_title || item.taskTitle || item.title || item.name || "Untitled Task";
                  const displayProjectName = item.project_name || item.projectName || "";
                  const startDateVal = item.start_date || item.startDate;
                  const endDateVal = item.end_date || item.endDate || item.due_date || item.dueDate;
                  const compPercent = Number(item.completion_percent ?? item.completionPercent ?? 0);
                  const isComplete = compPercent >= 100 || item.status === "COMPLETED";
                  const dueInfo = calcDue(item);

                  return (
                    <tr key={item.id} className={isComplete ? "opacity-75" : ""}>
                      {/* Task */}
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${isComplete ? "bg-emerald-50 border-emerald-200 text-emerald-500" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-brand-700 dark:text-brand-400"}`}>
                            <CheckCircle2 size={15} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[220px]">
                              {displayTaskTitle}
                            </div>
                            <PriorityBadge priority={item.priority} />
                          </div>
                        </div>
                      </td>

                      {/* Project */}
                      <td className="whitespace-nowrap text-sm font-semibold text-slate-800 dark:text-slate-200 py-3">
                        {displayProjectName || "—"}
                      </td>

                      {/* Start Date */}
                      <td className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 py-3">
                        {fmtDate(startDateVal)}
                      </td>

                      {/* Due Date */}
                      <td className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 py-3">
                        {fmtDate(endDateVal)}
                      </td>

                      {/* Task Due Status Badge */}
                      <td className="whitespace-nowrap py-3">
                        <DueBadge status={dueInfo.status} label={dueInfo.label} />
                      </td>

                      {/* Assignee */}
                      <td className="text-sm whitespace-nowrap py-3">
                        {item.assigned_to_name || "—"}
                      </td>

                      {/* Completion Slider Column */}
                      <td className="py-3">
                        <CompletionSlider value={compPercent} taskId={item.id} onUpdate={handleCompletionUpdate} />
                      </td>

                      {/* Hours */}
                      <td className="text-center whitespace-nowrap py-3">
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded tabular-nums">
                          {Number(item.actual_hours || 0).toFixed(2)} / {Number(item.estimated_hours || 0).toFixed(2)}h
                        </span>
                      </td>

                      {/* Status & Actions */}
                      <td className="py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={item.status} />
                          <button
                            type="button"
                            onClick={() => setViewModalTask(item)}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            View
                          </button>
                          <Link
                            to={`/project-management/tasks/${item.id}`}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            Edit
                          </Link>
                          {!isComplete && (
                            <button
                              type="button"
                              onClick={() => handleConfirmTask(item)}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1"
                            >
                              <Check size={12} /> Confirm
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Docs / Attach */}
                      <td className="text-center py-3">
                        <button
                          type="button"
                          onClick={() => { setActiveDocId(item.id); setShowAttach(true); }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 mx-auto"
                        >
                          📎 Docs
                        </button>
                      </td>

                      {/* Cancel Column */}
                      <td className="text-center py-3">
                        <button
                          type="button"
                          onClick={() => handleCancelTask(item)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors inline-flex items-center gap-1 mx-auto"
                          title="Cancel Task"
                        >
                          <X size={13} /> Cancel
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="11" className="text-center py-8 text-slate-400">No tasks found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Attachments Modal */}
      {showAttach && activeDocId && (
        <DocumentAttachmentsModal
          docType="task"
          docId={activeDocId}
          onClose={() => { setShowAttach(false); setActiveDocId(null); }}
        />
      )}

      {/* Read-Only Task View Modal */}
      <ProjectModal
        open={Boolean(viewModalTask)}
        onClose={() => setViewModalTask(null)}
        title={viewModalTask ? `Task Details: ${viewModalTask.task_title || viewModalTask.title || viewModalTask.name}` : "Task Details"}
        subtitle="Comprehensive task attributes, project alignment, and status"
        icon={ListTodo}
        cancelLabel="Close"
      >
        {viewModalTask && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-slate-400 block text-[11px] font-semibold mb-1 uppercase tracking-wider">Project</span>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{viewModalTask.project_name || "—"}</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-slate-400 block text-[11px] font-semibold mb-1 uppercase tracking-wider">Assignee</span>
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{viewModalTask.assigned_to_name || "—"}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">Status</span>
                <StatusBadge status={viewModalTask.status} />
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">Priority</span>
                <PriorityBadge priority={viewModalTask.priority} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-slate-400 block text-[11px] font-semibold mb-1 uppercase tracking-wider">Start Date</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{fmtDate(viewModalTask.start_date || viewModalTask.startDate)}</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
                <span className="text-slate-400 block text-[11px] font-semibold mb-1 uppercase tracking-wider">Due Date</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{fmtDate(viewModalTask.end_date || viewModalTask.endDate || viewModalTask.due_date)}</span>
              </div>
            </div>

            {viewModalTask.reason_for_delay && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Reason for Delay</span>
                <p className="text-xs leading-relaxed">{viewModalTask.reason_for_delay}</p>
              </div>
            )}
          </div>
        )}
      </ProjectModal>
    </div>
  );
}
