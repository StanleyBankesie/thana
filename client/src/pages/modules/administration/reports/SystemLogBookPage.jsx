/**
 * @fileoverview SystemLogBookPage component.
 * Provides functionality for SystemLogBookPage.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SystemLogBookPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [quickFilter, setQuickFilter] = useState("all");
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [moduleOptions, setModuleOptions] = useState([]);
  const [status, setStatus] = useState({
    startedAt: "",
    uptimeSeconds: 0,
    uptimeHuman: "",
    database: {
      threadsConnected: 0,
      threadsRunning: 0,
      maxConnections: 0,
      loadPercent: 0,
    },
    recentLogins: [],
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get("/admin/users");
        const items = res?.data?.data?.items || res?.data?.items || [];
        setUsers(items);
      } catch {}
    }
    loadUsers();
  }, [pollingCounter]);

  async function run() {
    try {
      setLoading(true);
      const params = { from: from || null, to: to || null };
      if (quickFilter === "email") {
        params.module = [
          "WorkflowNotify",
          "DocumentForward",
          "Email",
          "Authentication",
          "Inventory",
          "EmailDiagnosis",
          "Workflow",
        ].join(",");
        params.action = [
          "EMAIL_SENT",
          "EMAIL_ERROR",
          "EMAIL_SKIPPED",
          "EMAIL_MOCK",
          "TEST_SEND_SUCCESS",
          "TEST_SEND_FAIL",
        ].join(",");
      } else if (selectedModule) {
        params.module = selectedModule;
      }
      if (userId) params.user_id = userId;
      const res = await api.get("/admin/reports/system-log-book", { params });
      const data = res.data?.items || [];
      setItems(data);
      // Collect unique module names from results
      const mods = [
        ...new Set(data.map((r) => r.module_name).filter(Boolean)),
      ].sort();
      setModuleOptions(mods);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  // Auto-filter when any filter changes (debounced)
  useEffect(() => {
    const t = setTimeout(() => run(), 300);
    return () => clearTimeout(t);
  }, [from, to, userId, selectedModule, quickFilter, pollingCounter]);
  useEffect(() => {
    let cancelled = false;
    let t = null;
    async function loadStatus() {
      try {
        setStatusLoading(true);
        const res = await api.get("/admin/system-status");
        if (cancelled) return;
        const s = res.data || {};
        setStatus({
          startedAt: String(s.startedAt || ""),
          uptimeSeconds: Number(s.uptimeSeconds || 0),
          uptimeHuman: String(s.uptimeHuman || ""),
          database: {
            threadsConnected: Number(s?.database?.threadsConnected || 0),
            threadsRunning: Number(s?.database?.threadsRunning || 0),
            maxConnections: Number(s?.database?.maxConnections || 0),
            loadPercent: Number(s?.database?.loadPercent || 0),
          },
          recentLogins: Array.isArray(s.recentLogins) ? s.recentLogins : [],
        });
      } catch (e) {
      } finally {
        setStatusLoading(false);
      }
    }
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [pollingCounter]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              System Log Book
            </h1>
            <p className="text-sm mt-1">
              Application events and user activity across modules
            </p>
          </div>
          <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-semibold">System Status</div>
              <div className="text-xs text-slate-500">
                Started{" "}
                {status.startedAt
                  ? new Date(status.startedAt).toLocaleString()
                  : "-"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm">Server Uptime</div>
              <div className="text-xl font-bold text-brand-700">
                {statusLoading ? "…" : status.uptimeHuman || "-"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg border border-slate-200 bg-white dark:bg-slate-800">
              <div className="text-sm text-slate-600">Database Load</div>
              <div className="text-2xl font-bold text-brand-700">
                {statusLoading
                  ? "…"
                  : `${Number(status.database.loadPercent || 0)}%`}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Connected: {status.database.threadsConnected} / Max:{" "}
                {status.database.maxConnections}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-white dark:bg-slate-800">
              <div className="text-sm text-slate-600">Threads Running</div>
              <div className="text-2xl font-bold text-brand-700">
                {statusLoading
                  ? "…"
                  : Number(status.database.threadsRunning || 0)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-white dark:bg-slate-800">
              <div className="text-sm text-slate-600">Recent Login</div>
              <div className="text-sm mt-1 space-y-1">
                {statusLoading && <div>Loading…</div>}
                {!statusLoading &&
                  (status.recentLogins.slice(0, 5).map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{r.username || "-"}</span>
                      <span className="text-xs text-slate-500">
                        {r.login_time
                          ? new Date(r.login_time).toLocaleString()
                          : "-"}
                      </span>
                    </div>
                  )) || (
                    <div className="text-xs text-slate-500">
                      No recent logins
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div>
              <label className="label">From</label>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="label">User</label>
              <select
                className="input"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username || u.full_name || `User #${u.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Module</label>
              <select
                className="input"
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
              >
                <option value="">All Modules</option>
                {moduleOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Quick Filter</label>
              <select
                className="input"
                value={quickFilter}
                onChange={(e) => setQuickFilter(e.target.value)}
              >
                <option value="all">All Logs</option>
                <option value="email">Email Notifications</option>
              </select>
            </div>
          </div>
          <div className="flex items-end gap-2 mb-4">
            <button
              type="button"
              className="btn-success"
              onClick={run}
              disabled={loading}
            >
              {loading ? "Running..." : "Run Report"}
            </button>
            <button
              type="button"
              className="btn-success"
              onClick={() => {
                setFrom("");
                setTo("");
                setUserId("");
                setSelectedModule("");
                setQuickFilter("all");
              }}
              disabled={loading}
            >
              Clear
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>User</th>
                  <th>Module Name</th>
                  <th>Login Date</th>
                  <th>Login Time</th>
                  <th>TCP IP</th>
                  <th>Page Name</th>
                  <th>Messages</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const dt = r.event_time ? new Date(r.event_time) : null;
                  return (
                    <tr key={r.id}>
                      <td>{r.branch_name || "-"}</td>
                      <td>{r.user_name || "-"}</td>
                      <td>{r.module_name || "-"}</td>
                      <td>{dt ? dt.toLocaleDateString() : "-"}</td>
                      <td>{dt ? dt.toLocaleTimeString() : "-"}</td>
                      <td>{r.ip_address || "-"}</td>
                      <td>{r.page_name || r.ref_no || "-"}</td>
                      <td>{r.message || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {items.length === 0 && !loading ? (
            <div className="text-center py-10">No rows.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
