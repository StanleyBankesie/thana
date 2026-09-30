// Force HMR reload
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

const CACHE_KEY = "svc-confirmations-cache";
function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}
function clearCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}

export default function ServiceConfirmationsList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const modulePath = location.pathname.startsWith("/purchase")
    ? "/purchase"
    : "/service-management";
  const permPrefix = location.pathname.startsWith("/purchase")
    ? "purchase"
    : "service-management";
  const permKey = `${permPrefix}:service-confirmations`;

  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [pendingExecutions, setPendingExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showConfirmed, setShowConfirmed] = useState(false);
  const { canPerformAction } = usePermission();
  const mountedRef = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    clearCache();
    try {
      const [confRes, orderRes, execRes] = await Promise.all([
        api
          .get("/purchase/service-confirmations")
          .catch(() => ({ data: { items: [] } })),
        api
          .get("/purchase/service-orders", { params: { type: "EXTERNAL" } })
          .catch(() => ({ data: { items: [] } })),
        api
          .get("/purchase/service-executions", { params: { type: "EXTERNAL" } })
          .catch(() => ({ data: { items: [] } })),
      ]);
      if (!mountedRef.current) return;

      const confirmations = Array.isArray(confRes.data?.items)
        ? confRes.data.items
        : [];
      const allOrders = Array.isArray(orderRes.data?.items)
        ? orderRes.data.items
        : [];
      const allExecs = Array.isArray(execRes.data?.items)
        ? execRes.data.items
        : [];

      const pending = allOrders.filter(
        (o) => String(o.status || "").toUpperCase() !== "DONE",
      );
      const pendingExec = allExecs.filter((e) =>
        ["POSTED", "APPROVED"].includes(String(e.status || "").toUpperCase()),
      );

      setItems(confirmations);
      setPendingOrders(pending);
      setPendingExecutions(pendingExec);
      writeCache({
        items: confirmations,
        pendingOrders: pending,
        pendingExecutions: pendingExec,
      });
    } catch (e) {
      if (!mountedRef.current) return;
      setError(
        e?.response?.data?.message || "Failed to load service confirmations",
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => {
      mountedRef.current = false;
    };
  }, [loadData]);

  const q = searchTerm.trim().toLowerCase();
  const filter = (arr, fields) =>
    arr.filter(
      (r) =>
        !q ||
        fields.some((f) =>
          String(r[f] || "")
            .toLowerCase()
            .includes(q),
        ),
    );

  const filtered = filter(items, [
    "sc_no",
    "order_no",
    "supplier_name",
    "status",
  ]);
  const filteredPendingOrders = filter(pendingOrders, [
    "order_no",
    "customer_name",
    "service_type",
    "status",
  ]);
  const filteredPendingExecs = filter(pendingExecutions, [
    "execution_no",
    "order_no",
    "customer_name",
    "status",
  ]);

  const hasAny =
    filtered.length +
      filteredPendingOrders.length +
      filteredPendingExecs.length >
    0;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Service Confirmation
              </h1>
              <p className="text-sm mt-1">Confirm service receipts</p>
            </div>
            <div className="flex gap-2">
              {!showConfirmed && (
                <Link to={modulePath} className="btn btn-secondary">
                  Return to Menu
                </Link>
              )}
              <button
                type="button"
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  showConfirmed
                    ? "bg-green-700 text-white hover:bg-green-800"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
                onClick={() => setShowConfirmed((prev) => !prev)}
              >
                {showConfirmed
                  ? "Back to Unconfirmed Orders"
                  : "View Confirmed Orders"}
              </button>
            </div>
          </div>
        </div>
        <div className="card-body">
          {error && <div className="text-sm text-red-600 mb-4">{error}</div>}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by no, supplier, status..."
              className="input max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading && !hasAny ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : !hasAny ? (
            <div className="text-center py-8 text-slate-500">
              No records found
            </div>
          ) : null}
        </div>
      </div>

      {/* Pending Service Orders - hidden when viewing confirmed */}
      {!showConfirmed && filteredPendingOrders.length > 0 && (
        <div className="card bg-white">
          <div className="card-header bg-white border-b rounded-t-lg">
            <h2 className="text-sm font-semibold text-slate-700">
              Pending Service Orders (Ready for Confirmation)
            </h2>
          </div>
          <div className="card-body p-0">
            
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
              <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
                <thead>
                  <tr>
                    <th className="whitespace-nowrap">No</th>
                    <th className="whitespace-nowrap">Date</th>
                    <th className="whitespace-nowrap">Customer</th>
                    <th className="whitespace-nowrap">Total</th>
                    <th className="whitespace-nowrap">Status</th>
                    <th className="whitespace-nowrap">Actions</th>
                    <th className="whitespace-nowrap">Created By</th>
                    <th className="whitespace-nowrap">Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingOrders.map((o) => (
                    <tr key={`order-${o.id}`}>
                      <td className="font-medium text-blue-700 dark:text-blue-300 whitespace-nowrap">
                        {o.order_no || "-"}
                      </td>
                      <td className="whitespace-nowrap">
                        {o.order_date ? String(o.order_date).slice(0, 10) : "-"}
                      </td>
                      <td className="whitespace-nowrap">{o.customer_name || "-"}</td>
                      <td className="whitespace-nowrap">{Number(o.total_amount || 0).toFixed(2)}</td>
                      <td className="whitespace-nowrap">
                        <span className="badge badge-info">
                          {o.status || "-"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex gap-2 items-center">
                          <button
                            type="button"
                            onClick={() =>
                              (window.location.href = `${modulePath}/service-confirmation/new?order_id=${o.id}`)
                            }
                            className="bg-green-600 text-white px-3 py-1 rounded"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              (window.location.href = `${modulePath}/service-confirmation/new?order_id=${o.id}&mode=view`)
                            }
                            className="bg-brand-800 text-white px-3 py-1 rounded"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              (window.location.href = `${modulePath}/service-confirmation/new?order_id=${o.id}&mode=edit`)
                            }
                            className="bg-amber-600 text-white px-3 py-1 rounded"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">{o.created_by_name || "-"}</td>
                      <td className="whitespace-nowrap">
                        {o.created_at
                          ? new Date(o.created_at).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pending Service Executions - hidden when viewing confirmed */}
      {!showConfirmed && filteredPendingExecs.length > 0 && (
        <div className="card">
          <div className="card-header bg-amber-500 text-white rounded-t-lg">
            <h2 className="text-sm font-semibold">
              Pending Service Executions (Ready for Confirmation)
            </h2>
          </div>
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
                <thead>
                  <tr>
                    <th className="whitespace-nowrap">No</th>
                    <th className="whitespace-nowrap">Date</th>
                    <th className="whitespace-nowrap">Customer</th>
                    <th className="whitespace-nowrap">Total</th>
                    <th className="whitespace-nowrap">Status</th>
                    <th className="whitespace-nowrap">Actions</th>
                    <th className="whitespace-nowrap">Created By</th>
                    <th className="whitespace-nowrap">Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingExecs.map((e) => (
                    <tr
                      key={`exec-${e.id}`}
                      className="bg-amber-50/30 dark:bg-amber-900/10"
                    >
                      <td className="font-medium text-amber-700 dark:text-amber-300 whitespace-nowrap">
                        {e.execution_no || "-"}
                      </td>
                      <td className="whitespace-nowrap">
                        {e.execution_date
                          ? String(e.execution_date).slice(0, 10)
                          : "-"}
                      </td>
                      <td className="whitespace-nowrap">{e.customer_name || e.order_no || "-"}</td>
                      <td className="whitespace-nowrap">-</td>
                      <td className="whitespace-nowrap">
                        <span className="badge badge-info">
                          {e.status || "-"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex gap-2 items-center">
                          <Link
                            to={`${modulePath}/service-confirmation/new?execution_id=${e.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                          >
                            Confirm
                          </Link>
                          <Link
                            to={`${modulePath}/service-confirmation/new?execution_id=${e.id}&mode=view`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-brand bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors whitespace-nowrap"
                          >
                            View
                          </Link>
                          <Link
                            to={`${modulePath}/service-confirmation/new?execution_id=${e.id}&mode=edit`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">{e.created_by_name || "-"}</td>
                      <td className="whitespace-nowrap">
                        {e.created_at
                          ? new Date(e.created_at).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmed Service Confirmations */}
      {showConfirmed && (
        <div className="card">
          <div className="card-header bg-white border-b rounded-t-lg">
            <h2 className="text-sm font-semibold text-slate-700">
              Confirmed Service Orders
            </h2>
          </div>
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
                <thead>
                  <tr>
                    <th className="whitespace-nowrap">SC No</th>
                    <th className="whitespace-nowrap">Order No</th>
                    <th className="whitespace-nowrap">Date</th>
                    <th className="whitespace-nowrap">Supplier</th>
                    <th className="whitespace-nowrap">Total</th>
                    <th className="whitespace-nowrap">Status</th>
                    <th className="whitespace-nowrap">Actions</th>
                    <th className="whitespace-nowrap">Created By</th>
                    <th className="whitespace-nowrap">Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan="9"
                        className="text-center py-8 text-slate-500 whitespace-nowrap"
                      >
                        No confirmed records found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id}>
                        <td className="font-medium text-brand-700 dark:text-brand-300 whitespace-nowrap">
                          {c.sc_no}
                        </td>
                        <td className="whitespace-nowrap">{c.order_no || "-"}</td>
                        <td className="whitespace-nowrap">
                          {c.sc_date ? String(c.sc_date).slice(0, 10) : "-"}
                        </td>
                        <td className="whitespace-nowrap">{c.supplier_name || "-"}</td>
                        <td className="whitespace-nowrap">{Number(c.total_amount || 0).toFixed(2)}</td>
                        <td className="whitespace-nowrap">
                          <span className="badge badge-info">
                            {c.status || "DRAFT"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="flex gap-2 items-center">
                            <button
                              type="button"
                              onClick={() =>
                                (window.location.href = `${modulePath}/service-confirmation/new?confirmation_id=${c.id}&mode=view`)
                              }
                              className="bg-brand text-white px-3 py-1 text-xs font-semibold rounded hover:bg-brand-700 whitespace-nowrap"
                            >
                              View
                            </button>
                            {/* {String(c.status || "").toUpperCase() !==
                              "APPROVED" && (
                              <button
                                type="button"
                                onClick={() =>
                                  (window.location.href = `${modulePath}/service-confirmation/new?confirmation_id=${c.id}&mode=edit`)
                                }
                                className="bg-amber-600 text-white px-3 py-1 text-xs font-semibold rounded hover:bg-amber-400 whitespace-nowrap"
                              >
                                Edit
                              </button>
                            )} */}
                          </div>
                        </td>
                        <td className="whitespace-nowrap">{c.created_by_name || "-"}</td>
                        <td className="whitespace-nowrap">
                          {c.created_at
                            ? new Date(c.created_at).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
