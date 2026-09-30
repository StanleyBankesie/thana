/**
 * @fileoverview PmScheduleForm component.
 * Provides functionality for PmScheduleForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PmScheduleForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { search } = useLocation();
  const mode = new URLSearchParams(search).get("mode");
  const readOnly = mode === "view";

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: "",
    assetNo: "AST-001",
    frequency: "MONTHLY",
    active: true,
  });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setTimeout(() => {
      setForm({
        code: "PM-001",
        assetNo: "AST-001",
        frequency: "MONTHLY",
        active: true,
      });
      setLoading(false);
    }, 150);
  }, [isEdit]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      navigate("/maintenance/pm-schedules");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => window.history.back()} className="btn btn-secondary mb-4"
        >
          ← Back to PM Schedules
        </button>
        <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">
          {readOnly
            ? "View Schedule"
            : isEdit
              ? "Edit Schedule"
              : "New Schedule"}
        </h1>
      </div>

      <form onSubmit={submit}>
        <div className="card shadow-sm">
          <div className="card-body space-y-6">
            <fieldset disabled={readOnly} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="label">Schedule Code</label>
                  <input
                    className="input w-full"
                    value={form.code}
                    onChange={(e) => update("code", e.target.value)}
                    placeholder="Auto-generated"
                  />
                </div>
                <div>
                  <label className="label">Target Asset</label>
                  <input
                    className="input w-full"
                    value={form.assetNo}
                    onChange={(e) => update("assetNo", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Frequency</label>
                  <select
                    className="input w-full"
                    value={form.frequency}
                    onChange={(e) => update("frequency", e.target.value)}
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                  </select>
                </div>
                <div>
                  <label className="label">Active Status</label>
                  <select
                    className="input w-full"
                    value={form.active ? "1" : "0"}
                    onChange={(e) => update("active", e.target.value === "1")}
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>
              </div>
            </fieldset>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => window.history.back()} className="btn btn-secondary">
                Cancel
              </button>
              {!readOnly && (
                <button className="btn-success px-8" disabled={loading}>
                  {loading ? "Saving..." : "Save Plan"}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
