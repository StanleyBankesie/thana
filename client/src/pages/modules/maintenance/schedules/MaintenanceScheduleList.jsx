/**
 * @fileoverview MaintenanceScheduleList component.
 * Provides functionality for MaintenanceScheduleList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Eye } from "lucide-react";
import { ListPrintIconButton, ListPdfIconButton, ListAttachmentIconButton } from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";
import { Guard } from "../../../../hooks/usePermissions";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceScheduleList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    let m = true;
    setLoading(true);
    api.get("/maintenance/schedules").then(r => { if (m) setItems(Array.isArray(r.data?.items) ? r.data.items : []); })
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load"))
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [location.state?.refresh]);

  const filtered = useMemo(() => {
    setCurrentPage(1); // Reset to first page on search
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r => String(r.schedule_name || "").toLowerCase().includes(q) || String(r.asset_name || "").toLowerCase().includes(q) || String(r.frequency || "").toLowerCase().includes(q));
  }, [items, search]);

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedItems = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <Guard moduleKey="maintenance">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Maintenance Schedules</h1>
            <p className="text-sm text-slate-500">Track and manage maintenance schedules</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.history.back()} className="btn-secondary">Back</button>
            <Link to="/maintenance/schedules/new" className="btn-primary">+ New Schedule</Link>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <input className="input max-w-md" placeholder="Search schedules..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={ "min-w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
              <thead className="bg-[#f8fafc] dark:bg-slate-900/50">
                <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Schedule Name</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Asset</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Frequency</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Start Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Assigned To</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Created By</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Created Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading && <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-500 whitespace-nowrap">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="9" className="px-4 py-8 text-center text-slate-500 whitespace-nowrap">No schedules found</td></tr>}
                {!loading && paginatedItems.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{r.schedule_name}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.asset_name}</td>
                    <td className="px-4 py-3 text-sm capitalize whitespace-nowrap">{r.frequency}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.start_date ? new Date(r.start_date).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.assigned_to}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap"><span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${r.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>{r.status}</span></td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.created_by_name || "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap"><div className="flex items-center gap-1"><button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="View" onClick={() => navigate(`/maintenance/schedules/${r.id}?mode=view`)}><Eye size={15} /></button><ListPrintIconButton onClick={() => toast.info("Print coming soon")} /><ListPdfIconButton onClick={() => toast.info("PDF coming soon")} /><ListAttachmentIconButton onClick={() => { setActiveDocId(r.id); setShowAttach(true); }} /><Link to={`/maintenance/schedules/${r.id}`} className="text-brand hover:underline font-medium text-sm">Edit</Link></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls */}
          {!loading && totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
              </span>
              <div className="flex gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-3 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-3 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
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
    </Guard>
  );
}
