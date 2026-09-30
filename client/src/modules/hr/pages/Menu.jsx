/**
 * @fileoverview HR Module Menu Page.
 * Displays navigation links for all sub-modules within the Human Resources system.
 */

import React from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../hr/components/PageHeader.jsx";

/**
 * HRMenu component
 * Renders a categorized dashboard of HR features (Recruitment, Attendance, Payroll, etc.).
 * 
 * @returns {JSX.Element} The HR module menu page.
 */
export default function HRMenu() {
  const sections = [
    {
      title: "Employee Management",
      links: [
        { label: "Employees", to: "/hr/employees" },
      ],
    },
    {
      title: "Recruitment",
      links: [
        { label: "Job Requisitions", to: "/hr/recruitment/requisitions" },
        { label: "Candidates", to: "/hr/recruitment/candidates" },
        { label: "Interviews", to: "/hr/recruitment/interviews" },
        { label: "Offers", to: "/hr/recruitment/offers" },
      ],
    },
    {
      title: "Attendance & Leave",
      links: [
        { label: "Attendance Dashboard", to: "/hr/attendance/dashboard" },
        { label: "Timesheet", to: "/hr/attendance/timesheet" },
        { label: "Leave Requests", to: "/hr/leave/requests" },
        { label: "Leave Approvals", to: "/hr/leave/approvals" },
        { label: "Leave Calendar", to: "/hr/leave/calendar" },
      ],
    },
    {
      title: "Payroll",
      links: [
        { label: "Payroll Dashboard", to: "/hr/payroll" },
      ],
    },
    {
      title: "Performance & Training",
      links: [
        { label: "KPI Setup", to: "/hr/performance/kpis" },
        { label: "Reviews", to: "/hr/performance/reviews" },
        { label: "Training Programs", to: "/hr/training/programs" },
        { label: "Training History", to: "/hr/training/history" },
      ],
    },
    {
      title: "Compliance & Exit",
      links: [
        { label: "Policies", to: "/hr/policies" },
        { label: "Exit Requests", to: "/hr/exit/requests" },
        { label: "Clearance", to: "/hr/exit/clearance" },
      ],
    },
  ];
  return (
    <div className="p-4">
      <PageHeader title="Human Resources" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((s) => (
          <div key={s.title} className="bg-white dark:bg-slate-800 rounded p-4">
            <div className="text-sm font-semibold mb-2">{s.title}</div>
            <div className="grid grid-cols-2 gap-2">
              {s.links.map((l) => (
                <Link key={l.to} to={l.to} className="btn-outline">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
