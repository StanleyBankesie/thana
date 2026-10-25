import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck, AlertOctagon, Plus, ArrowLeft,
  Filter, RefreshCw, Search, CheckCircle, XCircle,
  Calendar, Wrench, Eye, Edit
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const runStatusBadge = (status) => {
  const map = {
    SCHEDULED:       "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    IN_PROGRESS:     "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    COMPLETED:       "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    FLAGGED_DEFECTS: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
    CANCELLED:       "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };
  return map[status] || "bg-slate-100 text-slate-500";
};

const actionStatusBadge = (status) => {
  const map = {
    OPEN:                 "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
    IN_PROGRESS:          "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    PENDING_VERIFICATION: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    CLOSED:               "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  };
  return map[status] || "bg-slate-100 text-slate-500";
};

const severityBadge = (sev) => {
  const map = {
    CRITICAL: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
    MAJOR:    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    MINOR:    "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  };
  return map[sev] || "bg-slate-100 text-slate-500";
};

const passBadge = (result) => {
  if (result === "PASS") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (result === "FAIL") return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
};

// ─── Initial form states ──────────────────────────────────────────────────────
const getInitialRunForm = () => ({
  property_id: "",
  inspector_name: "",
  supervisor_name: "",
  inspection_type: "ROUTINE_DAILY",
  template_name: "",
  scheduled_date: "",
});

const getInitialCompleteForm = () => ({
  overall_score_pct: "",
  pass_fail_result: "PASS",
  findings_summary: "",
  defects_count: 0,
});

const getInitialActionForm = () => ({
  property_id: "",
  title: "",
  description: "",
  severity: "MINOR",
  assigned_to: "",
  deadline_date: "",
});

const getInitialUpdateActionForm = () => ({
  status: "OPEN",
  corrective_action_taken: "",
  verification_notes: "",
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function FMInspectionsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("inspections"); // "inspections" | "actions"
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Inspection runs state
  const [runs, setRuns] = useState([]);
  const [runFilters, setRunFilters] = useState({ propertyId: "", status: "", type: "", search: "" });
  const [showRunModal, setShowRunModal] = useState(false);
  const [viewingRun, setViewingRun] = useState(null);
  const [runForm, setRunForm] = useState(getInitialRunForm());
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [completeForm, setCompleteForm] = useState(getInitialCompleteForm());

  // Corrective actions state
  const [actions, setActions] = useState([]);
  const [actionFilters, setActionFilters] = useState({ propertyId: "", status: "", search: "" });
  const [showActionModal, setShowActionModal] = useState(false);
  const [viewingAction, setViewingAction] = useState(null);
  const [actionForm, setActionForm] = useState(getInitialActionForm());
  const [showUpdateActionModal, setShowUpdateActionModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [updateActionForm, setUpdateActionForm] = useState(getInitialUpdateActionForm());

  // ── Fetch helpers ──
  const fetchProperties = useCallback(async () => {
    try {
      const res = await api.get("/facilities/properties");
      const list = res.data?.data || [];
      setProperties(list);
      if (list.length > 0) {
        setRunForm((f) => ({ ...f, property_id: list[0].id }));
        setActionForm((f) => ({ ...f, property_id: list[0].id }));
      }
    } catch {}
  }, []);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (runFilters.propertyId) params.set("propertyId", runFilters.propertyId);
      if (runFilters.status)     params.set("status", runFilters.status);
      if (runFilters.type)       params.set("type", runFilters.type);
      if (runFilters.search)     params.set("search", runFilters.search);
      const res = await api.get(`/facilities/inspection-runs?${params.toString()}`);
      setRuns(res.data?.data || []);
    } catch {
      toast.error("Failed to load inspection schedule");
    } finally {
      setLoading(false);
    }
  }, [runFilters]);

  const fetchActions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilters.propertyId) params.set("propertyId", actionFilters.propertyId);
      if (actionFilters.status)     params.set("status", actionFilters.status);
      if (actionFilters.search)     params.set("search", actionFilters.search);
      const res = await api.get(`/facilities/corrective-actions?${params.toString()}`);
      setActions(res.data?.data || []);
    } catch {
      toast.error("Failed to load corrective actions");
    } finally {
      setLoading(false);
    }
  }, [actionFilters]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  useEffect(() => {
    if (activeTab === "inspections") fetchRuns();
    else fetchActions();
  }, [activeTab, fetchRuns, fetchActions]);

  // ── Summary calculations ──
  const totalScheduled = runs.length;
  const completedRuns  = runs.filter((r) => r.status === "COMPLETED").length;
  const flaggedDefects = runs.filter((r) => r.status === "FLAGGED_DEFECTS").length;
  const overdueRuns    = runs.filter((r) => r.status === "SCHEDULED" && new Date(r.scheduled_date) < new Date()).length;

  const today = new Date().toISOString().slice(0, 10);
  const openActions        = actions.filter((a) => a.status === "OPEN").length;
  const inProgressActions  = actions.filter((a) => a.status === "IN_PROGRESS").length;
  const pendingVerification = actions.filter((a) => a.status === "PENDING_VERIFICATION").length;
  const overdueActions     = actions.filter((a) => a.status !== "CLOSED" && a.deadline_date && String(a.deadline_date).slice(0, 10) < today).length;

  // ── Handlers ──
  const handleCreateRun = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/facilities/inspection-runs", runForm);
      toast.success("Inspection run scheduled successfully");
      setShowRunModal(false);
      setRunForm(getInitialRunForm());
      fetchRuns();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to schedule inspection");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteRun = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/facilities/inspection-runs/${selectedRun.id}/complete`, {
        ...completeForm,
        overall_score_pct: parseFloat(completeForm.overall_score_pct),
        defects_count: parseInt(completeForm.defects_count, 10),
      });
      toast.success("Inspection run marked as completed");
      setShowCompleteModal(false);
      setCompleteForm(getInitialCompleteForm());
      fetchRuns();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to complete inspection");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAction = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/facilities/corrective-actions", actionForm);
      toast.success("Corrective action created successfully");
      setShowActionModal(false);
      setActionForm(getInitialActionForm());
      fetchActions();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create corrective action");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAction = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/facilities/corrective-actions/${selectedAction.id}`, updateActionForm);
      toast.success("Corrective action updated");
      setShowUpdateActionModal(false);
      setUpdateActionForm(getInitialUpdateActionForm());
      fetchActions();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update action");
    } finally {
      setSubmitting(false);
    }
  };

  const fr = (field) => (e) => setRunForm((f) => ({ ...f, [field]: e.target.value }));
  const fc = (field) => (e) => setCompleteForm((f) => ({ ...f, [field]: e.target.value }));
  const fa = (field) => (e) => setActionForm((f) => ({ ...f, [field]: e.target.value }));
  const fu = (field) => (e) => setUpdateActionForm((f) => ({ ...f, [field]: e.target.value }));

  // ─── Render ───────────────────────────────────────────────────────────────
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
              <ClipboardCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              Inspection Runs &amp; Corrective Actions
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Scheduled site inspections, compliance scoring, defect flagging and corrective action tracking.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "inspections" && (
            <button
              onClick={() => { setRunForm(getInitialRunForm()); setShowRunModal(true); }}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
            >
              <Plus size={15} /> Schedule Inspection
            </button>
          )}
          {activeTab === "actions" && (
            <button
              onClick={() => { setActionForm(getInitialActionForm()); setShowActionModal(true); }}
              className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
            >
              <Plus size={15} /> Create Action
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab("inspections")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "inspections"
              ? "border-teal-500 text-teal-600 dark:text-teal-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Calendar size={14} />
          Inspection Schedule ({runs.length})
        </button>
        <button
          onClick={() => setActiveTab("actions")}
          className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "actions"
              ? "border-teal-500 text-teal-600 dark:text-teal-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Wrench size={14} />
          Corrective Actions ({actions.length})
        </button>
      </div>

      {/* ── TAB 1: INSPECTION SCHEDULE ──────────────────────────────────────── */}
      {activeTab === "inspections" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Total Scheduled</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{totalScheduled}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Completed</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{completedRuns}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Flagged Defects</p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{flaggedDefects}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Overdue</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{overdueRuns}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Filter size={13} />
                <span className="text-xs font-semibold text-slate-500">Filters</span>
              </div>
              <select
                value={runFilters.propertyId}
                onChange={(e) => setRunFilters((f) => ({ ...f, propertyId: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
              >
                <option value="">All Properties</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.property_name}</option>)}
              </select>
              <select
                value={runFilters.status}
                onChange={(e) => setRunFilters((f) => ({ ...f, status: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
              >
                <option value="">All Status</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="FLAGGED_DEFECTS">Flagged Defects</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select
                value={runFilters.type}
                onChange={(e) => setRunFilters((f) => ({ ...f, type: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
              >
                <option value="">All Types</option>
                <option value="ROUTINE_DAILY">Routine Daily</option>
                <option value="WEEKLY_AUDIT">Weekly Audit</option>
                <option value="MONTHLY_PPM">Monthly PPM</option>
                <option value="AD_HOC">Ad Hoc</option>
                <option value="RISK_BASED">Risk Based</option>
                <option value="STATUTORY">Statutory</option>
              </select>
              <div className="flex-1 min-w-[180px] relative">
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search run no or inspector..."
                  value={runFilters.search}
                  onChange={(e) => setRunFilters((f) => ({ ...f, search: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-1.5 text-xs"
                />
              </div>
              <button onClick={fetchRuns} className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5 px-3">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Run No</th>
                    <th className="px-3 py-3">Template</th>
                    <th className="px-3 py-3">Property</th>
                    <th className="px-3 py-3">Inspector</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Scheduled Date</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Score %</th>
                    <th className="px-3 py-3">Result</th>
                    <th className="px-3 py-3">Defects</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr><td colSpan="11" className="text-center py-10 text-slate-400">Loading inspection schedule…</td></tr>
                  ) : runs.length === 0 ? (
                    <tr><td colSpan="11" className="text-center py-10 text-slate-400 italic">No inspection runs found.</td></tr>
                  ) : (
                    runs.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">{r.run_no}</td>
                        <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-200">{r.template_name || "—"}</td>
                        <td className="px-3 py-3">{r.property_name || "—"}</td>
                        <td className="px-3 py-3">{r.inspector_name}</td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                            {r.inspection_type?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px]">{r.scheduled_date ? String(r.scheduled_date).slice(0, 10) : "—"}</td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${runStatusBadge(r.status)}`}>
                            {r.status?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {r.overall_score_pct != null ? `${r.overall_score_pct}%` : "—"}
                        </td>
                        <td className="px-3 py-3">
                          {r.pass_fail_result ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${passBadge(r.pass_fail_result)}`}>
                              {r.pass_fail_result?.replace(/_/g, " ")}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-3 font-mono text-center">
                          {r.defects_count != null ? (
                            <span className={r.defects_count > 0 ? "text-rose-600 font-bold" : "text-slate-400"}>{r.defects_count}</span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setViewingRun(r)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-semibold transition-all"
                              title="View Inspection Run Details"
                            >
                              <Eye size={11} /> View
                            </button>
                            {(r.status === "SCHEDULED" || r.status === "IN_PROGRESS") && (
                              <button
                                onClick={() => { setSelectedRun(r); setCompleteForm(getInitialCompleteForm()); setShowCompleteModal(true); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[10px] font-semibold"
                              >
                                <CheckCircle size={11} /> Complete / Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: CORRECTIVE ACTIONS ──────────────────────────────────────── */}
      {activeTab === "actions" && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Open</p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{openActions}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">In Progress</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{inProgressActions}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Pending Verification</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{pendingVerification}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">Overdue</p>
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">{overdueActions}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Filter size={13} />
                <span className="text-xs font-semibold text-slate-500">Filters</span>
              </div>
              <select
                value={actionFilters.propertyId}
                onChange={(e) => setActionFilters((f) => ({ ...f, propertyId: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
              >
                <option value="">All Properties</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.property_name}</option>)}
              </select>
              <select
                value={actionFilters.status}
                onChange={(e) => setActionFilters((f) => ({ ...f, status: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs"
              >
                <option value="">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING_VERIFICATION">Pending Verification</option>
                <option value="CLOSED">Closed</option>
              </select>
              <div className="flex-1 min-w-[180px] relative">
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search action title or assignee..."
                  value={actionFilters.search}
                  onChange={(e) => setActionFilters((f) => ({ ...f, search: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-1.5 text-xs"
                />
              </div>
              <button onClick={fetchActions} className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5 px-3">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Action No</th>
                    <th className="px-3 py-3">Title</th>
                    <th className="px-3 py-3">Property</th>
                    <th className="px-3 py-3">Severity</th>
                    <th className="px-3 py-3">Assigned To</th>
                    <th className="px-3 py-3">Deadline</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr><td colSpan="8" className="text-center py-10 text-slate-400">Loading corrective actions…</td></tr>
                  ) : actions.length === 0 ? (
                    <tr><td colSpan="8" className="text-center py-10 text-slate-400 italic">No corrective actions found.</td></tr>
                  ) : (
                    actions.map((a) => {
                      const isOverdue = a.status !== "CLOSED" && a.deadline_date && String(a.deadline_date).slice(0, 10) < today;
                      return (
                        <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">{a.action_no}</td>
                          <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100 max-w-[200px] truncate">{a.title}</td>
                          <td className="px-3 py-3">{a.property_name || "—"}</td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${severityBadge(a.severity)}`}>
                              {a.severity}
                            </span>
                          </td>
                          <td className="px-3 py-3">{a.assigned_to}</td>
                          <td className={`px-3 py-3 font-mono text-[11px] ${isOverdue ? "text-rose-600 font-bold" : ""}`}>
                            {a.deadline_date ? String(a.deadline_date).slice(0, 10) : "—"}
                            {isOverdue && <span className="ml-1 text-[9px] text-rose-500 font-bold">OVERDUE</span>}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${actionStatusBadge(a.status)}`}>
                              {a.status?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <button
                                onClick={() => setViewingAction(a)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-semibold transition-all"
                                title="View Corrective Action Details"
                              >
                                <Eye size={11} /> View
                              </button>
                              {a.status !== "CLOSED" && (
                                <button
                                  onClick={() => {
                                    setSelectedAction(a);
                                    setUpdateActionForm({ status: a.status, corrective_action_taken: a.corrective_action_taken || "", verification_notes: a.verification_notes || "" });
                                    setShowUpdateActionModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[10px] font-semibold"
                                >
                                  <Wrench size={11} /> Edit / Update
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: SCHEDULE INSPECTION
      ══════════════════════════════════════════════════════════════════════ */}
      {showRunModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar size={18} className="text-teal-500" />
                Schedule Inspection Run
              </h3>
              <button type="button" onClick={() => setShowRunModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1">✕</button>
            </div>
            <form onSubmit={handleCreateRun} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Property *</label>
                  <select value={runForm.property_id} onChange={fr("property_id")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required>
                    <option value="">Select property...</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.property_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Inspector Name *</label>
                  <input type="text" placeholder="e.g. Emmanuel Boateng" value={runForm.inspector_name} onChange={fr("inspector_name")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Supervisor Name</label>
                  <input type="text" placeholder="e.g. Daniel Asiedu" value={runForm.supervisor_name} onChange={fr("supervisor_name")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Inspection Type *</label>
                  <select value={runForm.inspection_type} onChange={fr("inspection_type")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required>
                    <option value="ROUTINE_DAILY">Routine Daily</option>
                    <option value="WEEKLY_AUDIT">Weekly Audit</option>
                    <option value="MONTHLY_PPM">Monthly PPM</option>
                    <option value="AD_HOC">Ad Hoc</option>
                    <option value="RISK_BASED">Risk Based</option>
                    <option value="STATUTORY">Statutory</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Template Name</label>
                  <input type="text" placeholder="e.g. FM Monthly Compliance Checklist" value={runForm.template_name} onChange={fr("template_name")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Scheduled Date *</label>
                  <input type="date" value={runForm.scheduled_date} onChange={fr("scheduled_date")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowRunModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-sm">
                  {submitting ? "Scheduling…" : "Schedule Inspection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: COMPLETE INSPECTION RUN
      ══════════════════════════════════════════════════════════════════════ */}
      {showCompleteModal && selectedRun && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle size={18} className="text-emerald-500" />
                Complete Inspection — {selectedRun.run_no}
              </h3>
              <button type="button" onClick={() => setShowCompleteModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1">✕</button>
            </div>
            <form onSubmit={handleCompleteRun} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Overall Score % *</label>
                  <input type="number" min="0" max="100" step="0.1" placeholder="e.g. 87.5" value={completeForm.overall_score_pct} onChange={fc("overall_score_pct")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs font-mono font-bold" required />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Pass / Fail Result *</label>
                  <select value={completeForm.pass_fail_result} onChange={fc("pass_fail_result")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs">
                    <option value="PASS">Pass</option>
                    <option value="FAIL">Fail</option>
                    <option value="CONDITIONAL_PASS">Conditional Pass</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Findings Summary</label>
                <textarea rows={3} placeholder="Summarise key findings, observations and non-conformances..." value={completeForm.findings_summary} onChange={fc("findings_summary")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Defects Count</label>
                <input type="number" min="0" value={completeForm.defects_count} onChange={fc("defects_count")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs font-mono" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowCompleteModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm">
                  {submitting ? "Saving…" : "Mark Completed"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: CREATE CORRECTIVE ACTION
      ══════════════════════════════════════════════════════════════════════ */}
      {showActionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertOctagon size={18} className="text-rose-500" />
                Create Corrective Action
              </h3>
              <button type="button" onClick={() => setShowActionModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1">✕</button>
            </div>
            <form onSubmit={handleCreateAction} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Property *</label>
                  <select value={actionForm.property_id} onChange={fa("property_id")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required>
                    <option value="">Select property...</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.property_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Title *</label>
                  <input type="text" placeholder="e.g. Fix leaking roof drainage on Level 3" value={actionForm.title} onChange={fa("title")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea rows={2} placeholder="Provide more details about the defect or non-conformance..." value={actionForm.description} onChange={fa("description")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Severity *</label>
                  <select value={actionForm.severity} onChange={fa("severity")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required>
                    <option value="MINOR">Minor</option>
                    <option value="MAJOR">Major</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Assigned To *</label>
                  <input type="text" placeholder="e.g. Kwesi Darko" value={actionForm.assigned_to} onChange={fa("assigned_to")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Deadline Date *</label>
                  <input type="date" value={actionForm.deadline_date} onChange={fa("deadline_date")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" required />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowActionModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-sm">
                  {submitting ? "Creating…" : "Create Corrective Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: UPDATE CORRECTIVE ACTION
      ══════════════════════════════════════════════════════════════════════ */}
      {showUpdateActionModal && selectedAction && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench size={18} className="text-teal-500" />
                Update Action — {selectedAction.action_no}
              </h3>
              <button type="button" onClick={() => setShowUpdateActionModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1">✕</button>
            </div>
            <form onSubmit={handleUpdateAction} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Status *</label>
                <select value={updateActionForm.status} onChange={fu("status")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs">
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="PENDING_VERIFICATION">Pending Verification</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Corrective Action Taken</label>
                <textarea rows={3} placeholder="Describe the remediation steps taken..." value={updateActionForm.corrective_action_taken} onChange={fu("corrective_action_taken")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Verification Notes</label>
                <textarea rows={2} placeholder="Notes from supervisor verification check..." value={updateActionForm.verification_notes} onChange={fu("verification_notes")} className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowUpdateActionModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-sm">
                  {submitting ? "Saving…" : "Save Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: View Inspection Run ── */}
      {viewingRun && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-teal-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Inspection Run Details — {viewingRun.run_no}
                </h3>
              </div>
              <button onClick={() => setViewingRun(null)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Template</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{viewingRun.template_name || "Standard Site Inspection"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Property</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingRun.property_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Inspector</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingRun.inspector_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Scheduled Date</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{viewingRun.scheduled_date ? String(viewingRun.scheduled_date).slice(0, 10) : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block mt-0.5 ${runStatusBadge(viewingRun.status)}`}>
                    {viewingRun.status?.replace(/_/g, " ")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Score & Result</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400">
                    {viewingRun.overall_score_pct != null ? `${viewingRun.overall_score_pct}%` : "—"} ({viewingRun.pass_fail_result || "PENDING"})
                  </span>
                </div>
              </div>

              {viewingRun.findings_summary && (
                <div>
                  <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-1">Findings Summary</span>
                  <p className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {viewingRun.findings_summary}
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
                <button onClick={() => setViewingRun(null)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: View Corrective Action ── */}
      {viewingAction && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <AlertOctagon size={18} className="text-rose-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Corrective Action — {viewingAction.action_no}
                </h3>
              </div>
              <button onClick={() => setViewingAction(null)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Title</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{viewingAction.title}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Property</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingAction.property_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Severity</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{viewingAction.severity}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Assigned To</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingAction.assigned_to}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Deadline Date</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{viewingAction.deadline_date ? String(viewingAction.deadline_date).slice(0, 10) : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block mt-0.5 ${actionStatusBadge(viewingAction.status)}`}>
                    {viewingAction.status?.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {viewingAction.description && (
                <div>
                  <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-1">Issue Description</span>
                  <p className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {viewingAction.description}
                  </p>
                </div>
              )}

              {viewingAction.corrective_action_taken && (
                <div>
                  <span className="text-slate-400 block text-[11px] font-semibold uppercase mb-1">Action Taken</span>
                  <p className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-xl leading-relaxed whitespace-pre-wrap">
                    {viewingAction.corrective_action_taken}
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
                <button onClick={() => setViewingAction(null)} className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100">
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
