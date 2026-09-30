import fs from 'fs';
import path from 'path';

// --- 1. TripReturnList.jsx ---
const returnsPath = 'client/src/pages/modules/transport/trips/TripReturnList.jsx';
const returnsContent = `import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckCircleOutlined, CloseOutlined } from "@ant-design/icons";
import api from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function TripReturnList() {
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
      const activeTrips = (res.data?.data?.items || []).filter(t => ['SCHEDULED', 'IN_TRANSIT'].includes(t.status));
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
      await api.put(\`/transport/trips/\${selectedTrip.id}/return\`, form);
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
          <Link to="/transport" className="btn btn-secondary">Return to Menu</Link>
        </div>
      </div>
      
      <div className="card">
        <div className="card-body p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
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
                    <td className="px-6 py-4">{trip.origin} &rarr; {trip.destination}</td>
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
`;
fs.writeFileSync(returnsPath, returnsContent);
console.log("Created TripReturnList.jsx");

// --- 2. TripHistoryReport.jsx ---
const reportsDir = 'client/src/pages/modules/transport/reports';
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
const historyPath = path.join(reportsDir, 'TripHistoryReport.jsx');

const historyContent = `import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../../../api/client.js";

export default function TripHistoryReport() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    api.get("/transport/trips")
      .then(res => setTrips(res.data?.data?.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredTrips = trips.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (t.trip_number?.toLowerCase().includes(q) || 
              t.driver_name?.toLowerCase().includes(q) || 
              t.vehicle_name?.toLowerCase().includes(q) || 
              t.reg_number?.toLowerCase().includes(q) || 
              t.destination?.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-slate-800 text-white rounded-t-lg flex justify-between items-center p-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-slate-100">Trip History & Tracking</h1>
            <p className="text-sm mt-1 text-slate-300">Detailed logs of all fleet trips</p>
          </div>
          <Link to="/transport/reports" className="btn btn-secondary btn-sm">Return to Reports</Link>
        </div>
        <div className="card-body p-4 bg-slate-50 border-b flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4">
            <input 
              type="text" 
              placeholder="Search driver, vehicle, or destination..." 
              className="input input-bordered w-72" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
            <select className="select select-bordered" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="text-sm font-semibold text-slate-600 bg-white px-4 py-2 rounded-lg border border-slate-200">
            Total Trips: {filteredTrips.length}
          </div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-body p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-600 bg-slate-100 border-b border-slate-200 uppercase">
              <tr>
                <th className="px-6 py-4">Trip No</th>
                <th className="px-6 py-4">Vehicle</th>
                <th className="px-6 py-4">Driver</th>
                <th className="px-6 py-4">Departure &rarr; Destination</th>
                <th className="px-6 py-4">Timing</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center py-6">Loading history...</td></tr>
              ) : filteredTrips.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-6 text-slate-500">No trips found matching criteria.</td></tr>
              ) : (
                filteredTrips.map(trip => (
                  <tr key={trip.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium">{trip.trip_number}</td>
                    <td className="px-6 py-4">{trip.vehicle_name || trip.reg_number || trip.vehicle_id}</td>
                    <td className="px-6 py-4">{trip.driver_name || trip.driver_id}</td>
                    <td className="px-6 py-4">{trip.origin || "Origin"} &rarr; {trip.destination || "Dest"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      <div><span className="font-semibold">Start:</span> {trip.start_time ? new Date(trip.start_time).toLocaleString() : '-'}</div>
                      <div><span className="font-semibold">End:</span> {trip.end_time ? new Date(trip.end_time).toLocaleString() : '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={\`px-2 py-1 text-xs font-semibold rounded-full \${trip.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : trip.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}\`}>
                        {trip.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(historyPath, historyContent);
console.log("Created TripHistoryReport.jsx");

// --- 3. TransportLayout.jsx ---
const layoutPath = 'client/src/pages/modules/transport/TransportLayout.jsx';
let layoutContent = fs.readFileSync(layoutPath, 'utf8');

if (!layoutContent.includes('import TripReturnList')) {
  layoutContent = layoutContent.replace(
    /import TripsList from "\.\/trips\/TripsList\.jsx";/,
    `import TripsList from "./trips/TripsList.jsx";\nimport TripReturnList from "./trips/TripReturnList.jsx";\nimport TripHistoryReport from "./reports/TripHistoryReport.jsx";`
  );
}

if (!layoutContent.includes('path="trip-returns"')) {
  layoutContent = layoutContent.replace(
    /<Route path="trips" element=\{<TripsList \/>\} \/>/,
    `<Route path="trips" element={<TripsList />} />\n        <Route path="trip-returns" element={<TripReturnList />} />\n        <Route path="reports/trip-history" element={<TripHistoryReport />} />`
  );
}

if (!layoutContent.includes('Trip Returns')) {
  layoutContent = layoutContent.replace(
    /<ActionButton\s+label="Trips & Dispatch"/,
    `<ActionButton\n                  label="Trip Returns"\n                  path="trip-returns"\n                  type="btn-outline"\n                  featureKey="TRANSPORT.TRIPS"\n                  action="VIEW"\n                />\n                <ActionButton\n                  label="Trips & Dispatch"`
  );
}
fs.writeFileSync(layoutPath, layoutContent);
console.log("Updated TransportLayout.jsx");

// --- 4. TransportReports.jsx ---
const reportMenuPath = 'client/src/pages/modules/transport/reports/TransportReports.jsx';
let reportMenuContent = fs.readFileSync(reportMenuPath, 'utf8');

if (!reportMenuContent.includes('Trip History & Tracking')) {
  reportMenuContent = reportMenuContent.replace(
    /\{ title: "Transport Revenue"/,
    `{ title: "Trip History & Tracking", icon: <BarChartOutlined className="text-indigo-500" />, desc: "Historical logs of all fleet trips", link: "/transport/reports/trip-history" },\n    { title: "Transport Revenue"`
  );
  
  reportMenuContent = reportMenuContent.replace(
    /className="card hover:shadow-lg transition-shadow cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"/g,
    `className="card hover:shadow-lg transition-shadow cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" onClick={() => report.link ? window.location.href = report.link : null}`
  );
  
  fs.writeFileSync(reportMenuPath, reportMenuContent);
  console.log("Updated TransportReports.jsx");
}

