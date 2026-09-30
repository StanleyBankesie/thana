/**
 * @fileoverview VisitorLogForm component.
 * Provides functionality for VisitorLogForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function VisitorLogForm() {
  const { hasExceptional } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = Boolean(id);
  const isView = new URLSearchParams(location.search).get("mode") === "view";
  const readOnly = isView;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState([]);

  const [form, setForm] = useState({
    visitorName: "",
    phoneNumber: "",
    organisation: "",
    departmentVisited: "",
    tempAddress: "",
    timeIn: "",
    timeOut: "",
    visitDate: new Date().toISOString().split("T")[0],
    purpose: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    async function loadData() {
      if (!isEdit) return;
      setLoading(true);
      try {
        const res = await api.get(`/visitors/${id}`);
        const item = res.data?.item || {};
        setForm({
          visitorName: item.visitor_name || "",
          phoneNumber: item.phone_number || "",
          organisation: item.organisation || "",
          departmentVisited: item.department_visited || "",
          tempAddress: item.temp_address || "",
          timeIn: item.time_in || "",
          timeOut: item.time_out || "",
          visitDate: item.visit_date
            ? item.visit_date.split("T")[0]
            : new Date().toISOString().split("T")[0],
          purpose: item.purpose || "",
          status: item.status || "ACTIVE",
        });
      } catch (e) {
        toast.error(
          e?.response?.data?.message || "Failed to load visitor record",
        );
        navigate("/service-management/visitors-log");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, isEdit, navigate]);

  useEffect(() => {
    async function loadDepartments() {
      try {
        const res = await api.get("/visitors/metadata/departments");
        setDepartments(res.data?.items || []);
      } catch {
        // Silent fail
      }
    }
    loadDepartments();
  }, []);

  function updateField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-update status based on time_out
      if (field === "timeOut") {
        next.status = value ? "COMPLETED" : "ACTIVE";
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      visitorName: form.visitorName,
      phoneNumber: form.phoneNumber,
      organisation: form.organisation,
      departmentVisited: form.departmentVisited,
      tempAddress: form.tempAddress,
      timeIn: form.timeIn,
      timeOut: form.timeOut,
      visitDate: form.visitDate,
      purpose: form.purpose,
      status: form.status,
    };

    try {
      if (isEdit) {
        await api.put(`/visitors/${id}`, payload);
        toast.success("Visitor record updated successfully");
      } else {
        await api.post("/visitors", payload);
        toast.success("Visitor record created successfully");
      }
      navigate("/service-management/visitors-log");
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to save visitor record",
      );
      setSaving(false);
    }
  }

  function setCurrentTime(field) {
    const now = new Date();
    const timeString = now.toTimeString().slice(0, 5);
    updateField(field, timeString);
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-body text-center py-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header bg-brand text-white rounded-t-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">
              {isEdit ? "Edit Visitor Record" : "New Visitor Entry"}
            </h1>
            <p className="text-sm mt-1">
              {isEdit
                ? "Update visitor information"
                : "Record a new visitor entry"}
            </p>
          </div>
          <button onClick={() => window.history.back()} className="btn-success text-sm"
          >
            Back to List
          </button>
        </div>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">
                Visitor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input"
                value={form.visitorName}
                onChange={(e) => updateField("visitorName", e.target.value)}
                placeholder="Enter visitor name"
                required
              />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input
                type="tel"
                className="input"
                value={form.phoneNumber}
                onChange={(e) => updateField("phoneNumber", e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <label className="label">Organisation</label>
              <input
                type="text"
                className="input"
                value={form.organisation}
                onChange={(e) => updateField("organisation", e.target.value)}
                placeholder="Enter organisation"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Department Visiting</label>
              <input
                type="text"
                className="input"
                value={form.departmentVisited}
                onChange={(e) =>
                  updateField("departmentVisited", e.target.value)
                }
                placeholder="Enter department"
                list="departments-list"
              />
              <datalist id="departments-list">
                {departments.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">Temporary Address</label>
              <input
                type="text"
                className="input"
                value={form.tempAddress}
                onChange={(e) => updateField("tempAddress", e.target.value)}
                placeholder="Enter temporary address"
              />
            </div>
            <div>
              <label className="label">
                Visit Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="input"
                value={form.visitDate}
                onChange={(e) => updateField("visitDate", e.target.value)}
                required
              
                disabled={readOnly || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Time In</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  className="input flex-1 min-w-44"
                  value={form.timeIn}
                  onChange={(e) => updateField("timeIn", e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary text-sm px-3"
                  onClick={() => setCurrentTime("timeIn")}
                >
                  Now
                </button>
              </div>
            </div>
            <div>
              <label className="label">Time Out</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  className="input flex-1"
                  value={form.timeOut}
                  onChange={(e) => updateField("timeOut", e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary text-sm px-3"
                  onClick={() => setCurrentTime("timeOut")}
                >
                  Now
                </button>
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
              >
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Purpose of Visit</label>
            <textarea
              className="input"
              rows={3}
              value={form.purpose}
              onChange={(e) => updateField("purpose", e.target.value)}
              placeholder="Enter purpose of visit"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={() => window.history.back()} className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-success"
              disabled={saving || !form.visitorName || !form.visitDate}
            >
              {saving ? "Saving..." : isEdit ? "Update Record" : "Save Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
