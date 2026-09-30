/**
 * @fileoverview TrainingHistory component.
 * Provides functionality for TrainingHistory.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import {
  BookOpen, Search, Filter, Download, Calendar, Clock, Users,
  Award, FileText, CheckCircle, XCircle, GraduationCap, RefreshCw,
  Eye, BarChart3, TrendingUp, PieChart, Activity, BadgeCheck, Star,
  ExternalLink, ChevronDown, MoreVertical, AlertCircle,
} from "lucide-react";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function TrainingHistory() {
  const [records, setRecords] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [certLoading, setCertLoading] = useState(true);

  const [employeeId, setEmployeeId] = useState("");
  const [programId, setProgramId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [activeTab, setActiveTab] = useState("history");
  const [showTimeline, setShowTimeline] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    employee_id: "",
    certification_name: "",
    issued_by: "",
    issue_date: "",
    expiry_date: "",
    certificate_file: null,
  });

  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await api.get("/hr/employees");
      setEmployees(res?.data?.items || []);
    } catch {
      toast.error("Failed to load employees");
    }
  }, []);

  const loadPrograms = useCallback(async () => {
    try {
      const res = await api.get("/hr/training/programs");
      setPrograms(res?.data?.items || []);
    } catch {
      toast.error("Failed to load programs");
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (employeeId) params.employee_id = employeeId;
      if (programId) params.program_id = programId;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (searchTerm) params.search = searchTerm;
      const res = await api.get("/hr/training/history", { params });
      setRecords(res?.data?.items || []);
    } catch {
      toast.error("Failed to load training history");
    } finally {
      setLoading(false);
    }
  }, [employeeId, programId, fromDate, toDate, searchTerm]);

  const loadCertifications = useCallback(async () => {
    setCertLoading(true);
    try {
      const params = {};
      if (employeeId) params.employee_id = employeeId;
      const res = await api.get("/hr/training/certifications", { params });
      setCertifications(res?.data?.items || []);
    } catch {
      toast.error("Failed to load certifications");
    } finally {
      setCertLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadEmployees();
    loadPrograms();
  }, [loadEmployees, loadPrograms]);

  useEffect(() => {
    loadRecords();
    loadCertifications();
  }, [loadRecords, loadCertifications]);

  const completedRecords = records.filter((r) => r.status === "Completed" || r.status === "Confirmed");
  const certificationsEarned = certifications.filter((c) => c.certificate_url || c.status === "active");
  const activeCerts = certifications.filter((c) => {
    if (!c.expiry_date) return true;
    const exp = new Date(c.expiry_date);
    return exp >= today;
  });
  const expiringSoon = certifications.filter((c) => {
    if (!c.expiry_date) return false;
    const exp = new Date(c.expiry_date);
    return exp >= today && exp <= thirtyDaysFromNow;
  });
  const scores = completedRecords.filter((r) => r.score != null).map((r) => Number(r.score));
  const avgScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "N/A";

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setShowDetailPanel(true);
  };

  const closeDetailPanel = () => {
    setShowDetailPanel(false);
    setSelectedRecord(null);
  };

  const handleUploadCert = async (e) => {
    e.preventDefault();
    if (!uploadForm.employee_id || !uploadForm.certification_name) {
      toast.warn("Employee and certification name are required");
      return;
    }
    try {
      const payload = { ...uploadForm };
      await api.post("/hr/training/certifications", payload);
      toast.success("Certification uploaded");
      setShowUploadModal(false);
      setUploadForm({
        employee_id: "", certification_name: "", issued_by: "",
        issue_date: "", expiry_date: "", certificate_file: null,
      });
      loadCertifications();
    } catch {
      toast.error("Failed to upload certification");
    }
  };

  const handleDeleteCert = async (id) => {
    if (!window.confirm("Delete this certification?")) return;
    try {
      await api.delete(`/hr/training/certifications/${id}`);
      toast.success("Certification deleted");
      loadCertifications();
    } catch {
      toast.error("Failed to delete certification");
    }
  };

  const handleExport = () => {
    if (!records.length) {
      toast.warn("No records to export");
      return;
    }
    const headers = [
      "Employee", "Program", "Category", "Type", "Completion Date",
      "Trainer", "Score", "Status",
    ].join(",");
    const rows = records.map((r) =>
      [
        `"${r.first_name || ""} ${r.last_name || ""}"`,
        `"${r.program_title || ""}"`,
        `"${r.category || ""}"`,
        `"${r.training_type || ""}"`,
        r.completion_date || "",
        `"${r.trainer_name || ""}"`,
        r.score != null ? r.score : "",
        r.status || "",
      ].join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `training_history_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Report exported");
  };

  const getScoreColor = (score) => {
    if (score == null) return "text-slate-400";
    const n = Number(score);
    if (n >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (n >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBg = (score) => {
    if (score == null) return "bg-slate-100 dark:bg-slate-700";
    const n = Number(score);
    if (n >= 80) return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
    if (n >= 60) return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
    return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
  };

  const getStatusBadge = (status) => {
    const map = {
      Completed: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
      Confirmed: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
      "In Progress": "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
      Pending: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
      Failed: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    };
    return map[status] || "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300";
  };

  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return { label: "No Expiry", color: "text-slate-400", bg: "bg-slate-100 dark:bg-slate-700" };
    const exp = new Date(expiryDate);
    if (exp < today) return { label: "Expired", color: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-900/30" };
    if (exp <= thirtyDaysFromNow) return { label: "Expiring Soon", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-900/30" };
    return { label: "Valid", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/30" };
  };

  const filteredRecords = records.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (r.program_title || "").toLowerCase().includes(term) ||
      (r.first_name || "").toLowerCase().includes(term) ||
      (r.last_name || "").toLowerCase().includes(term) ||
      (r.category || "").toLowerCase().includes(term)
    );
  });

  const statCards = [
    {
      label: "Total Training Completed",
      value: completedRecords.length,
      icon: GraduationCap,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      label: "Certifications Earned",
      value: certificationsEarned.length,
      icon: BadgeCheck,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Active Certifications",
      value: activeCerts.length,
      icon: Award,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-900/20",
    },
    {
      label: "Expiring Soon",
      value: expiringSoon.length,
      icon: AlertCircle,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      label: "Average Score",
      value: avgScore,
      icon: BarChart3,
      color: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-cyan-50 dark:bg-cyan-900/20",
    },
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link to="/" className="hover:text-slate-700 dark:hover:text-slate-200">Home</Link>
            <span className="mx-1">/</span>
            <Link to="/human-resources?section=Training%20%26%20Development" className="hover:text-slate-700 dark:hover:text-slate-200">Human Resources</Link>
            <span className="mx-1">/</span>
            <span className="text-slate-800 dark:text-slate-100 font-medium">Training History</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Training History</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Track completed training and certifications</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadRecords(); loadCertifications(); }}
            className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={handleExport}
            className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{card.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Filter className="w-3.5 h-3.5" /> Filters
            </div>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="input text-xs py-1.5 w-44"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="input text-xs py-1.5 w-44"
            >
              <option value="">All Programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input text-xs py-1.5 w-36"
                placeholder="From"
              />
              <span className="text-xs text-slate-400">-</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input text-xs py-1.5 w-36"
                placeholder="To"
              />
            </div>
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input text-xs py-1.5 pl-8 w-full"
                placeholder="Search program or employee..."
              />
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab("history")}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "history"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 inline mr-1.5" />Training History
            </button>
            <button
              onClick={() => setActiveTab("certifications")}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "certifications"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <BadgeCheck className="w-3.5 h-3.5 inline mr-1.5" />Certifications
            </button>
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-colors ml-auto ${
                showTimeline
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5 inline mr-1.5" />Learning Timeline
            </button>
          </div>
        </div>

        {activeTab === "history" && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">Loading training records...</p>
                </div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 mb-3">
                  <BookOpen className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No training records found</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Complete a training program to see it here</p>
              </div>
            ) : (
              <table className="min-w-full">
                <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employee</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Program</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Category</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Completion Date</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Trainer</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Score</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">BadgeCheck</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {r.first_name} {r.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{r.program_title || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{r.category || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {r.training_type || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {r.completion_date ? new Date(r.completion_date).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{r.trainer_name || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getScoreBg(r.score)}`}>
                          {r.score != null ? `${r.score}%` : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusBadge(r.status)}`}>
                          {r.status || "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.certificate_url ? (
                          <a
                            href={r.certificate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" /> View
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleViewDetails(r)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {r.certificate_url && (
                            <a
                              href={r.certificate_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                              title="View BadgeCheck"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "certifications" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                <BadgeCheck className="w-4 h-4 inline mr-1.5" />Certifications
              </h3>
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Upload BadgeCheck
              </button>
            </div>
            {certLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : certifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 mb-3">
                  <Award className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No certifications yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Upload certificates to track employee credentials</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {certifications.map((cert) => {
                  const expiry = getExpiryStatus(cert.expiry_date);
                  return (
                    <div key={cert.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                            <BadgeCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">{cert.certification_name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{cert.issued_by || "Unknown Issuer"}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCert(cert.id)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          <span>Issued: {cert.issue_date ? new Date(cert.issue_date).toLocaleDateString() : "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>Expires: {cert.expiry_date ? new Date(cert.expiry_date).toLocaleDateString() : "No Expiry"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          {cert.certificate_url ? (
                            <a
                              href={cert.certificate_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <FileText className="w-3 h-3" /> Preview BadgeCheck
                            </a>
                          ) : (
                            <span className="text-slate-400">No file attached</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${expiry.bg} ${expiry.color}`}>
                          {expiry.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {showTimeline && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
              <Activity className="w-4 h-4 inline mr-1.5" />Employee Learning Timeline
            </h3>
            {filteredRecords.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">No timeline data available</p>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-600"></div>
                {[...filteredRecords]
                  .sort((a, b) => new Date(a.completion_date || a.created_at) - new Date(b.completion_date || b.created_at))
                  .map((r, idx) => (
                    <div key={r.id} className="relative pb-6 last:pb-0">
                      <div className={`absolute left-[-18px] top-1 w-[10px] h-[10px] rounded-full border-2 ${
                        r.status === "Completed" || r.status === "Confirmed"
                          ? "bg-emerald-400 border-emerald-400"
                          : r.status === "In Progress"
                            ? "bg-amber-400 border-amber-400"
                            : "bg-slate-300 border-slate-300"
                      }`}></div>
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{r.program_title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {r.first_name} {r.last_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusBadge(r.status)}`}>
                              {r.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {r.completion_date ? new Date(r.completion_date).toLocaleDateString() : "N/A"}
                          </span>
                          {r.score != null && (
                            <span className={`flex items-center gap-1 font-medium ${getScoreColor(r.score)}`}>
                              <Star className="w-3 h-3" />
                              Score: {r.score}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showDetailPanel && selectedRecord && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closeDetailPanel}></div>
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Training Details</h2>
              <button
                onClick={closeDetailPanel}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                      {selectedRecord.first_name} {selectedRecord.last_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{selectedRecord.employee_code || "Employee"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-slate-500 dark:text-slate-400">Department:</div>
                  <div className="text-slate-700 dark:text-slate-200 font-medium">{selectedRecord.department_name || "-"}</div>
                  <div className="text-slate-500 dark:text-slate-400">Position:</div>
                  <div className="text-slate-700 dark:text-slate-200 font-medium">{selectedRecord.position_name || "-"}</div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Program Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Program:</span>
                    <span className="text-slate-700 dark:text-slate-200 font-medium">{selectedRecord.program_title || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Category:</span>
                    <span className="text-slate-700 dark:text-slate-200">{selectedRecord.category || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Type:</span>
                    <span className="text-slate-700 dark:text-slate-200">{selectedRecord.training_type || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Trainer:</span>
                    <span className="text-slate-700 dark:text-slate-200">{selectedRecord.trainer_name || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Duration:</span>
                    <span className="text-slate-700 dark:text-slate-200">{selectedRecord.duration_hours ? `${selectedRecord.duration_hours}h` : "-"}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Attendance & Completion</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Status:</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusBadge(selectedRecord.status)}`}>
                      {selectedRecord.status || "Pending"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Completion Date:</span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {selectedRecord.completion_date ? new Date(selectedRecord.completion_date).toLocaleDateString() : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Attendance:</span>
                    <span className="text-slate-700 dark:text-slate-200">{selectedRecord.attendance_status || "-"}</span>
                  </div>
                </div>
              </div>

              {selectedRecord.score != null && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Score & Feedback</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Score:</span>
                      <span className={`font-semibold ${getScoreColor(selectedRecord.score)}`}>
                        {selectedRecord.score}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 mt-1">
                      <div
                        className={`h-2 rounded-full ${
                          Number(selectedRecord.score) >= 80
                            ? "bg-emerald-500"
                            : Number(selectedRecord.score) >= 60
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, Number(selectedRecord.score))}%` }}
                      ></div>
                    </div>
                    {selectedRecord.feedback && (
                      <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Feedback:</p>
                        <p className="text-sm text-slate-700 dark:text-slate-200">{selectedRecord.feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedRecord.certificate_url && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">BadgeCheck</h3>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">BadgeCheck of Completion</span>
                    <a
                      href={selectedRecord.certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> View
                    </a>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => {
                    if (selectedRecord.certificate_url) {
                      window.open(selectedRecord.certificate_url, "_blank");
                    } else {
                      const text = [
                        `Training Report: ${selectedRecord.program_title}`,
                        `Employee: ${selectedRecord.first_name} ${selectedRecord.last_name}`,
                        `Status: ${selectedRecord.status}`,
                        selectedRecord.score != null ? `Score: ${selectedRecord.score}%` : "",
                        `Date: ${selectedRecord.completion_date ? new Date(selectedRecord.completion_date).toLocaleDateString() : "N/A"}`,
                      ].filter(Boolean).join("\n");
                      const blob = new Blob([text], { type: "text/plain" });
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(blob);
                      link.download = `training_report_${selectedRecord.id}.txt`;
                      link.click();
                      URL.revokeObjectURL(link.href);
                    }
                    toast.success("Report downloaded");
                  }}
                  className="btn-primary text-xs px-4 py-2 w-full flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUploadModal(false)}></div>
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Upload BadgeCheck</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUploadCert} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Employee</label>
                <select
                  value={uploadForm.employee_id}
                  onChange={(e) => setUploadForm({ ...uploadForm, employee_id: e.target.value })}
                  className="input text-xs py-1.5 w-full"
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Certification Name</label>
                <input
                  type="text"
                  value={uploadForm.certification_name}
                  onChange={(e) => setUploadForm({ ...uploadForm, certification_name: e.target.value })}
                  className="input text-xs py-1.5 w-full"
                  placeholder="e.g. OSHA Safety BadgeCheck"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Issued By</label>
                <input
                  type="text"
                  value={uploadForm.issued_by}
                  onChange={(e) => setUploadForm({ ...uploadForm, issued_by: e.target.value })}
                  className="input text-xs py-1.5 w-full"
                  placeholder="e.g. National Safety Council"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Issue Date</label>
                  <input
                    type="date"
                    value={uploadForm.issue_date}
                    onChange={(e) => setUploadForm({ ...uploadForm, issue_date: e.target.value })}
                    className="input text-xs py-1.5 w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-1 block">Expiry Date</label>
                  <input
                    type="date"
                    value={uploadForm.expiry_date}
                    onChange={(e) => setUploadForm({ ...uploadForm, expiry_date: e.target.value })}
                    className="input text-xs py-1.5 w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn-secondary text-xs px-4 py-1.5"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs px-4 py-1.5">
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
