import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import AddressMapPicker from "../../../../components/common/AddressMapPicker.jsx";

export default function RouteForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [formData, setFormData] = useState({
    route_code: "",
    route_name: "",
    origin: "",
    destination: "",
    distance: "",
    estimated_time: "",
    is_active: 1,
    notes: "",
  });

  useEffect(() => {
    if (id) {
      setLoading(true);
      api.get(`/transport/routes/${id}`)
        .then(res => {
          const item = res.data?.data?.item || res.data?.item;
          if (item) {
            setFormData({
              route_code: item.route_code || "",
              route_name: item.route_name || "",
              origin: item.origin || "",
              destination: item.destination || "",
              distance: item.distance || "",
              estimated_time: item.estimated_time || "",
              is_active: item.is_active ?? 1,
              notes: item.notes || "",
            });
          }
        })
        .catch(err => toast.error("Failed to fetch route"))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const calculateDistance = () => {
    if (!formData.origin || !formData.destination) {
      toast.error("Please set both Origin and Destination first.");
      return;
    }
    if (!window.google) {
      toast.error("Google Maps API is not loaded.");
      return;
    }
    
    setCalculating(true);
    const service = new window.google.maps.DistanceMatrixService();
    service.getDistanceMatrix({
      origins: [formData.origin],
      destinations: [formData.destination],
      travelMode: 'DRIVING',
    }, (response, status) => {
      setCalculating(false);
      if (status !== 'OK') {
        toast.error('Error calculating distance.');
        return;
      }
      const result = response.rows[0]?.elements[0];
      if (result && result.status === 'OK') {
        const distKm = (result.distance.value / 1000).toFixed(2);
        const timeHrs = (result.duration.value / 3600).toFixed(2);
        setFormData(prev => ({ ...prev, distance: distKm, estimated_time: timeHrs }));
        toast.success("Distance and time updated from Google Maps!");
      } else {
        toast.error("Could not find a route between these locations.");
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.route_name || !formData.origin || !formData.destination) {
      toast.error("Please fill all required fields");
      return;
    }
    if (!formData.distance || !formData.estimated_time) {
      toast.error("Please calculate Distance and Estimated Time using the Maps button before saving.");
      return;
    }
    setLoading(true);
    try {
      if (id) {
        await api.put(`/transport/routes/${id}`, formData);
        toast.success("Route updated successfully");
      } else {
        await api.post("/transport/routes", formData);
        toast.success("Route added successfully");
      }
      navigate("/transport/routes");
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
            {id ? "Edit Route" : "New Route"}
          </h1>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="card-body p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Route Code</span>
              </label>
              <input
                type="text"
                name="route_code"
                value={formData.route_code}
                onChange={handleChange}
                className="input input-bordered w-full bg-slate-50"
                placeholder="Auto-generated (e.g. RT-000001)"
                readOnly
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Route Name <span className="text-red-500">*</span></span>
              </label>
              <input
                type="text"
                name="route_name"
                value={formData.route_name}
                onChange={handleChange}
                className="input input-bordered w-full"
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Pickup / Origin <span className="text-red-500">*</span></span>
              </label>
              <AddressMapPicker 
                value={formData.origin}
                onChange={(val) => setFormData(p => ({ ...p, origin: val.name }))}
                placeholder="Enter origin"
                layout="vertical"
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Destination <span className="text-red-500">*</span></span>
              </label>
              <AddressMapPicker 
                value={formData.destination}
                onChange={(val) => setFormData(p => ({ ...p, destination: val.name }))}
                placeholder="Enter destination"
                layout="vertical"
              />
            </div>

            <div className="form-control col-span-1 md:col-span-2">
              <button 
                type="button" 
                onClick={calculateDistance} 
                disabled={calculating || !formData.origin || !formData.destination}
                className="btn btn-secondary w-full md:w-auto"
              >
                {calculating ? "Calculating..." : "Calculate Distance & Time from Maps"}
              </button>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Distance (km)</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="distance"
                value={formData.distance}
                onChange={handleChange}
                className="input input-bordered w-full"
                placeholder="e.g. 250"
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Estimated Time (Hours)</span>
              </label>
              <input
                type="number"
                step="0.1"
                name="estimated_time"
                value={formData.estimated_time}
                onChange={handleChange}
                className="input input-bordered w-full"
                placeholder="e.g. 4.5"
              />
            </div>
            
            <div className="form-control md:col-span-2">
              <label className="label">
                <span className="label-text">Notes</span>
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="textarea textarea-bordered w-full"
                rows="3"
                placeholder="Route conditions, alternate paths, etc."
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
              {loading ? "Saving..." : "Save Route"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
