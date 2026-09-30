/**
 * @fileoverview DebtorsLedgerReportPage component.
 * Standard Modern UI Debtors Ledger report for tracking customer balances & receivables.
 */

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { api } from "api/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import {
  fetchReportHeader,
  applyPdfHeader,
  applyPdfFooter,
  buildExcelHeaderRows,
} from "../../../../utils/pdfUtils.js";
import { filterAndSort } from "../../../../utils/searchUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  FileText, 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Users,
  RefreshCw,
  Hash
} from "lucide-react";

export default function DebtorsLedgerReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, []);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountInputRef = useRef(null);
  const accountDropdownRef = useRef(null);

  const filteredAccounts = useMemo(() => {
    const debtorsAccounts = (accounts || []).filter((a) => {
      const gCode = String(a.group_code || "").toUpperCase();
      const gName = String(a.group_name || "").toUpperCase();
      const nature = String(a.nature || a.group_nature || "").toUpperCase();
      return (
        nature === "ASSET" ||
        gCode === "DEBTORS" ||
        gCode === "AR" ||
        gName.includes("DEBTOR") ||
        gName.includes("CUSTOMER") ||
        gName.includes("RECEIVABLE")
      );
    });
    return filterAndSort(debtorsAccounts, {
      query: accountQuery,
      getKeys: (a) => [a.code, a.name],
    });
  }, [accounts, accountQuery]);

  const selectedAccountLabel = useMemo(() => {
    const hit = (accounts || []).find((a) => String(a.id) === String(accountId || ""));
    return hit ? `${hit.code ? hit.code + " - " : ""}${hit.name || ""}` : "";
  }, [accounts, accountId]);

  const handleSelectAccount = useCallback((id, name, code) => {
    setAccountId(String(id));
    setAccountQuery(code ? `${code} - ${name}` : String(name || ""));
    setAccountDropdownOpen(false);
  }, []);

  const handleAccountInputChange = useCallback((value) => {
    setAccountQuery(value);
    setAccountDropdownOpen(true);
    if (!String(value || "").trim()) {
      setAccountId("");
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(e.target) &&
        accountInputRef.current &&
        !accountInputRef.current.contains(e.target)
      ) {
        setAccountDropdownOpen(false);
        const v = String(accountQuery || "").trim().toLowerCase();
        if (!v) {
          setAccountId("");
          return;
        }
        const hit = (filteredAccounts || []).find((a) => {
          const label = `${a.name}`.toLowerCase();
          const code = String(a.code || "").toLowerCase();
          return label === v || code === v;
        });
        if (!hit && selectedAccountLabel) {
          setAccountQuery(selectedAccountLabel);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountQuery, filteredAccounts, selectedAccountLabel, pollingCounter]);

  async function loadAccounts() {
    try {
      const res = await api.get("/finance/accounts", {
        params: { active: 1 },
      });
      setAccounts(res.data?.items || []);
    } catch {
      toast.error("Failed to load customer accounts");
    }
  }

  useEffect(() => {
    loadAccounts();
  }, [pollingCounter]);

  const totals = useMemo(() => {
    const debit = items.reduce((sum, r) => sum + Number(r.debit || 0), 0);
    const credit = items.reduce((sum, r) => sum + Number(r.credit || 0), 0);
    const balance = debit - credit;
    return { debit, credit, balance };
  }, [items]);

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(items, "voucher_date", "desc");

  async function run() {
    try {
      setLoading(true);
      const params = { from: from || null, to: to || null };
      if (accountId) params.accountId = accountId;
      const res = await api.get("/finance/reports/debtors-ledger", { params });
      const rows = res.data?.items || [];
      const openRow = rows.length && rows[0]?.doc_no === "OPEN" ? rows[0] : null;
      const body = openRow ? rows.slice(1) : rows;
      setItems(openRow ? [openRow, ...body] : body);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load debtors report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const today = new Date();
    const year = today.getFullYear();
    const jan1 = new Date(year, 0, 1);
    setFrom(jan1.toISOString().slice(0, 10));
    setTo(today.toISOString().slice(0, 10));
    run();
  }, [pollingCounter]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, accountId, pollingCounter]);

  const handleExportExcel = async () => {
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) return;
    const headerInfo = await fetchReportHeader(api);
    const selectedAcc = accounts.find((a) => String(a.id) === String(accountId));
    const accTitle = selectedAcc ? `Customer: ${selectedAcc.code} - ${selectedAcc.name}` : "All Debtors";
    const headerRows = buildExcelHeaderRows(headerInfo, {
      title: `DEBTORS LEDGER REPORT (${accTitle})`,
      period: `${from || "Beginning"} to ${to || "Today"}`,
    });
    const ws = XLSX.utils.json_to_sheet([...headerRows, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DebtorsLedger");
    XLSX.writeFile(wb, `debtors-ledger-${headerInfo.currCode}-${from || "all"}-to-${to || "today"}.xlsx`);
  };

  const handleExportPDF = async () => {
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) return;
    const headerInfo = await fetchReportHeader(api);
    const doc = new jsPDF("p", "mm", "a4");
    const margin = 14;
    const pageW = 210;

    const selectedAcc = accounts.find((a) => String(a.id) === String(accountId));
    const accTitle = selectedAcc ? `Customer: ${selectedAcc.code} - ${selectedAcc.name}` : "All Debtors";

    let y = applyPdfHeader(doc, headerInfo, {
      title: "DEBTORS LEDGER REPORT",
      subtitle: `${accTitle}   |   Period: ${from || "Beginning"} to ${to || "Today"}`,
      kpis: [
        { label: "OPENING BALANCE", value: `${headerInfo.currPrefix}${Number(openingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: [59, 130, 246] },
        { label: "TOTAL TRANSACTIONS", value: `${rows.length}`, color: [16, 185, 129] },
      ],
    });

    // Table header
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, pageW - margin * 2, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("DATE", margin + 2, y + 4.2);
    doc.text("DOC NO", 38, y + 4.2);
    doc.text("DESCRIPTION", 75, y + 4.2);
    doc.text(`DEBIT (${headerInfo.currCode})`, 135, y + 4.2, { align: "right" });
    doc.text(`CREDIT (${headerInfo.currCode})`, 162, y + 4.2, { align: "right" });
    doc.text(`BALANCE (${headerInfo.currCode})`, pageW - margin - 2, y + 4.2, { align: "right" });
    y += 8.5;
    doc.setTextColor(51, 65, 85);

    let running = Number(openingBalance || 0);
    rows.forEach((r) => {
      if (y > 270) {
        doc.addPage();
        y = 15;
      }
      const dt = r.txn_date ? new Date(r.txn_date).toLocaleDateString() : "-";
      const docno = String(r.doc_no || "-");
      const desc = String(r.description || "-").slice(0, 32);
      const dr = Number(r.debit || 0);
      const cr = Number(r.credit || 0);
      running += dr - cr;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(dt, margin + 2, y);
      doc.text(docno, 38, y);
      doc.text(desc, 75, y);
      doc.text(dr > 0 ? dr.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—", 135, y, { align: "right" });
      doc.text(cr > 0 ? cr.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—", 162, y, { align: "right" });
      doc.text(running.toLocaleString(undefined, { minimumFractionDigits: 2 }), pageW - margin - 2, y, { align: "right" });
      y += 4.5;
    });

    applyPdfFooter(doc);
    doc.save(`debtors-ledger-${headerInfo.currCode}-${from || "all"}-to-${to || "today"}.pdf`);
  };

  let cumulativeBalance = 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Card */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <Link
                to="/finance?section=Reports%20%26%20Analysis"
                className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors mb-1"
              >
                <ArrowLeft size={14} /> Back to Finance
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-7 h-7" /> Debtors Ledger
              </h1>
              <p className="text-sm mt-0.5 opacity-90">
                Customer ledger movements, receivables tracking and running balance statement
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={run}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={!items.length}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={!items.length}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <TrendingUp size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Debit</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              GHS {totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
            <TrendingDown size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Credit</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              GHS {totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Wallet size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Net Closing Balance</p>
            <h3 className={`text-xl font-bold mt-0.5 ${totals.balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              GHS {Math.abs(totals.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
            <Hash size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Entries</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {items.length} Transactions
            </h3>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <Filter size={16} className="text-brand" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Report Parameters & Filter
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Account Search Dropdown */}
          <div className="md:col-span-6">
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5 block">
              Customer / Debtor Account
            </label>
            <div className="relative">
              <div className="relative">
                <input
                  ref={accountInputRef}
                  className="input w-full pl-9 pr-4 text-sm"
                  placeholder={accountId ? selectedAccountLabel || "Search debtor account..." : "All Debtor Accounts (Type to filter...)"}
                  value={accountQuery}
                  onChange={(e) => handleAccountInputChange(e.target.value)}
                  onFocus={() => setAccountDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filteredAccounts.length > 0) {
                      const first = filteredAccounts[0];
                      handleSelectAccount(first.id, first.name, first.code);
                    }
                    if (e.key === "Escape") setAccountDropdownOpen(false);
                  }}
                  autoComplete="off"
                />
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              </div>

              {accountDropdownOpen && filteredAccounts.length > 0 && (
                <div
                  ref={accountDropdownRef}
                  className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-56 overflow-auto"
                >
                  {filteredAccounts.slice(0, 25).map((a) => {
                    const q = String(accountQuery || "").trim().toLowerCase();
                    const name = String(a.name || "");
                    const idx = q ? name.toLowerCase().indexOf(q) : -1;
                    return (
                      <button
                        type="button"
                        key={a.id}
                        className="block w-full text-left px-3.5 py-2.5 hover:bg-brand/10 dark:hover:bg-brand/20 text-sm border-b border-slate-100 dark:border-slate-700/50 last:border-0 transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectAccount(a.id, a.name, a.code);
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {idx >= 0 ? (
                              <>
                                {name.slice(0, idx)}
                                <strong className="text-brand">{name.slice(idx, idx + q.length)}</strong>
                                {name.slice(idx + q.length)}
                              </>
                            ) : (
                              name
                            )}
                          </span>
                          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                            {a.code}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* From Date */}
          <div className="md:col-span-3">
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5 block">
              From Date
            </label>
            <div className="relative">
              <input
                type="date"
                className="input w-full text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
          </div>

          {/* To Date */}
          <div className="md:col-span-3">
            <label className="label font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5 block">
              To Date
            </label>
            <div className="relative">
              <input
                type="date"
                className="input w-full text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="card shadow-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                <SortableHeader label="Date" sortKey="txn_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Voucher / Doc #" sortKey="doc_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Description" sortKey="description" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                <SortableHeader label="Debit (GHS)" sortKey="debit" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                <SortableHeader label="Credit (GHS)" sortKey="credit" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                <th className="text-right py-3 px-4">Running Balance (GHS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    <RefreshCw className="animate-spin w-6 h-6 mx-auto mb-2" />
                    Loading debtors ledger...
                  </td>
                </tr>
              ) : sortedItems.length > 0 ? (
                sortedItems.map((r, i) => {
                  const docNo = r.voucher_no || r.doc_no;
                  const txnDate = r.voucher_date || r.txn_date;
                  const isOpenRow = docNo === "OPEN";
                  const dr = Number(r.debit || 0);
                  const cr = Number(r.credit || 0);

                  if (i === 0) {
                    cumulativeBalance = dr - cr;
                  } else {
                    cumulativeBalance += dr - cr;
                  }

                  return (
                    <tr
                      key={i}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        isOpenRow ? "bg-amber-50/50 dark:bg-amber-950/20 font-semibold" : ""
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {txnDate ? new Date(txnDate).toLocaleDateString() : "—"}
                      </td>

                      {/* Doc No */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                        {isOpenRow ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 rounded font-bold">
                            OPENING BALANCE
                          </span>
                        ) : (
                          <span className="font-semibold text-brand dark:text-brand-300">
                            {docNo || "—"}
                          </span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                        {r.description || "—"}
                      </td>

                      {/* Debit */}
                      <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                        {dr > 0 ? dr.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                      </td>

                      {/* Credit */}
                      <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                        {cr > 0 ? cr.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                      </td>

                      {/* Running Balance */}
                      <td className={`py-3 px-4 text-right font-mono font-bold ${
                        cumulativeBalance < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {Math.abs(cumulativeBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-[10px] ml-1 font-sans text-slate-400">
                          {cumulativeBalance >= 0 ? "Dr" : "Cr"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400 text-sm">
                    No ledger transactions found for the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Table Footer Totals */}
            {sortedItems.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                  <td colSpan="3" className="py-3 px-4 uppercase text-xs tracking-wider">
                    Total Period Summary
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    GHS {totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    GHS {totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-brand dark:text-brand-300">
                    GHS {Math.abs(totals.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
