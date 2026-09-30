/**
 * @fileoverview PdcPostingsList component.
 * Provides functionality for PdcPostingsList.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PdcPostingsList() {
  const [viewMode, setViewMode] = useViewMode();
  const [items, setItems] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fltStatus, setFltStatus] = useState("ALL");
  const [fltBank, setFltBank] = useState("");
  const [fltFrom, setFltFrom] = useState("");
  const [fltTo, setFltTo] = useState("");

  const [voucherId, setVoucherId] = useState("");
  const [instrumentNo, setInstrumentNo] = useState("");
  const [instrumentDate, setInstrumentDate] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [vouchers, setVouchers] = useState([]);
  const [voucherSearch, setVoucherSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const params = {};
      if (fltStatus && fltStatus !== "ALL") params.status = fltStatus;
      if (fltBank) params.bankAccountId = fltBank;
      if (fltFrom) params.from = fltFrom;
      if (fltTo) params.to = fltTo;

      const [pRes, baRes] = await Promise.all([
        api.get("/finance/pdc-postings", { params }),
        api.get("/finance/bank-accounts"),
      ]);
      setItems(pRes.data?.items || []);
      setBankAccounts(baRes.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load PDCs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [fltStatus, fltBank, fltFrom, fltTo]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/finance/vouchers");
        setVouchers(res.data?.items || []);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!voucherId) {
      toast.error("Voucher ID is required");
      return;
    }
    if (!instrumentNo.trim()) {
      toast.error("Instrument No. is required");
      return;
    }
    if (!instrumentDate) {
      toast.error("Instrument Date is required");
      return;
    }
    const v = vouchers.find((x) => Number(x.id) === Number(voucherId));
    if (v) {
      const iDate = new Date(instrumentDate);
      const vDate = new Date(v.voucher_date);
      if (iDate < vDate) {
        toast.error("Instrument Date must be on or after voucher date");
        return;
      }
    }
    try {
      await api.post("/finance/pdc-postings", {
        voucherId: Number(voucherId),
        instrumentNo: instrumentNo.trim(),
        instrumentDate,
        bankAccountId: bankAccountId ? Number(bankAccountId) : undefined,
      });
      toast.success("PDC created");
      setShowModal(false);
      setVoucherId("");
      setInstrumentNo("");
      setInstrumentDate("");
      setBankAccountId("");
      load();
    } catch (e) {
      toast.error(e2?.response?.data?.message || "Failed to create PDC");
    }
  }

  async function updateStatus(r, nextStatus) {
    if (!window.confirm(`Change status to ${nextStatus}?`)) return;
    try {
      await api.put(`/finance/pdc-postings/${r.id}`, {
        status: nextStatus,
      });
      toast.success("Status updated");
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to update status");
    }
  }

  async function deletePdc(r) {
    if (!window.confirm("Delete this PDC?")) return;
    try {
      await api.delete(`/finance/pdc-postings/${r.id}`);
      toast.success("PDC deleted");
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to delete PDC");
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center bg-brand p-6 text-white rounded-xl shadow-lg">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Post-Dated Cheques (PDC)
          </h1>
          <p className="text-blue-100 mt-1 font-medium">
            Register and manage PDC postings across all bank accounts
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/finance?section=Banking"
            className="font-sans btn btn-sm bg-white/20 hover:bg-white/30 border-none text-white backdrop-blur-sm"
          >
            Return to Menu
          </Link>
          <button
            className="btn btn-sm bg-white/20 hover:bg-white/30 border-none text-white backdrop-blur-sm"
            disabled={loading}
            onClick={load}
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              "Refresh"
            )}
          </button>
          <button
            className="btn btn-sm btn-success text-white border-none shadow-md"
            onClick={() => setShowModal(true)}
          >
            Add PDC Posting
          </button>
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="card bg-base-100 rounded-3xl shadow-2xl border border-slate-200 w-11/12 max-w-4xl min-h-[60vh] mx-4 animate-[fadeIn_0.2s_ease] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header flex justify-between items-center px-8 py-5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  New PDC Posting
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Fill in the details to add a new PDC posting
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="btn btn-sm btn-ghost btn-circle text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={create} className="p-8 space-y-6 bg-base-100 flex-1 flex flex-col justify-between">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase pb-1">
                    Voucher <span className="text-error">*</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={voucherId}
                    onChange={(e) => setVoucherId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Voucher --</option>
                    {(voucherSearch
                      ? vouchers.filter((v) =>
                          String(v.voucher_no || "")
                            .toLowerCase()
                            .includes(voucherSearch.toLowerCase()),
                        )
                      : vouchers
                    )
                      .filter(
                        (v) =>
                          v.voucher_type_code === "PV" ||
                          v.voucher_type_code === "RV" ||
                          v.voucher_type_code === "BPV" ||
                          v.voucher_type_code === "BRV"
                      )
                      .slice(0, 50)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.voucher_no} ({v.voucher_type_code})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase pb-1">
                    Bank Account
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                  >
                    <option value="">-- Select Bank --</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.account_number || "No Acc"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase pb-1">
                    Cheque No <span className="text-error">*</span>
                  </label>
                  <input
                    className="input input-bordered w-full"
                    value={instrumentNo}
                    onChange={(e) => setInstrumentNo(e.target.value)}
                    placeholder="Cheque / Reference No."
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label text-xs font-bold text-slate-500 uppercase pb-1">
                    Cheque Date <span className="text-error">*</span>
                  </label>
                  <input
                    className="input input-bordered w-full"
                    type="date"
                    value={instrumentDate}
                    onChange={(e) => setInstrumentDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4 mt-6 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="btn btn-outline flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-success flex-1 text-white">
                  Add PDC Posting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="card bg-base-100 shadow-xl border border-slate-200 overflow-hidden">
          <div className="card-header bg-slate-50 p-4 border-b border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-slate-700">
                  PDC Registry
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      From:
                    </span>
                    <input
                      type="date"
                      className="input input-bordered input-xs dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                      value={fltFrom}
                      onChange={(e) => setFltFrom(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      To:
                    </span>
                    <input
                      type="date"
                      className="input input-bordered input-xs dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                      value={fltTo}
                      onChange={(e) => setFltTo(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Bank:
                    </span>
                    <select
                      className="select select-bordered select-xs dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                      value={fltBank}
                      onChange={(e) => setFltBank(e.target.value)}
                    >
                      <option value="">All Banks</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Status:
                    </span>
                    <select
                      className="select select-bordered select-xs dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                      value={fltStatus}
                      onChange={(e) => setFltStatus(e.target.value)}
                    >
                      <option value="ALL">All Status</option>
                      <option value="HELD">Held</option>
                      <option value="POSTED">Posted</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-body p-0">
              
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
                <table className={ "table table-zebra w-full " + (viewMode === 'grid' ? 'table-grid-mode' : '') }>
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-xs font-bold uppercase">
                        Cheque Number
                      </th>
                      <th className="text-xs font-bold uppercase">Date</th>
                      <th className="text-xs font-bold uppercase">
                        Bank Account
                      </th>
                      <th className="text-xs font-bold uppercase">Voucher</th>
                      <th className="text-xs font-bold uppercase">
                        Created Date
                      </th>
                      <th className="text-xs font-bold uppercase">
                        Created By
                      </th>
                      <th className="text-xs font-bold uppercase text-center">
                        Status
                      </th>
                      <th className="text-xs font-bold uppercase text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {items.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td>
                          <div className="font-bold text-slate-700">
                            {r.instrument_no}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase">
                            ID: {r.id}
                          </div>
                        </td>
                        <td className="font-medium text-slate-600">
                          {String(r.instrument_date).slice(0, 10)}
                        </td>
                        <td className="text-slate-600 italic">
                          {r.bank_account_name || "-"}
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span className="badge badge-outline badge-sm font-semibold">
                              {r.voucher_no || "-"}
                            </span>
                            {r.voucher_type_code && (
                              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                                {r.voucher_type_code === 'PV' || r.voucher_type_code === 'BPV' ? 'Payment' : r.voucher_type_code === 'RV' || r.voucher_type_code === 'BRV' ? 'Receipt' : r.voucher_type_code}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-xs text-slate-500">
                          {r.created_at
                            ? new Date(r.created_at).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="text-xs text-slate-500">
                          {r.creator_username || "-"}
                        </td>
                        <td className="text-center">
                          <span
                            className={`badge badge-sm font-bold ${
                              r.status === "POSTED"
                                ? "badge-success"
                                : r.status === "CANCELLED"
                                  ? "badge-error"
                                  : "badge-warning"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <Link
                              to={`/finance/pdc-postings/${r.id}`}
                              className="btn btn-ghost btn-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-700 font-bold"
                            >
                              Edit
                            </Link>
                            {r.status === "HELD" && (
                              <>
                                <button
                                  className="btn btn-ghost btn-xs text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-slate-700 font-bold"
                                  onClick={() => updateStatus(r, "POSTED")}
                                  title="Post PDC"
                                >
                                  Post
                                </button>
                                <button
                                  className="btn btn-ghost btn-xs text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-slate-700 font-bold"
                                  onClick={() => updateStatus(r, "CANCELLED")}
                                  title="Cancel PDC"
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn btn-ghost btn-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-slate-700"
                                  onClick={() => deletePdc(r)}
                                  title="Delete PDC"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="text-center py-12">
                          <div className="flex flex-col items-center text-slate-400">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-12 w-12 mb-2 opacity-20"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                              />
                            </svg>
                            <span className="font-medium italic">
                              No PDCs found for the current filter
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
