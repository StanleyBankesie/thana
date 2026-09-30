import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckCircleOutlined, CloseOutlined } from "@ant-design/icons";
import api from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function TripReturnList() {
  const [viewMode, setViewMode] = useViewMode();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    end_time: "",
    end_odometer: "",
    remarks: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/transport/trips");
      const activeTrips = (res.data?.data?.items || []).filter(t => !['COMPLETED', 'CANCELLED'].includes(t.status?.toUpperCase()));
      setTrips(activeTrips);
    } catch (err) {
      toast.error("Failed to fetch active trips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenReturn = (trip) => {
    setSelectedTrip(trip);
    setForm({
      end_time: new Date().toISOString().slice(0, 16),
      end_odometer: "",
      remarks: ""
    });
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/transport/trips/${selectedTrip.id}/return`, form);
      toast.success("Trip marked as returned and completed.");
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to return trip");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center p-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">Trip & Dispatch Returns</h1>
            <p className="text-sm mt-1">Confirm and complete active transport trips</p>
          </div>
          <button onClick={() => window.history.back()} className="btn btn-secondary">Back</button>
        </div>
      </div>
      
      <div className="card">
        <div className="card-body p-0 overflow-x-auto">
          <div className="flex justify-end mb-4">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
          <table className={"w-full text-sm text-left " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead className="text-xs text-brand-600 bg-brand-50 border-b border-brand-200 uppercase">
              <tr>
                <th className="px-6 py-4">Trip No</th>
                <th className="px-6 py-4">Vehicle</th>
                <th className="px-6 py-4">Driver</th>
                <th className="px-6 py-4">Origin &rarr; Destination</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center py-6">Loading active trips...</td></tr>
              ) : trips.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-6 text-slate-500">No active trips to return.</td></tr>
              ) : (
                trips.map(trip => (
                  <tr key={trip.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium">{trip.trip_number}</td>
                    <td className="px-6 py-4">{trip.vehicle_name || trip.reg_number || trip.vehicle_id}</td>
                    <td className="px-6 py-4">{trip.driver_name || trip.driver_id}</td>
                    <td className="px-6 py-4">{trip.origin_name} &rarr; {trip.destination_name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {trip.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="btn btn-sm btn-success flex items-center gap-2" onClick={() => handleOpenReturn(trip)}>
                        <CheckCircleOutlined /> Confirm Return
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Confirm Trip Return</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <CloseOutlined />
              </button>
            </div>
            <div className="p-6">
              <p className="mb-4 text-slate-600">You are completing Trip <strong>{selectedTrip?.trip_number}</strong>.</p>
              <form id="returnForm" onSubmit={handleSubmit} className="space-y-4">
                <div className="form-control">
                  <label className="label font-medium"><span className="label-text">Return Time *</span></label>
                  <input type="datetime-local" name="end_time" className="input input-bordered w-full rounded-md" value={form.end_time} onChange={handleFormChange} required />
                </div>
                
                <div className="form-control">
                  <label className="label font-medium"><span className="label-text">End Odometer</span></label>
                  <input type="number" step="0.01" name="end_odometer" className="input input-bordered w-full rounded-md" value={form.end_odometer} onChange={handleFormChange} placeholder="Current vehicle mileage" />
                </div>
                
                <div className="form-control">
                  <label className="label font-medium"><span className="label-text">Return Remarks / POD Notes</span></label>
                  <textarea name="remarks" className="textarea textarea-bordered w-full rounded-md" value={form.remarks} onChange={handleFormChange} rows="3" placeholder="Condition of vehicle, issues during trip, etc." />
                </div>
              </form>
            </div>
            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3 rounded-b-xl">
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" form="returnForm" className="btn btn-success" disabled={saving}>
                {saving ? "Processing..." : "Complete Trip"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
