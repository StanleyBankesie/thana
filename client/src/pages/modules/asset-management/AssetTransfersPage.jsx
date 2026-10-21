import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  ArrowRightLeft, Plus, Search, Calendar, 
  MapPin, User, CheckCircle2, X, Save, RefreshCw, Building2, ArrowLeft 
} from "lucide-react";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";

export default function AssetTransfersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedAssetId = searchParams.get("assetId");

  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(Boolean(preselectedAssetId));
  const [searchTerm, setSearchTerm] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");

  const [assets, setAssets] = useState([]);
  const [properties, setProperties] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    asset_id: preselectedAssetId || "",
    to_property_id: "",
    to_space_id: "",
    to_custodian_user_id: "",
    transfer_date: new Date().toISOString().split("T")[0],
    reason: "",
    notes: "",
  });

  useEffect(() => {
    fetchTransfers();
    fetchPrerequisites();
  }, []);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/assets/transfers/list");
      setTransfers(res.data?.data || []);
    } catch (err) {
      console.error("[AssetTransfersPage] Error fetching transfers:", err);
      toast.error(err.response?.data?.message || "Failed to load asset transfers history");
    } finally {
      setLoading(false);
    }
  };

  const fetchPrerequisites = async () => {
    try {
      const [assetRes, propRes] = await Promise.all([
        api.get("/assets", { params: { status: "ACTIVE" } }).catch(() => ({ data: { data: [] } })),
        api.get("/facilities/properties").catch(() => ({ data: { data: [] } })),
      ]);
      setAssets(assetRes.data?.data || []);
      setProperties(propRes.data?.data || []);
    } catch {
      // Ignored
    }
  };

  const handleOpenTransfer = (assetId = "") => {
    setForm({
      asset_id: assetId || "",
      to_property_id: "",
      to_space_id: "",
      to_custodian_user_id: "",
      transfer_date: new Date().toISOString().split("T")[0],
      reason: "",
      notes: "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.asset_id) {
      toast.error("Please select an asset to transfer");
      return;
    }

    try {
      setSaving(true);
      await api.post("/assets/transfers", form);
      toast.success("Asset transfer logged and location updated successfully!");
      setShowModal(false);
      fetchTransfers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to process transfer");
    } finally {
      setSaving(false);
    }
  };

  const filteredTransfers = transfers.filter((t) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (t.transfer_code && t.transfer_code.toLowerCase().includes(term)) ||
      (t.asset_name && t.asset_name.toLowerCase().includes(term)) ||
      (t.asset_code && t.asset_code.toLowerCase().includes(term)) ||
      (t.reason && t.reason.toLowerCase().includes(term)) ||
      (t.notes && t.notes.toLowerCase().includes(term));
    const matchesProperty =
      !propertyFilter ||
      String(t.to_property_id) === String(propertyFilter) ||
      String(t.from_property_id) === String(propertyFilter);
    return matchesSearch && matchesProperty;
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
              <ArrowRightLeft className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              Asset Transfers & Movements
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Maintain strict custody control and physical location tracking across branches, properties, and custodians.
            </p>
          </div>
        </div>
        <button
          onClick={() => handleOpenTransfer()}
          className="btn btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all"
        >
          <Plus size={16} /> New Asset Transfer
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by transfer code, asset tag, asset name, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Locations / Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.property_name}</option>
            ))}
          </select>

          <button
            onClick={fetchTransfers}
            className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh List"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Transfers List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="py-3 px-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Transfer Audit Trail ({filteredTransfers.length} of {transfers.length} records)
          </span>
          <button
            onClick={fetchTransfers}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading transfers...</div>
        ) : filteredTransfers.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            {searchTerm || propertyFilter
              ? "No transfers match your search criteria."
              : "No asset transfers recorded yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Transfer Code</th>
                  <th>Asset Details</th>
                  <th>Transfer Date</th>
                  <th>From Location / Property</th>
                  <th>To Location / Property</th>
                  <th>Reason / Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="font-medium text-slate-800 dark:text-slate-200">
                      {t.transfer_code}
                    </td>
                    <td>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {t.asset_name}
                      </div>
                      <div className="text-xs text-brand-600 dark:text-brand-400">
                        {t.asset_code}
                      </div>
                    </td>
                    <td className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(t.transfer_date).toLocaleDateString()}
                    </td>
                    <td className="text-slate-600 dark:text-slate-300">
                      {t.from_property_name || "—"}
                    </td>
                    <td className="font-medium text-emerald-600 dark:text-emerald-400">
                      {t.to_property_name || "—"}
                    </td>
                    <td className="text-slate-500 max-w-xs truncate">
                      {t.reason || t.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-brand-600" />
                Transfer Asset Custody & Location
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
                  Select Asset to Transfer *
                </label>
                <select
                  required
                  value={form.asset_id}
                  onChange={(e) => setForm({ ...form, asset_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Choose an active asset...</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_code} — {a.asset_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination Property / Site *
                </label>
                <select
                  required
                  value={form.to_property_id}
                  onChange={(e) => setForm({ ...form, to_property_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select Target Property...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.property_name} ({p.property_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Date *
                </label>
                <input
                  type="date"
                  required
                  value={form.transfer_date}
                  onChange={(e) => setForm({ ...form, transfer_date: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Transfer
                </label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Departmental relocation / Project site setup"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Notes
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional delivery or hand-over notes..."
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
                  {saving ? "Transferring..." : "Complete Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
