import React, { useState, useRef } from "react";
import client from "../api/client";

export default function PendingApprovalBadge({ documentType, documentId }) {
  const [comment, setComment] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);
  const [loading, setLoading] = useState(false);
  const fetchAttempted = useRef(false);

  const handleMouseEnter = () => {
    setShowTooltip(true);
    if (!fetchAttempted.current && !loading) {
      setLoading(true);
      fetchAttempted.current = true;
      client
        .get(`/workflows/logs/${documentType}/${documentId}/latest-comment`)
        .then((res) => {
          if (res.data && res.data.comment) {
            setComment(res.data.comment);
          } else {
            setComment("No comments provided.");
          }
        })
        .catch(() => {
          setComment("Error loading comment.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="badge badge-warning cursor-help">Pending Approval</span>
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-slate-800 text-white text-xs p-2 rounded shadow-lg pointer-events-none">
          {loading ? "Loading comment..." : comment}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
}
