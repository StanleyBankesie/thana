/**
 * @fileoverview MaintenanceRosterList — Card view with modal details and confirm action.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import {
  Clock, RefreshCw, CheckCircle, X, Calendar, ClipboardList,
  ChevronRight, Eye, Edit2
} from "lucide-react";
import { Guard } from "../../../../hooks/usePermissions";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

const STATUS_CONFIG = {
  ACTIVE   : { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  POSTED   : { cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  APPROVED : { cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  DRAFT    : { cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  CLOSED   : { cls: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300" },
};

// ── Modal component ────────────────────────────────────────────────
function RosterDetailModal({ group, onClose, onConfirm, confirming }) {
  if (!group) return null;
  const fmtDate = (d, opts) => d ? new Date(d).toLocaleDateString("en-GB", opts) : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand-600 flex items-center justify-center flex-shrink-0">
              <ClipboardList size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100">{group.baseName}</h2>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                {group.period_start && group.period_end && (
                  <span>
                    {fmtDate(group.period_start, { day: "2-digit", month: "short" })} –{" "}
                    {fmtDate(group.period_end, { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
                {group.schedule_name && (
                  <span className="text-brand-600 font-medium">📋 {group.schedule_name}</span>
                )}
                {(group.maintenance_routine || group.frequency) && (
                  <span className="capitalize">🔁 {group.maintenance_routine || group.frequency}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Modal body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {group.items.length === 0 && (
            <p className="text-center text-slate-400 py-8">No dates generated yet.</p>
          )}
          {group.items.map((item, idx) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700"
            >
              {/* Date */}
              <div className="flex items-center gap-2 min-w-[130px]">
                <Calendar size={14} className="text-brand-500 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-medium">Date</p>
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                    {item.roster_date
                      ? new Date(item.roster_date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
                      : "No Date"}
                  </p>
                </div>
              </div>

              {/* Day & Frequency */}
              <div className="min-w-[120px]">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Day</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 capitalize">
                  {item.maintenance_days || "—"}
                </p>
              </div>

              {/* Duration */}
              <div className="min-w-[90px]">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Duration</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-semibold text-brand-600">
                  {item.estimated_duration ? `${item.estimated_duration} hrs` : item.total_hours ? `${item.total_hours} hrs` : "—"}
                </p>
              </div>

              {/* Task */}
              <div className="flex-1 min-w-[180px]">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Task Description</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2" title={item.task_description}>
                  {item.task_description || "No description"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => { onClose(); setTimeout(() => window.location.assign(`/maintenance/rosters/${item.id}?mode=view`), 50); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                  title="View"
                >
                  <Eye size={15} />
                </button>
                <button
                  onClick={() => { onClose(); setTimeout(() => window.location.assign(`/maintenance/rosters/${item.id}`), 50); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Edit"
                >
                  <Edit2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <p className="text-xs text-slate-400">{group.items.length} date(s) scheduled</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">Close</button>
            {(group.status === "DRAFT" || group.status === "POSTED") && (
              <button
                onClick={() => onConfirm(group)}
                disabled={confirming}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                <CheckCircle size={16} />
                {confirming ? "Confirming…" : "Confirm Roster"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function MaintenanceRosterList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [items,        setItems]       = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [search,       setSearch]      = useState("");
  const [statusFilter, setStatusFilter]= useState("ALL");
  const [modalGroup,   setModalGroup]  = useState(null);
  const [confirming,   setConfirming]  = useState(false);
  const [currentPage,  setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  function loadData() {
    setLoading(true);
    api.get("/maintenance/rosters")
      .then(r => setItems(Array.isArray(r.data?.items) ? r.data.items : []))
      .catch(e => toast.error(e?.response?.data?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }
  useEffect(loadData, [location.state?.refresh]);

  // Build groups
  const groupedFiltered = useMemo(() => {
    setCurrentPage(1);
    const q = search.toLowerCase();

    const allFiltered = items.filter(r => {
      const matchSearch = !q ||
        String(r.roster_name    || "").toLowerCase().includes(q) ||
        String(r.schedule_name  || "").toLowerCase().includes(q) ||
        String(r.task_description || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });

    const groups = {};
    allFiltered.forEach(r => {
      const baseName = (r.roster_name || "").replace(/ - \d{4}-\d{2}-\d{2}$/, "");
      const key = `${baseName}_${r.schedule_id || "no-sch"}_${r.period_start || "no-start"}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          baseName,
          schedule_id:        r.schedule_id,
          schedule_name:      r.schedule_name,
          period_start:       r.period_start,
          period_end:         r.period_end,
          frequency:          r.frequency,
          maintenance_routine: r.maintenance_routine,
          task_description:   r.task_description,
          status:             r.status,
          total_hours:        0,
          items:              [],
          firstItem:          r,
        };
      }
      groups[key].items.push(r);
      groups[key].total_hours += (parseFloat(r.estimated_duration) || parseFloat(r.total_hours) || 0);
    });
    return Object.values(groups);
  }, [items, search, statusFilter]);

  const totalPages    = Math.ceil(groupedFiltered.length / itemsPerPage);
  const paginatedGroups = groupedFiltered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Confirm (approve) all items in a group
  async function handleConfirm(group) {
    setConfirming(true);
    try {
      await Promise.all(
        group.items.map(item =>
          api.put(`/maintenance/rosters/${item.id}`, { ...item, status: "APPROVED" })
        )
      );
      toast.success(`✅ "${group.baseName}" confirmed as Approved!`);
      setModalGroup(null);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to confirm roster");
    } finally {
      setConfirming(false);
    }
  }

  // Quick-confirm from card without opening modal
  async function handleQuickConfirm(e, group) {
    e.stopPropagation();
    if (group.status !== "DRAFT" && group.status !== "POSTED") return;
    setConfirming(true);
    try {
      await Promise.all(
        group.items.map(item =>
          api.put(`/maintenance/rosters/${item.id}`, { ...item, status: "APPROVED" })
        )
      );
      toast.success(`✅ "${group.baseName}" confirmed!`);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to confirm");
    } finally {
      setConfirming(false);
    }
  }

  const fmtDate = (d, opts) => d ? new Date(d).toLocaleDateString("en-GB", opts) : null;

  return (
    <Guard moduleKey="maintenance">
      <div className="space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Maintenance Roster</h1>
            <p className="text-sm text-slate-500">Track and manage scheduled maintenance activities</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="btn-secondary p-2" title="Refresh">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => window.history.back()} className="btn-secondary">Back</button>
            <Link to="/maintenance/rosters/new" className="btn-primary">+ New Roster</Link>
          </div>
        </div>

        {/* ── Search + filter ── */}
        <div className="card px-4 py-3 flex flex-wrap items-center gap-3">
          <input
            className="input max-w-xs"
            placeholder="Search roster name, schedule, task…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-1.5 text-sm flex-wrap">
            <span className="text-slate-500 font-medium">Status:</span>
            {["ALL", "APPROVED", "POSTED", "DRAFT", "CLOSED"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? "bg-brand text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-slate-400">{groupedFiltered.length} roster{groupedFiltered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* ── Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading && (
            <div className="col-span-full card p-10 flex items-center justify-center text-slate-400 text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" />Loading…
            </div>
          )}
          {!loading && groupedFiltered.length === 0 && (
            <div className="col-span-full card p-10 flex items-center justify-center text-slate-400 text-sm">
              No rosters found
            </div>
          )}
          {!loading && paginatedGroups.map(group => {
            const sConfig = STATUS_CONFIG[group.status] || STATUS_CONFIG.DRAFT;
            const canConfirm = group.status === "DRAFT" || group.status === "POSTED";

            return (
              <div
                key={group.id}
                onClick={() => setModalGroup(group)}
                className="card p-0 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
              >
                {/* Card top accent bar */}
                <div className={`h-1 w-full ${group.status === "APPROVED" ? "bg-violet-500" : group.status === "POSTED" ? "bg-blue-500" : group.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-300"}`} />

                <div className="p-4">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-brand/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                        <Clock size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">
                          {group.baseName}
                        </h3>
                        {group.schedule_name && (
                          <p className="text-[11px] text-brand-600 dark:text-brand-400 truncate mt-0.5">
                            📋 {group.schedule_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${sConfig.cls}`}>
                        {group.status}
                      </span>
                      {/* Quick Confirm button */}
                      {canConfirm && (
                        <button
                          onClick={e => handleQuickConfirm(e, group)}
                          disabled={confirming}
                          title="Confirm this roster"
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 hover:bg-violet-600 hover:text-white transition-colors disabled:opacity-50"
                        >
                          <CheckCircle size={11} />
                          Confirm
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Info pills */}
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500 mb-3">
                    {group.period_start && group.period_end && (
                      <span className="bg-slate-100 dark:bg-slate-700 rounded px-2 py-0.5">
                        {fmtDate(group.period_start, { day: "2-digit", month: "short" })} – {fmtDate(group.period_end, { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {(group.maintenance_routine || group.frequency) && (
                      <span className="bg-slate-100 dark:bg-slate-700 rounded px-2 py-0.5 capitalize">
                        🔁 {group.maintenance_routine || group.frequency}
                      </span>
                    )}
                    {group.total_hours > 0 && (
                      <span className="bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 rounded px-2 py-0.5 font-semibold">
                        ⏱ {group.total_hours.toFixed(1)} hrs
                      </span>
                    )}
                  </div>

                  {/* Task description preview */}
                  {group.task_description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-3 italic">
                      {group.task_description}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {group.items.length} date{group.items.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[11px] text-brand-600 font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                      View details <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500">
              Page {currentPage} of {totalPages} · {groupedFiltered.length} rosters
            </span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-3 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700"
              >Previous</button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-600 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700"
              >Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {modalGroup && (
        <RosterDetailModal
          group={modalGroup}
          onClose={() => setModalGroup(null)}
          onConfirm={handleConfirm}
          confirming={confirming}
        />
      )}
    </Guard>
  );
}
