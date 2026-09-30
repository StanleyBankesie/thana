/**
 * @fileoverview LeaveManagementDashboard component.
 * Provides functionality for LeaveManagementDashboard.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

const LEAVE_CARDS = [
  {
    title: "Leave Request",
    description:
      "Employee and HR requests or bulk scheduling. Handles individual applications and operational team schedules.",
    icon: "📝",
    path: "/human-resources/leave/request",
    accent: "from-blue-500 to-indigo-600",
    badge: "Operations & Self-Service",
  },
  {
    title: "Leave Roster",
    description:
      "Generate annual department leaf plans. Rosters are automatically overridden by scheduling and applications.",
    icon: "📋",
    path: "/human-resources/leave/roster",
    accent: "from-emerald-500 to-teal-600",
    badge: "Planning",
  },
  // Removed Calendar, Balances, Records from Management per requirement
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LeaveManagementDashboard() {
  const [stats, setStats] = useState({
    onLeaveToday: 0,
    upcomingLeave: 0,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/hr/leave/dashboard");
        setStats(
          res.data || {
            onLeaveToday: 0,
            upcomingLeave: 0,
          },
        );
      } catch {
        toast.error("Failed to load leave dashboard statistics");
      }
    };
    load();
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Enterprise Leave Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Strict Priority Hierarchy: APPLICATION {">"} SCHEDULE {">"} ROSTER
          </p>
        </div>
        <button onClick={() => window.history.back()} className="btn-secondary shrink-0">
          ← Back
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-2">
            <div className="text-slate-500 text-sm font-medium">
              Employees on Leave Today
            </div>
            <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded text-xs">
              Active
            </span>
          </div>
          <div className="text-4xl font-black text-slate-800 dark:text-slate-100">
            {stats.onLeaveToday}
          </div>
        </div>
        <div className="p-5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-2">
            <div className="text-slate-500 text-sm font-medium">
              Upcoming Leave
            </div>
            <span className="text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded text-xs">
              14 Days
            </span>
          </div>
          <div className="text-4xl font-black text-slate-800 dark:text-slate-100">
            {stats.upcomingLeave}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {LEAVE_CARDS.map((card) => (
          <Link
            key={card.path}
            to={card.path}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
          >
            <div className={`h-1.5 w-full bg-gradient-to-r ${card.accent}`} />

            <div className="p-6 flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <span className="text-3xl">{card.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  {card.badge}
                </span>
              </div>

              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 group-hover:text-brand transition-colors">
                  {card.title}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {card.description}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center gap-1.5 text-sm font-bold text-brand">
                Open Module
                <svg
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
