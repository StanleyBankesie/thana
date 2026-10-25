/**
 * @file SafetyManagementPage.jsx
 * @description Health, Safety & Environment (HSE) central hub for construction projects.
 * Provides high-level KPIs, fast navigation to the Incident Register and Toolbox Talks pages,
 * and quick-action modals for logging safety events.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  Plus,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Megaphone,
  CheckCircle,
  Clock,
  X,
  HeartPulse,
  Search,
  RefreshCw,
  Users,
  ShieldCheck,
  Building2,
  FileText
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ProjectModal from "../components/ProjectModal.jsx";

export default function SafetyManagementPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [talks, setTalks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingIncident, setSubmittingIncident] = useState(false);
  const [submittingTalk, setSubmittingTalk] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showTalkModal, setShowTalkModal] = useState(false);

  const [incidentForm, setIncidentForm] = useState({
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
  });

  const [talkForm, setTalkForm] = useState({
    project_id: "",
    talk_date: new Date().toISOString().split("T")[0],
    topic: "",
    conductor_name: "",
    attendee_count: "",
    notes: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
        setSelectedProjectId("");
      } catch (e) {
        toast.error("Failed to load projects");
      }
    })();
  }, []);

  useEffect(() => {
    fetchHSEData();
  }, [selectedProjectId]);

  const fetchHSEData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedProjectId) params.project_id = selectedProjectId;
      const [iRes, tRes] = await Promise.all([
        api.get("/construction/safety-incidents", { params }),
        api.get("/construction/toolbox-talks", { params }),
      ]);
      setIncidents(iRes.data?.items || []);
      setTalks(tRes.data?.items || []);
    } catch (e) {
      toast.error("Failed to load HSE records");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenIncidentModal = () => {
    setIncidentForm({
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
    });
    setShowIncidentModal(true);
  };

  const handleOpenTalkModal = () => {
    setTalkForm({
      project_id: selectedProjectId || (projects.length > 0 ? projects[0].id : ""),
      talk_date: new Date().toISOString().split("T")[0],
      topic: "",
      conductor_name: "",
      attendee_count: "",
      notes: "",
    });
    setShowTalkModal(true);
  };

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    if (!incidentForm.project_id) {
      toast.error("Please select a project");
      return;
    }
    if (!incidentForm.description?.trim()) {
      toast.error("Please enter incident description");
      return;
    }

    setSubmittingIncident(true);
    try {
      await api.post("/construction/safety-incidents", {
        ...incidentForm,
        days_lost: Number(incidentForm.days_lost || 0),
      });
      toast.success("Safety incident recorded successfully");
      setShowIncidentModal(false);
      fetchHSEData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to log incident");
    } finally {
      setSubmittingIncident(false);
    }
  };

  const handleCreateTalk = async (e) => {
    e.preventDefault();
    if (!talkForm.project_id) {
      toast.error("Please select a project");
      return;
    }
    if (!talkForm.topic?.trim()) {
      toast.error("Please enter a safety topic");
      return;
    }

    setSubmittingTalk(true);
    try {
      await api.post("/construction/toolbox-talks", {
        ...talkForm,
        attendee_count: Number(talkForm.attendee_count || 0),
      });
      toast.success("Toolbox talk recorded successfully");
      setShowTalkModal(false);
      fetchHSEData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record toolbox talk");
    } finally {
      setSubmittingTalk(false);
    }
  };

  const lostTimeCount = incidents.filter(i => (i.incident_type || "").toUpperCase().includes("LOST_TIME")).length;
  const totalDaysLost = incidents.reduce((a, c) => a + Number(c.days_lost || c.lost_workdays || 0), 0);
  const totalAttendees = talks.reduce((a, c) => a + Number(c.attendee_count || c.attendees_count || 0), 0);

  const filteredIncidents = incidents.filter(i => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      i.description?.toLowerCase().includes(q) ||
      i.location?.toLowerCase().includes(q) ||
      i.incident_type?.toLowerCase().includes(q) ||
      i.injured_person_name?.toLowerCase().includes(q)
    );
  });

  const filteredTalks = talks.filter(t => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.topic?.toLowerCase().includes(q) ||
      t.conductor_name?.toLowerCase().includes(q) ||
      t.notes?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Canonical List Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldAlert size={24} className="text-brand-900 dark:text-brand-400" />
              Health, Safety & Environment (HSE) Hub
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Site safety compliance, accident/near-miss investigations, and workforce toolbox safety briefings
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input text-sm py-1.5 h-auto min-w-[200px]"
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.project_code} - {p.project_name}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search HSE records..."
              className="input pl-9 pr-3 py-1.5 text-sm h-auto w-48"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={fetchHSEData}
            className="btn btn-secondary p-2"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Primary HSE Modules Navigation (Exact Style Matching Reference) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4">
        {/* Card 1: Incident & Near Miss Register */}
        <div className="card p-10 md:p-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm text-center flex flex-col items-center justify-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#0B192C] dark:text-white mb-4 tracking-tight">
            Incident & Near Miss Register
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed max-w-lg mb-8">
            Log, investigate, and review accidents, near-miss events, injuries, root causes, and lost-time workdays across all active job sites.
          </p>
          <Link
            to="/project-management/safety/incidents"
            className="btn bg-[#0B192C] hover:bg-[#182d49] text-white font-bold px-8 py-3.5 rounded-xl text-sm shadow-sm transition inline-flex items-center gap-2"
          >
            Manage Incident Register →
          </Link>
        </div>

        {/* Card 2: Toolbox Talks & Safety Briefings */}
        <div className="card p-10 md:p-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm text-center flex flex-col items-center justify-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#6B21A8] dark:text-purple-300 mb-4 tracking-tight">
            Toolbox Talks & Safety Briefings
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed max-w-lg mb-8">
            Conduct daily pre-shift safety briefings, track workforce participation, discuss task-specific hazards, and reinforce site safety rules.
          </p>
          <Link
            to="/project-management/safety/toolbox-talks"
            className="btn bg-[#6B21A8] hover:bg-[#581c87] text-white font-bold px-8 py-3.5 rounded-xl text-sm shadow-sm transition inline-flex items-center gap-2"
          >
            Manage Toolbox Talks →
          </Link>
        </div>
      </div>

      {/* Safety Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Safety Incidents</span>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{incidents.length}</p>
          <p className="text-[10px] text-slate-400">Total reported site events</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lost Time Injuries (LTI)</span>
          <p className={`text-2xl font-bold font-mono ${lostTimeCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {lostTimeCount}
          </p>
          <p className="text-[10px] text-slate-400">Target zero goal</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Total Days Lost</span>
          <p className="text-2xl font-bold font-mono text-amber-600">{totalDaysLost} Man-Days</p>
          <p className="text-[10px] text-slate-400">Workforce impact</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Toolbox Briefings Held</span>
          <p className="text-2xl font-bold font-mono text-blue-600">{talks.length} Sessions</p>
          <p className="text-[10px] text-slate-400">Preventive safety talks</p>
        </div>
      </div>

      {/* Incidents Quick Preview Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <HeartPulse size={16} className="text-rose-600" /> Recent Safety Incidents & Near Misses ({filteredIncidents.length})
          </h2>
          <Link
            to="/project-management/safety/incidents"
            className="text-xs font-medium text-brand-900 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
          >
            Go to full Incident Register <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Incident Ref</th>
                <th>Classification</th>
                <th>Location</th>
                <th>Description of Incident</th>
                <th>Injured / Involved Person</th>
                <th className="text-right">Days Lost</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                    Zero incidents recorded for this project. Excellent safety compliance!
                  </td>
                </tr>
              ) : (
                filteredIncidents.slice(0, 5).map(i => (
                  <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="font-mono text-xs">{i.incident_date ? i.incident_date.split("T")[0] : "-"}</td>
                    <td className="font-mono text-xs font-semibold">{i.incident_no || `INC-#${i.id}`}</td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                        (i.incident_type || "").toUpperCase().includes("LOST_TIME")
                          ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-400"
                          : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}>
                        {i.incident_type}
                      </span>
                    </td>
                    <td className="text-xs">{i.location || "-"}</td>
                    <td className="text-xs font-bold text-slate-900 dark:text-white max-w-[250px] truncate" title={i.description}>
                      {i.description}
                    </td>
                    <td className="text-xs">{i.injured_person_name || i.persons_involved || "-"}</td>
                    <td className="text-right font-mono font-bold text-xs text-rose-600">{Number(i.days_lost || i.lost_workdays || 0)}</td>
                    <td className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {i.status || "REPORTED"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toolbox Talks Quick Preview Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone size={16} className="text-brand-900 dark:text-brand-400" /> Recent Toolbox Briefings ({filteredTalks.length})
          </h2>
          <Link
            to="/project-management/safety/toolbox-talks"
            className="text-xs font-medium text-brand-900 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
          >
            Go to full Toolbox Talks <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Safety Topic</th>
                <th>Briefing Conductor</th>
                <th className="text-right">Operatives Present</th>
                <th>Summary / Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredTalks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic">No toolbox talks logged yet.</td>
                </tr>
              ) : (
                filteredTalks.slice(0, 5).map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="font-mono text-xs">{t.talk_date ? t.talk_date.split("T")[0] : "-"}</td>
                    <td className="font-bold text-xs text-brand-900 dark:text-brand-400">{t.topic}</td>
                    <td className="text-xs">{t.conductor_name || t.delivered_by || "Safety Officer"}</td>
                    <td className="text-right font-mono font-bold text-xs">{t.attendee_count ?? t.attendees_count ?? 0} Operatives</td>
                    <td className="text-xs text-slate-500 max-w-[300px] truncate">{t.notes || t.summary_points || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Quick Report Incident */}
      <ProjectModal
        open={showIncidentModal}
        onClose={() => setShowIncidentModal(false)}
        title="Report Safety Incident or Near Miss"
        subtitle="Log HSE near-miss, first-aid, lost-time injury, or statutory notification"
        icon={AlertTriangle}
        onSubmit={handleCreateIncident}
        submitLabel="Record Incident"
        submitting={submittingIncident}
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
                value={incidentForm.project_id}
                onChange={e => setIncidentForm({ ...incidentForm, project_id: e.target.value })}
              >
                <option value="">Select Project</option>
                {projects.map(p => (
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
                value={incidentForm.incident_date}
                onChange={e => setIncidentForm({ ...incidentForm, incident_date: e.target.value })}
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
                value={incidentForm.incident_type}
                onChange={e => setIncidentForm({ ...incidentForm, incident_type: e.target.value })}
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
                value={incidentForm.severity}
                onChange={e => setIncidentForm({ ...incidentForm, severity: e.target.value })}
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
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Location / Grid</label>
              <input
                type="text"
                placeholder="e.g. Scaffolding Bay 3, Level 2 Slab"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={incidentForm.location}
                onChange={e => setIncidentForm({ ...incidentForm, location: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Injured / Involved Person</label>
              <input
                type="text"
                placeholder="e.g. Worker Name / Subcontractor Trade"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={incidentForm.injured_person_name}
                onChange={e => setIncidentForm({ ...incidentForm, injured_person_name: e.target.value })}
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
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[70px]"
              value={incidentForm.description}
              onChange={e => setIncidentForm({ ...incidentForm, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Lost Workdays (Man-Days)</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={incidentForm.days_lost}
                onChange={e => setIncidentForm({ ...incidentForm, days_lost: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Statutory Regulatory Notification</label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={incidentForm.reported_to_authority}
                onChange={e => setIncidentForm({ ...incidentForm, reported_to_authority: e.target.value })}
              >
                <option value="N">No statutory notification required</option>
                <option value="Y">Yes - Reported to Inspectorate of Factories / OSHA</option>
              </select>
            </div>
          </div>
        </div>
      </ProjectModal>

      {/* Modal: Quick Log Toolbox Talk */}
      <ProjectModal
        open={showTalkModal}
        onClose={() => setShowTalkModal(false)}
        title="Log Toolbox Safety Talk"
        subtitle="Record pre-start briefing, topic discussed, and workforce attendee count"
        icon={Megaphone}
        onSubmit={handleCreateTalk}
        submitLabel="Log Toolbox Talk"
        submitting={submittingTalk}
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
                value={talkForm.project_id}
                onChange={e => setTalkForm({ ...talkForm, project_id: e.target.value })}
              >
                <option value="">Select Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.project_code} - {p.project_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Briefing Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={talkForm.talk_date}
                onChange={e => setTalkForm({ ...talkForm, talk_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Safety Topic <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Scaffolding tag inspection, harness tie-offs, PPE"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={talkForm.topic}
              onChange={e => setTalkForm({ ...talkForm, topic: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Attendees Count <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                placeholder="0"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={talkForm.attendee_count}
                onChange={e => setTalkForm({ ...talkForm, attendee_count: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Conductor / Speaker
              </label>
              <input
                type="text"
                placeholder="e.g. HSE Officer / Site Supervisor Name"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={talkForm.conductor_name}
                onChange={e => setTalkForm({ ...talkForm, conductor_name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Key Discussion Points & Operative Feedback
            </label>
            <textarea
              placeholder="Summary of safety points emphasized, hazards raised, PPE distributed..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[70px]"
              value={talkForm.notes}
              onChange={e => setTalkForm({ ...talkForm, notes: e.target.value })}
            />
          </div>
        </div>
      </ProjectModal>
    </div>
  );
}
