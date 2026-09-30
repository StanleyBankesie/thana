/**
 * @fileoverview OpeningBalancesPage component.
 * Standard Modern UI Opening Balances setup for managing initial ledger balances.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { api } from "api/client";
import { Link } from "react-router-dom";
import { filterAndSort } from "@/utils/searchUtils.js";
import { useAuth } from "@/auth/AuthContext.jsx";
import { 
  Scale, 
  ArrowLeft, 
  RefreshCw, 
  Download, 
  Upload, 
  Save, 
  Search, 
  AlertCircle,
  CheckCircle2
} from "lucide-react";

import { usePermission } from "@/auth/PermissionContext.jsx";

export default function OpeningBalancesPage() {
  const { scope, user } = useAuth();
  const { canAccessFeatureKey, isSuper } = usePermission();
  const [accessAllowed, setAccessAllowed] = useState(null);
  const [fiscalYears, setFiscalYears] = useState([]);
  const [selectedFyId, setSelectedFyId] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [ratesMap, setRatesMap] = useState(new Map());
  const [openingMap, setOpeningMap] = useState(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [baseCurrencyCode, setBaseCurrencyCode] = useState("");
  const [baseCurrencyId, setBaseCurrencyId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  async function loadFiscalYearsAndCurrencies() {
    try {
      const [fyRes, curRes, ratesRes] = await Promise.all([
        api.get("/finance/fiscal-years"),
        api.get("/finance/currencies"),
        api.get("/finance/currency-rates"),
      ]);
      const list = fyRes.data?.items || [];
      setFiscalYears(list);
      const open = list.find((x) => Number(x.is_open) === 1) || list[0];
      if (open) {
        setSelectedFyId(String(open.id));
        const dt = open.start_date ? String(open.start_date).slice(0, 10) : "";
        setOpeningDate(dt);
      }

      const curList = curRes.data?.items || [];
      setCurrencies(curList);
      const base = curList.find((c) => Number(c.is_base) === 1) || curList[0];
      if (base?.id) {
        setBaseCurrencyId(Number(base.id));
        setBaseCurrencyCode(base.code || "GHS");
      }

      const rMap = new Map();
      if (base?.id) rMap.set(Number(base.id), 1.0);
      for (const r of ratesRes.data?.items || []) {
        const fromId = Number(r.from_currency_id);
        if (fromId && !rMap.has(fromId)) {
          rMap.set(fromId, Number(r.rate) || 1.0);
        }
      }
      setRatesMap(rMap);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load fiscal years and currencies");
    }
  }

  // Check exclusive admin permission and branch-level access restriction
  useEffect(() => {
    async function checkAccess() {
      const hasPerm = isSuper || canAccessFeatureKey("finance", "opening-balances");
      if (!hasPerm) {
        setAccessAllowed(false);
        return;
      }
      const bid = scope?.branchId;
      if (!bid) { setAccessAllowed(true); return; }
      try {
        const res = await api.get(`/admin/branches/${bid}`);
        const branchData = res.data?.item || res.data;
        const allowedUserId = branchData?.stock_upload_user_id;
        const currentUserId = Number(user?.id);
        if (!allowedUserId || currentUserId === 1 || currentUserId === Number(allowedUserId)) {
          setAccessAllowed(true);
        } else {
          setAccessAllowed(false);
        }
      } catch {
        setAccessAllowed(true);
      }
    }
    if (user?.id) checkAccess();
  }, [scope?.branchId, user?.id, isSuper, canAccessFeatureKey]);

  async function loadData() {
    try {
      setLoading(true);
      const promises = [
        api.get("/finance/accounts"),
      ];
      if (selectedFyId) {
        promises.push(
          api.get("/finance/opening-balances", {
            params: {
              fiscalYearId: Number(selectedFyId),
              branchId: scope?.branchId || undefined,
            },
          }).catch(() => ({ data: { items: [] } }))
        );
      }
      const [accRes, obRes] = await Promise.all(promises);
      const arr = accRes?.data?.items || accRes?.data || [];
      setAccounts(arr);
      const map = new Map();
      if (obRes?.data?.items) {
        for (const r of obRes.data.items || []) {
          map.set(String(r.account_id || r._id), {
            debit: Number(r.opening_debit || 0),
            credit: Number(r.opening_credit || 0),
            currencyId: r.currency_id ? Number(r.currency_id) : (baseCurrencyId || null),
            exchangeRate: Number(r.exchange_rate || 1) > 0 ? Number(r.exchange_rate) : 1,
          });
        }
      }
      setOpeningMap(map);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiscalYearsAndCurrencies();
    loadData();
  }, []);

  useEffect(() => {
    if (selectedFyId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFyId]);

  const rows = useMemo(() => {
    const term = String(searchTerm || "").trim();
    const src = term
      ? filterAndSort(accounts || [], {
          query: term,
          getKeys: (a) => [a.code, a.name],
        })
      : accounts || [];

    const defaultCurId = baseCurrencyId || (currencies.find((c) => Number(c.is_base) === 1)?.id) || 1;

    return src.map((a) => {
      const aId = String(a.id || a._id);
      const entry = openingMap.get(aId) || {
        debit: 0,
        credit: 0,
        currencyId: defaultCurId,
        exchangeRate: 1.0,
      };
      const curId = entry.currencyId || defaultCurId;
      const cur = currencies.find((c) => Number(c.id) === Number(curId)) || {
        code: baseCurrencyCode,
        symbol: "",
        is_base: 1,
      };
      const isBase = Boolean(Number(cur.is_base) === 1);
      const rate = isBase ? 1.0 : (Number(entry.exchangeRate || 1) > 0 ? Number(entry.exchangeRate) : 1.0);

      const netForeign = Number(entry.debit || 0) - Number(entry.credit || 0);
      const netBase = Math.round(netForeign * rate * 100) / 100;
      const obType = netBase >= 0 ? "Dr" : "Cr";
      const obAmt = Math.abs(netBase);

      return {
        id: aId,
        code: a.code,
        name: a.name,
        group: a.group_name,
        nature: a.nature,
        currencyId: curId,
        currencyCode: cur.code || baseCurrencyCode,
        currencySymbol: cur.symbol || "",
        isBase,
        exchangeRate: rate,
        debit: entry.debit,
        credit: entry.credit,
        netForeign,
        netBase,
        opening_balance_type: obType,
        opening_balance_amount: obAmt,
      };
    });
  }, [accounts, openingMap, searchTerm, currencies, baseCurrencyId, baseCurrencyCode]);

  function setValue(id, field, val) {
    setOpeningMap((prev) => {
      const m = new Map(prev);
      const current = m.get(String(id)) || {
        debit: 0,
        credit: 0,
        currencyId: baseCurrencyId || 1,
        exchangeRate: 1.0,
      };

      if (field === "currencyId") {
        const curId = Number(val);
        const curObj = currencies.find((c) => Number(c.id) === curId);
        const isBase = Boolean(Number(curObj?.is_base) === 1);
        const autoRate = isBase ? 1.0 : (ratesMap.get(curId) || Number(current.exchangeRate) || 1.0);
        m.set(String(id), { ...current, currencyId: curId, exchangeRate: autoRate });
      } else if (field === "exchangeRate") {
        const rawVal = String(val || "").replace(/,/g, "").trim();
        const parsed = parseFloat(rawVal);
        const rate = Math.max(0.000001, isNaN(parsed) ? 1.0 : parsed);
        m.set(String(id), { ...current, exchangeRate: rate });
      } else if (field === "debit") {
        const rawVal = String(val || "").replace(/,/g, "").trim();
        const parsed = parseFloat(rawVal);
        const n = Math.max(0, isNaN(parsed) ? 0 : parsed);
        m.set(String(id), { ...current, debit: n, credit: 0 });
      } else if (field === "credit") {
        const rawVal = String(val || "").replace(/,/g, "").trim();
        const parsed = parseFloat(rawVal);
        const n = Math.max(0, isNaN(parsed) ? 0 : parsed);
        m.set(String(id), { ...current, debit: 0, credit: n });
      }

      return m;
    });
  }

  const totals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const v of openingMap.values()) {
      const rate = Number(v.exchangeRate || 1) > 0 ? Number(v.exchangeRate) : 1;
      totalDebit += Number(v.debit || 0) * rate;
      totalCredit += Number(v.credit || 0) * rate;
    }
    const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
    const isBalanced = Math.abs(diff) < 0.001;
    return {
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      diff,
      isBalanced
    };
  }, [openingMap]);

  async function saveAll() {
    if (!selectedFyId) {
      toast.error("Select a fiscal year");
      return;
    }
    try {
      setSaving(true);
      const fy = Number(selectedFyId);
      const items = [];
      for (const [accId, v] of openingMap.entries()) {
        items.push({
          accountId: accId,
          currencyId: v.currencyId || baseCurrencyId || null,
          exchangeRate: Number(v.exchangeRate || 1) > 0 ? Number(v.exchangeRate) : 1,
          openingDebit: Number(v.debit || 0),
          openingCredit: Number(v.credit || 0),
        });
      }
      const resp = await api.post(
        "/finance/opening-balances/bulk",
        {
          fiscalYearId: fy,
          openingDate,
          items,
          branchId: scope?.branchId || null,
        },
        { headers: { "x-skip-offline-queue": "1" } },
      );
      const n = Number(resp?.data?.upserted || items.length || 0);
      toast.success(`Opening balances saved successfully (${n} accounts updated)`);
      await loadData();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to save opening balances");
    } finally {
      setSaving(false);
    }
  }

  function downloadTemplate() {
    if (!selectedFyId) {
      toast.error("Select a fiscal year");
      return;
    }
    const data = (accounts || []).map((a) => {
      const entry = openingMap.get(String(a.id || a._id));
      const cur = currencies.find(c => Number(c.id) === Number(entry?.currencyId)) || currencies.find(c => Number(c.is_base) === 1);
      return {
        "Account Code": a.code,
        "Account Name": a.name,
        "Group": a.group_name || "",
        "Nature": a.nature || "",
        "Currency": cur?.code || baseCurrencyCode,
        "Exchange Rate": Number(entry?.exchangeRate || 1),
        "Opening Debit": entry?.debit || 0,
        "Opening Credit": entry?.credit || 0,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OpeningBalances");
    XLSX.writeFile(wb, `Opening_Balances_Template_${selectedFyId}.xlsx`);
    toast.success("Template downloaded");
  }

  function onPickFile() {
    if (fileRef.current) fileRef.current.click();
  }

  async function onFileChange(e) {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const arr = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const header = Array.isArray(arr[0]) ? arr[0] : [];
      const normalizeHeader = (s) =>
        String(s || "")
          .toLowerCase()
          .replace(/\(.*?\)/g, "")
          .replace(/\s+/g, " ")
          .trim();

      const codeIdx = header.findIndex((h) => normalizeHeader(h) === "account code");
      const curIdx = header.findIndex((h) => normalizeHeader(h) === "currency");
      const rateIdx = header.findIndex((h) => normalizeHeader(h).startsWith("exchange rate") || normalizeHeader(h) === "rate");
      const debitIdx = header.findIndex((h) => normalizeHeader(h).startsWith("opening debit"));
      const creditIdx = header.findIndex((h) => normalizeHeader(h).startsWith("opening credit"));

      if (codeIdx < 0 || (debitIdx < 0 && creditIdx < 0)) {
        toast.error("Template headers not found (Account Code, Opening Debit, Opening Credit)");
        return;
      }

      const byCode = new Map(
        (accounts || []).map((a) => [String(a.code).toUpperCase(), a]),
      );
      const curByCode = new Map(
        (currencies || []).map((c) => [String(c.code).toUpperCase(), c]),
      );

      const next = new Map(openingMap);
      const parseAmount = (v) => {
        if (typeof v === "number") return v;
        const s = String(v || "").replace(/,/g, "").trim();
        const n = Number(s || 0);
        return Number.isFinite(n) ? n : 0;
      };

      for (let i = 1; i < arr.length; i++) {
        const row = arr[i] || [];
        const code = String(row[codeIdx] || "").trim().toUpperCase();
        if (!code) continue;
        const acc = byCode.get(code);
        if (!acc) continue;

        const d = debitIdx >= 0 ? parseAmount(row[debitIdx]) : 0;
        const c = creditIdx >= 0 ? parseAmount(row[creditIdx]) : 0;
        if (!(d > 0 || c > 0)) continue;

        let curId = baseCurrencyId || 1;
        let rate = 1.0;
        if (curIdx >= 0 && row[curIdx]) {
          const cCode = String(row[curIdx]).trim().toUpperCase();
          const matchedCur = curByCode.get(cCode);
          if (matchedCur) {
            curId = matchedCur.id;
            rate = Number(matchedCur.is_base) === 1 ? 1.0 : (ratesMap.get(matchedCur.id) || 1.0);
          }
        }
        if (rateIdx >= 0 && row[rateIdx]) {
          const parsedRate = parseAmount(row[rateIdx]);
          if (parsedRate > 0) rate = parsedRate;
        }

        next.set(String(acc.id || acc._id), {
          debit: d > 0 ? Math.round(d * 100) / 100 : 0,
          credit: c > 0 ? Math.round(c * 100) / 100 : 0,
          currencyId: curId,
          exchangeRate: rate,
        });
      }
      setOpeningMap(next);
      toast.success("Opening balances loaded from Excel template");
    } catch (err) {
      toast.error("Failed to read template");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (accessAllowed === false) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl mt-12 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          You do not have administrative permission to access Opening Balances setup for this branch.
        </p>
        <Link to="/finance?section=Accounting%20Setup" className="btn btn-secondary text-xs px-4 py-2 inline-flex items-center gap-1.5">
          <ArrowLeft size={14} /> Return to Finance
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <Link
                to="/finance?section=Accounting%20Setup"
                className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors mb-2"
              >
                <ArrowLeft size={14} /> Back to Accounting Setup
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Scale className="w-6 h-6" /> Opening Balances Setup
              </h1>
              <p className="text-sm mt-0.5 opacity-90">
                Configure initial opening debit & credit balances across Chart of Accounts in Base & Foreign Currencies
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="px-3.5 py-2 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                onClick={() => downloadTemplate()}
                disabled={!selectedFyId}
              >
                <Download size={14} /> Download Template
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={onFileChange}
              />
              <button
                className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                onClick={onPickFile}
                disabled={!rows.length}
              >
                <Upload size={14} /> Import Excel
              </button>
              <button
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-md"
                onClick={saveAll}
                disabled={saving || !selectedFyId}
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save All Balances
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Reconciliation KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Opening Debits ({baseCurrencyCode})</p>
            <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {baseCurrencyCode} {totals.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 font-bold text-sm">
            Dr
          </div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Opening Credits ({baseCurrencyCode})</p>
            <h3 className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {baseCurrencyCode} {totals.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-950 flex items-center justify-center text-purple-600 font-bold text-sm">
            Cr
          </div>
        </div>

        <div className={`card p-4 bg-white dark:bg-slate-900 border shadow-xs flex justify-between items-center ${
          totals.isBalanced 
            ? "border-emerald-200 dark:border-emerald-800" 
            : "border-amber-300 dark:border-amber-800"
        }`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reconciliation Status</p>
            <div className="flex items-center gap-2 mt-1">
              {totals.isBalanced ? (
                <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={16} /> Balanced (0.00 Diff)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-600 dark:text-amber-400">
                  <AlertCircle size={16} /> Diff: {baseCurrencyCode} {Math.abs(totals.diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totals.diff > 0 ? "Dr" : "Cr"})
                </span>
              )}
            </div>
          </div>
          <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
            totals.isBalanced 
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" 
              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          }`}>
            {totals.isBalanced ? "MATCHED" : "OUT OF BALANCE"}
          </span>
        </div>
      </div>

      {/* Filter & Fiscal Year Selector */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input w-full pl-9 text-sm"
              placeholder="Search account code or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Fiscal Period:
              </label>
              <select
                className="input text-sm font-semibold"
                value={selectedFyId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedFyId(val);
                  const hit = fiscalYears.find((x) => String(x.id) === String(val));
                  if (hit?.start_date) setOpeningDate(String(hit.start_date).slice(0, 10));
                }}
              >
                <option value="">Select Fiscal Year</option>
                {fiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.code} {Number(fy.is_open) === 1 ? "(Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Opening Date:
              </label>
              <input
                type="date"
                className="input text-sm font-semibold"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card shadow-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                <th className="py-3 px-4 text-left">Code</th>
                <th className="py-3 px-4 text-left">Account Name</th>
                <th className="py-3 px-4 text-left">Group</th>
                <th className="py-3 px-4 text-left">Nature</th>
                <th className="py-3 px-3 text-left min-w-[110px]">Currency</th>
                <th className="py-3 px-3 text-right min-w-[100px]">Exch. Rate</th>
                <th className="py-3 px-3 text-right min-w-[130px]">Opening Debit</th>
                <th className="py-3 px-3 text-right min-w-[130px]">Opening Credit</th>
                <th className="py-3 px-4 text-left min-w-[170px]">
                  Net Opening Balance ({baseCurrencyCode})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-10 text-slate-400">
                    <RefreshCw className="animate-spin w-6 h-6 mx-auto mb-2" />
                    Loading opening balances...
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand dark:text-brand-300">
                      {r.code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {r.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">
                      {r.group || "—"}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                        {r.nature || "—"}
                      </span>
                    </td>
                    
                    {/* Currency Selector */}
                    <td className="py-3 px-3">
                      <select
                        className="input text-xs font-bold py-1.5 px-2 w-full"
                        value={r.currencyId}
                        onChange={(e) => setValue(r.id, "currencyId", e.target.value)}
                      >
                        {currencies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} {Number(c.is_base) === 1 ? "(Base)" : ""}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Exchange Rate */}
                    <td className="py-3 px-3 text-right">
                      <input
                        className={`input text-right font-mono text-xs py-1.5 px-2 w-full ${
                          r.isBase 
                            ? "bg-slate-50 dark:bg-slate-800 text-slate-400 cursor-not-allowed" 
                            : "font-bold text-indigo-600 dark:text-indigo-400 border-indigo-300"
                        }`}
                        type="number"
                        min="0.000001"
                        step="0.000001"
                        disabled={r.isBase}
                        value={r.exchangeRate}
                        placeholder="1.000000"
                        onChange={(e) => setValue(r.id, "exchangeRate", e.target.value)}
                      />
                    </td>

                    {/* Opening Debit */}
                    <td className="py-3 px-3 text-right">
                      <input
                        className="input text-right font-mono text-sm py-1.5 px-2 w-full"
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.debit || ""}
                        placeholder="0.00"
                        onChange={(e) => setValue(r.id, "debit", e.target.value)}
                      />
                    </td>

                    {/* Opening Credit */}
                    <td className="py-3 px-3 text-right">
                      <input
                        className="input text-right font-mono text-sm py-1.5 px-2 w-full"
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.credit || ""}
                        placeholder="0.00"
                        onChange={(e) => setValue(r.id, "credit", e.target.value)}
                      />
                    </td>

                    {/* Net Opening Balance in Base Currency */}
                    <td className="py-3 px-4 text-left font-mono">
                      <div>
                        <span className={`font-bold ${
                          r.opening_balance_type === "Dr" 
                            ? "text-blue-600 dark:text-blue-400" 
                            : "text-purple-600 dark:text-purple-400"
                        }`}>
                          {baseCurrencyCode} {Number(r.opening_balance_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {r.opening_balance_type}
                        </span>
                      </div>
                      {!r.isBase && (r.debit > 0 || r.credit > 0) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                          {r.currencyCode} {Math.abs(r.netForeign).toLocaleString(undefined, { minimumFractionDigits: 2 })} @ {r.exchangeRate}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center py-10 text-slate-400">
                    No accounts found for selected fiscal period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
