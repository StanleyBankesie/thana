/**
 * @fileoverview CustomerListReportPage component.
 * Provides functionality for CustomerListReportPage.
 */

import React, { useEffect, useState } from "react";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CustomerListReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState("");
  const [error, setError] = useState("");

  async function run() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/sales/customers", {
        params: { active: "true" , q: customer || undefined }
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
  }, [customer, pollingCounter]);

  function exportExcel() {
    if (!items.length) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((r) => ({
        "Customer Code": r.customer_code || "-",
        "Customer Name": r.customer_name || "-",
        "Customer Type": r.customer_type || "-",
        "Email": r.email || "-",
        "Phone": r.phone || "-",
        "Mobile": r.mobile || "-",
        "Contact Person": r.contact_person || "-",
        "Address": r.address || "-",
        "City": r.city || "-",
        "State": r.state || "-",
        "Country": r.country || "-",
        "Credit Limit": Number(r.credit_limit || 0).toFixed(2),
        "Price Type": r.price_type_name || "-",
        "Status": r.is_active ? "Active" : "Inactive",
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "customer-list.xlsx");
  }


  const { sorted: sorted_items, sortKey, sortDir, toggle } = useSort(items, "id", "desc");

  return (
    <div className="space-y-4">
      <div className="card shadow-sm border-0">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center py-3">
          <div>
            <h1 className="text-xl font-bold">Customer List Report</h1>
            <p className="text-xs opacity-90">Export all active customers to Excel</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.history.back()} className="btn btn-sm bg-white/10 hover:bg-white/20 text-white border-white/20">
              Back
            </button>
            <button
              onClick={exportExcel}
              disabled={loading || items.length === 0}
              className="btn btn-sm btn-success"
            >
              Export to Excel
            </button>
          </div>
        </div>
        <div className="card-body p-4 bg-slate-50 dark:bg-slate-900/50">
          {error && <div className="alert alert-error mb-4">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="label">Search Customer</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Name or code..."
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <table className="table table-compact w-full text-sm table-fixed">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <SortableHeader label="Code" sortKey="code" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-left p-3 border-b" />
                  <SortableHeader label="Name" sortKey="name" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-left p-3 border-b" />
                  <SortableHeader label="Type" sortKey="type" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-left p-3 border-b" />
                  <SortableHeader label="Email" sortKey="email" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-left p-3 border-b" />
                  <SortableHeader label="Phone" sortKey="phone" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-left p-3 border-b" />
                  <SortableHeader label="City" sortKey="city" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-left p-3 border-b" />
                  <SortableHeader label="Credit Limit" sortKey="credit_limit" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right p-3 border-b" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center p-8">Loading...</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center p-8 text-slate-500">No customers found</td>
                  </tr>
                ) : (
                  sorted_items.map((r) => (
                    <tr key={r.id || Math.random()} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      <td className="p-3 border-b font-mono text-xs">{r.customer_code || "-"}</td>
                      <td className="p-3 border-b font-medium">{r.customer_name}</td>
                      <td className="p-3 border-b">{r.customer_type || "-"}</td>
                      <td className="p-3 border-b text-slate-500">{r.email || "-"}</td>
                      <td className="p-3 border-b">{r.phone || "-"}</td>
                      <td className="p-3 border-b">{r.city || "-"}</td>
                      <td className="p-3 border-b text-right font-mono">
                        {Number(r.credit_limit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
