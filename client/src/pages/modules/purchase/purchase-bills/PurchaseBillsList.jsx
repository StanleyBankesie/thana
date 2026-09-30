/**
 * @fileoverview PurchaseBillsList component.
 * Provides functionality for PurchaseBillsList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { api } from "api/client";
import { renderHtmlToPdf } from "@/utils/pdfUtils.js";
import PrintPreviewModal from "@/components/PrintPreviewModal.jsx";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PurchaseBillsList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const billType = location.pathname.includes("purchase-bills-import")
    ? "IMPORT"
    : "LOCAL";
  const { canPerformAction, exceptionalPerms } = usePermission();

  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);
  const [activeDocType, setActiveDocType] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewBill, setPreviewBill] = useState(null);
  const [downloading, setDownloading] = useState(false);

  async function fetchBillHtml(billId) {
    const res = await api.post(
      `/documents/purchase-bill/${billId}/render`,
      { format: "html", feature_name: "purchase-bill" },
      { headers: { "Content-Type": "application/json" } },
    );
    return typeof res.data === "string" ? res.data : String(res.data || "");
  }

  async function openPreview(row, { autoDownload = false } = {}) {
    try {
      const html = await fetchBillHtml(row.id);
      setPreviewBill(row);
      setPreviewHtml(html);
      setPreviewOpen(true);
      if (autoDownload) {
        setDownloading(true);
        try {
          await renderHtmlToPdf(
            html,
            `Purchase-Bill-${row.bill_no || row.id}.pdf`,
          );
        } finally {
          setDownloading(false);
        }
      }
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to render purchase bill",
      );
    }
  }

  async function downloadFromPreview() {
    if (!previewBill) return;
    try {
      setDownloading(true);
      await renderHtmlToPdf(
        previewHtml,
        `Purchase-Bill-${previewBill.bill_no || previewBill.id}.pdf`,
      );
    } catch (e) {
      toast.error("Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  }

  const fetchBills = async (currentPage) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/purchase/bills", {
        params: { bill_type: billType, page: currentPage, limit: 50 },
      });
      const all = Array.isArray(res.data?.items) ? res.data.items : [];
      setItems(all);
      if (res.data?.pagination) {
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalCount(res.data.pagination.total || 0);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills(page);
  }, [page, billType]);

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge-info",
      POSTED: "badge-success",
      CANCELLED: "badge-error",
    };
    return badges[status] || "badge-info";
  };
  const getPaymentBadge = (status) => {
    const badges = {
      UNPAID: "badge-error",
      "PARTIAL PAYMENT": "badge-warning",
      PARTIALLY_PAID: "badge-warning",
      "FULLY PAID": "badge-success",
      PAID: "badge-success",
    };
    return badges[status] || "badge-info";
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items.slice();
    return filterAndSort(items, {
      query: searchTerm,
      getKeys: (r) => [r.bill_no, r.supplier_name, r.po_no],
    });
  }, [items, searchTerm]);

  const { sorted: sortedFiltered, sortKey, sortDir, toggle } = useSort(filtered, "created_at", "desc");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Purchase Bills - {billType}
          </h1>
          <p className="text-sm mt-1">Record and manage supplier bills</p>
        </div>
        <div className="flex gap-2 items-center">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          <Link to="/purchase?section=Procurement" className="btn btn-secondary">
            Return to Menu
          </Link>
          {canPerformAction(
            billType === "IMPORT"
              ? "purchase:purchase-bills-import"
              : "purchase:purchase-bills-local",
            "create",
          ) && (
            <Link
              to={`/purchase/purchase-bills-${billType.toLowerCase()}/new`}
              className="btn-success"
            >
              + New Bill
            </Link>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by bill no / supplier / PO..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card-body overflow-x-auto">
          <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr>
                <SortableHeader label="Bill No" sortKey="bill_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Date" sortKey="bill_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Supplier" sortKey="supplier_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="PO" sortKey="po_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="GRN" sortKey="grn_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="NET" sortKey="total_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                <SortableHeader label="Tax" sortKey="tax_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                <SortableHeader label="TOTAL" sortKey="net_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                <SortableHeader label="Payment Status" sortKey="payment_status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <th>Attachments</th>
                <th>Actions</th>
                <SortableHeader label="Created By" sortKey="created_by_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="14"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="14" className="text-center py-8 text-red-600">
                    {error}
                  </td>
                </tr>
              ) : null}

              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan="14"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    No records
                  </td>
                </tr>
              ) : (
                sortedFiltered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.bill_no}</td>
                    <td>
                      {r.bill_date
                        ? new Date(r.bill_date).toLocaleDateString()
                        : ""}
                    </td>
                    <td>{r.supplier_name}</td>
                    <td>{r.po_no || "-"}</td>
                    <td>
                      {r.grn_no ? (
                        r.grn_no
                      ) : r.grn_id ? (
                        <Link
                          to={`/inventory/grn-${billType.toLowerCase()}/${r.grn_id}?mode=view`}
                          className="text-brand hover:text-brand-600 text-sm font-medium"
                        >
                          {r.grn_no || String(r.grn_id)}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="text-right font-medium">
                      {Number(r.total_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      {Number(r.tax_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right font-medium">
                      {Number(r.net_amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <span
                        className={`badge ${getPaymentBadge(
                          String(r.payment_status || ""),
                        )}`}
                      >
                        {String(r.payment_status || "") || "-"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-outline text-xs py-1 px-2"
                        onClick={() => {
                          setActiveDocType("purchase-bill");
                          setActiveDocId(r.id);
                          setShowAttach(true);
                        }}
                      >
                        Attachments
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {canPerformAction(
                          billType === "IMPORT"
                            ? "purchase:purchase-bills-import"
                            : "purchase:purchase-bills-local",
                          "view",
                        ) && (
                          <Link
                            to={`/purchase/purchase-bills-${billType.toLowerCase()}/${r.id}?mode=view`}
                            className="text-brand hover:text-brand-600 dark:text-brand-300 dark:hover:text-brand-200 text-sm font-medium"
                          >
                            View
                          </Link>
                        )}
                        <button
                          type="button"
                          className="text-slate-700 hover:text-slate-900 text-sm font-medium"
                          title="Print"
                          onClick={() => openPreview(r)}
                        >
                          Print
                        </button>
                        <button
                          type="button"
                          className="text-slate-700 hover:text-slate-900 text-sm font-medium"
                          title="PDF"
                          onClick={() => openPreview(r, { autoDownload: true })}
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          className={`inline-flex items-center px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold ${!exceptionalPerms?.has?.("PURCHASE.BILL.CANCEL") ? 'invisible pointer-events-none' : ''}`}
                          title="Cancel"
                          onClick={async () => {
                            try {
                              await api.post(
                                `/purchase/bills/${r.id}/cancel-accounting`,
                              );
                              toast.success("Purchase bill cancelled");
                              setItems((prev) =>
                                prev.filter(
                                  (x) => Number(x.id) !== Number(r.id),
                                ),
                              );
                            } catch (e) {
                              toast.error(
                                e?.response?.data?.message ||
                                  "Failed to cancel purchase bill",
                              );
                            }
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                    <td>{r.created_by_name || "-"}</td>
                    <td>
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 p-4 bg-base-100 rounded-lg shadow-sm border border-base-200">
            <span className="text-sm text-base-content/70">
              Showing page {page} of {totalPages}
              {totalCount > 0 && ` (${totalCount} total bills)`}
            </span>
            <div className="join">
              <button
                className="join-item btn btn-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                «
              </button>
              <button className="join-item btn btn-sm">Page {page}</button>
              <button
                className="join-item btn btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setActiveDocId(null);
          setActiveDocType(null);
        }}
        docType={activeDocType || "purchase-bill"}
        docId={activeDocId}
      />
      <PrintPreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewHtml("");
          setPreviewBill(null);
        }}
        html={previewHtml}
        downloading={downloading}
        onDownload={downloadFromPreview}
      />
    </div>
  );
}
