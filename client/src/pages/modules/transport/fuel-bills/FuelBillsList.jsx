/**
 * @fileoverview FuelBillsList component.
 * Provides functionality for FuelBillsList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function FuelBillsList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const { canPerformAction } = usePermission();
  const successMsg = location.state?.success || "";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get("/transport/fuel-bills")
      .then((res) => {
        setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
      })
      .catch((err) => {
        setError(
          err?.response?.data?.message || "Failed to load service bills",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const base =
      statusFilter === "ALL"
        ? items.slice()
        : items.filter(
            (r) => String(r.status || "").toUpperCase() === statusFilter,
          );
    const q = String(searchTerm || "").trim();
    if (!q) return base;
    return filterAndSort(base, {
      query: q,
      getKeys: (r) => [r.bill_no, r.client_name],
    });
  }, [items, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Fuel Bills
          </h1>
          <p className="text-sm mt-1">Prepare and manage service bills</p>
        </div>
        <div className="flex gap-2">
          <Link to="/service-management" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link to="/transport/fuel-bills/new" className="btn-success">
            + New Bill
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {successMsg ? (
            <div className="mb-3 p-3 rounded bg-green-50 border border-green-200 text-green-700 text-sm">
              {successMsg}
            </div>
          ) : null}

          {error ? (
            <div className="mb-3 text-sm text-red-600">{error}</div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input
              type="text"
              placeholder="Search by bill no or client..."
              className="input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="POSTED">Posted</option>
              <option value="COMPLETED">Completed</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                  <th>Created By</th>
                  <th>Created Date</th>
                  <th>Attachments</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center text-slate-500 dark:text-slate-400"
                    >
                      No service bills
                    </td>
                  </tr>
                ) : null}

                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.bill_no}</td>
                    <td>{r.bill_date}</td>
                    <td>{r.supplier_name || r.client_name || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          String(r.payment_status || "").toUpperCase() === "PAID"
                            ? "badge-success"
                            : "badge-warning"
                        }`}
                      >
                        {String(r.payment_status || "UNPAID").toUpperCase()}
                      </span>
                    </td>
                    <td className="text-right">
                      {Number(r.total_amount || 0).toFixed(2)}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          String(r.status || "").toUpperCase() === "POSTED"
                            ? "badge-info"
                            : String(r.status || "").toUpperCase() === "COMPLETED"
                              ? "badge-success"
                              : String(r.status || "").toUpperCase() === "PAID"
                                ? "badge-success"
                                : String(r.status || "").toUpperCase() === "OVERDUE"
                                  ? "badge-error"
                                  : "badge-warning"
                        }`}
                      >
                        {String(r.status || "").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="min-w-[80px]">
                          <Link
                            to={`/transport/fuel-bills/${r.id}?mode=view`}
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                          >
                            View
                          </Link>
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="min-w-[80px]">
                          {canPerformAction("transport:fuel-bills", "edit") && String(r.payment_status || "").toUpperCase() !== "PAID" && String(r.status || "").toUpperCase() !== "POSTED" ? (
                            <Link
                              to={`/transport/fuel-bills/${r.id}?mode=edit`}
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                            >
                              Edit
                            </Link>
                          ) : (
                            <div className="w-full h-9" />
                          )}
                        </div>

                        {/* Slot 3 & 4: Print/PDF (Blank) */}
                        <div className="min-w-[80px]">
                          <div className="w-full h-9" />
                        </div>
                        <div className="min-w-[80px]">
                          <div className="w-full h-9" />
                        </div>

                        {/* Slot 6: Workflow (Placeholder) */}
                        <div className="min-w-[160px]">
                          <div className="w-full h-9" />
                        </div>

                        {/* Slot 7: Cancel */}
                        <div className="min-w-[80px]">
                          {canPerformAction("transport:fuel-bills", "cancel") && String(r.payment_status || "").toUpperCase() !== "PAID" ? (
                            <button
                              type="button"
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-white bg-[#990000] rounded-lg hover:bg-[#770000] transition-colors h-9"
                              onClick={() => {
                                if (!window.confirm("Cancel this bill?")) return;
                                // Implementation would call API here
                                toast.info("Cancel API call goes here");
                              }}
                            >
                              Cancel
                            </button>
                          ) : (
                            <div className="w-full h-9" />
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{r.created_by_username || r.created_by_name || "-"}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    <td>
                      <button
                        type="button"
                        className="text-brand hover:underline font-medium text-sm"
                        onClick={() => {
                          toast.info("Attachments functionality coming soon");
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
