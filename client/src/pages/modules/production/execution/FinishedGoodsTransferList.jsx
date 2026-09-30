/**
 * @fileoverview FinishedGoodsTransferList component.
 * Lists all Finished Goods Stock Transfers dispatched to inventory warehouses for Transfer Acceptance.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Plus, 
  Search, 
  Truck, 
  RotateCcw, 
  Trash2, 
  Loader2, 
  Eye, 
  ChevronRight, 
  PackageCheck,
  ShieldCheck,
  Calendar,
  Warehouse,
  Building,
  User,
  X
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function FinishedGoodsTransferList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const navigate = useNavigate();

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/production/execution/fg-transfer");
      const listData = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setItems(listData);
    } catch {
      toast.error("Failed to load Finished Goods Transfers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const openViewModal = async (transfer) => {
    setModalLoading(true);
    setDetailModalOpen(true);
    try {
      const res = await api.get(`/production/execution/fg-transfer/${transfer.id}`);
      setSelectedTransfer(res.data);
    } catch {
      setSelectedTransfer(transfer);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this Finished Goods Transfer?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/production/execution/fg-transfer/${id}`);
      toast.success("Finished Goods Transfer deleted successfully");
      setItems(prev => prev.filter(i => i.id !== id));
      if (selectedTransfer?.id === id) {
        setSelectedTransfer(null);
        setDetailModalOpen(false);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete transfer");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredItems = items.filter((i) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      String(i.id || "").toLowerCase().includes(term) ||
      String(i.transfer_no || "").toLowerCase().includes(term) ||
      String(i.job_card_no || "").toLowerCase().includes(term) ||
      String(i.qc_number || "").toLowerCase().includes(term) ||
      String(i.from_warehouse_name || "").toLowerCase().includes(term) ||
      String(i.to_warehouse_name || i.target_warehouse_name || "").toLowerCase().includes(term);
    
    const matchesStatus = statusFilter === "ALL" || String(i.status || "").toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "transfer_date", "desc");

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="card">
        <div className="card-header bg-brand-900 text-white dark:bg-brand-950 rounded-t-lg flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300 flex items-center gap-2">
              <Truck className="h-7 w-7 text-amber-400" />
              Finished Goods Stock Transfers
            </h1>
            <p className="text-sm mt-1 text-slate-100">
              Dispatched finished goods transferred from production warehouses to inventory warehouses.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/production?section=Shop%20Floor%20%26%20Execution" className="font-sans btn btn-secondary">
              Return to Menu
            </Link>
            <button
              type="button"
              className="btn-success flex items-center gap-1.5"
              onClick={fetchTransfers}
              disabled={loading}
            >
              <RotateCcw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <Link to="/production/execution/fg-transfer/new" className="btn-success flex items-center gap-1.5">
              <Plus size={16} /> New FG Transfer
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
              placeholder="Search transfers by transfer no, job card, QC, warehouse..."
              className="input pl-10 w-full text-xs font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-xs font-bold w-auto"
          >
            <option value="ALL">All Statuses</option>
            <option value="DISPATCHED">Dispatched Only</option>
            <option value="IN_TRANSIT">In Transit Only</option>
            <option value="RECEIVED">Received Only</option>
            <option value="ACCEPTED">Accepted Only</option>
          </select>
        </div>
        <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
      </div>

      {/* Table Card */}
      <div className="card overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className={"w-full text-left text-xs " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead className="bg-brand-900 text-white dark:bg-brand-950 font-bold uppercase tracking-wider border-b border-brand-800">
              <tr>
                <SortableHeader label="Transfer No" sortKey="transfer_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-white font-extrabold" />
                <SortableHeader label="Date" sortKey="transfer_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-white font-extrabold" />
                <SortableHeader label="Production #" sortKey="job_card_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-white font-extrabold" />
                <SortableHeader label="QC Audit #" sortKey="qc_number" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-white font-extrabold" />
                <SortableHeader label="Source FG Warehouse" sortKey="from_warehouse_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-white font-extrabold" />
                <SortableHeader label="Target Inventory Warehouse" sortKey="to_warehouse_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-white font-extrabold" />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-5 py-3 text-center text-white font-extrabold" />
                <th className="px-5 py-3 text-right text-white font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">
                    <Loader2 className="animate-spin inline-block mr-2" size={18} />
                    Syncing Finished Goods Transfers...
                  </td>
                </tr>
              ) : sortedItems.length > 0 ? (
                sortedItems.map((item) => (
                  <tr key={item.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-brand-600 font-mono whitespace-nowrap">
                      {item.transfer_no || `FGT-${String(item.id).padStart(6, '0')}`}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-medium whitespace-nowrap">
                      {item.transfer_date ? new Date(item.transfer_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {item.job_card_no || (item.job_card_id ? `#JC-${item.job_card_id}` : "—")}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {item.qc_number || (item.qc_id ? `QC-${String(item.qc_id).padStart(5, '0')}` : "—")}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                      {item.from_warehouse_name || "—"}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-emerald-600">
                      {item.to_warehouse_name || item.target_warehouse_name || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        item.status === 'RECEIVED' || item.status === 'COMPLETED' || item.status === 'ACCEPTED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300'
                          : item.status === 'DISPATCHED' || item.status === 'IN_TRANSIT'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300'
                      }`}>
                        {item.status || 'DISPATCHED'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openViewModal(item)}
                          className="btn btn-secondary py-1 px-2 text-xs font-bold inline-flex items-center gap-1"
                          title="View Details"
                        >
                          <Eye size={13} /> View
                        </button>
                        <Link 
                          to="/inventory/transfers/accept" 
                          className="btn btn-secondary py-1 px-2 text-xs font-bold inline-flex items-center gap-1 text-emerald-600"
                          title="Accept in Inventory"
                        >
                          Accept <ChevronRight size={13} />
                        </Link>
                        <button
                          onClick={(e) => handleDelete(item.id, e)}
                          disabled={deletingId === item.id}
                          className="btn btn-danger text-xs px-2 py-1 flex items-center gap-1"
                          title="Delete Transfer"
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
                      <Truck size={48} className="opacity-20" />
                      <p className="font-medium">No Finished Goods Transfers recorded yet</p>
                      <Link to="/production/execution/fg-transfer/new" className="btn-success text-xs px-4 py-2 mt-2">
                        Create First FG Transfer
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details View Modal */}
      {detailModalOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-50 dark:bg-brand-950 text-brand-600 rounded-xl">
                  <Truck size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Transfer Details: {selectedTransfer.transfer_no || `FGT-${selectedTransfer.id}`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Dispatched on {selectedTransfer.transfer_date ? new Date(selectedTransfer.transfer_date).toLocaleDateString() : "—"}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setDetailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {modalLoading ? (
              <div className="py-12 text-center text-slate-400 font-bold">
                <Loader2 className="animate-spin inline mr-2" /> Loading details...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Meta details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block font-bold uppercase text-[10px]">Production Execution</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedTransfer.job_card_no || (selectedTransfer.job_card_id ? `#JC-${selectedTransfer.job_card_id}` : "—")}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold uppercase text-[10px]">QC Audit #</span>
                    <span className="font-bold text-emerald-600">
                      {selectedTransfer.qc_number || (selectedTransfer.qc_id ? `QC-${String(selectedTransfer.qc_id).padStart(5, '0')}` : "—")}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold uppercase text-[10px]">Status</span>
                    <span className="font-bold text-brand-600">{selectedTransfer.status || "DISPATCHED"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold uppercase text-[10px]">Source FG Warehouse</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedTransfer.from_warehouse_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold uppercase text-[10px]">Target Inventory Warehouse</span>
                    <span className="font-bold text-emerald-600">{selectedTransfer.to_warehouse_name || selectedTransfer.target_warehouse_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold uppercase text-[10px]">Driver / Vehicle</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {selectedTransfer.driver_name || "—"} {selectedTransfer.vehicle_no ? `(${selectedTransfer.vehicle_no})` : ""}
                    </span>
                  </div>
                </div>

                {/* Transferred Items */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Transferred Finished Products
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2 text-right">Transfer Qty</th>
                          <th className="px-3 py-2">Batch / Lot #</th>
                          <th className="px-3 py-2">Shelf Life (EXP)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {Array.isArray(selectedTransfer.items) && selectedTransfer.items.length > 0 ? (
                          selectedTransfer.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                                {item.item_name} {item.item_code ? `(${item.item_code})` : ""}
                              </td>
                              <td className="px-3 py-2 font-mono font-bold text-right text-emerald-600">
                                {Number(item.qty).toFixed(2)} {item.uom || "Pcs"}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                                {item.batch_no || "—"}
                              </td>
                              <td className="px-3 py-2 text-slate-500">
                                {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : "—"}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="px-3 py-4 text-center text-slate-400">
                              No line items recorded
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedTransfer.remarks && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-xs text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
                    <strong>Remarks:</strong> {selectedTransfer.remarks}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t dark:border-slate-800">
              <Link 
                to="/inventory/transfers/accept"
                className="btn btn-secondary text-xs font-bold text-emerald-600"
              >
                Go to Acceptance Page
              </Link>
              <button 
                onClick={() => setDetailModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
