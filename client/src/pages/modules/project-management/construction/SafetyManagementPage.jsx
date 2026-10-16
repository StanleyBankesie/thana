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
  HeartPulse
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function SafetyManagementPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [incidents, setIncidents] = useState([]);
  const [talks, setTalks] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/project-management" className="text-white/80 hover:text-white">
                <ArrowLeft size={18} />
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShieldAlert size={24} /> Health, Safety & Environment (HSE)
              </h1>
            </div>
            <p className="text-sm mt-1 opacity-80">
              Site safety compliance, accident/near-miss investigation, and toolbox safety briefings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm outline-none font-medium"
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id} className="text-slate-900">
                  {p.project_code} - {p.project_name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowIncidentModal(true)}
              className="btn-danger flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
            >
              <AlertTriangle size={16} /> Report Incident
            </button>
            <button
              onClick={() => setShowTalkModal(true)}
              className="btn-success flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
            >
              <Megaphone size={16} /> Log Toolbox Talk
            </button>
          </div>
        </div>
      </div>

      {/* Safety Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Safety Incidents</span>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{incidents.length}</p>
          <p className="text-[10px] text-slate-400">Total reported site events</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lost Time Injuries (LTI)</span>
          <p className={`text-2xl font-bold font-mono ${lostTimeCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {lostTimeCount}
          </p>
          <p className="text-[10px] text-slate-400">Target zero goal</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Days Lost</span>
          <p className="text-2xl font-bold font-mono text-amber-600">{totalDaysLost} Man-Days</p>
          <p className="text-[10px] text-slate-400">Workforce impact</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Toolbox Briefings Held</span>
          <p className="text-2xl font-bold font-mono text-blue-600">{talks.length} Sessions</p>
          <p className="text-[10px] text-slate-400">Preventive safety talks</p>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <HeartPulse size={16} className="text-rose-600" /> Incident & Near Miss Register
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Classification</th>
                <th className="p-3">Location</th>
                <th className="p-3">Description of Incident</th>
                <th className="p-3">Injured Person</th>
                <th className="p-3 text-right">Days Lost</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                    Zero incidents recorded for this project. Excellent safety compliance!
                  </td>
                </tr>
              ) : (
                incidents.map(i => (
                  <tr key={i.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono">{i.incident_date ? i.incident_date.split("T")[0] : "-"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        i.incident_type === "LOST_TIME" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {i.incident_type}
                      </span>
                    </td>
                    <td className="p-3">{i.location || "-"}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{i.description}</td>
                    <td className="p-3">{i.injured_person_name || "-"}</td>
                    <td className="p-3 text-right font-mono font-bold text-rose-600">{i.days_lost || 0}</td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800">
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
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone size={16} className="text-brand-600" /> Toolbox Talks Briefings
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Safety Topic</th>
                <th className="p-3">Briefing Conductor</th>
                <th className="p-3 text-right">Workers Present</th>
                <th className="p-3">Summary / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {talks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic">No toolbox talks logged yet.</td>
                </tr>
              ) : (
                talks.map(t => (
                  <tr key={t.id}>
                    <td className="p-3 font-mono">{t.talk_date ? t.talk_date.split("T")[0] : "-"}</td>
                    <td className="p-3 font-bold text-brand-600">{t.topic}</td>
                    <td className="p-3">{t.conductor_name || "Safety Officer"}</td>
                    <td className="p-3 text-right font-mono font-bold">{t.attendee_count} Operatives</td>
                    <td className="p-3 text-slate-500">{t.notes || "-"}</td>
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
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={incidentForm.incident_date}
                    onChange={e => setIncidentForm({ ...incidentForm, incident_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Classification</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
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
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                    value={incidentForm.location}
                    onChange={e => setIncidentForm({ ...incidentForm, location: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Injured Person (if any)</label>
                  <input
                    type="text"
                    placeholder="Worker Name / Trade"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
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
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 min-h-[60px]"
                  value={incidentForm.description}
                  onChange={e => setIncidentForm({ ...incidentForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Days Lost</label>
                  <input
                    type="number"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
                    value={incidentForm.days_lost}
                    onChange={e => setIncidentForm({ ...incidentForm, days_lost: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Statutory Report Filed?</label>
                  <select
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
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
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
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
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
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
                    className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 font-mono"
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
                  className="w-full px-3 py-1.5 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900"
                  value={talkForm.conductor_name}
                  onChange={e => setTalkForm({ ...talkForm, conductor_name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Key Points & Operative Feedback</label>
                <textarea
                  placeholder="Summary of points emphasized, PPE distributed..."
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-900 min-h-[60px]"
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
