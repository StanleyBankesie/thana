/**
 * @fileoverview Page for viewing and resuming POS sales that were put on hold.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../api/client.js";

function fmt(n) {
  return `GH₵ ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * PosOnHold component
 * Lists drafted (on-hold) sales, allowing cashiers to resume or cancel them.
 * 
 * @returns {JSX.Element} The on-hold sales dashboard.
 */
export default function PosOnHold() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [search, setSearch] = useState("");
  const today = () => new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    loadOnHold();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const receipt = String(s.receipt_no || "").toLowerCase();
        const customer = String(s.customer_name || "").toLowerCase();
        const date = s.sale_datetime
          ? new Date(s.sale_datetime).toLocaleString().toLowerCase()
          : "";
        if (!receipt.includes(q) && !customer.includes(q) && !date.includes(q)) return false;
      }
      if (fromDate && s.sale_datetime) {
        const sd = new Date(s.sale_datetime);
        const fd = new Date(fromDate);
        if (sd < fd) return false;
      }
      if (toDate && s.sale_datetime) {
        const sd = new Date(s.sale_datetime);
        const td = new Date(toDate);
        td.setHours(23, 59, 59, 999);
        if (sd > td) return false;
      }
      return true;
    });
  }, [items, search, fromDate, toDate]);

  async function loadOnHold() {
    setLoading(true);
    try {
      const res = await api.get("/pos/holds");
      setItems(
        (Array.isArray(res.data?.items) ? res.data.items : []).filter(
          (it) => it.status === "DRAFT",
        ),
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load on-hold sales");
    } finally {
      setLoading(false);
    }
  }

  function handleUnhold(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    navigate(`/pos/sales-entry?resume=${id}`);
  }

  async function handleCancel(id) {
    if (!confirm("Cancel this on-hold sale? This cannot be undone.")) return;
    setActionId(id);
    try {
      await api.put(`/pos/holds/${id}/cancel`);
      toast.success("Sale cancelled");
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to cancel sale");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to POS
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            On-Hold Sales
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Sales saved as drafts, pending completion
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="label text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Search</label>
          <input
            type="text"
            className="input py-1.5 text-sm"
            placeholder="Receipt, customer, or date..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-40">
          <label className="label text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">From Date</label>
          <input
            type="date"
            className="input py-1.5 text-sm"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="w-40">
          <label className="label text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">To Date</label>
          <input
            type="date"
            className="input py-1.5 text-sm"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="card-body text-center py-8 text-slate-500">Loading...</div>
        </div>
      ) : !items.length ? (
        <div className="card">
          <div className="card-body text-center py-8 text-slate-500">
            No sales on hold
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0 overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="text-left">Receipt No</th>
                  <th className="text-left">Date & Time</th>
                  <th className="text-left">Customer</th>
                  <th className="text-right">Items</th>
                  <th className="text-right">Total</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-slate-500">
                      No matching records
                    </td>
                  </tr>
                ) : (
                  filtered.map((sale) => (
                    <tr key={sale.id}>
                      <td className="font-semibold">{sale.receipt_no}</td>
                      <td>
                        {sale.sale_datetime
                          ? new Date(sale.sale_datetime).toLocaleString()
                          : "-"}
                      </td>
                      <td>{sale.customer_name || "-"}</td>
                      <td className="text-right">
                        {Array.isArray(sale.lines)
                          ? sale.lines.reduce((sum, l) => sum + Number(l.qty || 0), 0)
                          : 0}
                      </td>
                      <td className="text-right font-semibold">
                        {fmt(sale.total_amount)}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                            onClick={() => handleUnhold(sale.id)}
                            disabled={actionId === sale.id}
                          >
                            {actionId === sale.id ? "..." : "Resume"}
                          </button>
                          <button
                            type="button"
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                            onClick={() => handleCancel(sale.id)}
                            disabled={actionId === sale.id}
                          >
                            {actionId === sale.id ? "..." : "Cancel"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="px-4 py-2 text-sm text-slate-500 border-t">
              {filtered.length} of {items.length} sale{items.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
