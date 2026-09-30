/**
 * @fileoverview GeneralLedgerReportPage component.
 * Provides functionality for GeneralLedgerReportPage.
 */

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { autosizeWorksheetColumns } from "../../../../utils/xlsxUtils.js";
import {
  fetchReportHeader,
  applyPdfHeader,
  applyPdfFooter,
  buildExcelHeaderRows,
} from "../../../../utils/pdfUtils.js";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function GeneralLedgerReportPage() {
  const [pollingCounter, setPollingCounter] = React.useState(0);
  React.useEffect(() => {
    const __pollId = setInterval(() => setPollingCounter(c => c + 1), 15000);
    return () => clearInterval(__pollId);
  }, [pollingCounter]);

  const [searchParams] = useSearchParams();
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
  const [accountId, setAccountId] = useState(() => {
    return new URLSearchParams(window.location.search).get("accountId") || "";
  });
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [opening, setOpening] = useState(0);
  const [accountOpeningBalances, setAccountOpeningBalances] = useState({});
  const [reportCurrencyCode, setReportCurrencyCode] = useState("GHS");
  const [reportExchangeRate, setReportExchangeRate] = useState(1.0);
  const [items, setItems] = useState([]);
  const [accountMeta, setAccountMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [controlBreak, setControlBreak] = useState(true);
  const accountInputRef = useRef(null);
  const accountDropdownRef = useRef(null);

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

  function getVoucherPath(row) {
    const code = String(row?.voucher_type_code || "").toUpperCase();
    const base =
      code === "JV"
        ? "journal-voucher"
        : code === "PAYV"
          ? "payment-voucher"
          : code === "RV"
            ? "receipt-voucher"
            : code === "CV"
              ? "contra-voucher"
              : code === "SV"
                ? "sales-voucher"
                : code === "PV" || code === "PUV"
                  ? "purchase-voucher"
                  : code === "DN"
                    ? "debit-note"
                    : code === "CN"
                      ? "credit-note"
                      : "journal-voucher";
    return `/finance/${base}/${row?.voucher_id}?mode=view`;
  }

  async function loadAccounts() {
    try {
      const res = await api.get("/finance/accounts", {
        params: { postable: 1, active: 1 },
      });
      setAccounts(res.data?.items || []);
    } catch {
      toast.error("Failed to load accounts");
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

  async function run() {
    try {
      setLoading(true);
      const params = {
        from: from || null,
        to: to || null,
      };
      if (accountId) params.accountId = accountId;
      if (groupId) params.groupId = groupId;
      const res = await api.get("/finance/reports/general-ledger", { params });
      setOpening(Number(res.data?.opening_balance || 0));
      setAccountMeta(res.data?.account || null);
      setAccountOpeningBalances(res.data?.account_opening_balances || {});
      setReportCurrencyCode(res.data?.currency_code || "GHS");
      setReportExchangeRate(Number(res.data?.exchange_rate || 1.0));
      setItems(res.data?.items || []);
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load general ledger",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([loadAccounts(), loadGroups()]);
  }, []);

  useEffect(() => {
    if (accountId) {
      const hit = (accounts || []).find((a) => String(a.id) === String(accountId));
      if (hit) setAccountQuery(String(hit.name || ""));
    }
  }, [accountId, accounts]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, accountId, groupId, pollingCounter]);

  // If selected account falls outside selected group, clear selection.
  useEffect(() => {
    const gid = groupId ? Number(groupId) : null;
    const filtered = gid
      ? (accounts || []).filter(
          (a) =>
            Number(a.group_id || a.groupId || 0) === gid ||
            String(a.group_name || a.groupName || "") ===
              (groups.find((g) => Number(g.id) === gid)?.name || ""),
        )
      : accounts || [];
    if (!accountId) return;
    if (!filtered.find((a) => String(a.id) === String(accountId))) {
      setAccountId("");
      setAccountQuery("");
      setOpening(0);
      setItems([]);
      setAccountMeta(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, accounts]);

  // Removed redundant useEffect for accountId

  const {
    sorted: sortedItems,
    sortKey,
    sortDir,
    toggle,
  } = useSort(items, "voucher_date", "asc");

  const groupedItems = useMemo(() => {
    if (!controlBreak) return null;
    const groups = {};
    sortedItems.forEach(r => {
      const key = r.account_name || r.account_code || "Unknown Account";
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  }, [sortedItems, controlBreak, accountId]);

  const groupFilteredAccounts = useMemo(() => {
    if (!groupId) return accounts || [];
    const selectedGroupName =
      groups.find((g) => String(g.id) === String(groupId))?.name || "";
    return (accounts || []).filter(
      (a) =>
        Number(a.group_id || a.groupId || 0) === Number(groupId) ||
        String(a.group_name || a.groupName || "") === selectedGroupName,
    );
  }, [accounts, groupId, groups]);

  const accountSearchResults = useMemo(() => {
    const q = String(accountQuery || "").trim().toLowerCase();
    if (!q) return groupFilteredAccounts || [];
    return (groupFilteredAccounts || [])
      .filter((a) => {
        const code = String(a.code || "").toLowerCase();
        const name = String(a.name || "").toLowerCase();
        return code.startsWith(q) || name.startsWith(q);
      })
      .slice(0, 20);
  }, [groupFilteredAccounts, accountQuery]);

  const selectedAccountLabel = useMemo(() => {
    const hit = (accounts || []).find(
      (a) => String(a.id) === String(accountId || ""),
    );
    return hit ? String(hit.name || "") : "";
  }, [accounts, accountId]);

  const handleSelectAccount = useCallback((id, name) => {
    setAccountId(String(id));
    setAccountQuery(String(name || ""));
    setAccountDropdownOpen(false);
  }, []);

  const handleAccountInputChange = useCallback((value) => {
    setAccountQuery(value);
    setAccountDropdownOpen(true);
    if (!String(value || "").trim()) { setAccountId(""); }
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
        if (!v) { setAccountId(""); return; }
        const hit = (groupFilteredAccounts || []).find((a) => {
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
  }, [accountQuery, groupFilteredAccounts, selectedAccountLabel]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => window.history.back()} className="font-sans text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to Finance
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            General Ledger
          </h1>
          <p className="text-sm mt-1">Ledger entries — leave account empty for all accounts</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div className="flex-1 min-w-[240px]">
              <label className="label">Account</label>
              <div className="relative">
                <input
                  ref={accountInputRef}
                  className="input w-full"
                  placeholder={accountId ? selectedAccountLabel || "Search account..." : "Search account..."}
                  value={accountQuery}
                  onChange={(e) => handleAccountInputChange(e.target.value)}
                  onFocus={() => { setAccountDropdownOpen(true); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && accountSearchResults.length > 0) {
                      const first = accountSearchResults[0];
                      handleSelectAccount(first.id, first.name);
                    }
                    if (e.key === "Escape") setAccountDropdownOpen(false);
                  }}
                  autoComplete="off"
                />
                {accountId ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 text-lg leading-none"
                    onClick={() => { setAccountId(""); setAccountQuery(""); setAccountDropdownOpen(false); }}
                    title="Clear account"
                  >
                    &times;
                  </button>
                ) : null}
                {accountDropdownOpen && accountSearchResults.length > 0 ? (
                  <div ref={accountDropdownRef} className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-auto">
                    {accountSearchResults.map((a) => {
                      const q = String(accountQuery || "").trim().toLowerCase();
                      const name = String(a.name || "");
                      const idx = q ? name.toLowerCase().indexOf(q) : -1;
                      return (
                        <button
                          type="button"
                          key={a.id}
                          className="block w-full text-left px-3 py-2 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-sm border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                          onMouseDown={(e) => { e.preventDefault(); handleSelectAccount(a.id, a.name); }}
                        >
                          <div className="flex justify-between items-center">
                            <span>
                              {idx >= 0 ? (
                                <>{name.slice(0, idx)}<strong className="text-brand-600 dark:text-brand-400">{name.slice(idx, idx + q.length)}</strong>{name.slice(idx + q.length)}</>
                              ) : name}
                            </span>
                            <span className="font-semibold text-brand-700 dark:text-brand-300 whitespace-nowrap ml-2 text-xs bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">{a.code}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="w-48 min-w-[160px]">
              <label className="label">Account Group</label>
              <select
                className="input w-full"
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
            <div className="w-44 min-w-[140px]">
              <label className="label">From</label>
              <input
                className="input w-full"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="w-44 min-w-[140px]">
              <label className="label">To</label>
              <input
                className="input w-full"
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
            <div className="flex items-end gap-3 shrink-0 ml-auto">
              <label className="flex items-center gap-2 mr-4 cursor-pointer border px-3 py-1.5 rounded-lg border-slate-200 hover:bg-slate-50 transition-colors">
                <input type="checkbox" className="toggle toggle-brand toggle-sm" checked={controlBreak} onChange={e => setControlBreak(e.target.checked)} />
                <span className="text-sm font-medium text-slate-700">Control Break Format</span>
              </label>
              <button
                type="button"
                className="btn-secondary px-4 whitespace-nowrap"
                onClick={async () => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const headerInfo = await fetchReportHeader(api);
                  const selectedAcc = accounts.find((a) => String(a.id) === String(accountId));
                  const accTitle = selectedAcc ? `Account: ${selectedAcc.code} - ${selectedAcc.name}` : "All Accounts";
                  const headerRows = buildExcelHeaderRows(headerInfo, {
                    title: `GENERAL LEDGER REPORT (${accTitle})`,
                    period: `${from || "Beginning"} to ${to || "Today"}`,
                  });
                  const ws = XLSX.utils.json_to_sheet([...headerRows, ...rows]);
                  autosizeWorksheetColumns(ws);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "GeneralLedger");
                  XLSX.writeFile(wb, `general-ledger-${headerInfo.currCode}-${from || "all"}-to-${to || "today"}.xlsx`);
                }}
                disabled={!items.length}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="btn-primary px-4 whitespace-nowrap"
                onClick={async () => {
                  const rows = Array.isArray(items) ? items : [];
                  if (!rows.length) return;
                  const headerInfo = await fetchReportHeader(api);
                  const doc = new jsPDF("p", "mm", "a4");
                  const margin = 14;
                  const pageW = 210;

                  const selectedAcc = accounts.find((a) => String(a.id) === String(accountId));
                  const accTitle = selectedAcc ? `Account: ${selectedAcc.code} - ${selectedAcc.name}` : "All Accounts";

                  let y = applyPdfHeader(doc, headerInfo, {
                    title: "GENERAL LEDGER REPORT",
                    subtitle: `${accTitle}   |   Period: ${from || "Beginning"} to ${to || "Today"}`,
                    kpis: [
                      { label: "OPENING BALANCE", value: `${headerInfo.currPrefix}${Number(opening || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: [59, 130, 246] },
                      { label: "TOTAL TRANSACTIONS", value: `${rows.length}`, color: [16, 185, 129] },
                    ],
                  });

                  // Table Header
                  doc.setFillColor(30, 41, 59);
                  doc.rect(margin, y, pageW - margin * 2, 6, "F");
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(7.5);
                  doc.setTextColor(255, 255, 255);
                  doc.text("DATE", margin + 2, y + 4.2);
                  doc.text("VOUCHER NO", 40, y + 4.2);
                  doc.text("DESCRIPTION", 75, y + 4.2);
                  doc.text(`DEBIT (${headerInfo.currCode})`, 135, y + 4.2, { align: "right" });
                  doc.text(`CREDIT (${headerInfo.currCode})`, 162, y + 4.2, { align: "right" });
                  doc.text(`BALANCE (${headerInfo.currCode})`, pageW - margin - 2, y + 4.2, { align: "right" });
                  y += 8.5;
                  doc.setTextColor(51, 65, 85);

                  rows.forEach((r) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 15;
                    }
                    const dt = r.voucher_date
                      ? new Date(r.voucher_date).toLocaleDateString()
                      : "-";
                    const vn = String(r.voucher_no || "-");
                    const desc = String(r.description || "-").slice(0, 32);
                    const dr = Number(r.debit || 0) > 0 ? Number(r.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—";
                    const cr = Number(r.credit || 0) > 0 ? Number(r.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—";
                    const bal = Number(r.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
                    
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(7);
                    doc.text(dt, margin + 2, y);
                    doc.text(vn, 40, y);
                    doc.text(desc, 75, y);
                    doc.text(dr, 135, y, { align: "right" });
                    doc.text(cr, 162, y, { align: "right" });
                    doc.text(bal, pageW - margin - 2, y, { align: "right" });
                    y += 4.5;
                  });

                  applyPdfFooter(doc);
                  doc.save(`general-ledger-${headerInfo.currCode}-${from || "all"}-to-${to || "today"}.pdf`);
                }}
                disabled={!items.length}
              >
                Export PDF
              </button>
              <button
                type="button"
                className="btn-primary px-4 whitespace-nowrap"
                onClick={() => window.print()}
              >
                Print
              </button>
            </div>
          </div>

          {accountId ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mb-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Opening Balance {from ? `(As of ${new Date(from).toLocaleDateString()})` : "(B/F)"}
                </div>
                <div className="text-xl font-extrabold text-brand-600 dark:text-brand-400 mt-1">
                  {Math.abs(Number(opening || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                  <span className={opening >= 0 ? "text-blue-600 font-bold" : "text-red-600 font-bold"}>
                    {opening >= 0 ? "Dr" : "Cr"}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Normal Balance Nature</div>
                <div className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-1">
                  <span className="px-2.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-xs font-bold">
                    {String(accountMeta?.current_balance_type || accountMeta?.balance_type || "DEBIT")}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {to ? `Closing Balance (As of ${new Date(to).toLocaleDateString()})` : "Current Ledger Balance"}
                </div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                  {Math.abs(Number(opening || 0) + (items || []).reduce((acc, r) => acc + Number(r.debit || 0) - Number(r.credit || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                  <span className={(Number(opening || 0) + (items || []).reduce((acc, r) => acc + Number(r.debit || 0) - Number(r.credit || 0), 0)) >= 0 ? "text-blue-600 font-bold" : "text-red-600 font-bold"}>
                    {(Number(opening || 0) + (items || []).reduce((acc, r) => acc + Number(r.debit || 0) - Number(r.credit || 0), 0)) >= 0 ? "Dr" : "Cr"}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="table table-fixed w-full min-w-[1100px]">
              <thead className="sticky top-0 z-10">
                <tr>
                  {!accountId && !controlBreak ? (
                    <SortableHeader
                      label="Account"
                      sortKey="account_name"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                      className="w-[11.11%] min-w-[130px]"
                    />
                  ) : null}
                  <SortableHeader
                    label="Date"
                    sortKey="voucher_date"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="w-[12.5%] min-w-[130px]"
                  />
                  <SortableHeader
                    label="Voucher No"
                    sortKey="voucher_no"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="w-[12.5%] min-w-[130px]"
                  />
                  <SortableHeader
                    label="Description"
                    sortKey="description"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="w-[12.5%] min-w-[130px]"
                  />
                  <SortableHeader
                    label="Debit"
                    sortKey="debit"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right w-[12.5%] min-w-[130px]"
                  />
                  <SortableHeader
                    label="Credit"
                    sortKey="credit"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right w-[12.5%] min-w-[130px]"
                  />
                  <SortableHeader
                    label="Currency"
                    sortKey="currency_code"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right w-[12.5%] min-w-[130px]"
                  />
                  <SortableHeader
                    label="Exch. Rate"
                    sortKey="exchange_rate"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right w-[12.5%] min-w-[130px]"
                  />
                  <SortableHeader
                    label="Balance (Dr/Cr)"
                    sortKey="balance"
                    currentKey={sortKey}
                    direction={sortDir}
                    onToggle={toggle}
                    className="text-right w-[12.5%] min-w-[130px]"
                  />
                </tr>
              </thead>
              {groupedItems ? (
                Object.entries(groupedItems).map(([accountName, rows]) => {
                  const totalDr = rows.reduce((acc, r) => acc + Number(r.debit || 0), 0);
                  const totalCr = rows.reduce((acc, r) => acc + Number(r.credit || 0), 0);
                  const accId = rows[0]?.account_id || (accounts || []).find(a => a.name === accountName || a.code === accountName)?.id;
                  const accOb = (accId && accountOpeningBalances) ? (accountOpeningBalances[accId] || accountOpeningBalances[String(accId)] || null) : null;
                  const obBalance = accOb ? Number(accOb.opening_balance || 0) : 0;
                  const obDate = from ? new Date(from).toLocaleDateString() : (accOb?.opening_date ? new Date(accOb.opening_date).toLocaleDateString() : "Opening");
                  const obCurrency = accOb?.currency_code || rows[0]?.currency_code || reportCurrencyCode || "GHS";
                  const obRate = Number(accOb?.exchange_rate || rows[0]?.exchange_rate || reportExchangeRate || 1.0);
                  const closingBal = obBalance + totalDr - totalCr;
                  const closingType = closingBal >= 0 ? "Dr" : "Cr";
                  return (
                    <tbody key={accountName} className="border-b-[8px] border-slate-200/50">
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        <td colSpan="8" className="font-bold text-slate-700 dark:text-slate-200 py-3 px-4">
                          Account: <span className="text-brand-600 dark:text-brand-400">{accountName}</span>
                        </td>
                      </tr>
                      <tr className="bg-slate-50/90 dark:bg-slate-800/60 font-semibold border-b border-slate-200 dark:border-slate-700">
                        <td>{obDate}</td>
                        <td className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">OPENING</td>
                        <td className="italic text-slate-700 dark:text-slate-300 break-words whitespace-normal">{from ? `Opening Balance (As of ${new Date(from).toLocaleDateString()})` : "Opening Balance B/F"}</td>
                        <td className="text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {obBalance > 0 ? Number(obBalance).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                        </td>
                        <td className="text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {obBalance < 0 ? Math.abs(obBalance).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                        </td>
                        <td className="text-right font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{obCurrency}</td>
                        <td className="text-right font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{Number(obRate || 1).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 6 })}</td>
                        <td className="text-right font-mono font-bold">
                          {Math.abs(obBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                          <span className={obBalance >= 0 ? "text-blue-600" : "text-red-600"}>{obBalance >= 0 ? "Dr" : "Cr"}</span>
                        </td>
                      </tr>
                      {rows.map((r, idx) => {
                        const balance = Number(r.balance || 0);
                        const rBalanceType = balance >= 0 ? "Dr" : "Cr";
                        const displayBalance = Math.abs(balance);
                        return (
                          <tr key={`${r.voucher_no}-${r.line_no}-${idx}`}>
                            <td>{new Date(r.voucher_date).toLocaleDateString()}</td>
                            <td>
                              <Link to={getVoucherPath(r)} className="font-medium text-sky-400 hover:text-sky-500">
                                {r.voucher_no}
                              </Link>
                            </td>
                            <td className="break-words whitespace-normal leading-relaxed">{r.description || "-"}</td>
                            <td className="text-right">{Number(r.debit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="text-right">{Number(r.credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="text-right">{r.currency_code || "-"}</td>
                            <td className="text-right">{Number(r.exchange_rate || 1).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 6 })}</td>
                            <td className="text-right">
                              <span className="font-medium">
                                {displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                                <span className={balance >= 0 ? "text-blue-600" : "text-red-600"}>{rBalanceType}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold border-t-2 border-slate-200">
                        <td colSpan="3" className="text-right pr-4 py-3">Totals for {accountName}:</td>
                        <td className="text-right text-brand-600 py-3">{totalDr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right text-brand-600 py-3">{totalCr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td colSpan="2" className="py-3"></td>
                        <td className="text-right text-brand-600 py-3">
                           {Math.abs(closingBal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className={closingBal >= 0 ? "text-blue-600" : "text-red-600"}>{closingType}</span>
                        </td>
                      </tr>
                    </tbody>
                  );
                })
              ) : (
                <tbody>
                  {accountId && (
                    <tr className="bg-slate-50/90 dark:bg-slate-800/60 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <td>{from ? new Date(from).toLocaleDateString() : "Opening"}</td>
                      <td className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">OPENING</td>
                      <td className="italic text-slate-700 dark:text-slate-300 break-words whitespace-normal">{from ? `Opening Balance (As of ${new Date(from).toLocaleDateString()})` : "Opening Balance B/F"}</td>
                      <td className="text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {opening > 0 ? Number(opening).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                      </td>
                      <td className="text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {opening < 0 ? Math.abs(opening).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                      </td>
                      <td className="text-right font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{reportCurrencyCode || "GHS"}</td>
                      <td className="text-right font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{Number(reportExchangeRate || 1).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 6 })}</td>
                      <td className="text-right font-mono font-bold">
                        {Math.abs(opening).toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                        <span className={opening >= 0 ? "text-blue-600" : "text-red-600"}>{opening >= 0 ? "Dr" : "Cr"}</span>
                      </td>
                    </tr>
                  )}
                  {sortedItems.map((r, idx) => {
                    const balance = Number(r.balance || 0);
                    const balanceType = balance >= 0 ? "Dr" : "Cr";
                    const displayBalance = Math.abs(balance);
                    return (
                      <tr key={`${r.account_code || ""}-${r.voucher_no}-${r.line_no}-${idx}`}>
                        {!accountId && !controlBreak ? (
                          <td className="font-medium">{r.account_name || r.account_code || "-"}</td>
                        ) : null}
                        <td>{new Date(r.voucher_date).toLocaleDateString()}</td>
                        <td>
                          <Link
                            to={getVoucherPath(r)}
                            className="font-medium text-sky-400 hover:text-sky-500"
                          >
                            {r.voucher_no}
                          </Link>
                        </td>
                        <td className="break-words whitespace-normal leading-relaxed">{r.description || "-"}</td>
                        <td className="text-right">
                          {Number(r.debit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-right">
                          {Number(r.credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-right">
                          {r.currency_code || "-"}
                        </td>
                        <td className="text-right">
                          {Number(r.exchange_rate || 1).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 6 })}
                        </td>
                        <td className="text-right">
                          <span className="font-medium">
                            {displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                            <span
                              className={
                                balance >= 0 ? "text-blue-600" : "text-red-600"
                              }
                            >
                              {balanceType}
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
