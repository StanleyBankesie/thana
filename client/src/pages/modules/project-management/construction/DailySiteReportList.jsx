/**
 * @file DailySiteReportList.jsx
 * @description Daily Site Reports (DSR) and site diary management list.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Plus,
  Calendar,
  CloudSun,
  Users,
  Truck,
  ArrowLeft,
  CheckCircle,
  Eye
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function DailySiteReportList() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!selectedProjectId) return;
    fetchReports();
  }, [selectedProjectId]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get("/construction/daily-reports", { params: { project_id: selectedProjectId } });
      setReports(res.data?.items || []);
    } catch (e) {
      toast.error("Failed to load daily site reports");
    } finally {
      setLoading(false);
    }
  };

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
                <BookOpen size={24} /> Daily Site Diary (DSR)
              </h1>
            </div>
            <p className="text-sm mt-1 opacity-80">
              Site weather, daily workforce headcount, plant deployment, material receipts, and activity logs
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
            <Link
              to={`/project-management/daily-reports/new?project_id=${selectedProjectId}`}
              className="btn-success flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
            >
              <Plus size={16} /> New Daily Report
            </Link>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
            Daily Logged Site Diaries ({reports.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b">
              <tr>
                <th className="p-3">Report #</th>
                <th className="p-3">Date</th>
                <th className="p-3">Weather</th>
                <th className="p-3">Site Condition</th>
                <th className="p-3 text-center">Workforce</th>
                <th className="p-3 text-center">Activities</th>
                <th className="p-3">Site Engineer</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                    No daily reports recorded for this project yet. Click "New Daily Report" to log today's site diary.
                  </td>
                </tr>
              ) : (
                reports.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-brand-600">{r.report_number}</td>
                    <td className="p-3 font-mono">{r.report_date ? r.report_date.split("T")[0] : "-"}</td>
                    <td className="p-3">
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
                        <CloudSun size={14} className="text-amber-500" />
                        {r.weather_morning} / {r.weather_afternoon}
                      </span>
                    </td>
                    <td className="p-3 uppercase text-[10px] font-bold text-slate-500">{r.site_condition || "DRY"}</td>
                    <td className="p-3 text-center font-bold text-blue-600 font-mono">
                      {r.total_headcount || 0} Persons
                    </td>
                    <td className="p-3 text-center font-mono">
                      {r.activity_count || 0} Tasks
                    </td>
                    <td className="p-3">{r.site_engineer_name || "Resident Engineer"}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        r.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <Link
                        to={`/project-management/daily-reports/${r.id}`}
                        className="p-1 text-brand-600 hover:bg-brand-50 rounded inline-block"
                        title="View Report Details"
                      >
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
