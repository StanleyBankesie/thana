/**
 * @fileoverview JobExecutionList component.
 * Provides functionality for JobExecutionList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Search, ChevronRight, Plus, Eye, Edit } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "../../../../components/list/ListDocActionIconButtons.jsx";
import DocumentAttachmentsModal from "../../../../components/attachments/DocumentAttachmentsModal.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

const statusColors = {
  DRAFT: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  ON_HOLD: "bg-orange-100 text-orange-700",
};
function Badge({ value, colorMap }) {
  const v = String(value || "").toUpperCase();
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${colorMap[v] || "bg-slate-100 text-slate-600"}`}
    >
      {v}
    </span>
  );
}

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function JobExecutionList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get("/maintenance/job-executions")
      .then((r) => {
        if (mounted) setItems(Array.isArray(r.data?.items) ? r.data.items : []);
      })
      .catch((e) => toast.error(e?.response?.data?.message || "Failed to load"))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [location.state?.refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) =>
        String(r.execution_no || "")
          .toLowerCase()
          .includes(q) ||
        String(r.order_no || "")
          .toLowerCase()
          .includes(q) ||
        String(r.status || "")
          .toLowerCase()
          .includes(q),
    );
  }, [items, search]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/maintenance?section=Operations %26 Schedules" className="btn btn-secondary p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">
              Job Executions
            </h1>
            <p className="text-slate-500 text-sm">
              Real-time maintenance work tracking and logs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              className="input pl-10 pr-4 py-2 w-64"
              placeholder="Search executions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() =>
              (window.location.href = "/maintenance/job-executions/new")
            }
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 flex items-center gap-2"
          >
            <Plus size={20} />
            New Execution
          </button>
        </div>
      </div>

      <div className="card overflow-hidden shadow-sm">
        
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
          <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr>
                <th className="whitespace-nowrap">Execution No</th>
                <th className="whitespace-nowrap">Job Order</th>
                <th className="whitespace-nowrap">Timeline</th>
                <th className="whitespace-nowrap">Technicians</th>
                <th className="whitespace-nowrap">Status</th>
                <th className="whitespace-nowrap">Created By</th>
                <th className="whitespace-nowrap">Created Date</th>
                <th className="text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap"
                  >
                    Loading Logs...
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((r) => (
                  <tr key={r.id} className="group">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-sm whitespace-nowrap">
                      {r.execution_no}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-brand-700 dark:text-brand-300 whitespace-nowrap">
                      {r.order_no}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                      <div>{r.start_date ? String(r.start_date).split('T')[0] : ''}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                        {r.end_date ? String(r.end_date).split('T')[0] : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                      {r.technicians}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <Badge value={r.status} colorMap={statusColors} />
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {r.created_by_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                          title="View"
                          onClick={() =>
                            navigate(
                              `/maintenance/job-executions/${r.id}?mode=view`,
                            )
                          }
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                          title="Edit"
                          onClick={() =>
                            navigate(
                              `/maintenance/job-executions/${r.id}?mode=edit`,
                            )
                          }
                        >
                          <Edit size={15} />
                        </button>
                        <ListPrintIconButton
                          onClick={() => toast.info("Print coming soon")}
                        />
                        <ListPdfIconButton
                          onClick={() => toast.info("PDF coming soon")}
                        />
                        <ListAttachmentIconButton
                          onClick={() => {
                            setActiveDocId(r.id);
                            setShowAttach(true);
                          }}
                        />

                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-50 whitespace-nowrap"
                  >
                    No execution records identified.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showAttach && activeDocId && (
        <DocumentAttachmentsModal
          open={showAttach}
          onClose={() => {
            setShowAttach(false);
            setActiveDocId(null);
          }}
          docType="maintenance"
          docId={activeDocId}
        />
      )}
    </div>
  );
}
