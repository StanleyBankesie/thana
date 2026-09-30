/**
 * @fileoverview MaintenanceJobOrdersList component.
 * Provides functionality for MaintenanceJobOrdersList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Search, Plus, Eye, Edit } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { Guard } from "../../../../hooks/usePermissions";
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
  OPEN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
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
export default function MaintenanceJobOrdersList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/maintenance/job-orders");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load job orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [location.state?.refresh]);

  
  async function handleConfirm(item) {
    try {
      setLoading(true);
      await api.put(`/maintenance/job-orders/${item.id}`, { ...item, status: 'POSTED' });
      toast.success("Job order posted successfully");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to post job order");
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) =>
        String(r.order_no || "")
          .toLowerCase()
          .includes(q) ||
        String(r.asset_name || "")
          .toLowerCase()
          .includes(q) ||
        String(r.assigned_technician || "")
          .toLowerCase()
          .includes(q) ||
        String(r.status || "")
          .toLowerCase()
          .includes(q),
    );
  }, [items, search]);

  return (
    <Guard moduleKey="maintenance">
      <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link to="/maintenance?section=Operations %26 Schedules" className="btn btn-secondary p-2">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-brand-900 dark:text-brand-300">
                Job Orders
              </h1>
              <p className="text-slate-500 text-sm">
                Track and manage maintenance job orders
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
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Link
              to="/maintenance/job-orders/new"
              className="btn-success flex items-center gap-2"
            >
              <Plus size={20} />
              New Job Order
            </Link>
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
                  <th className="whitespace-nowrap">Order No</th>
                  <th className="whitespace-nowrap">Request Ref</th>
                  <th className="whitespace-nowrap">Asset</th>
                  <th className="whitespace-nowrap">Schedule</th>
                  <th className="whitespace-nowrap">Technician</th>
                  <th className="whitespace-nowrap">Status</th>
                  <th className="whitespace-nowrap">Created By</th>
                  <th className="whitespace-nowrap">Created Date</th>
                  <th className="whitespace-nowrap">Confirm</th>
                  <th className="text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {loading ? (
                  <tr>
                    <td
                      colSpan="10"
                      className="px-6 py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap"
                    >
                      Loading Orders...
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((r) => (
                    <tr key={r.id} className="group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                          {r.order_no}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                          {r.order_date ? new Date(r.order_date).toLocaleDateString() : "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-brand-700 dark:text-brand-300 whitespace-nowrap">
                        {r.request_no || r.request_id}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {r.asset_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                        {r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 font-medium whitespace-nowrap">
                        {r.assigned_technician}
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
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {r.status === 'DRAFT' ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors h-9"
                            onClick={() => handleConfirm(r)}
                          >
                            Confirm
                          </button>
                        ) : r.status === 'POSTED' ? (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-500 bg-slate-100 border border-transparent rounded-lg h-9 cursor-not-allowed opacity-70"
                          >
                            Confirmed
                          </button>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                            title="View"
                            onClick={() =>
                              navigate(
                                `/maintenance/job-orders/${r.id}?mode=view`,
                              )
                            }
                          >
                            <Eye size={15} />
                          </button>
                          {r.status !== 'POSTED' && (
                            <button
                              type="button"
                              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                              title="Edit"
                              onClick={() =>
                                navigate(
                                  `/maintenance/job-orders/${r.id}?mode=edit`,
                                )
                              }
                            >
                              <Edit size={15} />
                            </button>
                          )}
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
                      colSpan="10"
                      className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-50 whitespace-nowrap"
                    >
                      No job orders identified.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
    </Guard>
  );
}
