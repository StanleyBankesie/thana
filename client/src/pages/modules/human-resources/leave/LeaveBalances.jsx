/**
 * @fileoverview LeaveBalances component.
 * Provides functionality for LeaveBalances.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const CURRENT_YEAR = new Date().getFullYear();

function ProgressBar({ used, allocated }) {
  const pct = allocated > 0 ? Math.min((used / allocated) * 100, 100) : 0;
  const color =
    pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap w-16 text-right">
        {Number(used).toFixed(0)} / {Number(allocated).toFixed(0)}
      </span>
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LeaveBalances() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [deptId, setDeptId] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [dRes, eRes] = await Promise.all([
          api.get("/admin/departments").catch(() => ({ data: { items: [] } })),
          api.get("/hr/employees?status=ACTIVE").catch(() => ({ data: { items: [] } })),
        ]);
        setDepartments(dRes.data?.items || []);
        setEmployees(eRes.data?.items || []);
      } catch {}
    };
    loadMeta();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ year });
        if (deptId) params.set("dept_id", deptId);
        if (employeeId) params.set("employee_id", employeeId);
        const res = await api.get(`/hr/leave/balances?${params}`);
        setItems(res.data?.items || []);
      } catch {
        toast.error("Failed to load leave balances");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [year, deptId, employeeId]);

  // Group by employee → list of leave type rows
  const grouped = useMemo(() => {
    const map = {};
    for (const row of items) {
      const key = row.employee_id;
      if (!map[key]) {
        map[key] = {
          employee_id: row.employee_id,
          emp_code: row.emp_code,
          first_name: row.first_name,
          last_name: row.last_name,
          dept_name: row.dept_name,
          types: [],
          totalUsed: 0,
          totalAllocated: 0,
        };
      }
      map[key].types.push({
        type_name: row.type_name,
        allocated_days: Number(row.allocated_days),
        used_days: Number(row.used_days),
        remaining: Number(row.allocated_days) - Number(row.used_days),
      });
      map[key].totalUsed += Number(row.used_days);
      map[key].totalAllocated += Number(row.allocated_days);
    }
    return Object.values(map);
  }, [items]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">← Back</button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Leave Balances</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Dynamic computation of used vs allocated leave — {year}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label text-xs">Year</label>
            <select className="input text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[0, 1, 2].map((offset) => (
                <option key={offset} value={CURRENT_YEAR - offset}>
                  {CURRENT_YEAR - offset}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Department</label>
            <select className="input text-sm" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.dept_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Employee</label>
            <select className="input text-sm" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {grouped.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="text-xs text-slate-500 font-medium mb-1">Total Employees</div>
            <div className="text-3xl font-black text-slate-800 dark:text-white">{grouped.length}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="text-xs text-slate-500 font-medium mb-1">Total Days Used ({year})</div>
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {grouped.reduce((s, g) => s + g.totalUsed, 0).toFixed(0)}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="text-xs text-slate-500 font-medium mb-1">Total Days Allocated</div>
            <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
              {grouped.reduce((s, g) => s + g.totalAllocated, 0).toFixed(0)}
            </div>
          </div>
        </div>
      )}

      {/* Per-employee cards */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400">
          <span className="animate-pulse">Loading balances…</span>
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-10 text-center text-slate-400">
          No leave balance data found for {year}.{" "}
          <Link to="/human-resources/leave-setup" className="text-brand hover:underline">
            Configure leave types first.
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((emp) => (
            <div
              key={emp.employee_id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              {/* Employee header */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      {emp.first_name} {emp.last_name}
                    </div>
                    <div className="text-xs text-slate-400">{emp.emp_code} · {emp.dept_name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Used / Allocated</div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {emp.totalUsed.toFixed(0)} / {emp.totalAllocated.toFixed(0)} days
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      navigate(`/human-resources/leave/records?employee_id=${emp.employee_id}`)
                    }
                    className="btn-secondary text-xs"
                    title="View leave records for this employee"
                  >
                    View Records
                  </button>
                </div>
              </div>

              {/* Leave type breakdown */}
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {emp.types.filter((t) => t.allocated_days > 0 || t.used_days > 0).map((t, i) => (
                  <div key={i} className="px-5 py-3 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {t.type_name}
                    </div>
                    <div className="sm:col-span-2">
                      <ProgressBar used={t.used_days} allocated={t.allocated_days} />
                    </div>
                    <div className="flex items-center gap-3 justify-end text-xs">
                      <span className={`font-semibold ${t.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                        {t.remaining.toFixed(0)} remaining
                      </span>
                      {t.remaining < 0 && (
                        <span className="text-red-500 text-[10px] font-bold px-1.5 py-0.5 bg-red-50 dark:bg-red-500/10 rounded">
                          OVER LIMIT
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
