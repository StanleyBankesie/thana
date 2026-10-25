/**
 * @file IncidentRegisterPage.jsx
 * @description Dedicated Incident & Near Miss Register for Project Management HSE.
 * Enables reporting, tracking, classification, and investigation of site safety events.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Plus,
  ArrowLeft,
  Search,
  RefreshCw,
  HeartPulse,
  Filter,
  ShieldCheck,
  Calendar,
  Building2,
  Eye,
  Activity,
  AlertCircle,
  Clock,
  CheckCircle2,
  UserCheck
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ProjectModal from "../components/ProjectModal.jsx";

export default function IncidentRegisterPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const [form, setForm] = useState({
    project_id: "",
    incident_date: new Date().toISOString().split("T")[0],
    incident_type: "NEAR_MISS",
    severity: "LOW",
    location: "",
    injured_person_name: "",
    description: "",
    immediate_action_taken: "",
    root_cause: "",
    corrective_action: "",
    days_lost: "",
    reported_to_authority: "N",
    status: "REPORTED",
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [selectedProjectId]);

  const fetchProjects = async () => {
    try {
      const res = await api.get("/projects/projects", { params: { active: "all" } });
      const prjs = res.data?.items || [];
      setProjects(prjs);
    } catch (e) {
      toast.error("Failed to load projects");
    }
  };

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedProjectId) params.project_id = selectedProjectId;
      const res = await api.get("/construction/safety-incidents", { params });
      setIncidents(res.data?.items || []);
    } catch (e) {
      toast.error("Failed to load safety incidents");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      project_id: selectedProjectId || (projects.length > 0 ? projects[0].id : ""),
      incident_date: new Date().toISOString().split("T")[0],
      incident_type: "NEAR_MISS",
      severity: "LOW",
      location: "",
      injured_person_name: "",
      description: "",
      immediate_action_taken: "",
      root_cause: "",
      corrective_action: "",
      days_lost: "",
      reported_to_authority: "N",
      status: "REPORTED",
    });
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    if (!form.project_id) {
      toast.error("Please select a project");
      return;
    }
    if (!form.description?.trim()) {
      toast.error("Please provide an incident description");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/construction/safety-incidents", {
        ...form,
        days_lost: Number(form.days_lost || 0),
      });
      toast.success("Safety incident recorded successfully");
      setShowModal(false);
      fetchIncidents();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to log safety incident");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalIncidents = incidents.length;
  const nearMissCount = incidents.filter(i => (i.incident_type || "").toUpperCase().includes("NEAR_MISS")).length;
  const lostTimeCount = incidents.filter(i => (i.incident_type || "").toUpperCase().includes("LOST_TIME")).length;
  const totalDaysLost = incidents.reduce((sum, i) => sum + Number(i.days_lost || i.lost_workdays || 0), 0);

  // Filters
  const filteredIncidents = incidents.filter(i => {
    if (typeFilter !== "ALL" && i.incident_type !== typeFilter) {
      if (typeFilter === "LOST_TIME_INJURY" && i.incident_type === "LOST_TIME") {
        // match alias
      } else {
        return false;
      }
    }
    if (statusFilter !== "ALL" && i.status !== statusFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      i.incident_no?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.location?.toLowerCase().includes(q) ||
      i.injured_person_name?.toLowerCase().includes(q) ||
      i.project_name?.toLowerCase().includes(q)
    );
  });

  const getClassificationBadge = (type) => {
    const t = (type || "").toUpperCase();
    if (t.includes("FATALITY")) {
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800";
    }
    if (t.includes("LOST_TIME")) {
      return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    }
    if (t.includes("MEDICAL")) {
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800";
    }
    if (t.includes("FIRST_AID")) {
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
    }
    if (t.includes("NEAR_MISS")) {
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    }
    return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  };

  const getSeverityBadge = (severity) => {
    const s = (severity || "").toUpperCase();
    if (s === "CRITICAL") return "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800";
    if (s === "HIGH") return "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800";
    if (s === "MEDIUM") return "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800";
    return "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/project-management/safety"
            className="btn btn-secondary inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HeartPulse size={24} className="text-rose-600 dark:text-rose-400" />
              Incident & Near Miss Register
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Comprehensive accident investigation, dangerous occurrence records, and lost-time analysis
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchIncidents}
            className="btn btn-secondary p-2"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="btn btn-primary inline-flex items-center gap-1.5"
          >
            <Plus size={16} /> Report Incident
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Recorded Incidents</span>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{totalIncidents}</p>
          <p className="text-[10px] text-slate-400">Total reported site incidents</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Near Miss Events</span>
          <p className="text-2xl font-bold font-mono text-amber-600">{nearMissCount}</p>
          <p className="text-[10px] text-slate-400">Hazard proactive detections</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lost Time Injuries (LTI)</span>
          <p className={`text-2xl font-bold font-mono ${lostTimeCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {lostTimeCount}
          </p>
          <p className="text-[10px] text-slate-400">Target zero goal</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Total Days Lost</span>
          <p className="text-2xl font-bold font-mono text-rose-600">{totalDaysLost} Man-Days</p>
          <p className="text-[10px] text-slate-400">Workforce impact</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input text-sm py-1.5 h-auto min-w-[200px]"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_code} - {p.project_name}
              </option>
            ))}
          </select>

          <select
            className="input text-sm py-1.5 h-auto min-w-[160px]"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Classifications</option>
            <option value="NEAR_MISS">Near Miss</option>
            <option value="FIRST_AID">First Aid</option>
            <option value="MEDICAL_TREATMENT">Medical Treatment</option>
            <option value="LOST_TIME_INJURY">Lost Time Injury (LTI)</option>
            <option value="FATALITY">Fatality</option>
            <option value="DANGEROUS_OCCURRENCE">Dangerous Occurrence</option>
            <option value="ENVIRONMENTAL">Environmental Incident</option>
          </select>

          <select
            className="input text-sm py-1.5 h-auto min-w-[140px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="REPORTED">Reported</option>
            <option value="UNDER_INVESTIGATION">Under Investigation</option>
            <option value="ACTION_REQUIRED">Action Required</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search incident, location, person..."
            className="input pl-9 pr-3 py-1.5 text-sm h-auto w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Incidents Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Incident Ref</th>
                <th>Project</th>
                <th>Classification</th>
                <th>Severity</th>
                <th>Location</th>
                <th>Description</th>
                <th>Person Involved</th>
                <th className="text-right">Days Lost</th>
                <th className="text-center">Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin inline mr-2 text-brand-900" />
                    Loading incidents register...
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 italic">
                    No safety incidents found matching the specified criteria.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="font-mono text-xs whitespace-nowrap">
                      {i.incident_date ? i.incident_date.split("T")[0] : "-"}
                    </td>
                    <td className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {i.incident_no || `INC-#${i.id}`}
                    </td>
                    <td className="text-xs max-w-[150px] truncate" title={i.project_name}>
                      {i.project_name || "-"}
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getClassificationBadge(i.incident_type)}`}>
                        {i.incident_type}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${getSeverityBadge(i.severity)}`}>
                        {i.severity || "LOW"}
                      </span>
                    </td>
                    <td className="text-xs text-slate-600 dark:text-slate-400">{i.location || "-"}</td>
                    <td className="text-xs font-medium text-slate-900 dark:text-slate-100 max-w-[220px] truncate" title={i.description}>
                      {i.description}
                    </td>
                    <td className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {i.injured_person_name || i.persons_involved || "-"}
                    </td>
                    <td className="text-right font-mono font-bold text-xs text-rose-600">
                      {Number(i.days_lost || i.lost_workdays || 0)}
                    </td>
                    <td className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {i.status || "REPORTED"}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => setSelectedIncident(i)}
                        className="btn btn-secondary p-1.5 text-xs inline-flex items-center gap-1"
                        title="View Incident Details"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Report Incident */}
      <ProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Report Safety Incident or Near Miss"
        subtitle="Log accident details, hazards, immediate response, and corrective actions"
        icon={AlertTriangle}
        onSubmit={handleCreateIncident}
        submitLabel="Record Incident"
        submitting={submitting}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_code} - {p.project_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Incident Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={form.incident_date}
                onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Classification <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.incident_type}
                onChange={(e) => setForm({ ...form, incident_type: e.target.value })}
              >
                <option value="NEAR_MISS">Near Miss</option>
                <option value="FIRST_AID">First Aid Case</option>
                <option value="MEDICAL_TREATMENT">Medical Treatment</option>
                <option value="LOST_TIME_INJURY">Lost Time Injury (LTI)</option>
                <option value="FATALITY">Fatality</option>
                <option value="DANGEROUS_OCCURRENCE">Dangerous Occurrence</option>
                <option value="ENVIRONMENTAL">Environmental Incident</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Severity Rating
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
              >
                <option value="LOW">Low (Minor / No lost time)</option>
                <option value="MEDIUM">Medium (Medical review required)</option>
                <option value="HIGH">High (Disabling injury / major damage)</option>
                <option value="CRITICAL">Critical (Life-threatening / severe hazard)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Location / Site Zone
              </label>
              <input
                type="text"
                placeholder="e.g. Scaffolding Bay 3, Level 2 Slab"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Injured / Involved Persons
              </label>
              <input
                type="text"
                placeholder="e.g. Worker Name / Subcontractor Trade"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.injured_person_name}
                onChange={(e) => setForm({ ...form, injured_person_name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Incident Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              placeholder="Detail what occurred, circumstances, equipment involved, and sequence of events..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[75px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Immediate Action Taken
              </label>
              <textarea
                placeholder="Immediate first response, containment, or stoppage applied..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[60px]"
                value={form.immediate_action_taken}
                onChange={(e) => setForm({ ...form, immediate_action_taken: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Root Cause / Findings
              </label>
              <textarea
                placeholder="Root cause identified (unsafe condition, equipment failure, human factor)..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[60px]"
                value={form.root_cause}
                onChange={(e) => setForm({ ...form, root_cause: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Corrective & Preventive Action
            </label>
            <textarea
              placeholder="Corrective actions required to eliminate hazard and prevent recurrence..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[60px]"
              value={form.corrective_action}
              onChange={(e) => setForm({ ...form, corrective_action: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Lost Workdays (Man-Days)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={form.days_lost}
                onChange={(e) => setForm({ ...form, days_lost: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Statutory Regulatory Notification
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.reported_to_authority}
                onChange={(e) => setForm({ ...form, reported_to_authority: e.target.value })}
              >
                <option value="N">No statutory notification required</option>
                <option value="Y">Yes - Reported to Inspectorate of Factories / OSHA</option>
              </select>
            </div>
          </div>
        </div>
      </ProjectModal>

      {/* Modal: Incident Detail View */}
      {selectedIncident && (
        <ProjectModal
          open={!!selectedIncident}
          onClose={() => setSelectedIncident(null)}
          title={`Incident Detail - ${selectedIncident.incident_no || `#${selectedIncident.id}`}`}
          subtitle={`Reported on ${selectedIncident.incident_date ? selectedIncident.incident_date.split("T")[0] : "-"}`}
          icon={HeartPulse}
          maxWidth="max-w-xl"
          footer={
            <button
              onClick={() => setSelectedIncident(null)}
              className="btn btn-secondary px-4 py-2 text-sm"
            >
              Close
            </button>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Project</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedIncident.project_name || "-"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Classification</span>
                <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold border ${getClassificationBadge(selectedIncident.incident_type)}`}>
                  {selectedIncident.incident_type}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Severity</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedIncident.severity || "LOW"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Location</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedIncident.location || "-"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Injured Person</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedIncident.injured_person_name || selectedIncident.persons_involved || "-"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Days Lost</span>
                <span className="font-semibold text-rose-600 font-mono">{selectedIncident.days_lost || selectedIncident.lost_workdays || 0} Man-Days</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 font-bold block mb-1">Description:</span>
              <p className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                {selectedIncident.description}
              </p>
            </div>

            {selectedIncident.immediate_action_taken && (
              <div>
                <span className="text-slate-500 font-bold block mb-1">Immediate Action Taken:</span>
                <p className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                  {selectedIncident.immediate_action_taken}
                </p>
              </div>
            )}

            {(selectedIncident.root_cause || selectedIncident.investigation_findings) && (
              <div>
                <span className="text-slate-500 font-bold block mb-1">Root Cause & Investigation Findings:</span>
                <p className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                  {selectedIncident.root_cause || selectedIncident.investigation_findings}
                </p>
              </div>
            )}

            {(selectedIncident.corrective_action || selectedIncident.corrective_actions) && (
              <div>
                <span className="text-slate-500 font-bold block mb-1">Corrective & Preventive Action:</span>
                <p className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                  {selectedIncident.corrective_action || selectedIncident.corrective_actions}
                </p>
              </div>
            )}
          </div>
        </ProjectModal>
      )}
    </div>
  );
}
