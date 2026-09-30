/**
 * @fileoverview RequestForQuotationList component.
 * Provides functionality for RequestForQuotationList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";
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
export default function RequestForQuotationList() {
  const [viewMode, setViewMode] = useViewMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    api
      .get("/purchase/rfqs")
      .then((res) => {
        if (!mounted) return;
        setRfqs(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load RFQs"
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const getStatusBadge = (status) => {
    const statusConfig = {
      DRAFT: "badge-neutral",
      SENT: "badge-info",
      EXPIRED: "badge-error",
      CLOSED: "badge-success",
    };
    return statusConfig[status] || "badge-info";
  };

  const filteredRfqs = useMemo(() => {
    const base =
      statusFilter === "ALL"
        ? rfqs.slice()
        : rfqs.filter((rfq) => rfq.status === statusFilter);
    if (!searchTerm.trim()) return base;
    return filterAndSort(base, {
      query: searchTerm,
      getKeys: (rfq) => [rfq.rfq_no, rfq.delivery_terms],
    });
  }, [rfqs, searchTerm, statusFilter]);

  const { sorted: sortedRfqs, sortKey, sortDir, toggle } = useSort(filteredRfqs, "created_at", "desc");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Request for Quotation (RFQ)
          </h1>
          <p className="text-sm mt-1">
            Create and send RFQs to suppliers for competitive bidding
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          <Link to="/purchase?section=Procurement" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link to="/purchase/rfqs/new" className="btn-success">
            + New RFQ
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by RFQ no or delivery terms..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent</option>
                <option value="EXPIRED">Expired</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>
        </div>
        <div className="card-body overflow-x-auto">
          <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr>
                <th>RFQ No</th>
                <th>Date</th>
                <th>Expiry Date</th>
                <th>Delivery Terms</th>
                <th>Suppliers</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
                            <th>Created By</th>
              <th>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="9"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-red-600">
                    {error}
                  </td>
                </tr>
              ) : null}
              {filteredRfqs.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    No RFQs found
                  </td>
                </tr>
              ) : (
                filteredRfqs.map((rfq) => (
                  <tr key={rfq.id}>
                    <td className="font-medium">{rfq.rfq_no}</td>
                    <td>
                      {new Date(rfq.rfq_date).toLocaleDateString()}
                    </td>
                    <td>
                      {rfq.expiry_date
                        ? new Date(rfq.expiry_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{rfq.delivery_terms || "-"}</td>
                    <td>{rfq.supplier_count || 0}</td>
                    <td>
                      <span
                        className={`badge ${getStatusBadge(rfq.status)}`}
                      >
                        {rfq.status}
                      </span>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <div className="min-w-[80px]">
                          <Link
                            to={`/purchase/rfqs/${rfq.id}`}
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                          >
                            View
                          </Link>
                        </div>
                        {rfq.status !== "SENT" && (
                          <div className="min-w-[80px]">
                            <Link
                              to={`/purchase/rfqs/${rfq.id}/edit`}
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                            >
                              Edit
                            </Link>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{rfq.created_by_name || "-"}</td>
                    <td>{rfq.created_at ? new Date(rfq.created_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="card-body border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <span>
              Showing {filteredRfqs.length} of {rfqs.length}{" "}
              RFQs
            </span>
            <div className="flex gap-2">
              <button className="btn-success px-3 py-1.5" disabled>
                Previous
              </button>
              <button className="btn-success px-3 py-1.5" disabled>
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
