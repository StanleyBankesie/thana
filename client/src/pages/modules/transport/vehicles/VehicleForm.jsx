import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

export default function VehicleForm() {
  const { id } = useParams();
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const storedTypes = localStorage.getItem("transport_vehicle_types");
  const vehicleTypesList = storedTypes ? storedTypes.split(",").map(s => s.trim()).filter(Boolean) : ["TRUCK", "VAN", "CAR", "MOTORCYCLE"];
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    reg_number: "",
    vehicle_type: vehicleTypesList[0] || "TRUCK",
    make: "",
    model: "",
    year_of_manufacture: "",
    capacity: "",
    capacity_unit: "Tonnes",
    insurance_expiry: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.reg_number || !formData.vehicle_type) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      await api.post("/transport/vehicles", formData);
      toast.success("Vehicle added successfully");
      navigate("/transport/vehicles");
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
            New Vehicle
          </h1>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="card-body p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Registration Number *</span>
              </label>
              <input
                type="text"
                name="reg_number"
                className="input input-bordered w-full"
                value={formData.reg_number}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Vehicle Type *</span>
              </label>
              <select
                name="vehicle_type"
                className="select select-bordered w-full"
                value={formData.vehicle_type}
                onChange={handleChange}
                required
              >
                {vehicleTypesList.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Make</span>
              </label>
              <input
                type="text"
                name="make"
                className="input input-bordered w-full"
                value={formData.make}
                onChange={handleChange}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Model</span>
              </label>
              <input
                type="text"
                name="model"
                className="input input-bordered w-full"
                value={formData.model}
                onChange={handleChange}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Year of Manufacture</span>
              </label>
              <input
                type="number"
                name="year_of_manufacture"
                className="input input-bordered w-full"
                value={formData.year_of_manufacture}
                onChange={handleChange}
                placeholder="e.g. 2020"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Capacity/Load</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="capacity"
                  className="input input-bordered w-2/3"
                  value={formData.capacity}
                  onChange={handleChange}
                />
                <select
                  name="capacity_unit"
                  className="select select-bordered w-1/3"
                  value={formData.capacity_unit}
                  onChange={handleChange}
                >
                  <option value="Tonnes">Tonnes</option>
                  <option value="Kg">Kg</option>
                  <option value="Liters">Liters</option>
                  <option value="Cubic Meters">Cubic Meters</option>
                  <option value="Passengers">Passengers</option>
                </select>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Insurance Expiry</span>
              </label>
              <input
                type="date"
                name="insurance_expiry"
                className="input input-bordered w-full"
                value={formData.insurance_expiry}
                onChange={handleChange}
              
                disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t pt-4">
            <button onClick={() => window.history.back()} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
