import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  TrendingUp, TrendingDown, AlertTriangle, Plus, Search, 
  ArrowLeft, RefreshCw, Calendar, FileText, CheckCircle2, ShieldAlert
} from "lucide-react";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";

function formatCurrency(val) {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AssetRevaluationPage() {
  const navigate = useNavigate();
  const [revaluations, setRevaluations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    asset_id: "",
    revaluation_type: "INCREASE",
    revaluation_date: new Date().toISOString().slice(0, 10),
    new_valuation: "",
    adjustment_amount: "",
    valuation_reason: "",
    valuer_name: "",
    valuation_report_ref: "",
    notes: "",
  });

  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [revRes, astRes] = await Promise.all([
        api.get("/assets/revaluations").catch(() => ({ data: { data: [] } })),
        api.get("/assets").catch(() => ({ data: { data: [] } })),
      ]);
      setRevaluations(revRes.data?.data || []);
      setAssets(astRes.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load revaluations");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setForm({
      asset_id: "",
      revaluation_type: "INCREASE",
      revaluation_date: new Date().toISOString().slice(0, 10),
      new_valuation: "",
      adjustment_amount: "",
      valuation_reason: "",
      valuer_name: "",
      valuation_report_ref: "",
      notes: "",
    });
    setSelectedAsset(null);
    setShowModal(true);
  };

  const handleAssetSelect = (e) => {
    const aId = e.target.value;
    const found = assets.find((a) => String(a.id) === String(aId));
    setSelectedAsset(found || null);
    setForm((prev) => ({
      ...prev,
      asset_id: aId,
      new_valuation: found ? String(found.current_nbv) : "",
      adjustment_amount: "",
    }));
  };

  const handleNewValuationChange = (val) => {
    if (!selectedAsset) {
      setForm((prev) => ({ ...prev, new_valuation: val }));
      return;
    }
    const curNBV = Number(selectedAsset.current_nbv || 0);
    const nVal = Number(val || 0);
    const diff = Math.round(Math.abs(nVal - curNBV) * 100) / 100;
    const autoType = nVal >= curNBV ? "INCREASE" : "IMPAIRMENT";
    setForm((prev) => ({
      ...prev,
      new_valuation: val,
      adjustment_amount: String(diff),
      revaluation_type: autoType,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.asset_id) {
      toast.error("Please select an asset");
      return;
    }
    if (!form.adjustment_amount && !form.new_valuation) {
      toast.error("Please provide an adjustment amount or new valuation");
      return;
    }

    try {
      setSaving(true);
      const res = await api.post("/assets/revaluations", form);
      toast.success(res.data?.message || "Asset value adjustment posted successfully!");
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to post adjustment");
    } finally {
      setSaving(false);
    }
  };

  const filteredRevaluations = revaluations.filter((r) => {
    const matchesSearch =
      !searchTerm ||
      (r.asset_name && r.asset_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.asset_code && r.asset_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.revaluation_no && r.revaluation_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.valuer_name && r.valuer_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = !typeFilter || r.revaluation_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalIncrease = revaluations
    .filter((r) => r.revaluation_type === "INCREASE")
    .reduce((s, r) => s + Number(r.adjustment_amount || 0), 0);

  const totalDecrease = revaluations
    .filter((r) => r.revaluation_type === "DECREASE" || r.revaluation_type === "IMPAIRMENT")
    .reduce((s, r) => s + Number(r.adjustment_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm"
            title="Go Back"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              Asset Revaluation & Value Adjustments
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Record upward revaluation surplus, impairment losses, and book value adjustments with automatic GL posting.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenModal}
          className="btn btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all"
        >
          <Plus size={16} /> New Value Adjustment
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Total Adjustments</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {revaluations.length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Cumulative Revaluation Surplus</span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            +{formatCurrency(totalIncrease)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Cumulative Impairments & Reductions</span>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            -{formatCurrency(totalDecrease)}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search adjustments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Adjustment Types</option>
            <option value="INCREASE">Revaluation Increase (+)</option>
            <option value="IMPAIRMENT">Impairment Loss (-)</option>
            <option value="DECREASE">Value Reduction (-)</option>
          </select>
          <button
            onClick={fetchData}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Refresh list"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading adjustments...</div>
        ) : filteredRevaluations.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No asset revaluations recorded yet. Click "New Value Adjustment" to record one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                <tr>
                  <th className="py-3 px-4">Ref No.</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Asset Code & Name</th>
                  <th className="py-3 px-4 text-center">Type</th>
                  <th className="py-3 px-4 text-right">Prior NBV</th>
                  <th className="py-3 px-4 text-right">Adjustment</th>
                  <th className="py-3 px-4 text-right">New Carrying NBV</th>
                  <th className="py-3 px-4">Valuer / Reason</th>
                  <th className="py-3 px-4">GL Voucher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredRevaluations.map((r) => {
                  const isInc = r.revaluation_type === "INCREASE";
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {r.revaluation_no}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(r.revaluation_date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        <div>{r.asset_name}</div>
                        <div className="font-mono text-[11px] text-brand-600 dark:text-brand-400">{r.asset_code}</div>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isInc
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                          }`}
                        >
                          {isInc ? "Revaluation (+)" : "Impairment (-)"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">
                        {formatCurrency(r.previous_nbv)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-bold ${
                          isInc ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isInc ? "+" : "-"}{formatCurrency(r.adjustment_amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(r.new_nbv)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{r.valuation_reason || "Valuation adjustment"}</div>
                        {r.valuer_name && <div className="text-[11px] text-slate-400">Valuer: {r.valuer_name}</div>}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-brand-700 dark:text-brand-400">
                        {r.voucher_no || `JV-${r.revaluation_no}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: New Value Adjustment */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl w-full max-w-lg space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Record Asset Revaluation / Value Adjustment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Revalue an asset upward or book an impairment loss with balanced General Ledger posting.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Fixed Asset *
                </label>
                <select
                  required
                  value={form.asset_id}
                  onChange={handleAssetSelect}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select Asset...</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_name} ({a.asset_code}) — Carrying NBV: {formatCurrency(a.current_nbv)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAsset && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs flex justify-between">
                  <div>
                    <span className="text-slate-400">Historical Cost Basis:</span>{" "}
                    <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(selectedAsset.purchase_cost)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Current Net Book Value:</span>{" "}
                    <strong className="text-brand-600 dark:text-brand-400 font-mono">{formatCurrency(selectedAsset.current_nbv)}</strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Adjustment Type *
                  </label>
                  <select
                    value={form.revaluation_type}
                    onChange={(e) => setForm({ ...form, revaluation_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="INCREASE">Revaluation Increase (Upward)</option>
                    <option value="IMPAIRMENT">Impairment Loss (Unexpected Drop)</option>
                    <option value="DECREASE">Value Reduction / Write-down</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Effective Valuation Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.revaluation_date}
                    onChange={(e) => setForm({ ...form, revaluation_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Valuation Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="New appraised value"
                    value={form.new_valuation}
                    onChange={(e) => handleNewValuationChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Adjustment Amount (Delta) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 5000.00"
                    value={form.adjustment_amount}
                    onChange={(e) => setForm({ ...form, adjustment_amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valuer / Appraisal Agency
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Knight Frank / Broll"
                    value={form.valuer_name}
                    onChange={(e) => setForm({ ...form, valuer_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valuation Report Reference
                  </label>
                  <input
                    type="text"
                    placeholder="Report # or Certificate ref."
                    value={form.valuation_report_ref}
                    onChange={(e) => setForm({ ...form, valuation_report_ref: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Valuation Reason & Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Market appreciation, impairment due to physical damage or technological obsolescence..."
                  value={form.valuation_reason}
                  onChange={(e) => setForm({ ...form, valuation_reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? "Posting..." : "Confirm & Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
