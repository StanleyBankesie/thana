/**
 * @fileoverview ShiftForm component.
 * Provides functionality for ShiftForm.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";


/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ShiftForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    start_time: "08:00",
    end_time: "17:00",
    break_minutes: 60,
    is_active: true,
  });

  const totalHours = useMemo(() => {
    const toMinutes = (t) => {
      if (!t || typeof t !== 'string') return 0;
      const [hh, mm] = t.split(':').map(Number);
      return (hh % 24) * 60 + (mm || 0);
    };
    const start = toMinutes(form.start_time);
    const end = toMinutes(form.end_time);
    let diff = end - start;
    if (diff < 0) diff += 24 * 60;
    diff -= Number(form.break_minutes || 0);
    if (diff < 0) return 'N/A';
    return `${Math.floor(diff / 60)}h ${String(diff % 60).padStart(2, '0')}m`;
  }, [form.start_time, form.end_time, form.break_minutes]);

  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/hr/shifts");
        const item = res.data?.items?.find((i) => String(i.id) === String(id));
        if (item) {
          setForm({
            ...item,
            is_active: !!item.is_active,
          });
        }
      } catch {
        toast.error("Failed to load shift");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/hr/shifts", form);
      toast.success(isEdit ? "Shift updated" : "Shift created");
      navigate("/human-resources/shifts");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save shift");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">
          {isEdit ? "Edit Shift" : "New Shift"}
        </h1>
        <button onClick={() => window.history.back()} className="btn-secondary">
          Back
        </button>
      </div>

      <form
        onSubmit={submit}
        className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm space-y-6 max-w-2xl mx-auto"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label font-semibold">Shift Code *</label>
            <input
              className="input"
              value={form.code}
              onChange={(e) => update("code", e.target.value)}
              required
              placeholder="e.g. DAY, NIGHT"
            />
          </div>
          <div>
            <label className="label font-semibold">Shift Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              placeholder="e.g. Standard Day Shift"
            />
          </div>
          <div>
            <label className="label font-semibold">Start Time *</label>
            <input
              className="input"
              type="time"
              value={form.start_time}
              onChange={(e) => update("start_time", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label font-semibold">End Time *</label>
            <input
              className="input"
              type="time"
              value={form.end_time}
              onChange={(e) => update("end_time", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label font-semibold">Break Minutes</label>
            <input
              className="input"
              type="number"
              value={form.break_minutes}
              onChange={(e) => update("break_minutes", e.target.value)}
            />
          </div>
          <div>
            <label className="label font-semibold">Total Hours</label>
            <div className="input bg-slate-50 dark:bg-slate-900/50 font-semibold text-brand flex items-center">
              {totalHours}
            </div>
          </div>
          <div>
            <label className="label font-semibold">Status</label>
            <select
              className="input"
              value={form.is_active ? "1" : "0"}
              onChange={(e) => update("is_active", e.target.value === "1")}
            >
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button onClick={() => window.history.back()} className="btn-secondary">
            Cancel
          </button>
          <button className="btn-primary px-8" type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Shift"}
          </button>
        </div>
      </form>
    </div>
  );
}
