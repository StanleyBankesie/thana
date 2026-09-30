/**
 * @fileoverview TaskForm component.
 * Provides functionality for TaskForm with organized layout and visual hierarchy.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import { usePermission } from "@/auth/PermissionContext.jsx";
import { Plus, Trash2, Info } from "lucide-react";

export default function TaskForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState({
    projectId: "",
    taskTitle: "",
    description: "",
    priority: "MEDIUM",
    status: "PENDING",
    estimatedHours: 0,
    dueDate: "",
    startDate: "",
    reasonForDelay: "",
    completionPercent: 0,
    assignedToId: "",
    assignedToName: "",
  });

  const [scopeItems, setScopeItems] = useState([
    { text: "", completed: false },
    { text: "", completed: false },
    { text: "", completed: false },
  ]);
  const [delayItems, setDelayItems] = useState([""]);

  const [showAttach, setShowAttach] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .get("/projects?active=all")
      .then((res) => {
        if (!mounted) return;
        const list =
          res.data?.items ||
          res.data?.data?.items ||
          res.data?.data ||
          (Array.isArray(res.data) ? res.data : []);
        setProjects(list);
      })
      .catch(() => {});

    api
      .get("/admin/users")
      .then((res) => {
        if (!mounted) return;
        const list =
          res.data?.items ||
          res.data?.data?.items ||
          res.data?.users ||
          res.data?.data ||
          (Array.isArray(res.data) ? res.data : []);
        setUsers(list);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isNew) return;
    let mounted = true;
    setLoading(true);

    api
      .get(`/projects/tasks/${id}`)
      .then((res) => {
        if (!mounted) return;
        const item = res.data?.item;
        if (!item) return;

        let parsedScope = [
          { text: "", completed: false },
          { text: "", completed: false },
          { text: "", completed: false },
        ];
        if (item.task_description) {
          try {
            const raw = String(item.task_description).trim();
            if (raw.startsWith("[") && raw.endsWith("]")) {
              const arr = JSON.parse(raw);
              if (Array.isArray(arr) && arr.length > 0) {
                parsedScope = arr.map((x) => {
                  if (typeof x === "object" && x !== null) {
                    return {
                      text: String(x.text || x.label || x.name || ""),
                      completed: Boolean(x.completed),
                    };
                  }
                  return { text: String(x || ""), completed: false };
                });
              }
            } else if (raw) {
              parsedScope = raw
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => ({ text: s, completed: false }));
            }
          } catch {
            parsedScope = [{ text: item.task_description, completed: false }];
          }
        }
        while (parsedScope.length < 3) {
          parsedScope.push({ text: "", completed: false });
        }
        setScopeItems(parsedScope);

        let parsedDelay = [""];
        if (item.reason_for_delay) {
          try {
            const raw = String(item.reason_for_delay).trim();
            if (raw.startsWith("[") && raw.endsWith("]")) {
              const arr = JSON.parse(raw);
              if (Array.isArray(arr) && arr.length > 0) {
                parsedDelay = arr.map(String);
              }
            } else if (raw) {
              parsedDelay = raw.split("\n").map((s) => s.trim()).filter(Boolean);
            }
          } catch {
            parsedDelay = [item.reason_for_delay];
          }
        }
        if (parsedDelay.length === 0) parsedDelay = [""];
        setDelayItems(parsedDelay);

        setFormData({
          projectId: String(item.project_id || ""),
          projectName: item.project_name || "",
          taskTitle: item.task_title || "",
          description: item.task_description || "",
          priority: item.priority || "MEDIUM",
          status: item.status || "PENDING",
          estimatedHours: item.estimated_hours || 0,
          dueDate: item.end_date ? item.end_date.split("T")[0] : "",
          startDate: item.start_date ? item.start_date.split("T")[0] : "",
          reasonForDelay: item.reason_for_delay || "",
          completionPercent: item.completion_percent || 0,
          assignedToId: String(item.assigned_to_id || ""),
          assignedToName: item.assigned_to_name || "",
        });
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load task");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  const handleScopeChange = (index, value) => {
    const updated = [...scopeItems];
    const currentCompleted = typeof updated[index] === "object" ? Boolean(updated[index].completed) : false;
    updated[index] = { text: value, completed: currentCompleted };
    setScopeItems(updated);
  };

  const handleAddScopeItem = () => {
    setScopeItems((prev) => [...prev, { text: "", completed: false }]);
  };

  const handleRemoveScopeItem = (index) => {
    if (scopeItems.length <= 3) {
      const updated = [...scopeItems];
      updated[index] = { text: "", completed: false };
      setScopeItems(updated);
    } else {
      setScopeItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleDelayChange = (index, value) => {
    const updated = [...delayItems];
    updated[index] = value;
    setDelayItems(updated);
  };

  const handleAddDelayItem = () => {
    setDelayItems((prev) => [...prev, ""]);
  };

  const handleRemoveDelayItem = (index) => {
    if (delayItems.length <= 1) {
      setDelayItems([""]);
    } else {
      setDelayItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const cleanScope = scopeItems
        .map((s) => ({
          text: (typeof s === "object" ? s.text || "" : String(s || "")).trim(),
          completed: typeof s === "object" ? Boolean(s.completed) : false,
        }))
        .filter((s) => s.text.length > 0);

      const cleanDelay = delayItems.map((d) => d.trim()).filter(Boolean);

      const payload = {
        project_id: formData.projectId || null,
        task_title: formData.taskTitle,
        task_description:
          cleanScope.length > 0 ? JSON.stringify(cleanScope) : null,
        priority: formData.priority,
        status: formData.status,
        estimated_hours: formData.estimatedHours || 0,
        end_date: formData.dueDate || null,
        start_date: formData.startDate || null,
        reason_for_delay: cleanDelay.length > 0 ? JSON.stringify(cleanDelay) : null,
        completion_percent:
          formData.status === "COMPLETED"
            ? 100
            : formData.completionPercent || 0,
        assigned_to_id: formData.assignedToId || null,
        assigned_to_name: formData.assignedToName || null,
      };

      if (isNew) {
        await api.post("/projects/tasks", payload);
      } else {
        await api.put(`/projects/tasks/${id}`, payload);
      }
      navigate("/project-management/tasks", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const statusColors = {
    PENDING: "bg-amber-500 text-white",
    IN_PROGRESS: "bg-blue-600 text-white",
    COMPLETED: "bg-emerald-600 text-white",
    BLOCKED: "bg-rose-600 text-white",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew ? "New Task" : "Edit Task"}
              </h1>
              <p className="text-sm opacity-90 mt-0.5">
                WBS Item Specification & Execution Management
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!isNew && (
                <button
                  type="button"
                  onClick={() => setShowAttach(true)}
                  className="btn btn-secondary text-xs flex items-center gap-1.5"
                >
                  📎 Attachments / Docs
                </button>
              )}
              <button onClick={() => window.history.back()} className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="btn-success text-xs font-bold px-4 py-2"
              >
                {saving ? "Saving…" : "Save Task Assignment"}
              </button>
            </div>
          </div>
        </div>

        <div className="card-body p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? (
              <div className="text-sm text-slate-500 animate-pulse">
                Loading task details...
              </div>
            ) : null}
            {error ? (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                {error}
              </div>
            ) : null}

            {/* Group 1: General & Assignment Information */}
            <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                <h2 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  1. Task Core Information
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-5">
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Project <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="input w-full"
                    value={formData.projectId || ""}
                    onChange={(e) => {
                      const sel = projects.find((p) => String(p.id) === String(e.target.value));
                      setFormData({
                        ...formData,
                        projectId: e.target.value,
                        projectName: sel ? (sel.project_name || sel.name || "") : formData.projectName,
                      });
                    }}
                    required
                  >
                    <option value="">Select Project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.project_name || p.name || p.title || p.project_code || `Project #${p.id}`}
                      </option>
                    ))}
                    {formData.projectId && !projects.some((p) => String(p.id) === String(formData.projectId)) && (
                      <option value={String(formData.projectId)}>
                        {formData.projectName || `Project #${formData.projectId}`}
                      </option>
                    )}
                  </select>
                </div>

                <div className="md:col-span-7">
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Task Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Enter descriptive task title..."
                    value={formData.taskTitle}
                    onChange={(e) =>
                      setFormData({ ...formData, taskTitle: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                <div>
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Assignee
                  </label>
                  <select
                    className="input w-full"
                    value={formData.assignedToId || ""}
                    onChange={(e) => {
                      const u = users.find((x) => String(x.id) === String(e.target.value));
                      setFormData({
                        ...formData,
                        assignedToId: e.target.value,
                        assignedToName: u ? (u.username || u.full_name || u.name || "") : formData.assignedToName,
                      });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.username || u.full_name || u.name || `User #${u.id}`}
                      </option>
                    ))}
                    {formData.assignedToId && !users.some((u) => String(u.id) === String(formData.assignedToId)) && (
                      <option value={String(formData.assignedToId)}>
                        {formData.assignedToName || `User #${formData.assignedToId}`}
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Priority
                  </label>
                  <select
                    className="input w-full"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Group 2: Schedule & Effort */}
            <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                <h2 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  2. Schedule & Progress
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="input w-full"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Due Date
                  </label>
                  <input
                    type="date"
                    className="input w-full"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="input w-full"
                    value={formData.estimatedHours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estimatedHours: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Group 3: Scope & Execution Details */}
            <div className="space-y-5 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                <h2 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  3. Execution Details & Delay Log
                </h2>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-0">
                      Execution Details / Scope
                    </label>
                    <button
                      type="button"
                      onClick={handleAddScopeItem}
                      className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Scope Field
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {scopeItems.map((item, idx) => {
                      const itemText = typeof item === "object" ? item.text || "" : String(item || "");
                      const isCompleted = typeof item === "object" ? Boolean(item.completed) : false;
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <span className={`text-xs font-bold w-6 text-right shrink-0 ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            {idx + 1}.
                          </span>
                          <input
                            type="text"
                            className={`input w-full text-sm transition-colors ${
                              isCompleted
                                ? 'border-emerald-500/60 focus:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-semibold'
                                : ''
                            }`}
                            placeholder={`Specify scope item ${idx + 1}...`}
                            value={itemText}
                            onChange={(e) =>
                              handleScopeChange(idx, e.target.value)
                            }
                          />
                          {isCompleted ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm shrink-0">✓</span>
                          ) : null}
                          {scopeItems.length > 3 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveScopeItem(idx)}
                              className="p-2 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 transition-colors shrink-0"
                              title="Remove field"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                  <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Reason for Delay</span>
                    <span className="text-[11px] font-normal text-slate-400 flex items-center gap-1">
                      <Info size={12} /> Read-only (Fetched from table)
                    </span>
                  </label>
                  <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-300 min-h-[46px] flex items-center">
                    {formData.reasonForDelay ? (
                      <span className="whitespace-pre-wrap font-medium">{formData.reasonForDelay}</span>
                    ) : (
                      <span className="text-slate-400 italic">No delay reasons recorded yet</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showAttach && id && (
        <DocumentAttachmentsModal
          docType="task"
          docId={id}
          onClose={() => setShowAttach(false)}
        />
      )}
    </div>
  );
}
