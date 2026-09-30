/**
 * @fileoverview LowStockNotificationsPage component.
 * Provides functionality for LowStockNotificationsPage.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client";
import { toast } from "react-toastify";
import { Mail, Package, AlertTriangle } from "lucide-react";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LowStockNotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const stats = useMemo(() => {
    const critical = items.filter(
      (i) => Number(i.qty || 0) <= Number(i.reorder_level || 0),
    ).length;
    return { total: items.length, critical };
  }, [items]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/inventory/alerts/low-stock");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function sendEmail() {
    setSending(true);
    try {
      const res = await api.post("/inventory/alerts/low-stock/notify-email");
      toast.success(res.data?.message || "Email notification sent");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <AlertTriangle className="text-red-600" /> Low Stock Alerts
            </h1>
            <p className="text-slate-500 mt-1">
              Items at or below their reorder levels
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button
              className="btn btn-primary"
              onClick={sendEmail}
              disabled={sending || loading || items.length === 0}
              title="Send email notification"
            >
              <Mail /> Send Email
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border-l-4 border-red-500">
          <h3 className="text-slate-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
            <Package /> Total Items
          </h3>
          <div className="text-3xl font-bold text-slate-800 dark:text-white">
            {stats.total}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border-l-4 border-red-600">
          <h3 className="text-slate-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
            <AlertTriangle className="text-red-600" /> At/Below Reorder
          </h3>
          <div className="text-3xl font-bold text-slate-800 dark:text-white">
            {stats.critical}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
          <h3 className="text-slate-500 text-xs font-bold uppercase mb-2">
            Actions
          </h3>
          <div className="flex gap-2">
            <Link to="/inventory/stock-reorder" className="btn btn-info btn-sm">
              Manage Reorder Points
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
          Items
        </h2>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th>Item</th>
                <th>UoM</th>
                <th className="text-right">Available Qty</th>
                <th className="text-right">Reorder Level</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-4">
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500">
                    No low stock items found
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="hover">
                    <td>
                      <div className="font-bold">{it.item_code}</div>
                      <div className="text-xs text-slate-500">
                        {it.item_name}
                      </div>
                    </td>
                    <td>{it.uom}</td>
                    <td className="text-right">{Number(it.qty || 0)}</td>
                    <td className="text-right">
                      {Number(it.reorder_level || 0)}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Link
                          to={`/inventory/items/${it.id}`}
                          className="btn btn-ghost btn-xs text-blue-600"
                          title="View Item"
                        >
                          View Item
                        </Link>
                        <Link
                          to="/inventory/stock-reorder"
                          className="btn btn-ghost btn-xs text-cyan-600"
                          title="Manage Reorder"
                        >
                          Reorder Settings
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
