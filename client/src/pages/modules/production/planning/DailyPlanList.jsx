/**
 * @fileoverview DailyPlanList component.
 * Provides functionality for DailyPlanList.
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Edit2, 
  Search, 
  Loader2,
  Calendar,
  ArrowLeft,
  FileSpreadsheet,
  ChevronRight,
  BarChart2,
  PieChart,
  TrendingUp,
  Layers,
  Eye,
  X,
  Cpu,
  Clock
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function DailyPlanList() {
  const [viewMode, setViewMode] = useViewMode("table");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const navigate = useNavigate();

  const fetchPlans = async () => {
    try {
      const res = await api.get("/production/planning/daily");
      setItems(res.data?.items || []);
    } catch (error) {
      toast.error("Failed to load daily plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleConfirmPlan = async (planId) => {
    try {
      const plan = items.find(p => p.id === planId);
      if (!plan) return;
      await api.put(`/production/planning/daily/${planId}`, {
        ...plan,
        status: "RELEASED"
      });
      toast.success("Production Plan confirmed & status updated to RELEASED");
      fetchPlans();
    } catch {
      toast.error("Failed to confirm production plan");
    }
  };

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(items, "created_at", "desc");
  const [showCharts, setShowCharts] = useState(false);

  // Compute graphical report metrics from loaded plans
  const totalPlans = items.length;
  const totalPlannedQty = items.reduce((acc, item) => acc + (parseFloat(item.quantity) || 0), 0);
  
  const statusCounts = items.reduce((acc, item) => {
    const s = item.status || 'DRAFT';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const periodCounts = items.reduce((acc, item) => {
    const p = item.plan_period || 'DAILY';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  // Group quantity planned by product for graphical presentation
  const productQtyMap = items.reduce((acc, item) => {
    const name = item.product_name || 'Unassigned Item';
    acc[name] = (acc[name] || 0) + (parseFloat(item.quantity) || 0);
    return acc;
  }, {});

  const topProducts = Object.entries(productQtyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxProductQty = Math.max(...Object.values(productQtyMap), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/production?section=Planning%20%26%20Requirements" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Production Plans</h1>
            <p className="text-slate-500 text-sm">Schedule, track, and analyze manufacturing plans across daily, weekly, and monthly periods</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCharts(!showCharts)}
            className={`btn text-xs font-bold flex items-center gap-1.5 ${showCharts ? "btn-secondary" : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200"}`}
          >
            <BarChart2 size={16} />
            {showCharts ? "Hide Graphical Analytics" : "Show Graphical Analytics"}
          </button>
          
          <Link 
            to="/production/planning/daily/new"
            className="btn btn-primary bg-brand-900 hover:bg-brand-950 text-white flex items-center gap-2 text-xs font-bold shadow-md"
          >
            <Plus size={18} />
            New Production Plan
          </Link>
        </div>
      </div>

      {/* Graphical Presentation Report Dashboard */}
      {showCharts && (
        <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
          {/* Key Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Plans</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">{totalPlans}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-xl">
                <TrendingUp size={24} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Target Output</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">{Math.round(totalPlannedQty)} Pcs</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 rounded-xl">
                <Layers size={24} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">In Progress</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">{statusCounts['IN_PROGRESS'] || 0}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 rounded-xl">
                <Calendar size={24} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Multi-Day Runs</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {(periodCounts['WEEKLY'] || 0) + (periodCounts['MONTHLY'] || 0) + (periodCounts['CUSTOM'] || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Graphical Presentation Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Output Target Volume by Product (Horizontal Bar Presentation) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 size={18} className="text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Output Quantity by Product</h3>
                </div>
                <span className="text-xs text-slate-400 font-semibold">Top Products Volume</span>
              </div>

              {topProducts.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-8">No plan product data available for graph</p>
              ) : (
                <div className="space-y-3 pt-2">
                  {topProducts.map(([pName, qty], i) => {
                    const pct = Math.round((qty / maxProductQty) * 100);
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-800 dark:text-slate-200 truncate">{pName}</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-mono">{Math.round(qty)} Pcs</span>
                        </div>
                        <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden flex">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chart 2: Plan Status & Period Breakdown (Distribution Bars) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <PieChart size={18} className="text-emerald-600" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Plan Status & Period Distribution</h3>
                </div>
                <span className="text-xs text-slate-400 font-semibold">Workflow Health</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                {/* Status Column */}
                <div className="space-y-2 border-r border-slate-100 dark:border-slate-700 pr-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Status Breakdown</span>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Draft
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{statusCounts['DRAFT'] || 0}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Released
                      </span>
                      <span className="font-mono font-bold text-blue-600">{statusCounts['RELEASED'] || 0}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> In Progress
                      </span>
                      <span className="font-mono font-bold text-amber-600">{statusCounts['IN_PROGRESS'] || 0}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Completed
                      </span>
                      <span className="font-mono font-bold text-emerald-600">{statusCounts['COMPLETED'] || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Period Column */}
                <div className="space-y-2 pl-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Period Types</span>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Daily Plans</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{periodCounts['DAILY'] || 0}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Weekly Runs</span>
                      <span className="font-mono font-bold text-indigo-600">{periodCounts['WEEKLY'] || 0}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Monthly Schedules</span>
                      <span className="font-mono font-bold text-purple-600">{periodCounts['MONTHLY'] || 0}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Custom Multi-Date</span>
                      <span className="font-mono font-bold text-brand-600">{periodCounts['CUSTOM'] || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Scheduled Production Plans Registry</h3>
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>

        <div className="overflow-x-auto">
          <table className={"table w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60">
                <SortableHeader label="Plan No" sortKey="plan_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Product Name" sortKey="product_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Batch No" sortKey="batch_number" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Job Card No" sortKey="job_card_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Quantity" sortKey="quantity" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                <SortableHeader label="Plan Date / Period" sortKey="plan_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                <th className="text-center px-6 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Loading Production Plans...</td>
                </tr>
              ) : sortedItems.length > 0 ? sortedItems.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-600">
                        <FileSpreadsheet size={18} />
                      </div>
                      <span className="font-bold text-brand-700 dark:text-brand-300 font-mono">{item.plan_no}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                    {item.product_name || "Production Item"}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300 text-xs">
                    {item.batch_number || "—"}
                  </td>
                  <td className="px-6 py-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400 text-xs">
                    {item.job_card_no || "—"}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                    {item.quantity ? Math.round(parseFloat(item.quantity)) : 0} Pcs
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                        <Calendar size={14} className="opacity-50 text-indigo-500" />
                        {item.plan_period === 'CUSTOM' || (item.start_date && item.end_date && item.start_date !== item.end_date) ? (
                          <span>
                            {new Date(item.start_date || item.plan_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(item.end_date || item.plan_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        ) : (
                          <span>{item.plan_date ? new Date(item.plan_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : "—"}</span>
                        )}
                      </div>
                      {item.plan_period && item.plan_period !== 'DAILY' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {item.plan_period} RUN
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`badge 
                      ${item.status === 'COMPLETED' ? 'badge-success' : 
                        item.status === 'IN_PROGRESS' ? 'badge-info' : 
                        item.status === 'RELEASED' ? 'badge-primary' :
                        'badge-secondary'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                      <button 
                        onClick={() => navigate(`/production/planning/daily/view/${item.id}`)}
                        className="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200"
                        title="View Full Production Plan Details"
                      >
                        <Eye size={13} /> View
                      </button>

                      {(item.status === 'DRAFT' || !item.status) && (
                        <button
                          onClick={() => handleConfirmPlan(item.id)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                        >
                          Confirm Plan
                        </button>
                      )}
                      {(item.status === 'DRAFT' || !item.status) && (
                        <button 
                          onClick={() => navigate(`/production/planning/daily/edit/${item.id}`)}
                          className="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1 font-semibold"
                          title="Edit Plan"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <FileSpreadsheet size={48} className="opacity-20" />
                      <p className="font-medium">No production plans found</p>
                      <Link to="/production/planning/daily/new" className="btn btn-primary text-xs">+ Create First Plan</Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Plan Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150 border border-slate-200 dark:border-slate-700">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="text-brand-600" size={20} />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Production Plan Details ({selectedPlan.plan_no})
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">ID: #{selectedPlan.id}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedPlan(null)} 
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Status</span>
                  <span className={`badge ${
                    selectedPlan.status === 'COMPLETED' ? 'badge-success' : 
                    selectedPlan.status === 'IN_PROGRESS' ? 'badge-info' : 
                    selectedPlan.status === 'RELEASED' ? 'badge-primary' :
                    'badge-secondary'
                  }`}>
                    {selectedPlan.status || 'DRAFT'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Planned Output</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {selectedPlan.quantity ? Math.round(parseFloat(selectedPlan.quantity)) : 1} Pcs
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Batch / Lot No</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedPlan.batch_number || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Plan Date</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {selectedPlan.plan_date ? new Date(selectedPlan.plan_date).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Target Finished Good & References</h4>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Finished Product:</span>
                    <strong className="text-slate-900 dark:text-white">{selectedPlan.product_name || "Finished Good"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Work Order No:</span>
                    <strong className="font-mono text-indigo-600">{selectedPlan.work_order_no || "WO-DIRECT"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Manufacture Date:</span>
                    <span className="font-bold">{selectedPlan.manufacture_date ? new Date(selectedPlan.manufacture_date).toLocaleDateString() : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Expiry Date:</span>
                    <span className="font-bold">{selectedPlan.expiry_date ? new Date(selectedPlan.expiry_date).toLocaleDateString() : "—"}</span>
                  </div>
                </div>
              </div>

              {/* Processes configured */}
              {selectedPlan.processes && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Configured Manufacturing Processes</h4>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-900 font-bold uppercase text-[10px] text-slate-500">
                        <tr>
                          <th className="p-3">Process Name</th>
                          <th className="p-3">Work Center / Machine</th>
                          <th className="p-3">Shift</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {(typeof selectedPlan.processes === 'string' ? JSON.parse(selectedPlan.processes) : selectedPlan.processes).map((pr, idx) => (
                          <tr key={idx}>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{pr.process_name || pr.name || `Process Step ${idx + 1}`}</td>
                            <td className="p-3 font-mono">{pr.machine_name || (pr.machine_id ? `Machine #${pr.machine_id}` : "Default Machine")}</td>
                            <td className="p-3">{pr.shift_name || (pr.shift_id ? `Shift #${pr.shift_id}` : "Default Shift")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-end">
              <button 
                type="button" 
                onClick={() => setSelectedPlan(null)} 
                className="btn btn-secondary text-xs"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
