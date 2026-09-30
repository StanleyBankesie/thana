import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { Guard } from "@/hooks/usePermissions";
import { toast } from "react-toastify";

export default function OrganogramPage() {
  const [positions, setPositions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState("chart"); // 'chart' or 'gantt'
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [posRes, empRes] = await Promise.all([
        api.get("/hr/positions").catch(() => ({ data: { items: [] } })),
        api.get("/hr/employees").catch(() => ({ data: { items: [] } })),
      ]);
      setPositions(posRes.data?.items || []);
      setEmployees(empRes.data?.items || []);
    } catch {
      toast.error("Failed to load organization data");
    } finally {
      setLoading(false);
    }
  };

  // Build tree nodes for organogram
  const posMap = new Map();
  positions.forEach((p) => {
    const assignedEmps = employees.filter((e) => Number(e.pos_id) === Number(p.id));
    posMap.set(p.id, {
      ...p,
      assignedEmps,
      children: [],
    });
  });

  const rootNodes = [];
  positions.forEach((p) => {
    const node = posMap.get(p.id);
    if (p.reports_to_pos_id && posMap.has(p.reports_to_pos_id)) {
      posMap.get(p.reports_to_pos_id).children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  const matchesSearch = (node) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const posMatch = node.pos_name?.toLowerCase().includes(q) || node.pos_code?.toLowerCase().includes(q);
    const empMatch = node.assignedEmps?.some((e) =>
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q)
    );
    return posMatch || empMatch;
  };

  const renderNodeCard = (node) => {
    const isMatched = matchesSearch(node);
    return (
      <div
        key={node.id}
        className={`flex flex-col items-center my-2 ${isMatched ? "opacity-100" : "opacity-40"}`}
      >
        <div className="bg-white dark:bg-slate-800 border-2 border-brand/30 dark:border-brand/50 rounded-xl shadow-md p-4 min-w-[220px] max-w-[260px] text-center hover:border-brand hover:shadow-lg transition-all relative">
          <div className="w-10 h-10 mx-auto rounded-full bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center font-bold mb-2 text-base">
            👔
          </div>
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
            {node.pos_name}
          </h4>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            {node.pos_code} {node.dept_name ? `• ${node.dept_name}` : ""}
          </p>

          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
              Staff Assigned ({node.assignedEmps?.length || 0})
            </span>
            {node.assignedEmps && node.assignedEmps.length > 0 ? (
              <div className="space-y-1">
                {node.assignedEmps.map((emp) => (
                  <div
                    key={emp.id}
                    className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 py-1 px-2 rounded flex items-center gap-1.5 justify-center"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {emp.first_name} {emp.last_name}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-amber-500 italic">Vacant Position</span>
            )}
          </div>
        </div>

        {/* Children connecting lines */}
        {node.children && node.children.length > 0 && (
          <div className="flex flex-col items-center w-full mt-2">
            <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600"></div>
            <div className="flex justify-center gap-6 relative pt-4 before:content-[''] before:absolute before:top-0 before:left-1/4 before:right-1/4 before:h-0.5 before:bg-slate-300 dark:before:bg-slate-600">
              {node.children.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  <div className="w-0.5 h-4 bg-slate-300 dark:bg-slate-600 -mt-4 mb-2"></div>
                  {renderNodeCard(child)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Guard moduleKey="human-resources">
      <div className="p-4 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              📊 Company Organogram
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Visual hierarchy of positions and direct reporting lines
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Filter by title or employee name..."
              className="input text-sm h-9 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewType === "chart"
                    ? "bg-brand text-white shadow"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
                onClick={() => setViewType("chart")}
              >
                Tree Chart
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewType === "gantt"
                    ? "bg-brand text-white shadow"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
                onClick={() => setViewType("gantt")}
              >
                Hierarchy List
              </button>
            </div>
            <Link
              to="/human-resources?section=Organization%20%26%20Structures"
              className="btn-secondary text-sm"
            >
              Return to Menu
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading organogram chart...</div>
        ) : rootNodes.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center text-slate-500 border border-slate-200 dark:border-slate-700">
            No positions found. Please configure job roles and positions in HR Setup.
          </div>
        ) : viewType === "chart" ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto min-h-[500px] flex justify-center">
            <div className="flex justify-center gap-12">
              {rootNodes.map((root) => renderNodeCard(root))}
            </div>
          </div>
        ) : (
          /* Hierarchy List / Gantt-style View */
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 font-bold text-sm uppercase text-slate-600 dark:text-slate-400">
              Position Hierarchy & Reporting Breakdown
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr className="text-left text-[10px] font-bold uppercase text-slate-500 border-b">
                  <th className="px-6 py-3">Position Title</th>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3">Reports To</th>
                  <th className="px-6 py-3">Assigned Staff</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {positions.map((p) => {
                  const parentPos = positions.find((x) => x.id === p.reports_to_pos_id);
                  const assigned = employees.filter((e) => Number(e.pos_id) === Number(p.id));
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-3 font-semibold text-slate-800 dark:text-slate-100">
                        {p.pos_name}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-slate-500">{p.pos_code || "—"}</td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                        {parentPos ? (
                          <span className="inline-flex items-center gap-1">
                            <span>⬆</span> {parentPos.pos_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Top Executive</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {assigned.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assigned.map((e) => (
                              <span key={e.id} className="badge badge-info text-[11px]">
                                {e.first_name} {e.last_name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-amber-500 text-xs italic">Vacant</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {assigned.length > 0 ? (
                          <span className="badge badge-success">FILLED</span>
                        ) : (
                          <span className="badge badge-warning">VACANT</span>
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
    </Guard>
  );
}
