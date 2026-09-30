/**
 * @fileoverview LeaveRequestManager component.
 * Provides functionality for LeaveRequestManager.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import LeaveApplication from "./LeaveApplication.jsx";
import LeaveScheduling from "./LeaveScheduling.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LeaveRequestManager() {
  const [tab, setTab] = useState("request");

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => window.history.back()} className="btn-secondary text-sm">
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Leave Request & Scheduling
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Self-serve forms and HR bulk scheduling
          </p>
        </div>
      </div>

      <div className="flex gap-6 border-b border-slate-200 dark:border-slate-700">
        <button
          className={`pb-3 px-1 text-sm font-semibold transition-colors border-b-2 ${
            tab === "request"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
          onClick={() => setTab("request")}
        >
          Individual Application
        </button>
        <button
          className={`pb-3 px-1 text-sm font-semibold transition-colors border-b-2 ${
            tab === "schedule"
              ? "border-brand text-brand"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
          onClick={() => setTab("schedule")}
        >
          HR Bulk Scheduling
        </button>
      </div>

      <div>
        {tab === "request" ? <LeaveApplication isEmbedded /> : <LeaveScheduling isEmbedded />}
      </div>
    </div>
  );
}
