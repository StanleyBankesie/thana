/**
 * @fileoverview PayrollDashboard component.
 * Provides functionality for PayrollDashboard.
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
export default function PayrollDashboard() {
  const [periodId, setPeriodId] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [closing, setClosing] = React.useState(false);

  const generate = async () => {
    if (!periodId) return toast.error("Select period");
    setGenerating(true);
    try {
      const res = await api.post("/hr/payroll/generate", {
        period_id: Number(periodId),
      });
      toast.success("Payroll generated");
    } catch {
      toast.error("Failed to generate payroll");
    } finally {
      setGenerating(false);
    }
  };

  const close = async () => {
    if (!periodId) return toast.error("Select period");
    setClosing(true);
    try {
      const hdr = await api.post("/hr/payroll/close", {
        payroll_id: Number(periodId),
      });
      toast.success("Payroll closed");
    } catch {
      toast.error("Failed to close payroll");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => window.history.back()} className="btn-secondary text-sm">
          Back to Menu
        </button>
        <h2 className="text-lg font-semibold">Payroll Dashboard</h2>
      </div>
      <div className="bg-white dark:bg-slate-800 p-4 rounded">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1">Payroll Period ID</label>
            <input
              className="input"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary"
            onClick={generate}
            disabled={generating}
          >
            {generating ? "Generating..." : "Generate Payroll"}
          </button>
          <button className="btn-success" onClick={close} disabled={closing}>
            {closing ? "Closing..." : "Close Payroll"}
          </button>
        </div>
      </div>
    </div>
  );
}
