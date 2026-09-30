/**
 * @fileoverview LeaveSetupForm component.
 * Provides functionality for LeaveSetupForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LeaveSetupForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type_name: "",
    max_days: 0,
    is_paid: true,
  });

  useEffect(() => {
    if (!isEdit) return;
    async function fetchItem() {
      setLoading(true);
      try {
        const res = await api.get(`/hr/leave/types/${id}`);
        const item = res?.data?.item || {};
        setForm({
          ...item,
          is_paid: Boolean(item.is_paid),
        });
      } catch {
        toast.error("Failed to fetch leave type details");
      } finally {
        setLoading(false);
      }
    }
    fetchItem();
  }, [id, isEdit]);

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/hr/leave/types", form);
      toast.success("Leave type saved successfully");
      navigate("/human-resources/leave-setup");
    } catch {
      toast.error("Failed to save leave type");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              {isEdit ? "Edit Leave Type" : "New Leave Type"}
            </h1>
            <p className="text-sm mt-1">Leave configuration</p>
          </div>
          <button onClick={() => window.history.back()} className="btn-secondary">
            Back
          </button>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Type Name *</label>
                <input
                  className="input"
                  value={form.type_name}
                  onChange={(e) => update("type_name", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Days per Year</label>
                <input
                  className="input"
                  type="number"
                  value={form.max_days}
                  onChange={(e) => update("max_days", Number(e.target.value))}
                  min="0"
                />
              </div>
              <div>
                <label className="label">Is Paid Leave?</label>
                <select
                  className="input"
                  value={form.is_paid ? "1" : "0"}
                  onChange={(e) => update("is_paid", e.target.value === "1")}
                >
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
              <div>
                <label className="label">Allow Carry Forward?</label>
                <select
                  className="input"
                  value={form.carry_forward ? "1" : "0"}
                  onChange={(e) => update("carry_forward", e.target.value === "1")}
                >
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button onClick={() => window.history.back()} className="btn-secondary">
                Cancel
              </button>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Leave Type"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
