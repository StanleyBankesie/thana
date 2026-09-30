/**
 * @fileoverview ServiceOrderStatusReport component.
 * Provides functionality for ServiceOrderStatusReport.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ServiceOrderStatusReport() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [technician, setTechnician] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/service-management/reports/order-status", {
        params: {
          from: from || null,
          to: to || null,
          technician: technician || null,
          serviceType: serviceType || null,
          status: status || null,
        },
      });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
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
              Service Order Status
            </h1>
            <p className="text-sm mt-1">Track order progress</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-red-600 text-sm mb-3">{error}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
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
              <label className="label">Technician</label>
              <input
                className="input"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                placeholder="Technician name..."
              />
            </div>
            <div>
              <label className="label">Service Type</label>
              <input
                className="input"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                placeholder="Type contains..."
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All</option>
                <option>Open</option>
                <option>In Progress</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </select>
            </div>
            <div className="md:col-span-6 flex items-end gap-2">
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
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Service Order No</th>
                  <th>Linked Request No</th>
                  <th>Assigned Technician</th>
                  <th>Order Date</th>
                  <th>Start Date</th>
                  <th>Completion Date</th>
                  <th>Status</th>
                  <th className="text-right">Estimated Cost</th>
                  <th className="text-right">Actual Cost</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.order_no}</td>
                    <td>{r.request_no || "-"}</td>
                    <td>{r.technician || "-"}</td>
                    <td>{r.order_date || "-"}</td>
                    <td>{r.start_date || "-"}</td>
                    <td>{r.completion_date || "-"}</td>
                    <td>{r.status || "-"}</td>
                    <td className="text-right">{r.estimated_cost || "-"}</td>
                    <td className="text-right">{r.actual_cost || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-slate-500">
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
