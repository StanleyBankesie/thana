/**
 * @fileoverview ProjectOrderList component.
 * Provides functionality for ProjectOrderList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { toast } from "react-toastify";
import { filterAndSort } from "../../../../utils/searchUtils.js";
import useSort from "../../../../hooks/useSort.js";
import SortableHeader from "../../../../components/SortableHeader.jsx";
import { Plus } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import {
  ListPrintIconButton,
  ListPdfIconButton,
} from "../../../../components/list/ListDocActionIconButtons.jsx";

const STATUS_CONFIG = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  PENDING_APPROVAL: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  POSTED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  CANCELLED: "bg-slate-800 text-white dark:bg-slate-900 dark:text-slate-300",
};

function StatusBadge({ status }) {
  const s = String(status || "").toUpperCase();
  const cls = STATUS_CONFIG[s] || "bg-slate-100 text-slate-500";
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cls}`}>
      {s}
    </span>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProjectOrderList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const { canCreateOnPage } = usePermission();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/projects/project-orders");
      const items = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      setOrders(items);
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching project orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDelete = async (id, orderNo) => {
    if (!window.confirm(`Delete Project Order (${orderNo || id})? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/project-orders/${id}`);
      toast.success("Project order deleted");
      setOrders((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete project order");
    }
  };

  const handleSubmit = async (order) => {
    if (!window.confirm(`Submit Project Order (${order.order_no}) for processing?`)) return;
    try {
      await api.post(`/projects/project-orders/${order.id}/submit`);
      toast.success("Project order submitted");
      fetchOrders();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit project order");
    }
  };

  const handlePrint = async (id) => {
    try {
      const resp = await api.post(
        `/documents/project-order/${id}/render`,
        { format: "html", feature_name: "project-order" },
        { headers: { "Content-Type": "application/json" } },
      );
      const html = typeof resp.data === "string" ? resp.data : String(resp.data || "");
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.top = "0";
      iframe.style.width = "800px";
      iframe.style.height = "600px";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document || iframe.contentDocument || null;
      if (!doc) {
        document.body.removeChild(iframe);
        return;
      }
      doc.open();
      doc.write(`<style>@media print{img{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>` + html);
      doc.close();
      const win = iframe.contentWindow || window;
      const doPrint = () => {
        win.focus();
        try { win.print(); } catch {}
        setTimeout(() => { document.body.removeChild(iframe); }, 100);
      };
      const images = doc.images || [];
      if (images.length === 0) { doPrint(); return; }
      let loaded = 0;
      for (const img of images) {
        if (img.complete && img.naturalWidth > 0) { loaded++; continue; }
        img.onload = () => { loaded++; if (loaded === images.length) doPrint(); };
        img.onerror = () => { loaded++; if (loaded === images.length) doPrint(); };
      }
      if (loaded === images.length) doPrint();
    } catch {
      toast.error("Failed to render template for print");
    }
  };

  const handlePdfDownload = async (id) => {
    try {
      const resp = await api.post(
        `/documents/project-order/${id}/render`,
        { format: "html", feature_name: "project-order" },
        { headers: { "Content-Type": "application/json" } },
      );
      const html = typeof resp.data === "string" ? resp.data : String(resp.data || "");
      const { renderHtmlToPdf } = await import("../../../../utils/pdfUtils.js");
      await renderHtmlToPdf(html, `project-order-${id}.pdf`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to download PDF");
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    return filterAndSort(orders, {
      query: searchTerm,
      getKeys: (o) => [o.order_no, o.project_name, o.priority],
    });
  }, [orders, searchTerm]);

  const { sorted: filteredOrders, sortKey, sortDir, toggle } = useSort(filtered, "order_date", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Project Orders
              </h1>
              <p className="text-sm mt-1">
                Manage orders placed against projects
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/project-management?section=Reports%20%26%20Analytics" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link
                to="/project-management/project-orders/new"
                className="btn-success flex items-center gap-2"
              >
                <Plus size={16} />
                New Order
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search project orders..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary" onClick={fetchOrders}>
              Refresh
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
              {error}
            </div>
          )}

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
                <thead>
                  <tr>
                    <SortableHeader
                      label="Order No"
                      sortKey="order_no"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                    <SortableHeader
                      label="Order Date"
                      sortKey="order_date"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                    <SortableHeader
                      label="Project"
                      sortKey="project_name"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                    <SortableHeader
                      label="Priority"
                      sortKey="priority"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                    <SortableHeader
                      label="Status"
                      sortKey="status"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                    <SortableHeader
                      label="Total Amount"
                      sortKey="total_amount"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                    <th className="text-right">Actions</th>
                    <SortableHeader
                      label="Created By"
                      sortKey="created_by_name"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="text-center py-8 text-slate-400">
                        Loading project orders...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-8 text-slate-400">
                        No project orders found.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const status = String(order.status || "").toUpperCase();
                      return (
                        <tr key={order.id}>
                          <td className="font-medium">{order.order_no}</td>
                          <td>
                            {order.order_date
                              ? new Date(order.order_date).toLocaleDateString()
                              : "-"}
                          </td>
                          <td>{order.project_name || "-"}</td>
                          <td>
                            <span className="text-sm font-semibold">
                              {order.priority || "-"}
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={status} />
                          </td>
                          <td className="font-semibold text-right">
                            {order.currency || "GHS"}{" "}
                            {Number(order.total_amount || 0).toLocaleString()}
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* actions */}
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="min-w-[60px]">
                                <Link
                                  to={`/project-management/project-orders/${order.id}`}
                                  className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-brand bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors h-9"
                                >
                                  View
                                </Link>
                              </div>
                              {status === "DRAFT" && (
                                <>
                                  <div className="min-w-[40px]">
                                    <ListPrintIconButton
                                      onClick={() => handlePrint(order.id)}
                                    />
                                  </div>
                                  <div className="min-w-[40px]">
                                    <ListPdfIconButton
                                      onClick={() => handlePdfDownload(order.id)}
                                    />
                                  </div>
                                </>
                              )}
                              {status === "DRAFT" && (
                                <div className="min-w-[100px]">
                                  <button
                                    type="button"
                                    className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors h-9"
                                    onClick={() => handleSubmit(order)}
                                  >
                                    Submit
                                  </button>
                                </div>
                              )}
                              {status === "DRAFT" && (
                                <div className="min-w-[80px]">
                                  <button
                                    type="button"
                                    className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 transition-colors h-9"
                                    onClick={() =>
                                      handleDelete(order.id, order.order_no)
                                    }
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            {order.created_by_name || "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
        </div>
      </div>
    </div>
  );
}
