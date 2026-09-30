/**
 * @fileoverview Component for displaying and managing approval actions.
 * Typically used in HR workflows like leave requests and requisitions.
 */

import React from "react";

/**
 * ApprovalActions component
 * Shows current status and provides Approve/Reject buttons if the status is pending/draft.
 * 
 * @param {Object} props
 * @param {string} props.status - The current approval status (e.g., 'PENDING', 'APPROVED').
 * @param {Function} props.onApprove - Callback when the Approve button is clicked.
 * @param {Function} props.onReject - Callback when the Reject button is clicked.
 * @returns {JSX.Element} The approval actions block.
 */
export default function ApprovalActions({ status, onApprove, onReject }) {
  const s = String(status || "").toUpperCase();
  const canAct = s === "PENDING" || s === "DRAFT";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs">Status:</span>
      <span className="text-xs font-semibold">{s}</span>
      {canAct ? (
        <>
          <button type="button" className="btn-success text-xs" onClick={onApprove}>
            Approve
          </button>
          <button type="button" className="btn-danger text-xs" onClick={onReject}>
            Reject
          </button>
        </>
      ) : null}
    </div>
  );
}
