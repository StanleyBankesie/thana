import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, PrinterOutlined, ExportOutlined, RetweetOutlined } from "@ant-design/icons";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";

import DataTable from "../../../../components/common/DataTable.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

export default function VehicleComplianceList({ isTab = false }) {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const [compliances, setCompliances] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCompliances = async () => {
    setLoading(true);
    try {
      const res = await api.get("/transport/compliance");
      let data = res.data?.items || res.data || [];
      if (!Array.isArray(data) && data.items) {
        data = data.items;
      }
      setCompliances(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to fetch compliance records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompliances();
  }, []);

  const handleAdd = () => {
    navigate("/transport/compliance/new");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this compliance record?")) return;
    try {
      await api.delete(`/transport/compliance/${id}`);
      toast.success("Record deleted");
      fetchCompliances();
    } catch (err) {
      toast.error("Failed to delete record");
    }
  };

  const columns = [
    { header: "Compliance No.", accessor: "compliance_no" },
    { header: "Vehicle", accessor: "registration_number" },
    { header: "Type", accessor: "compliance_type" },
    { header: "Authority", accessor: (c) => c.issuing_authority || "-" },
    { header: "Insurance Co.", accessor: (c) => c.insurance_company || "-" },
    { 
      header: "Amount", 
      accessor: (c) => Number(c.amount_fee) > 0 ? Number(c.amount_fee).toFixed(2) : (Number(c.premium_amount) > 0 ? Number(c.premium_amount).toFixed(2) : "-"),
      render: (c) => <div className="text-right">{Number(c.amount_fee) > 0 ? Number(c.amount_fee).toFixed(2) : (Number(c.premium_amount) > 0 ? Number(c.premium_amount).toFixed(2) : "-")}</div>
    },
    { 
      header: "Expiry Date", 
      accessor: "expiry_date",
      render: (c) => c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : "-"
    },
    {
      header: "Status",
      accessor: "status",
      render: (c) => {
        let statusColor = "bg-green-100 text-green-700";
        if (c.status === "Expiring Soon") statusColor = "bg-yellow-100 text-yellow-700";
        if (c.status === "Expired") statusColor = "bg-red-100 text-red-700";
        return (
          <div className="text-center">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor}`}>
              {c.status}
            </span>
          </div>
        );
      }
    },
    {
      header: "Actions",
      filterable: false,
      sortable: false,
      render: (c) => (
        <div className="flex justify-end gap-2">
          {c.attachment_url && (
            <button
              className="text-blue-500 hover:text-blue-700"
              title="View Document"
              onClick={() => window.open(c.attachment_url, "_blank")}
            >
              <EyeOutlined />
            </button>
          )}
          <button
            className="text-brand-600 hover:text-brand-800"
            title="Edit"
            onClick={() => navigate(`/transport/compliance/${c.id}`)}
          >
            <EditOutlined />
          </button>
          <button
            className="text-red-500 hover:text-red-700"
            title="Delete"
            onClick={() => handleDelete(c.id)}
          >
            <DeleteOutlined />
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
                Vehicle Compliance
              </h1>
              <p className="text-sm mt-1">
                Manage vehicle insurance, roadworthy, and licenses
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn btn-secondary">
                ← Back
              </button>
              <button className="btn-success" onClick={handleAdd}>
                <PlusOutlined /> Add New
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Vehicle Compliance</h2>
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>
            <PlusOutlined /> Add New
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : (
            <DataTable data={compliances} columns={columns} defaultSortColumn="Expiry Date" />
          )}
        </div>
      </div>
    </div>
  );
}
