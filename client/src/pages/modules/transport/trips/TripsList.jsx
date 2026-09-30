import React, { useState, useEffect } from "react";
import { Table, Button, Space, Modal, Form, Input, Select, Tag, message, DatePicker } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { PlusOutlined, EditOutlined, EnvironmentOutlined } from "@ant-design/icons";
import api from "../../../../api/client.js";
import { toast } from "react-toastify";
import LiveTrackingMap from "./LiveTrackingMap.jsx";
import DataTable from "../../../../components/common/DataTable.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

const { Option } = Select;

export default function TripsList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("ALL");

  const fetchData = async () => {
    setLoading(true);
    try {
      const tripsRes = await api.get("/transport/trips");
      setTrips(tripsRes.data?.data?.items || []);
    } catch (err) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleNewTrip = () => {
    navigate("/transport/trips/new");
  };

  const columns = [
    { header: "Trip #", accessor: "trip_number" },
    { header: "Vehicle", accessor: "reg_number" },
    { header: "Driver", accessor: (t) => t.employee_name || 'Unnamed Driver' },
    { 
      header: "Origin → Dest", 
      accessor: (t) => `${t.origin_name} ${t.destination_name}`,
      render: (t) => `${t.origin_name || "-"} → ${t.destination_name || "-"}`
    },
    { 
      header: "Start Time", 
      accessor: "start_time",
      render: (t) => t.start_time ? new Date(t.start_time).toLocaleString() : ''
    },
    {
      header: "Status",
      accessor: "status",
      render: (t) => (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
          t.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
          t.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
        }`}>
          {t.status || 'SCHEDULED'}
        </span>
      )
    },
    {
      header: "Actions",
      filterable: false,
      sortable: false,
      render: (t) => (
        <div className="flex justify-end gap-2">
          {t.status !== 'COMPLETED' && (
            <Link to={`/transport/trips/${t.id}`} className="btn btn-ghost btn-sm text-brand-600">
              <EditOutlined />
            </Link>
          )}
          <Link
            to={`/transport/tracking/${t.id}`}
            className="btn btn-ghost btn-sm text-green-600"
            title="Live Tracking"
          >
            <EnvironmentOutlined />
          </Link>
        </div>
      )
    }
  ];

  const filteredTrips = trips.filter(t => activeTab === 'ALL' || t.status === activeTab);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Trips & Dispatch
            </h1>
            <p className="text-sm mt-1">
              Manage and track all transport trips
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/transport" className="btn btn-secondary">
              Return to Menu
            </Link>
            <button className="btn-success" onClick={() => navigate("/transport/trips/new")}>
              <PlusOutlined /> Dispatch Trip
            </button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body p-0">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px px-6" aria-label="Tabs">
              {['ALL', 'PENDING', 'IN_TRANSIT', 'COMPLETED'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm
                    ${activeTab === tab
                      ? 'border-brand-500 text-brand-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {tab === 'ALL' ? 'All Trips' : tab === 'PENDING' ? 'Pending Dispatch' : tab === 'IN_TRANSIT' ? 'Active Trips' : 'Completed'}
                </button>
              ))}
            </nav>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading trips...</div>
          ) : (
            <DataTable data={filteredTrips} columns={columns} defaultSortColumn="Start Time" />
          )}
        </div>
      </div>
    </div>
  );
}
