import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { PlusOutlined, WarningOutlined } from "@ant-design/icons";
import api from "../../../../api/client.js";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function BreakdownsList() {
  const [viewMode, setViewMode] = useViewMode();
  const [breakdowns, setBreakdowns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBreakdowns();
  }, []);

  const fetchBreakdowns = async () => {
    try {
      const { data } = await api.get("/transport/breakdowns");
      if (data?.data?.items) {
        setBreakdowns(data.data.items);
      }
    } catch (err) {
      toast.error("Failed to load breakdown records");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
          <button onClick={() => window.history.back()} className="btn btn-ghost btn-sm px-2 text-slate-500">
            ← Back
          </button>
          <WarningOutlined className="text-primary" />
          Breakdown Logbook
        </h1>
        <div className="flex gap-2">
          <Link to="/transport/breakdowns/new" className="btn btn-primary">
            <PlusOutlined /> New Breakdown Record
          </Link>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-200">
        
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
          <table className={ "table table-zebra w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
            <thead>
              <tr className="bg-base-200">
                <th>Defect Date</th>
                <th>Time</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Fuel Level</th>
                <th>Reported By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-4">Loading breakdowns...</td>
                </tr>
              ) : breakdowns.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-4">No breakdown records found</td>
                </tr>
              ) : (
                breakdowns.map((b) => (
                  <tr key={b.id}>
                    <td>{formatDate(b.defect_date)}</td>
                    <td>{b.breakdown_time || "N/A"}</td>
                    <td>
                      <div className="font-medium">{b.reg_number || "N/A"}</div>
                      <div className="text-xs text-slate-500">{b.make} {b.model}</div>
                    </td>
                    <td>{b.driver_name || "N/A"}</td>
                    <td>{b.fuel_level || "N/A"}</td>
                    <td>{b.reported_by || "N/A"}</td>
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
