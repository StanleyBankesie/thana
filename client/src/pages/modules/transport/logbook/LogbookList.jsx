import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";

import DataTable from "../../../../components/common/DataTable.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function LogbookList({ isTab = false }) {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const [logbooks, setLogbooks] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogbooks = async () => {
    setLoading(true);
    try {
      const res = await api.get("/transport/logbooks");
      let data = res.data?.items || res.data || [];
      if (!Array.isArray(data) && data.items) {
        data = data.items;
      }
      setLogbooks(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to fetch logbooks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogbooks();
  }, []);

  const handleAdd = () => {
    navigate("/transport/logbooks/new");
  };

  const handleComplete = (id) => {
    navigate(`/transport/logbooks/${id}?complete=true`);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this trip record?")) return;
    try {
      await api.delete(`/transport/logbooks/${id}`);
      toast.success("Trip record deleted");
      fetchLogbooks();
    } catch (err) {
      toast.error("Failed to delete record");
    }
  };

  const columns = [
    { header: "Logbook No.", accessor: "logbook_no" },
    { 
      header: "Created Date", 
      accessor: "created_at",
      render: (l) => l.created_at ? new Date(l.created_at).toLocaleDateString() : "-"
    },
    { header: "Driver", accessor: "driver_name" },
    { 
      header: "Vehicle", 
      accessor: (l) => `${l.registration_number} ${l.make} ${l.model}`,
      render: (l) => (
        <>
          {l.registration_number} <br/>
          <span className="text-xs text-gray-500">{l.make} {l.model}</span>
        </>
      )
    },
    {
      header: "Route",
      accessor: (l) => `${l.origin} ${l.destination}`,
      render: (l) => (
        <div className="text-xs whitespace-normal min-w-[150px]">
          <strong>From:</strong> {l.origin || "-"} <br/>
          <strong>To:</strong> {l.destination || "-"}
        </div>
      )
    },
    {
      header: "Dates",
      accessor: "departure_time",
      render: (l) => (
        <div className="text-xs whitespace-normal min-w-[200px]">
          <strong>Dep:</strong> {l.departure_time ? new Date(l.departure_time).toLocaleString() : "-"} <br/>
          <strong>Exp Ret:</strong> {l.expected_return_time ? new Date(l.expected_return_time).toLocaleString() : "-"} <br/>
          <strong>Act Ret:</strong> {l.actual_return_time ? new Date(l.actual_return_time).toLocaleString() : "-"}
        </div>
      )
    },
    {
      header: "Distance (km)",
      accessor: "distance_travelled",
      render: (l) => <div className="text-right">{Number(l.distance_travelled || 0).toFixed(2)}</div>
    },
    {
      header: "Status",
      accessor: "trip_status",
      render: (l) => {
        let statusColor = "bg-slate-100 text-slate-700";
        let isOverdue = false;
        
        if (l.trip_status === "Planned") statusColor = "bg-blue-100 text-blue-700";
        if (l.trip_status === "Started") statusColor = "bg-yellow-100 text-yellow-700";
        if (l.trip_status === "Completed") statusColor = "bg-green-100 text-green-700";
        if (l.trip_status === "Cancelled") statusColor = "bg-gray-200 text-gray-700";
        if (l.trip_status === "In Progress") {
          statusColor = "bg-yellow-100 text-yellow-700";
          if (l.expected_return_time && new Date(l.expected_return_time) < new Date()) {
            statusColor = "bg-red-100 text-red-700 font-bold";
            isOverdue = true;
          }
        }
        return (
          <div className="text-center">
            <span className={`px-2 py-1 rounded text-xs font-semibold inline-flex flex-col ${statusColor}`}>
              {l.trip_status}
              {isOverdue && <span className="text-[10px] uppercase">Overdue</span>}
            </span>
          </div>
        );
      }
    },
    { header: "Created By", accessor: (l) => l.created_by_name || "-" },
    {
      header: "Actions",
      filterable: false,
      sortable: false,
      render: (l) => (
        <div className="flex justify-end gap-2">
          {l.trip_status !== 'Completed' && (
            <button
              className="text-green-600 hover:text-green-800"
              title="Complete Trip"
              onClick={() => handleComplete(l.id)}
            >
              <CheckCircleOutlined />
            </button>
          )}
          <button
            className="text-brand-600 hover:text-brand-800"
            title="Edit"
            onClick={() => navigate(`/transport/logbooks/${l.id}`)}
          >
            <EditOutlined />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {!isTab ? (
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Driver's Logbook
              </h1>
              <p className="text-sm mt-1">
                Track vehicle trips, mileages, fuel usage, and driver activities
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn btn-secondary">
                ← Back
              </button>
              <button className="btn-success" onClick={handleAdd}>
                <PlusOutlined /> Add Trip Record
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Trip Records</h2>
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>
            <PlusOutlined /> Add Trip Record
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : (
            <DataTable data={logbooks} columns={columns} defaultSortColumn="Created Date" />
          )}
        </div>
      </div>
    </div>
  );
}
