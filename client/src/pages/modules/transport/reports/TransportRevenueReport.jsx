/**
 * @fileoverview TransportRevenueReport component.
 * Senior Data Analyst report page for Transport Revenue Billing in Transport module.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Printer, DollarSign, TrendingUp, CreditCard } from "lucide-react";
import api from "../../../../api/client.js";

export default function TransportRevenueReport() {
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
      console.error("Failed to load transport revenue report:", err);
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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
              Revenue Analytics
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              Transport Revenue & Billing Report
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Customer trip billing, transport invoices, and revenue yield per route.
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
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
          >
            <Printer size={16} />
            Print Report
          </button>
        </div>
      </div>

      {/* KPI Highlight */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Total Revenue Billed
          </span>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {loading ? "..." : `GHS ${(analytics.totalRevenue || 0).toLocaleString()}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Total revenue generated</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Average Revenue / Trip
          </span>
          <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            {loading
              ? "..."
              : `GHS ${
                  analytics.totalTrips ? (analytics.totalRevenue / analytics.totalTrips).toFixed(2) : "0.00"
                }`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Average yield per trip</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Revenue / km
          </span>
          <p className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
            {loading
              ? "..."
              : `GHS ${
                  analytics.totalDistanceKm
                    ? (analytics.totalRevenue / analytics.totalDistanceKm).toFixed(2)
                    : "0.00"
                }`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Revenue earned per kilometer</p>
        </div>
      </div>
    </div>
  );
}
