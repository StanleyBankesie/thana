/**
 * @fileoverview ExceptionalPermissionsList component.
 * Provides functionality for ExceptionalPermissionsList.
 */

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ExceptionalPermissionsList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();

  const load = () => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .get("/admin/exceptional-permissions")
      .then((res) => {
        const rows = res?.data?.data?.items || res?.data?.items || [];
        if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, []);

  useEffect(() => {
    const s = location.state && location.state.afterSave;
    if (!s || s.entity !== "exceptional-permissions") return;
    load();
    setTimeout(() => load(), 500);
    try {
      window.history.replaceState({}, "");
    } catch {}
  }, [location.state]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exceptional Permissions</h1>
          <p className="text-sm text-slate-600">
            System-wide list of exceptional permissions
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.history.back()} className="btn btn-secondary">
            Back to Menu
          </button>
          <Link
            to="/administration/access/user-overrides"
            className="btn-success"
          >
            Manage by User
          </Link>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div>Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-slate-600">
              No exceptional permissions found.
            </div>
          ) : (
            
                <>
<div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
              <table className={ "table w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Permission</th>
                    <th>Effect</th>
                    <th>Active</th>
                    <th>Exception Type</th>
                    <th>Effective From</th>
                    <th>Effective To</th>
                                    <th>Created By</th>
                  <th>Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">
                        {r.username || r.user_name || r.user_email || r.user_id}
                      </td>
                      <td>{r.permission_code}</td>
                      <td>
                        <span
                          className={
                            String(r.effect || "").toUpperCase() === "ALLOW"
                              ? "badge badge-success"
                              : "badge badge-error"
                          }
                        >
                          {String(r.effect || "").toUpperCase()}
                        </span>
                      </td>
                      <td>{Number(r.is_active) === 1 ? "Yes" : "No"}</td>
                      <td>{r.exception_type || "STANDARD"}</td>
                      <td>{r.effective_from || "-"}</td>
                      <td>{r.effective_to || "-"}</td>
                      <td>{r.created_by_name || "-"}</td>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
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
