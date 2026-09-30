/**
 * @fileoverview PdcPostingForm component.
 * Provides functionality for PdcPostingForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PdcPostingForm() {
  const { hasExceptional } = usePermission();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [draft, setDraft] = useState({});
  const [vouchers, setVouchers] = useState([]);
  const [voucherSearch, setVoucherSearch] = useState("");

  async function load() {
    try {
      setLoading(true);
      const [pRes, baRes] = await Promise.all([
        api.get("/finance/pdc-postings"),
        api.get("/finance/bank-accounts"),
      ]);
      const found = (pRes.data?.items || []).find(
        (x) => Number(x.id) === Number(id)
      );
      setItem(found || null);
      setDraft({});
      setBankAccounts(baRes.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load PDC");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

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

  async function save() {
    if (
      (draft.instrument_date !== undefined &&
        !String(draft.instrument_date).trim()) ||
      (!item?.instrument_date && draft.instrument_date === undefined)
    ) {
      toast.error("Instrument Date is required");
      return;
    }
    const effVoucherId =
      draft.voucher_id === undefined || draft.voucher_id === ""
        ? item?.voucher_id
        : Number(draft.voucher_id);
    const effInstrumentDate =
      draft.instrument_date === undefined ||
      !String(draft.instrument_date).trim()
        ? item?.instrument_date
        : draft.instrument_date;
    if (effVoucherId && effInstrumentDate) {
      const v = vouchers.find((x) => Number(x.id) === Number(effVoucherId));
      if (v) {
        const iDate = new Date(effInstrumentDate);
        const vDate = new Date(v.voucher_date);
        if (iDate < vDate) {
          toast.error("Instrument Date must be on or after voucher date");
          return;
        }
      }
    }
    try {
      await api.put(`/finance/pdc-postings/${id}`, {
        voucherId:
          draft.voucher_id === undefined ? undefined : Number(draft.voucher_id),
        instrumentNo: draft.instrument_no || undefined,
        instrumentDate: draft.instrument_date || undefined,
        bankAccountId:
          draft.bank_account_id === undefined
            ? undefined
            : draft.bank_account_id
            ? Number(draft.bank_account_id)
            : null,
        status: draft.status || undefined,
      });
      toast.success("PDC updated");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update PDC");
    }
  }

  if (!item && !loading) {
    return (
      <div className="p-4">
        <div className="alert alert-error shadow-lg">
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>PDC Posting not found or has been deleted.</span>
          </div>
        </div>
        <button onClick={() => window.history.back()} className="btn btn-primary mt-6">
          Back to PDC Registry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center bg-brand p-6 text-white rounded-xl shadow-lg">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Edit PDC Posting
          </h1>
          <p className="text-blue-100 mt-1 font-medium">
            Instrument: {item?.instrument_no} | Status: {item?.status}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.history.back()} className="btn btn-sm bg-white/20 hover:bg-white/30 border-none text-white backdrop-blur-sm"
          >
            Back to List
          </button>
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
        </div>
      </div>

      {item && (
        <div className="card bg-base-100 shadow-xl border border-slate-200">
          <div className="card-header bg-slate-50 p-4 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-700">Posting Details</h2>
          </div>
          <div className="card-body p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="form-control">
                <label className="label text-xs font-bold text-slate-500 uppercase">
                  Voucher Search
                </label>
                <input
                  className="input input-bordered w-full"
                  placeholder="Search voucher no..."
                  value={voucherSearch}
                  onChange={(e) => setVoucherSearch(e.target.value)}
                />
              </div>
              <div className="form-control">
                <label className="label text-xs font-bold text-slate-500 uppercase">
                  Voucher *
                </label>
                <select
                  className="select select-bordered w-full"
                  value={
                    draft.voucher_id === undefined
                      ? item.voucher_id ?? ""
                      : draft.voucher_id
                  }
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, voucher_id: e.target.value }))
                  }
                >
                  <option value="">-- Select Voucher --</option>
                  {(voucherSearch
                    ? vouchers.filter((v) =>
                        String(v.voucher_no || "")
                          .toLowerCase()
                          .includes(voucherSearch.toLowerCase())
                      )
                    : vouchers
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
                <label className="label text-xs font-bold text-slate-500 uppercase">
                  Cheque No *
                </label>
                <input
                  className="input input-bordered w-full"
                  value={
                    draft.instrument_no === undefined
                      ? item.instrument_no ?? ""
                      : draft.instrument_no
                  }
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, instrument_no: e.target.value }))
                  }
                  placeholder="Cheque / Reference No."
                />
              </div>
              <div className="form-control">
                <label className="label text-xs font-bold text-slate-500 uppercase">
                  Cheque Date *
                </label>
                <input
                  className="input input-bordered w-full"
                  type="date"
                  value={
                    draft.instrument_date === undefined
                      ? item.instrument_date?.slice(0, 10)
                      : draft.instrument_date
                  }
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, instrument_date: e.target.value }))
                  }
                
                  disabled={!!id && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div className="form-control">
                <label className="label text-xs font-bold text-slate-500 uppercase">
                  Bank Account
                </label>
                <select
                  className="select select-bordered w-full"
                  value={
                    draft.bank_account_id === undefined
                      ? item.bank_account_id ?? ""
                      : draft.bank_account_id
                  }
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, bank_account_id: e.target.value }))
                  }
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
                <label className="label text-xs font-bold text-slate-500 uppercase">
                  Status
                </label>
                <select
                  className="select select-bordered w-full"
                  value={
                    draft.status === undefined ? item.status : draft.status
                  }
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, status: e.target.value }))
                  }
                >
                  <option value="HELD">Held</option>
                  <option value="POSTED">Posted</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => window.history.back()} className="btn btn-outline">
                Cancel
              </button>
              <button className="btn btn-success text-white px-8" onClick={save}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
