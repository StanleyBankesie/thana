/**
 * @fileoverview EquipmentList component.
 * Provides functionality for EquipmentList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Eye } from "lucide-react";
import { ListPrintIconButton, ListPdfIconButton, ListAttachmentIconButton } from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

const statusColors = { ACTIVE:"bg-green-100 text-green-700", INACTIVE:"bg-slate-100 text-slate-600", DECOMMISSIONED:"bg-red-100 text-red-600" };

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function EquipmentList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  useEffect(() => {
    let m = true;
    setLoading(true);
    api.get("/maintenance/equipment").then(r => { if (m) setItems(Array.isArray(r.data?.items) ? r.data.items : []); })
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load"))
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [location.state?.refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(r => String(r.equipment_code || "").toLowerCase().includes(q) || String(r.equipment_name || "").toLowerCase().includes(q) || String(r.category || "").toLowerCase().includes(q) || String(r.location || "").toLowerCase().includes(q));
  }, [items, search]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Equipment Setup</div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn btn-secondary">Back</button>
              <Link to="/maintenance/equipment/new" className="btn-success">+ New Equipment</Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="mb-4"><input className="input max-w-md" placeholder="Search by code, name, category, location..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead><tr><th className="whitespace-nowrap">Code</th><th className="whitespace-nowrap">Name</th><th className="whitespace-nowrap">Category</th><th className="whitespace-nowrap">Location</th><th className="whitespace-nowrap">Serial No</th><th className="whitespace-nowrap">Warranty Expiry</th><th className="whitespace-nowrap">Status</th><th className="whitespace-nowrap">Created By</th><th className="whitespace-nowrap">Created Date</th><th className="whitespace-nowrap">Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan="10" className="text-center py-8 text-slate-500 whitespace-nowrap">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan="10" className="text-center py-8 text-slate-500 whitespace-nowrap">No equipment found</td></tr>}
                {!loading && filtered.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm whitespace-nowrap">{r.equipment_code}</td>
                    <td className="font-medium whitespace-nowrap">{r.equipment_name}</td>
                    <td className="whitespace-nowrap">{r.category}</td>
                    <td className="whitespace-nowrap">{r.location}</td>
                    <td className="whitespace-nowrap">{r.serial_number}</td>
                    <td className={r.warranty_expiry && r.warranty_expiry < today ? "text-red-600 font-medium" : ""}>{r.warranty_expiry}</td>
                    <td className="whitespace-nowrap"><span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${statusColors[r.status] || "bg-slate-100 text-slate-600"}`}>{r.status}</span></td>
                    <td className="whitespace-nowrap">{r.created_by_name || "-"}</td>
                    <td className="whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    <td className="whitespace-nowrap"><div className="flex items-center gap-1"><button type="button" className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="View" onClick={() => navigate(`/maintenance/equipment/${r.id}?mode=view`)}><Eye size={15} /></button><ListPrintIconButton onClick={() => toast.info("Print coming soon")} /><ListPdfIconButton onClick={() => toast.info("PDF coming soon")} /><ListAttachmentIconButton onClick={() => { setActiveDocId(r.id); setShowAttach(true); }} /><Link to={`/maintenance/equipment/${r.id}`} className="btn-secondary btn-sm">Edit</Link></div></td>
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
    </div>
  );
}
