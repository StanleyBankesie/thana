import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Building2, Plus, Search, Filter, ArrowUpDown, 
  Tag, Calendar, DollarSign, ArrowRightLeft, 
  Trash2, Edit3, CheckCircle2, AlertCircle, RefreshCw, Eye, ArrowLeft
} from "lucide-react";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";
import ViewToggle from "../../../components/ViewToggle.jsx";

function formatCurrency(val) {
  const n = Number(val);
  return isNaN(n) ? "0.00" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AssetRegisterList() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState("table");

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [categoryFilter, statusFilter]);

  const fetchCategories = async () => {
    try {
      const res = await api.get("/assets/categories");
      setCategories(res.data?.data || []);
    } catch {
      // Fallback
    }
  };

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = {};
      if (categoryFilter) params.categoryId = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get("/assets", { params });
      setAssets(res.data?.data || []);
    } catch (err) {
      console.error("[AssetRegisterList] Error fetching assets:", err);
      toast.error(err.response?.data?.message || "Failed to load fixed assets register");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAssets();
  };

  const filteredAssets = assets.filter((a) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (a.asset_name && a.asset_name.toLowerCase().includes(q)) ||
      (a.asset_code && a.asset_code.toLowerCase().includes(q)) ||
      (a.barcode && a.barcode.toLowerCase().includes(q)) ||
      (a.serial_number && a.serial_number.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "ACTIVE":
        return <span className="badge badge-success">Active</span>;
      case "FULLY_DEPRECIATED":
        return <span className="badge badge-warning">Fully Depreciated</span>;
      case "DISPOSED":
        return <span className="badge badge-error">Disposed</span>;
      case "UNDER_MAINTENANCE":
        return <span className="badge badge-info">In Maintenance</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm"
            title="Go Back"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              Fixed Asset Register
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Complete inventory of capitalized assets, depreciation schedules, historical costs, and net book values.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/assets/new"
            className="btn btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all"
          >
            <Plus size={16} /> New Asset
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by asset code, name, barcode, or serial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.category_name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="FULLY_DEPRECIATED">Fully Depreciated</option>
            <option value="DISPOSED">Disposed</option>
            <option value="UNDER_MAINTENANCE">In Maintenance</option>
          </select>

          <button
            onClick={fetchAssets}
            className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
            title="Refresh List"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>

          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
      </div>

      {/* Asset Display */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading asset register...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No assets found</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1 mb-4">
              {searchTerm || categoryFilter || statusFilter
                ? "No assets match your search filters. Try clearing or relaxing your search criteria."
                : "Your fixed asset register is currently empty. Capitalize your first fixed asset to begin tracking."}
            </p>
            <Link
              to="/assets/new"
              className="btn btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            >
              <Plus size={16} /> Capitalize Asset
            </Link>
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Asset Tag / Code</th>
                  <th>Asset Name</th>
                  <th>Category</th>
                  <th>Capitalized Date</th>
                  <th className="text-right">Gross Cost</th>
                  <th className="text-right">Accum. Dep.</th>
                  <th className="text-right">Net Book Value (NBV)</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td>
                      <div className="font-medium text-brand-700 dark:text-brand-400">
                        {asset.asset_code}
                      </div>
                      {asset.barcode && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          {asset.barcode}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {asset.asset_name}
                      </div>
                      {asset.serial_number && (
                        <div className="text-xs text-slate-400">
                          S/N: {asset.serial_number}
                        </div>
                      )}
                    </td>
                    <td className="text-slate-600 dark:text-slate-300">
                      {asset.category_name || "Uncategorized"}
                    </td>
                    <td className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {asset.capitalization_date
                        ? new Date(asset.capitalization_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="text-right font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatCurrency(asset.purchase_cost)}
                    </td>
                    <td className="text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatCurrency(asset.accumulated_depreciation)}
                    </td>
                    <td className="text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrency(asset.current_nbv)}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      {getStatusBadge(asset.status)}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/assets/${asset.id}`}
                          className="p-1.5 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="View / Edit Asset"
                        >
                          <Edit3 size={15} />
                        </Link>
                        {asset.status === "ACTIVE" && (
                          <>
                            <button
                              onClick={() => navigate(`/assets/transfers?assetId=${asset.id}`)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Transfer Location / Custodian"
                            >
                              <ArrowRightLeft size={15} />
                            </button>
                            <button
                              onClick={() => navigate(`/assets/disposals?assetId=${asset.id}`)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Dispose / Retire Asset"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-brand-700 dark:text-brand-300 border border-slate-200 dark:border-slate-600">
                        {asset.asset_code}
                      </span>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-base mt-1.5 truncate" title={asset.asset_name}>
                        {asset.asset_name}
                      </h3>
                    </div>
                    {getStatusBadge(asset.status)}
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <span>{asset.category_name || "Uncategorized"}</span>
                    {asset.serial_number && (
                      <>
                        <span>•</span>
                        <span>S/N: {asset.serial_number}</span>
                      </>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mb-4">
                    <div className="flex items-center justify-between">
                      <span>Gross Cost:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(asset.purchase_cost)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Accum. Depreciation:</span>
                      <span className="text-slate-600 dark:text-slate-400">{formatCurrency(asset.accumulated_depreciation)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Net Book Value:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(asset.current_nbv)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {asset.capitalization_date ? new Date(asset.capitalization_date).toLocaleDateString() : "—"}
                  </span>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/assets/${asset.id}`}
                      className="p-1.5 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      title="View / Edit Asset"
                    >
                      <Edit3 size={15} />
                    </Link>
                    {asset.status === "ACTIVE" && (
                      <>
                        <button
                          onClick={() => navigate(`/assets/transfers?assetId=${asset.id}`)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Transfer Location / Custodian"
                        >
                          <ArrowRightLeft size={15} />
                        </button>
                        <button
                          onClick={() => navigate(`/assets/disposals?assetId=${asset.id}`)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Dispose / Retire Asset"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer Summary */}
        <div className="bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 py-3 px-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredAssets.length}</span> of {assets.length} assets
          </div>
          <div className="flex items-center gap-6 mt-2 sm:mt-0">
            <span>Total Gross Cost: <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(filteredAssets.reduce((sum, a) => sum + Number(a.purchase_cost || 0), 0))}</strong></span>
            <span>Total NBV: <strong className="text-emerald-700 dark:text-emerald-400">{formatCurrency(filteredAssets.reduce((sum, a) => sum + Number(a.current_nbv || 0), 0))}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
