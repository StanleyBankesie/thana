/**
 * @fileoverview QualityControlList component.
 * Provides complete list view, filtering, scoring metrics, and details inspection modal
 * for factory floor Quality Control & Finished Goods Inspections.
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Loader2, 
  ShieldCheck, 
  ShieldAlert, 
  Award, 
  Building, 
  Calendar, 
  Layers, 
  Eye, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  RotateCcw,
  Check
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function QualityControlList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/production/qc/inspections");
      const listData = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setItems(listData);
    } catch (error) {
      toast.error("Failed to load Quality Control inspections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this QC inspection record? This will also release the linked execution card for re-inspection.")) {
      return;
    }
    setDeletingId(id);
    try {
      await api.delete(`/production/qc/inspections/${id}`);
      toast.success("QC inspection deleted successfully");
      setItems(prev => prev.filter(item => item.id !== id));
      if (selectedInspection?.id === id) setSelectedInspection(null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete inspection");
    } finally {
      setDeletingId(null);
    }
  };

  // Filter items by search text & status
  const filtered = items.filter(item => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      String(item.id || "").toLowerCase().includes(term) ||
      String(item.job_card_no || "").toLowerCase().includes(term) ||
      String(item.item_name || "").toLowerCase().includes(term) ||
      String(item.batch_no || "").toLowerCase().includes(term) ||
      String(item.warehouse_name || "").toLowerCase().includes(term);
    
    const matchesStatus = statusFilter === "ALL" || String(item.quality_status || "").toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filtered, "created_at", "desc");

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="card">
        <div className="card-header bg-brand-900 text-white dark:bg-brand-950 rounded-t-lg flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300 flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-amber-400" />
              Quality Control (QC) Inspections
            </h1>
            <p className="text-sm mt-1 text-slate-100">
              Audit factory execution outputs, review criteria scorecards, and verify finished goods warehouse transfers.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/production?section=Shop%20Floor%20%26%20Execution" className="font-sans btn btn-secondary">
              Return to Menu
            </Link>
            <button
              type="button"
              className="btn-success flex items-center gap-1.5"
              onClick={fetchData}
              disabled={loading}
            >
              <RotateCcw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <Link to="/production/execution/output" className="btn-success flex items-center gap-1.5">
              <Plus size={16} /> New Inspection
            </Link>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by Job Card #, Item Name, Batch No, Warehouse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full text-xs font-medium"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-xs font-bold w-auto"
          >
            <option value="ALL">All Statuses</option>
            <option value="PASSED">Passed Only</option>
            <option value="FAILED">Failed Only</option>
            <option value="CONDITIONALLY_APPROVED">Conditionally Approved</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
      </div>

      {/* Main Table / Grid View */}
      <div className="card overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="overflow-x-auto">
          <table className={"w-full text-left text-xs " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead className="bg-brand-900 text-white dark:bg-brand-950 font-bold uppercase tracking-wider border-b border-brand-800">
              <tr>
                <SortableHeader label="Audit / Date" sortKey="inspection_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-white font-extrabold" />
                <SortableHeader label="Job Execution #" sortKey="job_card_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-white font-extrabold" />
                <SortableHeader label="Product Item" sortKey="item_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-white font-extrabold" />
                <SortableHeader label="Batch & Shelf Life" sortKey="batch_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-white font-extrabold" />
                <SortableHeader label="FG Warehouse" sortKey="warehouse_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-white font-extrabold" />
                <SortableHeader label="Score" sortKey="quality_score" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-center text-white font-extrabold" />
                <SortableHeader label="Status" sortKey="quality_status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-center text-white font-extrabold" />
                <th className="px-5 py-3 text-right text-white font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">
                    <Loader2 className="animate-spin inline-block mr-2" size={18} />
                    Syncing QC records...
                  </td>
                </tr>
              ) : sortedItems.length > 0 ? (
                sortedItems.map((item) => (
                  <tr key={item.id} className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white">
                        QC-{String(item.id).padStart(5, '0')}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar size={11} /> {item.inspection_date ? new Date(item.inspection_date).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded">
                        {item.job_card_no || `JC-${item.job_card_id}`}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {item.item_name || 'Produced Item'}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {item.item_code || ''} • Qty: {Number(item.good_qty || item.inspected_qty || 0).toFixed(2)} {item.uom || 'Pcs'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {item.batch_no || 'N/A'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        EXP: {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Building size={13} className="text-slate-400" />
                        <span className="font-semibold">{item.warehouse_name || 'Main FG Warehouse'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 font-mono font-black text-xs px-2 py-0.5 rounded-full ${
                        Number(item.quality_score) >= 75
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}>
                        <Award size={12} /> {item.quality_score}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide ${
                        String(item.quality_status).toUpperCase() === 'PASSED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300'
                          : String(item.quality_status).toUpperCase() === 'FAILED'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300'
                          : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300'
                      }`}>
                        {String(item.quality_status).toUpperCase() === 'PASSED' && <CheckCircle2 size={12} />}
                        {String(item.quality_status).toUpperCase() === 'FAILED' && <XCircle size={12} />}
                        {item.quality_status || 'PASSED'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedInspection(item)}
                          className="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1 font-semibold"
                          title="View Scorecard & Details"
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          disabled={deletingId === item.id}
                          className="btn btn-danger text-xs px-2 py-1 flex items-center gap-1"
                          title="Delete Inspection"
                        >
                          {deletingId === item.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <ShieldCheck size={48} className="opacity-20" />
                      <p className="font-medium">No Quality Control inspections recorded yet</p>
                      <Link to="/production/execution/output" className="btn-success text-xs px-4 py-2 mt-2">
                        Record First QC Inspection
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QC Detail Scorecard Inspection Modal */}
      {selectedInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-brand-900 text-white p-6 flex justify-between items-center">
              <div>
                <span className="text-xs uppercase font-bold tracking-widest text-amber-400 block mb-1">
                  Inspection Audit Scorecard
                </span>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck className="text-emerald-400" />
                  QC-{String(selectedInspection.id).padStart(5, '0')} • {selectedInspection.item_name}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedInspection(null)}
                className="text-white hover:text-slate-300 text-2xl font-bold p-1 leading-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Summary Badges Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Status</span>
                  <span className={`font-black text-sm uppercase ${
                    String(selectedInspection.quality_status).toUpperCase() === 'PASSED' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {selectedInspection.quality_status}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Overall Score</span>
                  <span className="font-black text-sm text-amber-500 font-mono">
                    {selectedInspection.quality_score}%
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Passed Qty</span>
                  <span className="font-black text-sm text-slate-800 dark:text-slate-100 font-mono">
                    {Number(selectedInspection.good_qty || 0).toFixed(2)} {selectedInspection.uom || 'Pcs'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Rejected Defect</span>
                  <span className="font-black text-sm text-rose-600 font-mono">
                    {Number(selectedInspection.rejected_qty || 0).toFixed(2)} {selectedInspection.uom || 'Pcs'}
                  </span>
                </div>
              </div>

              {/* Execution & Traceability Details */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Traceability & Execution Info
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">Linked Execution Job Card:</span>
                    <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{selectedInspection.job_card_no || `JC-${selectedInspection.job_card_id}`}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Batch / Lot Number:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedInspection.batch_no || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Destination FG Warehouse:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedInspection.warehouse_name || 'Main Warehouse'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Manufacture Date (MFG):</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedInspection.mfg_date ? new Date(selectedInspection.mfg_date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Expiry Date (EXP):</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedInspection.expiry_date ? new Date(selectedInspection.expiry_date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Inspection Date:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedInspection.inspection_date ? new Date(selectedInspection.inspection_date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Criteria Score Breakdown (if present) */}
              {selectedInspection.criteria_scores && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Checklist Criteria Breakdown
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 uppercase font-bold text-[10px] text-slate-500">
                        <tr>
                          <th className="p-2.5">Criteria</th>
                          <th className="p-2.5 text-center">Max Pts</th>
                          <th className="p-2.5 text-center">Score Awarded</th>
                          <th className="p-2.5 text-center">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(typeof selectedInspection.criteria_scores === 'string'
                          ? JSON.parse(selectedInspection.criteria_scores)
                          : selectedInspection.criteria_scores
                        ).map((c, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">{c.check_item_name || `Criteria #${idx+1}`}</td>
                            <td className="p-2.5 text-center font-mono">{c.max_points || 0}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-brand-600">{c.awarded_points || 0}</td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {c.passed ? 'PASS' : 'FAIL'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Remarks */}
              {selectedInspection.remarks && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs">
                  <span className="font-bold text-amber-800 dark:text-amber-300 block mb-1">Auditor Remarks / Defect Notes:</span>
                  <p className="text-amber-900 dark:text-amber-200">{selectedInspection.remarks}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedInspection(null)}
                className="btn btn-secondary text-xs px-6 py-2"
              >
                Close Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
