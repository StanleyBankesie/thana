/**
 * @fileoverview TrialBalanceReportPage component.
 * Provides functionality for TrialBalanceReportPage.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";
import {
  fetchReportHeader,
  applyPdfHeader,
  applyPdfFooter,
  buildExcelHeaderRows,
} from "../../../../utils/pdfUtils.js";

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function TrialBalanceReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [from, setFrom] = useState(() => {
    const qp = new URLSearchParams(window.location.search).get("from");
    if (qp) return qp;
    const today = new Date();
    return new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => {
    const qp = new URLSearchParams(window.location.search).get("to");
    if (qp) return qp;
    return new Date().toISOString().slice(0, 10);
  });
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [controlBreak, setControlBreak] = useState(true);

  function setDatePreset(preset) {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === "today") {
      setFrom(todayStr);
      setTo(todayStr);
    } else if (preset === "month") {
      const startOfMonth = new Date(y, m, 1).toISOString().slice(0, 10);
      setFrom(startOfMonth);
      setTo(todayStr);
    } else if (preset === "quarter") {
      const qStartMonth = Math.floor(m / 3) * 3;
      const startOfQ = new Date(y, qStartMonth, 1).toISOString().slice(0, 10);
      setFrom(startOfQ);
      setTo(todayStr);
    } else if (preset === "year") {
      const startOfYear = new Date(y, 0, 1).toISOString().slice(0, 10);
      setFrom(startOfYear);
      setTo(todayStr);
    } else if (preset === "all") {
      setFrom("");
      setTo("");
    }
  }

  async function run() {
    try {
      setLoading(true);
      const res = await api.get("/finance/reports/trial-balance", {
        params: {
          from: from || null,
          to: to || null,
          groupId: groupId ? Number(groupId) : null,
          accountId: accountId ? Number(accountId) : null,
        },
      });
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  }

  async function loadGroups() {
    try {
      const res = await api.get("/finance/account-groups", {
        params: { active: 1 },
      });
      setGroups(res.data?.items || []);
    } catch {
      setGroups([]);
    }
  }

  async function loadAccounts() {
    try {
      const res = await api.get("/finance/accounts", {
        params: { postable: 1, active: 1 },
      });
      setAccounts(res.data?.items || []);
    } catch {
      setAccounts([]);
    }
  }

  useEffect(() => {
    Promise.all([loadGroups(), loadAccounts()]);
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, groupId, accountId, pollingCounter]);

  // Transform data for new column format
  const transformedItems = items.map((r) => {
    const openingBal = Number(r.opening_debit || 0) - Number(r.opening_credit || 0);
    const closingBal = Number(r.closing_debit || 0) - Number(r.closing_credit || 0);
    return {
      ...r,
      opening_balance: Math.abs(openingBal),
      opening_type: openingBal >= 0 ? "DR" : "CR",
      debit_amount: Number(r.movement_debit || 0),
      credit_amount: Number(r.movement_credit || 0),
      closing_balance: Math.abs(closingBal),
      closing_type: closingBal >= 0 ? "DR" : "CR",
    };
  });

  const totals = transformedItems.reduce(
    (acc, r) => {
      acc.opening_dr += r.opening_type === "DR" ? r.opening_balance : 0;
      acc.opening_cr += r.opening_type === "CR" ? r.opening_balance : 0;
      acc.debit_amount += r.debit_amount;
      acc.credit_amount += r.credit_amount;
      acc.closing_dr += r.closing_type === "DR" ? r.closing_balance : 0;
      acc.closing_cr += r.closing_type === "CR" ? r.closing_balance : 0;
      return acc;
    },
    {
      opening_dr: 0,
      opening_cr: 0,
      debit_amount: 0,
      credit_amount: 0,
      closing_dr: 0,
      closing_cr: 0,
    },
  );

  const { sorted: sortedItems, sortKey, sortDir, toggle } = useSort(transformedItems, "account_code", "asc");

  const groupedItems = React.useMemo(() => {
    if (!controlBreak) return null;
    const groups = {};
    sortedItems.forEach(r => {
      const type = r.account_type || "Unknown Type";
      const cat = r.account_category || "Unknown Category";
      const key = `${type} - ${cat}`;
      if (!groups[key]) groups[key] = { type, cat, rows: [] };
      groups[key].rows.push(r);
    });
    return groups;
  }, [sortedItems, controlBreak]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => window.history.back()} className="font-sans text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Finance
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Trial Balance
          </h1>
          <p className="text-sm mt-1">Debits and credits by account</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div className="w-44">
              <label className="label">From</label>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="w-44">
              <label className="label">To</label>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/30 transition-colors"
                onClick={() => setDatePreset("today")}
              >
                Today
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/30 transition-colors"
                onClick={() => setDatePreset("month")}
              >
                This Month
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/30 transition-colors"
                onClick={() => setDatePreset("quarter")}
              >
                This Quarter
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/30 transition-colors"
                onClick={() => setDatePreset("year")}
              >
                This Year
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/30 transition-colors"
                onClick={() => setDatePreset("all")}
              >
                All Time
              </button>
            </div>
            <div>
              <label className="label">Account Group</label>
              <select
                className="input"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">All Groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Account</label>
              <select
                className="input"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">All Accounts</option>
                {accounts
                  .filter((a) => {
                    if (!groupId) return true;
                    return Number(a.group_id || 0) === Number(groupId);
                  })
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <label className="flex items-center gap-2 mr-4 cursor-pointer border px-3 py-1.5 rounded-lg border-slate-200 hover:bg-slate-50 transition-colors h-[42px]">
                <input type="checkbox" className="toggle toggle-brand toggle-sm" checked={controlBreak} onChange={e => setControlBreak(e.target.checked)} />
                <span className="text-sm font-medium text-slate-700">Control Break Format</span>
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  if (!transformedItems.length) return;
                  const headerInfo = await fetchReportHeader(api);
                  const headerRows = buildExcelHeaderRows(headerInfo, {
                    title: "TRIAL BALANCE REPORT",
                    period: `${from || "Beginning"} to ${to || "Today"}`,
                  });
                  const exportData = transformedItems.map((r) => ({
                    Account_Code: r.account_code,
                    Account_Name: r.account_name,
                    Account_Type: r.account_type,
                    Account_Category: r.account_category,
                    Opening_Balance: r.opening_balance,
                    Opening_Type: r.opening_type,
                    Debit_Amount: r.debit_amount,
                    Credit_Amount: r.credit_amount,
                    Closing_Balance: r.closing_balance,
                    Closing_Type: r.closing_type,
                  }));
                  const ws = XLSX.utils.json_to_sheet([...headerRows, ...exportData]);
                  autosizeWorksheetColumns(ws);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "TrialBalance");
                  XLSX.writeFile(wb, `trial-balance-${headerInfo.currCode}-${from || "all"}-to-${to || "today"}.xlsx`);
                }}
                disabled={!transformedItems.length}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  if (!transformedItems.length) return;
                  const headerInfo = await fetchReportHeader(api);
                  const doc = new jsPDF("p", "mm", "a4");
                  const margin = 14;
                  const pageW = 210;

                  let y = applyPdfHeader(doc, headerInfo, {
                    title: "TRIAL BALANCE REPORT",
                    subtitle: `Period: ${from || "Beginning"} to ${to || "Today"}`,
                    kpis: [
                      { label: "OPENING (DR / CR)", value: `${headerInfo.currPrefix}${totals.opening_dr.toLocaleString()} / ${totals.opening_cr.toLocaleString()}`, color: [59, 130, 246] },
                      { label: "TOTAL MOVEMENT", value: `${headerInfo.currPrefix}${totals.debit_amount.toLocaleString()}`, color: [16, 185, 129] },
                      { label: "CLOSING (DR / CR)", value: `${headerInfo.currPrefix}${totals.closing_dr.toLocaleString()} / ${totals.closing_cr.toLocaleString()}`, color: [234, 88, 12] },
                    ],
                  });

                  // Table header banner
                  doc.setFillColor(30, 41, 59);
                  doc.rect(margin, y, pageW - margin * 2, 6, "F");
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(7.5);
                  doc.setTextColor(255, 255, 255);
                  doc.text("ACCOUNT", margin + 2, y + 4.2);
                  doc.text(`OP. BAL (${headerInfo.currCode})`, 88, y + 4.2, { align: "right" });
                  doc.text("TYPE", 97, y + 4.2, { align: "center" });
                  doc.text("DEBIT", 125, y + 4.2, { align: "right" });
                  doc.text("CREDIT", 155, y + 4.2, { align: "right" });
                  doc.text(`CLS. BAL (${headerInfo.currCode})`, 186, y + 4.2, { align: "right" });
                  doc.text("TYPE", pageW - margin - 2, y + 4.2, { align: "right" });
                  y += 8.5;
                  doc.setTextColor(51, 65, 85);

                  transformedItems.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const acct = `${String(r.account_code || "-")} ${String(r.account_name || "").slice(0, 25)}`.trim();
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(7);
                    doc.text(acct, margin + 2, y);
                    doc.text(r.opening_balance > 0 ? r.opening_balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—", 88, y, { align: "right" });
                    doc.text(r.opening_type, 97, y, { align: "center" });
                    doc.text(r.debit_amount > 0 ? r.debit_amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—", 125, y, { align: "right" });
                    doc.text(r.credit_amount > 0 ? r.credit_amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—", 155, y, { align: "right" });
                    doc.text(r.closing_balance > 0 ? r.closing_balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—", 186, y, { align: "right" });
                    doc.text(r.closing_type, pageW - margin - 2, y, { align: "right" });
                    y += 4.5;
                  });

                  // Summary Totals
                  if (y > 260) {
                    doc.addPage();
                    y = 15;
                  }
                  y += 2;
                  doc.setFillColor(241, 245, 249);
                  doc.rect(margin, y, pageW - margin * 2, 7, "F");
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(7.5);
                  doc.setTextColor(15, 23, 42);
                  doc.text("TOTALS", margin + 2, y + 4.5);
                  doc.text(`${totals.opening_dr.toLocaleString(undefined, { minimumFractionDigits: 2 })} DR`, 88, y + 4.5, { align: "right" });
                  doc.text(`${totals.debit_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 125, y + 4.5, { align: "right" });
                  doc.text(`${totals.credit_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 155, y + 4.5, { align: "right" });
                  doc.text(`${totals.closing_dr.toLocaleString(undefined, { minimumFractionDigits: 2 })} DR`, 186, y + 4.5, { align: "right" });

                  applyPdfFooter(doc);
                  doc.save(`trial-balance-${headerInfo.currCode}-${from || "all"}-to-${to || "today"}.pdf`);
                }}
                disabled={!transformedItems.length}
              >
                Export PDF
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.print()}
              >
                Print
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead className="sticky top-0 z-10">
                <tr>
                  {!controlBreak && (
                    <>
                      <SortableHeader label="Account Type" sortKey="account_type" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                      <SortableHeader label="Account Category" sortKey="account_category" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    </>
                  )}
                  <SortableHeader label="Account" sortKey="account_code" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Opening Balance" sortKey="opening_balance" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <th className="text-center">Type</th>
                  <SortableHeader label="Debit Amount" sortKey="debit_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Credit Amount" sortKey="credit_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <SortableHeader label="Closing Balance" sortKey="closing_balance" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                  <th className="text-center">Type</th>
                </tr>
              </thead>
              {groupedItems ? (
                Object.entries(groupedItems).map(([key, group]) => {
                  const gTotals = group.rows.reduce(
                    (acc, r) => {
                      acc.opening_dr += r.opening_type === "DR" ? r.opening_balance : 0;
                      acc.opening_cr += r.opening_type === "CR" ? r.opening_balance : 0;
                      acc.debit_amount += r.debit_amount;
                      acc.credit_amount += r.credit_amount;
                      acc.closing_dr += r.closing_type === "DR" ? r.closing_balance : 0;
                      acc.closing_cr += r.closing_type === "CR" ? r.closing_balance : 0;
                      return acc;
                    },
                    { opening_dr: 0, opening_cr: 0, debit_amount: 0, credit_amount: 0, closing_dr: 0, closing_cr: 0 }
                  );
                  return (
                    <tbody key={key} className="border-b-[8px] border-slate-200/50">
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        <td colSpan="7" className="font-bold text-slate-700 dark:text-slate-200 py-3 px-4">
                          {group.type} <span className="mx-2 text-slate-400">›</span> <span className="text-brand-600 dark:text-brand-400">{group.cat}</span>
                        </td>
                      </tr>
                      {group.rows.map((r) => (
                        <tr key={r.account_id}>
                          <td>
                            <Link 
                              to={`/finance/reports/general-ledger?accountId=${r.account_id}&from=${from}&to=${to}`}
                              className="font-medium text-blue-500 hover:text-blue-600 hover:underline"
                            >
                              {r.account_name}
                            </Link>
                          </td>
                          <td className="text-right">
                            {r.opening_balance > 0 ? r.opening_balance.toLocaleString() : "—"}
                          </td>
                          <td className="text-center">
                            {r.opening_balance > 0 ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                r.opening_type === "DR" 
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}>
                                {r.opening_type}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="text-right">
                            {r.debit_amount > 0 ? r.debit_amount.toLocaleString() : "—"}
                          </td>
                          <td className="text-right">
                            {r.credit_amount > 0 ? r.credit_amount.toLocaleString() : "—"}
                          </td>
                          <td className="text-right">
                            {r.closing_balance > 0 ? r.closing_balance.toLocaleString() : "—"}
                          </td>
                          <td className="text-center">
                            {r.closing_balance > 0 ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                r.closing_type === "DR" 
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}>
                                {r.closing_type}
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold border-t-2 border-slate-200">
                        <td className="text-right pr-4 py-2 text-sm text-slate-500">Subtotal:</td>
                        <td className="text-right py-2">
                          {gTotals.opening_dr > 0 && <div className="text-xs text-blue-600 font-medium">DR: {gTotals.opening_dr.toLocaleString()}</div>}
                          {gTotals.opening_cr > 0 && <div className="text-xs text-amber-600 font-medium">CR: {gTotals.opening_cr.toLocaleString()}</div>}
                        </td>
                        <td className="text-center"></td>
                        <td className="text-right text-brand-600 py-2">{gTotals.debit_amount > 0 ? gTotals.debit_amount.toLocaleString() : "—"}</td>
                        <td className="text-right text-brand-600 py-2">{gTotals.credit_amount > 0 ? gTotals.credit_amount.toLocaleString() : "—"}</td>
                        <td className="text-right py-2">
                          {gTotals.closing_dr > 0 && <div className="text-xs text-blue-600 font-medium">DR: {gTotals.closing_dr.toLocaleString()}</div>}
                          {gTotals.closing_cr > 0 && <div className="text-xs text-amber-600 font-medium">CR: {gTotals.closing_cr.toLocaleString()}</div>}
                        </td>
                        <td className="text-center"></td>
                      </tr>
                    </tbody>
                  );
                })
              ) : (
                <tbody>
                  {sortedItems.map((r) => (
                    <tr key={r.account_id}>
                      <td>{r.account_type || "-"}</td>
                      <td>{r.account_category || "-"}</td>
                      <td>
                        <Link 
                          to={`/finance/reports/general-ledger?accountId=${r.account_id}&from=${from}&to=${to}`}
                          className="font-medium text-blue-500 hover:text-blue-600 hover:underline"
                        >
                          {r.account_name}
                        </Link>
                      </td>
                      <td className="text-right">
                        {r.opening_balance > 0 ? r.opening_balance.toLocaleString() : "—"}
                      </td>
                      <td className="text-center">
                        {r.opening_balance > 0 ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.opening_type === "DR" 
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}>
                            {r.opening_type}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="text-right">
                        {r.debit_amount > 0 ? r.debit_amount.toLocaleString() : "—"}
                      </td>
                      <td className="text-right">
                        {r.credit_amount > 0 ? r.credit_amount.toLocaleString() : "—"}
                      </td>
                      <td className="text-right">
                        {r.closing_balance > 0 ? r.closing_balance.toLocaleString() : "—"}
                      </td>
                      <td className="text-center">
                        {r.closing_balance > 0 ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.closing_type === "DR" 
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}>
                            {r.closing_type}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-semibold">
                  <td colSpan={controlBreak ? 1 : 3} className="font-semibold text-right pr-4">Grand Totals</td>
                  <td className="text-right">{totals.opening_dr.toLocaleString()}</td>
                  <td className="text-center">DR</td>
                  <td className="text-right">{totals.debit_amount.toLocaleString()}</td>
                  <td className="text-right">{totals.credit_amount.toLocaleString()}</td>
                  <td className="text-right">{totals.closing_dr.toLocaleString()}</td>
                  <td className="text-center">DR</td>
                </tr>
                <tr className="bg-slate-100 dark:bg-slate-800 font-semibold">
                  <td colSpan={controlBreak ? 1 : 3}></td>
                  <td className="text-right">{totals.opening_cr.toLocaleString()}</td>
                  <td className="text-center">CR</td>
                  <td colSpan="2"></td>
                  <td className="text-right">{totals.closing_cr.toLocaleString()}</td>
                  <td className="text-center">CR</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
