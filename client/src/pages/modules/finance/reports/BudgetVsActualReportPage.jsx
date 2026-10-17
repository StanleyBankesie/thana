/**
 * @fileoverview BudgetVsActualReportPage component.
 * Enterprise Finance Module Budget vs. Actual Cost Analysis & Variance Report.
 * Features 8 core indicators, multi-dimensional filters, transaction drilldown modal,
 * variance explanation & corrective action logging, and budget control policies.
 */

import React, { useEffect, useState, useMemo } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  BarChart2,
  ArrowLeft,
  RefreshCw,
  Download,
  Printer,
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Briefcase,
  Layers,
  Settings,
  MessageSquare,
  Eye,
  FileText,
  Sliders,
  Check,
  X,
} from "lucide-react";

const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function BudgetVsActualReportPage() {
  const [searchParams] = useSearchParams();
  const initialFy = searchParams.get("fiscal_year_id") || "";
  const initialBudget = searchParams.get("budget_id") || "";

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);

  // Metadata dropdowns
  const [fiscalYears, setFiscalYears] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [costCenters, setCostCenters] = useState([]);

  // Active filters
  const [selectedFy, setSelectedFy] = useState(initialFy);
  const [selectedBudget, setSelectedBudget] = useState(initialBudget);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedCostCenter, setSelectedCostCenter] = useState("");
  const [selectedNature, setSelectedNature] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Drilldown Modal state
  const [showDrilldown, setShowDrilldown] = useState(false);
  const [drilldownAccount, setDrilldownAccount] = useState(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState({ items: [], total_debit: 0, total_credit: 0 });

  // Variance Explanation Modal state
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [explainItem, setExplainItem] = useState(null);
  const [explanationText, setExplanationText] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [savingExplain, setSavingExplain] = useState(false);

  // Budget Control Settings Modal state
  const [showControlModal, setShowControlModal] = useState(false);
  const [controlPolicy, setControlPolicy] = useState({
    policy_type: "WARN_ONLY",
    warning_threshold_pct: 85,
    block_threshold_pct: 100,
    applies_to_po: true,
    applies_to_expense: true,
  });

  // Load dropdown options
  useEffect(() => {
    async function loadMeta() {
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
        console.error("Failed to load metadata", e);
      }
    }
    loadMeta();
  }, []);

  // Load budgets for selected fiscal year
  useEffect(() => {
    async function loadBudgets() {
      if (!selectedFy) return;
      try {
        const res = await api.get("/finance/budgets", {
          params: { fiscal_year_id: selectedFy },
        });
        const list = res.data?.data || [];
        setBudgets(list);
        if (selectedBudget && !list.some((b) => String(b.id) === String(selectedBudget))) {
          setSelectedBudget("");
        }
      } catch (e) {
        console.error("Failed to load budgets", e);
      }
    }
    loadBudgets();
  }, [selectedFy]);

  // Fetch report data
  const fetchReport = async () => {
    try {
      setLoading(true);
      const params = {
        fiscal_year_id: selectedFy || undefined,
        budget_id: selectedBudget || undefined,
        project_id: selectedProject || undefined,
        cost_center_id: selectedCostCenter || undefined,
        nature: selectedNature !== "ALL" ? selectedNature : undefined,
      };
      const res = await api.get("/finance/reports/budget-vs-actual", { params });
      setReportData(res.data?.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load Budget vs Actual report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedFy) {
      fetchReport();
    }
  }, [selectedFy, selectedBudget, selectedProject, selectedCostCenter, selectedNature]);

  // Handle Drilldown click
  const handleOpenDrilldown = async (item) => {
    setDrilldownAccount(item);
    setShowDrilldown(true);
    setDrilldownLoading(true);
    try {
      const res = await api.get("/finance/reports/budget-vs-actual/drilldown", {
        params: {
          account_id: item.account_id,
          project_id: selectedProject || undefined,
          cost_center_id: selectedCostCenter || undefined,
          from: reportData?.date_range?.from,
          to: reportData?.date_range?.to,
        },
      });
      setDrilldownData(res.data?.data || { items: [], total_debit: 0, total_credit: 0 });
    } catch (err) {
      toast.error("Failed to load transaction drilldown");
    } finally {
      setDrilldownLoading(false);
    }
  };

  // Handle Explain Variance click
  const handleOpenExplain = (item) => {
    setExplainItem(item);
    setExplanationText("");
    setCorrectiveAction("");
    setShowExplainModal(true);
  };

  const handleSaveExplanation = async (e) => {
    e.preventDefault();
    if (!explanationText.trim()) {
      toast.error("Please enter a variance explanation");
      return;
    }
    try {
      setSavingExplain(true);
      await api.post("/finance/budgets/variances/explanations", {
        budget_id: reportData?.budget?.id || budgets[0]?.id || 1,
        account_id: explainItem.account_id,
        project_id: selectedProject ? Number(selectedProject) : null,
        variance_amount: explainItem.variance_amount,
        explanation: explanationText,
        corrective_action: correctiveAction,
      });
      toast.success("Variance explanation recorded successfully");
      setShowExplainModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to save explanation");
    } finally {
      setSavingExplain(false);
    }
  };

  // Load and save Budget Control Policy
  const handleOpenControls = async () => {
    try {
      const res = await api.get("/finance/budgets/controls/policy");
      setControlPolicy(res.data?.data || controlPolicy);
      setShowControlModal(true);
    } catch (e) {
      setShowControlModal(true);
    }
  };

  const handleSaveControls = async (e) => {
    e.preventDefault();
    try {
      await api.put("/finance/budgets/controls/policy", controlPolicy);
      toast.success("Budget control policies updated successfully");
      setShowControlModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to update budget controls");
    }
  };

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!reportData?.items) return [];
    if (!searchQuery.trim()) return reportData.items;
    const q = searchQuery.toLowerCase();
    return reportData.items.filter(
      (item) =>
        item.account_code?.toLowerCase().includes(q) ||
        item.account_name?.toLowerCase().includes(q) ||
        item.group_name?.toLowerCase().includes(q)
    );
  }, [reportData, searchQuery]);

  // Export to Excel
  const handleExport = () => {
    if (!filteredItems.length) {
      toast.warning("No data to export");
      return;
    }
    const exportRows = filteredItems.map((item) => ({
      "Account Code": item.account_code,
      "Account Name": item.account_name,
      "Nature": item.account_nature,
      "Group": item.group_name,
      "Budget Amount (GHS)": item.budget_amount,
      "Actual Incurred (GHS)": item.actual_amount,
      "Variance (GHS)": item.variance_amount,
      "Utilization %": item.utilization_pct,
      "Forecast Final Cost (GHS)": item.forecast_final_cost,
      "Forecast Variance (GHS)": item.forecast_variance,
      "Overrun (GHS)": item.overrun_amount,
      "Status": item.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Budget vs Actual");
    XLSX.writeFile(wb, `Budget_Vs_Actual_Report_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  const summary = reportData?.summary || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              to="/finance"
              className="btn btn-secondary inline-flex items-center gap-1.5"
            >
              <ArrowLeft size={16} /> Back
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart2 className="w-7 h-7 text-blue-600" /> Budget vs. Actual Cost Report
            </h1>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            Authoritative financial variance analysis comparing approved budgets against GAAP recognized actual voucher expenditure with transaction drilldown.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/finance/budget-dashboard"
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <BarChart2 className="w-4 h-4" /> Executive Dashboard
          </Link>
          <button
            onClick={handleOpenControls}
            className="btn btn-secondary inline-flex items-center gap-2"
            title="Configure Budget Policies"
          >
            <Sliders className="w-4 h-4" /> Policies
          </button>
          <button
            onClick={fetchReport}
            className="btn btn-secondary inline-flex items-center gap-2"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={handleExport}
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export Excel
          </button>
          <button
            onClick={() => window.print()}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
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
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Budget Allocation</label>
            <select
              value={selectedBudget}
              onChange={(e) => setSelectedBudget(e.target.value)}
              className="select select-bordered select-sm w-52 font-medium"
            >
              <option value="">Active Fiscal Year Budget</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.budget_code} - {b.budget_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="select select-bordered select-sm w-48 font-medium"
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
              className="select select-bordered select-sm w-44 font-medium"
            >
              <option value="">All Cost Centers</option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.code} - {cc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Nature</label>
            <select
              value={selectedNature}
              onChange={(e) => setSelectedNature(e.target.value)}
              className="select select-bordered select-sm w-36 font-medium"
            >
              <option value="ALL">All Accounts</option>
              <option value="EXPENSE">Expenses Only</option>
              <option value="INCOME">Income Only</option>
            </select>
          </div>
        </div>

        <div className="w-full md:w-64">
          <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Search Account</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, name, category..."
              className="input input-bordered input-sm w-full pl-8"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Operating Expenses */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Operating Expenses (OPEX)</p>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                GH₵{fmt(summary.total_actual_expense)}
              </h3>
            </div>
            <div className={`p-3 rounded-lg ${summary.expense_variance >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
              {summary.expense_variance >= 0 ? <TrendingDown className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs">
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Approved Budget:</span>
              <span className="font-mono font-semibold">GH₵{fmt(summary.total_budget_expense)}</span>
            </div>
            <div className="flex justify-between">
              <span>Expense Variance:</span>
              <span className={`font-mono font-bold ${summary.expense_variance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {summary.expense_variance >= 0 ? "+" : ""}GH₵{fmt(summary.expense_variance)} ({summary.expense_variance >= 0 ? "Under Budget" : "Over Budget"})
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full ${
                  summary.expense_utilization_pct > 100
                    ? "bg-red-500"
                    : summary.expense_utilization_pct >= 85
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(summary.expense_utilization_pct || 0, 100)}%` }}
              />
            </div>
            <p className="text-right text-[11px] text-gray-500">
              {summary.expense_utilization_pct || 0}% budget utilized
            </p>
          </div>
        </div>

        {/* Revenue Performance */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Revenue & Income</p>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                GH₵{fmt(summary.total_actual_income)}
              </h3>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs">
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Budgeted Target:</span>
              <span className="font-mono font-semibold">GH₵{fmt(summary.total_budget_income)}</span>
            </div>
            <div className="flex justify-between">
              <span>Revenue Variance:</span>
              <span className={`font-mono font-bold ${summary.income_variance >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                {summary.income_variance >= 0 ? "+" : ""}GH₵{fmt(summary.income_variance)}
              </span>
            </div>
          </div>
        </div>

        {/* Net Operating Margin */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Net Operating Margin</p>
              <h3 className={`text-2xl font-black mt-1 ${summary.net_actual_profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>
                GH₵{fmt(summary.net_actual_profit)}
              </h3>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
              <Briefcase className="w-6 h-6" />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs">
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Planned Net Profit:</span>
              <span className="font-mono font-semibold">GH₵{fmt(summary.net_budget_profit)}</span>
            </div>
            <div className="flex justify-between">
              <span>Performance:</span>
              <span className="font-bold text-gray-800 dark:text-gray-200">
                {summary.net_actual_profit >= summary.net_budget_profit ? "Healthy (Exceeding Plan)" : "Needs Attention"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabular Report */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/30">
          <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
            General Ledger Budget vs Actual Variance Table
            <span className="badge badge-sm badge-ghost">{filteredItems.length} accounts</span>
          </h3>
          <span className="text-xs text-gray-400">
            Click <Eye className="w-3.5 h-3.5 inline mx-1 text-blue-600" /> to drill down to source vouchers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 uppercase">
              <tr>
                <th>Account Code & Title</th>
                <th>Category</th>
                <th>Nature</th>
                <th className="text-right">Budget</th>
                <th className="text-right">Actual Cost</th>
                <th className="text-right">Variance</th>
                <th className="text-center">% Utilized</th>
                <th className="text-right">Forecast Cost</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-16 text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Calculating financial balances and variances...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-16 text-gray-500">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    No financial accounts match the current filter selection.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isExpense = item.account_nature === "EXPENSE";
                  const isFavorable = item.variance_amount >= 0;

                  return (
                    <tr key={item.account_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td>
                        <span className="font-mono font-medium text-blue-600 dark:text-blue-400 mr-2">
                          {item.account_code}
                        </span>
                        <strong className="text-gray-900 dark:text-white font-semibold">
                          {item.account_name}
                        </strong>
                      </td>
                      <td className="text-gray-500">{item.group_name}</td>
                      <td>
                        <span
                          className={`badge badge-xs font-semibold ${
                            isExpense ? "badge-warning" : "badge-info"
                          }`}
                        >
                          {item.account_nature}
                        </span>
                      </td>
                      <td className="text-right font-mono font-medium text-gray-700 dark:text-gray-300">
                        GH₵{fmt(item.budget_amount)}
                      </td>
                      <td className="text-right font-mono font-bold text-gray-900 dark:text-white">
                        GH₵{fmt(item.actual_amount)}
                      </td>
                      <td
                        className={`text-right font-mono font-bold ${
                          isFavorable ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {isFavorable ? "+" : ""}GH₵{fmt(item.variance_amount)}
                      </td>
                      <td className="text-center font-mono">
                        <span
                          className={
                            isExpense && item.utilization_pct > 100
                              ? "text-red-600 font-bold"
                              : "text-gray-600 dark:text-gray-400"
                          }
                        >
                          {item.utilization_pct}%
                        </span>
                      </td>
                      <td className="text-right font-mono text-gray-600 dark:text-gray-400">
                        GH₵{fmt(item.forecast_final_cost || item.actual_amount)}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge badge-xs font-semibold ${
                            item.status === "WITHIN_BUDGET" || item.status === "TARGET_EXCEEDED"
                              ? "badge-success text-white"
                              : item.status === "NEARING_LIMIT"
                              ? "badge-warning"
                              : item.status === "OVER_BUDGET" || item.status === "BEHIND_TARGET"
                              ? "badge-error text-white"
                              : "badge-ghost"
                          }`}
                        >
                          {item.status === "WITHIN_BUDGET"
                            ? "Within Budget"
                            : item.status === "OVER_BUDGET"
                            ? "Over Budget"
                            : item.status === "NEARING_LIMIT"
                            ? "Nearing Limit"
                            : item.status === "TARGET_EXCEEDED"
                            ? "Target Met"
                            : item.status === "BEHIND_TARGET"
                            ? "Behind Target"
                            : item.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenDrilldown(item)}
                            className="btn btn-xs btn-ghost text-blue-600 hover:bg-blue-50"
                            title="Drilldown to source vouchers"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenExplain(item)}
                            className="btn btn-xs btn-ghost text-indigo-600 hover:bg-indigo-50"
                            title="Add variance explanation"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer Totals */}
            {filteredItems.length > 0 && (
              <tfoot className="bg-gray-50 dark:bg-gray-900/80 font-bold text-xs uppercase border-t-2 border-gray-300 dark:border-gray-600">
                <tr>
                  <td colSpan="3" className="text-right">Grand Total:</td>
                  <td className="text-right font-mono font-bold text-gray-900 dark:text-white">
                    GH₵{fmt(summary.total_budget_expense + summary.total_budget_income)}
                  </td>
                  <td className="text-right font-mono font-bold text-gray-900 dark:text-white">
                    GH₵{fmt(summary.total_actual_expense + summary.total_actual_income)}
                  </td>
                  <td
                    className={`text-right font-mono font-bold ${
                      summary.net_profit_variance >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    GH₵{fmt(summary.net_profit_variance)}
                  </td>
                  <td colSpan="4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Transaction Drilldown Modal */}
      {showDrilldown && drilldownAccount && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Transaction Drilldown: {drilldownAccount.account_code} - {drilldownAccount.account_name}
                </h3>
                <p className="text-xs text-gray-500">
                  Authoritative posted journal vouchers recognized as actual costs in this financial period.
                </p>
              </div>
              <button
                onClick={() => setShowDrilldown(false)}
                className="btn btn-sm btn-circle btn-ghost"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              {drilldownLoading ? (
                <div className="text-center py-12 text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  Fetching individual journal vouchers...
                </div>
              ) : drilldownData.items.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  No individual vouchers found for this account in the selected scope.
                </div>
              ) : (
                <table className="table table-compact w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th>Voucher #</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Narration & Description</th>
                      <th>Project / Cost Center</th>
                      <th className="text-right">Debit</th>
                      <th className="text-right">Credit</th>
                      <th className="text-right">Net Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {drilldownData.items.map((row) => (
                      <tr key={row.line_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="font-mono font-semibold text-blue-600">
                          {row.voucher_no || `#${row.voucher_id}`}
                        </td>
                        <td>{row.voucher_date?.substring(0, 10)}</td>
                        <td>
                          <span className="badge badge-xs badge-ghost">{row.voucher_type_name || "Journal"}</span>
                        </td>
                        <td className="max-w-xs truncate" title={row.line_description || row.header_narration}>
                          {row.line_description || row.header_narration || "—"}
                        </td>
                        <td className="text-gray-500">
                          {row.project_name || row.cost_center_name || "—"}
                        </td>
                        <td className="text-right font-mono text-gray-700 dark:text-gray-300">
                          GH₵{fmt(row.debit)}
                        </td>
                        <td className="text-right font-mono text-gray-700 dark:text-gray-300">
                          GH₵{fmt(row.credit)}
                        </td>
                        <td className="text-right font-mono font-bold text-gray-900 dark:text-white">
                          GH₵{fmt(row.net_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-900 font-bold border-t">
                    <tr>
                      <td colSpan="5" className="text-right">Total Debit & Credit:</td>
                      <td className="text-right font-mono">GH₵{fmt(drilldownData.total_debit)}</td>
                      <td className="text-right font-mono">GH₵{fmt(drilldownData.total_credit)}</td>
                      <td className="text-right font-mono font-bold text-emerald-600">
                        GH₵{fmt(drilldownAccount.account_nature === "EXPENSE" ? drilldownData.total_debit - drilldownData.total_credit : drilldownData.total_credit - drilldownData.total_debit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowDrilldown(false)}
                className="btn btn-sm btn-ghost"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variance Explanation Modal */}
      {showExplainModal && explainItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Variance Explanation: {explainItem.account_name}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Current Variance: <strong className={explainItem.variance_amount >= 0 ? "text-emerald-600" : "text-red-600"}>
                GH₵{fmt(explainItem.variance_amount)} ({explainItem.variance_amount >= 0 ? "Under Budget" : "Over Budget"})
              </strong>
            </p>

            <form onSubmit={handleSaveExplanation} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase block mb-1">
                  Root Cause / Explanation *
                </label>
                <textarea
                  value={explanationText}
                  onChange={(e) => setExplanationText(e.target.value)}
                  className="textarea textarea-bordered w-full h-20 text-sm"
                  placeholder="e.g. Unforeseen price escalation in fuel and transport logistics during Q2..."
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase block mb-1">
                  Corrective Action Plan (Optional)
                </label>
                <textarea
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  className="textarea textarea-bordered w-full h-20 text-sm"
                  placeholder="e.g. Bulk purchasing agreements signed with supplier to freeze unit prices..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExplainModal(false)}
                  className="btn btn-sm btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExplain}
                  className="btn btn-sm btn-primary bg-indigo-600 hover:bg-indigo-700 border-none text-white"
                >
                  {savingExplain ? "Saving..." : "Record Explanation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget Control Policies Modal */}
      {showControlModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              Company Budget Control Policies
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Configure system behavior when transactions (Purchase Orders, Expenses, Vouchers) approach or exceed available budget limits.
            </p>

            <form onSubmit={handleSaveControls} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase block mb-1">
                  Policy Enforcement Mode
                </label>
                <select
                  value={controlPolicy.policy_type}
                  onChange={(e) => setControlPolicy({ ...controlPolicy, policy_type: e.target.value })}
                  className="select select-bordered select-sm w-full"
                >
                  <option value="WARN_ONLY">Warn Only (Allow transaction with alert)</option>
                  <option value="REQUIRE_APPROVAL">Require Exceptional Approval</option>
                  <option value="BLOCK">Strict Block (Prevent over-budget creation)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase block mb-1">
                    Warning Threshold (%)
                  </label>
                  <input
                    type="number"
                    value={controlPolicy.warning_threshold_pct}
                    onChange={(e) => setControlPolicy({ ...controlPolicy, warning_threshold_pct: Number(e.target.value) })}
                    className="input input-bordered input-sm w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase block mb-1">
                    Block Threshold (%)
                  </label>
                  <input
                    type="number"
                    value={controlPolicy.block_threshold_pct}
                    onChange={(e) => setControlPolicy({ ...controlPolicy, block_threshold_pct: Number(e.target.value) })}
                    className="input input-bordered input-sm w-full"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowControlModal(false)}
                  className="btn btn-sm btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                >
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
