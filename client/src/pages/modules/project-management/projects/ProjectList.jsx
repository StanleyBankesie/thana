/**
 * @fileoverview ProjectList component.
 * Provides functionality for ProjectList.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Activity,
  Briefcase,
  DollarSign,
  Clock,
  Printer,
  Paperclip,
  Pencil,
  ArrowLeft,
  Search,
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";

const STATUS_STYLES = {
  PLANNING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  ON_HOLD: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
  COMPLETED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
  CANCELLED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
      STATUS_STYLES[status] || "bg-slate-100 text-slate-600 border border-slate-200"
    }`}
  >
    {status?.replace("_", " ")}
  </span>
);

export default function ProjectList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  const fetchProjects = async () => {
    try {
      const res = await api.get("/projects/projects", {
        params: { active: "all" },
      });
      setItems(res.data?.items || []);
    } catch {
      toast.error("Failed to load projects portfolio");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredItems = items.filter(
    (p) =>
      p.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.project_code.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const {
    sorted: sortedItems,
    sortKey,
    sortDir,
    toggle,
  } = useSort(filteredItems, "created_at", "desc");
  const totalBudget = items.reduce((a, c) => a + Number(c.budget || 0), 0);

  async function printProject(id) {
    try {
      const response = await api.post(
        `/documents/project/${id}/render`,
        { format: "html", feature_name: "project-list" },
        { headers: { "Content-Type": "application/json" } },
      );
      const html =
        typeof response.data === "string"
          ? response.data
          : String(response.data || "");
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-10000px";
      iframe.style.width = "800px";
      iframe.style.height = "600px";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const printDocument = iframe.contentWindow?.document;
      if (!printDocument) throw new Error("Could not create print preview");
      printDocument.open();
      printDocument.write(html);
      printDocument.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 500);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to render project print template",
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Canonical List Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/project-management" className="btn btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Briefcase size={24} className="text-brand-900 dark:text-brand-400" /> Project Portfolio
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Strategic execution, milestones, contracts, and delivery management
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/project-management/projects/new"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} /> New Project
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Active Projects",
            val: items.filter((p) => p.project_status === "IN_PROGRESS").length,
            icon: <Activity size={18} />,
            color: "text-brand-700 bg-brand-50 dark:bg-brand-900/30",
          },
          {
            label: "Total Portfolio",
            val: items.length,
            icon: <Briefcase size={18} />,
            color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30",
          },
          {
            label: "Pending Start",
            val: items.filter((p) => p.project_status === "PLANNING").length,
            icon: <Clock size={18} />,
            color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30",
          },
          {
            label: "Total Budget",
            val: `GH₵ ${totalBudget.toLocaleString()}`,
            icon: <DollarSign size={18} />,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30",
          },
        ].map((stat, i) => (
          <div key={i} className="card p-4 flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className={`p-2.5 rounded-xl ${stat.color}`}>{stat.icon}</div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {stat.label}
              </p>
              <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                {stat.val}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search projects..."
              className="input pl-9 pr-3 py-1.5 text-sm h-auto w-72"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table
            className={
              "table w-full text-sm " + (viewMode === "grid" ? "table-grid-mode" : "")
            }
          >
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <SortableHeader
                  label="Project"
                  sortKey="project_name"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                />
                <SortableHeader
                  label="Status"
                  sortKey="project_status"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                />
                <SortableHeader
                  label="Client"
                  sortKey="client_name"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                />
                <SortableHeader
                  label="Manager"
                  sortKey="manager_name"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                />
                <SortableHeader
                  label="Progress"
                  sortKey="completion_percent"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                  className="text-center"
                />
                <SortableHeader
                  label="Budget (GH₵)"
                  sortKey="budget"
                  currentKey={sortKey}
                  direction={sortDir}
                  onToggle={toggle}
                  className="text-right"
                />
                <th className="text-center">Active</th>
                <th className="w-px whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-400 italic">
                    Loading projects portfolio...
                  </td>
                </tr>
              ) : sortedItems.length > 0 ? (
                sortedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Project column */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                            {item.project_name}
                          </div>
                          <div className="text-xs font-mono text-slate-400 mt-0.5">
                            {item.project_code}
                          </div>
                          {item.project_priority === "HIGH" && (
                            <div className="mt-1">
                              <span className="bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                                HIGH PRIORITY
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status column */}
                    <td className="py-3 px-4">
                      <StatusBadge status={item.project_status} />
                    </td>

                    {/* Client */}
                    <td className="py-3 px-4">
                      <div className="text-slate-800 dark:text-slate-200 whitespace-nowrap font-medium">
                        {item.client_name || "Internal"}
                      </div>
                    </td>

                    {/* Manager */}
                    <td className="py-3 px-4">
                      <div className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.manager_name || "—"}
                      </div>
                    </td>

                    {/* Progress */}
                    <td className="text-center py-3 px-4">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 font-mono">
                        {Number(item.completion_percent || 0).toFixed(0)}%
                      </div>
                      <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mx-auto">
                        <div
                          className="h-full bg-brand-900 dark:bg-brand-400 rounded-full"
                          style={{
                            width: `${item.completion_percent || 0}%`,
                          }}
                        />
                      </div>
                    </td>

                    {/* Budget */}
                    <td className="text-right font-bold font-mono whitespace-nowrap py-3 px-4">
                      GH₵ {Number(item.budget || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Active */}
                    <td className="text-center py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          item.is_active !== "N"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                            : "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        }`}
                      >
                        {item.is_active !== "N" ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="w-px whitespace-nowrap py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title="Print project"
                          aria-label={`Print ${item.project_name}`}
                          onClick={() => printProject(item.id)}
                          className="p-1.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          type="button"
                          title="Project attachments"
                          aria-label={`Attachments for ${item.project_name}`}
                          onClick={() => {
                            setActiveDocId(item.id);
                            setShowAttach(true);
                          }}
                          className="p-1.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Paperclip size={15} />
                        </button>
                        <Link
                          to={`/project-management/projects/${item.id}`}
                          title="Edit project"
                          className="p-1.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Pencil size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-400 italic">
                    No projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setActiveDocId(null);
        }}
        docType="project"
        docId={activeDocId}
      />
    </div>
  );
}
