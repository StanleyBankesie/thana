/**
 * @fileoverview MaintenanceRFQList component.
 * Provides functionality for MaintenanceRFQList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Eye, Mail, Pencil, ArrowLeft } from "lucide-react";
import { ListPrintIconButton, ListPdfIconButton, ListAttachmentIconButton } from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";
import { Guard } from "../../../../hooks/usePermissions";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import { printDocument, downloadDocumentPdf } from "@/utils/pdfUtils";

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
            <Link to="/maintenance?section=Procurement %26 Billing" className="btn btn-secondary flex items-center gap-1.5"><ArrowLeft size={16} /> Back</Link>
            <Link to="/maintenance/rfq/new" className="bg-brand text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700">+ New RFQ</Link>
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
            <table className={ "table " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
              <thead>
                <tr>
                  <th className="whitespace-nowrap">RFQ No</th>
                  <th className="whitespace-nowrap">Date</th>
                  <th className="whitespace-nowrap">Request Ref</th>
                  <th className="whitespace-nowrap">Suppliers Invited</th>
                  <th className="whitespace-nowrap">Deadline</th>
                  <th className="whitespace-nowrap">Status</th>
                  <th className="whitespace-nowrap">Request Quotation / Approval</th>
                  <th className="whitespace-nowrap">Created By</th>
                  <th className="whitespace-nowrap">Created Date</th>
                  <th className="whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading && <tr><td colSpan="10" className="px-4 py-8 text-center text-slate-500 whitespace-nowrap">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="10" className="px-4 py-8 text-center text-slate-500 whitespace-nowrap">No RFQs found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="font-medium whitespace-nowrap">{r.rfq_no}</td>
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
                        className="px-2.5 py-1 text-xs rounded font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors inline-flex items-center gap-1"
                        title="Send Request for Quotation to invited suppliers"
                        onClick={async () => {
                          try {
                            const res = await api.post(`/maintenance/rfqs/${r.id}/send-email`);
                            toast.success(res.data?.message || "Quotation request sent successfully");
                            api.get("/maintenance/rfqs").then(res => setItems(Array.isArray(res.data?.items) ? res.data.items : []));
                          } catch(e) {
                            toast.error(e?.response?.data?.message || "Failed to request quotation");
                          }
                        }}
                      >
                        <Mail size={13} /> Request Quotation
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.created_by_name || "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="View" onClick={() => navigate(`/maintenance/rfq/${r.id}?mode=view`)}><Eye size={15} /></button>
                        <button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="Edit" onClick={() => navigate(`/maintenance/rfq/${r.id}`)}><Pencil size={15} /></button>
                        <ListPrintIconButton onClick={() => printDocument(api, "maintenance-rfq", r.id, toast, "maintenance-rfqlist")} />
                        <ListPdfIconButton onClick={() => downloadDocumentPdf(api, "maintenance-rfq", r.id, `RFQ-${r.rfq_no || r.id}.pdf`, toast, "maintenance-rfqlist")} />
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
