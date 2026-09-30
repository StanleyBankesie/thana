/**
 * @fileoverview VisitorsLogReport component.
 * Provides functionality for VisitorsLogReport.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function VisitorsLogReport() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    total_visitors: 0,
    active_visitors: 0,
    completed_visits: 0,
    avg_duration: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    department: "",
  });
  const [departments, setDepartments] = useState([]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.department) params.department = filters.department;

      const res = await api.get("/visitors/reports/summary", { params });
      setItems(res.data?.items || []);
      setSummary(
        res.data?.summary || {
          total_visitors: 0,
          active_visitors: 0,
          completed_visits: 0,
          avg_duration: 0,
        }
      );
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await api.get("/visitors/metadata/departments");
      setDepartments(res.data?.items || []);
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    loadReport();
    loadDepartments();
  }, [loadReport, loadDepartments]);

  function formatTime(time) {
    if (!time) return "-";
    return time;
  }

  function formatDate(date) {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  }

  function formatDuration(minutes) {
    if (!minutes) return "-";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  function exportToCSV() {
    const headers = [
      "Visitor Name",
      "Phone Number",
      "Organisation",
      "Department",
      "Temp Address",
      "Visit Date",
      "Time In",
      "Time Out",
      "Duration",
      "Status",
      "Purpose",
    ];

    const rows = items.map((item) => [
      item.visitor_name,
      item.phone_number || "",
      item.organisation || "",
      item.department_visited || "",
      item.temp_address || "",
      formatDate(item.visit_date),
      formatTime(item.time_in),
      formatTime(item.time_out),
      formatDuration(item.duration_minutes),
      item.status,
      item.purpose || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `visitors-log-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">Visitors Log Report</h1>
              <p className="text-sm mt-1">
                Summary of visitor activity and statistics
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn-success text-sm">
                Back
              </button>
              <button
                type="button"
                className="btn-success text-sm"
                onClick={exportToCSV}
                disabled={items.length === 0}
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
        <div className="card-body">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="card bg-blue-50">
              <div className="card-body py-3">
                <div className="text-sm text-slate-500">Total Visitors</div>
                <div className="text-2xl font-bold text-blue-700">
                  {summary.total_visitors}
                </div>
              </div>
            </div>
            <div className="card bg-green-50">
              <div className="card-body py-3">
                <div className="text-sm text-slate-500">Active Visitors</div>
                <div className="text-2xl font-bold text-green-700">
                  {summary.active_visitors}
                </div>
              </div>
            </div>
            <div className="card bg-purple-50">
              <div className="card-body py-3">
                <div className="text-sm text-slate-500">Completed Visits</div>
                <div className="text-2xl font-bold text-purple-700">
                  {summary.completed_visits}
                </div>
              </div>
            </div>
            <div className="card bg-amber-50">
              <div className="card-body py-3">
                <div className="text-sm text-slate-500">Avg. Duration</div>
                <div className="text-2xl font-bold text-amber-700">
                  {formatDuration(summary.avg_duration)}
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div className="min-w-0">
              <label className="label text-xs">From Date</label>
              <input
                type="date"
                className="input input-sm w-full min-w-0"
                value={filters.from}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, from: e.target.value }))
                }
              />
            </div>
            <div className="min-w-0">
              <label className="label text-xs">To Date</label>
              <input
                type="date"
                className="input input-sm w-full min-w-0"
                value={filters.to}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, to: e.target.value }))
                }
              />
            </div>
            <div className="min-w-0">
              <label className="label text-xs">Department</label>
              <select
                className="input input-sm w-full min-w-0"
                value={filters.department}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, department: e.target.value }))
                }
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="btn btn-secondary text-sm w-full"
                onClick={() =>
                  setFilters({ from: "", to: "", department: "" })
                }
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Report Table */}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Visitor Name</th>
                  <th>Phone</th>
                  <th>Organisation</th>
                  <th>Department</th>
                  <th>Visit Date</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4">
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-slate-500">
                      No records found for the selected filters
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.visitor_name}</td>
                      <td>{item.phone_number || "-"}</td>
                      <td>{item.organisation || "-"}</td>
                      <td>{item.department_visited || "-"}</td>
                      <td>{formatDate(item.visit_date)}</td>
                      <td>{formatTime(item.time_in)}</td>
                      <td>{formatTime(item.time_out)}</td>
                      <td>{formatDuration(item.duration_minutes)}</td>
                      <td>
                        <span
                          className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                            item.status === "ACTIVE"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
