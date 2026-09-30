/**
 * @fileoverview TrainingList component.
 * Provides functionality for TrainingList.
 */

import React from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function TrainingList() {
  const [viewMode, setViewMode] = useViewMode();
  const [programs, setPrograms] = React.useState([]);

  const load = async () => {
    try {
      const res = await api.get("/hr/training/programs");
      setPrograms(res?.data?.items || []);
    } catch {
      toast.error("Failed to load training programs");
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary text-sm">
            Back to Menu
          </button>
          <h2 className="text-lg font-semibold">Training Programs</h2>
        </div>
        <Link to="/human-resources/training/new" className="btn-primary text-sm">
          New Program
        </Link>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded">
        <div className="flex justify-end mb-4">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
        <table className={"min-w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
          <thead className="bg-[var(--table-header-bg)] dark:bg-slate-900/50">
            <tr className="text-left">
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Code</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Title</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dates</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created By</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created Date</th>
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.code}</td>
                <td className="px-3 py-2">{p.title}</td>
                <td className="px-3 py-2">
                  {p.start_date} - {p.end_date}
                </td>
                <td className="px-3 py-2">{p.created_by_name || "-"}</td>
                <td className="px-3 py-2">{p.created_at ? new Date(p.created_at).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
            {!programs.length ? (
              <tr>
                <td className="px-3 py-6 text-center text-sm" colSpan={5}>
                  No programs
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
