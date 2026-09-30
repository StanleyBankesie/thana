/**
 * @fileoverview ApprovedDocuments component.
 * Provides functionality for ApprovedDocuments.
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../../../../api/client";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ApprovedDocuments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    client
      .get("/workflows/notifications")
      .then((res) => setItems(Array.isArray(res.data?.items) ? res.data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const approved = useMemo(
    () =>
      items.filter((n) =>
        String(n?.message || "").toLowerCase().includes("approved"),
      ),
    [items],
  );

  function extractInstanceIdFromLink(link) {
    const s = String(link || "");
    const m = s.match(/approvals\/(\d+)/);
    return m ? Number(m[1]) : null;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Approved Documents</h1>
        <Link to="/" className="btn btn-secondary">Return to Home</Link>
      </div>

      {loading ? (
        <div className="p-6">Loading approved documents...</div>
      ) : approved.length === 0 ? (
        <div className="text-slate-500">No approved documents found.</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-erp border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4">Message</th>
                <th className="p-4">Approved On</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((n) => {
                const instanceId = extractInstanceIdFromLink(n.link);
                return (
                  <tr key={n.id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="p-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{n.message}</div>
                      <div className="text-xs text-slate-500">{n.reference || ""}</div>
                    </td>
                    <td className="p-4">{n.date || "Just now"}</td>
                    <td className="p-4">
                      {instanceId ? (
                        <button
                          className="text-brand hover:text-brand-600 text-sm font-medium"
                          onClick={() =>
                            navigate(`/administration/workflows/approvals/${instanceId}`)
                          }
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-slate-400 text-sm">No link</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
