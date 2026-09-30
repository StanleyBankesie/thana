import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

export default function MaintenanceForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    request_date: new Date().toISOString().split("T")[0],
    vehicle_id: "",
    issue_summary: "",
    details: "",
    priority: "MEDIUM",
    status: "PENDING",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vehicle_id || !formData.issue_summary) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      if (id) {
        await api.put(`/transport/maintenance/${id}`, formData);
        toast.success("Request updated successfully");
      } else {
        await api.post("/transport/maintenance", formData);
        toast.success("Request added successfully");
      }
      navigate("/transport/maintenance");
    } catch (err) {
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <button onClick={() => window.history.back()} className="btn btn-ghost btn-sm px-2 text-slate-500"
            >
              ← Back
            </button>
            {id ? "Edit Request" : "New Maintenance Request"}
          </h1>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="card-body p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Date <span className="text-red-500">*</span></span>
              </label>
              <input
                type="date"
                name="request_date"
                value={formData.request_date}
                onChange={handleChange}
                className="input input-bordered w-full"
                required
              
                disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Vehicle <span className="text-red-500">*</span></span>
              </label>
              <select
                name="vehicle_id"
                value={formData.vehicle_id}
                onChange={handleChange}
                className="select select-bordered w-full"
                required
              >
                <option value="">Select Vehicle</option>
                <option value="1">TRK-001</option>
                <option value="2">VAN-002</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Priority</span>
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="select select-bordered w-full"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Status</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="select select-bordered w-full"
              >
                <option value="PENDING">Pending Approval</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <div className="form-control md:col-span-2">
              <label className="label">
                <span className="label-text">Issue Summary <span className="text-red-500">*</span></span>
              </label>
              <input
                type="text"
                name="issue_summary"
                value={formData.issue_summary}
                onChange={handleChange}
                className="input input-bordered w-full"
                placeholder="e.g. Engine oil leak"
                required
              />
            </div>

            <div className="form-control md:col-span-2">
              <label className="label">
                <span className="label-text">Detailed Description</span>
              </label>
              <textarea
                name="details"
                value={formData.details}
                onChange={handleChange}
                className="textarea textarea-bordered w-full"
                rows="4"
                placeholder="Describe the issue in detail..."
              ></textarea>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t pt-4">
            <button onClick={() => window.history.back()} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${loading ? "loading" : ""}`}
              disabled={loading}
            >
              {loading ? "Saving..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
