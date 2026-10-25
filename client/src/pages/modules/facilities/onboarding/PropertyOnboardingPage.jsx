import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, ArrowLeft, CheckCircle, Clock, ClipboardList,
  ChevronDown, RefreshCw, Eye, Layers, Calendar, User
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const STAGE_COLORS = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  PENDING_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  OPERATIONAL: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  ON_HOLD: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

const STAGES = ["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "APPROVED", "OPERATIONAL", "ON_HOLD"];

const getInitialCreateForm = () => ({
  property_id: "",
  client_id: "",
  target_handover_date: "",
  property_manager_name: "",
  condition_summary: "",
});

export default function PropertyOnboardingPage() {
  const navigate = useNavigate();

  const [onboardings, setOnboardings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [filterStage, setFilterStage] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(getInitialCreateForm());

  // Detail panel
  const [detailRecord, setDetailRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [detailStage, setDetailStage] = useState("");
  const [markingItem, setMarkingItem] = useState(null);

  useEffect(() => {
    fetchProperties();
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchOnboardings();
  }, [filterStage, filterSearch]);

  const fetchProperties = async () => {
    try {
      const res = await api.get("/facilities/properties");
      setProperties(res.data?.data || []);
    } catch {}
  };

  const fetchCustomers = async () => {
    try {
      const res = await api.get("/sales/customers");
      setCustomers(res.data?.data || res.data?.items || []);
    } catch {}
  };

  const fetchOnboardings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStage) params.append("stage", filterStage);
      if (filterSearch) params.append("search", filterSearch);
      const res = await api.get(`/facilities/onboarding?${params.toString()}`);
      setOnboardings(res.data?.data || []);
    } catch {
      toast.error("Failed to load onboarding records");
    } finally {
      setLoading(false);
    }
  }, [filterStage, filterSearch]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.property_id) {
      toast.warn("Please select a property.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/facilities/onboarding", createForm);
      toast.success("Property onboarding record created successfully!");
      setShowCreateModal(false);
      setCreateForm(getInitialCreateForm());
      fetchOnboardings();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (id) => {
    setDetailLoading(true);
    setShowDetailModal(true);
    setDetailRecord(null);
    try {
      const res = await api.get(`/facilities/onboarding/${id}`);
      const rec = res.data?.data || {};
      setDetailRecord(rec);
      setDetailStage(rec.stage || "");
    } catch {
      toast.error("Failed to load onboarding details");
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateStage = async () => {
    if (!detailRecord || !detailStage) return;
    setUpdatingStage(true);
    try {
      await api.put(`/facilities/onboarding/${detailRecord.id}`, { stage: detailStage });
      toast.success("Stage updated successfully");
      setDetailRecord((prev) => ({ ...prev, stage: detailStage }));
      fetchOnboardings();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update stage");
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleMarkChecklistItem = async (item) => {
    setMarkingItem(item.id);
    try {
      await api.put(`/facilities/onboarding/checklist/${item.id}`, {
        status: "COMPLETE",
        completed_by: "Current User",
        notes: "",
      });
      toast.success("Checklist item marked complete");
      // Refresh detail
      const res = await api.get(`/facilities/onboarding/${detailRecord.id}`);
      setDetailRecord(res.data?.data || detailRecord);
      fetchOnboardings();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update checklist item");
    } finally {
      setMarkingItem(null);
    }
  };

  // Summary counts
  const total = onboardings.length;
  const inProgress = onboardings.filter((o) => o.stage === "IN_PROGRESS").length;
  const pendingReview = onboardings.filter((o) => o.stage === "PENDING_REVIEW").length;
  const operational = onboardings.filter((o) => o.stage === "OPERATIONAL").length;

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
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Property Onboarding &amp; Handover
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Manage onboarding of new client sites and properties into active operation with structured checklists and stage tracking.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setCreateForm(getInitialCreateForm());
            setShowCreateModal(true);
          }}
          className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
        >
          <Plus size={15} /> New Onboarding
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Onboardings</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">{total}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">In Progress</span>
          <div className="text-2xl font-bold font-mono text-blue-600 mt-1">{inProgress}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Pending Review</span>
          <div className="text-2xl font-bold font-mono text-amber-600 mt-1">{pendingReview}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold text-green-600 uppercase tracking-wider block">Operational</span>
          <div className="text-2xl font-bold font-mono text-green-600 mt-1">{operational}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2 flex-1">
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
          >
            <option value="">All Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search property or client..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
          />
        </div>
        <button
          onClick={fetchOnboardings}
          className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-2 px-3"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Onboarding Register
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Onboarding No</th>
                <th className="px-3 py-3">Property Name</th>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Stage</th>
                <th className="px-3 py-3">Manager</th>
                <th className="px-3 py-3">Target Date</th>
                <th className="px-3 py-3">Checklist Progress</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">
                    Loading onboarding records...
                  </td>
                </tr>
              ) : onboardings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400 italic">
                    No onboarding records found. Click &apos;+ New Onboarding&apos; to get started.
                  </td>
                </tr>
              ) : (
                onboardings.map((ob) => {
                  const done = ob.checklist_done ?? 0;
                  const total_items = ob.checklist_total ?? 0;
                  const pct = total_items > 0 ? (done / total_items) * 100 : 0;
                  return (
                    <tr key={ob.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-white">
                        {ob.onboarding_no || `OB-${ob.id}`}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {ob.property_name}
                      </td>
                      <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                        {ob.client_name || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STAGE_COLORS[ob.stage] || "bg-slate-100 text-slate-700"}`}>
                          {ob.stage?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {ob.property_manager_name || "—"}
                      </td>
                      <td className="px-3 py-3 font-mono">
                        {ob.target_handover_date ? String(ob.target_handover_date).slice(0, 10) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className={`h-full rounded-full ${pct === 100 ? "bg-green-500" : pct > 50 ? "bg-blue-500" : "bg-amber-500"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap">
                            {done}/{total_items}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => openDetail(ob.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-[10px] font-bold transition-colors"
                        >
                          <Eye size={11} /> View Progress
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 size={18} className="text-blue-500" />
                New Property Onboarding
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Property *</label>
                  <select
                    value={createForm.property_id}
                    onChange={(e) => setCreateForm({ ...createForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                    required
                  >
                    <option value="">-- Select Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Client</label>
                  <select
                    value={createForm.client_id}
                    onChange={(e) => setCreateForm({ ...createForm, client_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  >
                    <option value="">-- No Client / Internal --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name || c.customer_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Target Handover Date</label>
                  <input
                    type="date"
                    value={createForm.target_handover_date}
                    onChange={(e) => setCreateForm({ ...createForm, target_handover_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Property Manager Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Kwame Asante"
                    value={createForm.property_manager_name}
                    onChange={(e) => setCreateForm({ ...createForm, property_manager_name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Condition Summary</label>
                <textarea
                  rows={3}
                  placeholder="Describe the current condition of the property, any defects, outstanding works, or special notes..."
                  value={createForm.condition_summary}
                  onChange={(e) => setCreateForm({ ...createForm, condition_summary: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  {submitting ? "Creating..." : "Create Onboarding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL / PROGRESS MODAL */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList size={18} className="text-blue-500" />
                Onboarding Progress {detailRecord ? `— ${detailRecord.onboarding_no || ""}` : ""}
              </h3>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="p-10 text-center text-slate-400 italic text-xs">Loading details...</div>
            ) : detailRecord ? (
              <div className="p-6 space-y-5 text-xs">
                {/* Header info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Property</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{detailRecord.property_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Client</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{detailRecord.client_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Manager</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{detailRecord.property_manager_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-0.5">Target Date</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-white">
                      {detailRecord.target_handover_date ? String(detailRecord.target_handover_date).slice(0, 10) : "—"}
                    </span>
                  </div>
                </div>

                {/* Stage update */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <span className="font-bold text-blue-800 dark:text-blue-300 whitespace-nowrap">Update Stage:</span>
                  <select
                    value={detailStage}
                    onChange={(e) => setDetailStage(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-1.5 text-xs font-semibold flex-1"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleUpdateStage}
                    disabled={updatingStage || detailStage === detailRecord.stage}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-60"
                  >
                    {updatingStage ? "Saving..." : "Apply"}
                  </button>
                </div>

                {/* Checklist items */}
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <ClipboardList size={14} />
                    Onboarding Checklist ({(detailRecord.checklist || []).filter(i => i.status === "COMPLETE").length}/{(detailRecord.checklist || []).length} complete)
                  </h4>
                  {(detailRecord.checklist || []).length === 0 ? (
                    <p className="text-slate-400 italic">No checklist items found for this onboarding.</p>
                  ) : (
                    <div className="space-y-2">
                      {(detailRecord.checklist || []).map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                            item.status === "COMPLETE"
                              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <CheckCircle
                              size={15}
                              className={item.status === "COMPLETE" ? "text-emerald-500 shrink-0" : "text-slate-300 dark:text-slate-600 shrink-0"}
                            />
                            <div className="min-w-0">
                              <span className={`font-semibold block truncate ${item.status === "COMPLETE" ? "line-through text-slate-400" : "text-slate-800 dark:text-white"}`}>
                                {item.item_name || item.description}
                              </span>
                              {item.notes && (
                                <span className="text-[10px] text-slate-400 truncate block">{item.notes}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === "COMPLETE"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                            }`}>
                              {item.status?.replace(/_/g, " ")}
                            </span>
                            {item.status !== "COMPLETE" && (
                              <button
                                onClick={() => handleMarkChecklistItem(item)}
                                disabled={markingItem === item.id}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold disabled:opacity-60"
                              >
                                {markingItem === item.id ? "..." : "Mark Complete"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {detailRecord.condition_summary && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Condition Summary</span>
                    <p className="text-slate-600 dark:text-slate-300">{detailRecord.condition_summary}</p>
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
