/**
 * @fileoverview BankReconciliationList component.
 * Provides functionality for BankReconciliationList.
 */

import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function BankReconciliationList() {
  const [viewMode, setViewMode] = useViewMode();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [recons, setRecons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedBankId = searchParams.get("bankId") || "";

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const modalRef = useRef(null);

  // New reconciliation form state
  const [bankAccountId, setBankAccountId] = useState("");
  const [statementFrom, setStatementFrom] = useState("");
  const [statementTo, setStatementTo] = useState("");
  const [endingBalance, setEndingBalance] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [isFromLocked, setIsFromLocked] = useState(false);
  const [creating, setCreating] = useState(false);

  // Confirm state
  const [confirmingId, setConfirmingId] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const [baRes, rcRes] = await Promise.all([
        api.get("/finance/bank-accounts"),
        api.get("/finance/bank-reconciliations"),
      ]);
      setBankAccounts(baRes.data?.items || []);
      setRecons(rcRes.data?.items || []);
    } catch (e) {
      toast.error(
        e?.response?.data?.message ||
          "Failed to load bank accounts / reconciliations",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (selectedBankId) {
      setBankAccountId(selectedBankId);
    }
  }, [selectedBankId]);

  useEffect(() => {
    if (bankAccountId) {
      const bankRecons = recons
        .filter(
          (r) =>
            String(r.bank_account_id) === String(bankAccountId) &&
            r.status === "COMPLETED",
        )
        .sort((a, b) => new Date(b.statement_to) - new Date(a.statement_to));

      if (bankRecons.length > 0) {
        const lastTo = bankRecons[0].statement_to?.slice(0, 10);
        const lastEndingBalance = Number(
          bankRecons[0].statement_ending_balance || 0,
        );
        setOpeningBalance(lastEndingBalance);

        if (lastTo) {
          const d = new Date(lastTo + "T12:00:00");
          d.setDate(d.getDate() + 1);
          const nextFrom = d.toISOString().slice(0, 10);
          setStatementFrom(nextFrom);
          setStatementTo(nextFrom);
          setIsFromLocked(true);
        } else {
          setStatementFrom("");
          setIsFromLocked(false);
        }
      } else {
        setStatementFrom("");
        setOpeningBalance(0);
        setIsFromLocked(false);
      }
    } else {
      setStatementFrom("");
      setOpeningBalance(0);
      setIsFromLocked(false);
    }
  }, [bankAccountId, recons]);

  // Close modal on backdrop click
  function handleBackdropClick(e) {
    if (e.target === modalRef.current) {
      setShowModal(false);
    }
  }

  async function create(e) {
    e.preventDefault();
    if (!bankAccountId || !statementFrom || !statementTo) {
      toast.error("Bank Account, Statement From and Statement To are required");
      return;
    }
    try {
      setCreating(true);
      const res = await api.post("/finance/bank-reconciliations", {
        bankAccountId: Number(bankAccountId),
        statementFrom,
        statementTo,
        statementEndingBalance: endingBalance ? Number(endingBalance) : 0,
        status: "DRAFT",
      });
      toast.success("Reconciliation created");
      setShowModal(false);
      navigate(`/finance/bank-reconciliation/${res.data.id}`);
    } catch (e2) {
      toast.error(
        e2?.response?.data?.message || "Failed to create reconciliation",
      );
    } finally {
      setCreating(false);
    }
  }

  async function confirmReconciliation(recon) {
    if (
      !window.confirm(
        `Confirm reconciliation for period ${recon.statement_from?.slice(0, 10)} to ${recon.statement_to?.slice(0, 10)}? This will mark it as Completed and lock it.`,
      )
    )
      return;
    try {
      setConfirmingId(recon.id);
      await api.post(`/finance/bank-reconciliations/${recon.id}/confirm`);
      toast.success("Reconciliation confirmed successfully");
      load();
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to confirm reconciliation",
      );
    } finally {
      setConfirmingId(null);
    }
  }

  function statusBadge(status) {
    if (status === "COMPLETED")
      return <span className="badge badge-sm badge-success">Completed</span>;
    if (status === "PENDING")
      return <span className="badge badge-sm badge-warning">Pending</span>;
    return <span className="badge badge-sm badge-info">Draft</span>;
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header bar */}
      <div className="flex justify-between items-center bg-brand p-4 text-white rounded-lg shadow-md">
        <div>
          <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
          <p className="text-sm opacity-90">
            Manage and create bank reconciliations
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/finance?section=Banking"
            className="font-sans btn btn-sm btn-outline text-white border-white hover:bg-white/20"
          >
            Return to Menu
          </Link>
          <button
            onClick={load}
            className="btn btn-sm btn-outline text-white border-white hover:bg-white/20"
          >
            Refresh
          </button>
          <button
            id="btn-start-reconciliation"
            onClick={() => setShowModal(true)}
            className="btn btn-sm btn-success text-white"
          >
            + Start Reconciliation
          </button>
        </div>
      </div>

      {/* Existing Reconciliations table */}
      <div className="card bg-base-100 shadow-xl border border-slate-200">
        <div className="card-header bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold">Existing Reconciliations</h2>
          <span className="text-sm text-slate-500">
            {recons.length} record{recons.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="card-body p-0 overflow-x-auto">
          <div className="flex justify-end mb-4">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
          </div>
          <table className={"table table-zebra w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left text-xs font-bold uppercase">Bank</th>
                <th className="text-left text-xs font-bold uppercase">Account No</th>
                <th className="text-left text-xs font-bold uppercase">Period</th>
                <th className="text-right text-xs font-bold uppercase">
                  Ending Balance
                </th>
                <th className="text-left text-xs font-bold uppercase">Status</th>
                <th className="text-right text-xs font-bold uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8">
                    <span className="loading loading-spinner loading-md"></span>
                  </td>
                </tr>
              ) : recons.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-8 text-slate-500 italic"
                  >
                    No reconciliations found. Click &ldquo;Start
                    Reconciliation&rdquo; to create one.
                  </td>
                </tr>
              ) : (
                recons.map((r) => {
                  const bankAccount = bankAccounts.find(
                    (b) => String(b.id) === String(r.bank_account_id),
                  );
                  const isCompleted = r.status === "COMPLETED";
                  const isConfirming = confirmingId === r.id;
                  return (
                    <tr key={r.id} className="hover">
                      <td className="font-medium text-sm">
                        {bankAccount?.bank_name ||
                          bankAccount?.name ||
                          r.bank_account_name ||
                          "-"}
                      </td>
                      <td className="text-sm font-mono">
                        {bankAccount?.account_number || "-"}
                      </td>
                      <td className="text-sm">
                        {r.statement_from?.slice(0, 10)} to{" "}
                        {r.statement_to?.slice(0, 10)}
                      </td>
                      <td className="text-right text-sm font-mono">
                        {Number(
                          r.statement_ending_balance || 0,
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td>{statusBadge(r.status)}</td>
                      <td className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {/* View (read-only) */}
                          <Link
                            to={`/finance/bank-reconciliation/${r.id}?mode=view`}
                            className="btn btn-xs btn-outline btn-info text-white hover:text-white"
                          >
                            View
                          </Link>
                          {/* Edit (only when not completed) */}
                          {!isCompleted && (
                            <Link
                              to={`/finance/bank-reconciliation/${r.id}`}
                              className="btn btn-xs btn-primary"
                            >
                              Edit
                            </Link>
                          )}
                          {/* Confirm (only when DRAFT) */}
                          {!isCompleted && (
                            <button
                              className="btn btn-xs btn-success"
                              disabled={isConfirming}
                              onClick={() => confirmReconciliation(r)}
                            >
                              {isConfirming ? (
                                <span className="loading loading-spinner loading-xs"></span>
                              ) : (
                                "Confirm"
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Reconciliation Modal */}
      {showModal && (
        <div
          ref={modalRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleBackdropClick}
        >
          <div className="card bg-base-100 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md mx-4 animate-[fadeIn_0.2s_ease]">
            {/* Modal header */}
            <div className="card-header flex justify-between items-center px-6 py-4 bg-slate-50 border-b border-slate-200 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  New Reconciliation
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fill in the details to start a new bank reconciliation
                </p>
              </div>
              <button
                className="btn btn-sm btn-ghost btn-circle text-slate-500 hover:text-slate-800"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={create} className="card-body p-6 space-y-4">
              {/* Bank Account */}
              <div className="form-control">
                <label className="label text-xs font-bold text-slate-500 uppercase pb-1">
                  Bank Account <span className="text-error">*</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  required
                >
                  <option value="">-- Select Bank --</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.account_number})
                    </option>
                  ))}
                </select>
              </div>

              {/* Opening Balance (read-only) */}
              <div className="form-control">
                <label className="label text-xs font-bold text-slate-500 uppercase pb-1">
                  Opening Balance
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full bg-slate-50 font-mono text-slate-600"
                  value={openingBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                  readOnly
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Carried forward from the last completed reconciliation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Statement From */}
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase pb-1">
                    From <span className="text-error">*</span>
                  </label>
                  <input
                    type="date"
                    className={`input input-bordered w-full ${isFromLocked ? "bg-blue-50 border-blue-300" : ""}`}
                    value={statementFrom}
                    onChange={(e) =>
                      !isFromLocked && setStatementFrom(e.target.value)
                    }
                    readOnly={isFromLocked}
                    required
                  />
                </div>

                {/* Statement To */}
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase pb-1">
                    To <span className="text-error">*</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered w-full"
                    value={statementTo}
                    onChange={(e) => setStatementTo(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Ending Balance */}
              <div className="form-control">
                <label className="label text-xs font-bold text-slate-500 uppercase pb-1">
                  Ending Balance (Bank Statement)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input input-bordered w-full"
                  value={endingBalance}
                  onChange={(e) => setEndingBalance(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-create-reconciliation"
                  className="btn btn-success flex-1"
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Creating…
                    </>
                  ) : (
                    "Start Reconciliation"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
