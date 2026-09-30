/**
 * @fileoverview VehicleUtilizationReport component.
 * Senior Data Analyst report page for Vehicle & Fleet Utilization in Transport module.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Printer, Truck, PieChart, CheckCircle, AlertTriangle } from "lucide-react";
import api from "../../../../api/client.js";

export default function VehicleUtilizationReport() {
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
      console.error("Failed to load vehicle utilization report:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const analytics = data?.analytics || {};
  const vehicles = analytics.vehicleUtilization || [];

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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
              Fleet Intelligence
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              Vehicle Fleet Utilization Report
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Fleet readiness ratio, active in-transit vs idle yard vehicles, and mileage throughput per vehicle.
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
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
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
            Total Fleet Size
          </span>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {loading ? "..." : analytics.totalFleet || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Registered vehicles</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            In Transit
          </span>
          <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            {loading ? "..." : analytics.inTransitVehicles || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Active on routes</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Available Yard
          </span>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {loading ? "..." : analytics.availableVehicles || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Ready for dispatch</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            In Maintenance
          </span>
          <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {loading ? "..." : analytics.maintenanceVehicles || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Under workshop repair</p>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Vehicle Fleet Utilization & Distance Log
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Loading vehicle fleet utilization metrics...
          </div>
        ) : vehicles.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No vehicle activity recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-3 px-4">Vehicle Reg / Name</th>
                  <th className="py-3 px-4">Total Trips</th>
                  <th className="py-3 px-4">Completed</th>
                  <th className="py-3 px-4">Distance Logged</th>
                  <th className="py-3 px-4">Operating Cost</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vehicles.map((v, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {v.name} {v.reg ? `(${v.reg})` : ""}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold">
                      {v.total}
                    </td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">
                      {v.completed}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      {v.distance.toLocaleString()} km
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      GHS {v.cost.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      {v.delayed > 0 ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          {v.delayed} delayed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Active Ready
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
