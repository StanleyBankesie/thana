import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function VehicleServicingList({ isTab = false }) {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const [servicing, setServicing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    vehicle: "",
    status: "",
    provider: "",
  });

  const fetchServicing = async () => {
    setLoading(true);
    try {
      const res = await api.get("/transport/servicing");
      let data = res.data?.items || res.data || [];
      if (!Array.isArray(data) && data.items) {
        data = data.items;
      }
      setServicing(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to fetch servicing records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicing();
  }, []);

  const handleAdd = () => {
    navigate("/transport/servicing/new");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await api.delete(`/transport/servicing/${id}`);
      toast.success("Record deleted");
      fetchServicing();
    } catch (err) {
      toast.error("Failed to delete record");
    }
  };

  const filtered = servicing.filter(s => {
    if (filters.vehicle && !String(s.registration_number || "").toLowerCase().includes(filters.vehicle.toLowerCase())) return false;
    if (filters.status && s.service_status !== filters.status) return false;
    if (filters.provider && !String(s.provider_garage || "").toLowerCase().includes(filters.provider.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {!isTab ? (
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Vehicle Servicing
              </h1>
              <p className="text-sm mt-1">
                Manage vehicle servicing, maintenance, and history
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn btn-secondary">
                ← Back
              </button>
              <button className="btn-success" onClick={handleAdd}>
                <PlusOutlined /> Add Record
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Servicing Records</h2>
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>
            <PlusOutlined /> Add Record
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap gap-4 mb-4">
            <input 
              type="text" 
              placeholder="Search Reg No..." 
              className="input w-48"
              value={filters.vehicle}
              onChange={e => setFilters(p => ({ ...p, vehicle: e.target.value }))}
            />
            <input 
              type="text" 
              placeholder="Search Garage/Provider..." 
              className="input w-48"
              value={filters.provider}
              onChange={e => setFilters(p => ({ ...p, provider: e.target.value }))}
            />
            <select 
              className="input w-48"
              value={filters.status}
              onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
            >
              <option value="">All Statuses</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Due">Due</option>
              <option value="Overdue">Overdue</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={ "w-full text-sm text-left " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
              <thead className="text-xs text-brand-600 bg-brand-50 border-b border-brand-200">
                <tr>
                  <th className="px-4 py-3 font-semibold uppercase">Service No.</th>
                  <th className="px-4 py-3 font-semibold uppercase">Vehicle</th>
                  <th className="px-4 py-3 font-semibold uppercase">Type</th>
                  <th className="px-4 py-3 font-semibold uppercase">Next Date</th>
                  <th className="px-4 py-3 font-semibold uppercase">Mileage</th>
                  <th className="px-4 py-3 font-semibold uppercase">Total Cost</th>
                  <th className="px-4 py-3 font-semibold uppercase text-center">Status</th>
                  <th className="px-4 py-3 font-semibold uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                      No records found
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    let statusColor = "bg-green-100 text-green-700";
                    if (s.service_status === "Upcoming") statusColor = "bg-blue-100 text-blue-700";
                    if (s.service_status === "Due") statusColor = "bg-yellow-100 text-yellow-700";
                    if (s.service_status === "Overdue") statusColor = "bg-red-100 text-red-700";

                    return (
                      <tr
                        key={s.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">{s.service_no}</td>
                        <td className="px-4 py-3">{s.registration_number} <br/><span className="text-xs text-gray-500">{s.make} {s.model}</span></td>
                        <td className="px-4 py-3">{s.service_type}</td>
                        <td className="px-4 py-3">
                          {s.next_service_date ? new Date(s.next_service_date).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-4 py-3">
                           {s.next_service_mileage ? `${s.next_service_mileage} km` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {Number(s.total_cost) > 0 ? Number(s.total_cost).toFixed(2) : "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
                            {s.service_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              className="text-brand-600 hover:text-brand-800"
                              title="Edit"
                              onClick={() => navigate(`/transport/servicing/${s.id}`)}
                            >
                              <EditOutlined />
                            </button>
                            <button
                              className="text-red-500 hover:text-red-700"
                              title="Delete"
                              onClick={() => handleDelete(s.id)}
                            >
                              <DeleteOutlined />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
