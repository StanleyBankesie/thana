/**
 * @fileoverview DriverPerformanceReport component.
 * Senior Data Analyst report page for Driver Performance & Ratings in Transport module.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, UserCheck, Award, AlertTriangle, RefreshCw, Download, Printer } from "lucide-react";
import api from "../../../../api/client.js";

export default function DriverPerformanceReport() {
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
      console.error("Failed to load driver performance report:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const analytics = data?.analytics || {};
  const drivers = analytics.driverPerformance || [];

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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300">
              Driver Analytics
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              Driver Performance & Ratings Report
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Trip completion throughput, mileage logged, and schedule delay history per driver.
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
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
          >
            <Printer size={16} />
            Print Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Active Drivers
          </span>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {loading ? "..." : analytics.totalDrivers || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Registered fleet drivers</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Available Drivers
          </span>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {loading ? "..." : analytics.availableDrivers || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Ready in yard for dispatch</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            On Trip
          </span>
          <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            {loading ? "..." : analytics.onTripDrivers || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Currently in transit</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
            Average Trips / Driver
          </span>
          <p className="text-3xl font-extrabold text-teal-600 dark:text-teal-400 mt-1">
            {loading ? "..." : (analytics.totalDrivers ? (analytics.totalTrips / analytics.totalDrivers).toFixed(1) : "0")}
          </p>
          <p className="text-xs text-slate-500 mt-1">Trips assigned per driver</p>
        </div>
      </div>

      {/* Driver Performance Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Driver Execution Ranking & Throughput
          </h3>
          <p className="text-xs text-slate-500">
            Trips completed, total mileage logged, and delay incident rate.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Loading driver performance metrics...
          </div>
        ) : drivers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No driver activity recorded yet. Assign drivers to trips to build performance logs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-3 px-4">Driver Name</th>
                  <th className="py-3 px-4">Total Trips</th>
                  <th className="py-3 px-4">Completed</th>
                  <th className="py-3 px-4">Completion Rate</th>
                  <th className="py-3 px-4">Distance Driven</th>
                  <th className="py-3 px-4">Revenue Generated</th>
                  <th className="py-3 px-4">Delayed Trips</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {drivers.map((d, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {d.name}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold">
                      {d.total}
                    </td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                      {d.completed}
                    </td>
                    <td className="py-3 px-4 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-teal-500 h-full"
                            style={{ width: `${Math.min(100, Number(d.completionRate))}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          {d.completionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      {d.distance.toLocaleString()} km
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                      GHS {d.revenue.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      {d.delayed > 0 ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          ⚠️ {d.delayed} delayed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          ✓ On Schedule
                        </span>
                      )}
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
