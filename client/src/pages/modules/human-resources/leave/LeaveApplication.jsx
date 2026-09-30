import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function LeaveApplication({ isEmbedded }) {
  const [employees, setEmployees] = useState([]);
  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    employee_id: "",
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const loadData = async () => {
    try {
      const [eRes, tRes, rRes] = await Promise.all([
        api.get("/hr/employees?status=ACTIVE").catch(() => ({ data: { items: [] } })),
        api.get("/hr/leave/types").catch(() => ({ data: { items: [] } })),
        api.get("/hr/leave/records?source=APPLICATION").catch(() => ({ data: { items: [] } })),
      ]);
      setEmployees(eRes.data?.items || []);
      setTypes(tRes.data?.items || []);
      setRecords(rRes.data?.items || []);
    } catch {
      toast.error("Failed to load application data");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalDays = React.useMemo(() => {
    if (!form.start_date || !form.end_date) return 0;
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    if (end < start) return 0;
    return (end - start) / (1000 * 3600 * 24) + 1;
  }, [form.start_date, form.end_date]);

  async function submit(e) {
    e.preventDefault();
    if (
      !form.employee_id ||
      !form.leave_type_id ||
      !form.start_date ||
      !form.end_date
    )
      return toast.error("Please fill all required fields");

    setLoading(true);
    try {
      await api.post("/hr/leave/apply", form);
      toast.success(
        "Leave application submitted successfully. Roster/Schedule conflicts have been overridden.",
      );
      setForm({
        employee_id: "",
        leave_type_id: "",
        start_date: "",
        end_date: "",
        reason: "",
      });
      loadData();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to submit leave application",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to withdraw this application?"))
      return;
    try {
      await api.delete(`/hr/leave/records/${id}`);
      toast.success("Leave application withdrawn!");
      loadData();
    } catch (err) {
      toast.error("Failed to delete application");
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
              Leave Request
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Self-serve leave requests with overriding priority
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {(() => {
          const mode = new URLSearchParams(useLocation().search).get("mode");
          const showFormOnly = mode === "form";
          const showListOnly = mode === "list" || !mode;
          return (
            <>
              {!showListOnly && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      New Request
                    </h2>
                    <button onClick={() => window.history.back()} className="btn-secondary text-sm"
                    >
                      Back to List
                    </button>
                  </div>
                  <div className="mb-4">
                    <Link
                      to="/human-resources/leave/request?mode=list"
                      className="btn-secondary text-sm"
                    >
                      View Request List
                    </Link>
                  </div>
                  <form onSubmit={submit} className="space-y-4">
                    <div>
                      <label className="label">
                        Employee Proxy <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="input"
                        value={form.employee_id}
                        onChange={(e) =>
                          setForm({ ...form, employee_id: e.target.value })
                        }
                        required
                      >
                        <option value="">Select Employee...</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.first_name} {e.last_name} ({e.emp_code})
                          </option>
                        ))}
                      </select>
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
                        <option value="">Select Type...</option>
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
                        <input
                          className="input"
                          type="date"
                          value={form.start_date}
                          onChange={(e) =>
                            setForm({ ...form, start_date: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="label">
                          End Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="input"
                          type="date"
                          value={form.end_date}
                          onChange={(e) =>
                            setForm({ ...form, end_date: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label flex justify-between">
                        <span>Total Days Extracted</span>
                        <span className="text-brand font-bold">
                          {totalDays > 0 ? totalDays : 0}
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="label">Reason / Justification</label>
                      <textarea
                        className="input"
                        rows={3}
                        value={form.reason}
                        onChange={(e) =>
                          setForm({ ...form, reason: e.target.value })
                        }
                        placeholder="Manager context..."
                      />
                    </div>

                    <button
                      className="btn-primary w-full"
                      type="submit"
                      disabled={loading || totalDays <= 0}
                    >
                      {loading ? "Submitting..." : "Submit Request"}
                    </button>
                  </form>
                </div>
              )}

              {!showFormOnly && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      Request History
                    </h2>
                    <Link
                      to="/human-resources/leave/request?mode=form"
                      className="btn-primary text-sm"
                    >
                      Make Request
                    </Link>
                  </div>

                  <div className="overflow-x-auto flex-1 h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
                        <tr className="text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">
                          <th className="p-4 font-medium">Employee</th>
                          <th className="p-4 font-medium">Type</th>
                          <th className="p-4 font-medium">Period</th>
                          <th className="p-4 font-medium">Status</th>
                          <th className="p-4 font-medium text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                        {records.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="p-8 text-center text-slate-500"
                            >
                              No leave requests found.
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
                                {r.reason && (
                                  <div
                                    className="text-xs text-slate-400 mt-0.5 max-w-[150px] truncate"
                                    title={r.reason}
                                  >
                                    "{r.reason}"
                                  </div>
                                )}
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
                                  title="Withdraw Request"
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
            </>
          );
        })()}
      </div>
    </div>
  );
}
