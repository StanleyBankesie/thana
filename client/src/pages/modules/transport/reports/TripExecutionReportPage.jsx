/**
 * @fileoverview TripExecutionReportPage component.
 * Senior Data Analyst report page for Trip Management & Execution Analytics in the Transport module.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Truck,
  TrendingUp,
  AlertTriangle,
  Clock,
  Navigation,
  UserCheck,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  PieChart,
  Activity,
  CheckCircle2
} from "lucide-react";
import api from "../../../../api/client.js";

export default function TripExecutionReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (selectedVehicle) params.vehicle_id = selectedVehicle;
      if (selectedDriver) params.driver_id = selectedDriver;
      if (selectedStatus) params.status = selectedStatus;

      const res = await api.get("/transport/reports/analytics", { params });
      if (res.data?.success || res.data?.items) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to load trip execution report:", err);
      setError(err?.response?.data?.message || "Failed to load trip execution analytics report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedVehicle, selectedDriver, selectedStatus]);

  // Client-side search filtering
  const filteredTrips = useMemo(() => {
    if (!data?.items) return [];
    if (!searchQuery.trim()) return data.items;
    const q = searchQuery.toLowerCase();
    return data.items.filter(
      (t) =>
        t.trip_number?.toLowerCase().includes(q) ||
        t.vehicle_name?.toLowerCase().includes(q) ||
        t.reg_number?.toLowerCase().includes(q) ||
        t.driver_name?.toLowerCase().includes(q) ||
        t.origin_name?.toLowerCase().includes(q) ||
        t.destination_name?.toLowerCase().includes(q) ||
        t.destination?.toLowerCase().includes(q)
    );
  }, [data?.items, searchQuery]);

  const handleExportCSV = () => {
    if (!filteredTrips || filteredTrips.length === 0) return;
    const headers = [
      "Trip Number",
      "Vehicle",
      "Driver",
      "Origin",
      "Destination",
      "Status",
      "Distance (km)",
      "Trip Cost (GHS)",
      "Revenue (GHS)",
      "Profit (GHS)",
      "Start Time",
      "End Time",
      "SLA Schedule"
    ];

    const rows = filteredTrips.map((t) => [
      t.trip_number || "",
      `"${(t.vehicle_name || "").replace(/"/g, '""')}"`,
      `"${(t.driver_name || "").replace(/"/g, '""')}"`,
      `"${(t.origin_name || t.origin || "").replace(/"/g, '""')}"`,
      `"${(t.destination_name || t.destination || "").replace(/"/g, '""')}"`,
      t.status || "SCHEDULED",
      t.total_distance_km || 0,
      t.trip_cost || 0,
      t.revenue || 0,
      t.profit || 0,
      t.start_time ? String(t.start_time).split("T")[0] : "",
      t.end_time ? String(t.end_time).split("T")[0] : "",
      t.due_label || ""
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Trip_Execution_Report_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const analytics = data?.analytics || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-4">
          <Link
            to="/transport"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                Transport Intelligence
              </span>
              <span className="text-xs text-slate-400">Fleet Operations</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              Trip Management & Execution Analytics
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Fleet dispatch velocity, route tracking, schedule delay SLA, driver throughput & financial performance.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={loadReport}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!data || !filteredTrips.length}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={!data}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
          >
            <Printer size={16} />
            Print Report
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadReport} className="underline font-semibold">
            Retry
          </button>
        </div>
      ) : null}

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Trips */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Managed Trips
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Truck size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {loading ? "..." : analytics.totalTrips || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {analytics.inTransitTrips || 0} currently in-transit
          </p>
        </div>

        {/* Completion Rate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Trip Completion
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {loading ? "..." : `${analytics.completionRate || 0}%`}
          </p>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${Math.min(100, analytics.completionRate || 0)}%` }}
            />
          </div>
        </div>

        {/* Total Distance Covered */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Mileage
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Navigation size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
            {loading ? "..." : `${(analytics.totalDistanceKm || 0).toLocaleString()} km`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Fleet mileage logged</p>
        </div>

        {/* Delay / SLA Risk */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Delayed Schedule
            </span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
            {loading ? "..." : analytics.delayedTrips || 0}
          </p>
          <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1 font-medium">
            {analytics.delayRate || 0}% delay rate
          </p>
        </div>

        {/* Net Profitability */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Net Profitability
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-purple-600 dark:text-purple-400">
            {loading ? "..." : `GHS ${(analytics.netProfitability || 0).toLocaleString()}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            GHS {(analytics.totalRevenue || 0).toLocaleString()} Rev
          </p>
        </div>
      </div>

      {/* Control Panel / Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Filter size={18} className="text-indigo-500" />
            <span>Analytical Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 max-w-4xl">
            {/* Vehicle Selector */}
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Fleet Vehicles</option>
              {(data?.vehicles || []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration_number} ({v.make} {v.model})
                </option>
              ))}
            </select>

            {/* Driver Selector */}
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Drivers</option>
              {(data?.drivers || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.driver_name} (Lic: {d.license_number || "N/A"})
                </option>
              ))}
            </select>

            {/* Status Selector */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Trip Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="COMPLETED">Completed</option>
              <option value="DELAYED">Delayed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search trip #, vehicle, driver, destination..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Visual Data Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <PieChart size={18} className="text-indigo-500" />
              Trip Status Breakdown
            </h3>
            <span className="text-xs text-slate-400 font-medium">Distribution</span>
          </div>

          <div className="space-y-3">
            {/* Completed */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-emerald-700 dark:text-emerald-400">Completed</span>
                <span>
                  {analytics.completedTrips || 0} (
                  {analytics.totalTrips ? ((analytics.completedTrips / analytics.totalTrips) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full"
                  style={{
                    width: `${analytics.totalTrips ? (analytics.completedTrips / analytics.totalTrips) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* In Transit */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-blue-700 dark:text-blue-400">In Transit</span>
                <span>
                  {analytics.inTransitTrips || 0} (
                  {analytics.totalTrips ? ((analytics.inTransitTrips / analytics.totalTrips) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full"
                  style={{
                    width: `${analytics.totalTrips ? (analytics.inTransitTrips / analytics.totalTrips) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* Scheduled */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-purple-700 dark:text-purple-400">Scheduled</span>
                <span>
                  {analytics.scheduledTrips || 0} (
                  {analytics.totalTrips ? ((analytics.scheduledTrips / analytics.totalTrips) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full"
                  style={{
                    width: `${analytics.totalTrips ? (analytics.scheduledTrips / analytics.totalTrips) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* Delayed */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-rose-700 dark:text-rose-400">Delayed Schedule</span>
                <span>
                  {analytics.delayedTrips || 0} (
                  {analytics.totalTrips ? ((analytics.delayedTrips / analytics.totalTrips) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full"
                  style={{
                    width: `${analytics.totalTrips ? (analytics.delayedTrips / analytics.totalTrips) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* Cancelled */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-500">Cancelled</span>
                <span>
                  {analytics.cancelledTrips || 0} (
                  {analytics.totalTrips ? ((analytics.cancelledTrips / analytics.totalTrips) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-slate-400 h-full"
                  style={{
                    width: `${analytics.totalTrips ? (analytics.cancelledTrips / analytics.totalTrips) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Fleet Utilization */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Truck size={18} className="text-blue-500" />
              Fleet Status Matrix
            </h3>
            <span className="text-xs text-slate-400 font-medium">Fleet Size: {analytics.totalFleet || 0}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                Available Yard
              </span>
              <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-1">
                {analytics.availableVehicles || 0}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase">
                In Transit
              </span>
              <p className="text-2xl font-extrabold text-blue-800 dark:text-blue-300 mt-1">
                {analytics.inTransitVehicles || 0}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">
                Maintenance
              </span>
              <p className="text-2xl font-extrabold text-amber-800 dark:text-amber-300 mt-1">
                {analytics.maintenanceVehicles || 0}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase">
                Out of Service
              </span>
              <p className="text-2xl font-extrabold text-rose-800 dark:text-rose-300 mt-1">
                {analytics.outOfServiceVehicles || 0}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Fleet Readiness Ratio:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{analytics.fleetUtilizationRate || 0}%</span>
          </div>
        </div>

        {/* Driver Performance & Mileage Throughput */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <UserCheck size={18} className="text-emerald-500" />
              Driver Execution Throughput
            </h3>
            <span className="text-xs text-slate-400 font-medium">Active: {analytics.totalDrivers || 0}</span>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {(analytics.driverPerformance || []).slice(0, 5).map((d, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs"
              >
                <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  <span>{d.name}</span>
                  <span>
                    {d.completed} / {d.total} trips ({d.completionRate}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: `${Math.min(100, Number(d.completionRate))}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                  <span>Logged: {d.distance.toLocaleString()} km</span>
                  {d.delayed > 0 ? (
                    <span className="text-rose-500 font-semibold">⚠️ {d.delayed} delayed</span>
                  ) : (
                    <span className="text-emerald-600 font-semibold">✓ On Time</span>
                  )}
                </div>
              </div>
            ))}

            {(!analytics.driverPerformance || analytics.driverPerformance.length === 0) && (
              <p className="text-xs text-slate-400 italic text-center py-6">
                No driver trip execution logs recorded.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Execution Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Trip Dispatch & Execution Log ({filteredTrips.length})
            </h3>
            <p className="text-xs text-slate-500">
              Complete operational record of vehicle trips, route mileage, driver assignments, and trip economics.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Loading transport trip execution intelligence...
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No trip execution records match the selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-3 px-4">Trip No</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Route (Origin → Destination)</th>
                  <th className="py-3 px-4">Distance</th>
                  <th className="py-3 px-4 font-right">Revenue vs Cost</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SLA Schedule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTrips.map((trip) => {
                  const statusColor =
                    trip.status === "COMPLETED"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : trip.status === "IN_TRANSIT"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      : trip.status === "DELAYED"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                      : trip.status === "CANCELLED"
                      ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      : "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300";

                  const dueStatusBadge =
                    trip.due_status === "COMPLETED" ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Completed
                      </span>
                    ) : trip.due_status === "OVERDUE" ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center gap-1 w-fit">
                        <AlertTriangle size={11} /> {trip.due_label}
                      </span>
                    ) : (
                      <span className="text-slate-400">{trip.due_label || "—"}</span>
                    );

                  return (
                    <tr
                      key={trip.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {trip.trip_number || `TRIP-#${trip.id}`}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {trip.vehicle_name}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {trip.driver_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        <span>{trip.origin_name || trip.origin || "Base"}</span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {trip.destination_name || trip.destination || "Destination"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {(trip.total_distance_km || 0).toLocaleString()} km
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <div className="text-emerald-600 font-bold">
                          GHS {(trip.revenue || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Cost: GHS {(trip.trip_cost || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${statusColor}`}
                        >
                          {trip.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">{dueStatusBadge}</td>
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
