/**
 * @fileoverview RosterManagement component.
 * Provides functionality for RosterManagement.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";

const DAY_KEYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
// js Date getDay(): 0=Sun,1=Mon,...,6=Sat → map to our DAY_KEYS index (0=Mon)
const JS_DOW_TO_KEY = [null, "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function getDaysInMonth(year, month) {
  // month is 1-indexed
  const days = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function getMonthName(month) {
  return new Date(2000, month - 1, 1).toLocaleString("default", { month: "long" });
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function RosterManagement() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deptFilter, setDeptFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, [year, month]);

  async function load() {
    setLoading(true);
    try {
      const [empRes, schedRes, leaveRes] = await Promise.all([
        api.get("/hr/employees?status=ALL").catch(() => ({ data: { items: [] } })),
        api.get("/hr/work-schedules").catch(() => ({ data: { items: [] } })),
        api.get("/hr/leave/requests").catch(() => ({ data: { items: [] } })),
      ]);
      setEmployees(empRes.data?.items || []);
      setSchedules(schedRes.data?.items || []);
      setLeaves(leaveRes.data?.items || []);
    } catch {
      toast.error("Failed to load roster data");
    } finally {
      setLoading(false);
    }
  }

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const scheduleMap = useMemo(() => {
    const m = {};
    schedules.forEach(s => {
      let offDays = [];
      try { offDays = JSON.parse(s.off_days || "[]"); } catch {}
      m[s.employee_id] = { ...s, offDaysArr: offDays };
    });
    return m;
  }, [schedules]);

  // Build approved leave map: employee_id -> Set of "YYYY-MM-DD"
  const leaveMap = useMemo(() => {
    const m = {};
    const approvedStatuses = ["APPROVED", "approved"];
    leaves.filter(l => approvedStatuses.includes(l.status)).forEach(l => {
      if (!l.employee_id) return;
      if (!m[l.employee_id]) m[l.employee_id] = new Set();
      // fill date range
      const start = new Date(l.start_date);
      const end = new Date(l.end_date);
      const cur = new Date(start);
      while (cur <= end) {
        m[l.employee_id].add(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    });
    return m;
  }, [leaves]);

  // Filter employees
  const filteredEmps = useMemo(() => {
    return employees.filter(e => {
      if (deptFilter && String(e.dept_id) !== String(deptFilter)) return false;
      if (search && !`${e.first_name} ${e.last_name} ${e.emp_code}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [employees, deptFilter, search]);

  // Unique departments
  const departments = useMemo(() => {
    const seen = new Map();
    employees.forEach(e => { if (e.dept_id && e.dept_name) seen.set(e.dept_id, e.dept_name); });
    return [...seen.entries()];
  }, [employees]);

  function getCellInfo(emp, day) {
    const dateStr = day.toISOString().slice(0, 10);
    const dow = day.getDay(); // 0=Sun
    const dayKey = JS_DOW_TO_KEY[dow === 0 ? 7 : dow]; // remap Sun
    const sched = scheduleMap[emp.id];

    // Check approved leave first
    if (leaveMap[emp.id]?.has(dateStr)) return { label: "LV", type: "leave" };

    // Check off days
    if (sched?.offDaysArr?.includes(dayKey)) return { label: "OFF", type: "off" };

    // Working day: show shift code or "W"
    if (sched?.shift_code) return { label: sched.shift_code, type: "work" };
    return { label: "W", type: "work" };
  }

  const cellClass = {
    work: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-semibold",
    off: "bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500",
    leave: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-semibold",
  };

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button onClick={() => window.history.back()} className="btn-secondary text-sm">Back</button>
        <h1 className="text-2xl font-bold flex-1">Roster Management</h1>
        <button onClick={() => window.print()} className="btn-secondary text-sm">🖨 Print</button>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="label text-xs">Month</label>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="btn-secondary px-2 py-1 text-sm">‹</button>
            <span className="font-semibold min-w-[120px] text-center">{getMonthName(month)} {year}</span>
            <button onClick={nextMonth} className="btn-secondary px-2 py-1 text-sm">›</button>
          </div>
        </div>
        <div>
          <label className="label text-xs">Department</label>
          <select className="input" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Search Employee</label>
          <input className="input" placeholder="Name or code..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={load} className="btn-secondary">↻ Refresh</button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-6 h-5 rounded flex items-center justify-center bg-emerald-50 text-emerald-700 font-bold text-[10px]">DAY</span> Working (shift code)</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-5 rounded flex items-center justify-center bg-slate-100 text-slate-500 font-bold text-[10px]">OFF</span> Off Day</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-5 rounded flex items-center justify-center bg-amber-50 text-amber-700 font-bold text-[10px]">LV</span> Approved Leave</span>
      </div>

      {/* Roster Grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading roster...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg shadow-sm">
          <table className="min-w-full text-xs border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "160px" }} />
              {days.map(d => <col key={d.toISOString()} style={{ width: "36px" }} />)}
            </colgroup>
            <thead>
              <tr className="bg-slate-800 dark:bg-slate-900 text-white">
                <th className="px-3 py-2 text-left font-semibold text-xs sticky left-0 bg-slate-800 dark:bg-slate-900 z-10">Employee</th>
                {days.map(d => {
                  const dow = d.getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <th key={d.toISOString()}
                      className={`py-2 text-center font-semibold ${isWeekend ? "bg-slate-700" : ""}`}
                      title={d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short" })}
                    >
                      <div>{d.getDate()}</div>
                      <div className="text-[8px] opacity-70">{["Su","Mo","Tu","We","Th","Fr","Sa"][dow]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredEmps.map((emp, ri) => (
                <tr key={emp.id} className={ri % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-800/60"}>
                  <td className={`px-3 py-2 font-medium sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 ${ri % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-800/60"}`}>
                    <div className="truncate">{emp.first_name} {emp.last_name}</div>
                    <div className="text-[9px] text-slate-400 font-mono truncate">{emp.emp_code}</div>
                  </td>
                  {days.map(d => {
                    const cell = getCellInfo(emp, d);
                    return (
                      <td key={d.toISOString()} className={`text-center py-1 border border-slate-100 dark:border-slate-700/50 ${cellClass[cell.type]}`}>
                        <span className="text-[10px]">{cell.label}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredEmps.length === 0 && (
                <tr><td colSpan={days.length + 1} className="text-center py-12 text-slate-400">No employees found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
