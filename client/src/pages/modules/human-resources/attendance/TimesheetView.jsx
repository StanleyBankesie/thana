/**
 * @fileoverview TimesheetView component.
 * Provides functionality for TimesheetView.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function TimesheetView({ isOpen = true, onClose, onSuccess }) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [regularWorkingHours, setRegularWorkingHours] = useState(8);

  const [form, setForm] = useState({
    employee_id: "",
    work_date: new Date().toISOString().slice(0, 10),
    time_in: "",
    time_out: "",
    hours_worked: 0,
    overtime_hours: 0,
    short_hours: 0,
    location_gps: "",
    remarks: "",
    on_leave: false,
  });

  const handleClose = () => {
    if (onClose) onClose();
    else navigate("/human-resources?section=Time%20%26%20Attendance");
  };

  useEffect(() => {
    loadEmployees();
    loadParameters();
    getCurrentLocation();
  }, []);

  const loadParameters = async () => {
    try {
      const res = await api.get("/hr/setup/parameters");
      const params = res?.data?.items || [];
      const wh = params.find((p) => p.param_key === "REGULAR_WORKING_HOURS");
      if (wh) setRegularWorkingHours(Number(wh.param_value));
    } catch {}
  };

  const getCurrentLocation = () => {
    if (form.on_leave) return;
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setForm((prev) => ({
            ...prev,
            location_gps: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          }));
        },
        (error) => {
          console.warn("Error getting location:", error);
        }
      );
    }
  };

  useEffect(() => {
    if (form.time_in && form.time_out) {
      const start = new Date(`2000-01-01T${form.time_in}`);
      const end = new Date(`2000-01-01T${form.time_out}`);
      let diff = (end - start) / (1000 * 60 * 60);
      if (diff < 0) diff += 24;

      const regular = Math.min(diff, regularWorkingHours);
      const ot = Math.max(0, diff - regularWorkingHours);
      const short = Math.max(0, regularWorkingHours - diff);

      setForm((prev) => ({
        ...prev,
        hours_worked: regular.toFixed(2),
        overtime_hours: ot.toFixed(2),
        short_hours: short.toFixed(2),
      }));
    }
  }, [form.time_in, form.time_out, regularWorkingHours]);

  const loadEmployees = async () => {
    try {
      const res = await api.get("/hr/employees");
      setEmployees(res.data?.items || []);
    } catch {}
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.employee_id) return toast.error("Please select an employee");
    setLoading(true);
    try {
      await api.post("/hr/timesheets", form);
      toast.success("Timesheet entry saved");
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save timesheet");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>⏱</span> New Timesheet Entry
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-semibold leading-none p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={save} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
              Employee *
            </label>
            <select
              className="input text-sm"
              value={form.employee_id}
              onChange={(e) =>
                setForm({ ...form, employee_id: e.target.value })
              }
              required
            >
              <option value="">-- Select Employee --</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.emp_code ? `${e.emp_code} - ` : ""}
                  {e.first_name} {e.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="on_leave_check"
              checked={form.on_leave}
              onChange={async (e) => {
                const on_leave = e.target.checked;
                if (on_leave && form.employee_id) {
                  try {
                    const res = await api.get(
                      `/hr/work-schedules?employee_id=${form.employee_id}`
                    );
                    const item = (res.data?.items || [])[0];
                    if (item?.start_time && item?.end_time) {
                      setForm((prev) => ({
                        ...prev,
                        on_leave: true,
                        time_in: item.start_time,
                        time_out: item.end_time,
                        location_gps: "",
                        remarks: prev.remarks || "Leave",
                      }));
                    } else {
                      setForm((prev) => ({ ...prev, on_leave }));
                      toast.info("No shift schedule found; set times manually");
                    }
                  } catch {
                    setForm((prev) => ({ ...prev, on_leave }));
                    toast.error("Failed to load shift times");
                  }
                } else {
                  setForm((prev) => ({
                    ...prev,
                    on_leave,
                    location_gps: prev.location_gps || "",
                  }));
                  if (!on_leave) getCurrentLocation();
                }
              }}
              className="rounded text-brand focus:ring-brand h-4 w-4"
            />
            <label htmlFor="on_leave_check" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              On Leave / Vacation
            </label>
          </div>

          <div>
            <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
              Work Date *
            </label>
            <input
              type="date"
              className="input text-sm"
              value={form.work_date}
              onChange={(e) =>
                setForm({ ...form, work_date: e.target.value })
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
                Time In *
              </label>
              <input
                type="time"
                className="input text-sm"
                value={form.time_in}
                onChange={(e) =>
                  setForm({ ...form, time_in: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
                Time Out *
              </label>
              <input
                type="time"
                className="input text-sm"
                value={form.time_out}
                onChange={(e) =>
                  setForm({ ...form, time_out: e.target.value })
                }
                required
              />
            </div>
          </div>


          <div>
            <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
              Location (GPS)
            </label>
            <div className="flex gap-2">
              <input
                className="input bg-slate-50 dark:bg-slate-900/50 text-xs flex-1"
                value={form.location_gps}
                placeholder="GPS coordinates..."
                readOnly
              />
              <button
                type="button"
                onClick={getCurrentLocation}
                className="btn-secondary text-xs px-3"
                title="Fetch Current Location"
              >
                📍 GPS
              </button>
            </div>
          </div>

          <div>
            <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
              Remarks
            </label>
            <textarea
              className="input h-20 text-sm"
              placeholder="Task & activity details..."
              value={form.remarks}
              onChange={(e) =>
                setForm({ ...form, remarks: e.target.value })
              }
            />
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/60 mt-4">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              className="btn-primary px-6 text-sm"
              type="submit"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Timesheet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
