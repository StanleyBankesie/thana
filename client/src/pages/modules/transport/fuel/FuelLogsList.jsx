import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusOutlined, EditOutlined, EyeOutlined, CheckCircleOutlined } from "@ant-design/icons";
import api from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function FuelLogsList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const logsRes = await api.get("/transport/fuel");
      setLogs(logsRes.data?.data?.items || []);
    } catch (err) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    navigate("/transport/fuel/new");
  };

  const handleConfirm = async (id) => {
    if (!window.confirm("Confirm this fuel log?")) return;
    try {
      await api.put(`/transport/fuel/${id}/status`, { status: 'CONFIRMED' });
      toast.success("Fuel log confirmed");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to confirm fuel log");
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Refuelling
            </h1>
            <p className="text-sm mt-1">
              Log all information of fuel purchased and refuelling events
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/transport" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button className="btn-success" onClick={handleAdd}>
              <PlusOutlined /> Add Expense/Fuel
            </button>
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
                  <th className="px-6 py-4 font-semibold uppercase">Date</th>
                  <th className="px-6 py-4 font-semibold uppercase">Vehicle</th>
                  <th className="px-6 py-4 font-semibold uppercase">Odometer</th>
                  <th className="px-6 py-4 font-semibold uppercase">Qty (L)</th>
                  <th className="px-6 py-4 font-semibold uppercase">Cost/Unit</th>
                  <th className="px-6 py-4 font-semibold uppercase">Total Cost</th>
                  <th className="px-6 py-4 font-semibold uppercase">Status</th>
                  <th className="px-6 py-4 font-semibold uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                      Loading fuel logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                      No fuel logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium">{l.log_date ? l.log_date.split('T')[0] : ''}</td>
                      <td className="px-6 py-4">{l.reg_number}</td>
                      <td className="px-6 py-4">{l.odometer_reading}</td>
                      <td className="px-6 py-4">{l.fuel_quantity}</td>
                      <td className="px-6 py-4">GH₵{l.cost_per_unit}</td>
                      <td className="px-6 py-4 font-semibold">GH₵{l.total_cost}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${l.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {l.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={`/transport/fuel/${l.id}?mode=view`} className="btn btn-ghost btn-sm text-brand-600" title="View Details">
                            <EyeOutlined />
                          </Link>
                          {(!l.status || l.status === 'PENDING') && (
                            <>
                              <Link to={`/transport/fuel/${l.id}`} className="btn btn-ghost btn-sm text-indigo-600" title="Edit Log">
                                <EditOutlined />
                              </Link>
                              <button onClick={() => handleConfirm(l.id)} className="btn btn-success btn-sm ml-2">
                                Confirm
                              </button>
                            </>
                          )}
                        </div>
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
