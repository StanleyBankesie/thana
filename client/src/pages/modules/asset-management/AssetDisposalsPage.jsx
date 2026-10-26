import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  Trash2, Plus, Search, Calendar, DollarSign, 
  TrendingUp, TrendingDown, CheckCircle2, X, Save, RefreshCw, AlertTriangle, ArrowLeft 
} from "lucide-react";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";

function formatCurrency(val) {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AssetDisposalsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedAssetId = searchParams.get("assetId");

  const [disposals, setDisposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(Boolean(preselectedAssetId));
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [activeAssets, setActiveAssets] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    asset_id: preselectedAssetId || "",
    disposal_date: new Date().toISOString().split("T")[0],
    disposal_type: "SALE",
    sale_proceeds: "0.00",
    disposal_cost: "0.00",
    disposal_reason: "",
    buyer_or_recipient: "",
    notes: "",
  });

  useEffect(() => {
    fetchDisposals();
    fetchActiveAssets();
  }, []);

  const fetchDisposals = async () => {
    try {
      setLoading(true);
      const res = await api.get("/assets/disposals/list");
      setDisposals(res.data?.data || []);
    } catch {
      toast.error("Failed to load asset disposals");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveAssets = async () => {
    try {
      const res = await api.get("/assets", { params: { status: "ACTIVE" } });
      setActiveAssets(res.data?.data || []);
    } catch {
      // Ignored
    }
  };

  const selectedAsset = activeAssets.find((a) => String(a.id) === String(form.asset_id));
  const currentNBV = selectedAsset ? Number(selectedAsset.current_nbv || 0) : 0;
  const netProceeds = Number(form.sale_proceeds || 0) - Number(form.disposal_cost || 0);
  const calculatedGainLoss = netProceeds - currentNBV;

  const handleOpenDisposal = (assetId = "") => {
    setForm({
      asset_id: assetId || "",
      disposal_date: new Date().toISOString().split("T")[0],
      disposal_type: "SALE",
      sale_proceeds: "0.00",
      disposal_cost: "0.00",
      disposal_reason: "",
      buyer_or_recipient: "",
      notes: "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.asset_id) {
      toast.error("Please select an asset to dispose");
      return;
    }

    try {
      setSaving(true);
      const res = await api.post("/assets/disposals", form);
      toast.success(res.data?.message || "Asset disposal recorded successfully!");
      setShowModal(false);
      fetchDisposals();
      fetchActiveAssets();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record disposal");
    } finally {
      setSaving(false);
    }
  };

  const filteredDisposals = disposals.filter((d) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (d.disposal_code && d.disposal_code.toLowerCase().includes(term)) ||
      (d.asset_name && d.asset_name.toLowerCase().includes(term)) ||
      (d.asset_code && d.asset_code.toLowerCase().includes(term)) ||
      (d.disposal_reason && d.disposal_reason.toLowerCase().includes(term)) ||
      (d.buyer_or_recipient && d.buyer_or_recipient.toLowerCase().includes(term));
    const matchesType = !typeFilter || d.disposal_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
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
              <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              Asset Disposals & Retirements
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Process asset sales, scrapping, write-offs, and statutory gain/loss on disposal calculations.
            </p>
          </div>
        </div>
        <button
          onClick={() => handleOpenDisposal()}
          className="btn btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all"
        >
          <Plus size={16} /> Record Asset Disposal
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by disposal code, asset tag, asset name, or buyer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Disposal Types</option>
            <option value="SALE">Sale</option>
            <option value="SCRAP">Scrap</option>
            <option value="WRITE_OFF">Write-off</option>
            <option value="DONATION">Donation</option>
            <option value="THEFT_LOSS">Theft / Loss</option>
            <option value="OTHER">Other</option>
          </select>

          <button
            onClick={fetchDisposals}
            className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh List"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Disposals List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="py-3 px-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Disposal Register ({filteredDisposals.length} of {disposals.length} records)
          </span>
          <button
            onClick={fetchDisposals}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading disposals...</div>
        ) : filteredDisposals.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            {searchTerm || typeFilter
              ? "No disposals match your search criteria."
              : "No asset disposals recorded yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Disposal Code</th>
                  <th>Asset Name</th>
                  <th>Type</th>
                  <th>Disposal Date</th>
                  <th className="text-right">NBV at Disposal</th>
                  <th className="text-right">Sale Proceeds</th>
                  <th className="text-right">Gain / (Loss)</th>
                  <th>Buyer / Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredDisposals.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="font-medium text-slate-800 dark:text-slate-200">
                      {d.disposal_code}
                    </td>
                    <td>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {d.asset_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {d.asset_code}
                      </div>
                    </td>
                    <td>
                      {d.disposal_type}
                    </td>
                    <td className="text-slate-500 whitespace-nowrap">
                      {new Date(d.disposal_date).toLocaleDateString()}
                    </td>
                    <td className="text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(d.nbv_at_disposal)}
                    </td>
                    <td className="text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(d.sale_proceeds)}
                    </td>
                    <td className="text-right font-semibold whitespace-nowrap">
                      {Number(d.gain_or_loss_on_disposal) >= 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(d.gain_or_loss_on_disposal)}
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">
                          ({formatCurrency(Math.abs(d.gain_or_loss_on_disposal))})
                        </span>
                      )}
                    </td>
                    <td className="text-slate-500 max-w-xs truncate">
                      {d.buyer_or_recipient || d.disposal_reason || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disposal Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                Record Asset Disposal / Retirement
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Active Asset to Dispose *
                </label>
                <select
                  required
                  value={form.asset_id}
                  onChange={(e) => setForm({ ...form, asset_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Choose an active asset...</option>
                  {activeAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_code} — {a.asset_name} (NBV: {formatCurrency(a.current_nbv)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedAsset && (
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gross Purchase Cost:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(selectedAsset.purchase_cost)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Accumulated Depreciation:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(selectedAsset.accumulated_depreciation)}</strong>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1 font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">Net Book Value (NBV):</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedAsset.current_nbv)}</strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disposal Type *
                  </label>
                  <select
                    value={form.disposal_type}
                    onChange={(e) => setForm({ ...form, disposal_type: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="SALE">Sale to Third Party</option>
                    <option value="SCRAP">Scrap / Salvage</option>
                    <option value="WRITE_OFF">Write-off / Loss / Damaged</option>
                    <option value="DONATION">Charity / Donation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disposal Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.disposal_date}
                    onChange={(e) => setForm({ ...form, disposal_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gross Sale Proceeds
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.sale_proceeds}
                    onChange={(e) => setForm({ ...form, sale_proceeds: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disposal / Removal Cost
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.disposal_cost}
                    onChange={(e) => setForm({ ...form, disposal_cost: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Calculated Gain/Loss pill */}
              <div className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                calculatedGainLoss >= 0 
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
              }`}>
                <span className="font-semibold">Estimated Gain / (Loss) on Disposal:</span>
                <strong className="text-sm font-bold font-mono">
                  {calculatedGainLoss >= 0 ? `+${formatCurrency(calculatedGainLoss)}` : `(${formatCurrency(Math.abs(calculatedGainLoss))})`}
                </strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Buyer or Recipient Name
                </label>
                <input
                  type="text"
                  value={form.buyer_or_recipient}
                  onChange={(e) => setForm({ ...form, buyer_or_recipient: e.target.value })}
                  placeholder="e.g. Acme Scrap Dealers Ltd."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                  <Save size={15} />
                  {saving ? "Recording..." : "Record Disposal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
