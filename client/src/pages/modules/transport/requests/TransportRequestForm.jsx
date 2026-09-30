import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

export default function TransportRequestForm() {
  const { id } = useParams();
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [clients, setClients] = useState([]);
  const [formData, setFormData] = useState({
    requester_name: "",
    request_date: new Date().toISOString().split("T")[0],
    required_date: "",
    required_time: "",
    return_date: "",
    return_time: "",
    no_of_days: "",
    no_of_hours: "",
    origin: "",
    destination: "",
    purpose_of_journey: "",
    priority: "NORMAL",
    notes: "",
    vehicle_id: "",
  });

  const selectedVehicle = vehicles.find(
    (v) => v.id.toString() === formData.vehicle_id?.toString(),
  );

  React.useEffect(() => {
    if (formData.required_date && formData.return_date) {
      const required = new Date(
        `${formData.required_date}T${formData.required_time || "00:00"}`,
      );
      const ret = new Date(
        `${formData.return_date}T${formData.return_time || "00:00"}`,
      );

      const diffMs = ret - required;
      if (diffMs >= 0) {
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
        setFormData((prev) => ({
          ...prev,
          no_of_days: diffDays,
          no_of_hours: diffHours,
        }));
      } else {
        setFormData((prev) => ({ ...prev, no_of_days: 0, no_of_hours: 0 }));
      }
    }
  }, [
    formData.required_date,
    formData.return_date,
    formData.required_time,
    formData.return_time,
  ]);

  React.useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [vehiclesRes, clientsRes] = await Promise.all([
          api.get("/transport/vehicles"),
          api.get("/sales/customers?service_customer=Y"),
        ]);
        if (vehiclesRes.data?.data?.items) {
          setVehicles(vehiclesRes.data.data.items);
        }
        if (clientsRes.data?.items) {
          setClients(clientsRes.data.items);
        }
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      }
    };
    fetchInitialData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "requester_name") {
      const selectedClient = clients.find(c => c.customer_name === value);
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        customer_id: selectedClient ? selectedClient.id : ""
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.request_date || !formData.origin || !formData.destination) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      await api.post("/transport/requests", formData);
      toast.success("Transport request created successfully");
      navigate("/transport/requests");
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
            New Transport Request
          </h1>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="card-body p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Requester's Name</span>
              </label>
              <select
                name="requester_name"
                className="input input-bordered w-full"
                value={formData.requester_name}
                onChange={handleChange}
                required
              >
                <option value="">Select Requester</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.customer_name}>
                    {c.customer_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Request Date *</span>
              </label>
              <input
                type="date"
                name="request_date"
                className="input input-bordered w-full"
                value={formData.request_date}
                onChange={handleChange}
                required
              
                disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Required By Date</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  name="required_date"
                  className="input input-bordered w-2/3"
                  value={formData.required_date}
                  onChange={handleChange}
                
                  disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
                <input
                  type="time"
                  name="required_time"
                  className="input input-bordered w-1/3"
                  value={formData.required_time}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Return Date</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  name="return_date"
                  className="input input-bordered w-2/3"
                  value={formData.return_date}
                  onChange={handleChange}
                
                  disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
                <input
                  type="time"
                  name="return_time"
                  className="input input-bordered w-1/3"
                  value={formData.return_time}
                  onChange={handleChange}
                />
              </div>
            </div>

            {formData.required_date && formData.return_date && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Duration</span>
                </label>
                <div className="flex gap-2">
                  <div className="w-1/2 flex items-center gap-2">
                    <span className="text-sm font-semibold">Days:</span>
                    <input
                      type="text"
                      readOnly
                      className="input input-bordered input-sm w-full bg-slate-50"
                      value={formData.no_of_days}
                    />
                  </div>
                  <div className="w-1/2 flex items-center gap-2">
                    <span className="text-sm font-semibold">Hours:</span>
                    <input
                      type="text"
                      readOnly
                      className="input input-bordered input-sm w-full bg-slate-50"
                      value={formData.no_of_hours}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Origin *</span>
                </label>
                <input
                  type="text"
                  name="origin"
                  className="input input-bordered w-full"
                  value={formData.origin}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Destination *</span>
                </label>
                <input
                  type="text"
                  name="destination"
                  className="input input-bordered w-full"
                  value={formData.destination}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Vehicle Number</span>
              </label>
              <select
                name="vehicle_id"
                className="input input-bordered w-full"
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
                <div className="mt-2 text-sm text-slate-500 bg-slate-50 p-2 rounded">
                  <strong>Make:</strong> {selectedVehicle.make || "N/A"}{" "}
                  &nbsp;|&nbsp;
                  <strong>Model:</strong> {selectedVehicle.model || "N/A"}
                </div>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Priority</span>
              </label>
              <select
                name="priority"
                className="input input-bordered w-full"
                value={formData.priority}
                onChange={handleChange}
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Purpose of Journey
                  </span>
                </label>
                <textarea
                  name="purpose_of_journey"
                  className="textarea textarea-bordered border border-slate-300 rounded-md w-full p-3"
                  rows={3}
                  value={formData.purpose_of_journey}
                  onChange={handleChange}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Notes</span>
                </label>
                <textarea
                  name="notes"
                  className="textarea textarea-bordered border border-slate-300 rounded-md w-full p-3"
                  rows={3}
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Any special handling instructions..."
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t pt-4">
            <button onClick={() => window.history.back()} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
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
