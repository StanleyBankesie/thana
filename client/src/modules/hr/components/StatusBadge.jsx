/**
 * @fileoverview A reusable badge component to display approval/workflow statuses.
 */

import React from "react";

const map = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

/**
 * StatusBadge component
 * Normalizes the status string and applies predefined color classes.
 * 
 * @param {Object} props
 * @param {string} props.value - The status string (e.g., 'APPROVED', 'REJECTED').
 * @returns {JSX.Element} A styled span indicating the status.
 */
export default function StatusBadge({ value }) {
  const v = String(value || "").toUpperCase();
  const cls = map[v] || "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {v || "-"}
    </span>
  );
}
