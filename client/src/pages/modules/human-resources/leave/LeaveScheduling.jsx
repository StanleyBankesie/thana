import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function LeaveScheduling({ isEmbedded }) {
  const [employees, setEmployees] = useState([]);
  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ type: "NONE", value: "" });
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [showEmpOverlay, setShowEmpOverlay] = useState(false);
  const currentYear = new Date().getFullYear();
  const location = useLocation();
  const mode = new URLSearchParams(location.search).get("mode");
  const showFormOnly = mode === "form";
  const showListOnly = mode === "list";
  const [startSel, setStartSel] = useState({
    year: String(currentYear),
    month: "",
    day: "",
  });
  const [endSel, setEndSel] = useState({
    year: String(currentYear),
    month: "",
    day: "",
  });

  const [form, setForm] = useState({
    employee_ids: [],
    leave_type_id: "",
    start_date: "",
    end_date: "",
    remarks: "",
  });

  const loadData = async () => {
    try {
      const [eRes, tRes, rRes, dRes, lRes, etRes, cRes, sRes, wsRes] =
        await Promise.all([
          api.get("/hr/employees?status=ACTIVE").catch(() => ({ data: { items: [] } })),
          api.get("/hr/leave/types").catch(() => ({ data: { items: [] } })),
          api.get("/hr/leave/records?source=SCHEDULE").catch(() => ({ data: { items: [] } })),
          api.get("/hr/departments").catch(() => ({ data: { items: [] } })),
          api.get("/hr/setup/locations").catch(() => ({ data: { items: [] } })),
          api.get("/hr/setup/employment-types").catch(() => ({ data: { items: [] } })),
          api.get("/hr/setup/employee-categories").catch(() => ({ data: { items: [] } })),
          api.get("/hr/shifts").catch(() => ({ data: { items: [] } })),
          api.get("/hr/work-schedules").catch(() => ({ data: { items: [] } })),
        ]);
      setEmployees(eRes.data?.items || []);
      setTypes(tRes.data?.items || []);
      setRecords(rRes.data?.items || []);
      setDepartments(dRes.data?.items || []);
      setLocations(lRes.data?.items || []);
      setEmploymentTypes(etRes.data?.items || []);
      setCategories(cRes.data?.items || []);
      setShifts(sRes.data?.items || []);
      setSchedules(wsRes.data?.items || []);
    } catch {
      toast.error("Failed to load scheduling data");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const [selDepts, setSelDepts] = useState([]);
  const [selLocs, setSelLocs] = useState([]);
  const [selEmpTypes, setSelEmpTypes] = useState([]);
  const [selCats, setSelCats] = useState([]);
  const [selShifts, setSelShifts] = useState([]);

  const filteredEmployees = useMemo(() => {
    const deptSet = new Set(selDepts.map(String));
    const locSet = new Set(selLocs.map(String));
    const empTypeSet = new Set(selEmpTypes.map(String));
    const catSet = new Set(selCats.map(String));
    const shiftSet = new Set(selShifts.map(String));
    let allowedByShift = null;
    if (shiftSet.size > 0) {
      allowedByShift = new Set(
        schedules
          .filter((s) => shiftSet.has(String(s.shift_id)))
          .map((s) => String(s.employee_id)),
      );
    }
    return employees.filter((e) => {
      if (deptSet.size > 0 && !deptSet.has(String(e.dept_id || "")))
        return false;
      if (locSet.size > 0 && !locSet.has(String(e.location_id || "")))
        return false;
      if (
        empTypeSet.size > 0 &&
        !empTypeSet.has(String(e.employment_type_id || ""))
      )
        return false;
      if (catSet.size > 0 && !catSet.has(String(e.category_id || "")))
        return false;
      if (allowedByShift && !allowedByShift.has(String(e.id))) return false;
      return true;
    });
  }, [
    employees,
    selDepts,
    selLocs,
    selEmpTypes,
    selCats,
    selShifts,
    schedules,
  ]);

  const years = useMemo(() => {
    const y = Number(currentYear);
    return Array.from({ length: 6 }, (_, i) => String(y - 2 + i));
  }, [currentYear]);

  const months = [
    { value: "01", label: "Jan" },
    { value: "02", label: "Feb" },
    { value: "03", label: "Mar" },
    { value: "04", label: "Apr" },
    { value: "05", label: "May" },
    { value: "06", label: "Jun" },
    { value: "07", label: "Jul" },
    { value: "08", label: "Aug" },
    { value: "09", label: "Sep" },
    { value: "10", label: "Oct" },
    { value: "11", label: "Nov" },
    { value: "12", label: "Dec" },
  ];

  const startDays = useMemo(() => {
    if (!startSel.month) return [];
    const total = new Date(
      Number(startSel.year),
      Number(startSel.month),
      0,
    ).getDate();
    return Array.from({ length: total }, (_, i) =>
      String(i + 1).padStart(2, "0"),
    );
  }, [startSel]);

  const endDays = useMemo(() => {
    if (!endSel.month) return [];
    const total = new Date(
      Number(endSel.year),
      Number(endSel.month),
      0,
    ).getDate();
    return Array.from({ length: total }, (_, i) =>
      String(i + 1).padStart(2, "0"),
    );
  }, [endSel]);

  useEffect(() => {
    if (startSel.year && startSel.month && startSel.day) {
      setForm((f) => ({
        ...f,
        start_date: `${startSel.year}-${startSel.month}-${startSel.day}`,
      }));
    } else {
      setForm((f) => ({ ...f, start_date: "" }));
    }
  }, [startSel]);

  useEffect(() => {
    if (endSel.year && endSel.month && endSel.day) {
      setForm((f) => ({
        ...f,
        end_date: `${endSel.year}-${endSel.month}-${endSel.day}`,
      }));
    } else {
      setForm((f) => ({ ...f, end_date: "" }));
    }
  }, [endSel]);

  async function submit(e) {
    e.preventDefault();
    if (!form.employee_ids.length)
      return toast.error("Select at least one employee");
    if (!form.leave_type_id || !form.start_date || !form.end_date)
      return toast.error("Please fill all required fields");

    setLoading(true);
    try {
      const res = await api.post("/hr/leave/schedule", form);
      toast.success(
        `Successfully scheduled ${res.data?.scheduled || 0} leave record(s)`,
      );
      setForm({
        employee_ids: [],
        leave_type_id: "",
        start_date: "",
        end_date: "",
        remarks: "",
      });
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to schedule leave");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (
      !window.confirm("Are you sure you want to delete this scheduled leave?")
    )
      return;
    try {
      await api.delete(`/hr/leave/records/${id}`);
      toast.success("Leave schedule removed");
      loadData();
    } catch (err) {
      toast.error("Failed to delete record");
    }
  }

  return (
    <div className={isEmbedded ? "space-y-6" : "p-4 md:p-8 space-y-8"}>
      {!isEmbedded && (
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              Leave Scheduling
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Assign priority leave schedules to employees
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {!showListOnly && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">
              New Schedule
            </h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Filter By</label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: "NONE", label: "All" },
                    { key: "DEPARTMENT", label: "Department" },
                    { key: "LOCATION", label: "Location" },
                    { key: "EMPLOYMENT_TYPE", label: "Employee Type" },
                    { key: "CATEGORY", label: "Category" },
                    { key: "SHIFT", label: "Shift" },
                  ].map((opt) => (
                    <label
                      key={opt.key}
                      className="inline-flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="filterType"
                        checked={filter.type === opt.key}
                        onChange={() => setFilter({ type: opt.key, value: "" })}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {filter.type !== "NONE" && (
                <div>
                  <div className="text-xs text-slate-500 mb-2">
                    Select {filter.type.replace("_", " ").toLowerCase()}
                  </div>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {filter.type === "DEPARTMENT" &&
                      departments.map((d) => {
                        const checked = selDepts.includes(String(d.id));
                        return (
                          <label key={d.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelDepts((prev) =>
                                  checked
                                    ? prev.filter((x) => x !== String(d.id))
                                    : [...prev, String(d.id)],
                                )
                              }
                            />
                            <span className="text-sm">{d.dept_name}</span>
                          </label>
                        );
                      })}
                    {filter.type === "LOCATION" &&
                      locations.map((l) => {
                        const checked = selLocs.includes(String(l.id));
                        return (
                          <label key={l.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelLocs((prev) =>
                                  checked
                                    ? prev.filter((x) => x !== String(l.id))
                                    : [...prev, String(l.id)],
                                )
                              }
                            />
                            <span className="text-sm">{l.location_name}</span>
                          </label>
                        );
                      })}
                    {filter.type === "EMPLOYMENT_TYPE" &&
                      employmentTypes.map((t) => {
                        const checked = selEmpTypes.includes(String(t.id));
                        return (
                          <label key={t.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelEmpTypes((prev) =>
                                  checked
                                    ? prev.filter((x) => x !== String(t.id))
                                    : [...prev, String(t.id)],
                                )
                              }
                            />
                            <span className="text-sm">{t.name}</span>
                          </label>
                        );
                      })}
                    {filter.type === "CATEGORY" &&
                      categories.map((c) => {
                        const checked = selCats.includes(String(c.id));
                        return (
                          <label key={c.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelCats((prev) =>
                                  checked
                                    ? prev.filter((x) => x !== String(c.id))
                                    : [...prev, String(c.id)],
                                )
                              }
                            />
                            <span className="text-sm">{c.name}</span>
                          </label>
                        );
                      })}
                    {filter.type === "SHIFT" &&
                      shifts.map((s) => {
                        const checked = selShifts.includes(String(s.id));
                        return (
                          <label key={s.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelShifts((prev) =>
                                  checked
                                    ? prev.filter((x) => x !== String(s.id))
                                    : [...prev, String(s.id)],
                                )
                              }
                            />
                            <span className="text-sm">
                              {s.name}{" "}
                              <span className="text-xs text-slate-500">
                                ({s.code})
                              </span>
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
              <div>
                <label className="label">
                  Employees <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  className="input flex items-center justify-between"
                  onClick={() => setShowEmpOverlay(true)}
                >
                  <span className="text-sm">
                    {form.employee_ids.length} selected
                  </span>
                  <span className="text-xs text-slate-500">Open Selector</span>
                </button>
              </div>

              <div>
                <label className="label">
                  Leave Type <span className="text-red-500">*</span>
                </label>
                <select
                  className="input"
                  value={form.leave_type_id}
                  onChange={(e) =>
                    setForm({ ...form, leave_type_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select Type</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.type_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="input"
                      value={startSel.year}
                      onChange={(e) =>
                        setStartSel({
                          ...startSel,
                          year: e.target.value,
                          day: "",
                        })
                      }
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input"
                      value={startSel.month}
                      onChange={(e) =>
                        setStartSel({
                          ...startSel,
                          month: e.target.value,
                          day: "",
                        })
                      }
                    >
                      <option value="">MM</option>
                      {months.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input"
                      value={startSel.day}
                      onChange={(e) =>
                        setStartSel({ ...startSel, day: e.target.value })
                      }
                      required
                    >
                      <option value="">DD</option>
                      {startDays.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="input"
                      value={endSel.year}
                      onChange={(e) =>
                        setEndSel({ ...endSel, year: e.target.value, day: "" })
                      }
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input"
                      value={endSel.month}
                      onChange={(e) =>
                        setEndSel({ ...endSel, month: e.target.value, day: "" })
                      }
                    >
                      <option value="">MM</option>
                      {months.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input"
                      value={endSel.day}
                      onChange={(e) =>
                        setEndSel({ ...endSel, day: e.target.value })
                      }
                      required
                    >
                      <option value="">DD</option>
                      {endDays.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Remarks</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.remarks}
                  onChange={(e) =>
                    setForm({ ...form, remarks: e.target.value })
                  }
                  placeholder="Optional notes..."
                />
              </div>

              <button
                className="btn-primary w-full"
                type="submit"
                disabled={loading}
              >
                {loading ? "Scheduling..." : "Assign Schedule"}
              </button>
            </form>
          </div>
        )}

        {showEmpOverlay && (
          <div className="fixed inset-0 bg-black/30 z-50 flex">
            <div className="m-auto w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">Select Employees</div>
                <label className="inline-flex items-center gap-2 mr-auto ml-4">
                  {(() => {
                    const allIds = filteredEmployees.map((e) => e.id);
                    const allSelected =
                      allIds.length > 0 &&
                      allIds.every((id) => form.employee_ids.includes(id));
                    return (
                      <>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm((f) => ({
                                ...f,
                                employee_ids: Array.from(
                                  new Set([...f.employee_ids, ...allIds]),
                                ),
                              }));
                            } else {
                              setForm((f) => ({
                                ...f,
                                employee_ids: f.employee_ids.filter(
                                  (id) => !allIds.includes(id),
                                ),
                              }));
                            }
                          }}
                        />
                        <span className="text-sm">Select All</span>
                      </>
                    );
                  })()}
                </label>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEmpOverlay(false)}
                >
                  Done
                </button>
              </div>
              <div className="h-80 overflow-y-auto">
                {filteredEmployees.map((e) => {
                  const checked = form.employee_ids.includes(e.id);
                  return (
                    <label
                      key={e.id}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/40"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setForm((f) => ({
                            ...f,
                            employee_ids: checked
                              ? f.employee_ids.filter((id) => id !== e.id)
                              : [...f.employee_ids, e.id],
                          }));
                        }}
                      />
                      <span className="text-sm">
                        {e.first_name} {e.last_name}{" "}
                        <span className="text-xs text-slate-500">
                          ({e.emp_code})
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!showFormOnly && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Active Scheduled Records
              </h2>
            </div>

            <div className="overflow-x-auto flex-1 h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  <tr className="text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">
                    <th className="p-4 font-medium">Employee</th>
                    <th className="p-4 font-medium">Type</th>
                    <th className="p-4 font-medium">Duration</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                  {records.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-slate-500"
                      >
                        No scheduled records found.
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="p-4 font-medium dark:text-slate-200">
                          {r.first_name} {r.last_name}
                          <div className="text-xs text-slate-500 font-normal">
                            {r.emp_code}
                          </div>
                        </td>
                        <td className="p-4 dark:text-slate-300">
                          {r.type_name}
                        </td>
                        <td className="p-4 dark:text-slate-300">
                          {new Date(r.start_date).toLocaleDateString()} -{" "}
                          {new Date(r.end_date).toLocaleDateString()}
                          <div className="text-xs text-slate-500 mt-1">
                            {r.total_days} day(s)
                          </div>
                        </td>
                        <td className="p-4">
                          {r.status === "ACTIVE" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400">
                              {r.status}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="text-red-500 hover:text-red-700 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10"
                            title="Delete Schedule"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
