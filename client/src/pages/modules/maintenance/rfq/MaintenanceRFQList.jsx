/**
 * @fileoverview MaintenanceRFQList component.
 * Provides functionality for MaintenanceRFQList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Eye, Mail, Pencil } from "lucide-react";
import { ListPrintIconButton, ListPdfIconButton, ListAttachmentIconButton } from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";
import { Guard } from "../../../../hooks/usePermissions";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

const statusColors = { DRAFT:"bg-slate-100 text-slate-600", SENT:"bg-blue-100 text-blue-700", RESPONDED:"bg-green-100 text-green-700", CLOSED:"bg-slate-200 text-slate-700" };
function Badge({ value, colorMap }) {
  const v = String(value || "").toUpperCase();
  return <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${colorMap[v] || "bg-slate-100 text-slate-600"}`}>{v}</span>;
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceRFQList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get("/maintenance/rfqs").then(r => { if (mounted) setItems(Array.isArray(r.data?.items) ? r.data.items : []); })
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load RFQs"))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [location.state?.refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r => String(r.rfq_no || "").toLowerCase().includes(q) || String(r.status || "").toLowerCase().includes(q) || String(r.supplier_names || "").toLowerCase().includes(q));
  }, [items, search]);

  return (
    <Guard moduleKey="maintenance">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Request for Quotations (RFQ)</h1>
            <p className="text-sm text-slate-500">Track and manage requests for quotations</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => (window.location.href = "/maintenance?section=Procurement %26 Materials")} className="btn btn-secondary">Back</button>
            <button onClick={() => (window.location.href = "/maintenance/rfq/new")} className="bg-brand text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700">+ New RFQ</button>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <input className="input max-w-md" placeholder="Search by no, status, supplier..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={ "min-w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
              <thead className="bg-[#f8fafc] dark:bg-slate-900/50">
                <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">RFQ No</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Request Ref</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Suppliers Invited</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Deadline</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Approval Email</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Created By</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Created Date</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading && <tr><td colSpan="10" className="px-4 py-8 text-center text-slate-500 whitespace-nowrap">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="10" className="px-4 py-8 text-center text-slate-500 whitespace-nowrap">No RFQs found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">{r.rfq_no}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.rfq_date ? new Date(r.rfq_date).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.request_id}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.supplier_names}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.response_deadline ? new Date(r.response_deadline).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap"><Badge value={r.status} colorMap={statusColors} /></td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        disabled={r.status === "APPROVED"}
                        className={`px-2 py-1 text-xs rounded font-medium ${r.status === "APPROVED" ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
                        onClick={async () => {
                          try {
                            await api.put(`/maintenance/rfqs/${r.id}`, { status: "APPROVED" });
                            toast.success("RFQ Confirmed");
                            api.get("/maintenance/rfqs").then(res => setItems(Array.isArray(res.data?.items) ? res.data.items : []));
                          } catch (e) {
                            toast.error(e?.response?.data?.message || "Failed to confirm RFQ");
                          }
                        }}
                      >
                        {r.status === "APPROVED" ? "Confirmed" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 text-xs rounded font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                        onClick={async () => {
                          try {
                            const res = await api.post(`/maintenance/rfqs/${r.id}/send-email`);
                            toast.success(res.data?.message || "Email sent successfully");
                            api.get("/maintenance/rfqs").then(res => setItems(Array.isArray(res.data?.items) ? res.data.items : []));
                          } catch(e) {
                            toast.error(e?.response?.data?.message || "Failed to send email");
                          }
                        }}
                      >
                        Send Email
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.created_by_name || "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="View" onClick={() => navigate(`/maintenance/rfq/${r.id}?mode=view`)}><Eye size={15} /></button>
                        <button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="Edit" onClick={() => navigate(`/maintenance/rfq/${r.id}`)}><Pencil size={15} /></button>
                        <ListPrintIconButton onClick={() => toast.info("Print coming soon")} />
                        <ListPdfIconButton onClick={() => toast.info("PDF coming soon")} />
                        <ListAttachmentIconButton onClick={() => { setActiveDocId(r.id); setShowAttach(true); }} />
                        <Link to={`/maintenance/supplier-quotations/new?rfq_id=${r.id}&rfq_no=${r.rfq_no}`} className="text-emerald-600 hover:underline">Record Quotation</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
