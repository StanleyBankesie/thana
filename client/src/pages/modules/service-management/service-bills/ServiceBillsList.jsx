/**
 * @fileoverview ServiceBillsList component.
 * Provides functionality for ServiceBillsList.
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
export default function ServiceBillsList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const { canPerformAction, exceptionalPerms } = usePermission();
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
      .get("/purchase/service-bills")
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
            Service Bills
          </h1>
          <p className="text-sm mt-1">Prepare and manage service bills</p>
        </div>
        <div className="flex gap-2">
          <Link to="/service-management?section=Reports%20%26%20Parameters" className="btn btn-secondary">
            Return to Menu
          </Link>
          <Link to="/service-management/service-bills/new" className="btn-success">
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
                  <th className="whitespace-nowrap">No</th>
                  <th className="whitespace-nowrap">Date</th>
                  <th className="whitespace-nowrap">Client</th>
                  <th className="whitespace-nowrap">Payment</th>
                  <th className="whitespace-nowrap">Total</th>
                  <th className="whitespace-nowrap">Status</th>
                  <th className="text-right whitespace-nowrap">Actions</th>
                  <th className="whitespace-nowrap">Created By</th>
                  <th className="whitespace-nowrap">Created Date</th>
                  <th className="whitespace-nowrap">Attachments</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center py-8 text-slate-500 dark:text-slate-400 whitespace-nowrap"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}

                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="text-center text-slate-500 dark:text-slate-400 whitespace-nowrap"
                    >
                      No service bills
                    </td>
                  </tr>
                ) : null}

                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{r.bill_no}</td>
                    <td className="whitespace-nowrap">{r.bill_date}</td>
                    <td className="whitespace-nowrap">{r.supplier_name || r.client_name || "-"}</td>
                    <td className="whitespace-nowrap">
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
                    <td className="text-right whitespace-nowrap">
                      {Number(r.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap">
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
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="min-w-[80px]">
                          <Link
                            to={`/purchase/service-bills/${r.id}?mode=view`}
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                          >
                            View
                          </Link>
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="min-w-[80px]">
                          {canPerformAction("service-management:service-bills", "edit") && String(r.payment_status || "").toUpperCase() !== "PAID" && String(r.status || "").toUpperCase() !== "POSTED" ? (
                            <Link
                              to={`/purchase/service-bills/${r.id}?mode=edit`}
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
                          {canPerformAction("service-management:service-bills", "cancel") && String(r.payment_status || "").toUpperCase() !== "PAID" && exceptionalPerms?.has?.("SERVICE.BILL.CANCEL") ? (
                            <button
                              type="button"
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-white bg-[#990000] rounded-lg hover:bg-[#770000] transition-colors h-9"
                              onClick={() => {
                                if (!window.confirm("Cancel this bill?")) return;
                                api.put(`/purchase/service-bills/${r.id}`, { status: "CANCELLED" })
                                  .then(() => {
                                    toast.success("Service bill cancelled");
                                    setItems(items.map((i) => (i.id === r.id ? { ...i, status: "CANCELLED" } : i)));
                                  })
                                  .catch((err) => {
                                    toast.error(err?.response?.data?.message || "Failed to cancel service bill");
                                  });
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
                    <td className="whitespace-nowrap">{r.created_by_username || r.created_by_name || "-"}</td>
                    <td className="whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    <td className="whitespace-nowrap">
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
