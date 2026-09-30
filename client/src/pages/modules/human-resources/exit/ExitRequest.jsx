/**
 * @fileoverview ExitRequest component.
 * Provides functionality for ExitRequest.
 */

import React from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ExitRequest() {
  const [form, setForm] = React.useState({
    employee_id: "",
    exit_type: "RESIGNATION",
    resignation_date: "",
    last_working_day: "",
    reason: "",
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [employees, setEmployees] = React.useState([]);
  const [loadingEmployees, setLoadingEmployees] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    async function loadEmployees() {
      setLoadingEmployees(true);
      try {
        const res = await api.get("/hr/employees", {
          params: { status: "ACTIVE" },
        });
        if (mounted) {
          setEmployees(res?.data?.items || []);
        }
      } catch {
        toast.error("Failed to load employees");
      } finally {
        if (mounted) setLoadingEmployees(false);
      }
    }
    loadEmployees();
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/hr/exits", { ...form });
      toast.success("Exit submitted");
      setForm({
        employee_id: "",
        exit_type: "RESIGNATION",
        resignation_date: "",
        last_working_day: "",
        reason: "",
      });
    } catch {
      toast.error("Failed to submit exit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => window.history.back()} className="btn-secondary text-sm">
          Back to Menu
        </button>
        <h2 className="text-lg font-semibold">Exit Request</h2>
      </div>
      <form
        onSubmit={submit}
        className="bg-white dark:bg-slate-800 p-4 rounded"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Employee</label>
            <select
              className="input"
              value={form.employee_id}
              onChange={(e) =>
                setForm((s) => ({ ...s, employee_id: e.target.value }))
              }
              required
            >
              <option value="">
                {loadingEmployees ? "Loading employees..." : "Select employee"}
              </option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {`${emp.first_name || ""} | ${emp.last_name || ""}`.trim()}
                  {emp.emp_code ? `(${emp.emp_code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Exit Type</label>
            <select
              className="input"
              value={form.exit_type}
              onChange={(e) =>
                setForm((s) => ({ ...s, exit_type: e.target.value }))
              }
            >
              <option value="RESIGNATION">Resignation</option>
              <option value="TERMINATION">Termination</option>
              <option value="RETIREMENT">Retirement</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Resignation Date</label>
            <input
              type="date"
              className="input"
              value={form.resignation_date}
              onChange={(e) =>
                setForm((s) => ({ ...s, resignation_date: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Last Working Day</label>
            <input
              type="date"
              className="input"
              value={form.last_working_day}
              onChange={(e) =>
                setForm((s) => ({ ...s, last_working_day: e.target.value }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Reason</label>
            <textarea
              className="input"
              rows={3}
              value={form.reason}
              onChange={(e) =>
                setForm((s) => ({ ...s, reason: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
