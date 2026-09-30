import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusOutlined, EditOutlined, DeleteOutlined, ToolOutlined } from "@ant-design/icons";
import api from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Spin } from "antd";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function MaintenanceList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/transport/maintenance");
      if (res.data?.success) {
        setRequests(res.data.data.items || []);
      }
    } catch (err) {
      toast.error("Failed to fetch maintenance requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAdd = () => {
    navigate("/transport/maintenance/new");
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Maintenance Requests
            </h1>
            <p className="text-sm mt-1">
              Manage transport vehicle maintenance and repairs
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/transport" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button className="btn-success" onClick={handleAdd}>
              <PlusOutlined /> New Request
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
                  <th className="px-6 py-4 font-bold">Date</th>
                  <th className="px-6 py-4 font-bold">Vehicle</th>
                  <th className="px-6 py-4 font-bold">Issue</th>
                  <th className="px-6 py-4 font-bold">Priority</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center">
                      <Spin size="large" />
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <ToolOutlined className="text-4xl mb-2" />
                        <p>No maintenance requests found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-brand-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium">{r.request_date ? r.request_date.split('T')[0] : ''}</td>
                      <td className="px-6 py-4">{r.vehicle_reg}</td>
                      <td className="px-6 py-4">{r.issue_summary}</td>
                      <td className="px-6 py-4">{r.priority}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          r.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          r.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {r.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={`/transport/maintenance/${r.id}`} className="btn btn-ghost btn-sm text-brand-600">
                            <EditOutlined />
                          </Link>
                          <button className="btn btn-ghost btn-sm text-red-600">
                            <DeleteOutlined />
                          </button>
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
