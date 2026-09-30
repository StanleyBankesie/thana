/**
 * @fileoverview DirectPurchaseList component.
 * Provides functionality for DirectPurchaseList.
 */

import React, { useEffect, useState } from "react";
import { api } from "../../../../api/client.js";
import { printDocument, downloadDocumentPdf } from "@/utils/pdfUtils.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { Link } from "react-router-dom";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DirectPurchaseList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessPath, canReverseApproval } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/purchase/direct-purchases");
        const arr = Array.isArray(res?.data?.items)
          ? res.data.items
          : Array.isArray(res?.data)
            ? res.data
            : [];
        if (mounted) setItems(arr);
      } catch (e) {
        if (mounted) setError(e?.response?.data?.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);


  function fmtCurrency(n) {
    const v = Number(n || 0);
    return `GHS ${v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(items, "created_at", "desc");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Purchase
          </button>
          <h1 className="text-2xl font-bold mt-2">Direct Purchases</h1>
          <p className="text-sm text-slate-600">
            Single-step purchases created from the Direct Purchase form
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-primary"
            data-rbac-exempt="true"
            onClick={() => navigate("/purchase/direct-purchase/new")}
          >
            Create Direct Purchase
          </button>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div>Loading...</div>
          ) : (
            
                <>
<div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
              <table className={ "table w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
                <thead>
                  <tr>
                    <SortableHeader label="No" sortKey="dp_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Date" sortKey="purchase_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Supplier" sortKey="supplier_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Amount" sortKey="grand_total" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                    <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                     <th className="text-right" style={{ width: '320px' }}>Actions</th>
                    <SortableHeader label="Created By" sortKey="created_by_username" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td>{it.dp_no || it.document_no || it.id}</td>
                      <td>
                        {String(it.purchase_date || it.date || "").slice(0, 10)}
                      </td>
                      <td style={{ width: '250px' }}>
                        {it.supplier_name || it.supplier || it.supplier_id}
                      </td>
                      <td className="text-right">
                        {fmtCurrency(
                          it.grand_total ?? it.total_amount ?? it.amount ?? 0,
                        )}
                      </td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            ["POST", "POSTED"].includes(String(it.status).toUpperCase())
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {it.status || "DRAFT"}
                        </span>
                      </td>
                     <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                         {/* Slot 1: View */}
                         <div className="min-w-[60px]">
                           <button
                             type="button"
                             className="w-full inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-8"
                             onClick={() => navigate(`/purchase/direct-purchase/${it.id}?mode=view`)}
                           >
                             View
                           </button>
                         </div>

                         {/* Slot 2: Edit */}
                         <div className="min-w-[60px]">
                           {!["POST", "POSTED"].includes(String(it.status).toUpperCase()) ? (
                             <button
                               type="button"
                               className="w-full inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-8"
                               onClick={() => navigate(`/purchase/direct-purchase/${it.id}?mode=edit`)}
                             >
                               Edit
                             </button>
                           ) : (
                             <div className="w-full h-8" />
                           )}
                         </div>

                         {/* Slot 3: Print */}
                         <div className="min-w-[36px]">
                           <ListPrintIconButton
                             onClick={() => printDocument(api, "direct-purchase", it.id, toast)}
                           />
                         </div>

                         {/* Slot 4: PDF */}
                         <div className="min-w-[36px]">
                           <ListPdfIconButton
                             onClick={() => downloadDocumentPdf(api, "direct-purchase", it.id, `DirectPurchase-${it.dp_no || it.id}.pdf`, toast)}
                           />
                         </div>

                         {/* Slot 5: Attachments */}
                         <div className="w-8">
                           <ListAttachmentIconButton
                             onClick={() => {
                               setActiveDocId(it.id);
                               setShowAttach(true);
                             }}
                           />
                         </div>

                         {/* Slot 6: Workflow / Status */}
                         <div className="min-w-[120px]">
                           <div className="list-approval-slot">
                             {["POST", "POSTED"].includes(String(it.status).toUpperCase()) ? (
                               <div className="flex items-center gap-2">
                                 <span className="list-approval-approved-pill">
                                   Posted
                                 </span>
                                 {canReverseApproval() && (
                                   <button
                                     type="button"
                                     className="list-approval-reverse-btn"
                                     onClick={async () => {
                                       if (!window.confirm("Cancel this purchase?")) return;
                                       try {
                                         await api.post(`/purchase/direct-purchase/${it.id}/cancel`);
                                         toast.success("Purchase cancelled");
                                         setItems(prev => prev.map(x => x.id === it.id ? { ...x, status: 'CANCELLED' } : x));
                                       } catch (e) {
                                         toast.error("Failed to cancel");
                                       }
                                     }}
                                   >
                                     Cancel
                                   </button>
                                 )}
                               </div>
                             ) : (
                               <div className="w-full h-8" />
                             )}
                           </div>
                         </div>
                       </div>
                     </td>
                    <td>{it.created_by_username || it.created_by_name || "-"}</td>
                    <td>{it.created_at ? new Date(it.created_at).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-slate-500">
                        No records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          
</>
)}
        </div>
      </div>
      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setActiveDocId(null);
        }}
        docType="direct-purchase"
        docId={activeDocId}
        allowPreview={true}
      />
    </div>
  );
}
