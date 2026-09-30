/**
 * @fileoverview ServiceOrdersList component.
 * Provides functionality for ServiceOrdersList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { toast } from "react-toastify";
import { ListAttachmentIconButton } from "@/components/list/ListDocActionIconButtons.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ServiceOrdersList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const { canPerformAction } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const successMsg = location.state?.success || "";

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const resp = await api.get("/purchase/service-orders");
        const rows = Array.isArray(resp.data?.items) ? resp.data.items : [];
        if (mounted) setItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (mounted) {
          setError("No service order API found. Showing placeholder list.");
          setItems([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = String(search || "").trim();
    if (!q) return items.slice();
    return filterAndSort(items || [], {
      query: q,
      getKeys: (it) => [
        it.order_no,
        it.customer_name,
        it.service_type,
        it.status,
        it.work_location,
        it.project_name,
      ],
    });
  }, [items, search]);

  return (
    <div className="p-6 space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Service Orders</div>
            <div className="flex gap-2">
              <Link to="/service-management?section=Reports%20%26%20Parameters" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/service-management/service-orders/new"
                className="btn-success"
              >
                + New Order
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {successMsg ? (
            <div className="mb-3 p-3 rounded bg-green-50 border border-green-200 text-green-700 text-sm">
              {successMsg}
            </div>
          ) : null}
          {error ? (
            <div className="text-sm text-red-600 mb-3">{error}</div>
          ) : null}
          <div className="mb-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Order No</th>
                  <th className="whitespace-nowrap">Date</th>
                  <th className="whitespace-nowrap">Order Type</th>
                  <th className="whitespace-nowrap">Project</th>
                    <th className="whitespace-nowrap">Customer/Contractor</th>
                  <th className="whitespace-nowrap">Service</th>
                  <th className="whitespace-nowrap">Status</th>
                  <th className="whitespace-nowrap">Total</th>
                  <th className="text-right whitespace-nowrap">Actions</th>
                  <th className="whitespace-nowrap">Created By</th>
                  <th className="whitespace-nowrap">Created Date</th>
                </tr>
              </thead>
              <tbody>
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center text-slate-500 whitespace-nowrap">
                      No service orders
                    </td>
                  </tr>
                ) : null}
                {filtered.map((it) => (
                  <tr key={it.id}>
                    <td className="whitespace-nowrap">{it.order_no}</td>
                    <td className="whitespace-nowrap">{it.order_date}</td>
                    <td className="whitespace-nowrap">{it.order_type}</td>
                    <td className="whitespace-nowrap">{it.project_name || "-"}</td>
                      <td className="whitespace-nowrap">{it.customer_name}</td>
                    <td className="whitespace-nowrap">{it.service_type}</td>
                    <td className="whitespace-nowrap">{it.status}</td>
                    <td className="text-right whitespace-nowrap">
                      {Number(it.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="min-w-[80px]">
                          <Link
                            to={`/service-management/service-orders/${it.id}`}
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                          >
                            View
                          </Link>
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="min-w-[80px]">
                          {canPerformAction("service-management:service-orders", "edit") ? (
                            <Link
                              to={`/service-management/service-orders/${it.id}`}
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                            >
                              Edit
                            </Link>
                          ) : (
                            <div className="w-full h-9" />
                          )}
                        </div>

                        {/* Slot 3: Attachments */}
                        <div className="min-w-[80px]">
                          <ListAttachmentIconButton
                            onClick={() => {
                              toast.info("Attachments functionality coming soon");
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{it.created_by_username || it.created_by_name || it.requestor_name || "-"}</td>
                    <td className="whitespace-nowrap">{it.created_at ? new Date(it.created_at).toLocaleDateString() : "-"}</td>
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
