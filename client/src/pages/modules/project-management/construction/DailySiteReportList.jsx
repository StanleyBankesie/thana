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
  Eye,
  Search,
  RefreshCw,
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function DailySiteReportList() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
        // Do not make any project default selection
        setSelectedProjectId("");
      } catch (e) {
        toast.error("Failed to load projects");
      }
    })();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [selectedProjectId]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedProjectId) params.project_id = selectedProjectId;
      const res = await api.get("/construction/daily-reports", { params });
      setReports(res.data?.items || []);
    } catch (e) {
      toast.error("Failed to load daily site reports");
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(r => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.report_number?.toLowerCase().includes(q) ||
      r.site_engineer_name?.toLowerCase().includes(q) ||
      r.site_condition?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    );
  });

  const totalHeadcount = reports.reduce((acc, r) => acc + (Number(r.total_headcount) || 0), 0);
  const approvedCount = reports.filter(r => r.status === "APPROVED").length;
  const draftCount = reports.filter(r => r.status !== "APPROVED").length;

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
              <BookOpen size={24} className="text-brand-900 dark:text-brand-400" /> Daily Site Diary (DSR)
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Site weather, daily workforce headcount, plant deployment, material receipts, and activity logs
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
                {p.project_code ? `${p.project_code} - ` : ""}{p.project_name || p.name}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search reports..."
              className="input pl-9 pr-3 py-1.5 text-sm h-auto w-48"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={fetchReports}
            className="btn btn-secondary p-2"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <Link
            to={selectedProjectId ? `/project-management/daily-reports/new?project_id=${selectedProjectId}` : `/project-management/daily-reports/new`}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> New Daily Report
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Diaries Logged</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{reports.length}</p>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved Diaries</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{approvedCount}</p>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Draft / Under Review</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{draftCount}</p>
        </div>
        <div className="card p-4 space-y-1">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Cumulative Workforce</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalHeadcount} <span className="text-sm font-normal text-slate-500">Pers-Days</span></p>
        </div>
      </div>

      {/* Reports Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
            Daily Logged Site Diaries ({filteredReports.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Report #</th>
                <th>Date</th>
                <th>Weather</th>
                <th>Site Condition</th>
                <th className="text-center">Workforce</th>
                <th className="text-center">Activities</th>
                <th>Site Engineer</th>
                <th className="text-center">Status</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                    {reports.length === 0
                      ? 'No daily reports recorded for this project yet. Click "New Daily Report" to log today\'s site diary.'
                      : 'No daily reports match your search criteria.'}
                  </td>
                </tr>
              ) : (
                filteredReports.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono font-bold text-brand-600 dark:text-brand-400">{r.report_number}</td>
                    <td className="font-mono">{r.report_date ? r.report_date.split("T")[0] : "-"}</td>
                    <td>
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
                        <CloudSun size={14} className="text-amber-500" />
                        {r.weather_morning} / {r.weather_afternoon}
                      </span>
                    </td>
                    <td className="uppercase text-xs font-semibold text-slate-500">{r.site_condition || "DRY"}</td>
                    <td className="text-center font-bold text-blue-600 dark:text-blue-400 font-mono">
                      {r.total_headcount || 0} Persons
                    </td>
                    <td className="text-center font-mono">
                      {r.activity_count || 0} Tasks
                    </td>
                    <td>{r.site_engineer_name || "Resident Engineer"}</td>
                    <td className="text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        r.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                          : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <Link
                        to={`/project-management/daily-reports/${r.id}`}
                        className="btn btn-secondary btn-sm p-1.5 inline-flex items-center text-brand-600 dark:text-brand-400 hover:text-brand-700"
                        title="View Report Details"
                      >
                        <Eye size={15} />
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
