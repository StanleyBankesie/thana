/**
 * @fileoverview JournalVoucherList component.
 * Provides functionality for JournalVoucherList.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { usePermission } from "../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { printDocument, downloadDocumentPdf } from "@/utils/pdfUtils.js";
import {
  ListPrintIconButton,
  ListPdfIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function JournalVoucherList() {
  const [viewMode, setViewMode] = useViewMode();
  const { canPerformAction } = usePermission();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/finance/vouchers", {
        params: { voucherTypeCode: "JV" },
      });
      setVouchers(
        Array.isArray(response.data?.items) ? response.data.items : []
      );
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching vouchers");
      console.error("Error fetching vouchers:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      DRAFT: "badge badge-warning",
      APPROVED: "badge badge-success",
      POSTED: "badge badge-info",
      CANCELLED: "badge badge-error",
    };
    return badges[status] || "badge";
  };

  const filteredVouchers = (() => {
    const base =
      statusFilter === "ALL"
        ? vouchers.slice()
        : vouchers.filter((v) => v.status === statusFilter);
    if (!searchTerm.trim()) return base;
    return filterAndSort(base, {
      query: searchTerm,
      getKeys: (v) => [v.voucher_no, v.description, v.narration, v.remarks],
    });
  })();

  const { sorted: sortedVouchers, sortKey, sortDir, toggle } = useSort(filteredVouchers, "created_at", "desc");

  if (loading) {
    return <div className="text-center py-8">Loading vouchers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Journal Vouchers
            </h1>
            <p className="text-sm mt-1">
              Manage general ledger journal entries
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/finance?section=Voucher%20Management" className="font-sans btn btn-secondary">
              Return to Menu
            </Link>
            <Link to="/finance/journal-voucher/create" className="btn-success">
              Create New
            </Link>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mx-4 mt-4">
            <span>{error}</span>
          </div>
        )}

        <div className="card-body">
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by voucher number or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-48"
            >
              <option value="ALL">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="POSTED">Posted</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <SortableHeader label="Voucher No" sortKey="voucher_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="voucher_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Description" sortKey="description" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Debit" sortKey="total_debit" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Credit" sortKey="total_credit" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th>Actions</th>
                  <SortableHeader label="Created By" sortKey="created_by_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sortedVouchers.map((voucher) => (
                  <tr key={voucher.id}>
                    <td className="font-medium">{voucher.voucher_no}</td>
                    <td>
                      {voucher.voucher_date
                        ? new Date(voucher.voucher_date).toLocaleDateString()
                        : ""}
                    </td>
                    <td>{voucher.description || voucher.narration || voucher.remarks || "-"}</td>
                    <td className="text-right">
                      {Number(voucher.total_debit || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {Number(voucher.total_credit || 0).toLocaleString()}
                    </td>
                    <td>
                      <span className={getStatusBadge(voucher.status)}>
                        {voucher.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="w-[80px]">
                          {canPerformAction("finance:journal-voucher", "view") ? (
                            <Link
                              to={`/finance/journal-voucher/${voucher.id}?mode=view`}
                              className="w-full inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors h-9"
                            >
                              View
                            </Link>
                          ) : (
                            <div className="w-full h-9" />
                          )}
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="w-[80px]">
                          {canPerformAction("finance:journal-voucher", "edit") && voucher.status === "DRAFT" ? (
                            <Link
                              to={`/finance/journal-voucher/${voucher.id}?mode=edit`}
                              className="w-full inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors h-9"
                            >
                              Edit
                            </Link>
                          ) : (
                            <div className="w-full h-9" />
                          )}
                        </div>

                        {/* Slot 3: Print */}
                        <div className="min-w-[80px]">
                          <ListPrintIconButton
                            onClick={() => printDocument(api, "voucher", voucher.id, toast)}
                          />
                        </div>

                        {/* Slot 4: PDF */}
                        <div className="min-w-[80px]">
                          <ListPdfIconButton
                            onClick={() => downloadDocumentPdf(api, "voucher", voucher.id, `JV-${voucher.voucher_no || voucher.id}.pdf`, toast)}
                          />
                        </div>

                        {/* Slot 5: Attachment */}
                        <div className="w-9">
                          <div className="w-9 h-9" />
                        </div>

                        {/* Slot 6: Workflow */}
                        <div className="min-w-[160px]">
                          <div className="w-full h-9" />
                        </div>

                        {/* Slot 7: Reverse */}
                        <div className="min-w-[100px]">
                          <div className="w-full h-9" />
                        </div>
                      </div>
                    </td>
                    <td>{voucher.created_by_name || "-"}</td>
                    <td>{voucher.created_at ? new Date(voucher.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sortedVouchers.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              No journal vouchers found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}







