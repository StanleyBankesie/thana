/**
 * @fileoverview ProductionTransferList component.
 * Provides functionality for ProductionTransferList.
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  Loader2,
  Calendar,
  ArrowLeft,
  Truck,
  ChevronRight,
  ClipboardList,
  Warehouse
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
export default function ProductionTransferList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const res = await api.get("/production/execution/transfer");
      setItems(res.data?.items || []);
    } catch (error) {
      toast.error("Failed to load transfers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(items, "created_at", "desc");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/production?section=Shop%20Floor%20%26%20Execution" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Production Transfers</h1>
            <p className="text-slate-500 text-sm">Move finished goods from production to warehouse</p>
          </div>
        </div>
        <Link 
          to="/production/execution/transfer/new"
          className="btn-success flex items-center gap-2"
        >
          <Plus size={20} />
          New Transfer
        </Link>
      </div>

      <div className="card overflow-hidden shadow-sm">
        
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
          <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500">
                <SortableHeader label="Transfer No" sortKey="transfer_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-3" />
                <SortableHeader label="Target Warehouse" sortKey="target_warehouse_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-3" />
                <SortableHeader label="Date" sortKey="transfer_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="px-6 py-3" />
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Syncing transfers...</td>
                </tr>
              ) : sortedItems.length > 0 ? sortedItems.map((item) => (
                <tr key={item.id} className="group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-brand-600">
                        <Truck size={18} />
                      </div>
                      <span className="font-bold text-brand-700 dark:text-brand-300">{item.transfer_no}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-brand-600">
                      <Warehouse size={14} className="opacity-50" />
                      {item.target_warehouse_name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                      <Calendar size={14} className="opacity-50" />
                      {new Date(item.transfer_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors">
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Truck size={48} className="opacity-20" />
                      <p className="font-medium">No production transfers recorded</p>
                      <Link to="/production/execution/transfer/new" className="btn-success btn-sm">New transfer</Link>
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
