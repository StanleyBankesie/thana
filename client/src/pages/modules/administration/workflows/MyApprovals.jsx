/**
 * @fileoverview MyApprovals component.
 * Provides functionality for MyApprovals.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../../../api/client";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MyApprovals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get("/workflows/approvals/pending")
      .then((res) => setItems(res.data.items))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading approvals...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          My Pending Approvals
        </h1>
        <Link to="/" className="btn btn-secondary">Return to Home</Link>
      </div>

      {items.length === 0 ? (
        <div className="text-slate-500">No pending approvals found.</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-erp border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4">Document</th>
                <th className="p-4">Type</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Step</th>
                <th className="p-4">Submitted By</th>
                <th className="p-4">Date</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {items.map((item) => (
                <tr
                  key={item.workflow_instance_id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="p-4 font-medium text-slate-900 dark:text-slate-100">
                    {String(item.document_type || "")
                      .replace(/_/g, " ")
                      .toLowerCase()
                      .replace(/\b\w/g, (c) => c.toUpperCase())} #{item.document_id}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">
                    {item.document_type}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">
                    {item.amount != null
                      ? Number(item.amount).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : "-"}
                  </td>
                  <td className="p-4">
                    <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {item.step_name}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">
                    {item.initiator || "Unknown"}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">
                    {new Date(item.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <Link
                      to={`/administration/workflows/approvals/${item.workflow_instance_id}`}
                      className="btn btn-sm btn-primary"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
