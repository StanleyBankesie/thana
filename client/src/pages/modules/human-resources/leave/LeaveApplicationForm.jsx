/**
 * @fileoverview LeaveApplicationForm component.
 * Provides functionality for LeaveApplicationForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LeaveApplicationForm() {
  const { id } = useParams();
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const [types, setTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    employee_id: "",
    leave_type_id: "",
    start_date: "",
    end_date: "",
    total_days: "",
    reason: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [t, e] = await Promise.all([
          api.get("/hr/leave/types").catch(() => ({ data: { items: [] } })),
          api.get("/hr/employees?status=ACTIVE").catch(() => ({ data: { items: [] } })),
        ]);
        setTypes(t.data?.items || []);
        setEmployees(e.data?.items || []);
      } catch {
        toast.error("Failed to load data");
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!form.start_date || !form.end_date) {
      setForm((p) => ({ ...p, total_days: "" }));
      return;
    }
    const s = new Date(form.start_date);
    const e = new Date(form.end_date);
    const diff = (e - s) / (1000 * 3600 * 24) + 1;
    setForm((p) => ({ ...p, total_days: diff > 0 ? diff.toFixed(1) : "" }));
  }, [form.start_date, form.end_date]);

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post("/hr/leave/apply", form);
      toast.success("Leave request submitted");
      navigate("/human-resources/leave/applications");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit leave");
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => window.history.back()} className="btn-secondary text-sm">
          ← Back
        </button>
        <h1 className="text-xl font-semibold">New Leave Application</h1>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded shadow-sm max-w-xl">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Employee</label>
            <select
              className="input"
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              required
            >
              <option value="">Select</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name} ({e.emp_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Leave Type</label>
            <select
              className="input"
              value={form.leave_type_id}
              onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}
              required
            >
              <option value="">Select</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.type_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                className="input"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              
                disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                className="input"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                required
              
                disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
          </div>
          <div>
            <label className="label">Total Days</label>
            <input className="input bg-slate-50" value={form.total_days} readOnly />
          </div>
          <div>
            <label className="label">Reason</label>
            <textarea
              className="input"
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
          <button className="btn-primary w-full" type="submit">
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}

