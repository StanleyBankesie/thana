/**
 * @fileoverview WorkScheduleManagement component.
 * Provides functionality for WorkScheduleManagement.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const days = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function WorkScheduleManagement() {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    employee_id: "",
    shift_id: "",
    off_days: [],
    is_active: true,
  });

  const selectedEmployee = useMemo(
    () => employees.find((e) => String(e.id) === String(form.employee_id)),
    [employees, form.employee_id],
  );
  const selectedShift = useMemo(
    () => shifts.find((s) => String(s.id) === String(form.shift_id)),
    [shifts, form.shift_id],
  );

  const availableEmployees = useMemo(() => {
    return employees.filter(e => {
       const hasSchedule = items.some(item => String(item.employee_id) === String(e.id));
       return !hasSchedule || String(form.employee_id) === String(e.id);
    });
  }, [employees, items, form.employee_id]);

  useEffect(() => {
    const load = async () => {
      try {
        const [empRes, shiftRes, schedRes] = await Promise.all([
          api.get("/hr/employees?status=ACTIVE").catch(() => ({ data: { items: [] } })),
          api.get("/hr/shifts").catch(() => ({ data: { items: [] } })),
          api.get("/hr/work-schedules").catch(() => ({ data: { items: [] } })),
        ]);
        setEmployees(empRes.data?.items || []);
        setShifts(shiftRes.data?.items || []);
        setItems(
          (schedRes.data?.items || []).map((x) => ({
            ...x,
            off_days: parseOffDays(x.off_days),
          })),
        );
      } catch {
        toast.error("Failed to load data");
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!form.employee_id) return;
    const existing = items.find(
      (x) => String(x.employee_id) === String(form.employee_id),
    );
    if (existing) {
      setForm({
        id: existing.id,
        employee_id: String(existing.employee_id),
        shift_id: String(existing.shift_id),
        off_days: existing.off_days,
        is_active: !!existing.is_active,
      });
    }
  }, [form.employee_id, items]);

  function parseOffDays(v) {
    if (Array.isArray(v)) return v.map(Number);
    try {
      const arr = JSON.parse(v || "[]");
      return Array.isArray(arr) ? arr.map(Number) : [];
    } catch {
      return [];
    }
  }

  function toggleOffDay(day) {
    setForm((p) => {
      const has = (p.off_days || []).includes(day);
      const next = has
        ? p.off_days.filter((d) => d !== day)
        : [...(p.off_days || []), day];
      return { ...p, off_days: next.sort((a, b) => a - b) };
    });
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.employee_id || !form.shift_id) {
      toast.error("Select employee and shift");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        employee_id: Number(form.employee_id),
        shift_id: Number(form.shift_id),
        off_days: form.off_days || [],
        is_active: form.is_active,
      };
      const res = await api.post("/hr/work-schedules", payload);
      toast.success("Schedule saved");
      const newId = res.data?.id || form.id;
      const updated = { ...payload, id: newId };
      setItems((prev) => {
        const others = prev.filter(
          (x) => String(x.employee_id) !== String(updated.employee_id),
        );
        return [
          ...others,
          {
            ...updated,
            first_name: selectedEmployee?.first_name,
            last_name: selectedEmployee?.last_name,
            shift_name: selectedShift?.name,
            off_days: [...(updated.off_days || [])],
          },
        ];
      });
      setForm({
        employee_id: "",
        shift_id: "",
        off_days: [],
        is_active: true,
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save schedule");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            Back to Menu
          </button>
          <h1 className="text-xl font-semibold">Work Schedule Management</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Employee</label>
              <select
                className="input"
                value={form.employee_id}
                onChange={(e) =>
                  setForm({ ...form, employee_id: e.target.value })
                }
                required
              >
                <option value="">Select Employee</option>
                {availableEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} ({e.emp_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Shift</label>
              <select
                className="input"
                value={form.shift_id}
                onChange={(e) => setForm({ ...form, shift_id: e.target.value })}
                required
              >
                <option value="">Select Shift</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.start_time} - {s.end_time})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Off Days</label>
              <div className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <button
                    type="button"
                    key={d.value}
                    onClick={() => toggleOffDay(d.value)}
                    className={`px-3 py-1 rounded text-sm border ${
                      (form.off_days || []).includes(d.value)
                        ? "bg-slate-900 text-white dark:bg-slate-700"
                        : "bg-slate-50 dark:bg-slate-900/40"
                    }`}
                    title={d.label}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Effective date fields removed as requested */}
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.is_active ? "1" : "0"}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.value === "1" })
                }
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() =>
                  setForm({
                    employee_id: "",
                    shift_id: "",
                    off_days: [],
                    is_active: true,
                  })
                }
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Employee
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Shift
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Off Days
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-right text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr
                  key={it.id}
                  className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                >
                  <td className="px-4 py-2">
                    {it.first_name} {it.last_name}
                  </td>
                  <td className="px-4 py-2">
                    {it.shift_name} ({it.start_time} - {it.end_time})
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {(it.off_days || [])
                        .map((d) => days.find((x) => x.value === d)?.label)
                        .filter(Boolean)
                        .map((lbl) => (
                          <span
                            key={lbl}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-secondary-50 text-secondary dark:text-secondary"
                          >
                            {lbl}
                          </span>
                        ))}
                      {(!it.off_days || it.off_days.length === 0) && "—"}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-brand-700 hover:text-brand text-sm font-medium"
                      onClick={() =>
                        setForm({
                          id: it.id,
                          employee_id: String(it.employee_id),
                          shift_id: String(it.shift_id),
                          off_days: it.off_days || [],
                          is_active: !!it.is_active,
                        })
                      }
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No schedules set
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
