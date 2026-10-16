/**
 * @file CostControlDashboard.jsx
 * @description Earned Value Management (EVM) and construction cost control dashboard.
 * Tracks Budget vs Actual, Commitments, CPI, SPI, EAC, and cost code level variances.
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
  Activity
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function CostControlDashboard() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/projects/projects", { params: { active: "all" } });
        const prjs = res.data?.items || [];
        setProjects(prjs);
        if (prjs.length > 0) {
          setSelectedProjectId(String(prjs[0].id));
        }
      } catch (e) {
        toast.error("Failed to load projects");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    fetchCostControlData();
  }, [selectedProjectId]);

  const fetchCostControlData = async () => {
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

  const cs = data?.cost_summary || {};
  const proj = data?.project || {};
  const budgetLines = data?.budgetLines || [];

  const cpi = Number(cs.cpi || 1.0);
  const spi = Number(cs.spi || 1.0);
  const cv = Number(cs.cost_variance || 0);
  const sv = Number(cs.schedule_variance || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/project-management" className="text-white/80 hover:text-white">
                <ArrowLeft size={18} />
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp size={24} /> Construction Cost Control & EVM
              </h1>
            </div>
            <p className="text-sm mt-1 opacity-80">
              Earned Value Management, Budget vs Actual variance, and financial performance tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm outline-none font-medium"
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id} className="text-slate-900">
                  {p.project_code} - {p.project_name}
                </option>
              ))}
            </select>
            {selectedProjectId && (
              <Link
                to={`/finance/reports/budget-vs-actual?project_id=${selectedProjectId}`}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="View in Finance GL Budget vs Actual"
              >
                <FileText size={14} /> Finance GL Budget
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Primary EVM KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Budget at Completion */}
        <div className="card p-5 space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Budget at Completion (BAC)</span>
            <DollarSign size={18} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            GHS {Number(cs.budget_at_completion || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500">Approved project baseline budget</p>
        </div>

        {/* Actual Cost */}
        <div className="card p-5 space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Actual Cost (AC)</span>
            <Activity size={18} className="text-rose-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            GHS {Number(cs.actual_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500">
            Expenses + Labour + Subcontract Valuations
          </p>
        </div>

        {/* Earned Value */}
        <div className="card p-5 space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Earned Value (EV)</span>
            <CheckCircle size={18} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            GHS {Number(cs.earned_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500">
            Based on {proj.completion_percent || 0}% progress achieved
          </p>
        </div>

        {/* Estimate at Completion */}
        <div className="card p-5 space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Estimate at Completion (EAC)</span>
            <TrendingUp size={18} className="text-indigo-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
            GHS {Number(cs.estimate_at_completion || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500">
            Projected total cost based on current CPI
          </p>
        </div>
      </div>

      {/* EVM Performance Indices */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* CPI */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Cost Index (CPI)</p>
            <p className={`text-2xl font-black font-mono mt-1 ${cpi >= 1.0 ? "text-emerald-600" : "text-rose-600"}`}>
              {cpi.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {cpi >= 1.0 ? "Under budget (Favorable)" : "Over budget (Unfavorable)"}
            </p>
          </div>
          <div className={`p-3 rounded-full ${cpi >= 1.0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
            {cpi >= 1.0 ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
          </div>
        </div>

        {/* SPI */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Schedule Index (SPI)</p>
            <p className={`text-2xl font-black font-mono mt-1 ${spi >= 1.0 ? "text-emerald-600" : "text-amber-600"}`}>
              {spi.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {spi >= 1.0 ? "Ahead of schedule" : "Behind schedule"}
            </p>
          </div>
          <div className={`p-3 rounded-full ${spi >= 1.0 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
            {spi >= 1.0 ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
          </div>
        </div>

        {/* Cost Variance */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Cost Variance (CV)</p>
            <p className={`text-xl font-bold font-mono mt-1 ${cv >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {cv >= 0 ? "+" : ""}GHS {cv.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">EV minus AC</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-500">
            <DollarSign size={20} />
          </div>
        </div>

        {/* Variance at Completion */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Variance at Completion</p>
            <p className={`text-xl font-bold font-mono mt-1 ${Number(cs.variance_at_completion || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {Number(cs.variance_at_completion || 0) >= 0 ? "+" : ""}GHS {Number(cs.variance_at_completion || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">BAC minus EAC</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-500">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Cost Breakdown & Commitments */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <PieChart size={16} className="text-brand-600" /> Cost Distribution
          </h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 font-medium">Subcontractor Valuations</span>
              <span className="font-mono font-bold">GHS {Number(cs.subcontractor_valuations || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 font-medium">Labour (Timesheets)</span>
              <span className="font-mono font-bold">GHS {Number(cs.labour_costs || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 font-medium">Direct Project Expenses</span>
              <span className="font-mono font-bold">GHS {Number(cs.direct_expenses || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 font-medium">PO Commitments (Open)</span>
              <span className="font-mono font-bold text-blue-600">GHS {Number(cs.committed_cost || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Contract Sum Reconciliation */}
        <div className="card p-5 space-y-4 md:col-span-2">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FileText size={16} className="text-brand-600" /> Commercial & Contract Position
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Original Contract Sum</span>
              <p className="text-base font-bold font-mono">GHS {Number(proj.contract_sum || 0).toLocaleString()}</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Revised Contract Sum</span>
              <p className="text-base font-bold font-mono text-brand-600">GHS {Number(proj.revised_contract_sum || proj.contract_sum || 0).toLocaleString()}</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Target Margin</span>
              <p className="text-base font-bold font-mono text-emerald-600">
                GHS {(Number(proj.revised_contract_sum || 0) - Number(cs.budget_at_completion || 0)).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Code Variance Table */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
            Cost Code Budget Lines & Allocations
          </h3>
          <span className="text-xs text-slate-500 font-semibold">{budgetLines.length} Cost Code Allocations</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-bold border-b">
              <tr>
                <th className="p-3">Cost Code</th>
                <th className="p-3">Cost Code Name</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Quantity</th>
                <th className="p-3 text-right">Unit Rate (GHS)</th>
                <th className="p-3 text-right">Allocated Budget (GHS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {budgetLines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                    No budget lines established for this project yet. Use BOQ or Budget entry to allocate cost codes.
                  </td>
                </tr>
              ) : (
                budgetLines.map(bl => (
                  <tr key={bl.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-brand-600">{bl.cost_code || "-"}</td>
                    <td className="p-3 font-semibold">{bl.cost_code_name || "General"}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800">
                        {bl.cost_category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono">{bl.quantity || 1}</td>
                    <td className="p-3 text-right font-mono">{Number(bl.unit_rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {Number(bl.budget_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
