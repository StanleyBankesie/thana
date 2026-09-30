/**
 * @fileoverview PromotionForm component.
 * Provides functionality for PromotionForm.
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
export default function PromotionForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({
    employee_id: "",
    promotion_date: new Date().toISOString().split("T")[0],
    previous_pos_id: "",
    new_pos_id: "",
    previous_dept_id: "",
    new_dept_id: "",
    previous_location_id: "",
    new_location_id: "",
    previous_salary: 0,
    new_salary: 0,
    remarks: "",
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [empRes, posRes, deptRes, locRes] = await Promise.all([
          api.get("/hr/employees").catch(() => ({ data: { items: [] } })),
          api.get("/hr/positions").catch(() => ({ data: { items: [] } })),
          api.get("/admin/departments").catch(() => ({ data: { items: [] } })),
          api.get("/hr/setup/locations").catch(() => ({ data: { items: [] } })),
        ]);
        setEmployees(empRes?.data?.items || []);
        setPositions(posRes?.data?.items || []);
        setDepartments(deptRes?.data?.items || []);
        setLocations(locRes?.data?.items || []);
      } catch {}
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    async function fetchItem() {
      setLoading(true);
      try {
        const res = await api.get(`/hr/promotions/${id}`);
        const item = res?.data?.item || {};
        setForm({
          ...item,
          promotion_date: item.promotion_date
            ? item.promotion_date.slice(0, 10)
            : "",
        });
      } catch {
        toast.error("Failed to fetch promotion details");
      } finally {
        setLoading(false);
      }
    }
    fetchItem();
  }, [id, isEdit]);

  const onEmployeeChange = (empId) => {
    const emp = employees.find((e) => String(e.id) === String(empId));
    if (emp) {
      setForm((s) => ({
        ...s,
        employee_id: empId,
        previous_pos_id: emp.pos_id || "",
        previous_dept_id: emp.dept_id || "",
        previous_location_id: emp.location_id || "",
        previous_salary: emp.base_salary || 0,
        // Default new to current
        new_pos_id: emp.pos_id || "",
        new_dept_id: emp.dept_id || "",
        new_location_id: emp.location_id || "",
        new_salary: emp.base_salary || 0,
      }));
    } else {
      setForm((s) => ({ ...s, employee_id: empId }));
    }
  };

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.employee_id) return toast.error("Select employee");

    setLoading(true);
    try {
      await api.post("/hr/promotions", form);
      toast.success("Promotion saved successfully");
      navigate("/human-resources/promotions");
    } catch {
      toast.error("Failed to save promotion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">
          {isEdit ? "Edit Promotion" : "New Assignment/Promotion"}
        </h1>
        <button onClick={() => window.history.back()} className="btn-secondary">
          Back
        </button>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold border-b pb-2 mb-4 text-brand">
            Employee Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label font-semibold">Employee *</label>
              <select
                className="input"
                value={form.employee_id}
                onChange={(e) => onEmployeeChange(e.target.value)}
                required
                disabled={isEdit}
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.emp_code} - {e.first_name} {e.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label font-semibold">Effective Date *</label>
              <input
                className="input"
                type="date"
                value={form.promotion_date}
                onChange={(e) => update("promotion_date", e.target.value)}
                required
              
                disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Current Assignment */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold border-b pb-2 mb-4 text-slate-600">
              Current Assignment
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
                  Department
                </label>
                <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  {departments.find(
                    (d) => String(d.id) === String(form.previous_dept_id),
                  )?.name || "-"}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
                  Location
                </label>
                <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  {locations.find(
                    (b) => String(b.id) === String(form.previous_location_id),
                  )?.location_name || "-"}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
                  Position
                </label>
                <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  {positions.find(
                    (p) => String(p.id) === String(form.previous_pos_id),
                  )?.pos_name || "None"}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
                  Salary
                </label>
                <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono">
                  {Number(form.previous_salary).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* New Assignment */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-brand/20 shadow-sm">
            <h2 className="text-lg font-semibold border-b pb-2 mb-4 text-brand">
              New Assignment
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label font-semibold">New Department</label>
                <select
                  className="input"
                  value={form.new_dept_id}
                  onChange={(e) => update("new_dept_id", e.target.value)}
                >
                  <option value="">No Change</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label font-semibold">New Location</label>
                <select
                  className="input"
                  value={form.new_location_id || ""}
                  onChange={(e) => update("new_location_id", e.target.value)}
                >
                  <option value="">No Change</option>
                  {locations.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.location_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label font-semibold">New Position</label>
                <select
                  className="input"
                  value={form.new_pos_id}
                  onChange={(e) => update("new_pos_id", e.target.value)}
                >
                  <option value="">No Change</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.pos_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label font-semibold">New Salary</label>
                <input
                  className="input font-mono"
                  type="number"
                  step="0.01"
                  value={form.new_salary}
                  onChange={(e) => update("new_salary", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <label className="label font-semibold">Remarks/Notes</label>
          <textarea
            className="input h-56 w-full font-sans"
            value={form.remarks}
            onChange={(e) => update("remarks", e.target.value)}
            placeholder="Reason for promotion, changes, etc."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button onClick={() => window.history.back()} className="btn-secondary">
            Cancel
          </button>
          <button className="btn-primary px-12" disabled={loading}>
            {loading ? "Saving..." : "Process Assignment"}
          </button>
        </div>
      </form>
    </div>
  );
}
