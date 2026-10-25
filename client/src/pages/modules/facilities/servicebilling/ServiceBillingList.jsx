/**
 * @fileoverview ServiceBillingList component for Facilities Management module.
 * Provides listing, searching, filtering, and status tracking for Facilities Service Bills & Recurring Contract Invoices.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Receipt, Plus, Search, Filter, ArrowLeft, 
  CheckCircle2, Clock, AlertTriangle, Building2, Eye, Edit2, XCircle
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { toast } from "react-toastify";
import { useViewMode } from "@/hooks/useViewMode.js";
import ViewToggle from "@/components/ViewToggle.jsx";

export default function ServiceBillingList() {
  const [viewMode, setViewMode] = useViewMode();
  const location = useLocation();
  const { canPerformAction, exceptionalPerms } = usePermission();
  const successMsg = location.state?.success || "";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = () => {
    setLoading(true);
    setError("");
    api
      .get("/facilities/service-bills")
      .then((res) => {
        setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || "Failed to load service bills");
      })
      .finally(() => setLoading(false));
  };

  const filtered = useMemo(() => {
    const base =
      statusFilter === "ALL"
        ? items.slice()
        : items.filter(
            (r) => String(r.status || "").toUpperCase() === statusFilter,
          );
    const q = String(searchTerm || "").trim();
    if (!q) return base;
    return filterAndSort(base, {
      query: q,
      getKeys: (r) => [r.bill_no, r.client_name, r.supplier_name, r.notes],
    });
  }, [items, searchTerm, statusFilter]);

  const totalBilled = useMemo(() => {
    return items.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
  }, [items]);

  const totalPaid = useMemo(() => {
    return items
      .filter((r) => String(r.payment_status || "").toUpperCase() === "PAID")
      .reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
  }, [items]);

  const totalOutstanding = totalBilled - totalPaid;

  return (
    <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/facilities"
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back to Facilities
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              🧾
            </span>
            Facilities Service Billing
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage physical facility service invoices, recurring client contract billing, and maintenance charges.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/facilities/contracts"
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            📜 FM Service Contracts
          </Link>
          <Link
            to="/facilities/servicebilling/new"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus size={16} />
            + New Service Bill
          </Link>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            {successMsg}
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[220px] flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search by bill no, client, notes..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none font-medium"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="POSTED">Posted to Ledger</option>
              <option value="COMPLETED">Completed</option>
              <option value="PAID">Fully Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className={"w-full text-left text-xs " + (viewMode === "grid" ? "table-grid-mode" : "")}>
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5 pl-5">Bill No & Date</th>
                <th className="p-3.5">Client / Debtor</th>
                <th className="p-3.5">Payment Status</th>
                <th className="p-3.5 text-right">Total Amount (₵)</th>
                <th className="p-3.5">Workflow Status</th>
                <th className="p-3.5">Created By</th>
                <th className="p-3.5 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    Loading service billing records...
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No service bills found. Generate a contract invoice or click "+ New Service Bill".
                  </td>
                </tr>
              )}

              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 pl-5">
                    <span className="font-mono font-bold text-slate-900 dark:text-white block">{r.bill_no}</span>
                    <span className="text-[11px] text-slate-400">{r.bill_date}</span>
                  </td>

                  <td className="p-3.5">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      {r.client_name || r.supplier_name || "General Client"}
                    </span>
                    {r.notes && (
                      <span className="text-[11px] text-slate-400 truncate max-w-xs block">
                        {r.notes}
                      </span>
                    )}
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        String(r.payment_status || "").toUpperCase() === "PAID"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                      }`}
                    >
                      {String(r.payment_status || "UNPAID").toUpperCase()}
                    </span>
                  </td>

                  <td className="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                    ₵{Number(r.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        String(r.status || "").toUpperCase() === "POSTED"
                          ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300"
                          : String(r.status || "").toUpperCase() === "COMPLETED" || String(r.status || "").toUpperCase() === "PAID"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : String(r.status || "").toUpperCase() === "OVERDUE"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {String(r.status || "PENDING").toUpperCase()}
                    </span>
                  </td>

                  <td className="p-3.5 text-slate-500">
                    <span className="text-[11px] block">{r.created_by_username || r.created_by_name || "Admin"}</span>
                    <span className="text-[10px] text-slate-400">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}
                    </span>
                  </td>

                  <td className="p-3.5 pr-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        to={`/facilities/servicebilling/${r.id}?mode=view`}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        View
                      </Link>

                      {String(r.payment_status || "").toUpperCase() !== "PAID" && String(r.status || "").toUpperCase() !== "POSTED" && (
                        <Link
                          to={`/facilities/servicebilling/${r.id}?mode=edit`}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 transition-colors"
                        >
                          Edit
                        </Link>
                      )}

                      {String(r.payment_status || "").toUpperCase() !== "PAID" && exceptionalPerms?.has?.("SERVICE.BILL.CANCEL") && (
                        <button
                          type="button"
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                          onClick={() => {
                            if (!window.confirm("Are you sure you want to cancel this service bill?")) return;
                            api.put(`/facilities/service-bills/${r.id}`, { status: "CANCELLED" })
                              .then(() => {
                                toast.success("Service bill cancelled");
                                setItems(items.map((i) => (i.id === r.id ? { ...i, status: "CANCELLED" } : i)));
                              })
                              .catch((err) => {
                                toast.error(err?.response?.data?.message || "Failed to cancel service bill");
                              });
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
