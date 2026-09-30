/**
 * @fileoverview TaskExecution component.
 * Provides Task Execution page with description checklist, interactive checkboxes,
 * automatic completion % calculation, dynamic Reason for Delay input fields,
 * mandatory Reason for Delay validation for overdue/due tasks, visual Car Odometer completion gauge,
 * status filter tab selection, manual task selection prompt, mobile-responsive layout, and Exceptional Permission task reassignment.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useAuth } from "@/auth/AuthContext.jsx";
import { usePermission } from "@/auth/PermissionContext.jsx";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Save, 
  Clock, 
  User, 
  Calendar, 
  AlertTriangle,
  Loader2,
  ListTodo,
  Paperclip,
  Lock,
  UserCheck,
  X,
  ChevronRight,
  MousePointerClick
} from "lucide-react";
import CarOdometerGauge from "@/components/CarOdometerGauge.jsx";

export default function TaskExecution() {
  const { user } = useAuth();
  const { hasExceptional } = usePermission();
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Default filter active on PENDING as requested
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [showAttach, setShowAttach] = useState(false);

  // Reassignment state
  const [usersList, setUsersList] = useState([]);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignUserId, setReassignUserId] = useState("");
  const [reassigning, setReassigning] = useState(false);

  // Exceptional Permission check for task reassignment
  const canReassignTask = Boolean(
    user?.is_super_admin ||
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    user?.id === 1 ||
    hasExceptional("TASK.REASSIGN") ||
    hasExceptional("PM.TASK.REASSIGN") ||
    hasExceptional("TASK.REASSIGN_TASK")
  );

  // Load users for reassignment dropdown
  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get("/admin/users");
        const u = res?.data?.data?.items || res?.data?.items || res?.data?.users || [];
        setUsersList(u);
      } catch {}
    }
    loadUsers();
  }, []);

  // State for current task execution details
  const [checklistItems, setChecklistItems] = useState([]);
  const [delayReasons, setDelayReasons] = useState([""]);
  const [taskCompletionPercent, setTaskCompletionPercent] = useState(0);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get("/projects/tasks");
      const items = res.data?.items || [];
      
      const currentUserId = user?.id || user?.sub;
      const currentUsername = String(user?.username || "").toLowerCase();

      // Strict Assignee Filtering: Only tasks assigned to current user (unless admin)
      const assignedTasks = items.filter((t) => {
        const matchId = currentUserId && String(t.assigned_to_id) === String(currentUserId);
        const matchName = currentUsername && String(t.assigned_to_name || "").toLowerCase() === currentUsername;
        return matchId || matchName;
      });

      setTasks(assignedTasks);
    } catch {
      toast.error("Failed to load tasks for execution");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user?.id, user?.username]);

  // Compute filtered tasks list based on search and status filter (e.g. IN_PROGRESS, PENDING)
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        (t.task_title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.project_name || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tasks, searchTerm, statusFilter]);

  // Clear selectedTaskId when user changes status filter so user can explicitly pick a task from the list
  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setSelectedTaskId(null);
  };

  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  // Check if Reason for Delay Log is required (Overdue or Due tasks)
  const isDelayReasonRequired = useMemo(() => {
    if (!selectedTask) return false;
    const dueStatus = String(selectedTask.due_status || "").toUpperCase();
    const dueLabel = String(selectedTask.due_label || "").toUpperCase();
    const status = String(selectedTask.status || "").toUpperCase();

    if (
      dueStatus.includes("OVERDUE") ||
      dueStatus.includes("DUE_TODAY") ||
      dueLabel.includes("OVERDUE") ||
      dueLabel.includes("DUE TODAY") ||
      dueLabel.includes("DUE") ||
      status.includes("OVERDUE")
    ) {
      return true;
    }

    if (selectedTask.end_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(selectedTask.end_date.split("T")[0]);
      if (dueDate <= today) {
        return true;
      }
    }

    return false;
  }, [selectedTask]);

  // Initialize Scope Checklist Items & delay reasons SPECIFICALLY for the selectedTask
  useEffect(() => {
    if (!selectedTask) {
      setChecklistItems([]);
      setDelayReasons([""]);
      setTaskCompletionPercent(0);
      return;
    }

    // Parse task_description into checklist objects [{ id, text, completed }] for the selected task
    let parsedChecklist = [];
    if (selectedTask.task_description) {
      try {
        const raw = String(selectedTask.task_description).trim();
        if (raw.startsWith("[") && raw.endsWith("]")) {
          const jsonArr = JSON.parse(raw);
          if (Array.isArray(jsonArr)) {
            parsedChecklist = jsonArr.map((item, idx) => {
              if (typeof item === "object" && item !== null) {
                return {
                  id: item.id || idx + 1,
                  text: item.text || item.label || "",
                  completed: Boolean(item.completed),
                };
              }
              return { id: idx + 1, text: String(item), completed: false };
            });
          }
        } else if (raw) {
          parsedChecklist = raw
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s, idx) => ({ id: idx + 1, text: s, completed: false }));
        }
      } catch {
        parsedChecklist = [{ id: 1, text: selectedTask.task_description, completed: false }];
      }
    }

    setChecklistItems(parsedChecklist);

    // Calculate completion percent based on selected task's checklist items
    const completedCount = parsedChecklist.filter((i) => Boolean(i.completed)).length;
    const totalCount = parsedChecklist.length;
    const calcPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const dbPct = Number(selectedTask.completion_percent || 0);
    const finalPct = totalCount > 0 ? calcPct : dbPct;

    setTaskCompletionPercent(finalPct);

    // Parse reason_for_delay into array of string inputs
    let parsedDelays = [""];
    if (selectedTask.reason_for_delay) {
      try {
        const raw = String(selectedTask.reason_for_delay).trim();
        if (raw.startsWith("[") && raw.endsWith("]")) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length > 0) {
            parsedDelays = arr.map(String);
          }
        } else if (raw) {
          parsedDelays = raw.split("\n").map((s) => s.trim()).filter(Boolean);
        }
      } catch {
        parsedDelays = [selectedTask.reason_for_delay];
      }
    }
    if (parsedDelays.length === 0) parsedDelays = [""];
    setDelayReasons(parsedDelays);
  }, [selectedTask]);

  // Toggle item completion in checklist for selected task
  const handleToggleChecklist = async (index) => {
    if (!selectedTask) return;

    const updatedChecklist = checklistItems.map((item, i) =>
      i === index ? { ...item, completed: !item.completed } : item
    );

    setChecklistItems(updatedChecklist);

    // Calculate auto completion percent: true = completed work, false = not completed work
    const completedCount = updatedChecklist.filter((i) => Boolean(i.completed)).length;
    const totalCount = updatedChecklist.length;
    const newPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    setTaskCompletionPercent(newPercent);
    const newStatus = newPercent >= 100 ? "COMPLETED" : newPercent > 0 ? "IN_PROGRESS" : "PENDING";
    const jsonDescription = JSON.stringify(updatedChecklist);

    // Update local task state
    setTasks((prev) =>
      prev.map((t) =>
        t.id === selectedTask.id
          ? {
              ...t,
              completion_percent: newPercent,
              status: newStatus,
              task_description: jsonDescription,
            }
          : t
      )
    );

    // Sync to backend DB
    try {
      await api.put(`/projects/tasks/${selectedTask.id}`, {
        task_description: jsonDescription,
        completion_percent: newPercent,
        status: newStatus,
      });
      toast.success(`Checklist updated (${completedCount}/${totalCount} items completed - ${newPercent}%)`);
    } catch {
      toast.error("Failed to save checklist update");
    }
  };

  // Handle Delay Reasons changes
  const handleDelayChange = (index, value) => {
    const updated = [...delayReasons];
    updated[index] = value;
    setDelayReasons(updated);
  };

  const handleAddDelayReason = () => {
    setDelayReasons((prev) => [...prev, ""]);
  };

  const handleRemoveDelayReason = (index) => {
    if (delayReasons.length <= 1) {
      setDelayReasons([""]);
    } else {
      setDelayReasons((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSaveDelays = async () => {
    if (!selectedTask) return;
    const cleanDelays = delayReasons.map((d) => d.trim()).filter(Boolean);

    // Enforce required field validation for overdue or due tasks
    if (isDelayReasonRequired && cleanDelays.length === 0) {
      toast.error("Reason for Delay Log is a required field because this task is overdue or due.");
      return;
    }

    setSaving(true);
    try {
      const jsonDelays = cleanDelays.length > 0 ? JSON.stringify(cleanDelays) : null;

      await api.put(`/projects/tasks/${selectedTask.id}`, {
        reason_for_delay: jsonDelays,
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTask.id ? { ...t, reason_for_delay: jsonDelays } : t
        )
      );
      toast.success("Reason for delay updated successfully");
    } catch {
      toast.error("Failed to save reason for delay");
    } finally {
      setSaving(false);
    }
  };

  // Handle Task Reassignment with Exceptional Permission Check
  const handleReassignTask = async () => {
    if (!canReassignTask) {
      toast.error("Exceptional Permission (TASK.REASSIGN) is required to reassign tasks.");
      return;
    }
    if (!selectedTask || !reassignUserId) {
      toast.error("Please select a target user for task reassignment.");
      return;
    }

    const selectedUser = usersList.find((u) => String(u.id) === String(reassignUserId));
    const newAssignedName = selectedUser?.username || selectedUser?.full_name || selectedUser?.name || `User #${reassignUserId}`;

    setReassigning(true);
    try {
      await api.put(`/projects/tasks/${selectedTask.id}`, {
        assigned_to_id: reassignUserId,
        assigned_to_name: newAssignedName,
      });

      toast.success(`Task successfully reassigned to ${newAssignedName}`);
      setShowReassignModal(false);
      setReassignUserId("");
      fetchTasks();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to reassign task");
    } finally {
      setReassigning(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="card shadow-md overflow-hidden">
        <div className="card-header bg-brand text-white p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <ListTodo className="w-6 h-6 sm:w-7 sm:h-7" /> Task Execution
              </h1>
              <p className="text-xs sm:text-sm mt-1 opacity-90">
                Interactive WBS execution, checklist tracking & gauge progress monitoring
              </p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Link to="/project-management?section=Reports%20%26%20Analytics" className="btn btn-secondary text-xs flex-1 sm:flex-initial text-center justify-center">
                Return to Menu
              </Link>
              <Link to="/project-management/tasks" className="btn-success text-xs px-3 py-2 flex-1 sm:flex-initial text-center justify-center">
                Task Management
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Task Sidebar & Execution Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Task List / Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="card p-3.5 sm:p-4 space-y-3">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center justify-between">
              <span>Select Task ({filteredTasks.length})</span>
              {statusFilter !== "ALL" && (
                <span className="text-[10px] font-bold text-brand uppercase bg-brand/10 px-2 py-0.5 rounded">
                  {statusFilter.replace("_", " ")}
                </span>
              )}
            </h2>
            <input
              type="text"
              placeholder="Search task title or project..."
              className="input w-full text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* Status Filter Buttons (Default active: PENDING) */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
              {["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "ALL"].map((st) => (
                <button
                  key={st}
                  onClick={() => handleStatusFilterChange(st)}
                  className={`px-2.5 py-1.5 rounded text-[10px] font-bold uppercase whitespace-nowrap transition-all ${
                    statusFilter === st
                      ? "bg-brand text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Task List Items */}
          <div className="space-y-2 max-h-[350px] sm:max-h-[550px] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center py-8 text-slate-400 text-sm">Loading tasks...</div>
            ) : filteredTasks.length > 0 ? (
              filteredTasks.map((t) => {
                const isSel = t.id === selectedTaskId;
                const isComplete = Number(t.completion_percent || 0) >= 100;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSel
                        ? "bg-brand/10 border-brand shadow-sm dark:bg-brand/20 ring-2 ring-brand/30"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-1 flex items-center gap-1.5">
                        {isSel && <ChevronRight size={14} className="text-brand shrink-0" />}
                        {t.task_title}
                      </h3>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                          isComplete
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}
                      >
                        {t.completion_percent || 0}%
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-2">
                      {t.project_name || "—"}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <User size={12} /> {t.assigned_to_name || "Unassigned"}
                      </span>
                      <span className="font-semibold">{t.priority}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="card p-6 text-center text-slate-400 text-xs">
                No {statusFilter.toLowerCase().replace("_", " ")} tasks found.
              </div>
            )}
          </div>
        </div>

        {/* Selected Task Details & Interactive Execution Panel */}
        <div className="lg:col-span-8 space-y-4 sm:space-y-6">
          {selectedTask ? (
            <>
              {/* Top Banner: Task Summary & Odometer Gauge */}
              <div className="card p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
                  <div className="space-y-3 flex-1 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-300">
                        {selectedTask.project_name || "Project Task"}
                      </span>
                      <span className="text-xs text-slate-400">• Priority: {selectedTask.priority}</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {selectedTask.task_title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-600 dark:text-slate-400 pt-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <User size={14} className="text-slate-400" /> Assignee:{" "}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {selectedTask.assigned_to_name || "Unassigned"}
                        </strong>
                        {/* Reassign Task Trigger (Only rendered if user has permission) */}
                        {canReassignTask && (
                          <button
                            type="button"
                            onClick={() => setShowReassignModal(true)}
                            className="px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border border-brand/30 bg-brand/10 text-brand hover:bg-brand hover:text-white transition-all"
                            title="Reassign task to another user"
                          >
                            <UserCheck size={12} />
                            Reassign Task
                          </button>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-400" /> Start:{" "}
                        {selectedTask.start_date
                          ? new Date(selectedTask.start_date.split("T")[0]).toLocaleDateString()
                          : "—"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-slate-400" /> Due:{" "}
                        {selectedTask.end_date
                          ? new Date(selectedTask.end_date.split("T")[0]).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAttach(true)}
                        className="btn btn-secondary text-xs flex items-center gap-1.5 w-full sm:w-auto justify-center"
                      >
                        <Paperclip size={14} /> Add Attachment
                      </button>
                    </div>
                  </div>

                  {/* Visual Car Odometer Gauge with TOP Percentage Box */}
                  <div className="shrink-0 bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-lg flex flex-col items-center w-full md:w-auto">
                    <CarOdometerGauge
                      value={taskCompletionPercent}
                      label="Task Completion Gauge"
                      size="md"
                    />
                  </div>
                </div>
              </div>

              {/* Task-Specific Scope Checklist Items */}
              <div className="card p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Scope Checklist Items
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Checklist items for: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedTask.task_title}</span>
                    </p>
                  </div>
                  <div className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 self-start sm:self-auto">
                    {checklistItems.filter((i) => i.completed).length} / {checklistItems.length} Done ({taskCompletionPercent}%)
                  </div>
                </div>

                <div className="space-y-2.5 sm:space-y-3">
                  {checklistItems.length > 0 ? (
                    checklistItems.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        onClick={() => handleToggleChecklist(idx)}
                        className={`flex items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer ${
                          item.completed
                            ? "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/60"
                            : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 pr-2">
                          <button
                            type="button"
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                              item.completed
                                ? "bg-emerald-500 text-white"
                                : "border-2 border-slate-300 dark:border-slate-600 text-transparent hover:border-emerald-500"
                            }`}
                          >
                            ✓
                          </button>
                          <span
                            className={`text-xs sm:text-sm font-medium transition-all ${
                              item.completed
                                ? "line-through text-slate-400 dark:text-slate-500"
                                : "text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {item.text}
                          </span>
                        </div>

                        <span
                          className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                            item.completed
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                          }`}
                        >
                          {item.completed ? "COMPLETED" : "PENDING"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs italic">
                      No scope checklist items specified for this task.
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Reason for Delay Input Fields */}
              <div className={`card p-4 sm:p-6 bg-white dark:bg-slate-900 border space-y-4 ${
                isDelayReasonRequired
                  ? "border-rose-300 dark:border-rose-800 shadow-sm"
                  : "border-slate-200 dark:border-slate-800"
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                      <AlertTriangle className="w-5 h-5 text-amber-500" /> Reason for Delay Log
                      {isDelayReasonRequired && (
                        <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                          * Required (Task Overdue/Due)
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isDelayReasonRequired
                        ? "This task is overdue or due today. You MUST enter at least one reason for delay."
                        : "Record any reasons for delays. You can add multiple fields if needed."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddDelayReason}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 self-start sm:self-auto"
                  >
                    <Plus size={14} /> Add Reason Field
                  </button>
                </div>

                <div className="space-y-3">
                  {delayReasons.map((reason, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 w-4 sm:w-5 text-right shrink-0">{idx + 1}.</span>
                      <input
                        type="text"
                        className={`input w-full text-xs sm:text-sm ${
                          isDelayReasonRequired && !reason.trim()
                            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
                            : ""
                        }`}
                        placeholder={
                          isDelayReasonRequired
                            ? `Reason for delay ${idx + 1} (Required)...`
                            : `Reason for delay ${idx + 1}...`
                        }
                        value={reason}
                        onChange={(e) => handleDelayChange(idx, e.target.value)}
                        required={isDelayReasonRequired && idx === 0}
                      />
                      {delayReasons.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDelayReason(idx)}
                          className="p-2 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 transition-colors shrink-0"
                          title="Remove field"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveDelays}
                    disabled={saving}
                    className="btn-success text-xs px-4 py-2 flex items-center gap-1.5 w-full sm:w-auto justify-center"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save size={14} /> Save Delay Log
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="card p-8 sm:p-12 text-center text-slate-400 space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <MousePointerClick className="w-12 h-12 mx-auto text-brand/60 animate-bounce" />
              <h3 className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-300">
                Select a Task to View Execution Details
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {filteredTasks.length > 0
                  ? `There are ${filteredTasks.length} ${statusFilter.toLowerCase().replace("_", " ")} task(s) available. Click any task from the left list to view and manage its scope checklist items.`
                  : `No ${statusFilter.toLowerCase().replace("_", " ")} tasks assigned to your user account.`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reassign Task Modal (Exceptional Permission Gated) */}
      {showReassignModal && selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-brand" /> Reassign Task
              </h3>
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400">Task Title:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                  {selectedTask.task_title}
                </p>
              </div>

              <div>
                <span className="text-slate-400">Current Assignee:</span>
                <p className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                  {selectedTask.assigned_to_name || "Unassigned"}
                </p>
              </div>

              <div className="pt-2">
                <label className="label font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Select New Assignee <span className="text-red-500">*</span>
                </label>
                <select
                  className="input w-full text-xs"
                  value={reassignUserId}
                  onChange={(e) => setReassignUserId(e.target.value)}
                  required
                >
                  <option value="">Select Assignee User...</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.username || u.full_name || u.name || `User #${u.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReassignTask}
                disabled={reassigning || !reassignUserId}
                className="btn-success text-xs px-4 py-2 flex items-center gap-1.5"
              >
                {reassigning ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Reassigning...
                  </>
                ) : (
                  <>
                    <UserCheck size={14} /> Confirm Reassignment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachments Modal */}
      {showAttach && selectedTask && (
        <DocumentAttachmentsModal
          docType="task"
          docId={selectedTask.id}
          onClose={() => setShowAttach(false)}
        />
      )}
    </div>
  );
}
