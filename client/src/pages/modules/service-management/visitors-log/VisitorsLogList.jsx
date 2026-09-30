/**
 * @fileoverview VisitorsLogList component.
 * Provides functionality for VisitorsLogList.
 */

import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function VisitorsLogList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    from_time: "",
    to_time: "",
    status: "",
    department: "",
    search: "",
  });
  const [departments, setDepartments] = useState([]);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    today: 0,
  });

  const loadVisitors = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.from_time) params.from_time = filters.from_time;
      if (filters.to_time) params.to_time = filters.to_time;
      if (filters.status) params.status = filters.status;
      if (filters.department) params.department = filters.department;
      if (filters.search) params.search = filters.search;

      const res = await api.get("/visitors", { params });
      setItems(res.data?.items || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load visitors log");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get("/visitors/dashboard/stats");
      setStats({
        total: res.data?.stats?.total_visitors || 0,
        active: res.data?.stats?.active_visitors || 0,
        completed: res.data?.stats?.completed_visits || 0,
        today: res.data?.stats?.today_visitors || 0,
      });
    } catch {
      // Silent fail for stats
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await api.get("/visitors/metadata/departments");
      setDepartments(res.data?.items || []);
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    loadVisitors();
    loadStats();
    loadDepartments();
  }, [loadVisitors, loadStats, loadDepartments]);

  function formatTime(time) {
    if (!time) return "-";
    return time;
  }

  function formatDate(date) {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body py-3">
            <div className="text-sm text-black">Total Visitors</div>
            <div className="text-2xl font-bold text-black">{stats.total}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body py-3">
            <div className="text-sm text-black">Active (Checked In)</div>
            <div className="text-2xl font-bold text-black">{stats.active}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body py-3">
            <div className="text-sm text-black">Completed Visits</div>
            <div className="text-2xl font-bold text-black">{stats.completed}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body py-3">
            <div className="text-sm text-black">Today's Visitors</div>
            <div className="text-2xl font-bold text-black">{stats.today}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">Visitors Log Book</h1>
              <p className="text-sm mt-1">Track and manage visitor records</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn-success text-sm">
                Back
              </button>
              <Link to="new" className="btn-success text-sm">
                + New Visitor
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-4 items-end">
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
              <label className="label text-xs">From Time</label>
              <input
                type="time"
                className="input input-sm w-full min-w-0"
                value={filters.from_time}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, from_time: e.target.value }))
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
              <label className="label text-xs">To Time</label>
              <input
                type="time"
                className="input input-sm w-full min-w-0"
                value={filters.to_time}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, to_time: e.target.value }))
                }
              />
            </div>
            <div className="min-w-0">
              <label className="label text-xs">Status</label>
              <select
                className="input input-sm w-full min-w-0"
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
              </select>
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
            <div className="min-w-0 sm:col-span-2 md:col-span-3 lg:col-span-2 xl:col-span-1">
              <label className="label text-xs">Search</label>
              <input
                type="text"
                className="input input-sm w-full min-w-0"
                placeholder="Name, phone, org..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
              />
            </div>
          </div>



          {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <th className="whitespace-nowrap">Visitor Name</th>
                  <th className="whitespace-nowrap">Phone</th>
                  <th className="whitespace-nowrap">Organisation</th>
                  <th className="whitespace-nowrap">Department</th>
                  <th className="whitespace-nowrap">Temp Address</th>
                  <th className="whitespace-nowrap">Date</th>
                  <th className="whitespace-nowrap">Time In</th>
                  <th className="whitespace-nowrap">Time Out</th>
                  <th className="whitespace-nowrap">Status</th>
                  <th className="whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-4 whitespace-nowrap">
                      Loading...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-4 text-slate-500 whitespace-nowrap">
                      No visitor records found
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium whitespace-nowrap">{item.visitor_name}</td>
                      <td className="whitespace-nowrap">{item.phone_number || "-"}</td>
                      <td className="whitespace-nowrap">{item.organisation || "-"}</td>
                      <td className="whitespace-nowrap">{item.department_visited || "-"}</td>
                      <td className="whitespace-nowrap">{item.temp_address || "-"}</td>
                      <td className="whitespace-nowrap">{formatDate(item.visit_date)}</td>
                      <td className="whitespace-nowrap">{formatTime(item.time_in)}</td>
                      <td className="whitespace-nowrap">{formatTime(item.time_out)}</td>
                      <td className="whitespace-nowrap">
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
                      <td className="whitespace-nowrap">
                        <div className="flex gap-2">
                          <Link
                            to={`${item.id}/edit?mode=view`}
                            className="text-brand hover:text-brand-700 text-sm"
                          >
                            View
                          </Link>
                          <Link
                            to={`${item.id}/edit`}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            Edit
                          </Link>
                        </div>
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
