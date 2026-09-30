/**
 * @fileoverview RequisitionList component.
 * Provides functionality for RequisitionList.
 */

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function RequisitionList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/hr/requisitions");
      setItems(res?.data?.items || []);
    } catch {
      toast.error("Failed to load requisitions");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            Back to Menu
          </button>
          <h2 className="text-lg font-semibold">Job Requisitions</h2>
        </div>
        <Link to="/human-resources/requisitions/new" className="btn-primary">
          New Requisition
        </Link>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded shadow-sm">
        <div className="flex justify-end mb-4">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
        <table className={"min-w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
          <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
            <tr className="text-left">
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Req No</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Title</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Department</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Position</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Vacancies</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created By</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created Date</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.req_no}</td>
                <td className="px-3 py-2">{r.title}</td>
                <td className="px-3 py-2">{r.dept_name}</td>
                <td className="px-3 py-2">{r.pos_name}</td>
                <td className="px-3 py-2">{r.vacancies}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2">{r.created_by_name || "-"}</td>
                <td className="px-3 py-2">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="btn-outline text-xs mr-2"
                    onClick={() =>
                      navigate(`/human-resources/requisitions/${r.id}`)
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-brand text-xs"
                    onClick={async () => {
                      try {
                        await api.post(`/hr/requisitions/${r.id}/submit`);
                        toast.success("Submitted to workflow");
                        load();
                      } catch {
                        toast.error("Failed to submit");
                      }
                    }}
                  >
                    Submit
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && !loading ? (
              <tr>
                <td className="px-3 py-6 text-center text-sm" colSpan={9}>
                  No requisitions
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
