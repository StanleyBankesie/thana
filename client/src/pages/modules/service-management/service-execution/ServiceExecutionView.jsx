/**
 * @fileoverview ServiceExecutionView component.
 * Provides functionality for ServiceExecutionView.
 */

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ServiceExecutionView() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/purchase/service-executions/${id}`);
      const data = res.data?.item || res.data || null;
      setItem(data);
    } catch (e) {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Service Execution</h2>
        <div className="flex gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary"
          >
            Back to List
          </button>
          <button onClick={() => window.history.back()} className="btn-secondary">
            Back to Menu
          </button>
        </div>
      </div>
      {error ? <div className="text-red-600">{error}</div> : null}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div>Loading...</div>
          ) : !item ? (
            <div className="text-slate-500">No data</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500">Execution No</div>
                  <div className="font-semibold">{item.execution_no || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Order No</div>
                  <div className="font-semibold">{item.order_no || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Type</div>
                  <div className="font-semibold">{item.order_type || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Supervisor</div>
                  <div className="font-semibold">
                    {item.assigned_supervisor_username ||
                      item.assigned_supervisor_user_id ||
                      "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Date</div>
                  <div className="font-semibold">{item.execution_date || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Status</div>
                  <div className="font-semibold">{item.status || "-"}</div>
                </div>
              </div>
              {Array.isArray(item.materials) && item.materials.length ? (
                <div>
                  <div className="text-sm font-semibold mb-2">Materials</div>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Name</th>
                          <th>Unit</th>
                          <th>Qty</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.materials.map((m, idx) => (
                          <tr key={idx}>
                            <td>{m.code || ""}</td>
                            <td>{m.name || ""}</td>
                            <td>{m.unit || ""}</td>
                            <td>{m.qty || ""}</td>
                            <td>{m.note || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              {item.requisition_notes ? (
                <div>
                  <div className="text-sm font-semibold mb-1">Notes</div>
                  <div className="text-sm">{item.requisition_notes}</div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
