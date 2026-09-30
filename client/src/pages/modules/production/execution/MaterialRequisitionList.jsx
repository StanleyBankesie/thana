/**
 * @fileoverview MaterialRequisitionList component.
 * Provides functionality for MaterialRequisitionList.
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Loader2,
  Calendar,
  ArrowLeft,
  FileSearch,
  ChevronRight,
  ClipboardList,
  AlertCircle
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaterialRequisitionList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const res = await api.get("/production/execution/material-requisition");
      const listData = Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.requisitions || []);
      setItems(listData);
    } catch (error) {
      toast.error("Failed to load requisitions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter items by search & status
  const filtered = items.filter(item => {
    const matchesSearch = 
      String(item.requisition_no || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.plan_no || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.warehouse_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "ALL" || String(item.status).toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filtered, "created_at", "desc");

  // KPI Metrics
  const totalCount = items.length;
  const pendingCount = items.filter(i => String(i.status).toUpperCase() === 'PENDING' || String(i.status).toUpperCase() === 'DRAFT').length;
  const approvedCount = items.filter(i => String(i.status).toUpperCase() === 'APPROVED').length;
  const fulfilledCount = items.filter(i => String(i.status).toUpperCase() === 'FULFILLED').length;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Production Material Requisitions</h1>
            <p className="text-sm mt-1">List, review, and manage factory floor material requisitions</p>
          </div>
          <div className="flex gap-2">
            <Link to="/production?section=Shop%20Floor%20%26%20Execution" className="font-sans btn btn-secondary">
              Return to Menu
            </Link>
            <button
              type="button"
              className="btn-success"
              onClick={fetchData}
              disabled={loading}
            >
              Refresh
            </button>
            <Link to="/production/execution/material-requisition/new" className="btn-success">
              Create New
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Requisitions</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</h3>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
            <ClipboardList size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Fulfillment</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</h3>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600">
            <AlertCircle size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved Requests</p>
            <h3 className="text-2xl font-black text-blue-600 mt-1">{approvedCount}</h3>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600">
            <FileSearch size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fulfilled Stores</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{fulfilledCount}</h3>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600">
            <FileSearch size={22} />
          </div>
        </div>
      </div>

      {/* Table & Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search Requisition No, Plan No..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl text-xs font-bold">
              {['ALL', 'PENDING', 'APPROVED', 'FULFILLED'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === st ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
                >
                  {st}
                </button>
              ))}
            </div>
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={"w-full text-left text-xs text-slate-600 dark:text-slate-300 " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead className="bg-slate-100/70 dark:bg-slate-900/60 uppercase font-extrabold tracking-wider text-[11px] text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <SortableHeader label="Requisition No" sortKey="requisition_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4" />
                <SortableHeader label="Production Plan" sortKey="plan_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4" />
                <SortableHeader label="Request Date" sortKey="requisition_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4" />
                <SortableHeader label="Priority" sortKey="priority" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4" />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-4 text-center" />
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">
                    Loading Material Requisitions...
                  </td>
                </tr>
              ) : sortedItems.length > 0 ? sortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-indigo-50/30 dark:hover:bg-slate-700/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl font-black text-xs">
                        {item.requisition_no ? item.requisition_no.slice(0, 3) : "MR"}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block text-sm">{item.requisition_no}</span>
                        <span className="text-[11px] text-slate-400">{item.warehouse_name || "Main Warehouse"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400">
                      <ClipboardList size={14} className="opacity-60" />
                      {item.plan_no ? item.plan_no : <span className="text-slate-400 font-normal italic">Direct Requisition</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                      <Calendar size={14} className="text-slate-400" />
                      {new Date(item.requisition_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      item.priority === 'HIGH' || item.priority === 'URGENT' 
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 border border-rose-200' 
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800'
                    }`}>
                      {item.priority || 'MEDIUM'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      item.status === 'APPROVED' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 
                      item.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 
                      item.status === 'FULFILLED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => navigate(`/production/execution/material-requisition/${item.id}`)}
                      className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <ClipboardList size={48} className="opacity-20" />
                      <p className="font-bold text-slate-600 dark:text-slate-300">No material requisitions found</p>
                      <Link to="/production/execution/material-requisition/new" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">
                        + Create Requisition
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
