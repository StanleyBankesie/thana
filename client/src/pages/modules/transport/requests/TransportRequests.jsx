import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import api from "../../../../api/client.js";
import { toast } from "react-toastify";

export default function TransportRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/transport/requests");
      if (res.data?.success) {
        setRequests(res.data.data.items || []);
      }
    } catch (err) {
      toast.error("Error: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm("Approve this transport request?")) return;
    try {
      await api.put(`/transport/requests/${id}/status`, { status: "APPROVED" });
      toast.success("Request approved");
      fetchRequests();
    } catch (err) {
      toast.error("Error: " + (err?.response?.data?.message || err.message));
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAdd = () => {
    navigate("/transport/requests/new");
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Transport Requests
            </h1>
            <p className="text-sm mt-1">
              Manage and track all transport requests
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-brand-600 bg-brand-50 border-b border-brand-200">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase">Req #</th>
                  <th className="px-6 py-4 font-semibold uppercase">
                    Requester's Name
                  </th>
                  <th className="px-6 py-4 font-semibold uppercase">Date</th>
                  <th className="px-6 py-4 font-semibold uppercase">Origin</th>
                  <th className="px-6 py-4 font-semibold uppercase">
                    Destination
                  </th>
                  <th className="px-6 py-4 font-semibold uppercase">Status</th>
                  <th className="px-6 py-4 font-semibold uppercase text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      Loading requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      No transport requests found
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium">
                        {r.request_number}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {r.requester_name || r.customer_name || "-"}
                      </td>
                      <td className="px-6 py-4">
                        {r.request_date ? r.request_date.split("T")[0] : ""}
                      </td>
                      <td className="px-6 py-4">{r.origin}</td>
                      <td className="px-6 py-4">{r.destination}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            r.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : r.status === "APPROVED"
                                ? "bg-indigo-100 text-indigo-800"
                                : r.status === "SCHEDULED"
                                  ? "bg-blue-100 text-blue-800"
                                  : r.status === "COMPLETED"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {r.status || "PENDING"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 items-center">
                          {r.status !== "APPROVED" &&
                            r.status !== "COMPLETED" && (
                              <button
                                title="Approve Request"
                                onClick={() => handleApprove(r.id)}
                                className="btn btn-success btn-sm text-white"
                              >
                                Confirm
                              </button>
                            )}
                          <Link
                            to={`/transport/requests/${r.id}`}
                            className="btn btn-ghost btn-sm text-brand-600"
                            title="View Document"
                          >
                            <EyeOutlined />
                          </Link>
                          <Link
                            to={`/transport/requests/${r.id}`}
                            className="btn btn-ghost btn-sm text-blue-600"
                            title="Edit Document"
                          >
                            <EditOutlined />
                          </Link>
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
