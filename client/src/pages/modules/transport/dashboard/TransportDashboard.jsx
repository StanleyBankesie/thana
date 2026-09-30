import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Truck,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Activity,
  RefreshCw,
} from "lucide-react";
import api from "../../../../api/client.js";
import TransportReports from "../reports/TransportReports.jsx";

export default function TransportDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/transport/reports/analytics");
      if (res.data?.success || res.data?.analytics) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Dashboard stats error:", err);
      setError(err?.response?.data?.message || "Failed to load transport dashboard analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const analytics = data?.analytics || {};
  const trips = data?.items || [];
  const urgentOrDelayedTrips = trips
    .filter((t) => t.status === "DELAYED" || t.due_status === "OVERDUE")
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 p-6 text-white shadow-erp">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/10 border border-white/20 mb-2">
              Transport &amp; Logistics
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-0.5">
              Transport Management Dashboard
            </h1>
            <p className="text-sm text-brand-200 mt-1 max-w-2xl">
              Fleet readiness, trip execution velocity, driver throughput, fuel efficiency, and route financial margins.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="btn-secondary text-xs px-3 py-2 gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button onClick={() => window.history.back()} className="btn-secondary text-xs px-3 py-2 gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              ← Back to Menu
            </button>
          </div>
        </div>


      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-erp-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Trips Managed</span>
                <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400">
                  <Truck size={16} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{loading ? "..." : analytics.totalTrips || 0}</p>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="px-2 py-0.5 rounded-full font-bold bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300">
                  {analytics.inTransitTrips || 0} In-Transit
                </span>
                <span className="text-slate-400">({analytics.completedTrips || 0} done)</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-erp-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Execution Completion</span>
                <div className="p-2 rounded-lg bg-secondary-50 dark:bg-green-900/20 text-secondary">
                  <TrendingUp size={16} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-secondary">{loading ? "..." : `${analytics.completionRate || 0}%`}</p>
              <p className="text-xs text-slate-500 mt-1">{analytics.onTimeRate || 0}% on-time arrival rate</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-erp-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">Fleet Readiness Rate</span>
                <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400">
                  <Activity size={16} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-brand-700 dark:text-brand-300">{loading ? "..." : `${analytics.fleetUtilizationRate || 0}%`}</p>
              <p className="text-xs text-slate-500 mt-1">{analytics.availableVehicles || 0} ready / {analytics.totalFleet || 0} fleet size</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-erp-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Net Route Profitability</span>
                <div className="p-2 rounded-lg bg-primary-50 dark:bg-orange-900/20 text-primary">
                  <DollarSign size={16} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-primary">{loading ? "..." : `GHS ${(analytics.netProfitability || 0).toLocaleString()}`}</p>
              <p className="text-xs text-slate-500 mt-1">GHS {(analytics.totalRevenue || 0).toLocaleString()} billed</p>
            </div>
          </div>

          {/* Visualizations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section A: Trip Execution */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-erp-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 uppercase">
                    Section 1: Trips
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">Trip Execution &amp; Dispatch Velocity</h3>
                </div>
                <Link to="/transport/trips" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">Trip List →</Link>
              </div>

              {/* Status Distribution Bar */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  <span>Execution Status</span>
                  <span>{analytics.totalTrips || 0} Total</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden flex">
                  {[
                    { key: "completedTrips",  color: "#2E8B1F", label: "Completed" },
                    { key: "inTransitTrips",  color: "#0E3646", label: "In Transit" },
                    { key: "scheduledTrips",  color: "#3b86a8", label: "Scheduled" },
                    { key: "delayedTrips",    color: "#F57C00", label: "Delayed" },
                    { key: "cancelledTrips",  color: "#94a3b8", label: "Cancelled" },
                  ].map(({ key, color, label }) => (
                    <div
                      key={key}
                      title={label}
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${analytics.totalTrips ? (analytics[key] / analytics.totalTrips) * 100 : 0}%`,
                        backgroundColor: color,
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-slate-600 dark:text-slate-400">
                  {[
                    { key: "completedTrips", color: "#2E8B1F", label: "Completed" },
                    { key: "inTransitTrips", color: "#0E3646", label: "In Transit" },
                    { key: "scheduledTrips", color: "#3b86a8", label: "Scheduled" },
                    { key: "delayedTrips",   color: "#F57C00", label: "Delayed" },
                  ].map(({ key, color, label }) => (
                    <span key={key} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                      {label} ({analytics[key] || 0})
                    </span>
                  ))}
                </div>
              </div>

              {urgentOrDelayedTrips.length > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="text-primary" />
                    SLA Schedule Delays
                  </h4>
                  <div className="space-y-2">
                    {urgentOrDelayedTrips.map((t) => (
                      <div key={t.id} className="p-2.5 rounded-xl bg-primary-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">{t.trip_number}</span>
                          <span className="text-slate-500 dark:text-slate-400 ml-2">({t.vehicle_name})</span>
                        </div>
                        <span className="font-bold text-primary">⚠ {t.due_label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section B: Fleet Status */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-erp-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 uppercase">
                    Section 2: Vehicles
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">Fleet Status &amp; Capacity</h3>
                </div>
                <Link to="/transport/vehicles" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">Manage Fleet →</Link>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-secondary-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40">
                  <span className="text-xs font-bold text-secondary uppercase">Available</span>
                  <p className="text-2xl font-extrabold text-secondary mt-1">{analytics.availableVehicles || 0}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/40">
                  <span className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase">In Transit</span>
                  <p className="text-2xl font-extrabold text-brand-700 dark:text-brand-300 mt-1">{analytics.inTransitVehicles || 0}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-primary-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/40">
                  <span className="text-xs font-bold text-primary uppercase">Maintenance</span>
                  <p className="text-2xl font-extrabold text-primary mt-1">{analytics.maintenanceVehicles || 0}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40">
                  <span className="text-xs font-bold text-red-600 uppercase">Out of Service</span>
                  <p className="text-2xl font-extrabold text-red-600 mt-1">{analytics.outOfServiceVehicles || 0}</p>
                </div>
              </div>

              <div className="pt-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Fleet Operational Availability</span>
                  <span>{analytics.fleetUtilizationRate || 0}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-brand-600 transition-all duration-500"
                    style={{ width: `${Math.min(100, analytics.fleetUtilizationRate || 0)}%` }} />
                </div>
              </div>
            </div>

            {/* Section C: Drivers */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-erp-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary-50 dark:bg-green-900/20 text-secondary uppercase">
                    Section 3: Drivers
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">Driver Workload &amp; Status</h3>
                </div>
                <Link to="/transport/drivers" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">Driver List →</Link>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block">Total</span>
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 block">{analytics.totalDrivers || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-secondary-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40 text-center">
                  <span className="text-[11px] font-semibold text-secondary block">Available</span>
                  <span className="text-xl font-extrabold text-secondary mt-1 block">{analytics.availableDrivers || 0}</span>
                </div>
                <div className="p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/40 text-center">
                  <span className="text-[11px] font-semibold text-brand-700 dark:text-brand-300 block">On Trip</span>
                  <span className="text-xl font-extrabold text-brand-700 dark:text-brand-300 mt-1 block">{analytics.onTripDrivers || 0}</span>
                </div>
              </div>

              <div className="space-y-2 max-h-44 overflow-y-auto">
                {(analytics.driverPerformance || []).slice(0, 3).map((d, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{d.name}</span>
                    <span className="text-slate-500">{d.completed} trips ({d.distance.toLocaleString()} km)</span>
                  </div>
                ))}
                {!analytics.driverPerformance?.length && (
                  <div className="text-xs text-slate-400 text-center py-4">No driver performance data available.</div>
                )}
              </div>
            </div>

            {/* Section D: Fuel & Financial */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-erp-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-50 dark:bg-orange-900/20 text-primary uppercase">
                    Section 4 &amp; 5: Fuel &amp; Economics
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">Fuel Consumption &amp; Financial Margins</h3>
                </div>
                <Link to="/transport/fuel" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">Fuel Logs →</Link>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-primary-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/40">
                  <span className="text-xs font-bold text-primary uppercase">Fuel Expense</span>
                  <p className="text-xl font-extrabold text-primary mt-1">GHS {(analytics.totalFuelCost || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{(analytics.totalFuelLiters || 0).toLocaleString()} Liters</p>
                </div>
                <div className="p-3.5 rounded-xl bg-secondary-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40">
                  <span className="text-xs font-bold text-secondary uppercase">Billed Revenue</span>
                  <p className="text-xl font-extrabold text-secondary mt-1">GHS {(analytics.totalRevenue || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500 mt-1">Net: GHS {(analytics.netProfitability || 0).toLocaleString()}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-900/40 flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Fuel Efficiency:</span>
                <span className="font-bold text-brand-700 dark:text-brand-300">{analytics.fuelKmPerLiter || 0} km / Liter</span>
              </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
