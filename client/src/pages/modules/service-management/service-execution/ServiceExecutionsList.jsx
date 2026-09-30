/**
 * @fileoverview ServiceExecutionsList component.
 * Provides functionality for ServiceExecutionsList.
 */

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../../../../api/client.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ServiceExecutionsList() {
  const [viewMode, setViewMode] = useViewMode();
  const { canPerformAction } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const success = location.state?.success || "";

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/purchase/service-executions");
      const arr =
        (res.data && res.data.data && res.data.data.items) ||
        res.data?.items ||
        [];
      setItems(arr);
    } catch (e) {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Service Executions</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary">
            Back to Menu
          </button>
          <Link to="/service-management/service-execution" className="btn-success">
            New Execution
          </Link>
        </div>
      </div>
      {success ? (
        <div className="p-2 rounded bg-green-50 text-green-700 border border-green-200">
          {success}
        </div>
      ) : null}
      {error ? <div className="text-red-600">{error}</div> : null}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div>Loading...</div>
          ) : (
            
                <>
<div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
              <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
                <thead>
                  <tr>
                    <th className="whitespace-nowrap">Execution No</th>
                    <th className="whitespace-nowrap">Order No</th>
                    <th className="whitespace-nowrap">Customer</th>
                    <th className="whitespace-nowrap">Supervisor</th>
                    <th className="whitespace-nowrap">Date</th>
                    <th className="whitespace-nowrap">Work Status</th>
                    <th className="whitespace-nowrap">Status</th>
                    <th className="whitespace-nowrap">Actions</th>
                    <th className="whitespace-nowrap">Created By</th>
                    <th className="whitespace-nowrap">Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="whitespace-nowrap">{it.execution_no || ""}</td>
                      <td className="whitespace-nowrap">{it.order_no || ""}</td>
                      <td className="whitespace-nowrap">{it.customer_name || ""}</td>
                      <td className="whitespace-nowrap">
                        {it.assigned_supervisor_username ||
                          it.assigned_supervisor_user_id ||
                          ""}
                      </td>
                      <td className="whitespace-nowrap">{it.execution_date || ""}</td>
                      <td className="whitespace-nowrap">{it.work_status || ""}</td>
                      <td className="whitespace-nowrap">{it.status || ""}</td>
                      <td className="px-2 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/service-management/service-execution?id=${it.id}&mode=view`}
                            className={`btn-secondary btn-sm ${!canPerformAction("service-management:service-executions", "view") ? 'invisible pointer-events-none' : ''}`}
                          >
                            View
                          </Link>
                          {it.status !== "POSTED" && it.status !== "APPROVED" && (
                            <Link
                              to={`/service-management/service-execution?id=${it.id}&mode=edit`}
                              className={`btn-primary btn-sm ${!canPerformAction("service-management:service-executions", "edit") ? 'invisible pointer-events-none' : ''}`}
                            >
                              Edit
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap">{it.created_by_name || "-"}</td>
                      <td className="whitespace-nowrap">{it.created_at ? new Date(it.created_at).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr>
                      <td colSpan={10} className="text-center text-slate-500 whitespace-nowrap">
                        No service executions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          
</>
)}
        </div>
      </div>
    </div>
  );
}
