import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

export default function InspectionForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    inspection_date: new Date().toISOString().split("T")[0],
    vehicle_id: "",
    inspection_type: "PRE_TRIP",
    status: "PASSED",
    remarks: "",
    // Checklist
    check_tyres: true,
    check_brakes: true,
    check_engine: true,
    check_lights: true,
    check_horn: true,
    check_oil: true,
    check_coolant: true,
    check_battery: true,
    check_mirrors: true,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vehicle_id) {
      toast.error("Please select a vehicle");
      return;
    }
    setLoading(true);
    try {
      if (id) {
        await api.put(`/transport/inspections/${id}`, formData);
        toast.success("Inspection updated successfully");
      } else {
        await api.post("/transport/inspections", formData);
        toast.success("Inspection recorded successfully");
      }
      navigate("/transport/inspections");
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
            {id ? "Edit Inspection" : "New Vehicle Inspection"}
          </h1>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="card-body p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <span className="label-text">Date <span className="text-red-500">*</span></span>
              </label>
              <input
                type="date"
                name="inspection_date"
                value={formData.inspection_date}
                onChange={handleChange}
                className="input input-bordered w-full"
                required
              
                disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text">Type</span>
              </label>
              <select
                name="inspection_type"
                value={formData.inspection_type}
                onChange={handleChange}
                className="select select-bordered w-full"
              >
                <option value="PRE_TRIP">Pre-Trip Inspection</option>
                <option value="POST_TRIP">Post-Trip Inspection</option>
                <option value="ROUTINE">Routine Inspection</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Overall Status</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="select select-bordered w-full"
              >
                <option value="PASSED">Passed</option>
                <option value="FAILED">Failed</option>
                <option value="MAINTENANCE_REQUIRED">Maintenance Required</option>
              </select>
            </div>

            <div className="md:col-span-2 mt-4 border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Checklist Items</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {['tyres', 'brakes', 'engine', 'lights', 'horn', 'oil', 'coolant', 'battery', 'mirrors'].map((item) => (
                  <label key={item} className="cursor-pointer label justify-start gap-3 bg-slate-50 dark:bg-slate-800 p-2 rounded">
                    <input 
                      type="checkbox" 
                      name={`check_${item}`}
                      checked={formData[`check_${item}`]} 
                      onChange={handleChange}
                      className="checkbox checkbox-primary checkbox-sm" 
                    />
                    <span className="label-text capitalize">{item} Check</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-control md:col-span-2 mt-4">
              <label className="label">
                <span className="label-text">Inspector Remarks / Damage Report</span>
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                className="textarea textarea-bordered w-full"
                rows="4"
                placeholder="List any damages, issues, or general remarks..."
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
              {loading ? "Saving..." : "Save Inspection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
