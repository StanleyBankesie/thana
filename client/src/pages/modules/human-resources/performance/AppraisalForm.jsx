/**
 * @fileoverview AppraisalForm component.
 * Provides functionality for AppraisalForm.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Target,
  Star,
  TrendingUp,
  FileText,
  Download,
  Clock,
  Users,
  Award,
  BookOpen,
  BarChart3,
  Activity,
  Plus,
  Trash2,
  Edit3,
  Eye,
  MessageSquare,
} from "lucide-react";
import { usePermission } from "@/auth/PermissionContext.jsx";

const STEPS_DATA = [
  { label: "Employee Info", icon: User, key: "employee" },
  { label: "KPI Evaluation", icon: Target, key: "kpi" },
  { label: "Competency", icon: Award, key: "competency" },
  { label: "Goals", icon: TrendingUp, key: "goals" },
  { label: "Self Assessment", icon: MessageSquare, key: "self" },
  { label: "Review & Submit", icon: FileText, key: "review" },
];

const COMPETENCY_NAMES = [
  "Communication",
  "Leadership",
  "Teamwork",
  "Discipline",
  "Problem Solving",
  "Innovation",
  "Time Management",
];

const INITIAL_GOAL = { goal_name: "", completion_pct: 0, remarks: "" };

function calcKpiScore(row) {
  const target = parseFloat(row.target) || 0;
  const actual = parseFloat(row.actual) || 0;
  const rating = parseFloat(row.rating) || 0;
  const weight = parseFloat(row.weight) || 0;
  if (!target || !rating || !weight) return { achievement_pct: 0, score: 0 };
  const achievement_pct = (actual / target) * 100;
  const score = (actual / target) * rating * (weight / 100);
  return { achievement_pct: Math.round(achievement_pct * 100) / 100, score: Math.round(score * 100) / 100 };
}

function StarRating({ value, onChange, size }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-0.5">
      {stars.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange?.(s)}
          className={`${size === "sm" ? "w-4 h-4" : "w-5 h-5"} transition-colors ${
            s <= value ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"
          } hover:text-yellow-300`}
        >
          <Star className={`w-full h-full ${s <= value ? "fill-current" : ""}`} />
        </button>
      ))}
    </div>
  );
}

function StepIndicator({ current }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between overflow-x-auto gap-0">
        {STEPS_DATA.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === current;
          const isDone = i < current;
          return (
            <div key={s.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isActive
                      ? "bg-primary text-white shadow-md"
                      : isDone
                        ? "bg-secondary text-white"
                        : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={`mt-1 text-[10px] font-medium whitespace-nowrap hidden sm:block ${
                    isActive
                      ? "text-primary dark:text-primary-light"
                      : isDone
                        ? "text-secondary dark:text-secondary-light"
                        : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS_DATA.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-1.25rem] ${
                    i < current ? "bg-secondary" : "bg-gray-200 dark:bg-slate-700"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Input({ label, type, value, onChange, placeholder, required, disabled, className, min, max, step }) {
  const id = label?.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        id={id}
        type={type || "text"}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors ${
          disabled
            ? "bg-gray-100 dark:bg-slate-700 text-gray-500 cursor-not-allowed"
            : "bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
        } border-gray-300 dark:border-slate-600 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none`}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, placeholder, required, disabled, className }) {
  const id = label?.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        id={id}
        value={value ?? ""}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors ${
          disabled
            ? "bg-gray-100 dark:bg-slate-700 text-gray-500 cursor-not-allowed"
            : "bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
        } border-gray-300 dark:border-slate-600 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none`}
      >
        <option value="">{placeholder || "Select..."}</option>
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, rows, className }) {
  const id = label?.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <textarea
        id={id}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows || 3}
        className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-slate-600 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none resize-vertical"
      />
    </div>
  );
}

function Card({ title, icon: Icon, children, className, titleRight }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 ${className || ""}`}>
      <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary" />}
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
        </div>
        {titleRight}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ScoreCard({ title, value, suffix, color, icon: Icon }) {
  const colorMap = {
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
    orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300",
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
    purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300",
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
    teal: "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300",
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`rounded-lg border p-4 ${c}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium opacity-75">{title}</p>
          <p className="text-2xl font-bold mt-1">
            {value ?? "-"}
            {suffix && <span className="text-sm font-normal ml-0.5">{suffix}</span>}
          </p>
        </div>
        {Icon && <Icon className="w-8 h-8 opacity-50" />}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && <Icon className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />}
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
      {message && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{message}</p>}
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function AppraisalForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [employees, setEmployees] = useState([]);
  const [kpiAssignments, setKpiAssignments] = useState([]);
  const [showKpiSelector, setShowKpiSelector] = useState(false);
  const [availableKpis, setAvailableKpis] = useState([]);

  const [form, setForm] = useState({
    employee_id: "",
    period_name: "",
    start_date: "",
    end_date: "",
    reviewer_user_id: "",
    department: "",
    position: "",
    kpi_details: [],
    competencies: COMPETENCY_NAMES.map((n) => ({ competency_name: n, rating: 0, remarks: "" })),
    goals: [{ ...INITIAL_GOAL }],
    self_assessment: {
      employee_comments: "",
      achievements: "",
      challenges: "",
      supporting_docs: "",
    },
    manager_assessment: {
      manager_remarks: "",
      recommend_promotion: false,
      recommend_increment: 0,
      recommend_training: "",
    },
    total_kpi_score: 0,
    total_competency_score: 0,
    overall_score: 0,
    status: "DRAFT",
  });

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const setSelfAssessment = (field, value) =>
    setForm((prev) => ({ ...prev, self_assessment: { ...prev.self_assessment, [field]: value } }));
  const setManagerAssessment = (field, value) =>
    setForm((prev) => ({ ...prev, manager_assessment: { ...prev.manager_assessment, [field]: value } }));

  const selectedEmployee = useMemo(
    () => employees.find((e) => String(e.id) === String(form.employee_id)) || null,
    [employees, form.employee_id],
  );

  const kpiComputed = useMemo(() => {
    let total = 0;
    const details = (form.kpi_details || []).map((row) => {
      const { achievement_pct, score } = calcKpiScore(row);
      total += score;
      return { ...row, achievement_pct, computed_score: score };
    });
    return { details, totalKpiScore: Math.round(total * 100) / 100 };
  }, [form.kpi_details]);

  const competencyAverage = useMemo(() => {
    const ratings = form.competencies.map((c) => parseFloat(c.rating) || 0).filter((r) => r > 0);
    if (!ratings.length) return 0;
    return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100;
  }, [form.competencies]);

  const goalAverage = useMemo(() => {
    const pcts = form.goals
      .map((g) => parseFloat(g.completion_pct) || 0)
      .filter((p) => p > 0);
    if (!pcts.length) return 0;
    return Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100) / 100;
  }, [form.goals]);

  const overallScore = useMemo(() => {
    const maxPossible = (form.kpi_details || []).reduce(
      (sum, r) => sum + (parseFloat(r.weight) || 0),
      0,
    );
    const kpiPct =
      maxPossible > 0
        ? Math.min((kpiComputed.totalKpiScore / (5 * maxPossible / 100)) * 100, 100)
        : 0;
    const compPct = Math.min((competencyAverage / 5) * 100, 100);
    return Math.round((kpiPct * 0.7 + compPct * 0.3) * 100) / 100;
  }, [kpiComputed, competencyAverage, form.kpi_details]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await api.get("/hr/employees");
        if (mounted) setEmployees(res?.data?.items || []);
      } catch {}
    }
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let mounted = true;
    async function loadAppraisal() {
      setLoading(true);
      setLoadError("");
      try {
        const res = await api.get(`/hr/performance/appraisals/${id}`);
        const data = res?.data?.item || res?.data;
        if (mounted && data) {
          const comps = COMPETENCY_NAMES.map((n) => {
            const existing = (data.competencies || []).find(
              (c) => c.competency_name === n,
            );
            return existing || { competency_name: n, rating: 0, remarks: "" };
          });
          setForm((prev) => ({
            ...prev,
            employee_id: data.employee_id || "",
            period_name: data.period_name || "",
            start_date: data.start_date || "",
            end_date: data.end_date || "",
            reviewer_user_id: data.reviewer_user_id || "",
            department: data.department || "",
            position: data.position || "",
            kpi_details: Array.isArray(data.kpi_details) ? data.kpi_details : [],
            competencies: comps,
            goals: Array.isArray(data.goals) && data.goals.length ? data.goals : [{ ...INITIAL_GOAL }],
            self_assessment: {
              employee_comments: data.self_assessment?.employee_comments || data.employee_comments || "",
              achievements: data.self_assessment?.achievements || "",
              challenges: data.self_assessment?.challenges || "",
              supporting_docs: data.self_assessment?.supporting_docs || "",
            },
            manager_assessment: {
              manager_remarks: data.manager_assessment?.manager_remarks || data.manager_remarks || "",
              recommend_promotion: data.manager_assessment?.recommend_promotion || data.recommend_promotion || false,
              recommend_increment: data.manager_assessment?.recommend_increment || data.recommend_increment || 0,
              recommend_training: data.manager_assessment?.recommend_training || data.recommend_training || "",
            },
            status: data.status || "DRAFT",
          }));
        }
      } catch (e) {
        if (mounted) setLoadError(e?.response?.data?.message || "Failed to load appraisal");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAppraisal();
  }, [id, isEdit]);

  useEffect(() => {
    if (!form.employee_id) {
      setKpiAssignments([]);
      return;
    }
    let mounted = true;
    async function loadKpis() {
      try {
        const res = await api.get("/hr/performance/kpi-assignments", {
          params: { employee_id: form.employee_id },
        });
        if (mounted) {
          const items = res?.data?.items || [];
          setKpiAssignments(items);
          if (!isEdit && items.length > 0 && form.kpi_details.length === 0) {
            const mapped = items.map((k) => ({
              kpi_assignment_id: k.id,
              kpi_name: k.kpi_name || k.name || "",
              target: k.target_value ?? "",
              actual: "",
              weight: k.weight ?? "",
              rating: "",
              score: 0,
              achievement_pct: 0,
              manager_remarks: "",
            }));
            setField("kpi_details", mapped);
          }
        }
      } catch {}
    }
    loadKpis();
    return () => { mounted = false; };
  }, [form.employee_id]);

  useEffect(() => {
    if (!selectedEmployee) return;
    setField("department", selectedEmployee.department || selectedEmployee.department_name || "");
    setField("position", selectedEmployee.position || selectedEmployee.job_title || "");
  }, [selectedEmployee]);

  const handleKpiDetailChange = (index, field, value) => {
    setForm((prev) => {
      const details = [...(prev.kpi_details || [])];
      if (!details[index]) return prev;
      details[index] = { ...details[index], [field]: value };
      return { ...prev, kpi_details: details };
    });
  };

  const addKpiDetail = (kpi) => {
    setForm((prev) => ({
      ...prev,
      kpi_details: [
        ...(prev.kpi_details || []),
        {
          kpi_assignment_id: kpi.id,
          kpi_name: kpi.name || kpi.kpi_name || "",
          target: kpi.target_value ?? "",
          actual: "",
          weight: kpi.weight ?? "",
          rating: "",
          score: 0,
          achievement_pct: 0,
          manager_remarks: "",
        },
      ],
    }));
    setShowKpiSelector(false);
  };

  const removeKpiDetail = (index) => {
    setForm((prev) => ({
      ...prev,
      kpi_details: (prev.kpi_details || []).filter((_, i) => i !== index),
    }));
  };

  const handleCompetencyChange = (index, field, value) => {
    setForm((prev) => {
      const comps = [...prev.competencies];
      if (!comps[index]) return prev;
      comps[index] = { ...comps[index], [field]: value };
      return { ...prev, competencies: comps };
    });
  };

  const handleGoalChange = (index, field, value) => {
    setForm((prev) => {
      const goals = [...prev.goals];
      if (!goals[index]) return prev;
      goals[index] = { ...goals[index], [field]: value };
      return { ...prev, goals };
    });
  };

  const addGoal = () => {
    setForm((prev) => ({ ...prev, goals: [...prev.goals, { ...INITIAL_GOAL }] }));
  };

  const removeGoal = (index) => {
    setForm((prev) => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== index),
    }));
  };

  const handleEmployeeChange = (e) => {
    const val = e.target.value;
    setForm((prev) => ({
      ...prev,
      employee_id: val,
      kpi_details: [],
      department: "",
      position: "",
    }));
  };

  const loadAvailableKpis = async () => {
    try {
      const res = await api.get("/hr/performance/kpis");
      const items = res?.data?.items || [];
      const existingIds = new Set(
        (form.kpi_details || []).map((d) => String(d.kpi_assignment_id)),
      );
      const filtered = items.filter((k) => !existingIds.has(String(k.id)));
      setAvailableKpis(filtered);
      setShowKpiSelector(true);
    } catch {
      toast.error("Failed to load KPIs");
    }
  };

  const buildPayload = () => ({
    employee_id: form.employee_id,
    period_name: form.period_name,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    reviewer_user_id: form.reviewer_user_id || null,
    department: form.department,
    position: form.position,
    kpi_details: (form.kpi_details || []).map((k) => ({
      kpi_assignment_id: k.kpi_assignment_id,
      kpi_name: k.kpi_name,
      target: k.target,
      actual: k.actual,
      weight: k.weight,
      rating: k.rating,
      score: k.score,
      achievement_pct: k.achievement_pct,
      manager_remarks: k.manager_remarks,
    })),
    competencies: form.competencies.map((c) => ({
      competency_name: c.competency_name,
      rating: c.rating,
      remarks: c.remarks,
    })),
    goals: form.goals.filter((g) => g.goal_name?.trim()),
    self_assessment: form.self_assessment,
    manager_assessment: form.manager_assessment,
    total_kpi_score: kpiComputed.totalKpiScore,
    total_competency_score: competencyAverage,
    overall_score: overallScore,
  });

  const handleSave = async (action) => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await api.put(`/hr/performance/appraisals/${id}`, payload);
        if (action === "SUBMIT") {
          await api.post(`/hr/performance/appraisals/${id}/action`, { action: "SUBMIT" });
        }
        toast.success(action === "SUBMIT" ? "Appraisal submitted" : "Appraisal updated");
      } else {
        const res = await api.post("/hr/performance/appraisals", payload);
        const newId = res?.data?.item?.id || res?.data?.id;
        if (action === "SUBMIT" && newId) {
          await api.post(`/hr/performance/appraisals/${newId}/action`, { action: "SUBMIT" });
        }
        toast.success(action === "SUBMIT" ? "Appraisal submitted" : "Appraisal saved");
      }
      if (action === "SUBMIT") {
        navigate("/human-resources?section=Analytics%20%26%20Performance");
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save appraisal");
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS_DATA.length - 1) setCurrentStep((s) => s + 1);
  };
  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const canProceed = () => {
    if (currentStep === 0) {
      return !!form.employee_id && !!form.period_name;
    }
    return true;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading appraisal...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 max-w-md text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Error Loading Appraisal</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{loadError}</p>
          <button onClick={() => navigate("/human-resources?section=Analytics%20%26%20Performance")} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderEmployeeStep();
      case 1:
        return renderKpiStep();
      case 2:
        return renderCompetencyStep();
      case 3:
        return renderGoalsStep();
      case 4:
        return renderSelfAssessmentStep();
      case 5:
        return renderReviewStep();
      default:
        return null;
    }
  };

  function renderEmployeeStep() {
    return (
      <Card title="Employee Information" icon={User}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Select
            label="Employee"
            value={form.employee_id}
            onChange={handleEmployeeChange}
            options={employees.map((e) => ({
              value: e.id,
              label: e.full_name || `${e.first_name || ""} ${e.last_name || ""}`.trim() || `#${e.id}`,
            }))}
            placeholder="Select Employee"
            required
            className="lg:col-span-2"
          />
          <Input label="Review Period" value={form.period_name} onChange={(e) => setField("period_name", e.target.value)} placeholder="e.g. Q1 2026" required />
          <Input label="Start Date" type="date" value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />
          <Input label="End Date" type="date" value={form.end_date} onChange={(e) => setField("end_date", e.target.value)} />
          <Input label="Reviewer (User ID)" type="number" value={form.reviewer_user_id} onChange={(e) => setField("reviewer_user_id", e.target.value)} placeholder="Optional" />
          <Input label="Department" value={form.department} disabled />
          <Input label="Position" value={form.position} disabled />
        </div>
        {selectedEmployee && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">{selectedEmployee.full_name || `${selectedEmployee.first_name || ""} ${selectedEmployee.last_name || ""}`.trim()}</span>
              <span className="text-xs text-blue-500 dark:text-blue-400">-</span>
              <span className="text-xs text-blue-500 dark:text-blue-400">{selectedEmployee.employee_code || selectedEmployee.code || `#${selectedEmployee.id}`}</span>
            </div>
          </div>
        )}
      </Card>
    );
  }

  function renderKpiStep() {
    if (!form.employee_id) {
      return (
        <Card title="KPI Evaluation" icon={Target}>
          <EmptyState icon={User} title="Select an Employee first" message="Please go to Step 1 and choose an employee to load their KPIs." />
        </Card>
      );
    }
    return (
      <Card
        title="KPI Evaluation"
        icon={Target}
        titleRight={
          <button type="button" onClick={loadAvailableKpis} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add KPI
          </button>
        }
      >
        {(!form.kpi_details || form.kpi_details.length === 0) ? (
          <EmptyState icon={Target} title="No KPIs assigned" message="Click 'Add KPI' to assign performance indicators." />
        ) : (
          <>
            <div className="overflow-x-auto -mx-5">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">KPI Name</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">Target</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">Actual</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">Weight (%)</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">Rating (1-5)</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">Score</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">Achievement %</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Manager Remarks</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.kpi_details.map((row, i) => {
                    const { achievement_pct, score } = calcKpiScore(row);
                    return (
                      <tr key={i} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200 min-w-[140px]">
                          <input
                            type="text"
                            value={row.kpi_name || ""}
                            onChange={(e) => handleKpiDetailChange(i, "kpi_name", e.target.value)}
                            className="w-full bg-transparent border-0 p-0 text-xs focus:ring-0 outline-none"
                            placeholder="KPI name"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            step="any"
                            value={row.target ?? ""}
                            onChange={(e) => handleKpiDetailChange(i, "target", e.target.value)}
                            className="w-20 text-center bg-transparent border-0 p-0 text-xs focus:ring-0 outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            step="any"
                            value={row.actual ?? ""}
                            onChange={(e) => handleKpiDetailChange(i, "actual", e.target.value)}
                            className="w-20 text-center bg-transparent border-0 p-0 text-xs focus:ring-0 outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max="100"
                            value={row.weight ?? ""}
                            onChange={(e) => handleKpiDetailChange(i, "weight", e.target.value)}
                            className="w-16 text-center bg-transparent border-0 p-0 text-xs focus:ring-0 outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-center">
                            <StarRating value={parseInt(row.rating) || 0} onChange={(v) => handleKpiDetailChange(i, "rating", v)} size="sm" />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-gray-800 dark:text-gray-200">{score.toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                            achievement_pct >= 100 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                            achievement_pct >= 70 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}>
                            {achievement_pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-2 min-w-[120px]">
                          <input
                            type="text"
                            value={row.manager_remarks || ""}
                            onChange={(e) => handleKpiDetailChange(i, "manager_remarks", e.target.value)}
                            className="w-full bg-transparent border-0 p-0 text-xs focus:ring-0 outline-none"
                            placeholder="Remarks..."
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button type="button" onClick={() => removeKpiDetail(i)} className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
              <ScoreCard title="Total KPI Score" value={kpiComputed.totalKpiScore.toFixed(2)} color="blue" icon={BarChart3} />
            </div>
          </>
        )}

        {showKpiSelector && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowKpiSelector(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[70vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Select KPI to Add</h3>
                <button onClick={() => setShowKpiSelector(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-4 h-4" /></button>
              </div>
              <div className="p-2 overflow-y-auto max-h-[50vh]">
                {availableKpis.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-8">No more KPIs available</p>
                ) : (
                  availableKpis.map((kpi) => (
                    <button
                      key={kpi.id}
                      type="button"
                      onClick={() => addKpiDetail(kpi)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Target className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{kpi.name || kpi.kpi_name}</p>
                        <p className="text-xs text-gray-500">{kpi.code || ""} {kpi.target_value ? `| Target: ${kpi.target_value}` : ""}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  }

  function renderCompetencyStep() {
    return (
      <Card title="Competency Evaluation" icon={Award}>
        <div className="space-y-3">
          {form.competencies.map((comp, i) => (
            <div key={comp.competency_name} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
              <div className="sm:w-1/4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{comp.competency_name}</p>
              </div>
              <div className="sm:w-1/5">
                <StarRating value={parseInt(comp.rating) || 0} onChange={(v) => handleCompetencyChange(i, "rating", v)} />
              </div>
              <div className="sm:flex-1">
                <input
                  type="text"
                  value={comp.remarks || ""}
                  onChange={(e) => handleCompetencyChange(i, "remarks", e.target.value)}
                  placeholder="Remarks..."
                  className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
          <ScoreCard title="Average Competency Score" value={competencyAverage.toFixed(2)} suffix="/ 5" color="purple" icon={Award} />
        </div>
      </Card>
    );
  }

  function renderGoalsStep() {
    return (
      <Card
        title="Goal Tracking"
        icon={TrendingUp}
        titleRight={
          <button type="button" onClick={addGoal} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Goal
          </button>
        }
      >
        {form.goals.length === 0 ? (
          <EmptyState icon={TrendingUp} title="No goals added" message="Click 'Add Goal' to define performance goals." />
        ) : (
          <div className="space-y-3">
            {form.goals.map((goal, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                <div className="flex-1">
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Goal Name</label>
                  <input
                    type="text"
                    value={goal.goal_name || ""}
                    onChange={(e) => handleGoalChange(i, "goal_name", e.target.value)}
                    placeholder="e.g. Increase sales by 15%"
                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
                <div className="sm:w-28">
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Completion %</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={goal.completion_pct ?? ""}
                      onChange={(e) => handleGoalChange(i, "completion_pct", e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    />
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Remarks</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={goal.remarks || ""}
                      onChange={(e) => handleGoalChange(i, "remarks", e.target.value)}
                      placeholder="Remarks..."
                      className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    />
                    <button type="button" onClick={() => removeGoal(i)} className="text-red-400 hover:text-red-600 transition-colors self-end pb-1.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {form.goals.filter((g) => g.goal_name?.trim()).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
            <ScoreCard title="Overall Goal Completion" value={goalAverage.toFixed(1)} suffix="%" color="teal" icon={Activity} />
          </div>
        )}
      </Card>
    );
  }

  function renderSelfAssessmentStep() {
    return (
      <Card title="Self Assessment" icon={MessageSquare}>
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4" />
              <p className="text-xs">This section is for the employee&apos;s own assessment. Manager may also provide input in the Review step.</p>
            </div>
          </div>
          <Textarea label="Employee Comments / Remarks" value={form.self_assessment.employee_comments} onChange={(e) => setSelfAssessment("employee_comments", e.target.value)} placeholder="Share overall comments about this period..." rows={4} />
          <Textarea label="Achievements" value={form.self_assessment.achievements} onChange={(e) => setSelfAssessment("achievements", e.target.value)} placeholder="What were the key accomplishments this period?" rows={3} />
          <Textarea label="Challenges" value={form.self_assessment.challenges} onChange={(e) => setSelfAssessment("challenges", e.target.value)} placeholder="What challenges were faced and how were they addressed?" rows={3} />
          <Input label="Supporting Documents (URL)" value={form.self_assessment.supporting_docs} onChange={(e) => setSelfAssessment("supporting_docs", e.target.value)} placeholder="Link to supporting documents (optional)" />
        </div>
      </Card>
    );
  }

  function renderReviewStep() {
    return (
      <div className="space-y-5">
        <Card title="Score Summary" icon={BarChart3}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ScoreCard title="KPI Score" value={kpiComputed.totalKpiScore.toFixed(2)} color="blue" icon={Target} />
            <ScoreCard title="Competency Score" value={competencyAverage.toFixed(2)} suffix="/ 5" color="purple" icon={Award} />
            <ScoreCard title="Overall Score" value={overallScore.toFixed(1)} suffix="%" color="green" icon={TrendingUp} />
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> KPI (70% weight)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Competency (30% weight)</span>
          </div>
        </Card>

        <Card title="Manager Assessment" icon={Users}>
          <div className="space-y-4">
            <Textarea label="Manager Remarks" value={form.manager_assessment.manager_remarks} onChange={(e) => setManagerAssessment("manager_remarks", e.target.value)} placeholder="Provide overall assessment from manager perspective..." rows={4} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-slate-700 rounded-lg">
                <input
                  type="checkbox"
                  id="rec-promotion"
                  checked={form.manager_assessment.recommend_promotion}
                  onChange={(e) => setManagerAssessment("recommend_promotion", e.target.checked)}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <label htmlFor="rec-promotion" className="text-sm text-gray-700 dark:text-gray-200 cursor-pointer">Recommend Promotion</label>
              </div>
              <Input label="Recommend Increment (%)" type="number" min="0" max="100" value={form.manager_assessment.recommend_increment} onChange={(e) => setManagerAssessment("recommend_increment", e.target.value)} />
              <Input label="Recommend Training" value={form.manager_assessment.recommend_training} onChange={(e) => setManagerAssessment("recommend_training", e.target.value)} placeholder="e.g. Leadership workshop" />
            </div>
          </div>
        </Card>

        <Card title="Review Preview" icon={FileText}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Employee Details</p>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-1.5">
                <p><span className="text-gray-500">Employee:</span> <span className="font-medium text-gray-800 dark:text-gray-200">{selectedEmployee?.full_name || form.employee_id || "-"}</span></p>
                <p><span className="text-gray-500">Period:</span> <span className="font-medium">{form.period_name || "-"}</span></p>
                <p><span className="text-gray-500">Department:</span> <span className="font-medium">{form.department || "-"}</span></p>
                <p><span className="text-gray-500">Position:</span> <span className="font-medium">{form.position || "-"}</span></p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Self Assessment</p>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-1.5">
                <p><span className="text-gray-500">Comments:</span> <span className="text-gray-800 dark:text-gray-200">{form.self_assessment.employee_comments || "None"}</span></p>
                <p><span className="text-gray-500">Achievements:</span> <span className="text-gray-800 dark:text-gray-200">{form.self_assessment.achievements || "None"}</span></p>
                <p><span className="text-gray-500">Challenges:</span> <span className="text-gray-800 dark:text-gray-200">{form.self_assessment.challenges || "None"}</span></p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {(form.kpi_details || []).length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">KPI Details ({form.kpi_details.length})</p>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg max-h-40 overflow-y-auto">
                  {form.kpi_details.map((k, i) => (
                    <div key={i} className="px-3 py-2 border-b border-gray-100 dark:border-slate-700 last:border-0 flex justify-between">
                      <span className="text-gray-800 dark:text-gray-200 truncate mr-2">{k.kpi_name || `KPI #${i + 1}`}</span>
                      <span className="font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{calcKpiScore(k).score.toFixed(2)} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {form.goals.filter((g) => g.goal_name?.trim()).length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Goals ({form.goals.filter((g) => g.goal_name?.trim()).length})</p>
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg max-h-40 overflow-y-auto">
                  {form.goals.filter((g) => g.goal_name?.trim()).map((g, i) => (
                    <div key={i} className="px-3 py-2 border-b border-gray-100 dark:border-slate-700 last:border-0 flex justify-between">
                      <span className="text-gray-800 dark:text-gray-200 truncate mr-2">{g.goal_name}</span>
                      <span className="font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{g.completion_pct || 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(form.manager_assessment.manager_remarks || form.manager_assessment.recommend_training) && (
            <div className="mt-4 text-xs">
              <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Manager Notes</p>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-1.5">
                {form.manager_assessment.manager_remarks && <p><span className="text-gray-500">Remarks:</span> <span className="text-gray-800 dark:text-gray-200">{form.manager_assessment.manager_remarks}</span></p>}
                {form.manager_assessment.recommend_training && <p><span className="text-gray-500">Training:</span> <span className="text-gray-800 dark:text-gray-200">{form.manager_assessment.recommend_training}</span></p>}
                {form.manager_assessment.recommend_promotion && <p><span className="text-green-600">Promotion recommended</span></p>}
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/human-resources?section=Analytics%20%26%20Performance"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50">Performance Appraisal</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {isEdit ? `Editing: #${id}` : "New Appraisal"}
                </span>
                {form.status && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    form.status === "DRAFT" ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" :
                    form.status === "SUBMITTED" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                    form.status === "APPROVED" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                    "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  }`}>
                    {form.status}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            Step {currentStep + 1} of {STEPS_DATA.length}
          </div>
        </div>

        <StepIndicator current={currentStep} />

        <form onSubmit={(e) => { e.preventDefault(); handleSave("SAVE"); }}>
          <div className="space-y-5">
            {renderStep()}
          </div>

          <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-200 dark:border-slate-700">
            <div>
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {currentStep < STEPS_DATA.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSave("SAVE")}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave("SUBMIT")}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    <Send className="w-4 h-4" />
                    {saving ? "Submitting..." : "Submit for Approval"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
