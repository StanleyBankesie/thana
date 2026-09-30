import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

export default function BreakdownForm() {
  const { id } = useParams();
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [formData, setFormData] = useState({
    defect_date: new Date().toISOString().split("T")[0],
    breakdown_time: "",
    driver_name: "",
    vehicle_id: "",
    fuel_level: "Half",
    details: "",
    odometer_reading: "",
    reported_by: "",
    remarks: "",
  });

  const selectedVehicle = vehicles.find(v => v.id.toString() === formData.vehicle_id?.toString());

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const { data } = await api.get("/transport/vehicles");
        if (data?.data?.items) {
          setVehicles(data.data.items);
        }
      } catch (err) {
        console.error("Failed to fetch vehicles", err);
      }
    };
    fetchVehicles();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.defect_date || !formData.breakdown_time) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      await api.post("/transport/breakdowns", formData);
      toast.success("Breakdown record created successfully");
      navigate("/transport/breakdowns");
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
            New Breakdown Record
          </h1>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-200">
        <form onSubmit={handleSubmit} className="card-body p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Defect Date *</span>
              </label>
              <input
                type="date"
                name="defect_date"
                className="input input-bordered border-2 border-slate-300 w-full"
                value={formData.defect_date}
                onChange={handleChange}
                required
              
                disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Breakdown Time *</span>
              </label>
              <input
                type="time"
                name="breakdown_time"
                className="input input-bordered border-2 border-slate-300 w-full"
                value={formData.breakdown_time}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Vehicle Registration No.</span>
              </label>
              <select
                name="vehicle_id"
                className="select select-bordered w-full"
                value={formData.vehicle_id}
                onChange={handleChange}
              >
                <option value="">Select a Vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.reg_number}
                  </option>
                ))}
              </select>
              {selectedVehicle && (
                <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="font-semibold">Make:</span> {selectedVehicle.make || "N/A"} <br/>
                  <span className="font-semibold">Model:</span> {selectedVehicle.model || "N/A"}
                </div>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Driver Name</span>
              </label>
              <input
                type="text"
                name="driver_name"
                className="input input-bordered w-full"
                value={formData.driver_name}
                onChange={handleChange}
                placeholder="Enter driver's name"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Fuel Level</span>
              </label>
              <select
                name="fuel_level"
                className="select select-bordered w-full"
                value={formData.fuel_level}
                onChange={handleChange}
              >
                <option value="Empty">Empty</option>
                <option value="Quarter (1/4)">Quarter (1/4)</option>
                <option value="Half">Half</option>
                <option value="Three-Quarters (3/4)">Three-Quarters (3/4)</option>
                <option value="Full">Full</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Odometer Reading</span>
              </label>
              <input
                type="number"
                name="odometer_reading"
                className="input input-bordered w-full"
                value={formData.odometer_reading}
                onChange={handleChange}
                placeholder="e.g. 150000"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Reported By</span>
              </label>
              <input
                type="text"
                name="reported_by"
                className="input input-bordered w-full"
                value={formData.reported_by}
                onChange={handleChange}
                placeholder="Name of person reporting"
              />
            </div>

            <div className="form-control md:col-span-2">
              <label className="label">
                <span className="label-text font-semibold">Details of Breakdown</span>
              </label>
              <textarea
                name="details"
                className="textarea textarea-bordered border-2 border-slate-300 w-full"
                rows={3}
                value={formData.details}
                onChange={handleChange}
                placeholder="Describe what went wrong..."
              />
            </div>

            <div className="form-control md:col-span-2">
              <label className="label">
                <span className="label-text font-semibold">Remarks</span>
              </label>
              <textarea
                name="remarks"
                className="textarea textarea-bordered border-2 border-slate-300 w-full"
                rows={2}
                value={formData.remarks}
                onChange={handleChange}
                placeholder="Additional notes..."
              />
            </div>

          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button onClick={() => window.history.back()} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving..." : "Save Breakdown Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
