/**
 * @fileoverview ProjectList component.
 * Provides functionality for ProjectList.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Activity, Briefcase, DollarSign, Clock } from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

const STATUS_STYLES = {
  PLANNING:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  ON_HOLD:     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  COMPLETED:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  CANCELLED:   "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

const StatusBadge = ({ status }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${STATUS_STYLES[status] || "bg-slate-100 text-slate-500"}`}>
    {status?.replace("_", " ")}
  </span>
);

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProjectList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchProjects = async () => {
    try {
      const res = await api.get("/projects/projects", { params: { active: "all" } });
      setItems(res.data?.items || []);
    } catch { toast.error("Failed to load projects portfolio"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProjects(); }, []);

  const filteredItems = items.filter(p =>
    p.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.project_code.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(filteredItems, "created_at", "desc");
  const totalBudget = items.reduce((a, c) => a + Number(c.budget), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Project Portfolio</h1>
              <p className="text-sm mt-1 opacity-80">Strategic execution and delivery management</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.history.back()} className="btn btn-secondary">Back</button>
              <Link to="/project-management/projects/new" className="btn-success flex items-center gap-1.5"><Plus size={15} />New Project</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Active Projects",  val: items.filter(p => p.project_status === "IN_PROGRESS").length, icon: <Activity size={18} />, color: "text-brand-600 bg-brand-50 dark:bg-brand-900/30" },
          { label: "Total Portfolio",  val: items.length, icon: <Briefcase size={18} />, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30" },
          { label: "Pending Start",    val: items.filter(p => p.project_status === "PLANNING").length, icon: <Clock size={18} />, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30" },
          { label: "Total Budget",     val: `GHS ${totalBudget.toLocaleString()}`, icon: <DollarSign size={18} />, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30" },
        ].map((stat, i) => (
          <div key={i} className="card p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${stat.color}`}>{stat.icon}</div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{stat.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search projects..."
              className="input max-w-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <SortableHeader label="Project"          sortKey="project_name"       currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Status"           sortKey="project_status"     currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Client"           sortKey="client_name"        currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Manager"          sortKey="manager_name"       currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Progress"         sortKey="completion_percent"  currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-center" />
                  <SortableHeader label="Budget"           sortKey="budget"              currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <th>Budget Health</th>
                  <SortableHeader label="End Date"         sortKey="end_date"            currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <th className="text-center">Active</th>
                  <th className="w-px whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="10" className="text-center py-8 text-slate-400">Loading...</td></tr>
                ) : sortedItems.length > 0 ? sortedItems.map((item) => (
                  <tr key={item.id}>
                    {/* Project column */}
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        {/* Code chip */}
                        <div className="shrink-0 flex flex-col items-center justify-center w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                          <span className="text-[8px] text-indigo-500 font-bold uppercase leading-none tracking-tight">
                            {(item.project_code || "PRJ").split("-")[0]}
                          </span>
                          <span className="text-xs text-slate-800 dark:text-slate-200 font-bold leading-none mt-0.5">
                            {(item.project_code || "").split("-")[1] || "00"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                            {item.project_name}
                          </div>
                          {item.project_priority === "HIGH" && (
                            <div className="mt-0.5">
                              <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase">HIGH PRIORITY</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status column */}
                    <td className="py-3">
                      <StatusBadge status={item.project_status} />
                    </td>

                    {/* Client */}
                    <td className="py-3">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {item.client_name || "Internal"}
                      </div>
                    </td>

                    {/* Manager */}
                    <td className="py-3">
                      <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {item.manager_name || "N/A"}
                      </div>
                    </td>

                    {/* Progress */}
                    <td className="text-center py-3">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {Number(item.completion_percent || 0).toFixed(0)}%
                      </div>
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden mx-auto">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${item.completion_percent || 0}%` }} />
                      </div>
                    </td>

                    {/* Budget */}
                    <td className="text-right font-bold text-sm whitespace-nowrap py-3">
                      GHS {Number(item.budget).toLocaleString()}
                    </td>

                    {/* Budget Health */}
                    <td className="py-3">
                      <div className="flex items-center gap-2 w-28">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (item.expense_total || 0) >= item.budget * 0.9 ? "bg-rose-500" :
                              (item.expense_total || 0) >= item.budget * 0.7 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${item.budget > 0 ? Math.min((item.expense_total || 0) / item.budget * 100, 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                          GHS {Number(item.expense_total || 0).toLocaleString()}
                        </span>
                      </div>
                    </td>

                    {/* End Date */}
                    <td className="whitespace-nowrap text-sm py-3">
                      {item.end_date ? new Date(item.end_date).toLocaleDateString() : "—"}
                    </td>

                    {/* Active */}
                    <td className="text-center py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${item.is_active !== "N" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {item.is_active !== "N" ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions — tight column, no extra gap */}
                    <td className="w-px whitespace-nowrap py-3 pl-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/project-management/projects/${item.id}/dashboard`}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          Dashboard
                        </Link>
                        <Link
                          to={`/project-management/projects/${item.id}`}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="10" className="text-center py-8 text-slate-400">No projects found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
