/**
 * @fileoverview AttendanceDashboard component.
 * Provides functionality for AttendanceDashboard.
 */

import React from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function AttendanceDashboard() {
  const [summary, setSummary] = React.useState({
    present: 0,
    absent: 0,
    onLeave: 0,
    late: 0,
  });
  const [filters, setFilters] = React.useState({
    from_date: new Date().toISOString().slice(0, 10),
    to_date: new Date().toISOString().slice(0, 10),
    q: "",
  });
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/attendance", { params: filters });
      const arr = res?.data?.items || [];
      setItems(arr);
      const s = { present: 0, absent: 0, onLeave: 0, late: 0 };
      for (const a of arr) {
        if (a.status === "PRESENT") s.present++;
        else if (a.status === "ABSENT") s.absent++;
        else if (a.status === "ON_LEAVE") s.onLeave++;
        else if (a.status === "LATE") s.late++;
      }
      setSummary(s);
    } catch {
      toast.error("Failed to load attendance");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, [filters.from_date, filters.to_date]);

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="btn-secondary text-sm">
              Back to Menu
            </button>
            <h2 className="text-lg font-semibold">Attendance</h2>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/human-resources/attendance/list"
              className="btn-secondary text-sm"
            >
              View List
            </Link>
            <Link
              to="/human-resources/attendance/new"
              className="btn-primary text-sm"
            >
              + New Entry
            </Link>
            <Link
              to="/human-resources/attendance/bulk"
              className="btn-secondary text-sm"
            >
              Bulk Attendance
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase block mb-1">From Date</label>
              <input
                type="date"
                className="input w-full"
                value={filters.from_date}
                onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase block mb-1">To Date</label>
              <input
                type="date"
                className="input w-full"
                value={filters.to_date}
                onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase block mb-1">Employee Search</label>
              <div className="flex gap-2">
                <input
                  className="input w-full"
                  placeholder="Name or Code..."
                  value={filters.q}
                  onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                />
                <button className="btn-secondary" onClick={load}>Filter</button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-100 dark:border-green-800/30">
            <div className="text-green-600 dark:text-green-400 text-sm font-medium uppercase">Present</div>
            <div className="text-2xl font-bold">{summary.present}</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded border border-red-100 dark:border-red-800/30">
            <div className="text-red-600 dark:text-red-400 text-sm font-medium uppercase">Absent</div>
            <div className="text-2xl font-bold">{summary.absent}</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-100 dark:border-blue-800/30">
            <div className="text-blue-600 dark:text-blue-400 text-sm font-medium uppercase">On Leave</div>
            <div className="text-2xl font-bold">{summary.onLeave}</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded border border-orange-100 dark:border-orange-800/30">
            <div className="text-orange-600 dark:text-orange-400 text-sm font-medium uppercase">Late</div>
            <div className="text-2xl font-bold">{summary.late}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
              <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employee</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Clock In</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Clock Out</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{it.first_name} {it.last_name}</td>
                  <td className="px-4 py-2 text-sm">{new Date(it.attendance_date).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${
                      it.status === 'PRESENT' ? 'badge-success' : 
                      it.status === 'ABSENT' ? 'badge-error' : 'badge-warning'
                    }`}>
                      {it.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">{it.clock_in ? new Date(it.clock_in).toLocaleTimeString() : "-"}</td>
                  <td className="px-4 py-2 text-sm">{it.clock_out ? new Date(it.clock_out).toLocaleTimeString() : "-"}</td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500">No data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Guard>
  );
}
