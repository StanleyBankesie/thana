import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Gauge, Plus, ArrowLeft, RefreshCw, Pencil, Trash2,
  CheckCircle, AlertTriangle, Clock, TrendingUp, BarChart2, Eye, X
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PRIORITY_COLORS = {
  EMERGENCY: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  CRITICAL: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  HIGH: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  MEDIUM: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const SLA_STATUS_COLORS = {
  ON_TRACK: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  AT_RISK: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  BREACHED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  MET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

const SERVICE_CATEGORIES = [
  "HVAC_AIR_CONDITIONING",
  "PLUMBING",
  "ELECTRICAL",
  "GENERATOR_POWER",
  "FIRE_SAFETY_SYSTEMS",
  "CLEANING_JANITORIAL",
  "SECURITY_PATROL",
  "PEST_CONTROL",
  "GENERAL_FACILITIES",
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL", "EMERGENCY"];

const getInitialPolicyForm = () => ({
  policy_name: "",
  service_category: "",
  priority: "",
  ack_target_minutes: "",
  response_time_minutes: "",
  attendance_target_hours: "",
  resolution_time_hours: "",
  operating_hours: "",
});

export default function SLAPoliciesPage() {
  const navigate = useNavigate();

  // Policies
  const [policies, setPolicies] = useState([]);
  const [polLoading, setPolLoading] = useState(true);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [viewingPolicy, setViewingPolicy] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [policyForm, setPolicyForm] = useState(getInitialPolicyForm());
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // SLA Performance
  const [slaReport, setSlaReport] = useState(null);
  const [slaLoading, setSlaLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchPolicies();
    fetchSlaReport();
  }, []);

  const fetchPolicies = async () => {
    setPolLoading(true);
    try {
      const res = await api.get("/facilities/sla-policies");
      setPolicies(res.data?.data || []);
    } catch {
      toast.error("Failed to load SLA policies");
    } finally {
      setPolLoading(false);
    }
  };

  const fetchSlaReport = useCallback(async () => {
    setSlaLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const res = await api.get(`/facilities/reports/sla-compliance?${params.toString()}`);
      setSlaReport(res.data?.data || null);
    } catch {
      toast.error("Failed to load SLA performance data");
    } finally {
      setSlaLoading(false);
    }
  }, [startDate, endDate]);

  const openCreateModal = () => {
    setEditingPolicy(null);
    setPolicyForm(getInitialPolicyForm());
    setShowPolicyModal(true);
  };

  const openEditModal = (policy) => {
    setEditingPolicy(policy);
    setPolicyForm({
      policy_name: policy.policy_name || "",
      service_category: policy.service_category || "",
      priority: policy.priority || "",
      ack_target_minutes: policy.ack_target_minutes ?? "",
      response_time_minutes: policy.response_time_minutes ?? "",
      attendance_target_hours: policy.attendance_target_hours ?? "",
      resolution_time_hours: policy.resolution_time_hours ?? "",
      operating_hours: policy.operating_hours || "",
    });
    setShowPolicyModal(true);
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    if (!policyForm.policy_name.trim() || !policyForm.priority) {
      toast.warn("Policy Name and Priority are required.");
      return;
    }
    setSubmitting(true);
    try {
      if (editingPolicy) {
        await api.put(`/facilities/sla-policies/${editingPolicy.id}`, policyForm);
        toast.success("SLA policy updated successfully");
      } else {
        await api.post("/facilities/sla-policies", policyForm);
        toast.success("SLA policy created successfully");
      }
      setShowPolicyModal(false);
      fetchPolicies();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save SLA policy");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePolicy = async (id) => {
    try {
      await api.delete(`/facilities/sla-policies/${id}`);
      toast.success("SLA policy deleted");
      setConfirmDeleteId(null);
      fetchPolicies();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete policy");
    }
  };

  // Derived report stats
  const summary = slaReport?.summary || {};
  const tickets = slaReport?.detailed_tickets || [];
  const compliancePct = summary.sla_compliance_percent ?? (
    summary.total > 0 ? ((summary.met / summary.total) * 100).toFixed(1) : "—"
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs"
            title="Go Back"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              SLA Policies &amp; Performance Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Configure service level agreement policies by priority and category, then monitor live compliance across all maintenance requests.
            </p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
        >
          <Plus size={15} /> Add SLA Policy
        </button>
      </div>

      {/* ── SECTION 1: Policy Configuration ──────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Gauge size={14} />
            SLA Policy Configuration
          </h3>
          <button
            onClick={fetchPolicies}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5 px-3"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Policy Name</th>
                <th className="px-3 py-3">Service Category</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3 text-center">Ack Target (mins)</th>
                <th className="px-3 py-3 text-center">Response (mins)</th>
                <th className="px-3 py-3 text-center">Resolution (hrs)</th>
                <th className="px-3 py-3">Operating Hours</th>
                <th className="px-3 py-3">Active</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {polLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic">
                    Loading SLA policies...
                  </td>
                </tr>
              ) : policies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400 italic">
                    No SLA policies configured yet. Click &apos;+ Add SLA Policy&apos; to create one.
                  </td>
                </tr>
              ) : (
                policies.map((pol) => (
                  <tr key={pol.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">{pol.policy_name}</td>
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                      {pol.service_category?.replace(/_/g, " ") || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_COLORS[pol.priority] || "bg-slate-100 text-slate-700"}`}>
                        {pol.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {pol.ack_target_minutes ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {pol.response_time_minutes ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {pol.resolution_time_hours ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-500">{pol.operating_hours || "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pol.is_active !== false ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                        {pol.is_active !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setViewingPolicy(pol)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors"
                          title="View Policy Details"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => openEditModal(pol)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                          title="Edit Policy"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(pol.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                          title="Delete Policy"
                        >
                          <Trash2 size={13} />
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

      {/* ── SECTION 2: Live SLA Performance Monitor ───────────────────────── */}
      <div className="space-y-4">
        {/* Section header + date filters */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <BarChart2 size={14} />
            Live SLA Performance Monitor
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
              />
            </div>
            <button
              onClick={fetchSlaReport}
              className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <RefreshCw size={12} /> Load
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Requests</span>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {slaLoading ? "—" : (summary.total ?? tickets.length)}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Open Requests</span>
            <div className="text-2xl font-bold font-mono text-blue-600 mt-1">
              {slaLoading ? "—" : (summary.open ?? tickets.filter((t) => t.sla_status === "ON_TRACK" || t.sla_status === "AT_RISK").length)}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">SLA Compliance</span>
            <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
              {slaLoading ? "—" : `${compliancePct}%`}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Breached</span>
            <div className="text-2xl font-bold font-mono text-rose-600 mt-1">
              {slaLoading ? "—" : (summary.breached ?? tickets.filter((t) => t.sla_status === "BREACHED").length)}
            </div>
          </div>
        </div>

        {/* Performance table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Maintenance Requests — SLA Status Detail
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Request No</th>
                  <th className="px-3 py-3">Title / Description</th>
                  <th className="px-3 py-3">Property</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3">SLA Policy</th>
                  <th className="px-3 py-3">SLA Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {slaLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">
                      Loading SLA performance data...
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400 italic">
                      No maintenance requests found for the selected date range.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">
                        {t.request_no || t.ticket_no || `REQ-${t.id}`}
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
                        {t.title || t.description}
                      </td>
                      <td className="px-3 py-3 text-slate-500 dark:text-slate-400">{t.property_name || "—"}</td>
                      <td className="px-3 py-3 text-slate-500">
                        {t.service_category?.replace(/_/g, " ") || t.category?.replace(/_/g, " ") || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_COLORS[t.priority] || "bg-slate-100 text-slate-700"}`}>
                          {t.priority || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono">
                        {t.created_at ? String(t.created_at).slice(0, 10) : "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{t.sla_policy_name || "—"}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${SLA_STATUS_COLORS[t.sla_status] || "bg-slate-100 text-slate-700"}`}>
                          {t.sla_status?.replace(/_/g, " ") || "—"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── MODAL: Create / Edit SLA Policy ───────────────────────────────── */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Gauge size={18} className="text-blue-500" />
                {editingPolicy ? "Edit SLA Policy" : "Add SLA Policy"}
              </h3>
              <button type="button" onClick={() => setShowPolicyModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1">✕</button>
            </div>
            <form onSubmit={handleSavePolicy} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Policy Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency HVAC Response Policy"
                  value={policyForm.policy_name}
                  onChange={(e) => setPolicyForm({ ...policyForm, policy_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Service Category</label>
                  <select
                    value={policyForm.service_category}
                    onChange={(e) => setPolicyForm({ ...policyForm, service_category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    <option value="">-- All Categories --</option>
                    {SERVICE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Priority *</label>
                  <select
                    value={policyForm.priority}
                    onChange={(e) => setPolicyForm({ ...policyForm, priority: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  >
                    <option value="">-- Select Priority --</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Ack Target (mins)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g. 15"
                    value={policyForm.ack_target_minutes}
                    onChange={(e) => setPolicyForm({ ...policyForm, ack_target_minutes: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Response Time (mins)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g. 60"
                    value={policyForm.response_time_minutes}
                    onChange={(e) => setPolicyForm({ ...policyForm, response_time_minutes: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Attendance Target (hrs)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    placeholder="e.g. 4"
                    value={policyForm.attendance_target_hours}
                    onChange={(e) => setPolicyForm({ ...policyForm, attendance_target_hours: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Resolution Time (hrs)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    placeholder="e.g. 24"
                    value={policyForm.resolution_time_hours}
                    onChange={(e) => setPolicyForm({ ...policyForm, resolution_time_hours: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Operating Hours</label>
                <input
                  type="text"
                  placeholder='e.g. "24/7" or "08:00–18:00 Mon–Fri"'
                  value={policyForm.operating_hours}
                  onChange={(e) => setPolicyForm({ ...policyForm, operating_hours: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle size={14} />
                  {submitting ? "Saving..." : editingPolicy ? "Update Policy" : "Create Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Confirm Delete ─────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-100 dark:bg-rose-950 rounded-xl">
                <AlertTriangle size={20} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Delete SLA Policy</h4>
                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-5">
              Are you sure you want to delete this SLA policy? Any existing service requests linked to it will lose their SLA targets.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePolicy(confirmDeleteId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                Delete Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: View Policy Details ── */}
      {viewingPolicy && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Gauge size={18} className="text-indigo-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  SLA Policy Details — {viewingPolicy.policy_name}
                </h3>
              </div>
              <button onClick={() => setViewingPolicy(null)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Policy Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{viewingPolicy.policy_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Service Category</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{viewingPolicy.service_category?.replace(/_/g, " ") || "All Categories"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Priority Tier</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block mt-0.5 ${PRIORITY_COLORS[viewingPolicy.priority] || ""}`}>
                    {viewingPolicy.priority}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block mt-0.5 ${viewingPolicy.is_active !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                    {viewingPolicy.is_active !== false ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border border-slate-100 dark:border-slate-800 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Ack Target</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{viewingPolicy.ack_target_minutes != null ? `${viewingPolicy.ack_target_minutes} min` : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Response Target</span>
                  <span className="font-mono font-bold text-blue-600">{viewingPolicy.response_time_minutes != null ? `${viewingPolicy.response_time_minutes} min` : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Attendance Target</span>
                  <span className="font-mono font-bold text-amber-600">{viewingPolicy.attendance_target_hours != null ? `${viewingPolicy.attendance_target_hours} hrs` : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Resolution Target</span>
                  <span className="font-mono font-bold text-emerald-600">{viewingPolicy.resolution_time_hours != null ? `${viewingPolicy.resolution_time_hours} hrs` : "—"}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-1">Operating Hours Schedule</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{viewingPolicy.operating_hours || "24/7 (Continuous)"}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => {
                    const p = viewingPolicy;
                    setViewingPolicy(null);
                    openEditModal(p);
                  }}
                  className="btn btn-primary text-xs px-4 py-2"
                >
                  Edit Policy
                </button>
                <button onClick={() => setViewingPolicy(null)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
