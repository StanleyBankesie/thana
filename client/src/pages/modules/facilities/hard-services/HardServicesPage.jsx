import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wrench, Plus, Filter, RefreshCw, ArrowLeft,
  Server, AlertTriangle, CalendarClock, WifiOff, Search, Pencil, Eye, X
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

// ─── Helpers ────────────────────────────────────────────────────────────────

const CRITICALITY_COLORS = {
  MISSION_CRITICAL: "bg-rose-100   text-rose-700   dark:bg-rose-950   dark:text-rose-300",
  HIGH:             "bg-amber-100  text-amber-700  dark:bg-amber-950  dark:text-amber-300",
  MEDIUM:           "bg-blue-100   text-blue-700   dark:bg-blue-950   dark:text-blue-300",
  LOW:              "bg-slate-100  text-slate-600  dark:bg-slate-800  dark:text-slate-300",
};

const OP_STATUS_COLORS = {
  OPERATIONAL:       "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  DEGRADED:          "bg-amber-100   text-amber-700   dark:bg-amber-950   dark:text-amber-300",
  OFFLINE:           "bg-rose-100    text-rose-700    dark:bg-rose-950    dark:text-rose-300",
  UNDER_MAINTENANCE: "bg-blue-100    text-blue-700    dark:bg-blue-950    dark:text-blue-300",
};

const CATEGORY_COLORS = {
  ELECTRICAL:        "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  HVAC:              "bg-sky-100    text-sky-700    dark:bg-sky-950    dark:text-sky-300",
  PLUMBING:          "bg-cyan-100   text-cyan-700   dark:bg-cyan-950   dark:text-cyan-300",
  GENERATOR_POWER:   "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  ELEVATOR_ESCALATOR:"bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  FIRE_SAFETY:       "bg-rose-100   text-rose-700   dark:bg-rose-950   dark:text-rose-300",
  WATER_TREATMENT:   "bg-teal-100   text-teal-700   dark:bg-teal-950   dark:text-teal-300",
  BMS_AUTOMATION:    "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  STRUCTURAL_CIVIL:  "bg-stone-100  text-stone-700  dark:bg-stone-800  dark:text-stone-300",
  ACCESS_HARDWARE:   "bg-slate-100  text-slate-600  dark:bg-slate-800  dark:text-slate-300",
};

const SYSTEM_CATEGORIES = [
  { value: "ELECTRICAL",         label: "Electrical" },
  { value: "HVAC",               label: "HVAC / Air Conditioning" },
  { value: "PLUMBING",           label: "Plumbing" },
  { value: "GENERATOR_POWER",    label: "Generator / Power" },
  { value: "ELEVATOR_ESCALATOR", label: "Elevator / Escalator" },
  { value: "FIRE_SAFETY",        label: "Fire Safety Systems" },
  { value: "WATER_TREATMENT",    label: "Water Treatment" },
  { value: "BMS_AUTOMATION",     label: "BMS / Building Automation" },
  { value: "STRUCTURAL_CIVIL",   label: "Structural / Civil" },
  { value: "ACCESS_HARDWARE",    label: "Access Control / Hardware" },
];

// ─── Initial Form States ─────────────────────────────────────────────────────

const getInitialSystemForm = () => ({
  property_id: "",
  system_name: "",
  system_category: "",
  manufacturer: "",
  model_no: "",
  serial_no: "",
  installation_date: "",
  warranty_expiry: "",
  criticality: "MEDIUM",
  responsible_technician: "",
  service_interval_days: 90,
  replacement_cost_estimate: "",
  notes: "",
});

const getInitialUpdateForm = () => ({
  operational_status: "",
  last_serviced_date: "",
  next_service_due: "",
  notes: "",
});

