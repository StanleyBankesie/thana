/**
 * @file CostControlDashboard.jsx
 * @description Enterprise Project Cost Control & Budget Management Dashboard.
 * Integrates Project Management, Procurement, Inventory, Finance, and HR/Payroll:
 * - Budget preparation: Original and approved revised budgets, BOQ estimates.
 * - Cost tracking: Actual costs from supplier invoices, purchase orders, inventory issues, payroll, and subcontractors.
 * - Budget vs Actual analysis: Cost variance (Budget - Actual), variance %, and utilization.
 * - Commitments tracking: Outstanding purchase orders and contract commitments tracked separately.
 * - Forecasting: Forecast final cost at completion and projected overruns.
 * - Category breakdown: Materials, Labour, Equipment, Subcontracting, Transportation, Other.
 * - Proactive alerts for threshold breaches and overruns.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  PieChart,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
  FileText,
  Activity,
  RefreshCw,
  Layers,
  ShieldAlert,
  Info,
  Package,
  Users,
  Wrench,
  HardHat,
  Truck,
  FileSpreadsheet,
  ShoppingBag,
  Boxes,
  FileCheck,
  Printer,
  ChevronRight,
  Sliders
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function CostControlDashboard() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load Projects on mount (Do NOT auto-select by default)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
      } catch (e) {
        toast.error("Failed to load projects");
      }
    })();
  }, []);

  // Fetch cost control summary when a project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setData(null);
      return;
    }
    fetchCostControlData();
  }, [selectedProjectId]);

  const fetchCostControlData = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await api.get(`/construction/cost-control/${selectedProjectId}`);
      setData(res.data || null);
    } catch (e) {
      toast.error("Failed to load cost control summary");
    } finally {
      setLoading(false);
    }
  };
  const fetchEVMData = fetchCostControlData;

  const cs = data?.cost_summary || {};
  const proj = data?.project || {};
  const activeBOQ = data?.activeBOQ || null;
  const budgetLines = data?.budgetLines || [];
  const purchaseOrders = data?.purchaseOrders || [];
  const currency = cs.currency || "GH₵";
  const categories = cs.category_breakdown || [];
  const alerts = cs.alerts || [];

  const cpi = Number(cs.cpi || 1.0);
  const spi = Number(cs.spi || 1.0);
  const cv = Number(cs.cost_variance || 0);
  const approvedBudget = Number(cs.approved_budget || 0);
  const actualCost = Number(cs.actual_cost || 0);
  const committedCost = Number(cs.committed_cost || 0);
  const remainingBudget = Number(cs.remaining_budget || 0);
  const availableBudget = Number(cs.available_budget || 0);
  const forecastFinalCost = Number(cs.forecast_final_cost || 0);
  const projectedOverrun = Number(cs.projected_overrun || 0);
  const budgetUtilization = Number(cs.budget_utilization_percent || 0);
  const totalUtilization = Number(cs.total_utilization_with_commitments || 0);

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case "MATERIALS":
        return <Package size={15} className="text-blue-500" />;
      case "LABOUR":
        return <Users size={15} className="text-amber-500" />;
      case "EQUIPMENT":
        return <Wrench size={15} className="text-purple-500" />;
      case "SUBCONTRACTING":
        return <HardHat size={15} className="text-emerald-500" />;
      case "TRANSPORTATION":
        return <Truck size={15} className="text-cyan-500" />;
      default:
        return <DollarSign size={15} className="text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:max-w-none">
      {/* Canonical Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
              <TrendingUp size={26} className="text-brand-600 dark:text-brand-400" />
              Project Cost Control & Budget Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Budget vs Actual expenditure, purchase commitments, variances, forecasting, and cross-module control
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Project Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Project:</span>
            <select
              className="input text-sm py-1.5 h-auto min-w-[220px]"
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
            >
              <option value="">-- Select a Project --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.project_code} - {p.project_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchCostControlData}
            disabled={!selectedProjectId}
            className="p-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 transition"
            title="Refresh Cost Control"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>

          {selectedProjectId && (
            <>
              <button
                onClick={() => window.print()}
                className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
                title="Print Cost Control Report"
              >
                <Printer size={15} /> Print Summary
              </button>
              <Link
                to={`/finance/reports/budget-vs-actual?project_id=${selectedProjectId}`}
                className="btn btn-outline inline-flex items-center gap-1.5 text-sm"
                title="View in Finance General Ledger"
              >
                <FileText size={15} /> Finance GL Budget
              </Link>
            </>
          )}
        </div>
      </div>

      {/* STATE 1: No Project Selected */}
      {!selectedProjectId ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto">
            <TrendingUp size={34} />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Please Select a Project</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Select a project from the dropdown above to view real-time cost control, budget variance analysis, purchase commitments, category breakdowns, and completion forecasting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
                <FileSpreadsheet size={15} /> 1. Budget Baseline
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Establish approved budgets from the BOQ, labour estimates, and procurement targets.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Activity size={15} /> 2. Cost Tracking
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Record actuals from invoices, inventory issues, payroll, and subcontractors.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <ShoppingBag size={15} /> 3. Commitments
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Track purchase orders separately from incurred costs to prevent misleading reports.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <Sliders size={15} /> 4. Forecast & Control
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Predict final costs, identify cost overruns, and take corrective action early.
              </p>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center space-y-4">
          <RefreshCw size={32} className="animate-spin text-brand-600 mx-auto" />
          <p className="text-xs font-bold text-slate-500">Calculating cost control metrics and cross-module actuals...</p>
        </div>
      ) : (
        <>
          {/* Active Threshold Alerts Banner */}
          {alerts && alerts.length > 0 && (
            <div className="space-y-2.5 print:hidden">
              {alerts.map((alt, idx) => {
                const isCritical = alt.type === "CRITICAL";
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border flex items-start gap-3.5 shadow-sm transition-all ${
                      isCritical
                        ? "bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200"
                        : "bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isCritical ? "bg-rose-100 text-rose-600 dark:bg-rose-900/50" : "bg-amber-100 text-amber-600 dark:bg-amber-900/50"
                      }`}
                    >
                      {isCritical ? <ShieldAlert size={20} /> : <AlertTriangle size={20} />}
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider">{alt.title}</h4>
                      <p className="text-xs leading-relaxed opacity-90">{alt.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Project Details & Commercial Baseline Banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                      {proj.project_code || "PRJ"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {proj.completion_percent || 0}% Completed
                    </span>
                    {activeBOQ && (
                      <span className="text-xs text-brand-600 dark:text-brand-400 font-mono font-semibold flex items-center gap-1">
                        <FileSpreadsheet size={13} /> {activeBOQ.boq_reference || "Active BOQ"} (v{activeBOQ.version || "1.0"})
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {proj.project_name} <span className="text-slate-400 font-normal text-sm">— Cost Control & Financial Health</span>
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1 text-xs">
                    <div>
                      <span className="text-slate-400 block font-medium">Client / Employer:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{proj.client_name || activeBOQ?.client_name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Project Duration:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {proj.start_date ? String(proj.start_date).split("T")[0] : "—"} to {proj.end_date ? String(proj.end_date).split("T")[0] : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">BOQ Baseline Estimate:</span>
                      <span className="font-bold font-mono text-brand-600 dark:text-brand-400">
                        {currency} {Number(cs.boq_estimated_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Commercial Margin Target:</span>
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {currency} {(Number(cs.revised_contract_sum || 0) - approvedBudget).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Link to BOQ */}
                <div className="shrink-0 flex items-center gap-2 print:hidden">
                  <Link
                    to={`/project-management/construction/boq`}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5 transition shadow-sm"
                  >
                    <FileSpreadsheet size={15} className="text-brand-600" /> Manage BOQ
                  </Link>
                </div>
              </div>
            </div>

            {/* Commercial Contract Sum Reconciliation Row */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900 text-xs">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Original Contract Sum</span>
                <p className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                  {currency} {Number(cs.original_contract_sum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Approved Revised Sum</span>
                <p className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                  {currency} {Number(cs.revised_contract_sum || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">Approved Budget (BAC)</span>
                <p className="font-mono font-bold text-sm text-brand-600 dark:text-brand-400">
                  {currency} {approvedBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Purchase Commitments (PO)</span>
                <p className="font-mono font-bold text-sm text-purple-600 dark:text-purple-400">
                  {currency} {committedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Primary 6 Cost Control Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* 1. Approved Budget */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Approved Budget</span>
                <DollarSign size={18} className="text-blue-500" />
              </div>
              <p className="text-xl font-black font-mono text-slate-900 dark:text-white">
                {currency} {approvedBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-500">Total authorized baseline spending</p>
            </div>

            {/* 2. Actual Cost Incurred */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Actual Cost (AC)</span>
                <Activity size={18} className="text-rose-500" />
              </div>
              <p className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
                {currency} {actualCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-500">Expenses + Labour + Subcontracts + Materials</p>
            </div>

            {/* 3. Committed Costs */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Committed (POs)</span>
                <ShoppingBag size={18} className="text-blue-600" />
              </div>
              <p className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
                {currency} {committedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-500">{purchaseOrders.length} Open purchase commitment(s)</p>
            </div>

            {/* 4. Remaining Budget */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Remaining Budget</span>
                <Clock size={18} className={remainingBudget >= 0 ? "text-emerald-500" : "text-rose-500"} />
              </div>
              <p className={`text-xl font-black font-mono ${remainingBudget >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {currency} {remainingBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-500">Approved Budget − Actual Cost</p>
            </div>

            {/* 5. Available after Commitments */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Available Budget</span>
                <CheckCircle size={18} className={availableBudget >= 0 ? "text-emerald-500" : "text-rose-500"} />
              </div>
              <p className={`text-xl font-black font-mono ${availableBudget >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {currency} {availableBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-500">Remaining − Committed POs</p>
            </div>

            {/* 6. Forecast Final Cost */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Forecast Final Cost</span>
                <TrendingUp size={18} className="text-purple-500" />
              </div>
              <p className="text-xl font-black font-mono text-purple-600 dark:text-purple-400">
                {currency} {forecastFinalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] font-semibold text-slate-500">
                {projectedOverrun > 0 ? (
                  <span className="text-rose-600 font-bold">Overrun: +{currency} {projectedOverrun.toLocaleString()}</span>
                ) : (
                  <span className="text-emerald-600 font-bold">On target at completion</span>
                )}
              </p>
            </div>
          </div>

          {/* Budget Performance, Utilization Progress Bar & Contingency */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Progress Bar & Variance Summary */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity size={18} className="text-brand-600" /> Budget Utilization & Expenditure Progress
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Percentage of authorized budget consumed by actual spending and purchase commitments
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-base font-black font-mono ${budgetUtilization > 100 ? "text-rose-600" : budgetUtilization >= 80 ? "text-amber-600" : "text-emerald-600"}`}>
                    {budgetUtilization.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-400 block font-medium">Actual Spent</span>
                </div>
              </div>

              {/* Stacked Multi-Segment Progress Bar */}
              <div className="space-y-2">
                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                  {/* Actual Cost Bar */}
                  <div
                    style={{ width: `${Math.min(100, budgetUtilization)}%` }}
                    className={`h-full transition-all duration-500 ${
                      budgetUtilization > 100 ? "bg-rose-500" : budgetUtilization >= 80 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    title={`Actual Cost Incurred: ${budgetUtilization.toFixed(1)}%`}
                  />
                  {/* Committed Cost Bar */}
                  <div
                    style={{
                      width: `${Math.min(
                        Math.max(0, 100 - budgetUtilization),
                        approvedBudget > 0 ? (committedCost / approvedBudget) * 100 : 0
                      )}%`
                    }}
                    className="h-full bg-blue-500 transition-all duration-500"
                    title={`Committed POs: ${approvedBudget > 0 ? ((committedCost / approvedBudget) * 100).toFixed(1) : 0}%`}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span className={`w-3 h-3 rounded-full ${budgetUtilization > 100 ? "bg-rose-500" : "bg-emerald-500"}`} />
                      Actual Spent ({budgetUtilization.toFixed(1)}%)
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span className="w-3 h-3 rounded-full bg-blue-500" />
                      Committed POs ({approvedBudget > 0 ? ((committedCost / approvedBudget) * 100).toFixed(1) : 0}%)
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700" />
                      Available ({Math.max(0, 100 - totalUtilization).toFixed(1)}%)
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    Total Committed & Spent: {totalUtilization.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Calculations Explanation Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
                {/* Cost Variance (Budget - Actual) */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Cost Variance (Budget − Actual)</span>
                  <p className={`text-base font-black font-mono ${cv >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {cv >= 0 ? "+" : ""}{currency} {cv.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {cv >= 0 ? "Under budget (Positive savings)" : "Over budget (Expenditure overrun)"}
                  </p>
                </div>

                {/* Cost Variance % */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Cost Variance %</span>
                  <p className={`text-base font-black font-mono ${Number(cs.cost_variance_percent || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {Number(cs.cost_variance_percent || 0) >= 0 ? "+" : ""}{Number(cs.cost_variance_percent || 0).toFixed(2)}%
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    (Budget − Actual) ÷ Budget × 100
                  </p>
                </div>

                {/* Cost Performance Index (CPI) */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Cost Performance Index (CPI)</span>
                  <p className={`text-base font-black font-mono ${cpi >= 1.0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {cpi.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {cpi >= 1.0 ? "Favorable cost efficiency" : "Unfavorable cost efficiency"}
                  </p>
                </div>
              </div>
            </div>

            {/* Contingency Status Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <ShieldAlert size={18} className="text-brand-600" /> Contingency Fund Status
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Contingency funds are reserved to manage unforeseen site conditions, approved variations, and market fluctuations without compromising project delivery.
              </p>

              <div className="space-y-3 pt-1 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 font-medium">Allocated in BOQ ({activeBOQ?.contingency_percent || 5}%):</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {currency} {Number(cs.contingency_allocated || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 font-medium">Contingency Absorbed / Used:</span>
                  <span className="font-mono font-bold text-rose-600">
                    {currency} {Number(cs.contingency_used || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">Remaining Contingency:</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    {currency} {Number(cs.contingency_remaining || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {Number(cs.contingency_remaining || 0) <= 0 && Number(cs.contingency_allocated || 0) > 0 && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] leading-relaxed">
                  Contingency reserve fully consumed. Any further expenditure requires formal approval workflow and revised budget authorization.
                </div>
              )}
            </div>
          </div>

          {/* Cost Item & Category Breakdown Table (Matching User's Dustbins, Labour, Transportation Example) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <PieChart size={18} className="text-brand-600" /> Cost Item & Category Variance Analysis
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparison of planned expenditure vs actual costs across standard ERP cost categories
                </p>
              </div>
              <span className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
                {categories.length} Tracked Categories
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3.5">Cost Item / Category</th>
                    <th className="p-3.5 text-right">Budget ({currency})</th>
                    <th className="p-3.5 text-right">Actual Cost ({currency})</th>
                    <th className="p-3.5 text-right">Variance ({currency})</th>
                    <th className="p-3.5 text-right">Variance %</th>
                    <th className="p-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {categories.map((c, idx) => {
                    const isOverrun = c.status === "OVERRUN";
                    const isWarning = c.status === "WARNING";
                    const isUnbudgeted = c.status === "UNBUDGETED";

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3.5 flex items-center gap-2.5">
                          {getCategoryIcon(c.category)}
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">{c.label}</span>
                            <span className="text-[10px] text-slate-400 font-mono uppercase">{c.category}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          {Number(c.budget || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {Number(c.actual || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`p-3.5 text-right font-mono font-bold ${c.variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {c.variance >= 0 ? "+" : ""}{Number(c.variance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`p-3.5 text-right font-mono font-semibold ${c.variance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {c.budget > 0 ? `${c.variance >= 0 ? "+" : ""}${c.variance_percent.toFixed(1)}%` : "—"}
                        </td>
                        <td className="p-3.5 text-center">
                          {isOverrun ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                              Overrun (+{currency} {c.overrun.toLocaleString()})
                            </span>
                          ) : isWarning ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                              High Utilization ({c.utilization_percent}%)
                            </span>
                          ) : isUnbudgeted ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-200 dark:border-orange-900">
                              Unbudgeted Direct Cost
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                              Under Budget
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-white dark:bg-slate-900 font-black border-t-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                  <tr>
                    <td className="p-3.5 uppercase tracking-wider">Total</td>
                    <td className="p-3.5 text-right font-mono">
                      {approvedBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-right font-mono text-rose-600 dark:text-rose-400">
                      {actualCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`p-3.5 text-right font-mono ${cv >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {cv >= 0 ? "+" : ""}{cv.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`p-3.5 text-right font-mono ${Number(cs.cost_variance_percent || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {Number(cs.cost_variance_percent || 0) >= 0 ? "+" : ""}{Number(cs.cost_variance_percent || 0).toFixed(2)}%
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${actualCost > approvedBudget ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {actualCost > approvedBudget ? "OVER BUDGET" : "HEALTHY"}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* OmniSuite ERP Cross-Module Financial Integration Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-5">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Layers size={18} className="text-brand-600" /> OmniSuite ERP Cross-Module Integration Breakdown
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time expenditure inputs consolidated automatically from other core enterprise modules
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 text-xs">
              {/* 1. Project Management (BOQ) */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 flex items-center gap-1.5">
                    <FileSpreadsheet size={14} /> Project BOQ Baseline
                  </span>
                </div>
                <p className="text-base font-bold font-mono text-slate-800 dark:text-slate-100">
                  {currency} {Number(cs.boq_estimated_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-slate-500">Bill of quantities line item estimates</p>
              </div>

              {/* 2. Procurement (Commitments) */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <ShoppingBag size={14} /> Purchase Commitments
                  </span>
                </div>
                <p className="text-base font-bold font-mono text-blue-600">
                  {currency} {committedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-slate-500">Committed project purchase orders</p>
              </div>

              {/* 3. Inventory (Materials Consumed) */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                    <Boxes size={14} /> Materials Consumed
                  </span>
                </div>
                <p className="text-base font-bold font-mono text-emerald-600">
                  {currency} {Number(cs.materials_consumed || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-slate-500">Physical stock issues & requisitions</p>
              </div>

              {/* 4. HR & Payroll (Labour) */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                    <Users size={14} /> Project Labour Costs
                  </span>
                </div>
                <p className="text-base font-bold font-mono text-amber-600">
                  {currency} {Number(cs.labour_costs || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-slate-500">Timesheets & verified labor hours</p>
              </div>

              {/* 5. Finance & Invoices (Direct Expenses) */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
                    <FileText size={14} /> Finance Direct Expenses
                  </span>
                </div>
                <p className="text-base font-bold font-mono text-purple-600">
                  {currency} {Number(cs.direct_expenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-slate-500">Expense vouchers & supplier bills</p>
              </div>
            </div>
          </div>

          {/* Purchase Commitments Register Table */}
          {purchaseOrders && purchaseOrders.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag size={16} className="text-blue-600" /> Outstanding Purchase Orders & Commitments Register
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Contractual commitments in Procurement awaiting goods delivery or final invoice settlement
                  </p>
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/40 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800">
                  {currency} {committedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} Total Committed
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">PO Number</th>
                      <th className="p-3">Order Date</th>
                      <th className="p-3">Remarks / Scope</th>
                      <th className="p-3 text-right">Commitment Amount ({currency})</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold text-brand-600">{po.order_no}</td>
                        <td className="p-3 font-mono text-slate-500">{po.order_date ? String(po.order_date).split("T")[0] : "—"}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{po.remarks || "Project Procurement Order"}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {Number(po.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {po.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reference Guide: Cost Control vs Cost Estimation */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Info size={16} className="text-brand-600" /> Project Management Knowledge: Cost Control vs Cost Estimation
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="font-bold text-brand-600 dark:text-brand-400 block text-xs">1. Cost Estimation</span>
                <p className="text-slate-500 leading-relaxed text-[11px]">
                  Predicts how much the project will cost before or during tender/planning phases using historical rates and quantity takeoff.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="font-bold text-blue-600 dark:text-blue-400 block text-xs">2. Cost Budgeting</span>
                <p className="text-slate-500 leading-relaxed text-[11px]">
                  Allocates the estimated costs into an approved, time-phased project baseline and cost codes for execution.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-xs">3. Cost Control</span>
                <p className="text-slate-500 leading-relaxed text-[11px]">
                  Monitors real-time expenditure against the approved budget, tracks open purchase commitments, flags variances, and enforces corrective action.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
