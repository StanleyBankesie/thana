import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { EnvironmentOutlined } from "@ant-design/icons";
import api from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function TripTrackingList() {
  const [viewMode, setViewMode] = useViewMode();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const tripsRes = await api.get("/transport/trips");
      setTrips(tripsRes.data?.data?.items || []);
    } catch (err) {
      toast.error("Failed to fetch trips data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              GPS Tracking List
            </h1>
            <p className="text-sm mt-1">
              Select a trip to view its live GPS tracking map
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/transport" className="btn btn-secondary">
              Return to Menu
            </Link>
          </div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-body p-0">
          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={ "w-full text-sm text-left " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
              <thead className="text-xs text-brand-600 bg-brand-50 border-b border-brand-200">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase">Trip #</th>
                  <th className="px-6 py-4 font-semibold uppercase">Vehicle</th>
                  <th className="px-6 py-4 font-semibold uppercase">Driver</th>
                  <th className="px-6 py-4 font-semibold uppercase">Origin &rarr; Dest</th>
                  <th className="px-6 py-4 font-semibold uppercase">Status</th>
                  <th className="px-6 py-4 font-semibold uppercase text-right">Live Tracking</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                      Loading trips...
                    </td>
                  </tr>
                ) : trips.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                      No trips available for tracking.
                    </td>
                  </tr>
                ) : (
                  trips.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium">{t.trip_number}</td>
                      <td className="px-6 py-4">{t.reg_number}</td>
                      <td className="px-6 py-4">{t.employee_name || 'Unnamed Driver'}</td>
                      <td className="px-6 py-4">{t.origin_name || "-"} &rarr; {t.destination_name || "-"}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          t.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
                          t.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {t.status || 'SCHEDULED'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/transport/tracking/${t.id}`}
                          className="btn btn-sm bg-blue-600 hover:bg-blue-700 text-white border-none shadow-sm gap-2"
                        >
                          <EnvironmentOutlined /> Track Trip
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
