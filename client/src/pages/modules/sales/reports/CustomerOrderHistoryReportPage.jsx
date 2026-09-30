/**
 * @fileoverview CustomerOrderHistoryReportPage component.
 * Provides functionality for CustomerOrderHistoryReportPage.
 */

import React, { useEffect, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { Link } from "react-router-dom";
import { api } from "api/client";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CustomerOrderHistoryReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, []);

  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await api.get("/sales/customers");
        setCustomers(
          Array.isArray(res?.data?.items)
            ? res.data.items
            : Array.isArray(res?.data)
              ? res.data
              : [],
        );
      } catch (e) {
        console.error("Failed to load customers", e);
      }
    }
    loadCustomers();
  }, [pollingCounter]);

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/reports/customer-order-history", {
        params: { 
          customerId: customerId || null,
          from: fromDate || null,
          to: toDate || null
        },
      });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    run();
  }, [customerId, fromDate, toDate, pollingCounter]);

  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "txn_date", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              Customer Order History
            </h1>
            <p className="text-sm mt-1">Full customer transaction history</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2" title="Live Auto-Refresh Active"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Live</span></div><button onClick={() => window.history.back()} className="btn btn-secondary">Back</button></div>
          </div>
        </div>
        <div className="card-body">
          {error ? <div className="text-red-600 text-sm mb-3">{error}</div> : null}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label">Customer</label>
              <select
                className="input"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">From Date</label>
              <input
                type="date"
                className="input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To Date</label>
              <input
                type="date"
                className="input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full table-fixed">
              <thead>
                <tr>
                  <SortableHeader label="Stage" sortKey="stage" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Reference" sortKey="ref_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Date" sortKey="txn_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Amount" sortKey="amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Notes" sortKey="notes" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                </tr>
              </thead>
              <tbody>
                {sorted_items.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium">{r.stage}</td>
                    <td>{r.ref_no}</td>
                    <td>{r.txn_date ? new Date(r.txn_date).toLocaleDateString() : "-"}</td>
                    <td>{r.customer_name || "-"}</td>
                    <td className="text-right">
                      {Number(r.amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>{r.notes || "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-slate-500">
                      No records
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
