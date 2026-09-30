/**
 * @fileoverview TripProfitabilityReport component.
 * Senior Data Analyst report page for Trip Financial Profitability & Cost Margins in Transport module.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Printer, DollarSign, TrendingUp, TrendingDown, PieChart } from "lucide-react";
import api from "../../../../api/client.js";

export default function TripProfitabilityReport() {
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
      console.error("Failed to load trip profitability report:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const analytics = data?.analytics || {};
  const trips = data?.items || [];

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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
              Financial Economics
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              Trip Profitability & Margin Analysis
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Revenue billed vs trip costs, fuel expenditure, and net profit per route.
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
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
          >
            <Printer size={16} />
            Print Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Total Revenue Billed
          </span>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {loading ? "..." : `GHS ${(analytics.totalRevenue || 0).toLocaleString()}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Cumulative customer billing</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Total Trip Operating Cost
          </span>
          <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
            {loading ? "..." : `GHS ${(analytics.totalTripCost || 0).toLocaleString()}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Fuel, maintenance & driver costs</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Net Profit Margin
          </span>
          <p className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
            {loading ? "..." : `GHS ${(analytics.netProfitability || 0).toLocaleString()}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Net profit after expenses</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Profitability Ratio
          </span>
          <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            {loading
              ? "..."
              : `${
                  analytics.totalRevenue
                    ? (((analytics.totalRevenue - analytics.totalTripCost) / analytics.totalRevenue) * 100).toFixed(1)
                    : 0
                }%`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Gross profit margin %</p>
        </div>
      </div>

      {/* Financial Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Trip Profitability Ledger
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Loading financial profitability records...
          </div>
        ) : trips.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No trip financial records logged.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-3 px-4">Trip No</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4 font-right">Revenue (GHS)</th>
                  <th className="py-3 px-4 font-right">Cost (GHS)</th>
                  <th className="py-3 px-4 font-right">Net Profit (GHS)</th>
                  <th className="py-3 px-4">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trips.map((t) => {
                  const margin = t.revenue ? (((t.profit || 0) / t.revenue) * 100).toFixed(1) : "0.0";

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {t.trip_number}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {t.vehicle_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {t.origin_name || t.origin || "Base"} → {t.destination_name || t.destination || "Dest"}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                        {(t.revenue || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-rose-600 dark:text-rose-400">
                        {(t.trip_cost || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-purple-600 dark:text-purple-400">
                        {(t.profit || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        {margin}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
