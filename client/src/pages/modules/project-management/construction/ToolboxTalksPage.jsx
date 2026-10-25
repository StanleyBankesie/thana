/**
 * @file ToolboxTalksPage.jsx
 * @description Dedicated Toolbox Talks & Safety Briefings Register for Project Management HSE.
 * Records daily pre-shift safety briefings, topics, worker attendance, and site safety reminders.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Megaphone,
  Plus,
  ArrowLeft,
  Search,
  RefreshCw,
  Users,
  CheckCircle2,
  Calendar,
  Building2,
  Eye,
  BookOpen,
  Award,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ProjectModal from "../components/ProjectModal.jsx";

export default function ToolboxTalksPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [talks, setTalks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [selectedTalk, setSelectedTalk] = useState(null);

  const [form, setForm] = useState({
    project_id: "",
    talk_date: new Date().toISOString().split("T")[0],
    topic: "",
    conductor_name: "",
    attendee_count: "",
    notes: "",
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchTalks();
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

  const fetchTalks = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedProjectId) params.project_id = selectedProjectId;
      const res = await api.get("/construction/toolbox-talks", { params });
      setTalks(res.data?.items || []);
    } catch (e) {
      toast.error("Failed to load toolbox talks");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      project_id: selectedProjectId || (projects.length > 0 ? projects[0].id : ""),
      talk_date: new Date().toISOString().split("T")[0],
      topic: "",
      conductor_name: "",
      attendee_count: "",
      notes: "",
    });
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleCreateTalk = async (e) => {
    e.preventDefault();
    if (!form.project_id) {
      toast.error("Please select a project");
      return;
    }
    if (!form.topic?.trim()) {
      toast.error("Please specify a safety topic");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/construction/toolbox-talks", {
        ...form,
        attendee_count: Number(form.attendee_count || 0),
      });
      toast.success("Toolbox talk recorded successfully");
      setShowModal(false);
      fetchTalks();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record toolbox talk");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalSessions = talks.length;
  const totalAttendees = talks.reduce((sum, t) => sum + Number(t.attendee_count || t.attendees_count || 0), 0);
  const avgAttendance = totalSessions > 0 ? Math.round(totalAttendees / totalSessions) : 0;
  const latestDate = talks.length > 0 && talks[0].talk_date ? talks[0].talk_date.split("T")[0] : "-";

  // Filter
  const filteredTalks = talks.filter((t) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.topic?.toLowerCase().includes(q) ||
      t.conductor_name?.toLowerCase().includes(q) ||
      t.notes?.toLowerCase().includes(q) ||
      t.project_name?.toLowerCase().includes(q)
    );
  });

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
              <Megaphone size={24} className="text-blue-600 dark:text-blue-400" />
              Toolbox Talks & Safety Briefings
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Daily pre-task safety talks, task-specific hazard awareness, and workforce participation records
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchTalks}
            className="btn btn-secondary p-2"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="btn btn-primary inline-flex items-center gap-1.5"
          >
            <Plus size={16} /> Log Toolbox Talk
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Briefings Held</span>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{totalSessions}</p>
          <p className="text-[10px] text-slate-400">Recorded safety briefings</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Worker Attendances</span>
          <p className="text-2xl font-bold font-mono text-blue-600">{totalAttendees}</p>
          <p className="text-[10px] text-slate-400">Total operatives briefed</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Average Attendance</span>
          <p className="text-2xl font-bold font-mono text-emerald-600">{avgAttendance} Operatives</p>
          <p className="text-[10px] text-slate-400">Mean operatives per talk</p>
        </div>
        <div className="card p-4 space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Latest Session Date</span>
          <p className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">{latestDate}</p>
          <p className="text-[10px] text-slate-400">Most recent site briefing</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input text-sm py-1.5 h-auto min-w-[220px]"
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
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search topic, conductor, notes..."
            className="input pl-9 pr-3 py-1.5 text-sm h-auto w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Talks Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>Safety Topic Discussed</th>
                <th>Conductor / Speaker</th>
                <th className="text-right">Operatives Present</th>
                <th>Summary / Feedback Points</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin inline mr-2 text-brand-900" />
                    Loading toolbox talks...
                  </td>
                </tr>
              ) : filteredTalks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                    No toolbox safety briefings found.
                  </td>
                </tr>
              ) : (
                filteredTalks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="font-mono text-xs whitespace-nowrap">
                      {t.talk_date ? t.talk_date.split("T")[0] : "-"}
                    </td>
                    <td className="text-xs max-w-[160px] truncate" title={t.project_name}>
                      {t.project_name || "-"}
                    </td>
                    <td className="font-bold text-xs text-blue-700 dark:text-blue-400 max-w-[220px] truncate" title={t.topic}>
                      {t.topic}
                    </td>
                    <td className="text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {t.conductor_name || t.delivered_by || "Safety Officer"}
                    </td>
                    <td className="text-right font-mono font-bold text-xs">
                      {t.attendee_count ?? t.attendees_count ?? 0} Operatives
                    </td>
                    <td className="text-xs text-slate-500 max-w-[280px] truncate" title={t.notes || t.summary_points || ""}>
                      {t.notes || t.summary_points || "-"}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => setSelectedTalk(t)}
                        className="btn btn-secondary p-1.5 text-xs inline-flex items-center gap-1"
                        title="View Talk Details"
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

      {/* Modal: Log Toolbox Talk */}
      <ProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Log Toolbox Safety Talk"
        subtitle="Record pre-task briefing topic, speaker, and operative attendee count"
        icon={Megaphone}
        onSubmit={handleCreateTalk}
        submitLabel="Log Toolbox Talk"
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
                Briefing Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={form.talk_date}
                onChange={(e) => setForm({ ...form, talk_date: e.target.value })}
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
              placeholder="e.g. Scaffolding tag inspection, harness tie-offs, PPE compliance"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Operatives Present (Count) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                placeholder="0"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                value={form.attendee_count}
                onChange={(e) => setForm({ ...form, attendee_count: e.target.value })}
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
                value={form.conductor_name}
                onChange={(e) => setForm({ ...form, conductor_name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Key Discussion Points & Operative Feedback
            </label>
            <textarea
              placeholder="Summary of safety points emphasized, hazards raised by workers, PPE distributed..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
      </ProjectModal>

      {/* Modal: Talk Detail View */}
      {selectedTalk && (
        <ProjectModal
          open={!!selectedTalk}
          onClose={() => setSelectedTalk(null)}
          title={`Toolbox Talk Details - ${selectedTalk.talk_date ? selectedTalk.talk_date.split("T")[0] : ""}`}
          subtitle={`Topic: ${selectedTalk.topic}`}
          icon={Megaphone}
          maxWidth="max-w-xl"
          footer={
            <button
              onClick={() => setSelectedTalk(null)}
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
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTalk.project_name || "-"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Date</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  {selectedTalk.talk_date ? selectedTalk.talk_date.split("T")[0] : "-"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Speaker / Conductor</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedTalk.conductor_name || selectedTalk.delivered_by || "Safety Officer"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Workers Present</span>
                <span className="font-semibold text-blue-600 font-mono">
                  {selectedTalk.attendee_count ?? selectedTalk.attendees_count ?? 0} Operatives
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 font-bold block mb-1">Safety Topic:</span>
              <p className="p-2.5 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 rounded-lg border border-blue-200 dark:border-blue-900/40 font-semibold">
                {selectedTalk.topic}
              </p>
            </div>

            <div>
              <span className="text-slate-500 font-bold block mb-1">Key Summary Points & Worker Feedback:</span>
              <p className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 whitespace-pre-line">
                {selectedTalk.notes || selectedTalk.summary_points || "No additional notes recorded for this session."}
              </p>
            </div>
          </div>
        </ProjectModal>
      )}
    </div>
  );
}
