/**
 * @fileoverview NotificationsPage component.
 * Displays a list of user notifications, allowing them to mark as read and navigate to relevant links.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { toast } from "react-toastify";

/**
 * NotificationsPage component
 * Fetches and displays notifications, handles selection and marking as read.
 * 
 * @returns {JSX.Element} The rendered notifications page.
 */
export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const navigate = useNavigate();

  const unread = useMemo(
    () => items.filter((n) => Number(n.is_read) !== 1).length,
    [items],
  );
  const visibleItems = useMemo(
    () => items.filter((n) => Number(n.is_read) !== 1),
    [items],
  );

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/workflows/notifications");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      setSelectedIds(new Set());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id) {
    try {
      await api.put(`/workflows/notifications/${id}/read`);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)),
      );
      try {
        window.dispatchEvent(
          new CustomEvent("omni:notifications:decrement", {
            detail: { count: 1 },
          }),
        );
        const raw =
          typeof localStorage !== "undefined"
            ? localStorage.getItem("omni.unread_notification_count")
            : null;
        const cur = Number(raw || "0");
        const next = Math.max(0, (Number.isFinite(cur) ? cur : 0) - 1);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("omni.unread_notification_count", String(next));
        }
      } catch {}
    } catch {}
  }

  async function markSelectedRead() {
    if (selectedIds.size === 0) return;
    try {
      const idsArray = Array.from(selectedIds);
      await api.put(`/workflows/notifications/read-bulk`, { ids: idsArray });
      setItems((prev) =>
        prev.map((n) => (selectedIds.has(n.id) ? { ...n, is_read: 1 } : n)),
      );
      try {
        window.dispatchEvent(
          new CustomEvent("omni:notifications:decrement", {
            detail: { count: idsArray.length },
          }),
        );
        const raw =
          typeof localStorage !== "undefined"
            ? localStorage.getItem("omni.unread_notification_count")
            : null;
        const cur = Number(raw || "0");
        const next = Math.max(0, (Number.isFinite(cur) ? cur : 0) - idsArray.length);
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("omni.unread_notification_count", String(next));
        }
      } catch {}
      setSelectedIds(new Set());
      toast.success(`Marked ${idsArray.length} notifications as read`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to mark as read");
    }
  }

  const allVisibleSelected =
    visibleItems.length > 0 &&
    visibleItems.every((n) => selectedIds.has(n.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      const newSet = new Set(selectedIds);
      visibleItems.forEach((n) => newSet.add(n.id));
      setSelectedIds(newSet);
    }
  }

  function toggleSelect(id) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              Notifications
            </h1>
            <p className="text-slate-500 mt-1">
              {unread} unread • {items.length} total
            </p>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button className="btn btn-primary" onClick={markSelectedRead}>
                Mark {selectedIds.size} as Read
              </button>
            )}
            <Link to="/" className="btn btn-secondary">
              Home
            </Link>
            <button
              className="btn btn-outline"
              onClick={load}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    disabled={visibleItems.length === 0}
                  />
                </th>
                <th>Title</th>
                <th>Message</th>
                <th>Created</th>
                <th>Status</th>
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
              ) : visibleItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500">
                    No notifications
                  </td>
                </tr>
              ) : (
                visibleItems.map((n) => (
                  <tr
                    key={n.id}
                    className={`hover ${selectedIds.has(n.id) ? "bg-brand-50 dark:bg-brand-900/20" : ""}`}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                        checked={selectedIds.has(n.id)}
                        onChange={() => toggleSelect(n.id)}
                      />
                    </td>
                    <td 
                      className="font-medium cursor-pointer"
                      onClick={async () => {
                        if (!n.link) return;
                        try {
                          if (Number(n.is_read) !== 1) {
                            await api.put(
                              `/workflows/notifications/${n.id}/read`,
                            );
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === n.id ? { ...x, is_read: 1 } : x,
                              ),
                            );
                            try {
                              window.dispatchEvent(
                                new CustomEvent("omni:notifications:decrement", {
                                  detail: { count: 1 },
                                }),
                              );
                              const raw =
                                typeof localStorage !== "undefined"
                                  ? localStorage.getItem(
                                      "omni.unread_notification_count",
                                    )
                                  : null;
                              const cur = Number(raw || "0");
                              const next = Math.max(
                                0,
                                (Number.isFinite(cur) ? cur : 0) - 1,
                              );
                              if (typeof localStorage !== "undefined") {
                                localStorage.setItem(
                                  "omni.unread_notification_count",
                                  String(next),
                                );
                              }
                            } catch {}
                          }
                        } catch {}
                        navigate(n.link);
                      }}
                    >{n.title}</td>
                    <td
                      className="cursor-pointer"
                      onClick={() => {
                        toggleSelect(n.id);
                      }}
                    >{n.message}</td>
                    <td
                      className="cursor-pointer"
                      onClick={() => {
                        toggleSelect(n.id);
                      }}
                    >
                      {n.created_at
                        ? new Date(n.created_at).toLocaleString()
                        : "-"}
                    </td>
                    <td>
                      {Number(n.is_read) === 1 ? (
                        <span className="badge bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-800">
                          Read
                        </span>
                      ) : (
                        <span className="badge bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800">
                          Unread
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {n.link ? (
                          <button
                            className="btn btn-ghost btn-xs text-blue-600"
                            onClick={async () => {
                              try {
                                if (Number(n.is_read) !== 1) {
                                  await api.put(
                                    `/workflows/notifications/${n.id}/read`,
                                  );
                                  setItems((prev) =>
                                    prev.map((x) =>
                                      x.id === n.id ? { ...x, is_read: 1 } : x,
                                    ),
                                  );
                                }
                              } catch {}
                              navigate(n.link);
                            }}
                            title="Open"
                          >
                            Open
                          </button>
                        ) : null}
                        {Number(n.is_read) !== 1 ? (
                          <button
                            className="btn btn-ghost btn-xs text-slate-600"
                            onClick={() => markRead(n.id)}
                            title="Mark Read"
                          >
                            Mark Read
                          </button>
                        ) : null}
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
