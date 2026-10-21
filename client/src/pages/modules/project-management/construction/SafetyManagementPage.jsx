/**
 * @file SafetyManagementPage.jsx
 * @description Health, Safety & Environment (HSE) management for construction sites.
 * Tracks incidents, lost-time injuries, toolbox talks, and safety statistics.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  Plus,
  ArrowLeft,
  AlertTriangle,
  Megaphone,
  CheckCircle,
  Clock,
  X,
  HeartPulse,
  Search,
  RefreshCw
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function SafetyManagementPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [talks, setTalks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showTalkModal, setShowTalkModal] = useState(false);

  const [incidentForm, setIncidentForm] = useState({
    incident_date: new Date().toISOString().split("T")[0],
    incident_type: "NEAR_MISS",
    location: "",
    injured_person_name: "",
    description: "",
    root_cause: "",
    corrective_action: "",
    days_lost: 0,
    reported_to_authority: "N",
  });

  const [talkForm, setTalkForm] = useState({
    talk_date: new Date().toISOString().split("T")[0],
    topic: "Working at Heights & Harness Safety",
    conductor_name: "",
    attendee_count: 24,
    notes: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
        if (prjs.length > 0) setSelectedProjectId(String(prjs[0].id));
      } catch (e) {
        toast.error("Failed to load projects");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    fetchHSEData();
  }, [selectedProjectId]);

  const fetchHSEData = async () => {
    setLoading(true);
    try {
      const params = { project_id: selectedProjectId };
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

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    try {
      await api.post("/construction/safety-incidents", {
        ...incidentForm,
        project_id: selectedProjectId,
      });
      toast.success("Safety incident logged");
      setShowIncidentModal(false);
      fetchHSEData();
    } catch (e) {
      toast.error("Failed to log incident");
    }
  };

  const handleCreateTalk = async (e) => {
    e.preventDefault();
    try {
      await api.post("/construction/toolbox-talks", {
        ...talkForm,
        project_id: selectedProjectId,
      });
      toast.success("Toolbox talk recorded");
      setShowTalkModal(false);
      fetchHSEData();
    } catch (e) {
      toast.error("Failed to record toolbox talk");
    }
  };

  const lostTimeCount = incidents.filter(i => i.incident_type === "LOST_TIME").length;
  const totalDaysLost = incidents.reduce((a, c) => a + Number(c.days_lost || 0), 0);

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
              <ShieldAlert size={24} className="text-brand-900 dark:text-brand-400" /> Health, Safety & Environment (HSE)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Site safety compliance, accident/near-miss investigation, and toolbox safety briefings
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input text-sm py-1.5 h-auto min-w-[180px]"
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
          >
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
          <button
            onClick={() => setShowTalkModal(true)}
            className="btn btn-secondary inline-flex items-center gap-1.5"
          >
            <Megaphone size={16} /> Log Toolbox Talk
          </button>
          <button
            onClick={() => setShowIncidentModal(true)}
            className="btn btn-primary inline-flex items-center gap-1.5"
          >
            <AlertTriangle size={16} /> Report Incident
          </button>
        </div>
      </div>

      {/* Safety Statistics */}
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

      {/* Incidents Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <HeartPulse size={16} className="text-rose-600" /> Incident & Near Miss Register ({filteredIncidents.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Classification</th>
                <th>Location</th>
                <th>Description of Incident</th>
                <th>Injured Person</th>
                <th className="text-right">Days Lost</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                    Zero incidents recorded for this project. Excellent safety compliance!
                  </td>
                </tr>
              ) : (
                filteredIncidents.map(i => (
                  <tr key={i.id}>
                    <td className="font-mono">{i.incident_date ? i.incident_date.split("T")[0] : "-"}</td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        i.incident_type === "LOST_TIME" ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-400" : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                      }`}>
                        {i.incident_type}
                      </span>
                    </td>
                    <td>{i.location || "-"}</td>
                    <td className="font-bold text-slate-900 dark:text-white">{i.description}</td>
                    <td>{i.injured_person_name || "-"}</td>
                    <td className="text-right font-mono font-bold text-rose-600">{i.days_lost || 0}</td>
                    <td className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {i.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toolbox Talks Register */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone size={16} className="text-brand-900 dark:text-brand-400" /> Toolbox Talks Briefings ({filteredTalks.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Safety Topic</th>
                <th>Briefing Conductor</th>
                <th className="text-right">Workers Present</th>
                <th>Summary / Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredTalks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic">No toolbox talks logged yet.</td>
                </tr>
              ) : (
                filteredTalks.map(t => (
                  <tr key={t.id}>
                    <td className="font-mono">{t.talk_date ? t.talk_date.split("T")[0] : "-"}</td>
                    <td className="font-bold text-brand-900 dark:text-brand-400">{t.topic}</td>
                    <td>{t.conductor_name || "Safety Officer"}</td>
                    <td className="text-right font-mono font-bold">{t.attendee_count} Operatives</td>
                    <td className="text-slate-500">{t.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Report Incident */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-600" /> Report Safety Incident
              </h3>
              <button onClick={() => setShowIncidentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateIncident} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Incident Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono"
                    value={incidentForm.incident_date}
                    onChange={e => setIncidentForm({ ...incidentForm, incident_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Classification</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={incidentForm.incident_type}
                    onChange={e => setIncidentForm({ ...incidentForm, incident_type: e.target.value })}
                  >
                    <option value="NEAR_MISS">Near Miss</option>
                    <option value="FIRST_AID">First Aid Case</option>
                    <option value="MEDICAL_TREATMENT">Medical Treatment</option>
                    <option value="LOST_TIME">Lost Time Injury (LTI)</option>
                    <option value="FATALITY">Fatality</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Location / Grid</label>
                  <input
                    type="text"
                    placeholder="e.g. Scaffolding Bay 3"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={incidentForm.location}
                    onChange={e => setIncidentForm({ ...incidentForm, location: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Injured Person (if any)</label>
                  <input
                    type="text"
                    placeholder="Worker Name / Trade"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={incidentForm.injured_person_name}
                    onChange={e => setIncidentForm({ ...incidentForm, injured_person_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Incident Description</label>
                <textarea
                  required
                  placeholder="Detail what occurred..."
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 min-h-[60px]"
                  value={incidentForm.description}
                  onChange={e => setIncidentForm({ ...incidentForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Days Lost</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono"
                    value={incidentForm.days_lost}
                    onChange={e => setIncidentForm({ ...incidentForm, days_lost: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Statutory Report Filed?</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                    value={incidentForm.reported_to_authority}
                    onChange={e => setIncidentForm({ ...incidentForm, reported_to_authority: e.target.value })}
                  >
                    <option value="N">No (Internal Only)</option>
                    <option value="Y">Yes (Inspectorate of Factories)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowIncidentModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-danger text-xs font-bold">
                  Record Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Toolbox Talk */}
      {showTalkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Megaphone size={18} className="text-brand-600" /> Log Toolbox Safety Talk
              </h3>
              <button onClick={() => setShowTalkModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateTalk} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Safety Topic</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scaffolding tag inspection and tie-offs"
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                  value={talkForm.topic}
                  onChange={e => setTalkForm({ ...talkForm, topic: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Briefing Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono"
                    value={talkForm.talk_date}
                    onChange={e => setTalkForm({ ...talkForm, talk_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Attendees Count</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900 font-mono"
                    value={talkForm.attendee_count}
                    onChange={e => setTalkForm({ ...talkForm, attendee_count: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Conductor / Speaker</label>
                <input
                  type="text"
                  placeholder="HSE Officer / Site Supervisor"
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-900"
                  value={talkForm.conductor_name}
                  onChange={e => setTalkForm({ ...talkForm, conductor_name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Key Points & Operative Feedback</label>
                <textarea
                  placeholder="Summary of points emphasized, PPE distributed..."
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-900 min-h-[60px]"
                  value={talkForm.notes}
                  onChange={e => setTalkForm({ ...talkForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowTalkModal(false)} className="btn btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn-success text-xs font-bold">
                  Save Toolbox Talk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
