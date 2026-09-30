/**
 * @fileoverview SLAComplianceReport component.
 * Provides functionality for SLAComplianceReport.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SLAComplianceReport() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState({
    total_requests: 0,
    within_sla: 0,
    breached_sla: 0,
    sla_compliance_percent: 0,
  });

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/service-management/reports/sla-compliance", {
        params: { from: from || null, to: to || null },
      });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
      setMetrics(res?.data?.metrics || metrics);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, [pollingCounter]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              SLA Compliance
            </h1>
            <p className="text-sm mt-1">
              Monitor Service Level Agreement performance
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
            <div className="flex items-end">
              <button
                type="button"
                className="btn"
                onClick={run}
                disabled={loading}
              >
                {loading ? "Running..." : "Run"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Total Requests</div>
              <div className="text-2xl font-bold">
                {metrics.total_requests || 0}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Within SLA</div>
              <div className="text-2xl font-bold">
                {metrics.within_sla || 0}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">Breached SLA</div>
              <div className="text-2xl font-bold">
                {metrics.breached_sla || 0}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-500">SLA Compliance %</div>
              <div className="text-2xl font-bold">{`${metrics.sla_compliance_percent || 0}%`}</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Request No</th>
                  <th>Customer</th>
                  <th>SLA Due Date</th>
                  <th>Completion Date</th>
                  <th>Delay</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.request_no}</td>
                    <td>{r.customer || "-"}</td>
                    <td>{r.sla_due_date || "-"}</td>
                    <td>{r.completion_date || "-"}</td>
                    <td>{r.delay || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">
                      No records
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
