/**
 * @fileoverview BankReconciliationForm component.
 * Provides functionality for BankReconciliationForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function BankReconciliationForm() {
  const { hasExceptional } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isViewMode = new URLSearchParams(location.search).get("mode") === "view";
  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState(null);
  const [hdrDraft, setHdrDraft] = useState({});
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [fetchingTransactions, setFetchingTransactions] = useState(false);
  const [statusFilter, setStatusFilter] = useState("APPROVED");

  async function load() {
    try {
      setLoading(true);
      const res = await api.get(`/finance/bank-reconciliations/${id}`);
      setHeader(res.data?.header || null);
      setHdrDraft({});

      const sRes = await api.get(`/finance/bank-reconciliations/${id}/summary`);
      setSummary(sRes.data || null);

      fetchTransactions();
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load reconciliation",
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchTransactions() {
    try {
      setFetchingTransactions(true);
      const res = await api.get(
        `/finance/bank-reconciliations/${id}/transactions`,
        { params: { status: statusFilter } },
      );
      setTransactions(res.data?.items || []);
    } catch (e) {
      console.error("Failed to fetch transactions", e);
    } finally {
      setFetchingTransactions(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    fetchTransactions();
  }, [statusFilter]);

  async function saveHeader() {
    try {
      await api.put(`/finance/bank-reconciliations/${id}`, {
        statementFrom: hdrDraft.statement_from || undefined,
        statementTo: hdrDraft.statement_to || undefined,
        statementEndingBalance:
          hdrDraft.statement_ending_balance === "" ||
          hdrDraft.statement_ending_balance === null
            ? undefined
            : Number(hdrDraft.statement_ending_balance),
        status: hdrDraft.status || undefined,
      });
      toast.success("Header updated");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update header");
    }
  }

  async function toggleCleared(tx) {
    if (!tx.voucher_id) {
      toast.error("Voucher ID missing for this transaction");
      return;
    }

    const amount = Number(tx.debit) || -Number(tx.credit);
    if (isNaN(amount) || amount === 0) {
      toast.error("Cannot clear transaction with zero amount");
      return;
    }

    try {
      if (tx.cleared) {
        // Find the line and delete it if it's already cleared
        const res = await api.get(`/finance/bank-reconciliations/${id}`);
        const lines = res.data?.lines || [];
        const line = lines.find((l) => l.voucher_id === tx.voucher_id);
        if (line) {
          await api.delete(`/finance/bank-reconciliation-lines/${line.id}`);
        }
      } else {
        // Add a new cleared line
        await api.post(`/finance/bank-reconciliations/${id}/lines`, {
          voucherId: tx.voucher_id,
          statementDate: tx.voucher_date?.slice(0, 10),
          description: tx.narration,
          amount: amount,
          cleared: 1,
        });
      }
      fetchTransactions();
      const sRes = await api.get(`/finance/bank-reconciliations/${id}/summary`);
      setSummary(sRes.data || null);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to update cleared status",
      );
    }
  }

  if (!header && !loading) {
    return (
      <div className="p-4">
        <div className="alert alert-error">Reconciliation not found</div>
        <button onClick={() => window.history.back()} className="btn mt-4">
          Back to List
        </button>
      </div>
    );
  }

  const isComplete = header?.status === "COMPLETED" || isViewMode;

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center bg-brand p-4 text-white rounded-lg shadow-md">
        <div>
          <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
          <p className="text-sm opacity-90">
            {header?.bank_account_name} ({header?.account_number})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isViewMode && (
            <span className="badge badge-warning badge-lg font-semibold">View Only</span>
          )}
          <button onClick={() => window.history.back()} className="btn btn-sm btn-outline text-white border-white hover:bg-white/20"
          >
            Back to List
          </button>
          <button
            onClick={load}
            className="btn btn-sm btn-outline text-white border-white hover:bg-white/20"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl border border-slate-200">
        <div className="card-body p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="form-control">
              <label className="label text-xs font-bold text-slate-500 uppercase">
                Statement From
              </label>
              <input
                type="date"
                className={`input input-bordered w-full ${isComplete ? "bg-blue-50 border-blue-200" : ""}`}
                value={
                  hdrDraft.statement_from ??
                  header?.statement_from?.slice(0, 10) ??
                  ""
                }
                readOnly={isComplete}
                onChange={(e) =>
                  setHdrDraft((p) => ({ ...p, statement_from: e.target.value }))
                }
              
                disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div className="form-control">
              <label className="label text-xs font-bold text-slate-500 uppercase">
                Statement To
              </label>
              <input
                type="date"
                className={`input input-bordered w-full ${isComplete ? "bg-blue-50 border-blue-200" : ""}`}
                value={
                  hdrDraft.statement_to ??
                  header?.statement_to?.slice(0, 10) ??
                  ""
                }
                readOnly={isComplete}
                onChange={(e) =>
                  setHdrDraft((p) => ({ ...p, statement_to: e.target.value }))
                }
              
                disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div className="form-control">
              <label className="label text-xs font-bold text-slate-500 uppercase">
                Ending Balance
              </label>
              <input
                type="number"
                className="input input-bordered w-full"
                value={
                  hdrDraft.statement_ending_balance ??
                  header?.statement_ending_balance ??
                  ""
                }
                onChange={(e) =>
                  setHdrDraft((p) => ({
                    ...p,
                    statement_ending_balance: e.target.value,
                  }))
                }
              />
            </div>
            <div className="form-control">
              <label className="label text-xs font-bold text-slate-500 uppercase">
                Status
              </label>
              <select
                className="select select-bordered w-full"
                value={hdrDraft.status ?? header?.status ?? "DRAFT"}
                onChange={(e) =>
                  setHdrDraft((p) => ({ ...p, status: e.target.value }))
                }
              >
                <option value="DRAFT">Draft</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={saveHeader}
              disabled={isViewMode}
            >
              Save Header
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stats shadow border border-slate-200">
          <div className="stat">
            <div className="stat-title text-xs font-bold uppercase">
              Opening Balance
            </div>
            <div className="stat-value text-2xl">
              {(summary?.openingBookBalance || 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="stats shadow border border-slate-200">
          <div className="stat">
            <div className="stat-title text-xs font-bold uppercase">
              Cleared Balance
            </div>
            <div className="stat-value text-2xl">
              {(summary?.endingBookBalance || 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="stats shadow border border-slate-200">
          <div className="stat">
            <div className="stat-title text-xs font-bold uppercase">
              Bank Balance
            </div>
            <div className="stat-value text-2xl">
              {(header?.statement_ending_balance || 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="stats shadow border border-slate-200">
          <div className="stat">
            <div className="stat-title text-xs font-bold uppercase">
              Difference
            </div>
            <div
              className={`stat-value text-2xl ${summary?.diffBankVsBook === 0 ? "text-success" : "text-error"}`}
            >
              {(summary?.diffBankVsBook || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl border border-slate-200">
        <div className="card-header bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold">Bank Transactions</h2>
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase">
                Voucher Status:
              </span>
              <select
                className="text-sm font-medium focus:outline-none cursor-pointer"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="APPROVED">Approved</option>
                <option value="DRAFT">Not Approved</option>
                <option value="BOTH">Both</option>
              </select>
            </div>
          </div>
          {fetchingTransactions && (
            <span className="loading loading-spinner loading-sm"></span>
          )}
        </div>
        <div className="card-body p-0 overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-xs font-bold uppercase">Cleared</th>
                <th className="text-xs font-bold uppercase">Voucher No</th>
                <th className="text-xs font-bold uppercase">Date</th>
                <th className="text-xs font-bold uppercase">Cheque No</th>
                <th className="text-xs font-bold uppercase">Cheque Date</th>
                <th className="text-xs font-bold uppercase">Narration</th>
                <th className="text-xs font-bold uppercase">Account Name</th>
                <th className="text-right text-xs font-bold uppercase w-32">
                  Debit
                </th>
                <th className="text-right text-xs font-bold uppercase w-32">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="text-center py-8 text-slate-500 italic"
                  >
                    No transactions found for the selected period
                  </td>
                </tr>
              ) : (
                transactions.map((tx, idx) => (
                  <tr key={idx} className="hover">
                    <td>
                      <input
                        type="radio"
                        className="radio radio-success radio-sm"
                        checked={tx.cleared}
                        onClick={() => !isViewMode && toggleCleared(tx)}
                        readOnly={isViewMode}
                        style={isViewMode ? { cursor: "not-allowed", opacity: 0.6 } : {}}
                      />
                    </td>
                    <td className="font-medium text-sm">{tx.voucher_no}</td>
                    <td className="text-sm">{tx.voucher_date?.slice(0, 10)}</td>
                    <td className="text-sm font-mono">
                      {tx.checkNumber || "-"}
                    </td>
                    <td className="text-sm font-mono">
                      {tx.chequeDate?.slice(0, 10) || "-"}
                    </td>
                    <td
                      className="text-sm truncate max-w-xs"
                      title={tx.narration}
                    >
                      {tx.narration}
                    </td>
                    <td className="text-sm">{tx.account_name}</td>
                    <td className="text-right text-sm font-mono">
                      {tx.debit ? Number(tx.debit).toLocaleString() : "-"}
                    </td>
                    <td className="text-right text-sm font-mono">
                      {tx.credit ? Number(tx.credit).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
