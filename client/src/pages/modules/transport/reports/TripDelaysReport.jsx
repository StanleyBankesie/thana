/**
 * @fileoverview TripDelaysReport component.
 * Senior Data Analyst report page for Trip Delays & Schedule SLA Issues in Transport module.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Printer, AlertTriangle, Clock, ShieldAlert } from "lucide-react";
import api from "../../../../api/client.js";

export default function TripDelaysReport() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/transport/reports/analytics");
      if (res.data?.success || res.data?.analytics) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to load trip delays report:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const analytics = data?.analytics || {};
  const delayedTrips = (data?.items || []).filter(
    (t) => t.status === "DELAYED" || t.due_status === "OVERDUE"
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-4">
          <Link
            to="/transport"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">
              SLA Risk Intelligence
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              Trip Delays & SLA Schedule Breach Report
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Analysis of route bottlenecks, delayed schedules, and SLA delivery breaches.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
          >
            <Printer size={16} />
            Print Report
          </button>
        </div>
      </div>

      {/* KPI Highlight */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Total Delayed Trips
          </span>
          <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
            {loading ? "..." : analytics.delayedTrips || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">SLA schedule breaches</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Delay Rate %
          </span>
          <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {loading ? "..." : `${analytics.delayRate || 0}%`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Percent of total managed trips</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            On-Time Arrival Performance
          </span>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {loading ? "..." : `${analytics.onTimeRate || 0}%`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Schedule adherence rate</p>
        </div>
      </div>

      {/* Delayed Trips Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Delayed & At-Risk Trip Log ({delayedTrips.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Loading delayed trip records...
          </div>
        ) : delayedTrips.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <span className="text-2xl">🎉</span>
            <span className="font-bold text-emerald-600">Zero Schedule Delays Recorded!</span>
            <span className="text-xs text-slate-400">All managed trips are operating on schedule.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-3 px-4">Trip No</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SLA Breach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {delayedTrips.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {t.trip_number}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {t.vehicle_name}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {t.driver_name}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {t.origin_name || t.origin || "Base"} → {t.destination_name || t.destination || "Dest"}
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-600">
                      {t.status}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                        ⚠️ {t.due_label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
