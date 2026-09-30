/**
 * @fileoverview POS offline reconciliation dashboard.
 * Manages the sync status of local (offline) sales, providing manual retry options.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../../api/client.js";
import { toast } from "react-toastify";
import { getUnsyncedSales, getFailedSales, deleteLocalSale } from "../../../offline/posStore.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

function sendBrowserNotification(title, body) {
  try {
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/pwa-192x192.png" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") new Notification(title, { body, icon: "/pwa-192x192.png" });
      });
    }
  } catch {}
}

/**
 * PosReconciliation component
 * Reads from IndexedDB (via posStore.js) to display unsynced or failed sales transactions,
 * and attempts automatic background syncing when returning online.
 * 
 * @returns {JSX.Element} The reconciliation view.
 */
export default function PosReconciliation() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine !== false : true);

  const load = useCallback(async () => {
    setLoading(true);
    const unsynced = await getUnsyncedSales();
    const failed = await getFailedSales();
    const all = [...unsynced.map((s) => ({ ...s, syncStatus: "pending" })), ...failed.map((s) => ({ ...s, syncStatus: "failed" }))];
    setItems(all);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-sync when coming back online
  useEffect(() => {
    const onLine = () => {
      setOnline(true);
      load().then(() => {
        // Small delay so load finishes before retry
        setTimeout(() => autoRetryAll(), 500);
      });
    };
    const offLine = () => setOnline(false);
    window.addEventListener("online", onLine);
    window.addEventListener("offline", offLine);
    return () => {
      window.removeEventListener("online", onLine);
      window.removeEventListener("offline", offLine);
    };
  }, [load]);

  // Also try auto-sync on initial mount if online and items exist
  useEffect(() => {
    if (online && items.length > 0 && !syncing) {
      const hasPending = items.some((i) => i.syncStatus === "pending" || i.syncStatus === "failed");
      if (hasPending) autoRetryAll();
    }
  }, [online, items.length]);

  async function autoRetryAll() {
    const current = await getUnsyncedSales();
    const failedItems = await getFailedSales();
    const all = [...current, ...failedItems];
    if (!all.length) return;
    setSyncing(true);
    let successCount = 0;
    let failCount = 0;
    for (const item of all) {
      try {
        const { id: _id, syncStatus: _status, createdAt: _ts, receipt_no: _rcp, updatedAt: _upd, ...payload } = item;
        await api.post("/pos/sales", payload, {
          headers: { "x-skip-offline-queue": "1" },
        });
        await deleteLocalSale(item.id);
        successCount++;
      } catch {
        failCount++;
      }
    }
    await load();
    setSyncing(false);
    if (successCount > 0) {
      toast.success(`${successCount} sale(s) synced automatically`);
    }
    if (failCount > 0) {
      sendBrowserNotification(
        "POS Sync Failed",
        `${failCount} offline sale(s) could not be synced. Open POS Reconciliation to retry.`,
      );
      toast.error(`${failCount} sale(s) failed to sync — click Retry to try again`);
    }
  }

  const handleRetry = async (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) { toast.error("Item not found"); return; }
    setSyncing(true);
    try {
      const { id: _id, syncStatus: _status, createdAt: _ts, receipt_no: _rcp, updatedAt: _upd, ...payload } = item;
      await api.post("/pos/sales", payload, {
        headers: { "x-skip-offline-queue": "1" },
      });
      await deleteLocalSale(id);
      toast.success("Sale synced successfully");
      load();
    } catch (err) {
      if (err?.response?.data) {
        toast.error(err.response.data.message || "Sync failed");
      } else {
        toast.error("Sync failed — still offline?");
      }
      load();
    }
    setSyncing(false);
  };

  const handleRetryAll = async () => {
    setSyncing(true);
    const pending = items.filter((i) => i.syncStatus === "failed" || i.syncStatus === "pending");
    let successCount = 0;
    let failCount = 0;
    for (const item of pending) {
      try {
        const { id: _id, syncStatus: _status, createdAt: _ts, receipt_no: _rcp, updatedAt: _upd, ...payload } = item;
        await api.post("/pos/sales", payload, {
          headers: { "x-skip-offline-queue": "1" },
        });
        await deleteLocalSale(item.id);
        successCount++;
      } catch {
        failCount++;
      }
    }
    const msg = successCount > 0 && failCount === 0 ? "All sales synced" : failCount > 0 ? `${successCount} synced, ${failCount} failed` : "Nothing to sync";
    toast.success(msg);
    load();
    setSyncing(false);
  };

  const handleDiscard = async (id) => {
    if (!window.confirm("Discard this offline sale? This cannot be undone.")) return;
    try {
      await deleteLocalSale(id);
      toast.success("Discarded");
      load();
    } catch { toast.error("Failed to discard"); }
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.syncStatus === filter);
  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filtered, "createdAt", "desc");
  const hasFailed = items.some((i) => i.syncStatus === "failed");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">POS Sync Reconciliation</h1>
          <p className="text-sm text-slate-600">Manage offline sales that haven't synced to the server</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.history.back()} className="btn btn-secondary">Back to POS</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          {!navigator.onLine && (
            <div className="alert alert-warning">You are offline. Sales will be queued locally and sync when connectivity returns.</div>
          )}

          <div className="flex items-center gap-4">
            <div className="text-sm font-medium">Filter:</div>
            <select className="input w-40" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Items</option>
              <option value="pending">Pending Sync</option>
              <option value="failed">Failed</option>
            </select>
            <div className="flex-1">
              {items.length > 0 && (
                <span className="text-xs text-slate-500 ml-2">
                  {online ? "\u{1F7E2} Online" : "\u{1F534} Offline"}
                </span>
              )}
            </div>
            {(items.length > 0) && (
              <button className="btn-primary" disabled={syncing} onClick={handleRetryAll}>
                {syncing ? "Syncing..." : "Retry All"}
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <div className="text-3xl mb-2">All sales are synced. No pending items.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <SortableHeader label="Date/Time" sortKey="createdAt" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <th>Items</th>
                    <SortableHeader label="Total" sortKey="grand_total" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Status" sortKey="syncStatus" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <th className="w-48">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</td>
                      <td>{item.customer_name || "Walk-in"}</td>
                      <td>{Array.isArray(item.items) ? item.items.length : Array.isArray(item.lines) ? item.lines.length : 0}</td>
                      <td className="font-medium">
                        {item.grand_total != null
                          ? Number(item.grand_total).toLocaleString("en-US", { minimumFractionDigits: 2 })
                          : item.total != null
                            ? Number(item.total).toLocaleString("en-US", { minimumFractionDigits: 2 })
                            : "-"}
                      </td>
                      <td>
                        <span className={`badge ${item.syncStatus === "failed" ? "badge-error" : "badge-warning"}`}>
                          {item.syncStatus === "failed" ? "Failed" : "Pending"}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn-outline text-xs" onClick={() => handleRetry(item.id)} disabled={syncing}>
                            Retry Sync
                          </button>
                          <button className="btn-outline text-xs text-red-600 border-red-300 hover:bg-red-50" onClick={() => handleDiscard(item.id)}>
                            Discard
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-xs text-slate-500 space-y-1">
            <p>• <strong>Pending</strong> items sync automatically when connectivity returns</p>
            <p>• <strong>Failed</strong> items receive a browser notification — click Retry to attempt again</p>
            <p>• <strong>Discard</strong> removes the sale — it will NOT be sent to the server</p>
          </div>
        </div>
      </div>
    </div>
  );
}
