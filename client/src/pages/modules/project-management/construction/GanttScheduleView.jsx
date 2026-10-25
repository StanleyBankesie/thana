/**
 * @file GanttScheduleView.jsx
 * @description Integrated Project Schedule & Critical Path Method (CPM) Management.
 * Features 5 tabs:
 * - Tab 1: Schedule Overview (Metadata, baseline status, working calendar, overall progress)
 * - Tab 2: Activities & Dependencies (Full WBS table, predecessors, lag/lead, resource assignments)
 * - Tab 3: Interactive Gantt Chart (Timeline view, progress bars, critical path highlights, zoom)
 * - Tab 4: Critical Path Analysis (ES, EF, LS, LF, Total Float, Free Float, Longest Path sequence)
 * - Tab 5: Progress & Schedule Variance (Planned vs Actual, SPI, recovery plans, EOT claims)
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Flag,
  Plus,
  RefreshCw,
  Sliders,
  ChevronRight,
  BarChart2,
  ShieldAlert,
  Zap,
  Edit2,
  Trash2,
  ArrowRight,
  Layers,
  Activity,
  TrendingUp,
  Info,
  Check,
  X,
  CalendarCheck,
  Timer
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ProjectModal from "../components/ProjectModal.jsx";

export default function GanttScheduleView() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [activeTab, setActiveTab] = useState("overview"); // overview | activities | gantt | cpm | variance
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Schedule Data from backend
  const [scheduleData, setScheduleData] = useState({
    project: null,
    tasks: [],
    cpm: {
      tasks: [],
      projectDurationDays: 0,
      criticalPathIds: [],
      criticalPathSequence: [],
      activitiesThreateningDeadline: [],
      forecastCompletionDate: "",
      hasCycle: false,
    },
    variance: {
      actualProgress: 0,
      plannedProgress: 0,
      spi: 1.0,
      scheduleVarianceDays: 0,
      targetCompletionDate: "",
      forecastCompletionDate: "",
      delayedTasksCount: 0,
      recoveryPlan: [],
    },
    eotClaims: [],
    workPackages: [],
  });

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [ganttZoom, setGanttZoom] = useState("weeks"); // days | weeks | months

  // Activity Modal State
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activityForm, setActivityForm] = useState({
    task_title: "",
    wbs_code: "",
    work_package_id: "",
    duration_days: 3,
    start_date: "",
    end_date: "",
    completion_percent: 0,
    status: "NOT_STARTED",
    assigned_to_name: "",
    priority: "NORMAL",
    reason_for_delay: "",
    predecessors: [], // Array of { predecessor_id, dependency_type, lag_days }
  });

  // Predecessor selection helper in modal
  const [newPredId, setNewPredId] = useState("");
  const [newPredType, setNewPredType] = useState("FS");
  const [newPredLag, setNewPredLag] = useState(0);

  // EOT Request Modal State
  const [showEOTModal, setShowEOTModal] = useState(false);
  const [eotForm, setEotForm] = useState({
    delay_cause: "",
    delay_category: "WEATHER",
    days_requested: 7,
    financial_claim_amount: 0,
    justification: "",
  });

  // Load Projects on Mount
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

  // Fetch full schedule when selected project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    loadSchedule();
  }, [selectedProjectId]);

  const loadSchedule = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await api.get(`/construction/schedule/${selectedProjectId}`);
      setScheduleData(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load project schedule");
    } finally {
      setLoading(false);
    }
  };

  // Run CPM Calculation
  const handleRecalculateCPM = async () => {
    if (!selectedProjectId) return;
    setCalculating(true);
    try {
      const res = await api.post(`/construction/schedule/${selectedProjectId}/recalculate`);
      toast.success(`CPM Calculated: ${res.data?.criticalPathIds?.length || 0} critical activities identified`);
      loadSchedule();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to calculate CPM");
    } finally {
      setCalculating(false);
    }
  };

  // Set Baseline
  const handleSetBaseline = async () => {
    if (!selectedProjectId) return;
    if (!confirm("Record current schedule as the approved Project Baseline?")) return;
    try {
      await api.post(`/construction/schedule/${selectedProjectId}/baseline`);
      toast.success("Schedule baseline saved successfully");
      loadSchedule();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to set baseline");
    }
  };

  // Open Activity Modal (Add or Edit)
  const openAddActivity = () => {
    setEditingTask(null);
    const today = new Date().toISOString().split("T")[0];
    setActivityForm({
      task_title: "",
      wbs_code: `${(scheduleData.tasks?.length || 0) + 1}.0`,
      work_package_id: scheduleData.workPackages?.[0]?.id || "",
      duration_days: 3,
      start_date: today,
      end_date: "",
      completion_percent: 0,
      status: "NOT_STARTED",
      assigned_to_name: "",
      priority: "NORMAL",
      reason_for_delay: "",
      predecessors: [],
    });
    setNewPredId("");
    setNewPredType("FS");
    setNewPredLag(0);
    setShowActivityModal(true);
  };

  const openEditActivity = (task) => {
    setEditingTask(task);
    setActivityForm({
      task_title: task.task_title || "",
      wbs_code: task.wbs_code || "",
      work_package_id: task.work_package_id || "",
      duration_days: task.duration_days || 1,
      start_date: task.start_date ? task.start_date.split("T")[0] : "",
      end_date: task.end_date ? task.end_date.split("T")[0] : "",
      completion_percent: task.completion_percent || 0,
      status: task.status || "NOT_STARTED",
      assigned_to_name: task.assigned_to_name || "",
      priority: task.priority || "NORMAL",
      reason_for_delay: task.reason_for_delay || "",
      predecessors: (task.predecessors || []).map(p => ({
        predecessor_id: p.predecessor_id,
        dependency_type: p.dependency_type || "FS",
        lag_days: p.lag_days || 0,
      })),
    });
    setNewPredId("");
    setNewPredType("FS");
    setNewPredLag(0);
    setShowActivityModal(true);
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    if (!activityForm.task_title.trim()) {
      return toast.error("Activity title is required");
    }
    try {
      if (editingTask) {
        await api.put(`/construction/schedule/${selectedProjectId}/activities/${editingTask.id}`, activityForm);
        toast.success("Activity updated and CPM schedule refreshed");
      } else {
        await api.post(`/construction/schedule/${selectedProjectId}/activities`, activityForm);
        toast.success("Activity added and CPM schedule refreshed");
      }
      setShowActivityModal(false);
      loadSchedule();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save activity");
    }
  };

  const handleDeleteActivity = async (taskId) => {
    if (!confirm("Remove this activity and its dependency links from the schedule?")) return;
    try {
      await api.delete(`/construction/schedule/${selectedProjectId}/activities/${taskId}`);
      toast.success("Activity removed");
      loadSchedule();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete activity");
    }
  };

  // Predecessor link addition helper in modal
  const handleAddPredecessor = () => {
    if (!newPredId) return;
    if (activityForm.predecessors.some(p => String(p.predecessor_id) === String(newPredId))) {
      return toast.warning("This predecessor is already attached");
    }
    setActivityForm({
      ...activityForm,
      predecessors: [
        ...activityForm.predecessors,
        {
          predecessor_id: Number(newPredId),
          dependency_type: newPredType,
          lag_days: Number(newPredLag || 0),
        },
      ],
    });
    setNewPredId("");
    setNewPredLag(0);
  };

  const handleRemovePredecessor = (index) => {
    const updated = [...activityForm.predecessors];
    updated.splice(index, 1);
    setActivityForm({ ...activityForm, predecessors: updated });
  };

  // EOT Submit
  const handleCreateEOT = async (e) => {
    e.preventDefault();
    if (!eotForm.delay_cause.trim()) {
      return toast.error("Please enter a delay cause");
    }
    try {
      await api.post("/construction/eot-requests", {
        ...eotForm,
        project_id: selectedProjectId,
      });
      toast.success("Extension of Time claim submitted successfully");
      setShowEOTModal(false);
      setEotForm({
        delay_cause: "",
        delay_category: "WEATHER",
        days_requested: 7,
        financial_claim_amount: 0,
        justification: "",
      });
      loadSchedule();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to submit EOT request");
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return (scheduleData.tasks || []).filter(t => {
      const matchSearch =
        !searchTerm.trim() ||
        t.task_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.wbs_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.assigned_to_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [scheduleData.tasks, searchTerm, statusFilter]);

  const { project, cpm, variance, eotClaims } = scheduleData;
  const criticalCount = (scheduleData.tasks || []).filter(t => t.is_critical).length;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar size={24} className="text-brand-900 dark:text-brand-400" />
              Project Schedule & Critical Path Method (CPM)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Activity network sequencing, earliest/latest dates, float analysis, Gantt timeline, and schedule variance
            </p>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input text-sm py-1.5 h-auto min-w-[220px]"
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_code ? `${p.project_code} - ` : ""}{p.project_name || p.name}
              </option>
            ))}
          </select>

          <button
            onClick={openAddActivity}
            className="btn btn-primary inline-flex items-center gap-1.5"
            title="Create Activity"
          >
            <Plus size={16} /> Add Activity
          </button>

          <button
            onClick={handleRecalculateCPM}
            disabled={calculating || !scheduleData.tasks?.length}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-brand-700 dark:text-brand-300 font-bold"
            title="Compute Forward/Backward Pass CPM"
          >
            <RefreshCw size={15} className={calculating ? "animate-spin" : ""} />
            {calculating ? "Computing..." : "Recalculate CPM"}
          </button>

          <button
            onClick={handleSetBaseline}
            className="btn btn-secondary inline-flex items-center gap-1.5"
            title="Lock Current Dates as Project Baseline"
          >
            <CalendarCheck size={15} /> Set Baseline
          </button>

          <button
            onClick={() => setShowEOTModal(true)}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300"
            title="Claim Extension of Time"
          >
            <Flag size={15} /> EOT Claim
          </button>
        </div>
      </div>

      {/* ── Cycle Warning Alert if Circular Dependency Exists ── */}
      {cpm?.hasCycle && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-sm block mb-0.5">Circular Dependency Detected in Activity Network</span>
            The schedule contains a circular predecessor loop involving {cpm.cycleTasks?.length || 0} activities. The calculation engine has gracefully fallen back. Please inspect predecessors on the activities marked below to restore a valid acyclic topological sequence.
          </div>
        </div>
      )}

      {/* ── Summary KPI Badges ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-3 bg-brand-50 dark:bg-brand-900/30 text-brand-600 rounded-xl">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Duration</p>
            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {cpm?.projectDurationDays || 0} Days
            </p>
            <p className="text-[10px] text-slate-400">Critical network length</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className={`p-3 rounded-xl ${criticalCount > 0 ? "bg-rose-50 text-rose-600 dark:bg-rose-900/30" : "bg-emerald-50 text-emerald-600"}`}>
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Critical Path</p>
            <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {criticalCount} Activities
            </p>
            <p className="text-[10px] text-slate-400">Zero Total Float (Must not delay)</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actual Progress</p>
            <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {variance?.actualProgress || 0}%
            </p>
            <p className="text-[10px] text-slate-400">Planned: {variance?.plannedProgress || 0}% (SPI: {variance?.spi || 1.0})</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className={`p-3 rounded-xl ${(variance?.scheduleVarianceDays || 0) < 0 ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30" : "bg-emerald-50 text-emerald-600"}`}>
            <Timer size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Schedule Variance</p>
            <p className={`text-2xl font-bold font-mono ${(variance?.scheduleVarianceDays || 0) < 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {(variance?.scheduleVarianceDays || 0) < 0 ? `${Math.abs(variance.scheduleVarianceDays)}d Late` : `${variance?.scheduleVarianceDays || 0}d Buffer`}
            </p>
            <p className="text-[10px] text-slate-400">Forecast: {cpm?.forecastCompletionDate || "-"}</p>
          </div>
        </div>
      </div>

      {/* ── 5 Tab Navigation ── */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6">
          {[
            { id: "overview", label: "Tab 1: Schedule Overview", icon: Info },
            { id: "activities", label: "Tab 2: Activities & Dependencies", icon: Sliders },
            { id: "gantt", label: "Tab 3: Gantt Chart", icon: BarChart2 },
            { id: "cpm", label: "Tab 4: Critical Path Analysis", icon: Activity },
            { id: "variance", label: "Tab 5: Progress & Schedule Variance", icon: TrendingUp },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-xs transition-colors ${
                  active
                    ? "border-brand-600 text-brand-600 dark:text-brand-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── TAB 1: SCHEDULE OVERVIEW ── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project & Schedule Details Card */}
            <div className="card p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Info size={16} className="text-brand-600" /> Project Schedule Specification
              </h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Project Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{project?.project_name || "General Construction Project"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Project Code</span>
                  <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{project?.project_code || "PRJ-001"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Project Manager</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{project?.manager_name || "General Engineer"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Working Calendar</span>
                  <span className="badge badge-secondary font-mono text-[11px]">6-Day (Mon - Sat)</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Planned Start Date</span>
                  <span className="font-mono">{project?.start_date ? project.start_date.split("T")[0] : "Not Defined"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Target Completion Date</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {project?.end_date ? project.end_date.split("T")[0] : "Not Defined"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Forecast Completion Date</span>
                  <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
                    {cpm?.forecastCompletionDate || "Pending CPM"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Baseline Status</span>
                  <span className="badge badge-success text-[10px]">BASELINED</span>
                </div>
              </div>

              {/* Overall Progress Meter */}
              <div className="pt-2">
                <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                  <span className="text-slate-600 dark:text-slate-300">Overall Physical Completion</span>
                  <span className="font-mono text-brand-600 dark:text-brand-400">{variance?.actualProgress || 0}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-brand-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, variance?.actualProgress || 0))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* WBS & Work Packages Breakdown Card */}
            <div className="card p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers size={16} className="text-brand-600" /> Work Packages & Phases ({scheduleData.workPackages?.length || 0})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Work Package</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleData.workPackages?.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-4 text-slate-400 italic">
                          No work packages defined. Activities can be assigned directly to WBS levels.
                        </td>
                      </tr>
                    ) : (
                      scheduleData.workPackages?.map(wp => (
                        <tr key={wp.id}>
                          <td className="font-mono font-bold">{wp.package_code || "WP"}</td>
                          <td>{wp.package_name}</td>
                          <td>
                            <span className="badge badge-secondary text-[10px]">{wp.status || "ACTIVE"}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: ACTIVITIES & DEPENDENCIES ── */}
      {activeTab === "activities" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search activity name, WBS, or assignee..."
                className="input text-xs w-full sm:w-72"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <select
                className="input text-xs w-40"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="DELAYED">Delayed</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Showing {filteredTasks.length} of {scheduleData.tasks?.length || 0} activities
            </span>
          </div>

          {/* Activities Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th>WBS</th>
                    <th>Activity Name</th>
                    <th>Work Package</th>
                    <th className="text-center">Duration (Days)</th>
                    <th>Predecessors</th>
                    <th>Assigned Resources</th>
                    <th>Planned Dates</th>
                    <th className="text-center">Progress</th>
                    <th>Status</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                        {scheduleData.tasks?.length === 0
                          ? 'No activities scheduled for this project. Click "+ Add Activity" above to create the activity network.'
                          : 'No activities match your current search or status filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map(t => (
                      <tr key={t.id} className={t.is_critical ? "bg-rose-50/40 dark:bg-rose-950/20" : ""}>
                        <td className="font-mono font-bold text-brand-600 dark:text-brand-400">
                          {t.wbs_code || `A-${t.id}`}
                        </td>
                        <td className="font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            {t.task_title}
                            {t.is_critical ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200">
                                CRITICAL
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="text-slate-500">{t.work_package_name || "-"}</td>
                        <td className="text-center font-mono font-bold">{t.duration_days}d</td>
                        <td>
                          {t.predecessors?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {t.predecessors.map(p => (
                                <span key={p.id} className="font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">
                                  {p.predecessor_wbs || `ID:${p.predecessor_id}`} ({p.dependency_type}{p.lag_days ? `${p.lag_days > 0 ? `+${p.lag_days}` : p.lag_days}d` : ""})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">None (Start Activity)</span>
                          )}
                        </td>
                        <td>{t.assigned_to_name || "Unassigned"}</td>
                        <td className="font-mono text-[11px]">
                          {t.start_date ? t.start_date.split("T")[0] : "-"} → {t.end_date ? t.end_date.split("T")[0] : "-"}
                        </td>
                        <td className="text-center">
                          <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
                            {t.completion_percent || 0}%
                          </span>
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            t.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                            t.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                            t.status === "DELAYED" ? "bg-rose-100 text-rose-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="flex justify-center items-center gap-1">
                            <button
                              onClick={() => openEditActivity(t)}
                              className="btn btn-secondary btn-sm p-1.5"
                              title="Edit Activity"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteActivity(t.id)}
                              className="btn btn-secondary btn-sm p-1.5 text-rose-600 hover:text-rose-700"
                              title="Delete Activity"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: GANTT CHART ── */}
      {activeTab === "gantt" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Timeline Scale:</span>
              {["days", "weeks", "months"].map(mode => (
                <button
                  key={mode}
                  onClick={() => setGanttZoom(mode)}
                  className={`px-2.5 py-1 rounded-lg font-medium capitalize text-xs ${
                    ganttZoom === mode ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500 inline-block" /> Critical Path Activity
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-brand-500 inline-block" /> Non-Critical Activity
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-700 inline-block" /> Baseline Shadow
              </span>
            </div>
          </div>

          {/* Gantt Interactive Canvas */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Header Row */}
                <div className="grid grid-cols-12 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs font-bold p-3 text-slate-700 dark:text-slate-300">
                  <div className="col-span-4">Activity / WBS</div>
                  <div className="col-span-8 flex justify-between font-mono text-[11px]">
                    <span>Project Start ({project?.start_date ? project.start_date.split("T")[0] : "Day 0"})</span>
                    <span>Midpoint</span>
                    <span>Forecast Completion ({cpm?.forecastCompletionDate || "End"})</span>
                  </div>
                </div>

                {/* Task Bars List */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {scheduleData.tasks?.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 italic text-xs">
                      No activities recorded yet to render Gantt bars.
                    </div>
                  ) : (
                    scheduleData.tasks?.map((t, idx) => {
                      const maxDuration = Math.max(1, cpm?.projectDurationDays || 30);
                      const startOffset = Math.max(0, Number(t.es || 0));
                      const taskDuration = Math.max(1, Number(t.duration_days || 1));
                      const leftPercent = Math.min(95, (startOffset / maxDuration) * 100);
                      const widthPercent = Math.max(3, Math.min(100 - leftPercent, (taskDuration / maxDuration) * 100));

                      return (
                        <div key={t.id} className="grid grid-cols-12 items-center p-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 text-xs">
                          {/* Left Description */}
                          <div className="col-span-4 pr-3">
                            <div className="flex items-center justify-between">
                              <span className="font-bold truncate text-slate-900 dark:text-white" title={t.task_title}>
                                {t.wbs_code ? `${t.wbs_code} - ` : ""}{t.task_title}
                              </span>
                              <span className="font-mono text-slate-400 text-[10px] ml-2 flex-shrink-0">
                                {t.duration_days}d
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Float: {t.total_float ?? 0}d | Free: {t.free_float ?? 0}d
                            </div>
                          </div>

                          {/* Right Gantt Bar Canvas */}
                          <div className="col-span-8 relative h-7 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-0.5 overflow-hidden">
                            {/* Grid Guidelines */}
                            <div className="absolute inset-0 grid grid-cols-6 pointer-events-none opacity-20 divide-x divide-slate-400" />

                            {/* Gantt Bar */}
                            <div
                              className={`absolute top-1 bottom-1 rounded-md shadow-sm flex items-center px-2 transition-all ${
                                t.is_critical
                                  ? "bg-rose-500 text-white border border-rose-600 font-bold"
                                  : "bg-brand-500 text-white border border-brand-600"
                              }`}
                              style={{
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                              }}
                              title={`${t.task_title}\nEarly Start: ${t.early_start}\nEarly Finish: ${t.early_finish}\nTotal Float: ${t.total_float}d`}
                            >
                              {/* Progress Fill Bar */}
                              <div
                                className="absolute left-0 top-0 bottom-0 bg-black/20 rounded-l-md pointer-events-none"
                                style={{ width: `${Math.min(100, Math.max(0, t.completion_percent || 0))}%` }}
                              />
                              <span className="relative z-10 text-[10px] font-mono truncate">
                                {t.completion_percent > 0 ? `${t.completion_percent}%` : `${t.duration_days}d`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: CRITICAL PATH ANALYSIS ── */}
      {activeTab === "cpm" && (
        <div className="space-y-6">
          {/* Critical Path Flow Sequence Banner */}
          <div className="card p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Activity size={16} className="text-rose-600" /> Longest Path Dependency Sequence
              </h2>
              <span className="text-xs font-mono text-rose-600 dark:text-rose-400 font-bold">
                {cpm?.criticalPathSequence?.length || 0} Sequential Activities (Total: {cpm?.projectDurationDays || 0} Working Days)
              </span>
            </div>
            <p className="text-xs text-slate-500">
              The Critical Path is the longest sequence of dependent activities from project start to finish. Any delay on these tasks directly delays the overall project completion date.
            </p>

            {/* Sequence Flow */}
            <div className="overflow-x-auto py-2">
              <div className="flex items-center gap-2 min-w-max">
                {cpm?.criticalPathSequence?.length === 0 ? (
                  <div className="text-xs text-slate-400 italic">
                    No critical path computed yet. Click "Recalculate CPM" to analyze the activity network.
                  </div>
                ) : (
                  cpm.criticalPathSequence.map((task, idx) => (
                    <React.Fragment key={task.id}>
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs min-w-[170px] shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-mono font-bold text-rose-700 dark:text-rose-400 text-[11px]">
                            {task.wbs_code || `A-${task.id}`}
                          </span>
                          <span className="badge badge-error text-[9px] px-1.5 py-0.2">TF: 0d</span>
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white truncate" title={task.task_title}>
                          {task.task_title}
                        </p>
                        <div className="mt-2 text-[10px] text-slate-500 font-mono flex justify-between">
                          <span>{task.duration_days} days</span>
                          <span>{task.early_finish}</span>
                        </div>
                      </div>
                      {idx < cpm.criticalPathSequence.length - 1 && (
                        <ArrowRight size={16} className="text-rose-400 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Activities Threatening Deadline Callout */}
          {cpm?.activitiesThreateningDeadline?.length > 0 && (
            <div className="card p-5 border-l-4 border-l-rose-500 space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle size={16} /> Activities Threatening Project Deadline ({cpm.activitiesThreateningDeadline.length})
              </h2>
              <p className="text-xs text-slate-500">
                These activities have zero or negative float and remain incomplete. Any work stoppage or delay will directly postpone target handover:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {cpm.activitiesThreateningDeadline.map(t => (
                  <div key={t.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono font-bold text-rose-600">{t.wbs_code || `A-${t.id}`}</span>
                      <span className="font-mono text-slate-400">{t.completion_percent || 0}% Done</span>
                    </div>
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{t.task_title}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Assigned: {t.assigned_to_name || "Unassigned"} | Finish: {t.early_finish}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full CPM Calculations Grid */}
          <div className="card overflow-hidden">
            <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
                Detailed Early/Late Schedule Pass & Float Calculations
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th>WBS / Activity</th>
                    <th className="text-center">Duration</th>
                    <th className="text-center">Early Start (ES)</th>
                    <th className="text-center">Early Finish (EF)</th>
                    <th className="text-center">Late Start (LS)</th>
                    <th className="text-center">Late Finish (LF)</th>
                    <th className="text-center">Total Float (TF)</th>
                    <th className="text-center">Free Float (FF)</th>
                    <th className="text-center">Critical Path</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.tasks?.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-400 italic">
                        No activities scheduled.
                      </td>
                    </tr>
                  ) : (
                    scheduleData.tasks?.map(t => (
                      <tr key={t.id} className={t.is_critical ? "bg-rose-50/40 dark:bg-rose-950/20" : ""}>
                        <td className="font-bold text-slate-900 dark:text-white">
                          <span className="font-mono text-brand-600 dark:text-brand-400 mr-2">{t.wbs_code || `A-${t.id}`}</span>
                          {t.task_title}
                        </td>
                        <td className="text-center font-mono font-bold">{t.duration_days}d</td>
                        <td className="text-center font-mono text-blue-600 dark:text-blue-400">{t.early_start || "-"}</td>
                        <td className="text-center font-mono text-blue-600 dark:text-blue-400">{t.early_finish || "-"}</td>
                        <td className="text-center font-mono text-purple-600 dark:text-purple-400">{t.late_start || "-"}</td>
                        <td className="text-center font-mono text-purple-600 dark:text-purple-400">{t.late_finish || "-"}</td>
                        <td className="text-center font-mono font-bold">
                          <span className={t.total_float === 0 ? "text-rose-600" : "text-emerald-600"}>
                            {t.total_float ?? 0} days
                          </span>
                        </td>
                        <td className="text-center font-mono text-slate-500">{t.free_float ?? 0} days</td>
                        <td className="text-center">
                          {t.is_critical ? (
                            <span className="badge badge-error text-[10px]">CRITICAL</span>
                          ) : (
                            <span className="badge badge-secondary text-[10px]">FLOAT ({t.total_float}d)</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: PROGRESS & SCHEDULE VARIANCE ── */}
      {activeTab === "variance" && (
        <div className="space-y-6">
          {/* Schedule Health & Earned Value Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-5 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Earned Value SPI</span>
              <p className="text-3xl font-bold font-mono text-brand-600 dark:text-brand-400">
                {variance?.spi || 1.0}
              </p>
              <p className="text-xs text-slate-500">
                {variance?.spi >= 1.0 ? "Schedule Performance Index ≥ 1.0 (On Track or Ahead)" : "SPI < 1.0 (Behind Target Pace)"}
              </p>
            </div>

            <div className="card p-5 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Planned vs Actual Delta</span>
              <p className="text-3xl font-bold font-mono text-slate-900 dark:text-white">
                {variance?.actualProgress || 0}% <span className="text-sm font-normal text-slate-400">vs {variance?.plannedProgress || 0}%</span>
              </p>
              <p className="text-xs text-slate-500">
                Net progress variance: {(Number(variance?.actualProgress || 0) - Number(variance?.plannedProgress || 0)).toFixed(1)}%
              </p>
            </div>

            <div className="card p-5 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target vs Forecast Handover</span>
              <p className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {cpm?.forecastCompletionDate || "Pending"}
              </p>
              <p className="text-xs text-slate-500">
                Contract End Date: {project?.end_date ? project.end_date.split("T")[0] : "TBD"}
              </p>
            </div>
          </div>

          {/* AI Schedule Recovery Recommendations */}
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Zap size={16} className="text-amber-500" /> Schedule Recovery & Timeline Mitigation Plans
            </h2>
            {variance?.recoveryPlan?.length === 0 ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Schedule is on track with acceptable buffers. No immediate timeline compression required.
              </p>
            ) : (
              <div className="space-y-3">
                {variance.recoveryPlan.map((plan, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <AlertCircle size={14} className={plan.severity === "HIGH" ? "text-rose-500" : "text-amber-500"} />
                        {plan.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        plan.severity === "HIGH" ? "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200" : "bg-amber-100 text-amber-700"
                      }`}>
                        {plan.severity} PRIORITY
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{plan.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Extension of Time (EOT) Claims Register */}
          <div className="card overflow-hidden">
            <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Flag size={16} className="text-amber-500" /> Extension of Time (EOT) Claims Register ({eotClaims?.length || 0})
              </h2>
              <button
                onClick={() => setShowEOTModal(true)}
                className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"
              >
                <Plus size={14} /> Submit Claim
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th>Claim #</th>
                    <th>Delay Cause</th>
                    <th>Category</th>
                    <th className="text-right">Days Requested</th>
                    <th className="text-right">Financial Claim (GHS)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {eotClaims?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400 italic">
                        No EOT claims logged for this project.
                      </td>
                    </tr>
                  ) : (
                    eotClaims.map(eot => (
                      <tr key={eot.id}>
                        <td className="font-mono font-bold text-brand-600 dark:text-brand-400">
                          {eot.request_number || eot.request_no || `EOT-${eot.id}`}
                        </td>
                        <td className="font-bold text-slate-900 dark:text-white">{eot.delay_cause || eot.reason}</td>
                        <td>
                          <span className="badge badge-secondary text-[10px]">{eot.delay_category || "CLIENT_EVENT"}</span>
                        </td>
                        <td className="text-right font-mono font-bold">{eot.days_requested} days</td>
                        <td className="text-right font-mono">
                          {Number(eot.financial_claim_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            eot.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" :
                            eot.status === "REJECTED" ? "bg-rose-100 text-rose-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {eot.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Create / Edit Schedule Activity ── */}
      <ProjectModal
        open={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title={editingTask ? "Edit Schedule Activity" : "Add Schedule Activity"}
        subtitle="Define activity attributes, estimated duration, and predecessor dependencies"
        icon={Sliders}
        onSubmit={handleSaveActivity}
        submitLabel={editingTask ? "Update Activity" : "Create Activity"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Activity Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="input w-full"
                placeholder="e.g. Substructure Excavation & Footing Concrete"
                value={activityForm.task_title}
                onChange={e => setActivityForm({ ...activityForm, task_title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                WBS Code
              </label>
              <input
                type="text"
                className="input w-full font-mono"
                placeholder="e.g. 1.2.1"
                value={activityForm.wbs_code}
                onChange={e => setActivityForm({ ...activityForm, wbs_code: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Duration (Work Days) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                className="input w-full font-mono font-bold"
                placeholder="3"
                value={activityForm.duration_days}
                onChange={e => setActivityForm({ ...activityForm, duration_days: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Start Date
              </label>
              <input
                type="date"
                className="input w-full font-mono"
                value={activityForm.start_date}
                onChange={e => setActivityForm({ ...activityForm, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Target Finish Date
              </label>
              <input
                type="date"
                className="input w-full font-mono"
                value={activityForm.end_date}
                onChange={e => setActivityForm({ ...activityForm, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Assigned Resources
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g. Structural Gang A / Subcontractor"
                value={activityForm.assigned_to_name}
                onChange={e => setActivityForm({ ...activityForm, assigned_to_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Progress %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className="input w-full font-mono"
                placeholder="0"
                value={activityForm.completion_percent}
                onChange={e => setActivityForm({ ...activityForm, completion_percent: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Status
              </label>
              <select
                className="input w-full"
                value={activityForm.status}
                onChange={e => setActivityForm({ ...activityForm, status: e.target.value })}
              >
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="DELAYED">Delayed</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          </div>

          {/* Predecessors / Dependencies Box */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Predecessor Activity Dependencies (Kahn / CPM Links)
            </span>

            {/* List of current predecessors */}
            {activityForm.predecessors.length > 0 && (
              <div className="space-y-1.5">
                {activityForm.predecessors.map((p, idx) => {
                  const predTask = scheduleData.tasks?.find(t => String(t.id) === String(p.predecessor_id));
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-lg text-xs font-mono border">
                      <span>
                        <span className="font-bold text-brand-600">{predTask?.wbs_code || `ID:${p.predecessor_id}`}</span> - {predTask?.task_title || "Predecessor"}
                        <span className="ml-2 badge badge-secondary text-[10px]">{p.dependency_type} {p.lag_days ? `(${p.lag_days > 0 ? `+${p.lag_days}` : p.lag_days}d)` : ""}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePredecessor(idx)}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Predecessor Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-1 items-end">
              <div className="md:col-span-2">
                <label className="text-[10px] text-slate-500 block mb-0.5">Select Predecessor</label>
                <select
                  className="input text-xs w-full"
                  value={newPredId}
                  onChange={e => setNewPredId(e.target.value)}
                >
                  <option value="">-- Choose Predecessor Task --</option>
                  {(scheduleData.tasks || [])
                    .filter(t => !editingTask || String(t.id) !== String(editingTask.id))
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.wbs_code ? `${t.wbs_code} - ` : ""}{t.task_title}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Type</label>
                <select
                  className="input text-xs w-full font-mono"
                  value={newPredType}
                  onChange={e => setNewPredType(e.target.value)}
                >
                  <option value="FS">FS (Finish-to-Start)</option>
                  <option value="SS">SS (Start-to-Start)</option>
                  <option value="FF">FF (Finish-to-Finish)</option>
                  <option value="SF">SF (Start-to-Finish)</option>
                </select>
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleAddPredecessor}
                  disabled={!newPredId}
                  className="btn btn-secondary text-xs w-full"
                >
                  + Add Link
                </button>
              </div>
            </div>
          </div>
        </div>
      </ProjectModal>

      {/* ── MODAL: Extension of Time (EOT) Claim ── */}
      <ProjectModal
        open={showEOTModal}
        onClose={() => setShowEOTModal(false)}
        title="Submit Extension of Time (EOT) Claim"
        subtitle="Log schedule delay event, weather/client causality, and contractual claim"
        icon={Flag}
        onSubmit={handleCreateEOT}
        submitLabel="Submit EOT Claim"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Delay Event / Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="input w-full"
              placeholder="e.g. Excessive adverse rainfall & site waterlogging"
              value={eotForm.delay_cause}
              onChange={e => setEotForm({ ...eotForm, delay_cause: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Category
              </label>
              <select
                className="input w-full"
                value={eotForm.delay_category}
                onChange={e => setEotForm({ ...eotForm, delay_category: e.target.value })}
              >
                <option value="WEATHER">Adverse Weather</option>
                <option value="CLIENT_CHANGE">Client / Employer Change</option>
                <option value="FORCE_MAJEURE">Force Majeure</option>
                <option value="SITE_CONDITION">Unforeseen Site Condition</option>
                <option value="DESIGN_REVISION">Architect / Design Delay</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Days Requested <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                className="input w-full font-mono"
                placeholder="7"
                value={eotForm.days_requested}
                onChange={e => setEotForm({ ...eotForm, days_requested: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Financial Claim (GHS)
              </label>
              <input
                type="number"
                className="input w-full font-mono"
                placeholder="0.00"
                value={eotForm.financial_claim_amount}
                onChange={e => setEotForm({ ...eotForm, financial_claim_amount: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Justification & Supporting Site Records
            </label>
            <textarea
              className="input w-full min-h-[90px]"
              placeholder="Reference contract clause (e.g. FIDIC 8.4 / Public Works Clause 44), DSR daily weather reports, and critical path delay evidence..."
              value={eotForm.justification}
              onChange={e => setEotForm({ ...eotForm, justification: e.target.value })}
            />
          </div>
        </div>
      </ProjectModal>
    </div>
  );
}
