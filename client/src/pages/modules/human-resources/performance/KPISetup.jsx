/**
 * @fileoverview KPISetup component.
 * Provides functionality for KPISetup.
 */

import React from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import {
  BarChart3,
  Target,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Copy,
  X,
  Check,
  Download,
  FileText,
  Clock,
  Users,
  Award,
  TrendingUp,
  BookOpen,
  Calendar,
  Activity,
  ChevronDown,
  MoreVertical,
  Layers,
  Settings,
  RefreshCw,
  Save,
  AlertCircle,
} from "lucide-react";

const KPI_TYPES = [
  "QUANTITATIVE",
  "QUALITATIVE",
  "BEHAVIORAL",
  "ATTENDANCE",
  "PRODUCTIVITY",
];

const SCORING_METHODS = ["MANUAL", "AUTO", "WEIGHTED"];

const ASSIGNMENT_TYPES = ["EMPLOYEE", "DEPARTMENT", "POSITION"];

function Modal({ open, onClose, title, children, size }) {
  if (!open) return null;
  const width =
    size === "lg" ? "max-w-4xl" : size === "sm" ? "max-w-md" : "max-w-2xl";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className={`bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full ${width} max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-500 text-blue-600 dark:text-blue-400"
          : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, from, to }) {
  return (
    <div
      className={`bg-gradient-to-br ${from} ${to} rounded-lg p-5 text-white shadow-sm`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-90">{label}</span>
        <Icon size={22} className="opacity-80" />
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}

function EmptyState({ onNew }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
        <Target size={32} className="text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">
        No KPIs Defined
      </h3>
      <p className="text-sm text-slate-500 mb-6 max-w-md">
        Key Performance Indicators help track and measure employee performance.
        Create your first KPI to get started.
      </p>
      <button onClick={onNew} className="btn-primary flex items-center gap-2">
        <Plus size={16} />
        Create KPI
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 bg-slate-200 dark:bg-slate-700 rounded-lg"
          />
        ))}
      </div>
      <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg" />
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function KPISetup() {
  const [kpis, setKpis] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [employees, setEmployees] = React.useState([]);
  const [departments, setDepartments] = React.useState([]);
  const [assignments, setAssignments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  const [sortField, setSortField] = React.useState("code");
  const [sortDir, setSortDir] = React.useState("asc");
  const [page, setPage] = React.useState(1);
  const perPage = 10;

  const [modalType, setModalType] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState("general");
  const [editItem, setEditItem] = React.useState(null);
  const [form, setForm] = React.useState({});
  const [catForm, setCatForm] = React.useState({});
  const [assignForm, setAssignForm] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const [kRes, cRes, aRes, eRes, dRes] = await Promise.all([
        api.get("/hr/performance/kpis").catch(() => ({ data: { items: [] } })),
        api.get("/hr/performance/kpi-categories").catch(() => ({ data: { items: [] } })),
        api.get("/hr/performance/kpi-assignments").catch(() => ({ data: { items: [] } })),
        api.get("/hr/employees?status=ACTIVE").catch(() => ({ data: { items: [] } })),
        api.get("/admin/departments").catch(() => ({ data: { items: [] } })),
      ]);
      setKpis(kRes?.data?.items || []);
      setCategories(cRes?.data?.items || []);
      setAssignments(aRes?.data?.items || []);
      setEmployees(eRes?.data?.items || []);
      setDepartments(dRes?.data?.items || []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const activeKpis = kpis.filter((k) => k.is_active !== false);
  const assignedCount = assignments.length;

  const filtered = React.useMemo(() => {
    let data = [...kpis];
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (k) =>
          (k.code || "").toLowerCase().includes(q) ||
          (k.name || "").toLowerCase().includes(q) ||
          (k.description || "").toLowerCase().includes(q),
      );
    }
    if (categoryFilter) {
      data = data.filter((k) => String(k.category_id) === categoryFilter);
    }
    if (statusFilter !== "ALL") {
      const active = statusFilter === "ACTIVE";
      data = data.filter((k) => (k.is_active !== false) === active);
    }
    return data;
  }, [kpis, search, categoryFilter, statusFilter]);

  const sorted = React.useMemo(() => {
    const data = [...filtered];
    data.sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp =
        typeof aVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const paged = sorted.slice((page - 1) * perPage, page * perPage);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  const openNewKpi = () => {
    setEditItem(null);
    setForm({
      code: "",
      name: "",
      category_id: "",
      type: "",
      department: "",
      job_role: "",
      evaluation_period: "",
      description: "",
      weight: "",
      target_value: "",
      measurement_unit: "",
      min_score: "",
      max_score: "",
      scoring_method: "MANUAL",
      calculation_formula: "",
      effective_date: "",
      expiry_date: "",
      assignment_type: "EMPLOYEE",
      assignment_employee_id: "",
      assignment_department_id: "",
      assignment_position: "",
      is_active: true,
    });
    setActiveTab("general");
    setModalType("kpi");
  };

  const openEditKpi = (item) => {
    setEditItem(item);
    setForm({
      id: item.id,
      code: item.code || "",
      name: item.name || "",
      category_id: item.category_id || "",
      type: item.type || "",
      department: item.department || "",
      job_role: item.job_role || "",
      evaluation_period: item.evaluation_period || "",
      description: item.description || "",
      weight: item.weight ?? "",
      target_value: item.target_value ?? "",
      measurement_unit: item.measurement_unit || "",
      min_score: item.min_score ?? "",
      max_score: item.max_score ?? "",
      scoring_method: item.scoring_method || "MANUAL",
      calculation_formula: item.calculation_formula || "",
      effective_date: item.effective_date || "",
      expiry_date: item.expiry_date || "",
      assignment_type: item.assignment_type || "EMPLOYEE",
      assignment_employee_id: item.assignment_employee_id || "",
      assignment_department_id: item.assignment_department_id || "",
      assignment_position: item.assignment_position || "",
      is_active: item.is_active !== false,
    });
    setActiveTab("general");
    setModalType("kpi");
  };

  const openCloneKpi = (item) => {
    setEditItem(null);
    setForm({
      code: item.code ? `${item.code}-COPY` : "",
      name: item.name ? `${item.name} (Copy)` : "",
      category_id: item.category_id || "",
      type: item.type || "",
      department: item.department || "",
      job_role: item.job_role || "",
      evaluation_period: item.evaluation_period || "",
      description: item.description || "",
      weight: item.weight ?? "",
      target_value: item.target_value ?? "",
      measurement_unit: item.measurement_unit || "",
      min_score: item.min_score ?? "",
      max_score: item.max_score ?? "",
      scoring_method: item.scoring_method || "MANUAL",
      calculation_formula: item.calculation_formula || "",
      effective_date: item.effective_date || "",
      expiry_date: item.expiry_date || "",
      assignment_type: item.assignment_type || "EMPLOYEE",
      assignment_employee_id: "",
      assignment_department_id: "",
      assignment_position: "",
      is_active: true,
    });
    setActiveTab("general");
    setModalType("kpi");
  };

  const openNewCategory = () => {
    setCatForm({ name: "", description: "" });
    setModalType("category");
  };

  const saveKpi = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name) {
      toast.error("Code and Name are required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/hr/performance/kpis", form);
      toast.success(editItem ? "KPI updated" : "KPI created");
      setModalType(null);
      loadAll();
    } catch {
      toast.error("Failed to save KPI");
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name) {
      toast.error("Category name is required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/hr/performance/kpi-categories", catForm);
      toast.success("Category created");
      setModalType(null);
      loadAll();
    } catch {
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const deleteKpi = async (id) => {
    if (!window.confirm("Are you sure you want to delete this KPI?")) return;
    try {
      await api.delete(`/hr/performance/kpis/${id}`);
      toast.success("KPI deleted");
      loadAll();
    } catch {
      toast.error("Failed to delete KPI");
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?"))
      return;
    try {
      await api.delete(`/hr/performance/kpi-categories/${id}`);
      toast.success("Category deleted");
      setModalType(null);
      loadAll();
    } catch {
      toast.error("Failed to delete category");
    }
  };

  const openAssign = () => {
    setAssignForm({
      kpi_id: "",
      assignment_type: "EMPLOYEE",
      employee_id: "",
      department_id: "",
      position: "",
      weight: "",
      target_value: "",
      effective_date: "",
      expiry_date: "",
    });
    setModalType("assignment");
  };

  const saveAssignment = async (e) => {
    e.preventDefault();
    if (!assignForm.kpi_id) {
      toast.error("Please select a KPI");
      return;
    }
    setSaving(true);
    try {
      await api.post("/hr/performance/kpi-assignments", assignForm);
      toast.success("Assignment created");
      setModalType(null);
      loadAll();
    } catch {
      toast.error("Failed to create assignment");
    } finally {
      setSaving(false);
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={14} className="opacity-30" />;
    return (
      <ChevronDown
        size={14}
        className={`transition-transform ${sortDir === "desc" ? "rotate-180" : ""}`}
      />
    );
  };

  const renderFormField = (label, field, type, opts) => {
    const val = form[field] ?? "";
    if (type === "select") {
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {label}
          </label>
          <select
            className="input w-full"
            value={val}
            onChange={(e) => setForm((s) => ({ ...s, [field]: e.target.value }))}
          >
            <option value="">Select {label}</option>
            {(opts || []).map((o) => {
              const v = typeof o === "object" ? o.value : o;
              const l = typeof o === "object" ? o.label : o;
              return (
                <option key={v} value={v}>
                  {l}
                </option>
              );
            })}
          </select>
        </div>
      );
    }
    if (type === "textarea") {
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {label}
          </label>
          <textarea
            className="input w-full"
            rows={3}
            value={val}
            onChange={(e) => setForm((s) => ({ ...s, [field]: e.target.value }))}
          />
        </div>
      );
    }
    if (type === "number") {
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {label}
          </label>
          <input
            className="input w-full"
            type="number"
            step="any"
            value={val}
            onChange={(e) => setForm((s) => ({ ...s, [field]: e.target.value }))}
          />
        </div>
      );
    }
    if (type === "date") {
      return (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {label}
          </label>
          <input
            className="input w-full"
            type="date"
            value={val}
            onChange={(e) => setForm((s) => ({ ...s, [field]: e.target.value }))}
          />
        </div>
      );
    }
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {label}
        </label>
        <input
          className="input w-full"
          value={val}
          onChange={(e) => setForm((s) => ({ ...s, [field]: e.target.value }))}
        />
      </div>
    );
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/human-resources/performance"
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Performance
          </Link>
          <ChevronDown size={14} className="-rotate-90 text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 size={26} className="text-blue-500" />
            KPI Setup
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={openNewKpi} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} />
            New KPI
          </button>
          <button onClick={openNewCategory} className="btn-secondary flex items-center gap-2 text-sm">
            <Layers size={16} />
            New Category
          </button>
          <button onClick={loadAll} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Target}
          label="Total KPIs"
          value={kpis.length}
          from="from-blue-500"
          to="to-blue-600"
        />
        <StatCard
          icon={Activity}
          label="Active KPIs"
          value={activeKpis.length}
          from="from-purple-500"
          to="to-purple-600"
        />
        <StatCard
          icon={Layers}
          label="Categories"
          value={categories.length}
          from="from-green-500"
          to="to-green-600"
        />
        <StatCard
          icon={Users}
          label="Assigned KPIs"
          value={assignedCount}
          from="from-orange-500"
          to="to-orange-600"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="input pl-9 w-full"
                  placeholder="Search KPIs..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <select
                className="input w-full sm:w-auto"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="input w-full sm:w-auto"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <button
              onClick={openAssign}
              className="btn-secondary flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <Users size={16} />
              Assign KPI
            </button>
          </div>
        </div>

        {paged.length === 0 ? (
          <EmptyState onNew={openNewKpi} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left">
                    {[
                      { key: "code", label: "KPI Code" },
                      { key: "name", label: "Name" },
                      { key: "category_id", label: "Category" },
                      { key: "type", label: "Type" },
                      { key: "weight", label: "Weight" },
                      { key: "target_value", label: "Target" },
                      { key: "scoring_method", label: "Scoring Method" },
                      { key: "id", label: "Assignments" },
                      { key: "is_active", label: "Status" },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-300"
                        onClick={() => handleSort(col.key)}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          <SortIcon field={col.key} />
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {paged.map((kpi) => {
                    const cat = categories.find(
                      (c) => String(c.id) === String(kpi.category_id),
                    );
                    const assignmentCount = assignments.filter(
                      (a) => String(a.kpi_id) === String(kpi.id),
                    ).length;
                    return (
                      <tr
                        key={kpi.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                          {kpi.code || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {kpi.name || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {cat?.name || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">
                            {kpi.type || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {kpi.weight != null ? `${kpi.weight}%` : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {kpi.target_value ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {kpi.scoring_method || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                          {assignmentCount}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              kpi.is_active !== false
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                kpi.is_active !== false
                                  ? "bg-green-500"
                                  : "bg-slate-400"
                              }`}
                            />
                            {kpi.is_active !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditKpi(kpi)}
                              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-blue-600"
                              title="Edit"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => openCloneKpi(kpi)}
                              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-green-600"
                              title="Clone"
                            >
                              <Copy size={15} />
                            </button>
                            <button
                              onClick={() => deleteKpi(kpi.id)}
                              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
              <span className="text-sm text-slate-500">
                Showing {(page - 1) * perPage + 1}-
                {Math.min(page * perPage, sorted.length)} of {sorted.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm rounded border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let p;
                  if (totalPages <= 5) {
                    p = i + 1;
                  } else if (page <= 3) {
                    p = i + 1;
                  } else if (page >= totalPages - 2) {
                    p = totalPages - 4 + i;
                  } else {
                    p = page - 2 + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1 text-sm rounded border ${
                        page === p
                          ? "bg-blue-500 text-white border-blue-500"
                          : "border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm rounded border border-slate-200 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* KPI Form Modal */}
      <Modal
        open={modalType === "kpi"}
        onClose={() => setModalType(null)}
        title={editItem ? "Edit KPI" : "New KPI"}
        size="lg"
      >
        <form onSubmit={saveKpi}>
          <div className="border-b border-slate-200 dark:border-slate-700 -mx-6 px-6 mb-6">
            <div className="flex gap-6">
              <TabButton
                active={activeTab === "general"}
                onClick={() => setActiveTab("general")}
              >
                General
              </TabButton>
              <TabButton
                active={activeTab === "scoring"}
                onClick={() => setActiveTab("scoring")}
              >
                Scoring
              </TabButton>
              <TabButton
                active={activeTab === "assignment"}
                onClick={() => setActiveTab("assignment")}
              >
                Assignment
              </TabButton>
            </div>
          </div>

          {activeTab === "general" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderFormField("Code *", "code")}
                {renderFormField("Name *", "name")}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderFormField("Category", "category_id", "select", [
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ])}
                {renderFormField("Type", "type", "select", KPI_TYPES)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderFormField("Department", "department")}
                {renderFormField("Job Role", "job_role")}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderFormField("Evaluation Period", "evaluation_period", "select", [
                  "MONTHLY",
                  "QUARTERLY",
                  "SEMI_ANNUAL",
                  "ANNUAL",
                ])}
              </div>
              {renderFormField("Description", "description", "textarea")}
            </div>
          )}

          {activeTab === "scoring" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderFormField("Weight (%)", "weight", "number")}
                {renderFormField("Target Value", "target_value", "number")}
                {renderFormField("Measurement Unit", "measurement_unit")}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderFormField("Min Score", "min_score", "number")}
                {renderFormField("Max Score", "max_score", "number")}
                {renderFormField(
                  "Scoring Method",
                  "scoring_method",
                  "select",
                  SCORING_METHODS,
                )}
              </div>
              {renderFormField("Calculation Formula", "calculation_formula", "textarea")}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderFormField("Effective Date", "effective_date", "date")}
                {renderFormField("Expiry Date", "expiry_date", "date")}
              </div>
            </div>
          )}

          {activeTab === "assignment" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderFormField(
                  "Assignment Type",
                  "assignment_type",
                  "select",
                  ASSIGNMENT_TYPES,
                )}
              </div>
              {form.assignment_type === "EMPLOYEE" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderFormField("Employee", "assignment_employee_id", "select", [
                    ...employees.map((e) => ({
                      value: e.id,
                      label: e.full_name || `${e.first_name || ""} ${e.last_name || ""}`,
                    })),
                  ])}
                </div>
              )}
              {form.assignment_type === "DEPARTMENT" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderFormField("Department", "assignment_department_id", "select", [
                    ...departments.map((d) => ({
                      value: d.id,
                      label: d.name,
                    })),
                  ])}
                </div>
              )}
              {form.assignment_type === "POSITION" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderFormField("Position", "assignment_position")}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-700 mt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((s) => ({ ...s, is_active: e.target.checked }))
                }
                className="rounded border-slate-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Active
              </span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save KPI"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal
        open={modalType === "category"}
        onClose={() => setModalType(null)}
        title="New KPI Category"
        size="sm"
      >
        <form onSubmit={saveCategory} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Name *
            </label>
            <input
              className="input w-full"
              value={catForm.name || ""}
              onChange={(e) =>
                setCatForm((s) => ({ ...s, name: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              className="input w-full"
              rows={3}
              value={catForm.description || ""}
              onChange={(e) =>
                setCatForm((s) => ({ ...s, description: e.target.value }))
              }
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            {categories.length > 0 && (
              <div className="text-xs text-slate-400">
                {categories.length} existing categories
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Assignment Modal */}
      <Modal
        open={modalType === "assignment"}
        onClose={() => setModalType(null)}
        title="KPI Assignment"
        size="lg"
      >
        <form onSubmit={saveAssignment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Select KPI *
              </label>
              <select
                className="input w-full"
                value={assignForm.kpi_id}
                onChange={(e) =>
                  setAssignForm((s) => ({ ...s, kpi_id: e.target.value }))
                }
                required
              >
                <option value="">Select KPI</option>
                {kpis
                  .filter((k) => k.is_active !== false)
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.code} - {k.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Assignment Type
              </label>
              <select
                className="input w-full"
                value={assignForm.assignment_type}
                onChange={(e) =>
                  setAssignForm((s) => ({
                    ...s,
                    assignment_type: e.target.value,
                  }))
                }
              >
                {ASSIGNMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {assignForm.assignment_type === "EMPLOYEE" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Employee
              </label>
              <select
                className="input w-full"
                value={assignForm.employee_id}
                onChange={(e) =>
                  setAssignForm((s) => ({
                    ...s,
                    employee_id: e.target.value,
                  }))
                }
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name || `${e.first_name || ""} ${e.last_name || ""}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {assignForm.assignment_type === "DEPARTMENT" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <select
                className="input w-full"
                value={assignForm.department_id}
                onChange={(e) =>
                  setAssignForm((s) => ({
                    ...s,
                    department_id: e.target.value,
                  }))
                }
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {assignForm.assignment_type === "POSITION" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Position Title
              </label>
              <input
                className="input w-full"
                value={assignForm.position || ""}
                onChange={(e) =>
                  setAssignForm((s) => ({
                    ...s,
                    position: e.target.value,
                  }))
                }
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Weight
              </label>
              <input
                className="input w-full"
                type="number"
                step="any"
                value={assignForm.weight ?? ""}
                onChange={(e) =>
                  setAssignForm((s) => ({ ...s, weight: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Value
              </label>
              <input
                className="input w-full"
                type="number"
                step="any"
                value={assignForm.target_value ?? ""}
                onChange={(e) =>
                  setAssignForm((s) => ({
                    ...s,
                    target_value: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Effective Date
              </label>
              <input
                className="input w-full"
                type="date"
                value={assignForm.effective_date || ""}
                onChange={(e) =>
                  setAssignForm((s) => ({
                    ...s,
                    effective_date: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Expiry Date
              </label>
              <input
                className="input w-full"
                type="date"
                value={assignForm.expiry_date || ""}
                onChange={(e) =>
                  setAssignForm((s) => ({
                    ...s,
                    expiry_date: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setModalType(null)}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Assign KPI"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
