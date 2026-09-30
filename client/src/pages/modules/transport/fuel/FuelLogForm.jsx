import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

export default function FuelLogForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const isView = mode === "view";
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [fuelStations, setFuelStations] = useState([]);
  const [formData, setFormData] = useState({
    vehicle_id: "",
    log_date: "",
    odometer_reading: "",
    fuel_quantity: "",
    cost_per_unit: "",
    total_cost: "",
    fuel_station: "",
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;
    api.get("/transport/vehicles").then(res => {
      if (!cancelled) setVehicles(res.data?.data?.items || []);
    }).catch(() => toast.error("Failed to load vehicles"));
    
    api.get("/transport/setup?type=FUEL_STATION").then(res => {
      if (!cancelled) setFuelStations(res.data?.data?.items || []);
    }).catch(() => console.error("Failed to load fuel stations"));

    if (id && id !== "new") {
      setLoading(true);
      api.get(`/transport/fuel/${id}`).then(res => {
        if (!cancelled && res.data?.data?.item) {
          const item = res.data.data.item;
          setFormData({
            vehicle_id: item.vehicle_id || "",
            log_date: item.log_date ? item.log_date.split("T")[0] : "",
            odometer_reading: item.odometer_reading || "",
            fuel_quantity: item.fuel_quantity || "",
            cost_per_unit: item.cost_per_unit || "",
            total_cost: item.total_cost || "",
            fuel_station: item.remarks || "", // using remarks as fuel station for now
            notes: item.remarks || "",
          });
        }
      }).catch(() => toast.error("Failed to load fuel log"))
      .finally(() => { if (!cancelled) setLoading(false); });
    }

    return () => { cancelled = true; };
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "fuel_quantity" || name === "cost_per_unit") {
        const qty = parseFloat(name === "fuel_quantity" ? value : prev.fuel_quantity) || 0;
        const cost = parseFloat(name === "cost_per_unit" ? value : prev.cost_per_unit) || 0;
        updated.total_cost = (qty * cost).toFixed(2);
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vehicle_id || !formData.log_date || !formData.fuel_quantity) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      if (id && id !== "new") {
        await api.put(`/transport/fuel/${id}`, formData);
        toast.success("Fuel log updated successfully");
      } else {
        await api.post("/transport/fuel", formData);
        toast.success("Fuel log added successfully");
      }
      navigate("/transport/fuel");
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
            Add Fuel Log
          </h1>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="card-body p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Vehicle *</span>
              </label>
              <select
                name="vehicle_id"
                className="input input-bordered w-full"
                value={formData.vehicle_id}
                onChange={handleChange}
                required
                disabled={isView}
              >
                <option value="" disabled>Select a vehicle</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.reg_number}</option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Log Date *</span>
              </label>
              <input
                type="date"
                name="log_date"
                className="input input-bordered w-full"
                value={formData.log_date}
                onChange={handleChange}
                required
                disabled={isView || (!!id && !hasExceptional("DOCUMENT.EDIT_DATE"))}
              />
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
                disabled={isView}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Fuel Quantity (Liters) *</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="fuel_quantity"
                className="input input-bordered w-full"
                value={formData.fuel_quantity}
                onChange={handleChange}
                required
                disabled={isView}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Cost per Liter *</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="cost_per_unit"
                className="input input-bordered w-full"
                value={formData.cost_per_unit}
                onChange={handleChange}
                required
                disabled={isView}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Total Cost (auto-calculated)</span>
              </label>
              <input
                type="number"
                name="total_cost"
                className="input input-bordered w-full bg-slate-50"
                value={formData.total_cost}
                readOnly
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Fuel Station</span>
              </label>
              <select
                name="fuel_station"
                className="input input-bordered w-full"
                value={formData.fuel_station}
                onChange={handleChange}
                disabled={isView}
              >
                <option value="">Select a fuel station</option>
                {fuelStations.map(s => (
                  <option key={s.id} value={s.setup_value}>{s.setup_value}</option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Notes</span>
              </label>
              <textarea
                name="notes"
                className="textarea textarea-bordered w-full"
                rows={2}
                value={formData.notes}
                onChange={handleChange}
                disabled={isView}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t pt-4">
            <button onClick={() => window.history.back()} className="btn btn-secondary">
              {isView ? "Back" : "Cancel"}
            </button>
            {!isView && (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Fuel Log"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
