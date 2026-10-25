import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ClipboardList, Plus, Search, CheckSquare, 
  Settings, ChevronRight, X, AlertCircle, ArrowLeft,
  Calendar, User, Check, Award, Clock, Star
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ViewToggle from "../../../../components/ViewToggle.jsx";

export default function ChecklistTemplatesList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("templates"); // "templates" | "assigned-runs"
  const [templates, setTemplates] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchTemplate, setDispatchTemplate] = useState(null);
  const [viewMode, setViewMode] = useState("table");
  const [searchTerm, setSearchTerm] = useState("");

  // Create Template form
  const [formData, setFormData] = useState({
    template_name: "",
    service_line: "HVAC_AIR_CONDITIONING",
    description: "",
    items: [
      { item_text: "Visual inspection for leaks, vibrations, or noise", field_type: "PASS_FAIL", is_critical: false },
      { item_text: "Measure operational voltage / pressure rating", field_type: "NUMERIC_READING", min_reading: 220, max_reading: 240, unit_of_measure: "V", is_critical: true }
    ]
  });
  const [saving, setSaving] = useState(false);

  // Dispatch Daily Task form
  const [dispatchForm, setDispatchForm] = useState({
    property_id: "",
    title: "",
    scheduled_date: new Date().toISOString().slice(0, 10),
    shift: "MORNING",
    assigned_to_name: "",
    supervisor_name: "",
    priority: "MEDIUM",
  });
  const [dispatching, setDispatching] = useState(false);

  const filteredTemplates = templates.filter((tpl) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (tpl.template_name && tpl.template_name.toLowerCase().includes(term)) ||
      (tpl.template_code && tpl.template_code.toLowerCase().includes(term)) ||
      (tpl.service_line && tpl.service_line.toLowerCase().includes(term)) ||
      (tpl.description && tpl.description.toLowerCase().includes(term))
    );
  });

  useEffect(() => {
    fetchTemplates();
    fetchProperties();
    fetchAssignedRuns();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get("/facilities/checklists/templates");
      setTemplates(res.data?.data || []);
    } catch {
      toast.error("Failed to load checklist templates");
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const res = await api.get("/facilities/properties");
      setProperties(res.data?.data || []);
      if (res.data?.data?.length > 0 && !dispatchForm.property_id) {
        setDispatchForm((prev) => ({ ...prev, property_id: res.data.data[0].id }));
      }
    } catch {}
  };

  const fetchAssignedRuns = async () => {
    try {
      const res = await api.get("/facilities/soft-tasks");
      setAssignedTasks(res.data?.data || []);
    } catch {}
  };

  const handleViewTemplate = async (tpl) => {
    try {
      const res = await api.get(`/facilities/checklists/templates/${tpl.id}`);
      setSelectedTemplate(res.data?.data);
    } catch {
      toast.error("Failed to fetch template details");
    }
  };

  const handleOpenDispatch = (tpl) => {
    setDispatchTemplate(tpl);
    setDispatchForm({
      property_id: properties[0]?.id || "",
      title: `Daily Inspection: ${tpl.template_name}`,
      scheduled_date: new Date().toISOString().slice(0, 10),
      shift: "MORNING",
      assigned_to_name: "",
      supervisor_name: "",
      priority: "MEDIUM",
    });
    setShowDispatchModal(true);
  };

  const handleDispatchTask = async (e) => {
    e.preventDefault();
    if (!dispatchForm.assigned_to_name.trim()) {
      toast.warn("Please enter assigned personnel name");
      return;
    }

    setDispatching(true);
    try {
      const checklist_data = (dispatchTemplate?.items || []).map((it) => ({
        item_text: it.item_text,
        checked: false,
      }));

      await api.post("/facilities/soft-tasks", {
        ...dispatchForm,
        task_category: "GENERAL_FACILITIES",
        checklist_template_id: dispatchTemplate?.id,
        checklist_data,
        description: `Routine inspection run using template [${dispatchTemplate?.template_name}].`,
      });

      toast.success("Inspection task dispatched to personnel successfully!");
      setShowDispatchModal(false);
      fetchAssignedRuns();
      setActiveTab("assigned-runs");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to dispatch task");
    } finally {
      setDispatching(false);
    }
  };

  const handleAddItemRow = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { item_text: "", field_type: "PASS_FAIL", is_critical: false }
      ]
    });
  };

  const handleRemoveItemRow = (index) => {
    const updated = [...formData.items];
    updated.splice(index, 1);
    setFormData({ ...formData, items: updated });
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!formData.template_name.trim() || formData.items.length === 0) {
      toast.warn("Template name and at least one item are required");
      return;
    }

    try {
      setSaving(true);
      await api.post("/facilities/checklists/templates", formData);
      toast.success("Inspection Checklist Template created successfully");
      setShowCreateModal(false);
      fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3.5 py-1.5 text-xs"
            title="Go Back"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Inspection Checklists & Daily Audit Runs
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Configurable audit standards, routine SOP checklists, and supervisor daily task dispatch to personnel.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary inline-flex items-center gap-2 text-xs py-2 px-3.5 shadow-sm active:scale-95"
        >
          <Plus size={15} /> Create Checklist Template
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "templates"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <ClipboardList size={14} />
          Checklist Templates Register ({templates.length})
        </button>

        <button
          onClick={() => setActiveTab("assigned-runs")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "assigned-runs"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Calendar size={14} />
          Daily Assigned Runs & Field Inspections ({assignedTasks.length})
        </button>
      </div>

      {/* TAB 1: TEMPLATES REGISTER */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                placeholder="Search templates by name, service line, or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">
                {filteredTemplates.length} {filteredTemplates.length === 1 ? "template" : "templates"}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 flex justify-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Template Name</th>
                      <th className="px-4 py-3">Service Line</th>
                      <th className="px-4 py-3">Checkpoints</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTemplates.map((tpl) => (
                      <tr key={tpl.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-slate-500">{tpl.template_code}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{tpl.template_name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {tpl.service_line?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {tpl.item_count} items
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-xs">
                          {tpl.description || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenDispatch(tpl)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                              title="Assign this checklist to personnel as a daily task"
                            >
                              Dispatch Task
                            </button>
                            <button
                              onClick={() => handleViewTemplate(tpl)}
                              className="px-2.5 py-1 border rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                            >
                              View Items
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ASSIGNED DAILY RUNS */}
      {activeTab === "assigned-runs" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Active Daily Inspection & Task Runs
            </h3>
            <Link to="/facilities/soft-services" className="text-xs text-emerald-600 hover:underline">
              Open Soft Services Workspace →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Task No / Title</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Assigned Personnel</th>
                  <th className="px-3 py-3">Scheduled Date</th>
                  <th className="px-3 py-3">Shift</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Supervisor Sign-off</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {assignedTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] text-slate-400 block">{t.task_no}</span>
                      <span className="font-bold text-slate-800 dark:text-white block">{t.title}</span>
                    </td>
                    <td className="px-3 py-3">{t.property_name || "Estate Site"}</td>
                    <td className="px-3 py-3 font-medium text-slate-800 dark:text-slate-200">{t.assigned_to_name}</td>
                    <td className="px-3 py-3 font-mono">{t.scheduled_date ? String(t.scheduled_date).slice(0, 10) : "Today"}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                        {t.shift}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === "VERIFIED" ? "bg-emerald-100 text-emerald-800" :
                        t.status === "COMPLETED" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {t.verified_by_supervisor ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                          <Award size={13} /> Verified (⭐ {t.supervisor_rating}/5)
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Pending verification</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: DISPATCH INSPECTION TASK */}
      {showDispatchModal && dispatchTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fadeIn">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckSquare size={16} className="text-emerald-500" />
                Dispatch Checklist Task to Personnel
              </h3>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleDispatchTask} className="p-5 space-y-4 text-xs">
              <div className="bg-emerald-50 dark:bg-emerald-950/50 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-bold block">Selected Checklist Template</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm block mt-0.5">{dispatchTemplate.template_name}</span>
                <span className="text-slate-500 text-[11px] block">{dispatchTemplate.item_count || dispatchTemplate.items?.length || 4} verification checkpoints</span>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Target Property</label>
                <select
                  value={dispatchForm.property_id}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, property_id: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  required
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.property_name} ({p.property_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Task Title</label>
                <input
                  type="text"
                  value={dispatchForm.title}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Assigned Personnel</label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe (Tech / Cleaner)"
                    value={dispatchForm.assigned_to_name}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, assigned_to_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Supervisor Name</label>
                  <input
                    type="text"
                    placeholder="e.g. David Osei"
                    value={dispatchForm.supervisor_name}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, supervisor_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    value={dispatchForm.scheduled_date}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, scheduled_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Shift</label>
                  <select
                    value={dispatchForm.shift}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, shift: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="MORNING">Morning Shift</option>
                    <option value="AFTERNOON">Afternoon Shift</option>
                    <option value="NIGHT">Night Shift</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatching}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                >
                  {dispatching ? "Dispatching..." : "Dispatch Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW TEMPLATE CHECKPOINTS */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fadeIn">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div>
                <span className="font-mono text-[10px] text-slate-400 block">{selectedTemplate.template_code}</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{selectedTemplate.template_name}</h3>
              </div>
              <button onClick={() => setSelectedTemplate(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs max-h-96 overflow-y-auto">
              <p className="text-slate-500 dark:text-slate-400">{selectedTemplate.description || "Standard inspection procedure items."}</p>
              <div className="space-y-2">
                {(selectedTemplate.items || []).map((it, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{it.item_text}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {it.field_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TEMPLATE */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-fadeIn">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus size={16} className="text-emerald-500" />
                Create Inspection Checklist Template
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. Daily Chiller Plant Operational Log"
                  value={formData.template_name}
                  onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Service Line Category</label>
                <select
                  value={formData.service_line}
                  onChange={(e) => setFormData({ ...formData, service_line: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="HVAC_AIR_CONDITIONING">HVAC & Air Conditioning</option>
                  <option value="ELECTRICAL_POWER">Electrical & Generator Power</option>
                  <option value="PLUMBING_WATER">Plumbing & Water Systems</option>
                  <option value="ELEVATORS_LIFTS">Elevators & Escalators</option>
                  <option value="FIRE_LIFE_SAFETY">Fire & Life Safety</option>
                  <option value="CLEANING_JANITORIAL">Cleaning & Janitorial</option>
                  <option value="SECURITY_ACCESS">Security & Access Control</option>
                  <option value="CIVIL_STRUCTURAL">Civil & Structural</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Explain scope of checklist..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Checkpoints / Verification Items</label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-emerald-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus size={13} /> Add Checkpoint
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {formData.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`Checkpoint #${idx + 1}`}
                        value={it.item_text}
                        onChange={(e) => {
                          const updated = [...formData.items];
                          updated[idx].item_text = e.target.value;
                          setFormData({ ...formData, items: updated });
                        }}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                        required
                      />
                      <select
                        value={it.field_type}
                        onChange={(e) => {
                          const updated = [...formData.items];
                          updated[idx].field_type = e.target.value;
                          setFormData({ ...formData, items: updated });
                        }}
                        className="w-32 bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                      >
                        <option value="PASS_FAIL">Pass / Fail</option>
                        <option value="YES_NO">Yes / No</option>
                        <option value="NUMERIC_READING">Reading</option>
                        <option value="TEXT_NOTE">Notes</option>
                      </select>
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="text-rose-500 hover:text-rose-700 font-bold px-2"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                >
                  {saving ? "Saving..." : "Create Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
