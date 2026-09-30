/**
 * @fileoverview FiscalYearsPage component.
 * Standard Modern UI Fiscal Years Setup for opening and closing financial periods.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import { 
  Calendar, 
  ArrowLeft, 
  RefreshCw, 
  Plus, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  XCircle 
} from "lucide-react";

export default function FiscalYearsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get("/finance/fiscal-years");
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load fiscal years");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api.post("/finance/fiscal-years", {
        code: code.trim(),
        startDate,
        endDate,
        isOpen,
      });
      toast.success("Fiscal year created successfully");
      setCode("");
      setStartDate("");
      setEndDate("");
      setIsOpen(true);
      load();
    } catch (e2) {
      toast.error(
        e2?.response?.data?.message || "Failed to create fiscal year"
      );
    }
  }

  async function openYear(id) {
    try {
      await api.post(`/finance/fiscal-years/${id}/open`);
      toast.success("Fiscal year opened");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to open fiscal year");
    }
  }

  async function closeYear(id) {
    try {
      await api.post(`/finance/fiscal-years/${id}/close`);
      toast.success("Fiscal year closed");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to close fiscal year");
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <Link
                to="/finance?section=Accounting%20Setup"
                className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors mb-2"
              >
                <ArrowLeft size={14} /> Back to Accounting Setup
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calendar className="w-6 h-6" /> Fiscal Years Setup
              </h1>
              <p className="text-sm mt-0.5 opacity-90">
                Open and close fiscal periods and manage accounting reporting date ranges
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3.5 py-2 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-1.5"
                onClick={load}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Fiscal Year Form Card */}
      <div className="card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Plus className="w-5 h-5 text-brand" /> Add New Fiscal Year Period
          </h3>
        </div>

        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">
              Period Code *
            </label>
            <input
              className="input w-full text-sm"
              placeholder="e.g. FY2026"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">
              Start Date *
            </label>
            <input
              className="input w-full text-sm"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1 block">
              End Date *
            </label>
            <input
              className="input w-full text-sm"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="checkbox rounded border-slate-300 text-brand focus:ring-brand"
                checked={isOpen}
                onChange={(e) => setIsOpen(e.target.checked)}
              />
              Set as Open Period
            </label>
            <button type="submit" className="btn-success text-xs px-4 py-2 flex items-center gap-1.5 ml-auto">
              <Plus size={14} /> Create Year
            </button>
          </div>
        </form>
      </div>

      {/* Main Table */}
      <div className="card shadow-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full table-fixed">
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                <th className="py-3 px-4 text-left">Fiscal Code</th>
                <th className="py-3 px-4 text-left">Start Date</th>
                <th className="py-3 px-4 text-left">End Date</th>
                <th className="py-3 px-4 text-left">Period Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400">
                    <RefreshCw className="animate-spin w-6 h-6 mx-auto mb-2" />
                    Loading fiscal years...
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold font-mono text-brand dark:text-brand-300 truncate" title={r.code}>
                      {r.code}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-xs truncate">
                      {r.start_date ? String(r.start_date).split("T")[0] : "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-xs truncate">
                      {r.end_date ? String(r.end_date).split("T")[0] : "—"}
                    </td>
                    <td className="py-3 px-4 truncate">
                      {r.is_open ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 size={12} /> Open Period
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <XCircle size={12} /> Closed Period
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {r.is_open ? (
                        <button
                          type="button"
                          className="px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          onClick={() => closeYear(r.id)}
                        >
                          <Lock size={12} /> Close Period
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          onClick={() => openYear(r.id)}
                        >
                          <Unlock size={12} /> Open Period
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400">
                    No fiscal years created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
