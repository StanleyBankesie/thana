/**
 * @fileoverview PmScheduleList component.
 * Provides functionality for PmScheduleList.
 */

import React, { useState, useEffect } from "react";
import { 
  Link, useNavigate 
} from "react-router-dom";
import { 
  Plus, 
  Search, 
  Loader2, 
  Calendar, 
  ShieldCheck, 
  Clock, 
  ArrowLeft,
  ChevronRight,
  MoreVertical,
  Activity,
  AlertCircle,
  Eye
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { ListPrintIconButton, ListPdfIconButton, ListAttachmentIconButton } from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PmScheduleList() {
  const [viewMode, setViewMode] = useViewMode();
  const { canPerformAction } = usePermission();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  const fetchSchedules = async () => {
    try {
      const res = await api.get("/maintenance/schedules");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load schedules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const filteredItems = items.filter(item => 
    item.schedule_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.asset_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/maintenance?section=Operations %26 Schedules" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">PM Schedules</h1>
            <p className="text-slate-500 text-sm">Preventive maintenance and reliability planning</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search schedules..." 
              className="input pl-10 pr-4 py-2 w-64"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Link 
            to="/maintenance/pm-schedules/new"
            className="btn-success flex items-center gap-2"
          >
            <Plus size={20} />
            + New Plan
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-brand-600 p-8 rounded-2xl text-white shadow-sm space-y-4">
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl w-fit">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold">Active Plans</h3>
            <p className="text-brand-100 font-medium uppercase text-[10px] tracking-wider mt-1">Reliability Foundation</p>
          </div>
          <p className="text-4xl font-bold">{items.filter(i => i.status === 'ACTIVE').length}</p>
        </div>
        
        <div className="card p-8 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-xl text-rose-600">
              <AlertCircle size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Overdue Tasks</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">4</p>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-400 leading-relaxed italic">Immediate action required to prevent equipment failure and maintain warranty compliance.</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600">
              <Activity size={28} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Compliance</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">98.2%</p>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-400 leading-relaxed italic">Your maintenance team is performing above target thresholds for this quarter.</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
          <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr>
                <th className="whitespace-nowrap">Schedule Information</th>
                <th className="whitespace-nowrap">Asset Reference</th>
                <th className="whitespace-nowrap">Frequency</th>
                <th className="whitespace-nowrap">Next Due</th>
                <th className="text-right whitespace-nowrap">Status</th>
                <th className="whitespace-nowrap">Created By</th>
                <th className="whitespace-nowrap">Created Date</th>
                <th className="text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="8" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold tracking-widest uppercase whitespace-nowrap">Syncing Registry...</td></tr>
              ) : filteredItems.length > 0 ? filteredItems.map((item) => (
                <tr key={item.id} className="group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-slate-900 border border-brand-100 dark:border-slate-700 flex items-center justify-center text-brand-600 shadow-sm">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{item.schedule_name}</div>
                        <div className="text-[10px] font-bold text-brand-700 dark:text-brand-300 uppercase tracking-tight mt-1">{item.schedule_code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                       <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                          <Activity size={14} className="text-slate-400" />
                          {item.asset_name}
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase">
                       <Clock size={14} /> {item.frequency}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                        <Calendar size={14} className="text-slate-400" />
                        {new Date(item.next_due_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                       {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap">{item.created_by_name || "-"}</td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="View" onClick={() => navigate(`/maintenance/pm-schedules/${item.id}?mode=view`)}><Eye size={15} /></button>
                      <ListPrintIconButton onClick={() => toast.info("Print coming soon")} />
                      <ListPdfIconButton onClick={() => toast.info("PDF coming soon")} />
                      <ListAttachmentIconButton onClick={() => { setActiveDocId(item.id); setShowAttach(true); }} />
                      <Link 
                        to={`/maintenance/pm-schedules/${item.id}`}
                        className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors inline-block"
                      >
                        <ChevronRight size={20} />
                      </Link>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-50 whitespace-nowrap">
                    No active PM plans identified.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showAttach && activeDocId && (
        <DocumentAttachmentsModal
          open={showAttach}
          onClose={() => { setShowAttach(false); setActiveDocId(null); }}
          docType="maintenance"
          docId={activeDocId}
        />
      )}
    </div>
  );
}
