/**
 * @fileoverview BankReconciliationTransactionReportPage component.
 * Provides functionality for BankReconciliationTransactionReportPage.
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import * as XLSX from "xlsx";
import PrintPreviewModal from "../../../../../components/PrintPreviewModal.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function BankReconciliationTransactionReportPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [filters, setFilters] = useState({
    bankAccountId: "",
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    reconciled: "both",
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [company, setCompany] = useState(null);

  useEffect(() => {
    (async () => {
      // Load bank accounts (required)
      try {
        const baRes = await api.get("/finance/bank-accounts");
        setBankAccounts(baRes.data?.items || []);
      } catch (e) {
        toast.error("Failed to load bank accounts");
      }
      // Load company info (optional - used for print header only)
      try {
        const coRes = await api.get("/admin/companies/current");
        setCompany(coRes.data?.item || null);
      } catch {
        // Non-critical; company info is only used for print/export headers
      }
    })();
  }, []);

  useEffect(() => {
    if (filters.bankAccountId) {
      fetchReport();
    }
  }, [filters]);

  async function fetchReport() {
    if (!filters.bankAccountId) {
      return;
    }
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/bank-reconciliation", {
        params: filters,
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  async function handlePrint() {
    if (items.length === 0) {
      toast.warning("No data to print");
      return;
    }
    try {
      const bankAccount = bankAccounts.find(
        (b) => String(b.id) === String(filters.bankAccountId),
      );
      const totalDebit = items.reduce(
        (sum, i) => sum + (Number(i.debit) || 0),
        0,
      );
      const totalCredit = items.reduce(
        (sum, i) => sum + (Number(i.credit) || 0),
        0,
      );

      const res = await api.post("/documents/render", {
        type: "bank-reconciliation-report",
        data: {
          company_name: company?.company_name || "Seriana Mart",
          bank_account_name: bankAccount?.name || "N/A",
          account_number: bankAccount?.account_number || "N/A",
          currency_code: bankAccount?.currency_code || "N/A",
          from_date: filters.from,
          to_date: filters.to,
          print_date: new Date().toLocaleString(),
          items: items.map((i) => ({
            voucher_no: i.voucher_no,
            voucher_date: String(i.voucher_date).slice(0, 10),
            narration: i.narration,
            offset_account_name: i.offset_account_name,
            debit: Number(i.debit || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            }),
            credit: Number(i.credit || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            }),
            cheque_no: i.cheque_number || "-",
            cheque_date: i.cheque_date
              ? String(i.cheque_date).slice(0, 10)
              : "-",
            status: i.status,
            status_class: String(i.status).toLowerCase(),
          })),
          total_debit: totalDebit.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          }),
          total_credit: totalCredit.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          }),
          net_movement: (totalDebit - totalCredit).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          }),
        },
      });
      setPreviewHtml(res.data.html);
      setPreviewOpen(true);
    } catch (e) {
      toast.error("Failed to generate print preview");
    }
  }

  function exportToExcel() {
    if (items.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(
      items.map((i) => ({
        "Voucher No": i.voucher_no,
        "Voucher Date": String(i.voucher_date).slice(0, 10),
        Description: i.narration,
        "Offset Account": i.offset_account_name,
        Debit: i.debit,
        Credit: i.credit,
        "Cheque No": i.cheque_number,
        "Cheque Date": i.cheque_date ? String(i.cheque_date).slice(0, 10) : "",
        Status: i.status,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bank Recon");
    XLSX.writeFile(wb, "bank_reconciliation_report.xlsx");
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center bg-brand p-4 text-white rounded-lg shadow-md">
        <div>
          <h1 className="text-2xl font-bold">Bank Reconciliation Report</h1>
          <p className="text-sm opacity-90">
            Detailed bank transactions and reconciliation status
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.history.back()} className="font-sans btn btn-sm btn-outline text-white border-white hover:bg-white/20"
          >
            Back to Finance
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-sm bg-white/20 hover:bg-white/30 border-none text-white backdrop-blur-sm"
          >
            Print / PDF
          </button>
          <button
            onClick={exportToExcel}
            className="btn btn-sm bg-white/20 hover:bg-white/30 border-none text-white backdrop-blur-sm"
          >
            Excel
          </button>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl border border-slate-200">
        <div className="card-body p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="form-control">
              <label className="label text-xs font-bold text-slate-500 uppercase">
                Bank Account
              </label>
              <select
                className="select select-bordered w-full"
                value={filters.bankAccountId}
                onChange={(e) =>
                  setFilters({ ...filters, bankAccountId: e.target.value })
                }
              >
                <option value="">-- Select Bank --</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.account_number})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label text-xs font-bold text-slate-500 uppercase">
                From Date
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={filters.from}
                onChange={(e) =>
                  setFilters({ ...filters, from: e.target.value })
                }
              />
            </div>
            <div className="form-control">
              <label className="label text-xs font-bold text-slate-500 uppercase">
                To Date
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-outline w-full"
                onClick={exportToExcel}
                disabled={items.length === 0}
              >
                Export Excel
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-6 items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-xs font-bold text-slate-500 uppercase">
              Status Filter:
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reconciled"
                className="radio radio-primary radio-sm"
                checked={filters.reconciled === "reconciled"}
                onChange={() =>
                  setFilters({ ...filters, reconciled: "reconciled" })
                }
              />
              <span className="text-sm font-medium">Reconciled Only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reconciled"
                className="radio radio-primary radio-sm"
                checked={filters.reconciled === "not_reconciled"}
                onChange={() =>
                  setFilters({ ...filters, reconciled: "not_reconciled" })
                }
              />
              <span className="text-sm font-medium">
                Not Reconciled (Unpresented/Uncleared)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reconciled"
                className="radio radio-primary radio-sm"
                checked={filters.reconciled === "both"}
                onChange={() => setFilters({ ...filters, reconciled: "both" })}
              />
              <span className="text-sm font-medium">Both</span>
            </label>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl border border-slate-200">
        <div className="card-body p-0 overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-xs font-bold uppercase">Voucher No</th>
                <th className="text-xs font-bold uppercase">Date</th>
                <th className="text-xs font-bold uppercase">Narration</th>
                <th className="text-right text-xs font-bold uppercase">
                  Debit
                </th>
                <th className="text-right text-xs font-bold uppercase">
                  Credit
                </th>
                <th className="text-xs font-bold uppercase">Cheque No</th>
                <th className="text-xs font-bold uppercase">Cheque Date</th>
                <th className="text-xs font-bold uppercase">Offset Account</th>
                <th className="text-xs font-bold uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="text-center py-8 text-slate-500 italic"
                  >
                    {loading
                      ? "Fetching data..."
                      : "No transactions found. Please adjust filters and run report."}
                  </td>
                </tr>
              ) : (
                items.map((i, idx) => (
                  <tr key={idx} className="hover">
                    <td className="text-sm font-medium">{i.voucher_no}</td>
                    <td className="text-sm">
                      {String(i.voucher_date).slice(0, 10)}
                    </td>
                    <td
                      className="text-sm max-w-xs truncate"
                      title={i.narration}
                    >
                      {i.narration}
                    </td>
                    <td className="text-right text-sm font-mono">
                      {i.debit
                        ? Number(i.debit).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })
                        : "-"}
                    </td>
                    <td className="text-right text-sm font-mono">
                      {i.credit
                        ? Number(i.credit).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })
                        : "-"}
                    </td>
                    <td className="text-sm font-mono">
                      {i.cheque_number || "-"}
                    </td>
                    <td className="text-sm">
                      {i.cheque_date ? String(i.cheque_date).slice(0, 10) : "-"}
                    </td>
                    <td className="text-sm">{i.offset_account_name}</td>
                    <td className="text-left">
                      <span
                        className={`badge badge-sm font-bold ${
                          i.status === "Reconciled"
                            ? "badge-success"
                            : i.status === "Unpresented"
                              ? "badge-warning"
                              : "badge-info"
                        }`}
                      >
                        {i.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <PrintPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        html={previewHtml}
        title="Bank Reconciliation Report"
      />
    </div>
  );
}
