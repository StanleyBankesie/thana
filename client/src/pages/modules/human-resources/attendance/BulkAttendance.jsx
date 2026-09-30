/**
 * @fileoverview BulkAttendance component.
 * Provides functionality for BulkAttendance.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function BulkAttendance() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filter, setFilter] = useState({
    employee_id: "",
    dept_id: "",
    location_id: "",
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [resEmps, resDepts, resLocs] = await Promise.all([
          api.get("/hr/employees").catch(() => ({ data: { items: [] } })),
          api.get("/admin/departments").catch(() => ({ data: { items: [] } })),
          api.get("/hr/setup/locations").catch(() => ({ data: { items: [] } })),
        ]);
        setEmployees(resEmps?.data?.items || []);
        setDepartments(resDepts?.data?.items || []);
        setLocations(resLocs?.data?.items || []);
      } catch (err) {
        toast.error("Failed to load employees");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!employees.length) {
      setRows([]);
      return;
    }
    const base = employees.filter((e) => {
      if (filter.dept_id && String(e.dept_id || "") !== String(filter.dept_id))
        return false;
      if (
        filter.location_id &&
        String(e.location_id || "") !== String(filter.location_id)
      )
        return false;
      return true;
    });

    const next = base.map((e) => ({
      employee_id: e.id,
      name: `${e.first_name} ${e.last_name}`.trim(),
      code: e.emp_code,
      attendance_date: attendanceDate,
      status: "PRESENT",
      remarks: "",
    }));
    setRows(next);
  }, [attendanceDate, employees, filter.dept_id, filter.location_id]);

  const filteredRows = useMemo(() => {
    let r = rows;
    if (filter.employee_id) {
      r = r.filter((x) => String(x.employee_id) === String(filter.employee_id));
    }
    return r;
  }, [rows, filter.employee_id]);

  const updateRow = (employee_id, dateStr, patch) => {
    setRows((prev) =>
      prev.map((r) =>
        r.employee_id === employee_id && r.attendance_date === dateStr
          ? { ...r, ...patch }
          : r,
      ),
    );
  };

  const setAllStatus = (status) => {
    setRows((prev) => prev.map((r) => ({ ...r, status })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        date: attendanceDate,
        attendance: rows.map((r) => ({
          employee_id: r.employee_id,
          attendance_date: r.attendance_date || attendanceDate,
          status: r.status,
          remarks: r.remarks || "",
        })),
      };
      await api.post("/hr/attendance/bulk", payload);
      toast.success("Bulk attendance saved successfully");
      navigate("/human-resources/attendance");
    } catch (err) {
      toast.error("Failed to save bulk attendance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => window.history.back()} className="btn-secondary text-sm whitespace-nowrap"
              >
                Back to Dashboard
              </button>
              <h2 className="text-lg font-semibold whitespace-nowrap">Mark Bulk Attendance</h2>
            </div>
            <button
              className="btn-primary px-6 whitespace-nowrap shrink-0"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Save All"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <select
              className="input flex-1 min-w-[160px] text-sm"
              value={filter.employee_id}
              onChange={(e) =>
                setFilter((f) => ({ ...f, employee_id: e.target.value }))
              }
            >
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name}
                </option>
              ))}
            </select>
            <select
              className="input flex-1 min-w-[140px] text-sm"
              value={filter.dept_id}
              onChange={(e) =>
                setFilter((f) => ({ ...f, dept_id: e.target.value }))
              }
              title="Filter by Department"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dept_name}
                </option>
              ))}
            </select>
            <select
              className="input flex-1 min-w-[140px] text-sm"
              value={filter.location_id}
              onChange={(e) =>
                setFilter((f) => ({ ...f, location_id: e.target.value }))
              }
              title="Filter by Location"
            >
              <option value="">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.location_name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="input w-40 text-sm"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded shadow-sm overflow-hidden">
          <div className="p-3 bg-slate-50 dark:bg-slate-700 border-b flex gap-2">
            <span className="text-sm font-medium">Set all to:</span>
            <button
              onClick={() => setAllStatus("PRESENT")}
              className="btn-outline text-xs py-1 px-2"
            >
              Present
            </button>
            <button
              onClick={() => setAllStatus("ABSENT")}
              className="btn-outline text-xs py-1 px-2 text-red-600 border-red-200"
            >
              Absent
            </button>
            <button
              onClick={() => setAllStatus("LATE")}
              className="btn-outline text-xs py-1 px-2 text-orange-600 border-orange-200"
            >
              Late
            </button>
          </div>

          <table className="min-w-full">
            <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
              <tr className="text-left bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Employee
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Code
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Attendance Date
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, idx) => (
                <tr
                  key={`${r.employee_id}-${r.attendance_date}-${idx}`}
                  className="border-t"
                >
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-sm text-slate-500">{r.code}</td>
                  <td className="px-4 py-2 text-sm">{r.attendance_date}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-3">
                      {[
                        { label: "Present", value: "PRESENT" },
                        { label: "Absent", value: "ABSENT" },
                        { label: "Late", value: "LATE" },
                        { label: "On Leave", value: "ON_LEAVE" },
                        { label: "Half Day", value: "HALF_DAY" },
                      ].map((st) => (
                        <label
                          key={st.value}
                          className="inline-flex items-center gap-1 text-xs cursor-pointer select-none"
                        >
                          <input
                            type="radio"
                            name={`status-${r.employee_id}-${r.attendance_date}`}
                            value={st.value}
                            checked={r.status === st.value}
                            onChange={() =>
                              updateRow(r.employee_id, r.attendance_date, {
                                status: st.value,
                              })
                            }
                            className="text-brand focus:ring-brand h-3.5 w-3.5"
                          />
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {st.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="input py-1"
                      placeholder="Optional remarks"
                      value={r.remarks || ""}
                      onChange={(e) =>
                        updateRow(r.employee_id, r.attendance_date, {
                          remarks: e.target.value,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No rows — select a month
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Guard>
  );
}
