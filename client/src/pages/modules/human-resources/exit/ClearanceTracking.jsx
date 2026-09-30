/**
 * @fileoverview ClearanceTracking component.
 * Provides functionality for ClearanceTracking.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Guard } from "../../../../hooks/usePermissions.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ClearanceTracking() {
  const [exits, setExits] = useState([]);
  const [selectedExit, setSelectedExit] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExits();
  }, []);

  const loadExits = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/exits");
      setExits(res.data.items || []);
    } catch {
      toast.error("Failed to load exit requests");
    } finally {
      setLoading(false);
    }
  };

  const loadClearance = async (exit) => {
    setSelectedExit(exit);
    try {
      const res = await api.get(`/hr/clearance?exit_id=${exit.id}`);
      setItems(res.data.items || []);
    } catch {
      toast.error("Failed to load clearance details");
    }
  };

  const handleUpdate = async (id, cleared, remarks) => {
    try {
      await api.post("/hr/clearance/update", { id, cleared, remarks });
      toast.success("Status updated");
      if (selectedExit) loadClearance(selectedExit);
    } catch {
      toast.error("Failed to update clearance");
    }
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Clearance Tracking</h1>
            <p className="text-sm text-slate-500">Manage department clearance for exiting employees</p>
          </div>
          <button onClick={() => window.history.back()} className="btn-secondary">Back</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Exit Requests List */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <h2 className="font-semibold">Exit Requests</h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
              {exits.map((e) => (
                <button
                  key={e.id}
                  onClick={() => loadClearance(e)}
                  className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                    selectedExit?.id === e.id ? 'bg-brand/5 border-l-4 border-brand' : ''
                  }`}
                >
                  <div className="font-medium text-sm">{e.first_name} {e.last_name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Last Day: {new Date(e.last_working_day).toLocaleDateString()}
                  </div>
                  <div className="text-xs mt-1 uppercase font-bold text-slate-400">{e.exit_type}</div>
                </button>
              ))}
              {exits.length === 0 && !loading && (
                <div className="p-8 text-center text-slate-500 text-sm">No exit requests found.</div>
              )}
            </div>
          </div>

          {/* Clearance Details */}
          <div className="lg:col-span-2 space-y-4">
            {selectedExit ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                  <div>
                    <h2 className="font-semibold">Clearance for {selectedExit.first_name} {selectedExit.last_name}</h2>
                    <p className="text-xs text-slate-500">Reason: {selectedExit.reason || 'Not specified'}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-bold ${
                    selectedExit.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedExit.status}
                  </div>
                </div>

                <div className="p-4">
                  <table className="min-w-full">
                    <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Department</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cleared At</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {items.map((it) => (
                        <tr key={it.id} className="text-sm">
                          <td className="py-4 font-medium">{it.department}</td>
                          <td className="py-4">
                            {it.cleared ? (
                              <span className="text-emerald-600 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                Cleared
                              </span>
                            ) : (
                              <span className="text-amber-600 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-4 text-slate-500">
                            {it.cleared_at ? new Date(it.cleared_at).toLocaleString() : '-'}
                          </td>
                          <td className="py-4 text-right">
                            {!it.cleared && (
                              <button
                                onClick={() => handleUpdate(it.id, true)}
                                className="text-xs btn-primary py-1 px-2"
                              >
                                Mark Cleared
                              </button>
                            )}
                            {it.cleared && (
                              <button
                                onClick={() => handleUpdate(it.id, false)}
                                className="text-xs text-slate-400 hover:text-red-500"
                              >
                                Reset
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 h-[400px] flex flex-col items-center justify-center text-slate-500">
                <span className="text-4xl mb-4">🚪</span>
                <p>Select an exit request from the left to view and manage department clearance.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Guard>
  );
}
