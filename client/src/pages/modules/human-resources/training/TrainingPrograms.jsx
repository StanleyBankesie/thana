/**
 * @fileoverview TrainingPrograms component.
 * Provides functionality for TrainingPrograms.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import {
  BookOpen, Plus, Search, Filter, Edit3, Trash2, Calendar, Clock,
  Users, Award, MapPin, DollarSign, Download, RefreshCw, Check, X,
  ChevronDown, MoreVertical, BarChart3, Target, GraduationCap,
  Video, Monitor, Building2, UserCheck, FileText, AlertCircle, Save
} from "lucide-react";

const TRAINING_TYPES = ["INTERNAL", "EXTERNAL", "ONLINE", "CERTIFICATION", "WORKSHOP", "SEMINAR"];

const defaultForm = {
  code: "",
  name: "",
  category: "",
  description: "",
  training_type: "INTERNAL",
  trainer: "",
  vendor: "",
  venue: "",
  training_mode: "",
  start_date: "",
  end_date: "",
  cost: "",
  capacity: "",
  department: "",
  required_skills: "",
  attachment_url: "",
  is_active: true,
};

const TABS = ["General", "Logistics", "Details"];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function TrainingPrograms() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showFormModal, setShowFormModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [formTab, setFormTab] = useState(0);
  const [editingProgram, setEditingProgram] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [assignDepartment, setAssignDepartment] = useState("");
  const [assigningProgram, setAssigningProgram] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/training/programs");
      setPrograms(res?.data?.items || []);
    } catch {
      toast.error("Failed to load training programs");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await api.get("/hr/training/dashboard");
      setDashboard(res?.data || null);
    } catch {
      // silent
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await api.get("/hr/employees");
      const items = res?.data?.items || [];
      setEmployees(items);
      const depts = [...new Set(items.map(e => e.dept_name).filter(Boolean))];
      setDepartments(depts);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadPrograms();
    loadDashboard();
    loadEmployees();
  }, [loadPrograms, loadDashboard, loadEmployees]);

  const handleRefresh = () => {
    loadPrograms();
    loadDashboard();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this training program?")) return;
    try {
      await api.delete(`/hr/training/programs/${id}`);
      toast.success("Program deleted");
      loadPrograms();
      loadDashboard();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete");
    }
  };

  const openNewForm = () => {
    setEditingProgram(null);
    setFormData({ ...defaultForm });
    setFormTab(0);
    setShowFormModal(true);
  };

  const openEditForm = (program) => {
    setEditingProgram(program);
    setFormData({
      code: program.code || "",
      name: program.name || program.title || "",
      category: program.category || "",
      description: program.description || "",
      training_type: program.training_type || "INTERNAL",
      trainer: program.trainer || "",
      vendor: program.vendor || "",
      venue: program.venue || "",
      training_mode: program.training_mode || "",
      start_date: program.start_date ? program.start_date.split("T")[0] : "",
      end_date: program.end_date ? program.end_date.split("T")[0] : "",
      cost: program.cost ?? "",
      capacity: program.capacity ?? "",
      department: program.department || "",
      required_skills: program.required_skills || "",
      attachment_url: program.attachment_url || "",
      is_active: program.is_active !== false,
    });
    setFormTab(0);
    setShowFormModal(true);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Code and Name are required");
      return;
    }
    setSaving(true);
    try {
      if (editingProgram) {
        await api.put(`/hr/training/programs/${editingProgram.id}`, formData);
        toast.success("Program updated");
      } else {
        await api.post("/hr/training/programs", formData);
        toast.success("Program created");
      }
      setShowFormModal(false);
      loadPrograms();
      loadDashboard();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save program");
    } finally {
      setSaving(false);
    }
  };

  const openAssignModal = (program) => {
    setAssigningProgram(program);
    setSelectedEmployeeIds([]);
    setAssignDepartment("");
    setShowAssignModal(true);
  };

  const handleAssign = async () => {
    if (!selectedEmployeeIds.length && !assignDepartment) {
      toast.error("Select employees or a department");
      return;
    }
    setSaving(true);
    try {
      const payload = { program_id: assigningProgram.id };
      if (selectedEmployeeIds.length) payload.employee_ids = selectedEmployeeIds;
      if (assignDepartment) payload.department = assignDepartment;
      await api.post("/hr/training/assignments", payload);
      toast.success("Employees assigned to program");
      setShowAssignModal(false);
      loadPrograms();
      loadDashboard();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to assign");
    } finally {
      setSaving(false);
    }
  };

  const toggleEmployeeSelection = (id) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const filteredByDept = assignDepartment
    ? employees.filter(e => e.dept_name === assignDepartment)
    : employees;

  const categories = [...new Set(programs.map(p => p.category).filter(Boolean))];

  const filteredPrograms = programs.filter(p => {
    const term = searchTerm.toLowerCase();
    if (term) {
      const matchFields = [p.code, p.name, p.category, p.trainer].filter(Boolean);
      if (!matchFields.some(f => String(f).toLowerCase().includes(term))) return false;
    }
    if (categoryFilter !== "ALL" && p.category !== categoryFilter) return false;
    if (typeFilter !== "ALL" && p.training_type !== typeFilter) return false;
    if (statusFilter === "ACTIVE" && p.is_active === false) return false;
    if (statusFilter === "INACTIVE" && p.is_active !== false) return false;
    return true;
  });

  const upcomingPrograms = programs.filter(p => {
    if (!p.start_date) return false;
    return new Date(p.start_date) >= new Date(new Date().toDateString());
  }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const getStatusBadge = (isActive) => {
    return isActive !== false ? (
      <span className="badge badge-success">ACTIVE</span>
    ) : (
      <span className="badge badge-error">INACTIVE</span>
    );
  };

  const getTypeBadge = (type) => {
    const colors = {
      INTERNAL: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      EXTERNAL: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
      ONLINE: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
      CERTIFICATION: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      WORKSHOP: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      SEMINAR: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[type] || "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}`}>
        {type}
      </span>
    );
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : "-";
  const formatCurrency = (v) => (v !== null && v !== undefined && v !== "") ? Number(v).toLocaleString() : "-";

  const handleExportCSV = () => {
    try {
      const headers = ["Code", "Name", "Category", "Type", "Trainer", "Start Date", "End Date", "Cost", "Capacity", "Enrolled", "Status"];
      const rows = filteredPrograms.map(p => [
        p.code,
        p.name || p.title,
        p.category || "",
        p.training_type || "",
        p.trainer || "",
        p.start_date ? new Date(p.start_date).toLocaleDateString() : "",
        p.end_date ? new Date(p.end_date).toLocaleDateString() : "",
        p.cost ?? "",
        p.capacity ?? "",
        p.enrolled_count ?? "",
        p.is_active !== false ? "Active" : "Inactive",
      ]);
      const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "training_programs.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  const DashboardCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value ?? "-"}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Breadcrumb */}
      <div className="text-sm breadcrumbs text-slate-500 dark:text-slate-400 mb-2">
        <Link to="/human-resources?section=Training%20%26%20Development" className="hover:text-brand">Human Resources</Link>
        <span className="mx-2">/</span>
        <Link to="/human-resources/training" className="hover:text-brand">Training</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-800 dark:text-slate-200 font-medium">Training Programs</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Training Programs</h1>
            <p className="text-sm text-slate-500">Manage training programs and assignments</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} className="btn-secondary text-sm flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={openNewForm} className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" /> New Program
          </button>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard icon={BookOpen} label="Total Programs" value={dashboard.total_programs} color="bg-blue-500" />
          <DashboardCard icon={Target} label="Active Programs" value={dashboard.active_programs} color="bg-emerald-500" />
          <DashboardCard icon={Users} label="Total Enrolled" value={dashboard.total_enrolled} color="bg-purple-500" />
          <DashboardCard icon={Award} label="Completion Rate" value={dashboard.completion_rate != null ? `${dashboard.completion_rate}%` : "-"} color="bg-amber-500" />
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by code, name, category, trainer..."
              className="input pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select className="input md:w-44" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input md:w-44" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="ALL">All Types</option>
            {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input md:w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button onClick={handleExportCSV} className="btn-secondary text-sm flex items-center gap-1 whitespace-nowrap">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Upcoming Training - Calendar View */}
      {upcomingPrograms.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-brand" />
            <h3 className="font-semibold">Upcoming Training Sessions</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {upcomingPrograms.slice(0, 8).map(p => (
              <div key={p.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 hover:shadow-md transition-shadow">
                <p className="font-medium text-sm truncate">{p.name || p.title}</p>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(p.start_date)} - {formatDate(p.end_date)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                  <Users className="w-3 h-3" />
                  <span>{p.enrolled_count ?? 0}/{p.capacity ?? "-"} enrolled</span>
                </div>
                {p.trainer && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                    <UserCheck className="w-3 h-3" />
                    <span>{p.trainer}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Training Programs Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
              <tr className="text-left">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Code</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Category</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Trainer</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Start Date</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">End Date</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Cost</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Capacity</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Enrolled</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand mb-2"></div>
                    <p>Loading programs...</p>
                  </td>
                </tr>
              ) : filteredPrograms.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-medium">No training programs found</p>
                    <p className="text-sm mt-1">Click "New Program" to create one.</p>
                  </td>
                </tr>
              ) : (
                filteredPrograms.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium">{p.code}</td>
                    <td className="px-4 py-3 text-sm font-medium">{p.name || p.title}</td>
                    <td className="px-4 py-3 text-sm">{p.category || "-"}</td>
                    <td className="px-4 py-3 text-sm">{getTypeBadge(p.training_type)}</td>
                    <td className="px-4 py-3 text-sm">{p.trainer || "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatDate(p.start_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatDate(p.end_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="w-3 h-3 text-slate-400" />
                        {formatCurrency(p.cost)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{p.capacity ?? "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{p.enrolled_count ?? 0}/{p.capacity ?? "?"}</span>
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand rounded-full transition-all"
                            style={{ width: p.capacity ? `${Math.min((p.enrolled_count ?? 0) / p.capacity * 100, 100)}%` : "0%" }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{getStatusBadge(p.is_active)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditForm(p)}
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-brand transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openAssignModal(p)}
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-blue-600 transition-colors"
                          title="Assign Employees"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Training Program Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                {editingProgram ? <Edit3 className="w-5 h-5 text-brand" /> : <Plus className="w-5 h-5 text-brand" />}
                <h3 className="font-bold text-lg">{editingProgram ? "Edit Program" : "New Program"}</h3>
              </div>
              <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 shrink-0">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setFormTab(i)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    formTab === i
                      ? "border-brand text-brand"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Tab 1: General */}
                {formTab === 0 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Code <span className="text-red-500">*</span></label>
                        <input
                          className="input"
                          value={formData.code}
                          onChange={(e) => handleFormChange("code", e.target.value)}
                          required
                          placeholder="e.g. TRN-001"
                        />
                      </div>
                      <div>
                        <label className="label">Name <span className="text-red-500">*</span></label>
                        <input
                          className="input"
                          value={formData.name}
                          onChange={(e) => handleFormChange("name", e.target.value)}
                          required
                          placeholder="Program name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Category</label>
                      <input
                        className="input"
                        value={formData.category}
                        onChange={(e) => handleFormChange("category", e.target.value)}
                        placeholder="e.g. Leadership, Technical, Compliance"
                        list="category-suggestions"
                      />
                      <datalist id="category-suggestions">
                        {categories.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="label">Description</label>
                      <textarea
                        className="input min-h-[80px]"
                        value={formData.description}
                        onChange={(e) => handleFormChange("description", e.target.value)}
                        placeholder="Program description"
                      />
                    </div>
                    <div>
                      <label className="label">Training Type <span className="text-red-500">*</span></label>
                      <select
                        className="input"
                        value={formData.training_type}
                        onChange={(e) => handleFormChange("training_type", e.target.value)}
                        required
                      >
                        {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {/* Tab 2: Logistics */}
                {formTab === 1 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Trainer</label>
                        <input
                          className="input"
                          value={formData.trainer}
                          onChange={(e) => handleFormChange("trainer", e.target.value)}
                          placeholder="Trainer name"
                        />
                      </div>
                      <div>
                        <label className="label">Vendor</label>
                        <input
                          className="input"
                          value={formData.vendor}
                          onChange={(e) => handleFormChange("vendor", e.target.value)}
                          placeholder="Training vendor"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Venue</label>
                        <input
                          className="input"
                          value={formData.venue}
                          onChange={(e) => handleFormChange("venue", e.target.value)}
                          placeholder="Venue location"
                        />
                      </div>
                      <div>
                        <label className="label">Training Mode</label>
                        <input
                          className="input"
                          value={formData.training_mode}
                          onChange={(e) => handleFormChange("training_mode", e.target.value)}
                          placeholder="e.g. Virtual, In-Person, Hybrid"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Start Date</label>
                        <input
                          type="date"
                          className="input"
                          value={formData.start_date}
                          onChange={(e) => handleFormChange("start_date", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">End Date</label>
                        <input
                          type="date"
                          className="input"
                          value={formData.end_date}
                          onChange={(e) => handleFormChange("end_date", e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Tab 3: Details */}
                {formTab === 2 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Cost</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input"
                          value={formData.cost}
                          onChange={(e) => handleFormChange("cost", e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="label">Capacity</label>
                        <input
                          type="number"
                          min="1"
                          className="input"
                          value={formData.capacity}
                          onChange={(e) => handleFormChange("capacity", e.target.value)}
                          placeholder="Max participants"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Department</label>
                      <select
                        className="input"
                        value={formData.department}
                        onChange={(e) => handleFormChange("department", e.target.value)}
                      >
                        <option value="">-- Select Department --</option>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Required Skills</label>
                      <textarea
                        className="input min-h-[80px]"
                        value={formData.required_skills}
                        onChange={(e) => handleFormChange("required_skills", e.target.value)}
                        placeholder="Skills required for this training (one per line)"
                      />
                    </div>
                    <div>
                      <label className="label">Attachment URL</label>
                      <input
                        className="input"
                        value={formData.attachment_url}
                        onChange={(e) => handleFormChange("attachment_url", e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand focus:ring-brand"
                    checked={formData.is_active}
                    onChange={(e) => handleFormChange("is_active", e.target.checked)}
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowFormModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary flex items-center gap-1" disabled={saving}>
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : editingProgram ? "Update" : "Save"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && assigningProgram && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-brand" />
                <h3 className="font-bold text-lg">Assign Employees</h3>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Program Info */}
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <p className="text-sm">
                <span className="font-medium">{assigningProgram.code}</span> - {assigningProgram.name || assigningProgram.title}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {getTypeBadge(assigningProgram.training_type)}
                <span className="ml-2">{assigningProgram.capacity ? `Capacity: ${assigningProgram.enrolled_count ?? 0}/${assigningProgram.capacity}` : ""}</span>
              </p>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {/* Department Filter */}
              <div>
                <label className="label">Filter by Department (or assign all)</label>
                <select
                  className="input"
                  value={assignDepartment}
                  onChange={(e) => {
                    setAssignDepartment(e.target.value);
                    if (e.target.value) {
                      const deptEmployees = employees.filter(emp => emp.dept_name === e.target.value);
                      setSelectedEmployeeIds(deptEmployees.map(emp => emp.id));
                    } else {
                      setSelectedEmployeeIds([]);
                    }
                  }}
                >
                  <option value="">-- Select Department --</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Employee List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Select Employees</label>
                  <span className="text-xs text-slate-500">{selectedEmployeeIds.length} selected</span>
                </div>
                <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredByDept.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      <Users className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                      <p>No employees found</p>
                    </div>
                  ) : (
                    filteredByDept.map(emp => (
                      <label
                        key={emp.id}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                          selectedEmployeeIds.includes(emp.id) ? "bg-brand/5" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-brand focus:ring-brand"
                          checked={selectedEmployeeIds.includes(emp.id)}
                          onChange={() => toggleEmployeeSelection(emp.id)}
                        />
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300 shrink-0">
                          {(emp.first_name?.[0] || "?")}{(emp.last_name?.[0] || "")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-slate-500 truncate">{emp.emp_code} {emp.dept_name ? `• ${emp.dept_name}` : ""}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
              <button onClick={() => setShowAssignModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleAssign}
                className="btn-primary flex items-center gap-1"
                disabled={saving || (!selectedEmployeeIds.length && !assignDepartment)}
              >
                <Check className="w-4 h-4" />
                {saving ? "Assigning..." : "Confirm Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
