/**
 * @fileoverview RosterManagement component.
 * Provides functionality for RosterManagement.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Download, Printer } from "lucide-react";
function diffDays(a, b) {
  const one = new Date(a);
  const two = new Date(b);
  return Math.round((two - one) / (24 * 3600 * 1000));
}

function rangeDates(start, end) {
  const out = [];
  const s = new Date(start);
  const e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(new Date(d));
  }
  return out;
}

function toMinutes(t) {
  if (!t || typeof t !== "string") return 0;
  const [hh, mm] = t.split(":").map(Number);
  return (hh % 24) * 60 + (mm || 0);
}

function computeHours(start_time, end_time, break_minutes) {
  let diff = toMinutes(end_time) - toMinutes(start_time);
  if (diff < 0) diff += 24 * 60;
  diff -= Number(break_minutes || 0);
  const h = Math.max(0, diff) / 60;
  return isFinite(h) ? h : 0;
}

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function RosterManagement() {
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [positions, setPositions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [empTypes, setEmpTypes] = useState([]);
  const [filter, setFilter] = useState({ type: "NONE", value: "" });
  const [form, setForm] = useState({
    selected_employee_id: "",
    from_date: new Date().toISOString().slice(0, 10),
    to_date: new Date(new Date().setDate(new Date().getDate() + 6))
      .toISOString()
      .slice(0, 10),
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [emps, shf, sched, pos, locs, cats, ets] = await Promise.all([
          api.get("/hr/employees?status=ACTIVE").catch(() => ({ data: { items: [] } })),
          api.get("/hr/shifts").catch(() => ({ data: { items: [] } })),
          api.get("/hr/work-schedules").catch(() => ({ data: { items: [] } })),
          api.get("/hr/positions").catch(() => ({ data: { items: [] } })),
          api.get("/hr/setup/locations").catch(() => ({ data: { items: [] } })),
          api.get("/hr/setup/employee-categories").catch(() => ({ data: { items: [] } })),
          api.get("/hr/setup/employment-types").catch(() => ({ data: { items: [] } })),
        ]);
        setEmployees(emps.data?.items || []);
        setShifts(shf.data?.items || []);
        setPositions(pos.data?.items || []);
        setLocations(locs.data?.items || []);
        setCategories(cats.data?.items || []);
        setEmpTypes(ets.data?.items || []);
        setSchedules(
          (sched.data?.items || []).map((x) => {
            let off = [];
            try {
              off = Array.isArray(x.off_days)
                ? x.off_days
                : JSON.parse(x.off_days || "[]");
            } catch {
              off = [];
            }
            return { ...x, off_days: off.map(Number) };
          }),
        );
      } catch {
        toast.error("Failed to load data");
      }
    };
    load();
  }, []);

  const scheduleMap = useMemo(() => {
    const map = new Map();
    for (const s of schedules) {
      map.set(String(s.employee_id), s);
    }
    return map;
  }, [schedules]);

  // Visible options list (independent of current selection) used to render Employees options
  const visibleEmployees = useMemo(() => {
    let pool = employees;
    if (filter.type === "NONE") {
      pool = employees.filter((e) => scheduleMap.has(String(e.id)));
    } else if (filter.type === "SHIFT" && filter.value) {
      const empIds = new Set(
        schedules
          .filter((s) => String(s.shift_id) === String(filter.value))
          .map((s) => String(s.employee_id)),
      );
      pool = employees.filter((e) => empIds.has(String(e.id)));
    } else if (filter.type === "LOCATION" && filter.value) {
      pool = employees.filter(
        (e) => String(e.location_id || "") === String(filter.value) && scheduleMap.has(String(e.id)),
      );
    } else if (filter.type === "CATEGORY" && filter.value) {
      pool = employees.filter(
        (e) => String(e.category_id || "") === String(filter.value) && scheduleMap.has(String(e.id)),
      );
    } else if (filter.type === "EMPLOYMENT_TYPE" && filter.value) {
      pool = employees.filter(
        (e) => String(e.employment_type_id || "") === String(filter.value) && scheduleMap.has(String(e.id)),
      );
    } else if (filter.type === "POSITION" && filter.value) {
      pool = employees.filter(
        (e) => String(e.pos_id || "") === String(filter.value) && scheduleMap.has(String(e.id)),
      );
    }
    return pool;
  }, [filter, employees, schedules, scheduleMap]);

  const selectedEmployees = useMemo(() => {
    if (!form.selected_employee_id) return visibleEmployees;
    return visibleEmployees.filter((e) => String(e.id) === String(form.selected_employee_id));
  }, [form.selected_employee_id, visibleEmployees]);

  const roster = useMemo(() => {
    if (selectedEmployees.length === 0) return [];
    const results = [];
    const days = rangeDates(form.from_date, form.to_date);
    for (const emp of selectedEmployees) {
      const sched = scheduleMap.get(String(emp.id));
      if (!sched) continue;
      const shift =
        shifts.find((s) => String(s.id) === String(sched.shift_id)) || null;
      if (!shift) continue;
      for (const d of days) {
        const dow = d.getDay();
        const iso = d.toISOString().slice(0, 10);
        // honor schedule effective date range if provided
        const effFrom =
          sched.effective_from && String(sched.effective_from).length >= 10
            ? sched.effective_from
            : null;
        const effTo =
          sched.effective_to && String(sched.effective_to).length >= 10
            ? sched.effective_to
            : null;
        if (effFrom && iso < effFrom) continue;
        if (effTo && iso > effTo) continue;
        if ((sched.off_days || []).includes(dow)) {
          results.push({
            employee_id: emp.id,
            employee_name: `${emp.first_name} ${emp.last_name}`,
            date: iso,
            day: dayLabels[dow],
            type: "OFF",
            label: "Off Day",
            hours: 0,
          });
        } else {
          const hours = computeHours(
            shift.start_time,
            shift.end_time,
            shift.break_minutes,
          );
          results.push({
            employee_id: emp.id,
            employee_name: `${emp.first_name} ${emp.last_name}`,
            date: iso,
            day: dayLabels[dow],
            type: "SHIFT",
            label: `${shift.name} (${shift.start_time} - ${shift.end_time})`,
            hours: Number(hours.toFixed(2)),
          });
        }
      }
    }
    results.sort(
      (a, b) =>
        a.employee_name.localeCompare(b.employee_name) ||
        a.date.localeCompare(b.date),
    );
    return results;
  }, [selectedEmployees, scheduleMap, shifts, form.from_date, form.to_date]);

  const totalHours = useMemo(
    () => roster.reduce((sum, r) => sum + (r.hours || 0), 0),
    [roster],
  );

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            Back to Menu
          </button>
          <h1 className="text-xl font-semibold">Roster Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!roster.length) return;
              const ws = XLSX.utils.json_to_sheet(roster);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Roster");
              XLSX.writeFile(wb, "RosterManagement.xlsx");
            }}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
          <button
            onClick={() => {
              if (!roster.length) return;
              const doc = new jsPDF('landscape');
              const keys = ["employee_name", "date", "day", "type", "label", "hours"];
              const tableColumn = ["Employee", "Date", "Day", "Assignment", "Hours"];
              const tableRows = roster.map(r => [r.employee_name, r.date, r.day, r.label, String(r.hours)]);
              doc.autoTable({ head: [tableColumn], body: tableRows });
              doc.save("RosterManagement.pdf");
            }}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="mb-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="label m-0">Filter by:</span>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="ft"
                    checked={filter.type === "NONE"}
                    onChange={() => {
                      setFilter({ type: "NONE", value: "" });
                      setForm((p) => ({ ...p, selected_employee_id: "" }));
                    }}
                  />
                  <span>None</span>
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="ft"
                    checked={filter.type === "SHIFT"}
                    onChange={() => {
                      setFilter({ type: "SHIFT", value: "" });
                      setForm((p) => ({ ...p, selected_employee_id: "" }));
                    }}
                  />
                  <span>Shift</span>
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="ft"
                    checked={filter.type === "LOCATION"}
                    onChange={() => {
                      setFilter({ type: "LOCATION", value: "" });
                      setForm((p) => ({ ...p, selected_employee_id: "" }));
                    }}
                  />
                  <span>Location</span>
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="ft"
                    checked={filter.type === "CATEGORY"}
                    onChange={() => {
                      setFilter({ type: "CATEGORY", value: "" });
                      setForm((p) => ({ ...p, selected_employee_id: "" }));
                    }}
                  />
                  <span>Category</span>
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="ft"
                    checked={filter.type === "EMPLOYMENT_TYPE"}
                    onChange={() => {
                      setFilter({ type: "EMPLOYMENT_TYPE", value: "" });
                      setForm((p) => ({ ...p, selected_employee_id: "" }));
                    }}
                  />
                  <span>Employment Type</span>
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name="ft"
                    checked={filter.type === "POSITION"}
                    onChange={() => {
                      setFilter({ type: "POSITION", value: "" });
                      setForm((p) => ({ ...p, selected_employee_id: "" }));
                    }}
                  />
                  <span>Position</span>
                </label>
              </div>
              {filter.type !== "NONE" && (
                <div className="mt-2">
                  <select
                    className="input"
                    value={filter.value}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFilter((f) => ({ ...f, value }));
                      setForm((prev) => ({ ...prev, selected_employee_id: "" }));
                    }}
                  >
                    <option value="">Select</option>
                    {filter.type === "SHIFT" &&
                      shifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.start_time}-{s.end_time})
                        </option>
                      ))}
                    {filter.type === "LOCATION" &&
                      locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.location_name}
                        </option>
                      ))}
                    {filter.type === "CATEGORY" &&
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    {filter.type === "EMPLOYMENT_TYPE" &&
                      empTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    {filter.type === "POSITION" &&
                      positions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.pos_name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="label">Employee</label>
              <select
                className="input"
                value={form.selected_employee_id}
                onChange={(e) => setForm({ ...form, selected_employee_id: e.target.value })}
              >
                <option value="">{visibleEmployees.length === 0 ? "No Employees Found" : `All Filtered Employees (${visibleEmployees.length})`}</option>
                {visibleEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} ({e.emp_code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">From</label>
            <input
              className="input"
              type="date"
              value={form.from_date}
              onChange={(e) => setForm({ ...form, from_date: e.target.value })}
            />
          </div>
          <div>
            <label className="label">To</label>
            <input
              className="input"
              type="date"
              value={form.to_date}
              onChange={(e) => setForm({ ...form, to_date: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="font-medium">Bulk Roster</div>
          <div className="text-sm">Total Hours: {totalHours.toFixed(2)}</div>
        </div>
        <table className="min-w-full">
          <thead>
            <tr className="text-left bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Employee
              </th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Date
              </th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Day
              </th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Assignment
              </th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Hours
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {roster.map((r) => (
              <tr
                key={r.employee_id + "-" + r.date}
                className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
              >
                <td className="px-4 py-2">{r.employee_name}</td>
                <td className="px-4 py-2">{r.date}</td>
                <td className="px-4 py-2">{r.day}</td>
                <td className="px-4 py-2">
                  {r.type === "OFF" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary-50 text-primary">
                      {r.label}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-secondary-50 text-secondary">
                      {r.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {r.hours ? r.hours.toFixed(2) : "0"}
                </td>
              </tr>
            ))}
            {roster.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Select employees and date range to generate roster
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
