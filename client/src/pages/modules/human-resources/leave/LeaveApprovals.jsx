/**
 * @fileoverview LeaveApprovals component.
 * Provides functionality for LeaveApprovals.
 */

import React from "react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function LeaveApprovals() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/leave/requests?status=PENDING");
      setItems(res?.data?.items || []);
    } catch {
      toast.error("Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Leave Approvals</h2>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded shadow-sm">
        <table className="min-w-full">
          <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
            <tr className="text-left">
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employee</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dates</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Days</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="px-3 py-2">
                  {it.first_name} {it.last_name}
                </td>
                <td className="px-3 py-2">{it.type_name}</td>
                <td className="px-3 py-2">
                  {it.start_date} - {it.end_date}
                </td>
                <td className="px-3 py-2">{it.total_days}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="btn-success text-xs mr-2"
                    onClick={async () => {
                      try {
                        await api.post(`/hr/leave/approve/${it.id}`, {
                          approved: true,
                        });
                        toast.success("Approved");
                        load();
                      } catch {
                        toast.error("Failed to approve");
                      }
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-danger text-xs"
                    onClick={async () => {
                      try {
                        await api.post(`/hr/leave/approve/${it.id}`, {
                          approved: false,
                        });
                        toast.success("Rejected");
                        load();
                      } catch {
                        toast.error("Failed to reject");
                      }
                    }}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && !loading ? (
              <tr>
                <td className="px-3 py-6 text-center text-sm" colSpan={5}>
                  No leave requests pending
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
