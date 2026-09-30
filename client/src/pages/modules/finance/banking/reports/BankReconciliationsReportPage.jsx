/**
 * @fileoverview BankReconciliationsReportPage component.
 * Provides functionality for BankReconciliationsReportPage.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function BankReconciliationsReportPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState("pdf");
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.get("/finance/bank-reconciliations", {
          params: { status: "COMPLETED" },
        });
        setItems(res.data?.items || []);
      } catch (e) {
        toast.error(
          e?.response?.data?.message ||
            "Failed to load reconciled bank accounts",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  async function exportNow() {
    try {
      const res = await api.get("/finance/bank-reconciliations/report", {
        params: { format },
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bank-reconciliations.${format === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to export report");
    }
  }
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Reconciled Bank Accounts</h1>
            <button onClick={() => window.history.back()} className="btn btn-sm btn-outline text-white border-white hover:bg-white hover:text-brand">
              Back to Menu
            </button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>Account No</th>
                  <th>Period</th>
                  <th className="text-right">Ending Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.bank_account_name}</td>
                    <td>{r.bank_account_number || ""}</td>
                    <td>
                      {String(r.statement_from).slice(0, 10)} —{" "}
                      {String(r.statement_to).slice(0, 10)}
                    </td>
                    <td className="text-right">
                      {Number(r.statement_ending_balance || 0).toLocaleString(
                        "en-US",
                        { minimumFractionDigits: 2 },
                      )}
                    </td>
                    <td>{r.status}</td>
                  </tr>
                ))}
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-600">
                      No reconciled accounts found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex gap-2">
            <select
              className="input"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel</option>
            </select>
            <button className="btn" onClick={exportNow}>
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
