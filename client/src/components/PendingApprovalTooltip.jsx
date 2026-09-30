import React, { useState, useRef, useEffect } from "react";
import client from "../api/client";

export default function PendingApprovalTooltip({ documentType, documentId, children }) {
  const [comment, setComment] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const fetchAttempted = useRef(false);

  const fetchComment = () => {
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

  const handleMouseEnter = () => {
    setShowTooltip(true);
    fetchComment();
  };

  const handleClick = (e) => {
    // Prevent event from bubbling up and triggering row clicks or button actions unnecessarily if we are just viewing comment
    e.stopPropagation();
    setShowModal(true);
    fetchComment();
  };

  const getTruncatedComment = () => {
    if (loading) return "Loading...";
    if (!comment) return "No comment";
    if (comment.length > 13) return comment.substring(0, 13) + "...";
    return comment;
  };

  return (
    <>
      <div
        className="relative inline-block cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={handleClick}
      >
        {children}
        {showTooltip && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-slate-800 text-white text-xs p-2 rounded shadow-lg pointer-events-none">
            {getTruncatedComment()}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Comment Details</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-800 whitespace-pre-wrap">{loading ? "Loading..." : comment}</p>
            </div>
            <div className="p-4 border-t flex justify-end bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-200 text-slate-800 rounded hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