// ─── Utility ─────────────────────────────────────────────────────────────────

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HardServicesPage() {
  const navigate = useNavigate();

  // Data
  const [properties, setProperties] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [filterProperty, setFilterProperty] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [viewingSystem, setViewingSystem] = useState(null);
  const [activeSystem, setActiveSystem] = useState(null);

  // Forms
  const [systemForm, setSystemForm] = useState(getInitialSystemForm());
  const [updateForm, setUpdateForm] = useState(getInitialUpdateForm());

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchProperties = useCallback(async () => {
    try {
      const res = await api.get("/facilities/properties");
      setProperties(res.data?.data || []);
    } catch {}
  }, []);

  const fetchSystems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterProperty) params.set("propertyId", filterProperty);
      if (filterCategory) params.set("category", filterCategory);
      if (filterStatus)   params.set("status", filterStatus);
      if (searchQuery)    params.set("search", searchQuery);

      const res = await api.get(`/facilities/hard-services?${params.toString()}`);
      setSystems(res.data?.data || []);
    } catch {
      toast.error("Failed to load engineering systems");
    } finally {
      setLoading(false);
    }
  }, [filterProperty, filterCategory, filterStatus, searchQuery]);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchSystems();
  }, [fetchSystems]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreateSystem = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/facilities/hard-services", systemForm);
      toast.success("Building system registered successfully");
      setShowCreateModal(false);
      setSystemForm(getInitialSystemForm());
      fetchSystems();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to register system");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSystem = async (e) => {
    e.preventDefault();
    if (!updateForm.operational_status) {
      toast.warn("Please select an operational status");
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/facilities/hard-services/${activeSystem.id}`, updateForm);
      toast.success("System record updated");
      setShowUpdateModal(false);
      setUpdateForm(getInitialUpdateForm());
      fetchSystems();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update system");
    } finally {
      setSubmitting(false);
    }
  };

  const openUpdateModal = (system) => {
    setActiveSystem(system);
    setUpdateForm({
      operational_status: system.operational_status || "",
      last_serviced_date: system.last_serviced_date ? String(system.last_serviced_date).slice(0, 10) : "",
      next_service_due:   system.next_service_due   ? String(system.next_service_due).slice(0, 10)   : "",
      notes: "",
    });
    setShowUpdateModal(true);
  };

  // ── Derived summary ────────────────────────────────────────────────────────

  const totalSystems      = systems.length;
  const missionCritical   = systems.filter((s) => s.criticality === "MISSION_CRITICAL").length;
  const overdueService    = systems.filter((s) => isOverdue(s.next_service_due)).length;
  const offlineSystems    = systems.filter((s) => s.operational_status === "OFFLINE").length;

  // ── Render ─────────────────────────────────────────────────────────────────

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
              <Wrench className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              Hard Services &amp; Technical Operations
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Manage building engineering systems — HVAC, generators, elevators, fire systems, electrical, water treatment and more.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setSystemForm(getInitialSystemForm());
            setShowCreateModal(true);
          }}
          className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
        >
          <Plus size={15} /> Register System
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <Server size={15} className="text-cyan-500" /> Total Systems
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalSystems}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <AlertTriangle size={15} className="text-rose-500" /> Mission Critical
          </div>
          <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{missionCritical}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <CalendarClock size={15} className="text-amber-500" /> Overdue Service
          </div>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{overdueService}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2">
            <WifiOff size={15} className="text-rose-500" /> Offline Systems
          </div>
          <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{offlineSystems}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap text-xs shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Filter size={13} /> Filters:
          </span>
          <select
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
          >
            <option value="">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.property_name}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
          >
            <option value="">All Categories</option>
            {SYSTEM_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
          >
            <option value="">All Statuses</option>
            <option value="OPERATIONAL">Operational</option>
            <option value="DEGRADED">Degraded</option>
            <option value="OFFLINE">Offline</option>
            <option value="UNDER_MAINTENANCE">Under Maintenance</option>
          </select>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search systems..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs w-44"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setFilterProperty("");
            setFilterCategory("");
            setFilterStatus("");
            setSearchQuery("");
          }}
          className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1"
        >
          <RefreshCw size={12} /> Reset
        </button>
      </div>

      {/* Systems Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading engineering systems...</div>
        ) : systems.length === 0 ? (
          <div className="p-14 text-center space-y-2">
            <Wrench size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Systems Registered</p>
            <p className="text-xs text-slate-400">Register your first building engineering system using the button above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">System Code</th>
                  <th className="px-3 py-3">System Name</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Criticality</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Responsible Tech</th>
                  <th className="px-3 py-3">Next Service Due</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {systems.map((system) => (
                  <tr key={system.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white whitespace-nowrap">
                      {system.system_code}
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 block">{system.system_name}</span>
                      {system.manufacturer && (
                        <span className="text-[10px] text-slate-400">{system.manufacturer}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${CATEGORY_COLORS[system.system_category] || "bg-slate-100 text-slate-600"}`}>
                        {system.system_category?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {system.property_name || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${CRITICALITY_COLORS[system.criticality] || "bg-slate-100 text-slate-600"}`}>
                        {system.criticality?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${OP_STATUS_COLORS[system.operational_status] || "bg-slate-100 text-slate-600"}`}>
                        {system.operational_status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {system.responsible_technician || "—"}
                    </td>
                    <td className={`px-3 py-3 font-mono text-[11px] whitespace-nowrap font-semibold ${
                      isOverdue(system.next_service_due)
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}>
                      {system.next_service_due ? String(system.next_service_due).slice(0, 10) : "—"}
                      {isOverdue(system.next_service_due) && (
                        <span className="ml-1 text-[9px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 px-1 py-0.5 rounded font-bold">
                          OVERDUE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setViewingSystem(system)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1"
                          title="View Technical Specifications"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          onClick={() => openUpdateModal(system)}
                          className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1"
                          title="Update Status & Service Logs"
                        >
                          <Pencil size={11} /> Edit / Update
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: Register System ──────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-3xl lg:max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench size={18} className="text-cyan-500" />
                Register Building System
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSystem} className="p-6 space-y-4 text-xs">
              {/* Property */}
              <div>
                <label className="block font-semibold mb-1">Property <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={systemForm.property_id}
                  onChange={(e) => setSystemForm({ ...systemForm, property_id: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                >
                  <option value="">Select property...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.property_name}</option>
                  ))}
                </select>
              </div>

              {/* System Name */}
              <div>
                <label className="block font-semibold mb-1">System Name <span className="text-rose-500">*</span></label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Rooftop Chiller Unit A"
                  value={systemForm.system_name}
                  onChange={(e) => setSystemForm({ ...systemForm, system_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                />
              </div>

              {/* System Category */}
              <div>
                <label className="block font-semibold mb-1">System Category <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={systemForm.system_category}
                  onChange={(e) => setSystemForm({ ...systemForm, system_category: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                >
                  <option value="">Select category...</option>
                  {SYSTEM_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Manufacturer & Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Manufacturer</label>
                  <input
                    type="text"
                    placeholder="e.g. Carrier"
                    value={systemForm.manufacturer}
                    onChange={(e) => setSystemForm({ ...systemForm, manufacturer: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Model No</label>
                  <input
                    type="text"
                    placeholder="e.g. 30XA-0152"
                    value={systemForm.model_no}
                    onChange={(e) => setSystemForm({ ...systemForm, model_no: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  />
                </div>
              </div>

              {/* Serial No */}
              <div>
                <label className="block font-semibold mb-1">Serial No</label>
                <input
                  type="text"
                  placeholder="e.g. SN-2024-ACC-00441"
                  value={systemForm.serial_no}
                  onChange={(e) => setSystemForm({ ...systemForm, serial_no: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                />
              </div>

              {/* Installation Date & Warranty Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Installation Date</label>
                  <input
                    type="date"
                    value={systemForm.installation_date}
                    onChange={(e) => setSystemForm({ ...systemForm, installation_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Warranty Expiry</label>
                  <input
                    type="date"
                    value={systemForm.warranty_expiry}
                    onChange={(e) => setSystemForm({ ...systemForm, warranty_expiry: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  />
                </div>
              </div>

              {/* Criticality & Service Interval */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Criticality</label>
                  <select
                    value={systemForm.criticality}
                    onChange={(e) => setSystemForm({ ...systemForm, criticality: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="MISSION_CRITICAL">Mission Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Service Interval (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={systemForm.service_interval_days}
                    onChange={(e) => setSystemForm({ ...systemForm, service_interval_days: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  />
                </div>
              </div>

              {/* Responsible Technician */}
              <div>
                <label className="block font-semibold mb-1">Responsible Technician</label>
                <input
                  type="text"
                  placeholder="e.g. Kofi Mensah (Mechanical Engineer)"
                  value={systemForm.responsible_technician}
                  onChange={(e) => setSystemForm({ ...systemForm, responsible_technician: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                />
              </div>

              {/* Replacement Cost Estimate */}
              <div>
                <label className="block font-semibold mb-1">Replacement Cost Estimate</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="e.g. 250000.00"
                  value={systemForm.replacement_cost_estimate}
                  onChange={(e) => setSystemForm({ ...systemForm, replacement_cost_estimate: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Any additional notes about this system..."
                  value={systemForm.notes}
                  onChange={(e) => setSystemForm({ ...systemForm, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-60"
                >
                  {submitting ? "Registering..." : "Register System"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Update System ────────────────────────────────────────────── */}
      {showUpdateModal && activeSystem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil size={18} className="text-cyan-500" />
                Update System — {activeSystem.system_code}
              </h3>
              <button
                type="button"
                onClick={() => setShowUpdateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateSystem} className="p-6 space-y-4 text-xs">
              {/* System info strip */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1">
                <p className="font-bold text-slate-800 dark:text-white">{activeSystem.system_name}</p>
                <p className="text-slate-500 dark:text-slate-400">
                  {activeSystem.property_name} · {activeSystem.system_category?.replace(/_/g, " ")}
                </p>
                <div className="flex gap-2 pt-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${CRITICALITY_COLORS[activeSystem.criticality] || ""}`}>
                    {activeSystem.criticality?.replace(/_/g, " ")}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${OP_STATUS_COLORS[activeSystem.operational_status] || ""}`}>
                    {activeSystem.operational_status?.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Operational Status */}
              <div>
                <label className="block font-semibold mb-1">Operational Status <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={updateForm.operational_status}
                  onChange={(e) => setUpdateForm({ ...updateForm, operational_status: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                >
                  <option value="">Select status...</option>
                  <option value="OPERATIONAL">Operational</option>
                  <option value="DEGRADED">Degraded</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                </select>
              </div>

              {/* Last Serviced & Next Service Due */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Last Serviced Date</label>
                  <input
                    type="date"
                    value={updateForm.last_serviced_date}
                    onChange={(e) => setUpdateForm({ ...updateForm, last_serviced_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Next Service Due</label>
                  <input
                    type="date"
                    value={updateForm.next_service_due}
                    onChange={(e) => setUpdateForm({ ...updateForm, next_service_due: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold mb-1">Service Notes</label>
                <textarea
                  rows={3}
                  placeholder="Describe the work done, parts replaced, observations..."
                  value={updateForm.notes}
                  onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs"
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: View System Specifications ─────────────────────────────── */}
      {viewingSystem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Server size={18} className="text-cyan-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Technical Specifications — {viewingSystem.system_code}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingSystem(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">System Name</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingSystem.system_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Category</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingSystem.system_category?.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Property</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingSystem.property_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Manufacturer</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingSystem.manufacturer || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Model / Serial</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{viewingSystem.model_no || "—"} / {viewingSystem.serial_no || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Criticality</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block mt-0.5 ${CRITICALITY_COLORS[viewingSystem.criticality] || ""}`}>
                    {viewingSystem.criticality?.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 border border-slate-100 dark:border-slate-800 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Responsible Technician</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingSystem.responsible_technician || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Service Interval</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingSystem.service_interval_days} days</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Last Serviced</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{viewingSystem.last_serviced_date ? String(viewingSystem.last_serviced_date).slice(0, 10) : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Next Service Due</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{viewingSystem.next_service_due ? String(viewingSystem.next_service_due).slice(0, 10) : "—"}</span>
                </div>
              </div>

              {viewingSystem.notes && (
                <div>
                  <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-1">Maintenance & Operating Notes</span>
                  <p className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl leading-relaxed whitespace-pre-wrap">
                    {viewingSystem.notes}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    const s = viewingSystem;
                    setViewingSystem(null);
                    openUpdateModal(s);
                  }}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  Edit / Update System
                </button>
                <button
                  type="button"
                  onClick={() => setViewingSystem(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
