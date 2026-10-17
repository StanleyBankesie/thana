/**
 * @fileoverview BudgetDashboardPage component.
 * Executive Financial Budget vs. Actual Cost Performance Dashboard.
 * Displays all 8 core financial indicators, monthly expenditure trends, commitments,
 * forecast variances, and top budget overrun alerts.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  BarChart2,
  List,
  Plus,
  Briefcase,
  Layers,
  Settings,
  Calendar,
} from "lucide-react";

const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function BudgetDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  // Filter options
  const [fiscalYears, setFiscalYears] = useState([]);
  const [projects, setProjects] = useState([]);
  const [costCenters, setCostCenters] = useState([]);

  // Active filters
  const [selectedFy, setSelectedFy] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedCostCenter, setSelectedCostCenter] = useState("");

  const loadMetadata = async () => {
    try {
      const [fyRes, projRes, ccRes] = await Promise.allSettled([
        api.get("/finance/fiscal-years"),
        api.get("/projects"),
        api.get("/finance/cost-centers"),
      ]);

      if (fyRes.status === "fulfilled") {
        const list = fyRes.value.data?.items || [];
        setFiscalYears(list);
        if (!selectedFy && list.length > 0) {
          const openFy = list.find((fy) => fy.is_open) || list[0];
          setSelectedFy(String(openFy.id));
        }
      }
      if (projRes.status === "fulfilled") {
        setProjects(projRes.value.data?.projects || projRes.value.data?.data || []);
      }
      if (ccRes.status === "fulfilled") {
        setCostCenters(ccRes.value.data?.items || []);
      }
    } catch (e) {
      console.error("Failed to load metadata:", e);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const params = {
        fiscal_year_id: selectedFy || undefined,
        project_id: selectedProject || undefined,
        cost_center_id: selectedCostCenter || undefined,
      };
      const res = await api.get("/finance/budgets/dashboard/summary", { params });
      setData(res.data?.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load budget dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    if (selectedFy) {
      loadDashboardData();
    }
  }, [selectedFy, selectedProject, selectedCostCenter]);

  const kpis = data?.kpis || {};
  const monthlyTrends = data?.monthly_trends || [];
  const topOverruns = data?.top_overruns || [];

  // Determine max value for chart scaling
  const maxChartVal = Math.max(
    ...monthlyTrends.map((m) => Math.max(m.budget, m.actual_expense)),
    1000
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Canonical Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/finance" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-brand-900 dark:text-brand-400" /> Financial Budget vs. Actual Dashboard
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Real-time performance tracking comparing approved baselines, GAAP recognized actual costs, outstanding PO commitments, and forecast final costs.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/finance/budget"
            className="btn btn-outline inline-flex items-center gap-2"
          >
            <List size={16} /> Manage Budgets
          </Link>
          <Link
            to="/finance/reports/budget-vs-actual"
            className="btn btn-outline inline-flex items-center gap-2"
          >
            <BarChart2 size={16} /> Variance Report
          </Link>
          <button
            onClick={loadDashboardData}
            className="btn btn-secondary p-2"
            title="Refresh Dashboard"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-wrap items-center gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Fiscal Year</label>
          <select
            value={selectedFy}
            onChange={(e) => setSelectedFy(e.target.value)}
            className="select select-bordered select-sm w-44 font-medium"
          >
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.code} {fy.is_open ? "(Open)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Project</label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="select select-bordered select-sm w-56 font-medium"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_code} - {p.project_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Cost Center</label>
          <select
            value={selectedCostCenter}
            onChange={(e) => setSelectedCostCenter(e.target.value)}
            className="select select-bordered select-sm w-48 font-medium"
          >
            <option value="">All Cost Centers</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.code} - {cc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 8 Core Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Approved Budget */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">1. Approved Budget</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            GH₵{fmt(kpis.approved_budget)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Official authorized baseline limit</p>
        </div>

        {/* 2. Actual Cost recognized */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">2. Actual Cost</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            GH₵{fmt(kpis.actual_cost)}
          </div>
          <p className="text-xs text-gray-500 mt-1">GAAP posted voucher expenditure</p>
        </div>

        {/* 3. Budget Remaining */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">3. Budget Remaining</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-black ${kpis.budget_remaining >= 0 ? "text-gray-900 dark:text-white" : "text-red-600"}`}>
            GH₵{fmt(kpis.budget_remaining)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Approved Budget − Actual Cost</p>
        </div>

        {/* 4. Budget Utilization % */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">4. Utilization Rate</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {kpis.utilization_pct || 0}%
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full ${
                kpis.utilization_pct > 100
                  ? "bg-red-500"
                  : kpis.utilization_pct >= 85
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(kpis.utilization_pct || 0, 100)}%` }}
            />
          </div>
        </div>

        {/* 5. Committed Cost (Outstanding POs) */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">5. Committed Cost</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">
            GH₵{fmt(kpis.committed_cost)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Approved unbilled PO commitments</p>
        </div>

        {/* 6. Forecast Final Cost */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">6. Forecast Final Cost</span>
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-teal-700 dark:text-teal-400">
            GH₵{fmt(kpis.forecast_final_cost)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Actual Cost + Remaining Commitments</p>
        </div>

        {/* 7. Forecast Variance */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">7. Forecast Variance</span>
            <div className={`p-2 rounded-lg ${kpis.forecast_variance >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
              {kpis.forecast_variance >= 0 ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
          </div>
          <div className={`text-2xl font-black ${kpis.forecast_variance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {kpis.forecast_variance >= 0 ? "+" : ""}GH₵{fmt(kpis.forecast_variance)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Approved Budget − Forecast Cost</p>
        </div>

        {/* 8. Over-Budget Amount */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">8. Overrun Amount</span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-black ${kpis.over_budget_amount > 0 ? "text-rose-600" : "text-gray-400"}`}>
            GH₵{fmt(kpis.over_budget_amount)}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {kpis.over_budget_amount > 0 ? "Requires variance justification" : "No budget overrun detected"}
          </p>
        </div>
      </div>

      {/* Monthly Expenditure vs Budget Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" /> Monthly Expenditure vs. Budget Allocation
            </h3>
            <p className="text-xs text-gray-500">12-month expenditure trajectory and variance</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
              <span>Budget Plan</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
              <span>Actual Incurred</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2 pt-6 pb-2 items-end h-64 border-b border-gray-200 dark:border-gray-700">
          {monthlyTrends.map((m) => {
            const budgetHeightPct = maxChartVal > 0 ? (m.budget / maxChartVal) * 100 : 0;
            const actualHeightPct = maxChartVal > 0 ? (m.actual_expense / maxChartVal) * 100 : 0;

            return (
              <div key={m.month} className="flex flex-col items-center h-full justify-end group relative">
                {/* Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-gray-900 text-white text-[11px] rounded p-2 z-20 pointer-events-none whitespace-nowrap shadow-lg">
                  <div className="font-bold">{m.month}</div>
                  <div>Budget: GH₵{fmt(m.budget)}</div>
                  <div>Actual: GH₵{fmt(m.actual_expense)}</div>
                </div>

                <div className="flex gap-1 items-end w-full justify-center h-full">
                  {/* Budget Bar */}
                  <div
                    className="w-1/2 bg-blue-400 dark:bg-blue-600 rounded-t transition-all hover:bg-blue-500"
                    style={{ height: `${Math.max(budgetHeightPct, 4)}%` }}
                  />
                  {/* Actual Bar */}
                  <div
                    className={`w-1/2 rounded-t transition-all ${
                      m.actual_expense > m.budget ? "bg-red-500" : "bg-emerald-500"
                    }`}
                    style={{ height: `${Math.max(actualHeightPct, 4)}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-gray-500 mt-2">{m.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Overruns & Warning List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Top Expense Incurred Accounts
          </h3>
          <div className="overflow-x-auto">
            <table className="table table-compact w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th>Account</th>
                  <th>Category</th>
                  <th className="text-right">Actual Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {topOverruns.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center py-6 text-gray-400">
                      No significant expenditure records in this period.
                    </td>
                  </tr>
                ) : (
                  topOverruns.map((o) => (
                    <tr key={o.account_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="font-semibold text-gray-800 dark:text-gray-200">
                        <span className="font-mono text-blue-600 mr-1.5">{o.account_code}</span>
                        {o.account_name}
                      </td>
                      <td className="text-gray-500">{o.group_name}</td>
                      <td className="text-right font-mono font-bold text-gray-900 dark:text-white">
                        GH₵{fmt(o.actual_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operating Profit & Health Summary */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-purple-600" /> Operating Financial Health
          </h3>
          <div className="space-y-3 pt-2 text-sm">
            <div className="flex justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
              <span className="text-gray-600 dark:text-gray-400">Total Recognized Income:</span>
              <span className="font-mono font-bold text-blue-600">GH₵{fmt(kpis.actual_income)}</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
              <span className="text-gray-600 dark:text-gray-400">Total Operating Expenses:</span>
              <span className="font-mono font-bold text-red-600">GH₵{fmt(kpis.actual_cost)}</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
              <span className="font-semibold text-emerald-900 dark:text-emerald-300">Net Operating Profit:</span>
              <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-base">
                GH₵{fmt(kpis.net_operating_profit)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
