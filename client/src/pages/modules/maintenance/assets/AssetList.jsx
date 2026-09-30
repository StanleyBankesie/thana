/**
 * @fileoverview AssetList component.
 * Provides functionality for AssetList.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Plus, 
  Search, 
  Loader2, 
  Activity, 
  MapPin, 
  ChevronRight,
  MoreVertical,
  Filter,
  ArrowLeft,
  FileText,
  ShieldCheck,
  Tag,
  Eye
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import AssetMeterModal from "./AssetMeterModal";
import useSort from "../../../../hooks/useSort.js";
import SortableHeader from "../../../../components/SortableHeader.jsx";
import { ListPrintIconButton, ListPdfIconButton, ListAttachmentIconButton } from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function AssetList() {
  const [viewMode, setViewMode] = useViewMode();
  const { canPerformAction } = usePermission();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showMeterModal, setShowMeterModal] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await api.get("/maintenance/assets");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const filteredItems = items.filter(item => 
    item.asset_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.asset_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenMeters = (asset) => {
    setSelectedAsset(asset);
    setShowMeterModal(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/maintenance?section=Master Data" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">Asset Register</h1>
            <p className="text-slate-500 text-sm">Enterprise infrastructure and equipment management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search assets..." 
              className="input pl-10 pr-4 py-2 w-64"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Link 
            to="/maintenance/assets/new"
            className="btn-success flex items-center gap-2"
          >
            <Plus size={20} />
            + New Asset
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6 space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Assets</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{items.length}</p>
        </div>
        <div className="card p-6 space-y-1">
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Active Status</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {items.filter(i => i.status === 'ACTIVE').length}
          </p>
        </div>
        {/* KPI PLACEHOLDERS */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-1">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Downtime Risk</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white text-amber-500">Low</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-1">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Insurance Coverage</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white text-indigo-600">100%</p>
        </div>
      </div>

      <div className="card overflow-hidden shadow-sm">
        
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
          <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr>
                <th className="whitespace-nowrap">Asset Information</th>
                <th className="whitespace-nowrap">Classification</th>
                <th className="whitespace-nowrap">Current Status</th>
                <th className="whitespace-nowrap">Performance</th>
                <th className="whitespace-nowrap">Created By</th>
                <th className="whitespace-nowrap">Created Date</th>
                <th className="text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap">Accessing Registry...</td></tr>
              ) : filteredItems.length > 0 ? filteredItems.map((item) => (
                <tr key={item.id} className="group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-slate-900 border border-brand-100 dark:border-slate-700 flex items-center justify-center text-brand-600 shadow-sm">
                        <Tag size={18} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{item.asset_name}</div>
                        <div className="text-[10px] font-bold text-brand-700 dark:text-brand-300 uppercase tracking-tight mt-1">{item.asset_no}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                       <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.category}</div>
                       <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                          <MapPin size={12} /> {item.location}
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${item.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                       {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                       <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: '85%' }}></div>
                       </div>
                       <span className="text-[10px] font-bold text-slate-500 uppercase">85%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap">{item.created_by_name || "-"}</td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="View" onClick={() => navigate(`/maintenance/assets/${item.id}?mode=view`)}><Eye size={15} /></button>
                      <ListPrintIconButton onClick={() => toast.info("Print coming soon")} />
                      <ListPdfIconButton onClick={() => toast.info("PDF coming soon")} />
                      <ListAttachmentIconButton onClick={() => { setActiveDocId(item.id); setShowAttach(true); }} />
                      <button 
                        onClick={() => handleOpenMeters(item)}
                        className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                        title="Meter Readings"
                      >
                        <Activity size={18} />
                      </button>
                      <Link 
                        to={`/maintenance/assets/${item.id}`}
                        className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                      >
                        <ChevronRight size={20} />
                      </Link>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-50 whitespace-nowrap">
                    No infrastructure assets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showMeterModal && selectedAsset && (
        <AssetMeterModal 
          asset={selectedAsset} 
          onClose={() => {
            setShowMeterModal(false);
            setSelectedAsset(null);
          }} 
        />
      )}
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
