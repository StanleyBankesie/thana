/**
 * @fileoverview WorkSchedule component.
 * Provides functionality for WorkSchedule.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_KEYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function WorkSchedule() {
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null); // employee being edited
  const [form, setForm] = useState({ shift_id: "", off_days: [] });
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [empRes, shiftRes, schedRes] = await Promise.all([
        api.get("/hr/employees?status=ALL").catch(() => ({ data: { items: [] } })),
        api.get("/hr/shifts").catch(() => ({ data: { items: [] } })),
        api.get("/hr/work-schedules").catch(() => ({ data: { items: [] } })),
      ]);
      setEmployees(empRes.data?.items || []);
      setShifts(shiftRes.data?.items || []);
      setSchedules(schedRes.data?.items || []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function openEdit(emp) {
    const existing = schedules.find(s => s.employee_id === emp.id);
    setSelected(emp);
    setForm({
      shift_id: existing?.shift_id || "",
      off_days: (() => {
        try { return JSON.parse(existing?.off_days || "[]"); } catch { return []; }
      })(),
    });
  }

  function toggleDay(day) {
    setForm(f => ({
      ...f,
      off_days: f.off_days.includes(day)
        ? f.off_days.filter(d => d !== day)
        : [...f.off_days, day],
    }));
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.post("/hr/work-schedules", {
        employee_id: selected.id,
        shift_id: form.shift_id || null,
        off_days: form.off_days,
      });
      toast.success("Schedule saved");
      await loadAll();
      setSelected(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() =>
    employees.filter(e =>
      !search || `${e.first_name} ${e.last_name} ${e.emp_code}`.toLowerCase().includes(search.toLowerCase())
    ), [employees, search]);

  const scheduleMap = useMemo(() => {
    const m = {};
    schedules.forEach(s => { m[s.employee_id] = s; });
    return m;
  }, [schedules]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => window.history.back()} className="btn-secondary text-sm">Back</button>
        <h1 className="text-2xl font-bold">Work Schedule Management</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b flex gap-3 items-center">
              <input
                className="input flex-1"
                placeholder="Search employees..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <table className="min-w-full">
              <thead>
                <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Employee</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Shift</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Off Days</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map(emp => {
                  const sched = scheduleMap[emp.id];
                  let offDays = [];
                  try { offDays = JSON.parse(sched?.off_days || "[]"); } catch {}
                  return (
                    <tr key={emp.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors ${selected?.id === emp.id ? "bg-brand/5" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{emp.first_name} {emp.last_name}</div>
                        <div className="text-xs text-slate-500">{emp.emp_code}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {sched?.shift_name
                          ? <span className="font-medium text-brand">{sched.shift_name} <span className="font-mono text-xs text-slate-400">({sched.shift_code})</span></span>
                          : <span className="text-slate-400 italic">Not assigned</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {offDays.length > 0
                          ? <div className="flex flex-wrap gap-1">
                              {offDays.map(d => (
                                <span key={d} className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded uppercase">{d}</span>
                              ))}
                            </div>
                          : <span className="text-slate-400 italic">None</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(emp)} className="text-brand text-sm hover:underline">
                          {sched ? "Edit" : "Assign"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={4} className="text-center py-10 text-slate-400">No employees found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm sticky top-4">
            {selected ? (
              <>
                <h3 className="font-semibold text-lg mb-1">{selected.first_name} {selected.last_name}</h3>
                <p className="text-xs text-slate-400 mb-4">{selected.emp_code}</p>
                <div className="space-y-4">
                  <div>
                    <label className="label font-semibold">Assign Shift</label>
                    <select
                      className="input"
                      value={form.shift_id}
                      onChange={e => setForm(f => ({ ...f, shift_id: e.target.value }))}
                    >
                      <option value="">— No Shift —</option>
                      {shifts.filter(s => s.is_active).map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label font-semibold mb-2 block">Off Days</label>
                    <div className="space-y-2">
                      {DAY_KEYS.map((key, i) => (
                        <label key={key} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={form.off_days.includes(key)}
                            onChange={() => toggleDay(key)}
                          />
                          <span className="text-sm">{DAY_LABELS[i]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <button onClick={save} disabled={saving} className="btn-primary flex-1">
                      {saving ? "Saving..." : "Save Schedule"}
                    </button>
                    <button onClick={() => setSelected(null)} className="btn-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-400 py-10">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-sm">Select an employee from the list to assign a shift and off days.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
