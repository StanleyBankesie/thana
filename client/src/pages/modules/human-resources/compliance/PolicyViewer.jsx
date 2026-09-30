/**
 * @fileoverview PolicyViewer component.
 * Provides functionality for PolicyViewer.
 */

import React from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PolicyViewer() {
  const [items, setItems] = React.useState([]);
  const [employeeId, setEmployeeId] = React.useState("");
  const [policyId, setPolicyId] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await api.get("/hr/policies");
        if (mounted) setItems(res?.data?.items || []);
      } catch {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const acknowledge = async () => {
    if (!employeeId || !policyId)
      return toast.error("Select employee and policy");
    try {
      await api.post("/hr/policies/acknowledge", {
        employee_id: Number(employeeId),
        policy_id: Number(policyId),
      });
      toast.success("Acknowledged");
    } catch {
      toast.error("Failed to acknowledge");
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => window.history.back()} className="btn-secondary text-sm">
          Back to Menu
        </button>
        <h2 className="text-lg font-semibold">Policies</h2>
      </div>
      <div className="bg-white dark:bg-slate-800 p-4 rounded">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-1">Employee ID</label>
            <input
              className="input"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Policy</label>
            <select
              className="input"
              value={policyId}
              onChange={(e) => setPolicyId(e.target.value)}
            >
              <option value="">Select</option>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-primary" onClick={acknowledge}>
              Acknowledge
            </button>
          </div>
        </div>
        <ul className="space-y-2 text-sm">
          {items.map((p) => (
            <li key={p.id}>
              <strong>{p.title}</strong>
              <div className="text-slate-700 dark:text-slate-300">
                {p.content.slice(0, 200)}
                {p.content.length > 200 ? "..." : ""}
              </div>
            </li>
          ))}
          {!items.length ? <li>No active policies</li> : null}
        </ul>
      </div>
    </div>
  );
}
