import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Layers, Plus, Search, Edit3, CheckCircle2, 
  HelpCircle, RefreshCw, X, Save, DollarSign, ArrowLeft 
} from "lucide-react";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";
import ViewToggle from "../../../components/ViewToggle.jsx";

export default function AssetCategoriesPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table");

  // Automated System Default Account Resolutions (Specific matching to prevent non-PPE assets like Prepayments)
  const defaultCostAccount =
    accounts.find((a) => a.code === "1030") ||
    accounts.find((a) => a.code === "1031") ||
    accounts.find((a) => a.code === "1032") ||
    accounts.find((a) => a.name?.toLowerCase().includes("land") || a.name?.toLowerCase().includes("plant"));

  const defaultAccumAccount =
    accounts.find((a) => a.code === "1099") ||
    accounts.find((a) => a.name?.toLowerCase().includes("accumulated depreciation"));

  const defaultExpenseAccount =
    accounts.find((a) => a.code === "5024") ||
    accounts.find((a) => a.name?.toLowerCase().includes("depreciation expense"));

  const defaultGainLossAccount =
    accounts.find((a) => a.code === "4016") ||
    accounts.find((a) => a.name?.toLowerCase().includes("gain/loss on asset disposal")) ||
    accounts.find((a) => a.code === "4010");

  const [form, setForm] = useState({
    category_code: "",
    category_name: "",
    depreciation_method: "STRAIGHT_LINE",
    depreciation_frequency: "YEARLY",
    default_useful_life_years: 5,
    default_depreciation_rate: 20,
    gl_asset_cost_account_id: "",
    gl_accum_depreciation_account_id: "",
    gl_depreciation_expense_account_id: "",
    gl_gain_loss_account_id: "",
    description: "",
  });

  useEffect(() => {
    fetchCategories();
    fetchAccounts();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get("/assets/categories");
      setCategories(res.data?.data || res.data?.items || []);
    } catch {
      toast.error("Failed to load asset categories");
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await api.get("/finance/accounts", { params: { active: 1 } });
      const items = res.data?.items || res.data?.data?.items || [];
      setAccounts(items);
    } catch (err) {
      console.warn("Could not load chart of accounts:", err);
    }
  };

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setForm({
      category_code: "",
      category_name: "",
      depreciation_method: "STRAIGHT_LINE",
      depreciation_frequency: "YEARLY",
      default_useful_life_years: 5,
      default_depreciation_rate: 20,
      gl_asset_cost_account_id: defaultCostAccount ? String(defaultCostAccount.id) : "",
      gl_accum_depreciation_account_id: defaultAccumAccount ? String(defaultAccumAccount.id) : "",
      gl_depreciation_expense_account_id: defaultExpenseAccount ? String(defaultExpenseAccount.id) : "",
      gl_gain_loss_account_id: defaultGainLossAccount ? String(defaultGainLossAccount.id) : "",
      description: "",
    });
    setShowModal(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setForm({
      category_code: cat.category_code || "",
      category_name: cat.category_name || "",
      depreciation_method: cat.depreciation_method || "STRAIGHT_LINE",
      depreciation_frequency: cat.depreciation_frequency || "YEARLY",
      default_useful_life_years: cat.useful_life_years ?? cat.default_useful_life_years ?? 5,
      default_depreciation_rate: cat.depreciation_rate_pct ?? cat.default_depreciation_rate ?? 20,
      gl_asset_cost_account_id: cat.asset_cost_account_id || cat.gl_asset_cost_account_id ? String(cat.asset_cost_account_id || cat.gl_asset_cost_account_id) : (defaultCostAccount ? String(defaultCostAccount.id) : ""),
      gl_accum_depreciation_account_id: cat.accum_depreciation_account_id || cat.gl_accum_depreciation_account_id ? String(cat.accum_depreciation_account_id || cat.gl_accum_depreciation_account_id) : (defaultAccumAccount ? String(defaultAccumAccount.id) : ""),
      gl_depreciation_expense_account_id: cat.depreciation_expense_account_id || cat.gl_depreciation_expense_account_id ? String(cat.depreciation_expense_account_id || cat.gl_depreciation_expense_account_id) : (defaultExpenseAccount ? String(defaultExpenseAccount.id) : ""),
      gl_gain_loss_account_id: cat.gain_loss_account_id || cat.gl_gain_loss_account_id ? String(cat.gain_loss_account_id || cat.gl_gain_loss_account_id) : (defaultGainLossAccount ? String(defaultGainLossAccount.id) : ""),
      description: cat.description || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category_name.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        useful_life_years: Number(form.default_useful_life_years),
        depreciation_rate_pct: Number(form.default_depreciation_rate),
        asset_cost_account_id: form.gl_asset_cost_account_id ? Number(form.gl_asset_cost_account_id) : null,
        accum_depreciation_account_id: form.gl_accum_depreciation_account_id ? Number(form.gl_accum_depreciation_account_id) : null,
        depreciation_expense_account_id: form.gl_depreciation_expense_account_id ? Number(form.gl_depreciation_expense_account_id) : null,
        gain_loss_account_id: form.gl_gain_loss_account_id ? Number(form.gl_gain_loss_account_id) : null,
      };

      if (editingCategory) {
        await api.put(`/assets/categories/${editingCategory.id}`, payload);
        toast.success("Category updated successfully");
      } else {
        await api.post("/assets/categories", payload);
        toast.success("Category created successfully");
      }
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const renderAccountOptions = (primaryNature = null) => {
    const sorted = [...accounts].sort((a, b) =>
      String(a.code || "").localeCompare(String(b.code || ""), undefined, { numeric: true })
    );

    const primaryAccounts = primaryNature
      ? sorted.filter((a) => a.nature === primaryNature)
      : [];
    const otherAccounts = primaryNature
      ? sorted.filter((a) => a.nature !== primaryNature)
      : sorted;

    const groupTitle =
      primaryNature === "ASSET" ? "Asset Accounts" : primaryNature === "EXPENSE" ? "Expense Accounts" : "Income Accounts";

    return (
      <>
        <option value="">Select Account...</option>
        {primaryAccounts.length > 0 && (
          <optgroup label={groupTitle}>
            {primaryAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="All Accounts">
          {otherAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} - {a.name}
            </option>
          ))}
        </optgroup>
      </>
    );
  };

  const filteredCategories = categories.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.category_name && c.category_name.toLowerCase().includes(term)) ||
      (c.category_code && c.category_code.toLowerCase().includes(term)) ||
      (c.cost_account_name && c.cost_account_name.toLowerCase().includes(term)) ||
      (c.expense_account_name && c.expense_account_name.toLowerCase().includes(term)) ||
      (c.description && c.description.toLowerCase().includes(term)) ||
      (c.depreciation_method && c.depreciation_method.toLowerCase().includes(term))
    );
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
              <Layers className="w-6 h-6 text-brand-600 dark:text-brand-400" />
              Asset Categories & Depreciation Rules
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Configure asset classes, default depreciation methods, useful life, and statutory GL accounts.
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenCreate}
          className="btn btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all"
        >
          <Plus size={16} /> New Category
        </button>
      </div>

      {/* Search and ViewToggle Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            className="input w-full pl-9 text-sm"
            placeholder="Search by category name, code, description, method..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:inline">
            {filteredCategories.length} {filteredCategories.length === 1 ? "category" : "categories"}
          </span>
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
      </div>

      {/* Main Content Area: Loading / Empty / Table / Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading asset categories...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            {searchTerm ? "No matching categories found" : "No categories found"}
          </h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1 mb-4">
            {searchTerm
              ? "Try adjusting your search term."
              : "Create an asset category (e.g. Plant & Machinery, Computer Equipment) to define depreciation rates."}
          </p>
          {!searchTerm && (
            <button
              onClick={handleOpenCreate}
              className="btn btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            >
              <Plus size={16} /> Add First Category
            </button>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* List / Table View */
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Depreciation Method</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Useful Life</th>
                  <th className="py-3 px-4">Annual Rate</th>
                  <th className="py-3 px-4">GL Asset Cost A/C</th>
                  <th className="py-3 px-4">GL Deprec. Exp A/C</th>
                  <th className="py-3 px-4">GL Accum. Dep A/C</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 text-sm">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-750 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {cat.category_name}
                      {cat.description && (
                        <div className="text-xs font-normal text-slate-400 mt-0.5 truncate max-w-xs">
                          {cat.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                        {cat.depreciation_method?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {cat.depreciation_frequency ? cat.depreciation_frequency.replace(/_/g, " ") : "YEARLY"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono font-medium">
                      {cat.default_useful_life_years ?? cat.useful_life_years} Yrs
                    </td>
                    <td className="py-3 px-4 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {cat.default_depreciation_rate ?? cat.depreciation_rate_pct}% / yr
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                      <div className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                        {cat.cost_account_code || "1030"}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[140px]" title={cat.cost_account_name}>
                        {cat.cost_account_name || "Land and Buildings"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                      <div className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                        {cat.expense_account_code || "5024"}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[140px]" title={cat.expense_account_name}>
                        {cat.expense_account_name || "Depreciation Expense"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                      <div className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                        {cat.accum_account_code || "1099"}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[140px]" title={cat.accum_account_name}>
                        {cat.accum_account_name || "Accumulated Depreciation"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        className="btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1.5"
                        title="Edit Category & GL Accounts"
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-brand-500/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {cat.depreciation_frequency ? cat.depreciation_frequency.replace(/_/g, " ") : "YEARLY"}
                  </span>
                  <button
                    onClick={() => handleOpenEdit(cat)}
                    className="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Edit Category & GL Accounts"
                  >
                    <Edit3 size={15} />
                  </button>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2">
                  {cat.category_name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {cat.description || "Fixed asset classification and financial amortization policy."}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>Depreciation Method:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-200">
                      {cat.depreciation_method?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>Useful Life:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-200">
                      {cat.default_useful_life_years ?? cat.useful_life_years} Years
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>Annual Rate:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {cat.default_depreciation_rate ?? cat.depreciation_rate_pct}% / year
                    </span>
                  </div>
                </div>
              </div>

              {/* GL Accounts Section in Card */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span>GL Cost A/C:</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate max-w-[170px]" title={cat.cost_account_name}>
                    {cat.cost_account_code ? `${cat.cost_account_code} - ${cat.cost_account_name}` : "1030 (Auto)"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>GL Exp A/C:</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate max-w-[170px]" title={cat.expense_account_name}>
                    {cat.expense_account_code ? `${cat.expense_account_code} - ${cat.expense_account_name}` : "5024 (Auto)"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Accum Dep A/C:</span>
                  <span className="font-mono truncate max-w-[170px]" title={cat.accum_account_name}>
                    {cat.accum_account_code ? `${cat.accum_account_code} - ${cat.accum_account_name}` : "1099 (Auto)"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  {editingCategory ? "Edit Asset Category & GL Mapping" : "New Asset Category"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set depreciation parameters and statutory General Ledger mapping.
                </p>
              </div>
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
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.category_name}
                  onChange={(e) => setForm({ ...form, category_name: e.target.value })}
                  placeholder="e.g. Computer Equipment, Motor Vehicles, Plant & Machinery"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Depreciation Method
                  </label>
                  <select
                    value={form.depreciation_method}
                    onChange={(e) => setForm({ ...form, depreciation_method: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="STRAIGHT_LINE">Straight-Line</option>
                    <option value="REDUCING_BALANCE">Reducing Balance</option>
                    <option value="DOUBLE_DECLINING">Double Declining Balance</option>
                    <option value="NONE">No Depreciation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Calculation Frequency
                  </label>
                  <select
                    value={form.depreciation_frequency}
                    onChange={(e) => setForm({ ...form, depreciation_frequency: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="YEARLY">Yearly (Full Annual Rate)</option>
                    <option value="HALF_YEARLY">Half-Yearly (Every 6 Months)</option>
                    <option value="QUARTERLY">Quarterly (Every 3 Months)</option>
                    <option value="MONTHLY">Monthly (1/12th Pro-rata Rate)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Default Useful Life (Years)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={form.default_useful_life_years}
                    onChange={(e) => setForm({ ...form, default_useful_life_years: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Depreciation Rate (% / year)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.default_depreciation_rate}
                    onChange={(e) => setForm({ ...form, default_depreciation_rate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* General Ledger Accounts (Clean & Simple) */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    General Ledger Accounts
                  </span>
                  <span className="text-[11px] text-slate-400">Defaults pre-selected</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Asset Cost Account
                    </label>
                    <select
                      value={form.gl_asset_cost_account_id}
                      onChange={(e) => setForm({ ...form, gl_asset_cost_account_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {renderAccountOptions("ASSET")}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Accumulated Depreciation
                    </label>
                    <select
                      value={form.gl_accum_depreciation_account_id}
                      onChange={(e) => setForm({ ...form, gl_accum_depreciation_account_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {renderAccountOptions("ASSET")}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Depreciation Expense
                    </label>
                    <select
                      value={form.gl_depreciation_expense_account_id}
                      onChange={(e) => setForm({ ...form, gl_depreciation_expense_account_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {renderAccountOptions("EXPENSE")}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Gain / Loss on Disposal
                    </label>
                    <select
                      value={form.gl_gain_loss_account_id}
                      onChange={(e) => setForm({ ...form, gl_gain_loss_account_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {renderAccountOptions("INCOME")}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Amortization Policy Notes
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional policy description or statutory depreciation notes..."
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
                  <Save size={15} />
                  {saving ? "Saving..." : editingCategory ? "Update Category & GL" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
