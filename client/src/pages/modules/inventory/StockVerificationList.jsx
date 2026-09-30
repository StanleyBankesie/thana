/**
 * @fileoverview StockVerificationList component.
 * Provides functionality for StockVerificationList.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, Plus } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../api/client";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { usePermission } from "../../../auth/PermissionContext.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function StockVerificationList() {
  const [viewMode, setViewMode] = useViewMode();
  const { canReverseApproval } = usePermission();
  const [searchTerm, setSearchTerm] = useState("");
  const [verifications, setVerifications] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [isWfActive, setIsWfActive] = useState(false);
  const [checkingWf, setCheckingWf] = useState(false);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const [verRes, whRes] = await Promise.all([
        api.get("/inventory/stock-verification"),
        api.get("/inventory/warehouses"),
      ]);
      setVerifications(
        Array.isArray(verRes.data?.items) ? verRes.data.items : [],
      );
      setWarehouses(Array.isArray(whRes.data?.items) ? whRes.data.items : []);
    } catch (e) {
      setError(
        e?.response?.data?.message || "Failed to load stock verifications",
      );
    } finally {
      setLoading(false);
    }
  };

  const checkWorkflowStatus = async () => {
    setCheckingWf(true);
    try {
      const res = await api.get("/workflows");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const active = items.some(
        (w) =>
          Number(w.is_active) === 1 &&
          (w.document_route === "/inventory/stock-verification" ||
            w.document_type === "STOCK_VERIFICATION" ||
            w.document_type === "Stock Verification"),
      );
      setIsWfActive(active);
    } catch (e) {
      console.error("Workflow check failed", e);
    } finally {
      setCheckingWf(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
    checkWorkflowStatus();
  }, []);

  const getWarehouseName = (id) => {
    const wh = warehouses.find((w) => Number(w.id) === Number(id));
    if (!wh) return "-";
    return wh.warehouse_name || wh.name || wh.warehouse_code || String(wh.id);
  };

  const statusOptions = [
    { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
    {
      value: "PENDING_APPROVAL",
      label: "Pending Approval",
      color: "bg-yellow-100 text-yellow-800",
    },
    {
      value: "APPROVED",
      label: "Approved",
      color: "bg-green-100 text-green-800",
    },
    {
      value: "REJECTED",
      label: "Rejected",
      color: "bg-red-100 text-red-800",
    },
  ];

  const getStatusBadge = (status) => {
    const statusConfig = statusOptions.find((s) => s.value === status);
    // Fallback for existing statuses
    if (!statusConfig) {
      if (status === "POSTED")
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Posted
          </span>
        );
      if (status === "CANCELLED")
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Cancelled
          </span>
        );
    }
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium ${
          statusConfig?.color || "bg-gray-100 text-gray-800"
        }`}
      >
        {statusConfig?.label || status}
      </span>
    );
  };

  const verificationTypes = [
    { value: "PHYSICAL_COUNT", label: "Physical Count" },
    { value: "CYCLE_COUNT", label: "Cycle Count" },
    { value: "SPOT_CHECK", label: "Spot Check" },
  ];

  const getTypeLabel = (type) => {
    return verificationTypes.find((t) => t.value === type)?.label || type;
  };

  const filteredVerifications = useMemo(() => {
    const base =
      filterStatus === "ALL"
        ? verifications.slice()
        : verifications.filter((v) => v.status === filterStatus);
    if (!searchTerm.trim()) return base;
    return filterAndSort(base, {
      query: searchTerm,
      getKeys: (v) => [v.verification_no],
    });
  }, [verifications, searchTerm, filterStatus]);

  const { sorted: sortedVerifications, sortKey, sortDir, toggle } = useSort(filteredVerifications, "created_at", "desc");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 dark:text-white mb-2">
              Stock Verification
            </h1>
            <p className="text-gray-600 dark:text-slate-400">
              Manage and track warehouse stock verification activities
            </p>
          </div>
          <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
            Return to Menu
          </Link>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by verification number..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <select
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Status</option>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>

              <Link
                to="/inventory/stock-verification/new"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#0E3646" }}
              >
                <Plus className="w-5 h-5" />
                New Verification
              </Link>
            </div>
          </div>
        </div>

        {/* Verifications Table */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={ "w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
               <thead className="bg-[#0E3646] text-white">
                <tr>
                  <SortableHeader label="Verification #" sortKey="verification_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="verification_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Warehouse" sortKey="warehouse_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Type" sortKey="verification_type" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th>Variance</th>
                  <th className="text-right">Actions</th>
                  <SortableHeader label="Created By" sortKey="created_by_username" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : filteredVerifications.length === 0 ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No verifications found
                    </td>
                  </tr>
                ) : (
                  sortedVerifications.map((verification) => (
                    <tr key={verification.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          {verification.verification_no}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="date"
                          value={(() => {
                            const s = verification.verification_date;
                            const d = new Date(s);
                            if (!isNaN(d)) return d.toISOString().split("T")[0];
                            const str = String(s || "");
                            return str.includes("T") ? str.split("T")[0] : str;
                          })()}
                          readOnly
                          className="text-sm text-gray-900 dark:text-slate-100 bg-transparent border-0 p-0"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-slate-100">
                          {verification.warehouse_name ||
                            getWarehouseName(verification.warehouse_id)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-slate-100">
                          {getTypeLabel(verification.verification_type)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(verification.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-600">
                          N/A
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <Link
                            to={`/inventory/stock-verification/${verification.id}?mode=view`}
                            className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          >
                            View
                          </Link>
                          {verification.status === "DRAFT" && (
                            <Link
                              to={`/inventory/stock-verification/${verification.id}?mode=edit`}
                              className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            >
                              Edit
                            </Link>
                          )}
                          
                          <div className="list-approval-slot">
                            {verification.status === "APPROVED" || verification.status === "POSTED" ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">
                                  Approved
                                </span>
                                {canReverseApproval() && (
                                  <button
                                    type="button"
                                    className="list-approval-reverse-btn"
                                    onClick={async () => {
                                      if (!window.confirm("Reverse approval?")) return;
                                      try {
                                        await api.post("/workflows/reverse-by-document", {
                                          document_type: "STOCK_VERIFICATION",
                                          document_id: verification.id,
                                          desired_status: "DRAFT",
                                        });
                                        toast.success("Approval reversed");
                                        fetchVerifications();
                                      } catch (e) {
                                        toast.error(e?.response?.data?.message || "Failed to reverse");
                                      }
                                    }}
                                  >
                                    Reverse Approval
                                  </button>
                                )}
                              </div>
                            ) : verification.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(verification.status || "").toUpperCase()) ? (
                              <span
                                className="list-approval-forwarded-pill"
                                title="Assigned approver"
                              >
                                Forwarded to {verification.forwarded_to_username}
                              </span>
                            ) : (verification.status === "DRAFT" || verification.status === "REJECTED") ? (
                              isWfActive ? (
                                <button
                                  type="button"
                                  className="list-approval-forward-btn"
                                  onClick={async () => {
                                    try {
                                      await api.post(`/inventory/stock-verification/${verification.id}/submit`, { amount: null });
                                      toast.success("Forwarded for approval");
                                      fetchVerifications();
                                    } catch (e) {
                                      toast.error("Forwarding failed");
                                    }
                                  }}
                                >
                                  Forward for Approval
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="list-approval-forward-btn"
                                  onClick={async () => {
                                    try {
                                      await api.post(`/inventory/stock-verification/${verification.id}/submit`);
                                      toast.success("Verification confirmed and approved");
                                      fetchVerifications();
                                    } catch (e) {
                                      toast.error(e?.response?.data?.message || "Confirmation failed");
                                    }
                                  }}
                                >
                                  Confirm
                                </button>
                              )
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-slate-100">
                          {verification.created_by_username || verification.created_by_name || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-slate-100">
                          {verification.created_at ? new Date(verification.created_at).toLocaleDateString() : "-"}
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
