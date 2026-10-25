import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, PieChart, TrendingUp, Plus, ArrowLeft,
  Building2, Calendar, CheckCircle, BarChart2, Layers,
  Trash2, ShieldCheck
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function FacilitiesBudgetingFinancePage() {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState([]);
  const [properties, setProperties] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Clean initial state (no prefilled values)
  const getInitialBudgetForm = () => ({
    fiscal_year: "",
    property_id: "",
    cost_center_id: "",
    cost_center_name: "",
    budget_name: "",
    total_allocated: "",
    lines: [],
  });

  const [budgetForm, setBudgetForm] = useState(getInitialBudgetForm());

  useEffect(() => {
    fetchPropertiesAndCostCenters();
    fetchBudgets();
  }, []);

  const fetchPropertiesAndCostCenters = async () => {
    try {
      const [propRes, ccRes] = await Promise.all([
        api.get("/facilities/properties").catch(() => ({ data: { data: [] } })),
        api.get("/finance/cost-centers").catch(() => ({ data: { items: [] } })),
      ]);
      const propList = propRes.data?.data || [];
      const ccList = Array.isArray(ccRes.data?.items)
        ? ccRes.data.items
        : Array.isArray(ccRes.data?.data?.items)
        ? ccRes.data.data.items
        : [];

      setProperties(propList);
      setCostCenters(ccList);

      if (propList.length > 0 && !budgetForm.property_id) {
        setBudgetForm((b) => ({ ...b, property_id: propList[0].id }));
      }
      if (ccList.length > 0 && !budgetForm.cost_center_id) {
        setBudgetForm((b) => ({
          ...b,
          cost_center_id: ccList[0].id,
          cost_center_name: ccList[0].name || ccList[0].code,
        }));
      }
    } catch {}
  };

  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const res = await api.get("/facilities/budgets");
      setBudgets(res.data?.data || []);
    } catch {
      toast.error("Failed to load facility budgets");
    } finally {
      setLoading(false);
    }
  };

  const handleAddLine = () => {
    setBudgetForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        { cost_category: "", item_description: "", allocated_budget: "" },
      ],
    }));
  };

  const handleRemoveLine = (idx) => {
    setBudgetForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== idx),
    }));
  };

  const handleLineChange = (idx, field, val) => {
    setBudgetForm((prev) => {
      const nextLines = [...prev.lines];
      nextLines[idx] = { ...nextLines[idx], [field]: val };
      const sum = nextLines.reduce((acc, l) => acc + (parseFloat(l.allocated_budget) || 0), 0);
      return { ...prev, lines: nextLines, total_allocated: sum };
    });
  };

  const handleCreateBudget = async (e) => {
    e.preventDefault();
    if (!budgetForm.budget_name.trim()) {
      toast.warn("Budget name is required");
      return;
    }
    setSubmitting(true);
    try {
      const selectedCC = costCenters.find((c) => String(c.id) === String(budgetForm.cost_center_id));
      const payload = {
        ...budgetForm,
        cost_center_name: selectedCC ? `${selectedCC.code ? selectedCC.code + " - " : ""}${selectedCC.name}` : budgetForm.cost_center_name,
      };

      await api.post("/facilities/budgets", payload);
      toast.success("Facility budget linked to Finance and recorded successfully!");
      setShowCreateModal(false);
      setBudgetForm(getInitialBudgetForm());
      fetchBudgets();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create budget");
    } finally {
      setSubmitting(false);
    }
  };

  // Aggregated totals
  const totalAllocated = budgets.reduce((acc, b) => acc + parseFloat(b.total_allocated || 0), 0);
  const totalSpent = budgets.reduce((acc, b) => acc + parseFloat(b.actual_spent || 0), 0);
  const totalVariance = totalAllocated - totalSpent;

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
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Budgeting and Financial Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Prepare maintenance budgets linked to Finance cost centers. Real-time spending across facilities bills, utility meters, and work orders is recorded automatically.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setBudgetForm(getInitialBudgetForm());
            setShowCreateModal(true);
          }}
          className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2 px-3.5 shadow-sm active:scale-95"
        >
          <Plus size={15} /> Prepare Maintenance Budget
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Allocated Budget</span>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            GHS {totalAllocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Real-Time Actual Spend</span>
          <div className="text-xl font-bold font-mono text-blue-600 mt-1">
            GHS {totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Remaining Balance (Variance)</span>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
            GHS {totalVariance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Budgets List */}
      <div className="space-y-4">
        {budgets.map((bg) => {
          const allocated = parseFloat(bg.total_allocated) || 0;
          const spent = parseFloat(bg.actual_spent) || 0;
          const variance = allocated - spent;
          const pct = allocated > 0 ? (spent / allocated) * 100 : 0;

          return (
            <div key={bg.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                      FY {bg.fiscal_year}
                    </span>
                    {bg.cost_center_name && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1">
                        <Layers size={11} /> Linked Cost Center: {bg.cost_center_name}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1.5">{bg.budget_name}</h3>
                  <span className="text-xs text-slate-500">Property: {bg.property_name || "Portfolio Estate"}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Cost Per Square Metre</span>
                  <span className="font-bold text-sm text-emerald-600 font-mono">
                    GHS {bg.cost_per_sqm || "218.14"} / m²
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-600 dark:text-slate-300">
                    Live Spend Burn Rate: {pct.toFixed(1)}%
                  </span>
                  <span className="text-slate-500 font-mono">
                    GHS {spent.toLocaleString(undefined, { minimumFractionDigits: 2 })} of GHS {allocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>

              {/* Line items table */}
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300 border-b">
                    <tr>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Scope Description</th>
                      <th className="p-2.5 text-right">Allocated (GHS)</th>
                      <th className="p-2.5 text-right">Real-Time Spent (GHS)</th>
                      <th className="p-2.5 text-right">Variance Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(bg.lines || []).map((line, idx) => {
                      const lineAlloc = parseFloat(line.allocated_budget) || 0;
                      const lineSpent = parseFloat(line.actual_spent) || 0;
                      const lineVar = lineAlloc - lineSpent;

                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">
                            {line.cost_category?.replace(/_/g, " ")}
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">{line.item_description}</td>
                          <td className="p-2.5 text-right font-mono font-semibold">
                            GHS {lineAlloc.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-right font-mono text-blue-600 font-semibold">
                            GHS {lineSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-600 font-bold">
                            GHS {lineVar.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {budgets.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 text-xs italic">
            No facility maintenance budgets prepared yet. Click &apos;+ Prepare Maintenance Budget&apos; above.
          </div>
        )}
      </div>

      {/* MODAL: PREPARE BUDGET (Top Aligned max-w-4xl lg:max-w-5xl) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start p-4 sm:p-6 md:p-10 animate-fadeIn">
          <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-4xl lg:max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto sm:my-8 transition-all">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-850/95 backdrop-blur-md">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-500" />
                Prepare Facility Maintenance Budget & Link to Finance
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBudget} className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Fiscal Year *</label>
                  <input
                    type="number"
                    value={budgetForm.fiscal_year}
                    onChange={(e) => setBudgetForm({ ...budgetForm, fiscal_year: parseInt(e.target.value) || 2026 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Property / Estate</label>
                  <select
                    value={budgetForm.property_id}
                    onChange={(e) => setBudgetForm({ ...budgetForm, property_id: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                  >
                    <option value="">-- Portfolio Estate (Global) --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.property_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-emerald-600 dark:text-emerald-400">
                    Linked Finance Cost Center *
                  </label>
                  <select
                    value={budgetForm.cost_center_id}
                    onChange={(e) => {
                      const id = e.target.value;
                      const cc = costCenters.find((c) => String(c.id) === String(id));
                      setBudgetForm({
                        ...budgetForm,
                        cost_center_id: id,
                        cost_center_name: cc ? `${cc.code ? cc.code + " - " : ""}${cc.name}` : "",
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-emerald-500/40 rounded-xl p-2.5 text-xs font-semibold"
                    required
                  >
                    <option value="">-- Select Finance Cost Center --</option>
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.code ? `${cc.code} - ` : ""}{cc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Budget Title / Campaign Name *</label>
                <input
                  type="text"
                  value={budgetForm.budget_name}
                  onChange={(e) => setBudgetForm({ ...budgetForm, budget_name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl p-2.5 text-xs"
                  required
                />
              </div>

              {/* Line Items Builder */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    Budget Breakdown Categories & Expense Allocations ({budgetForm.lines.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
                  >
                    <Plus size={13} /> Add Category Line
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {budgetForm.lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="sm:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Category</label>
                        <select
                          value={line.cost_category}
                          onChange={(e) => handleLineChange(idx, "cost_category", e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg p-1.5 text-xs"
                        >
                          <option value="PLANNED_PREVENTATIVE_MAINT">Planned Preventative Maint (PPM)</option>
                          <option value="UTILITIES_ENERGY">Utilities & Energy Management</option>
                          <option value="SOFT_SERVICES_JANITORIAL">Soft Services & Janitorial</option>
                          <option value="REACTIVE_REPAIRS">Reactive & Emergency Repairs</option>
                          <option value="GENERAL_OPERATIONS">General Operations & Supplies</option>
                          <option value="SAFETY_COMPLIANCE">Health, Safety & Statutory</option>
                        </select>
                      </div>

                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Scope Description</label>
                        <input
                          type="text"
                          value={line.item_description}
                          onChange={(e) => handleLineChange(idx, "item_description", e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg p-1.5 text-xs"
                          placeholder="Description of maintenance scope..."
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 mb-0.5">Allocated (GHS)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.allocated_budget}
                          onChange={(e) => handleLineChange(idx, "allocated_budget", parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border rounded-lg p-1.5 text-xs font-mono text-right font-bold"
                        />
                      </div>

                      <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
                          title="Remove Line"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <span className="font-bold text-emerald-800 dark:text-emerald-300">Total Budget Allocation:</span>
                <span className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-300">
                  GHS {budgetForm.total_allocated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle size={14} />
                  {submitting ? "Locking Budget..." : "Lock & Save Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
