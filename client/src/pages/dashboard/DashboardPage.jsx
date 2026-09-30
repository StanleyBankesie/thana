/**
 * @fileoverview DashboardPage component (internal module dashboard).
 * Displays a basic welcome message and instructions for the module dashboard shell.
 */

import React from "react";

import { useAuth } from "../../auth/AuthContext.jsx";

/**
 * DashboardPage component
 * 
 * @returns {JSX.Element} A simplified welcome UI for the dashboard.
 */
export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="hidden rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm p-5">
      <div className="font-extrabold text-lg mb-1">Dashboard</div>
      <div className="text-slate-500 dark:text-slate-400 mb-3">
        Welcome, {user?.email}. This is the ERP starter shell.
      </div>
      <div className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
        Start by enabling permissions in MySQL and then calling module endpoints
        from the UI.
      </div>
    </div>
  );
}
