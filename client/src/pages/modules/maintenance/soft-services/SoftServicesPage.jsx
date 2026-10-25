import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Sparkles, Shield, Bug, Trash2, Plus, 
  Calendar, CheckCircle2, AlertTriangle, Star, Building2, User, UserCheck, ArrowLeft,
  Clock, CheckSquare, Eye, FileText, Check, Award, Filter, RefreshCw, Edit
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function SoftServicesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("daily-tasks");
  const [properties, setProperties] = useState([]);
  const [checklists, setChecklists] = useState([]);

  // Data states
  const [tasks, setTasks] = useState([]);
  const [janitorialLogs, setJanitorialLogs] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [pestLogs, setPestLogs] = useState([]);
  const [wasteLogs, setWasteLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Operations Setup data
  const [setupShifts, setSetupShifts] = useState([]);
  const [setupSupervisors, setSetupSupervisors] = useState([]);
  const [setupPersonnel, setSetupPersonnel] = useState([]);
  const [setupCategories, setSetupCategories] = useState([]);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState("");

  // Filters for daily tasks
  const [filterDate, setFilterDate] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [viewingTask, setViewingTask] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Blank un-prefilled task form
  const getInitialTaskForm = () => ({
    property_id: "",
    task_category: "",
    title: "",
    description: "",
    assignment_type: "",
    scheduled_date: "",
    shift: "",
    assigned_to_name: "",
    supervisor_name: "",
    priority: "",
    checklist_template_id: "",
    schedule_mode: "SINGLE", // "SINGLE" | "MULTIPLE" | "RANGE"
    selected_dates: [],
    custom_date_input: "",
    range_start_date: "",
    range_end_date: "",
    selected_weekdays: [1, 2, 3, 4, 5], // 1=Mon .. 7=Sun
  });

  const [taskForm, setTaskForm] = useState(getInitialTaskForm());

  // Execute / Checklist Completion Form
  const [executionForm, setExecutionForm] = useState({
    completion_notes: "",
    items: [],
  });

  // Verify Form
  const [verifyForm, setVerifyForm] = useState({
    supervisor_rating: 5,
    supervisor_comments: "",
  });

  // Legacy forms (clean, un-prefilled initial states)
  const [janForm, setJanForm] = useState({
    property_id: "",
    cleaner_name: "",
    log_date: "",
    shift: "",
    restrooms_sanitized: 0,
    floors_mopped: 0,
    trash_emptied: 0,
    soap_paper_restocked: 0,
    supervisor_rating: 0,
    supervisor_name: "",
    notes: ""
  });

  const [secForm, setSecForm] = useState({
    property_id: "",
    guard_name: "",
    checkpoint_name: "",
    checkpoint_status: "",
    incident_description: "",
    action_taken: ""
  });

  const [pestForm, setPestForm] = useState({
    property_id: "",
    treatment_date: "",
    technician_name: "",
    target_pest: "",
    chemicals_applied: "",
    dosage_and_method: "",
    bait_stations_checked: "",
    bait_stations_activity_detected: "",
    risk_level: "",
    notes: ""
  });

  const [wasteForm, setWasteForm] = useState({
    property_id: "",
    collection_date: "",
    waste_type: "",
    quantity_kg_or_bins: "",
    unit: "",
    contractor_carrier_name: "",
    manifest_reference_no: ""
  });

  useEffect(() => {
    fetchProperties();
    fetchChecklists();
    fetchSetupData();
  }, []);

  const fetchSetupData = async () => {
    try {
      const res = await api.get("/facilities/setup/overview");
      const d = res.data?.data || {};
      setSetupShifts(d.shifts || []);
      setSetupSupervisors(d.supervisors || []);
      setSetupPersonnel(d.personnel || []);
      setSetupCategories(d.categories || []);
    } catch {}
  };

  useEffect(() => {
    fetchActiveData();
  }, [activeTab, filterDate, filterCategory, filterStatus]);

  const fetchProperties = async () => {
    try {
      const res = await api.get("/facilities/properties");
      setProperties(res.data?.data || []);
    } catch {}
  };

  const fetchChecklists = async () => {
    try {
      const res = await api.get("/facilities/checklists/templates");
      setChecklists(res.data?.data || []);
    } catch {}
  };

  const fetchActiveData = async () => {
    setLoading(true);
    try {
      if (activeTab === "daily-tasks") {
        let url = `/facilities/soft-tasks?category=${filterCategory}&status=${filterStatus}`;
        if (filterDate) url += `&date=${filterDate}`;
        const res = await api.get(url);
        setTasks(res.data?.data || []);
      } else if (activeTab === "janitorial") {
        const res = await api.get("/facilities/janitorial-logs");
        setJanitorialLogs(res.data?.data || []);
      } else if (activeTab === "security") {
        const res = await api.get("/facilities/security-patrol-logs");
        setSecurityLogs(res.data?.data || []);
      } else if (activeTab === "pest") {
        const res = await api.get("/facilities/pest-control-logs");
        setPestLogs(res.data?.data || []);
      } else if (activeTab === "waste") {
        const res = await api.get("/facilities/waste-disposal-logs");
        setWasteLogs(res.data?.data || []);
      }
    } catch {
      toast.error(`Failed to load ${activeTab} records`);
    } finally {
      setLoading(false);
    }
  };

  // Supervisor assigns daily task
  const handleAssignTask = async (e) => {
    e.preventDefault();

    if (!taskForm.property_id) {
      toast.warn("Target Property is required.");
      return;
    }
    if (!taskForm.task_category) {
      toast.warn("Service Category is required.");
      return;
    }
    if (!taskForm.priority) {
      toast.warn("Priority Level is required.");
      return;
    }
    if (!taskForm.assignment_type) {
      toast.warn("Assignment Type is required.");
      return;
    }
    if (!taskForm.shift) {
      toast.warn("Shift is required.");
      return;
    }
    if (!taskForm.assigned_to_name.trim()) {
      toast.warn("Assigned Personnel Name is required.");
      return;
    }
    if (!taskForm.supervisor_name.trim()) {
      toast.warn("Supervisor Name is required.");
      return;
    }
    if (!taskForm.checklist_template_id) {
      toast.warn("Inspection Checklist Template is required.");
      return;
    }
    if (!taskForm.title.trim()) {
      toast.warn("Task Title is required.");
      return;
    }
    if (!taskForm.description.trim()) {
      toast.warn("Description / Instructions are required.");
      return;
    }

    // Determine target dates
    let targetDates = [];
    if (taskForm.schedule_mode === "SINGLE") {
      if (!taskForm.scheduled_date) {
        toast.warn("Scheduled Date is required.");
        return;
      }
      targetDates = [taskForm.scheduled_date];
    } else if (taskForm.schedule_mode === "MULTIPLE") {
      if (!taskForm.selected_dates || taskForm.selected_dates.length === 0) {
        toast.warn("Please add at least one scheduled date.");
        return;
      }
      targetDates = [...taskForm.selected_dates];
    } else if (taskForm.schedule_mode === "RANGE") {
      if (!taskForm.range_start_date || !taskForm.range_end_date) {
        toast.warn("Range Start Date and End Date are required.");
        return;
      }
      if (new Date(taskForm.range_start_date) > new Date(taskForm.range_end_date)) {
        toast.warn("Range Start Date cannot be after End Date.");
        return;
      }
      if (!taskForm.selected_weekdays || taskForm.selected_weekdays.length === 0) {
        toast.warn("Please select at least one active weekday for the recurring schedule.");
        return;
      }
      const s = new Date(taskForm.range_start_date);
      const end = new Date(taskForm.range_end_date);
      for (let cur = new Date(s); cur <= end; cur.setDate(cur.getDate() + 1)) {
        const dayNum = cur.getDay() === 0 ? 7 : cur.getDay(); // 1=Mon .. 7=Sun
        if (taskForm.selected_weekdays.includes(dayNum)) {
          targetDates.push(cur.toISOString().slice(0, 10));
        }
      }
      if (targetDates.length === 0) {
        toast.warn("No days in the selected date range match the chosen weekdays.");
        return;
      }
    }

    setSubmitting(true);
    try {
      // Find checklist template items if template selected
      let checklist_data = null;
      if (taskForm.checklist_template_id) {
        const selTpl = checklists.find((c) => String(c.id) === String(taskForm.checklist_template_id));
        if (selTpl && selTpl.items) {
          checklist_data = selTpl.items.map((it) => ({
            item_text: it.item_text,
            checked: false,
            notes: "",
          }));
        } else {
          checklist_data = [
            { item_text: "Visual inspection & area preparation", checked: false },
            { item_text: "Main task execution per standard operating procedure", checked: false },
            { item_text: "Safety & PPE protocols verified", checked: false },
            { item_text: "Clean up & waste removed", checked: false },
          ];
        }
      }

      await api.post("/facilities/soft-tasks", {
        ...taskForm,
        scheduled_dates: targetDates,
        scheduled_date: targetDates[0],
        checklist_data,
      });

      toast.success(
        targetDates.length > 1
          ? `Successfully assigned ${targetDates.length} tasks across scheduled dates!`
          : "Daily soft facilities task assigned successfully!"
      );
      setShowAssignModal(false);
      setTaskForm(getInitialTaskForm());
      fetchActiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign task");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Execute Modal
  const openExecuteModal = (task) => {
    setActiveTask(task);
    let items = [];
    if (task.checklist_data) {
      try {
        items = typeof task.checklist_data === "string" ? JSON.parse(task.checklist_data) : task.checklist_data;
      } catch {
        items = [];
      }
    }
    if (!items || items.length === 0) {
      items = [
        { item_text: "Restrooms sanitized & restocked", checked: true },
        { item_text: "Floors vacuumed & mopped", checked: true },
        { item_text: "Trash cans emptied and fresh liners installed", checked: true },
        { item_text: "High-touch surfaces disinfected", checked: true },
      ];
    }
    setExecutionForm({
      completion_notes: task.completion_notes || "All operational checklists completed per protocol.",
      items,
    });
    setShowExecuteModal(true);
  };

  // Personnel completes job
  const handleCompleteJob = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/facilities/soft-tasks/${activeTask.id}/execute`, {
        checklist_data: executionForm.items,
        completion_notes: executionForm.completion_notes,
      });
      toast.success("Job completed and submitted for supervisor verification!");
      setShowExecuteModal(false);
      fetchActiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to complete job");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Supervisor Verify Modal
  const openVerifyModal = (task) => {
    setActiveTask(task);
    setVerifyForm({
      supervisor_rating: task.supervisor_rating || 5,
      supervisor_comments: task.supervisor_comments || "Work inspected and verified to standard.",
    });
    setShowVerifyModal(true);
  };

  // Supervisor signs off & approves
  const handleVerifySignoff = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/facilities/soft-tasks/${activeTask.id}/verify`, verifyForm);
      toast.success("Task verified and signed off by supervisor!");
      setShowVerifyModal(false);
      fetchActiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to verify task");
    } finally {
      setSubmitting(false);
    }
  };

  // Legacy record logger
  const handleCreateRecord = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (activeTab === "janitorial") {
        await api.post("/facilities/janitorial-logs", janForm);
        toast.success("Janitorial audit logged successfully");
      } else if (activeTab === "security") {
        await api.post("/facilities/security-patrol-logs", secForm);
        toast.success("Security patrol checkpoint logged");
      } else if (activeTab === "pest") {
        await api.post("/facilities/pest-control-logs", pestForm);
        toast.success("Pest control treatment logged");
      } else if (activeTab === "waste") {
        await api.post("/facilities/waste-disposal-logs", wasteForm);
        toast.success("Waste manifest recorded");
      }
      fetchActiveData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit record");
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics for Daily Tasks
  const taskCounts = {
    total: tasks.length,
    assigned: tasks.filter((t) => t.status === "ASSIGNED" || t.status === "PENDING").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    verified: tasks.filter((t) => t.status === "VERIFIED").length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs"
            title="Go Back"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Soft Facilities Services & Site Operations
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Supervise daily staff task assignments, scheduled routines, janitorial hygiene, security patrols, pest control & waste manifests.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "daily-tasks" ? (
            <button
              onClick={() => {
                setTaskForm(getInitialTaskForm());
                setShowAssignModal(true);
              }}
              className="btn btn-primary inline-flex items-center gap-2 shadow-sm active:scale-95 text-xs py-2 px-3.5"
            >
              <Plus size={15} />
              Assign Daily Task
            </button>
          ) : (
            <button
              onClick={handleCreateRecord}
              className="btn btn-primary inline-flex items-center gap-2 text-xs py-2 px-3.5"
            >
              <Plus size={15} />
              Log {activeTab.toUpperCase()}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("daily-tasks")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "daily-tasks"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Calendar size={14} />
          Daily Task Assignments & Verification
          {taskCounts.assigned > 0 && (
            <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {taskCounts.assigned}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("janitorial")}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "janitorial"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Sparkles size={14} />
          Janitorial Audits
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "security"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Shield size={14} />
          Security Patrol Rounds
        </button>

        <button
          onClick={() => setActiveTab("pest")}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "pest"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Bug size={14} />
          Pest Control Treatments
        </button>

        <button
          onClick={() => setActiveTab("waste")}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "waste"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Trash2 size={14} />
          Waste Manifests
        </button>
      </div>

      {/* DAILY TASK ASSIGNMENTS TAB */}
      {activeTab === "daily-tasks" && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap text-xs shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Filter size={13} /> Filters:
              </span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="ALL">All Categories</option>
                <option value="JANITORIAL">Janitorial / Cleaning</option>
                <option value="SECURITY_PATROL">Security Patrol</option>
                <option value="PEST_CONTROL">Pest Control</option>
                <option value="WASTE_MANAGEMENT">Waste Management</option>
                <option value="LANDSCAPING">Landscaping</option>
                <option value="CONCIERGE_FRONTDESK">Front Desk / Concierge</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="ASSIGNED">Assigned / Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="VERIFIED">Verified & Approved</option>
              </select>
            </div>
            <button
              onClick={() => {
                setFilterDate("");
                setFilterCategory("ALL");
                setFilterStatus("ALL");
              }}
              className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1"
            >
              <RefreshCw size={12} /> Reset Filters
            </button>
          </div>

          {/* Tasks Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading daily tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CheckSquare size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Soft Facilities Tasks Found</p>
                <p className="text-xs text-slate-400">Supervisors can assign daily or scheduled routines using the "Assign Daily Task" button.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Task Details</th>
                      <th className="px-3 py-3">Property</th>
                      <th className="px-3 py-3">Assigned To</th>
                      <th className="px-3 py-3">Schedule / Shift</th>
                      <th className="px-3 py-3">Priority</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Supervisor Sign-off</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-[10px] text-slate-400 block">{task.task_no}</span>
                          <span className="font-bold text-slate-900 dark:text-white block mt-0.5">{task.title}</span>
                          <span className="text-[11px] text-slate-500 block truncate max-w-xs">{task.description}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{task.property_name || "Primary Estate"}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-slate-400 flex-shrink-0" />
                            <span className="font-medium text-slate-800 dark:text-slate-200">{task.assigned_to_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-mono text-slate-700 dark:text-slate-300 block">{task.scheduled_date ? String(task.scheduled_date).slice(0, 10) : "Today"}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase inline-block mt-0.5">
                            {task.shift}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            task.priority === "HIGH" || task.priority === "URGENT"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            task.status === "VERIFIED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : task.status === "COMPLETED"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : task.status === "IN_PROGRESS"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}>
                            {task.status === "VERIFIED" && <Check size={11} />}
                            {task.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {task.verified_by_supervisor ? (
                            <div className="space-y-0.5">
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                                <Award size={13} /> Verified
                              </span>
                              <div className="flex items-center gap-0.5 text-amber-500">
                                {[...Array(task.supervisor_rating || 5)].map((_, i) => (
                                  <Star key={i} size={11} fill="currentColor" />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Pending Sign-off</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setViewingTask(task)}
                              className="btn btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1"
                              title="View Task Details & Checkpoints"
                            >
                              <Eye size={12} /> View
                            </button>
                            {task.status !== "COMPLETED" && task.status !== "VERIFIED" && (
                              <button
                                onClick={() => openExecuteModal(task)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1"
                                title="Check off inspection items and complete task"
                              >
                                <Edit size={12} /> Check & Complete
                              </button>
                            )}
                            {task.status === "COMPLETED" && (
                              <button
                                onClick={() => openVerifyModal(task)}
                                className="px-2.5 py-1 bg-brand-900 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1"
                                title="Supervisor Inspect & Sign-off"
                              >
                                <CheckCircle2 size={12} /> Verify & Sign-Off
                              </button>
                            )}
                            {task.status === "VERIFIED" && (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold ml-1">Approved</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* JANITORIAL AUDITS TAB */}
      {activeTab === "janitorial" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-500" />
              Restroom & Office Hygiene Audits
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Cleaner</th>
                  <th className="p-2.5">Shift</th>
                  <th className="p-2.5">Sanitized</th>
                  <th className="p-2.5">Mopped</th>
                  <th className="p-2.5">Rating</th>
                  <th className="p-2.5">Supervisor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {janitorialLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="p-2.5 font-mono">{String(log.log_date).slice(0, 10)}</td>
                    <td className="p-2.5 font-semibold">{log.cleaner_name}</td>
                    <td className="p-2.5">{log.shift}</td>
                    <td className="p-2.5">{log.restrooms_sanitized ? "✅ Yes" : "❌ No"}</td>
                    <td className="p-2.5">{log.floors_mopped ? "✅ Yes" : "❌ No"}</td>
                    <td className="p-2.5 text-amber-500 font-bold">⭐ {log.supervisor_rating}/5</td>
                    <td className="p-2.5">{log.supervisor_name || "Supervisor"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECURITY PATROL TAB */}
      {activeTab === "security" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Shield size={16} className="text-emerald-500" />
            Security Guard Patrol Checkpoints
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b">
                <tr>
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Guard</th>
                  <th className="p-2.5">Checkpoint</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Incident / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {securityLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="p-2.5 font-mono">{String(log.patrol_time).slice(0, 16)}</td>
                    <td className="p-2.5 font-semibold">{log.guard_name}</td>
                    <td className="p-2.5">{log.checkpoint_name}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.checkpoint_status === "SECURE" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}>
                        {log.checkpoint_status}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-500">{log.incident_description || "Routine patrol - all secure"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PEST CONTROL TAB */}
      {activeTab === "pest" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Bug size={16} className="text-emerald-500" />
            Pest Extermination & Fumigation Treatments
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b">
                <tr>
                  <th className="p-2.5">Treatment Date</th>
                  <th className="p-2.5">Target Pest</th>
                  <th className="p-2.5">Technician</th>
                  <th className="p-2.5">Chemical Applied</th>
                  <th className="p-2.5">Bait Activity</th>
                  <th className="p-2.5">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pestLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="p-2.5 font-mono">{String(log.treatment_date).slice(0, 10)}</td>
                    <td className="p-2.5 font-bold text-emerald-600">{log.target_pest}</td>
                    <td className="p-2.5">{log.technician_name}</td>
                    <td className="p-2.5">{log.chemicals_applied}</td>
                    <td className="p-2.5">{log.bait_stations_activity_detected} active of {log.bait_stations_checked}</td>
                    <td className="p-2.5">{log.risk_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WASTE DISPOSAL TAB */}
      {activeTab === "waste" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Trash2 size={16} className="text-emerald-500" />
            Waste Collection & Carrier Manifests
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b">
                <tr>
                  <th className="p-2.5">Collection Date</th>
                  <th className="p-2.5">Waste Stream</th>
                  <th className="p-2.5">Quantity</th>
                  <th className="p-2.5">Contractor Carrier</th>
                  <th className="p-2.5">Manifest Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {wasteLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="p-2.5 font-mono">{String(log.collection_date).slice(0, 10)}</td>
                    <td className="p-2.5 font-bold">{log.waste_type}</td>
                    <td className="p-2.5">{log.quantity_kg_or_bins} {log.unit}</td>
                    <td className="p-2.5">{log.contractor_carrier_name}</td>
                    <td className="p-2.5 font-mono text-slate-500">{log.manifest_reference_no || "MNF-2026-01"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN DAILY TASK */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl lg:max-w-5xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Assign Daily Soft Facilities Task & Inspection
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Dispatch operational site tasks to staff configured in Operations Setup with digital checklists.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleAssignTask} className="p-6 space-y-5 text-xs">
              {/* Multi-Column Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Target Property <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={taskForm.property_id}
                    onChange={(e) => setTaskForm({ ...taskForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium"
                    required
                  >
                    <option value="">-- Choose Target Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.property_name} ({p.property_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Service Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={taskForm.task_category}
                    onChange={(e) => setTaskForm({ ...taskForm, task_category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium"
                    required
                  >
                    <option value="">-- Choose Service Category --</option>
                    {setupCategories.length > 0 ? (
                      setupCategories.map((c) => (
                        <option key={c.id} value={c.category_code || c.category_name}>
                          {c.category_name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="JANITORIAL">🧹 Janitorial & Cleaning</option>
                        <option value="SECURITY_PATROL">🛡️ Security Patrol</option>
                        <option value="PEST_CONTROL">🐜 Pest Control</option>
                        <option value="WASTE_MANAGEMENT">🗑️ Waste Management</option>
                        <option value="LANDSCAPING">🌿 Landscaping & Grounds</option>
                        <option value="CONCIERGE_FRONTDESK">🛎️ Concierge & Front Desk</option>
                        <option value="GENERAL_FACILITIES">🏢 General Site Operation</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Priority Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold"
                    required
                  >
                    <option value="">-- Choose Priority Level --</option>
                    <option value="LOW">🟢 Low</option>
                    <option value="MEDIUM">🟡 Medium</option>
                    <option value="HIGH">🟠 High</option>
                    <option value="URGENT">🔴 Urgent / Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Assignment Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={taskForm.assignment_type}
                    onChange={(e) => setTaskForm({ ...taskForm, assignment_type: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                    required
                  >
                    <option value="">-- Choose Assignment Type --</option>
                    <option value="MANUAL">Manual (Single Daily)</option>
                    <option value="SCHEDULED_DAILY">Recurring Daily Schedule</option>
                    <option value="SCHEDULED_WEEKLY">Recurring Weekly</option>
                    <option value="SHIFT_BASED">Shift-Based Routine</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Shift (from Operations Setup) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={taskForm.shift}
                    onChange={(e) => setTaskForm({ ...taskForm, shift: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium"
                    required
                  >
                    <option value="">-- Choose Shift --</option>
                    {setupShifts.length > 0 ? (
                      setupShifts.map((s) => (
                        <option key={s.id} value={s.code || s.name.toUpperCase().replace(/\s+/g, "_")}>
                          {s.name} ({s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="MORNING">Morning (06:00 - 14:00)</option>
                        <option value="AFTERNOON">Afternoon (14:00 - 22:00)</option>
                        <option value="NIGHT">Night (22:00 - 06:00)</option>
                        <option value="ALL_DAY">Full Day</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Assigned Personnel Name <span className="text-red-500">*</span>
                  </label>
                  {setupPersonnel.length > 0 ? (
                    <select
                      value={taskForm.assigned_to_name}
                      onChange={(e) => {
                        const selName = e.target.value;
                        const p = setupPersonnel.find((x) => x.name === selName);
                        setTaskForm((prev) => ({
                          ...prev,
                          assigned_to_name: selName,
                          ...(p?.category && !prev.task_category ? { task_category: p.category } : {}),
                          ...(p?.shift_name && !prev.shift ? { shift: p.shift_name.toUpperCase().replace(/\s+/g, "_") } : {}),
                          ...(p?.supervisor_name && !prev.supervisor_name ? { supervisor_name: p.supervisor_name } : {}),
                        }));
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium"
                      required
                    >
                      <option value="">-- Choose Assigned Personnel --</option>
                      {setupPersonnel.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name} {p.category ? `• ${p.category}` : ""} {p.employee_code ? `(${p.employee_code})` : ""} {p.shift_name ? `• ${p.shift_name}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. Grace Mensah (Cleaner)"
                      value={taskForm.assigned_to_name}
                      onChange={(e) => setTaskForm({ ...taskForm, assigned_to_name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Supervisor Name (from Setup) <span className="text-red-500">*</span>
                  </label>
                  {setupSupervisors.length > 0 ? (
                    <select
                      value={taskForm.supervisor_name}
                      onChange={(e) => setTaskForm({ ...taskForm, supervisor_name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium"
                      required
                    >
                      <option value="">-- Choose Configured Supervisor --</option>
                      {setupSupervisors.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} {s.shift_name ? `(${s.shift_name})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. David Osei (FM Supervisor)"
                      value={taskForm.supervisor_name}
                      onChange={(e) => setTaskForm({ ...taskForm, supervisor_name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Inspection Checklist Template <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={taskForm.checklist_template_id}
                    onChange={(e) => setTaskForm({ ...taskForm, checklist_template_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium"
                    required
                  >
                    <option value="">-- Choose Checklist Template --</option>
                    <option value="STANDARD">Standard Daily Checklist</option>
                    {checklists.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.template_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Multi-Date / Scheduling & Roster System Section */}
                <div className="md:col-span-2 lg:col-span-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <label className="text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5">
                      <Calendar size={15} className="text-emerald-500" />
                      Personnel Scheduling & Multi-Date Assignment <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setTaskForm({ ...taskForm, schedule_mode: "SINGLE" })}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                          taskForm.schedule_mode === "SINGLE"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                      >
                        Single Date
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskForm({ ...taskForm, schedule_mode: "MULTIPLE" })}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                          taskForm.schedule_mode === "MULTIPLE"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                      >
                        Specific Multiple Dates
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskForm({ ...taskForm, schedule_mode: "RANGE" })}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                          taskForm.schedule_mode === "RANGE"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                        }`}
                      >
                        Roster / Date Range
                      </button>
                    </div>
                  </div>

                  {/* Mode 1: Single Date */}
                  {taskForm.schedule_mode === "SINGLE" && (
                    <div className="max-w-xs">
                      <label className="block text-slate-600 dark:text-slate-400 text-[11px] font-medium mb-1">
                        Scheduled Assignment Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={taskForm.scheduled_date}
                        onChange={(e) => setTaskForm({ ...taskForm, scheduled_date: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium"
                        required={taskForm.schedule_mode === "SINGLE"}
                      />
                    </div>
                  )}

                  {/* Mode 2: Specific Multiple Dates */}
                  {taskForm.schedule_mode === "MULTIPLE" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 max-w-md">
                        <input
                          type="date"
                          value={taskForm.custom_date_input}
                          onChange={(e) => setTaskForm({ ...taskForm, custom_date_input: e.target.value })}
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs text-slate-800 dark:text-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!taskForm.custom_date_input) return;
                            if (taskForm.selected_dates.includes(taskForm.custom_date_input)) {
                              toast.info("Date already added");
                              return;
                            }
                            setTaskForm({
                              ...taskForm,
                              selected_dates: [...taskForm.selected_dates, taskForm.custom_date_input].sort(),
                              custom_date_input: "",
                            });
                          }}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold"
                        >
                          + Add Date
                        </button>
                      </div>
                      {taskForm.selected_dates.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {taskForm.selected_dates.map((d) => (
                            <span
                              key={d}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-mono font-medium"
                            >
                              {d}
                              <button
                                type="button"
                                onClick={() =>
                                  setTaskForm({
                                    ...taskForm,
                                    selected_dates: taskForm.selected_dates.filter((x) => x !== d),
                                  })
                                }
                                className="hover:text-red-500 font-bold"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                          Pick dates above and click "+ Add Date" to schedule across multiple days.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Mode 3: Date Range & Roster Schedule */}
                  {taskForm.schedule_mode === "RANGE" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                        <div>
                          <label className="block text-slate-600 dark:text-slate-400 text-[11px] font-medium mb-1">
                            Start Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={taskForm.range_start_date}
                            onChange={(e) => setTaskForm({ ...taskForm, range_start_date: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs text-slate-800 dark:text-slate-200"
                            required={taskForm.schedule_mode === "RANGE"}
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 dark:text-slate-400 text-[11px] font-medium mb-1">
                            End Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={taskForm.range_end_date}
                            onChange={(e) => setTaskForm({ ...taskForm, range_end_date: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs text-slate-800 dark:text-slate-200"
                            required={taskForm.schedule_mode === "RANGE"}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                            Active Recurring Days (Shift Roster):
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setTaskForm({ ...taskForm, selected_weekdays: [1, 2, 3, 4, 5, 6, 7] })}
                              className="text-[10px] text-emerald-600 hover:underline font-semibold"
                            >
                              All 7 Days
                            </button>
                            <button
                              type="button"
                              onClick={() => setTaskForm({ ...taskForm, selected_weekdays: [1, 2, 3, 4, 5] })}
                              className="text-[10px] text-emerald-600 hover:underline font-semibold"
                            >
                              Mon–Fri Only
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { num: 1, label: "Mon" },
                            { num: 2, label: "Tue" },
                            { num: 3, label: "Wed" },
                            { num: 4, label: "Thu" },
                            { num: 5, label: "Fri" },
                            { num: 6, label: "Sat" },
                            { num: 7, label: "Sun" },
                          ].map((day) => {
                            const active = taskForm.selected_weekdays.includes(day.num);
                            return (
                              <button
                                key={day.num}
                                type="button"
                                onClick={() => {
                                  const next = active
                                    ? taskForm.selected_weekdays.filter((d) => d !== day.num)
                                    : [...taskForm.selected_weekdays, day.num];
                                  setTaskForm({ ...taskForm, selected_weekdays: next });
                                }}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                  active
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                                }`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Task Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ground Floor Restroom Sanitization & Deep Clean"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium"
                    required
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Description / Instructions <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Specific tasks to perform, focus areas, chemical safety guidelines, PPE requirements..."
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  {submitting ? "Assigning..." : "Assign Task to Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXECUTE / CHECK OFF TASK */}
      {showExecuteModal && activeTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl lg:max-w-4xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <span className="font-mono text-[10px] text-slate-400 block">{activeTask.task_no}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckSquare size={17} className="text-emerald-500" />
                  Perform & Check Task: {activeTask.title}
                </h3>
              </div>
              <button onClick={() => setShowExecuteModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleCompleteJob} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Assigned Personnel</span>
                  <span className="font-bold text-slate-850 dark:text-white text-xs">{activeTask.assigned_to_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Target Property</span>
                  <span className="font-bold text-slate-850 dark:text-white text-xs">{activeTask.property_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Shift & Scheduled Date</span>
                  <span className="font-bold text-slate-850 dark:text-white text-xs">{activeTask.shift} ({String(activeTask.scheduled_date).slice(0, 10)})</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">Checklist Items (Tap to Mark Done):</label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {executionForm.items.map((item, idx) => (
                    <label key={idx} className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-colors border border-slate-200/50 dark:border-slate-700/50">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => {
                          const updated = [...executionForm.items];
                          updated[idx].checked = e.target.checked;
                          setExecutionForm({ ...executionForm, items: updated });
                        }}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span className={`text-xs ${item.checked ? "line-through text-slate-400" : "font-medium text-slate-750 dark:text-slate-200"}`}>
                        {item.item_text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Completion Notes / Supplies Used</label>
                <textarea
                  rows={3}
                  value={executionForm.completion_notes}
                  onChange={(e) => setExecutionForm({ ...executionForm, completion_notes: e.target.value })}
                  placeholder="Notes on supplies used, issues noticed, physical areas completed..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  required
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowExecuteModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  {submitting ? "Submitting..." : "Submit Job as Done"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUPERVISOR VERIFY & SIGN-OFF */}
      {showVerifyModal && activeTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl lg:max-w-3xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award size={18} className="text-emerald-500" />
                Supervisor Inspection & Sign-off
              </h3>
              <button onClick={() => setShowVerifyModal(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleVerifySignoff} className="p-6 space-y-4 text-xs">
              <div className="bg-emerald-50 dark:bg-emerald-950/60 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 space-y-1.5">
                <div className="font-bold text-emerald-900 dark:text-emerald-200 text-sm">{activeTask.title}</div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300">Completed by {activeTask.assigned_to_name}</div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 italic mt-1 bg-white/70 dark:bg-black/30 p-2.5 rounded-lg">
                  "{activeTask.completion_notes || "Job completed per standard."}"
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Supervisor Quality Rating (1 - 5 Stars)</label>
                <div className="flex items-center gap-2 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setVerifyForm({ ...verifyForm, supervisor_rating: star })}
                      className="p-1 text-amber-500 hover:scale-110 transition-transform"
                    >
                      <Star size={26} fill={verifyForm.supervisor_rating >= star ? "currentColor" : "none"} />
                    </button>
                  ))}
                  <span className="font-extrabold text-base text-slate-800 dark:text-slate-200 ml-2">{verifyForm.supervisor_rating} / 5</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Supervisor Inspection Notes</label>
                <textarea
                  rows={3}
                  value={verifyForm.supervisor_comments}
                  onChange={(e) => setVerifyForm({ ...verifyForm, supervisor_comments: e.target.value })}
                  placeholder="Confirm cleanliness, hygiene standards met, security gates verified, physical sign-off stamp..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  required
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  {submitting ? "Signing off..." : "Approve & Stamp Verified"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: VIEW TASK DETAILS */}
      {viewingTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl lg:max-w-3xl shadow-2xl overflow-hidden my-auto sm:my-8 transition-all">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div>
                <span className="font-mono text-[10px] text-slate-400 block">{viewingTask.task_no}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText size={17} className="text-emerald-500" />
                  {viewingTask.title}
                </h3>
              </div>
              <button
                onClick={() => setViewingTask(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[11px] block">Status</span>
                  <span className="font-bold text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        viewingTask.status === "VERIFIED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : viewingTask.status === "COMPLETED"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          : viewingTask.status === "IN_PROGRESS"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {viewingTask.status}
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Property</span>
                  <span className="font-bold text-slate-850 dark:text-white text-xs">{viewingTask.property_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Assigned Personnel</span>
                  <span className="font-bold text-slate-850 dark:text-white text-xs">{viewingTask.assigned_to_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Shift & Date</span>
                  <span className="font-bold text-slate-850 dark:text-white text-xs">{viewingTask.shift} ({String(viewingTask.scheduled_date).slice(0, 10)})</span>
                </div>
              </div>

              {viewingTask.description && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Instructions / Scope:</span>
                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50 leading-relaxed">
                    {viewingTask.description}
                  </p>
                </div>
              )}

              {/* Checklist items */}
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-2">Checklist Items:</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {(() => {
                    let items = [];
                    try {
                      items = typeof viewingTask.checklist_data === "string" ? JSON.parse(viewingTask.checklist_data) : viewingTask.checklist_data || [];
                    } catch {
                      items = [];
                    }
                    if (!items.length) {
                      return <span className="text-slate-400 italic">No checklist items recorded.</span>;
                    }
                    return items.map((it, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/40 dark:border-slate-700/40">
                        <span className={it.checked ? "text-emerald-600 font-bold" : "text-slate-400"}>
                          {it.checked ? "✓" : "○"}
                        </span>
                        <span className={it.checked ? "line-through text-slate-400" : "font-medium text-slate-700 dark:text-slate-300"}>
                          {it.item_text}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Completion Notes */}
              {viewingTask.completion_notes && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Completion Notes / Supplies Used:</span>
                  <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                    {viewingTask.completion_notes}
                  </p>
                </div>
              )}

              {/* Supervisor verification */}
              {viewingTask.verified_by_supervisor && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">Supervisor Sign-off: Verified</span>
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {[...Array(viewingTask.supervisor_rating || 5)].map((_, i) => (
                        <Star key={i} size={13} fill="currentColor" />
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 italic">
                    "{viewingTask.supervisor_comments || "Inspected and approved."}"
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingTask(null)}
                className="btn btn-secondary text-xs px-4 py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
