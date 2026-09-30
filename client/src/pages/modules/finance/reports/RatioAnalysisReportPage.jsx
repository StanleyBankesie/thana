/**
 * @fileoverview RatioAnalysisReportPage component.
 * Provides functionality for RatioAnalysisReportPage.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function RatioAnalysisReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState("new");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/ratio-analysis", {
        params: { from: from || null, to: to || null },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const jan1 = new Date(year, 0, 1);
    setFrom(jan1.toISOString().slice(0, 10));
    setTo(today.toISOString().slice(0, 10));
    run();
  }, [pollingCounter]);
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, order, pollingCounter]);

  return (
    <div className="space-y-6 p-4">
      {/* Modern Header */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <button onClick={() => window.history.back()} className="font-sans text-xs font-bold text-brand uppercase tracking-wider hover:text-brand-600 transition-colors"
          >
            ← Back to Finance
          </button>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-2 tracking-tight">
            Ratio Analysis
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Key financial performance indicators and health metrics
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => window.print()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 012-2H5a2 2 0 012 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2-2v4h10z" />
            </svg>
            Print
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm shadow-sm"
            onClick={() => {
              if (!items.length) return;
              const ws = XLSX.utils.json_to_sheet(items);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Ratios");
              XLSX.writeFile(wb, "ratio-analysis.xlsx");
            }}
            disabled={!items.length}
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Analysis Date:</span>
            <input
              className="input input-bordered input-sm focus:ring-brand focus:border-brand"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm text-brand font-bold"
            onClick={() => setTo("")}
            disabled={loading}
          >
            Reset
          </button>
          {loading && <span className="loading loading-spinner loading-sm text-brand"></span>}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {items.map((r) => (
              <div key={r.code} className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand dark:hover:border-brand transition-all hover:shadow-md p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand transition-colors">
                      {r.code}
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                      {r.name}
                    </h3>
                  </div>
                  <div className={`badge badge-sm font-bold ${
                    r.value >= 1 ? 'badge-success' : 'badge-warning'
                  }`}>
                    {r.value >= 1 ? 'Strong' : 'Review'}
                  </div>
                </div>
                
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900 dark:text-slate-50">
                    {Number(r.value || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-xs font-bold text-slate-400 uppercase">Ratio</span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {r.description || "No description available for this metric."}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {items.length === 0 && !loading && (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-slate-400 italic">No ratio data available for the selected date.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
