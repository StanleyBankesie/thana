/**
 * @fileoverview LeaveRecords component.
 * Provides functionality for LeaveRecords.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const SOURCE_COLORS = {
  APPLICATION: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  SCHEDULE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  ROSTER: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
};

const STATUS_COLORS = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  OVERRIDDEN: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const PAGE_SIZE = 20;

function fmt(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString();
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LeaveRecords() {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({
    employee_id: "",
    dept_id: "",
    source: "ALL",
    status: "ALL",
    start_date: "",
    end_date: "",
    q: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v !== "ALL") params.set(k, v);
      });

      const [rRes, eRes, dRes] = await Promise.all([
        api.get(`/hr/leave/records?${params}`).catch(() => ({ data: { items: [] } })),
        employees.length ? Promise.resolve({ data: { items: employees } }) : api.get("/hr/employees?status=ACTIVE").catch(() => ({ data: { items: [] } })),
        departments.length ? Promise.resolve({ data: { items: departments } }) : api.get("/admin/departments").catch(() => ({ data: { items: [] } })),
      ]);
      setRecords(rRes.data?.items || []);
      if (!employees.length) setEmployees(eRes.data?.items || []);
      if (!departments.length) setDepartments(dRes.data?.items || []);
    } catch {
      toast.error("Failed to load leave records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setPage(1);
  }, [filters]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return records.slice(start, start + PAGE_SIZE);
  }, [records, page]);

  const totalPages = Math.ceil(records.length / PAGE_SIZE);

  function exportCSV() {
    const headers = ["ID", "Employee", "Emp Code", "Dept", "Leave Type", "Start", "End", "Days", "Source", "Status", "Reason", "Created At"];
    const rows = records.map((r) => [
      r.id,
      `${r.first_name} ${r.last_name}`,
      r.emp_code,
      r.dept_name || "",
      r.type_name || "",
      r.start_date?.slice(0, 10),
      r.end_date?.slice(0, 10),
      r.total_days,
      r.source,
      r.status,
      (r.reason || r.remarks || "").replace(/,/g, ";"),
      r.created_at?.slice(0, 10),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Leave_Records_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">← Back</button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Leave Records</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Complete audit trail · {records.length} record{records.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button onClick={exportCSV} className="btn-secondary text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          APPLICATION (Highest Priority)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
          SCHEDULE
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
          ROSTER (Lowest Priority)
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <div>
            <label className="label text-xs">Search</label>
            <input
              className="input text-sm"
              placeholder="Name or code..."
              value={filters.q}
              onChange={(e) => setFilter("q", e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Employee</label>
            <select className="input text-sm" value={filters.employee_id} onChange={(e) => setFilter("employee_id", e.target.value)}>
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Department</label>
            <select className="input text-sm" value={filters.dept_id} onChange={(e) => setFilter("dept_id", e.target.value)}>
              <option value="">All Depts</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.dept_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Source</label>
            <select className="input text-sm" value={filters.source} onChange={(e) => setFilter("source", e.target.value)}>
              <option value="ALL">All Sources</option>
              <option value="APPLICATION">Application</option>
              <option value="SCHEDULE">Schedule</option>
              <option value="ROSTER">Roster</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Status</label>
            <select className="input text-sm" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="OVERRIDDEN">Overridden</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Date From</label>
            <input type="date" className="input text-sm" value={filters.start_date} onChange={(e) => setFilter("start_date", e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Date To</label>
            <input type="date" className="input text-sm" value={filters.end_date} onChange={(e) => setFilter("end_date", e.target.value)} />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ employee_id: "", dept_id: "", source: "ALL", status: "ALL", start_date: "", end_date: "", q: "" })}
              className="btn-secondary text-sm w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Leave Type</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium text-center">Source</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    <span className="animate-pulse">Loading records…</span>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No records match the current filters.
                  </td>
                </tr>
              ) : (
                paginated.map((r) => (
                  <tr
                    key={r.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${r.status === "OVERRIDDEN" ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {r.first_name} {r.last_name}
                      </div>
                      <div className="text-xs text-slate-400">{r.emp_code} · {r.dept_name}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {r.type_name || <span className="text-slate-400 italic">N/A</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <div>{fmt(r.start_date)} → {fmt(r.end_date)}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{r.total_days} day(s)</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${SOURCE_COLORS[r.source] || ""}`}>
                        {r.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[r.status] || ""}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-[180px]">
                      <div className="truncate text-xs" title={r.reason || r.remarks || ""}>
                        {r.reason || r.remarks || <span className="italic">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {r.created_at ? fmt(r.created_at) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <span className="text-xs text-slate-400">
              Page {page} of {totalPages} · {records.length} total records
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs px-3 py-1 disabled:opacity-40"
              >
                ‹ Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-xs px-3 py-1 disabled:opacity-40"
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
