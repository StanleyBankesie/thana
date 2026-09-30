/**
 * @fileoverview QuotationConversionReportPage component.
 * Provides functionality for QuotationConversionReportPage.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "api/client";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function QuotationConversionReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [metrics, setMetrics] = useState({
    total_quotations: 0,
    converted_quotations: 0,
    conversion_rate_percent: 0,
    average_conversion_time_days: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/quotation-conversion", {
        params: { from: from || null, to: to || null },
      });
      setMetrics(res?.data?.metrics || metrics);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, [from, to, pollingCounter]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Quotation Conversion
            </h1>
            <p className="text-sm mt-1">Measure sales effectiveness</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
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
              
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded border">
              <div className="text-xs text-slate-500">Total Quotations</div>
              <div className="text-2xl font-bold">
                {metrics.total_quotations || 0}
              </div>
            </div>
            <div className="p-4 rounded border">
              <div className="text-xs text-slate-500">Converted Quotations</div>
              <div className="text-2xl font-bold">
                {metrics.converted_quotations || 0}
              </div>
            </div>
            <div className="p-4 rounded border">
              <div className="text-xs text-slate-500">Conversion Rate</div>
              <div className="text-2xl font-bold">
                {(metrics.conversion_rate_percent || 0) + "%"}
              </div>
            </div>
            <div className="p-4 rounded border">
              <div className="text-xs text-slate-500">Avg Conversion Time</div>
              <div className="text-2xl font-bold">
                {metrics.average_conversion_time_days == null
                  ? "—"
                  : metrics.average_conversion_time_days + " days"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

