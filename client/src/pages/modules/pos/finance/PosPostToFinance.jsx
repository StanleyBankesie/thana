/**
 * @fileoverview PosPostToFinance component.
 * Provides functionality for PosPostToFinance.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { filterAndSort } from "@/utils/searchUtils.js";

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1];

function parseDenominationCounts(input) {
  if (!input) return DENOMINATIONS.map(() => 0);
  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return DENOMINATIONS.map(() => 0);
    }
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    parsed.type === "Buffer" &&
    Array.isArray(parsed.data)
  ) {
    try {
      const text = new TextDecoder().decode(new Uint8Array(parsed.data));
      parsed = JSON.parse(text);
    } catch {
      return DENOMINATIONS.map(() => 0);
    }
  }
  if (parsed instanceof ArrayBuffer) {
    try {
      const text = new TextDecoder().decode(new Uint8Array(parsed));
      parsed = JSON.parse(text);
    } catch {
      return DENOMINATIONS.map(() => 0);
    }
  }
  if (parsed instanceof Uint8Array) {
    try {
      const text = new TextDecoder().decode(parsed);
      parsed = JSON.parse(text);
    } catch {
      return DENOMINATIONS.map(() => 0);
    }
  }
  if (Array.isArray(parsed)) {
    return DENOMINATIONS.map((_, idx) => {
      const n = Number(parsed[idx] || 0);
      return Number.isFinite(n) && n > 0 ? n : 0;
    });
  }
  return DENOMINATIONS.map((d) => {
    const n = Number(parsed?.[String(d)] ?? parsed?.[d] ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
}

function FilterableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}) {
  const filtered = Array.isArray(options) ? options : [];
  const hasEmptyOption = filtered.some((o) => String(o.value) === "");
  return (
    <div>
      <select
        className="input w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {!hasEmptyOption && placeholder && (
          <option value="">{placeholder}</option>
        )}
        {filtered.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PosPostToFinance() {
  const [loading, setLoading] = useState(false);
  const [terminals, setTerminals] = useState([]);

  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [tillId, setTillId] = useState("");
  const [warehouse, setWarehouse] = useState("");

  const [search, setSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [actionsOpen, setActionsOpen] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [salesForDate, setSalesForDate] = useState([]);
  const [returnsForDate, setReturnsForDate] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [selectedReturnsAccount, setSelectedReturnsAccount] = useState("");
  const [selectedSalesAccount, setSelectedSalesAccount] = useState("");

  const [denomCounts, setDenomCounts] = useState(DENOMINATIONS.map(() => 0));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get("/pos/terminals"),
      api.get("/pos/next-voucher-no"),
      api.get("/finance/accounts", { params: { postable: 1, active: 1 } }),
    ])
      .then(([res, vRes, accRes]) => {
        if (cancelled) return;
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setTerminals(items);
        const nextVNo = String(vRes.data?.voucher_no || "").trim();
        if (nextVNo) setVoucherNo(nextVNo);

        const accounts = Array.isArray(accRes.data?.items)
          ? accRes.data.items
          : [];
        setAllAccounts(accounts);
      })
      .catch(() => {
        if (cancelled) return;
        setTerminals([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!tillId) return;
    const t = terminals.find((x) => String(x.id) === String(tillId));
    if (t && t.warehouse) {
      setWarehouse(String(t.warehouse));
    }
  }, [tillId, terminals]);

  useEffect(() => {
    const t = terminals.find((x) => String(x.id) === String(tillId));
    const terminalCode = String(t?.code || "").trim();
    if (!terminalCode || !voucherDate) {
      setDenomCounts(DENOMINATIONS.map(() => 0));
      return;
    }
    api
      .get("/pos/day/status", {
        params: { terminal: terminalCode, date: voucherDate },
      })
      .then((res) => {
        const item = res?.data?.item || null;
        const fromClose = item?.close_denomination_counts;
        const fromOpen = item?.open_denomination_counts;
        const counts = parseDenominationCounts(fromClose || fromOpen || null);
        setDenomCounts(counts);
      })
      .catch(() => setDenomCounts(DENOMINATIONS.map(() => 0)));
  }, [tillId, terminals, voucherDate]);

  const warehouseOptions = useMemo(() => {
    const unique = new Set();
    for (const t of terminals) {
      const w = String(t?.warehouse || "").trim();
      if (w) unique.add(w);
    }
    return Array.from(unique.values());
  }, [terminals]);

  const tillSelectOptions = useMemo(() => {
    const list = (Array.isArray(terminals) ? terminals : []).map((t) => {
      const code = String(t.code || "").trim();
      const name = String(t.name || "").trim();
      const label =
        code && name && code !== name
          ? `${code} - ${name}`
          : code || name || `Till ${t.id}`;
      return {
        value: String(t.id),
        label,
      };
    });
    return [{ value: "", label: "All Tills" }, ...list];
  }, [terminals]);

  const warehouseSelectOptions = useMemo(() => {
    const base = (Array.isArray(warehouseOptions) ? warehouseOptions : []).map(
      (w) => ({ value: String(w), label: String(w) }),
    );
    return [{ value: "", label: "All Warehouses" }, ...base];
  }, [warehouseOptions]);

  const filteredTransactions = useMemo(() => {
    const q = String(search || "").trim();
    if (!q) return transactions.slice();
    return filterAndSort(transactions, {
      query: q,
      getKeys: (t) => [t.account],
    });
  }, [transactions, search]);

  const visibleTransactions = useMemo(() => {
    const limit = Math.max(1, Number(rowsPerPage || 0) || 1);
    return filteredTransactions.slice(0, limit);
  }, [filteredTransactions, rowsPerPage]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, t) => {
        acc.credit += Number(t.credit || 0);
        acc.debit += Number(t.debit || 0);
        return acc;
      },
      { credit: 0, debit: 0 },
    );
  }, [transactions]);

  const salesReturnsImpact = useMemo(() => {
    const salesCount = Array.isArray(salesForDate) ? salesForDate.length : 0;
    const salesTotal = roundTo2(
      (Array.isArray(salesForDate) ? salesForDate : []).reduce(
        (s, x) => s + Number(x?.total_amount || 0),
        0,
      ),
    );
    const returnsCount = Array.isArray(returnsForDate)
      ? returnsForDate.length
      : 0;
    const returnsTotal = roundTo2(
      (Array.isArray(returnsForDate) ? returnsForDate : []).reduce(
        (s, x) => s + Number(x?.total_refund || 0),
        0,
      ),
    );
    const netSales = roundTo2(salesTotal - returnsTotal);
    return { salesCount, salesTotal, returnsCount, returnsTotal, netSales };
  }, [salesForDate, returnsForDate]);

  const denomTotals = useMemo(() => {
    return DENOMINATIONS.map((d, idx) =>
      roundTo2(d * Number(denomCounts[idx] || 0)),
    );
  }, [denomCounts]);

  const cashTotal = useMemo(() => {
    return roundTo2(denomTotals.reduce((sum, n) => sum + Number(n || 0), 0));
  }, [denomTotals]);

  function roundTo2(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function accountLabelFromAccountsById(accountsById, accountId) {
    const a = accountsById.get(String(accountId));
    if (!a) return String(accountId || "");
    const code = String(a.code || "").trim();
    const name = String(a.name || "").trim();
    if (code && name) return `${code} - ${name}`;
    return name || code || String(accountId || "");
  }

  function accountLabelFromAccountRef(accounts, accountsById, accountRef) {
    const raw = String(accountRef || "").trim();
    if (!raw) return "";
    const asId = Number(raw);
    if (Number.isFinite(asId) && asId > 0) {
      return accountLabelFromAccountsById(accountsById, asId);
    }
    const byCode = accounts.find((a) => String(a.code || "") === raw);
    if (byCode) return accountLabelFromAccountsById(accountsById, byCode.id);
    return raw;
  }

  function resolveAccountIdFromAccountRef(accounts, accountsById, accountRef) {
    const raw = String(accountRef || "").trim();
    if (!raw) return 0;
    const asId = Number(raw);
    if (Number.isFinite(asId) && asId > 0 && accountsById.has(String(asId))) {
      return asId;
    }
    const byCode = accounts.find((a) => String(a.code || "") === raw);
    if (byCode) return Number(byCode.id);
    return 0;
  }

  function pickDefaultSalesAccountId(incomeAccounts) {
    const sorted = Array.isArray(incomeAccounts) ? incomeAccounts.slice() : [];
    sorted.sort((a, b) => {
      const aCode = String(a?.code || "");
      const bCode = String(b?.code || "");
      const aName = String(a?.name || "").toLowerCase();
      const bName = String(b?.name || "").toLowerCase();

      const aIsSales =
        aName.includes("sales revenue") ||
        aName.includes("sales account") ||
        aCode === "4000" ||
        aCode === "400000";
      const bIsSales =
        bName.includes("sales revenue") ||
        bName.includes("sales account") ||
        bCode === "4000" ||
        bCode === "400000";
      const aIsReturn =
        aName.includes("return") || aName.includes("allowance");
      const bIsReturn =
        bName.includes("return") || bName.includes("allowance");

      const aScore = aIsSales
        ? 0
        : aIsReturn
          ? 4
          : aName.includes("sales")
            ? 1
            : aCode.startsWith("4")
              ? 2
              : 3;
      const bScore = bIsSales
        ? 0
        : bIsReturn
          ? 4
          : bName.includes("sales")
            ? 1
            : bCode.startsWith("4")
              ? 2
              : 3;

      if (aScore !== bScore) return aScore - bScore;
      return aCode.localeCompare(bCode);
    });
    const top = sorted[0];
    return top?.id ? Number(top.id) : 0;
  }

  function dateKey(value) {
    return String(value || "").slice(0, 10);
  }

  async function populateTransactions() {
    setLoading(true);
    try {
      const [salesRes, accountsRes, taxRes, paymentModesRes, returnsRes] =
        await Promise.all([
          api.get("/pos/sales", {
            params: {
              date: voucherDate,
              terminal_id: tillId ? Number(tillId) : undefined,
              warehouse: String(warehouse || "").trim() || undefined,
            },
          }),
          api
            .get("/finance/accounts", { params: { postable: 1, active: 1 } })
            .catch(() => ({ data: { items: [] } })),
          api.get("/pos/tax-settings").catch(() => ({ data: { item: null } })),
          api.get("/pos/payment-modes").catch(() => ({ data: { items: [] } })),
          api
            .get("/pos/returns", {
              params: {
                date: voucherDate,
                terminal_id: tillId ? Number(tillId) : undefined,
                warehouse: String(warehouse || "").trim() || undefined,
              },
            })
            .catch(() => ({ data: { items: [] } })),
        ]);

      const allSales = Array.isArray(salesRes.data?.items)
        ? salesRes.data.items
        : [];
      const allReturns = Array.isArray(returnsRes?.data?.items)
        ? returnsRes.data.items
        : [];

      const accounts = allAccounts.length
        ? allAccounts
        : Array.isArray(accountsRes.data?.items)
          ? accountsRes.data.items
          : [];
      if (!allAccounts.length && accounts.length) setAllAccounts(accounts);
      const accountsById = new Map(accounts.map((a) => [String(a.id), a]));
      const taxSettings = taxRes.data?.item || null;
      const paymentModes = Array.isArray(paymentModesRes.data?.items)
        ? paymentModesRes.data.items
        : [];

      const sales = allSales.filter((s) => {
        const status = String(s.payment_status || "").toUpperCase();
        const rawStatus = String(s.status || "").toUpperCase();
        const paid =
          status === "PAID" ||
          rawStatus === "COMPLETED" ||
          rawStatus === "PAID";
        const isCredit =
          String(s.payment_method || "").toUpperCase() === "CREDIT";
        const unpaidCredit = status === "UNPAID" && isCredit;
        const isSplit =
          String(s.payment_method || "").toUpperCase() === "SPLIT";
        return (
          paid ||
          unpaidCredit ||
          (status === "UNPAID" && isSplit) ||
          isCredit ||
          (!status && rawStatus === "COMPLETED")
        );
      });

      const returns = allReturns.slice();
      setSalesForDate(sales);
      setReturnsForDate(returns);

      if (!sales.length && !returns.length) {
        setTransactions([]);
        setSalesForDate([]);
        setReturnsForDate([]);
        toast.error(
          `No POS sales or returns found for date ${voucherDate || "-"}${
            tillId ? " (filtered by till)" : ""
          }`,
        );
        return;
      }

      let taxComponents = [];
      if (taxSettings?.tax_code_id) {
        try {
          const compRes = await api.get(
            `/finance/tax-codes/${taxSettings.tax_code_id}/components`,
          );
          if (Array.isArray(compRes.data?.items)) {
            taxComponents = compRes.data.items;
          }
        } catch (err) {
          console.warn("Failed to fetch tax components", err);
        }
      }

      const taxMode = String(
        taxSettings?.tax_type || "Exclusive",
      ).toLowerCase();
      const taxActive =
        taxSettings && Number(taxSettings.is_active) === 0 ? 0 : 1;

      const taxAccountId =
        taxActive && Number(taxSettings?.tax_account_id || 0) > 0
          ? Number(taxSettings.tax_account_id)
          : 0;

      const incomeAccounts = accounts.filter(
        (a) =>
          String(a.nature || "").toUpperCase() === "INCOME" ||
          String(a.code || "").startsWith("4"),
      );
      const defaultSalesAccountId = pickDefaultSalesAccountId(incomeAccounts);
      const salesAccountId = selectedSalesAccount
        ? Number(selectedSalesAccount)
        : defaultSalesAccountId ||
          accounts.find((a) => String(a.code || "").startsWith("4"))?.id ||
          accounts[0]?.id;
      if (!salesAccountId) {
        throw new Error(
          "Sales revenue account not found. Please select an account in the Sales Account field above.",
        );
      }

      let totalSalesBase = 0;
      let totalTax = 0;
      let rawNetTotal = 0;
      let rawTaxTotal = 0;
      const paymentTotals = new Map();
      const componentTotals = new Map();

      // Process Sales
      for (const s of sales) {
        const gross = Number(s.gross_amount || 0);
        const discount = Number(s.discount_amount || 0);
        const subtotal = roundTo2(gross - discount);
        const tax = roundTo2(Number(s.tax_amount || 0));
        const total = roundTo2(Number(s.total_amount || 0));
        rawNetTotal = roundTo2(rawNetTotal + total);
        rawTaxTotal = roundTo2(rawTaxTotal + tax);

        let base = subtotal;
        if (taxActive && taxMode === "inclusive" && tax > 0 && subtotal > 0) {
          base = roundTo2(subtotal - tax);
        }

        totalSalesBase = roundTo2(totalSalesBase + Math.max(0, base));
        totalTax = roundTo2(totalTax + Math.max(0, tax));

        // Calculate tax per component
        if (taxActive && taxComponents.length > 0 && tax > 0) {
          for (const comp of taxComponents) {
            const rate = Number(comp.rate_percent || 0);
            const compTax = roundTo2((base * rate) / 100);
            if (compTax > 0) {
              componentTotals.set(
                comp.id,
                roundTo2((componentTotals.get(comp.id) || 0) + compTax),
              );
            }
          }
        }

        let paymentsRaw = s.payments;
        if (typeof paymentsRaw === "string") {
          try {
            paymentsRaw = JSON.parse(paymentsRaw);
          } catch {
            paymentsRaw = null;
          }
        }
        if (Array.isArray(paymentsRaw) && paymentsRaw.length > 0) {
          paymentsRaw.forEach((p) => {
            const pm = String(p.method || p.type || "CASH").toUpperCase();
            paymentTotals.set(
              pm,
              roundTo2((paymentTotals.get(pm) || 0) + Number(p.amount || 0)),
            );
          });
        } else {
          const method = String(s.payment_method || "CASH").toUpperCase();
          paymentTotals.set(
            method,
            roundTo2((paymentTotals.get(method) || 0) + total),
          );
        }
      }

      // Process Returns (Subtract from totals)
      const returnTotal = roundTo2(
        returns.reduce((s, r) => s + Number(r?.total_refund || 0), 0),
      );
      const taxRatio = rawNetTotal > 0 ? rawTaxTotal / rawNetTotal : 0;
      const returnsTaxTotal = roundTo2(returnTotal * taxRatio);
      const returnsBaseTotal = roundTo2(returnTotal - returnsTaxTotal);

      totalSalesBase = roundTo2(totalSalesBase - returnsBaseTotal);
      totalTax = roundTo2(totalTax - returnsTaxTotal);

      if (taxActive && taxComponents.length > 0 && returnsTaxTotal > 0) {
        for (const comp of taxComponents) {
          const rate = Number(comp.rate_percent || 0);
          const compTax = roundTo2((returnsBaseTotal * rate) / 100);
          if (compTax > 0) {
            componentTotals.set(
              comp.id,
              roundTo2((componentTotals.get(comp.id) || 0) - compTax),
            );
          }
        }
      }

      for (const r of returns) {
        const total = roundTo2(Number(r?.total_refund || 0));
        const method = String(r?.refund_method || "CASH").toUpperCase();
        paymentTotals.set(
          method,
          roundTo2((paymentTotals.get(method) || 0) - total),
        );
      }

      let componentMappings = {};
      if (taxSettings?.component_mappings) {
        try {
          componentMappings =
            typeof taxSettings.component_mappings === "string"
              ? JSON.parse(taxSettings.component_mappings)
              : taxSettings.component_mappings;
        } catch (e) {
          componentMappings = {};
        }
      }

      const useComponentBreakdown =
        taxComponents.length > 0 && Object.keys(componentMappings).length > 0;

      let next = [];
      if (Math.abs(totalSalesBase) >= 0.01) {
        next.push({
          account_id: salesAccountId,
          account: accountLabelFromAccountsById(accountsById, salesAccountId),
          credit: totalSalesBase > 0 ? totalSalesBase : 0,
          debit: totalSalesBase < 0 ? Math.abs(totalSalesBase) : 0,
        });
      }

      if (Math.abs(totalTax) >= 0.01) {
        if (useComponentBreakdown) {
          for (const [compId, amt] of componentTotals.entries()) {
            const compAccountId = Number(componentMappings[compId] || 0);
            if (!compAccountId) continue;
            if (Math.abs(amt) < 0.01) continue;
            next.push({
              account_id: compAccountId,
              account: accountLabelFromAccountsById(
                accountsById,
                compAccountId,
              ),
              credit: amt > 0 ? amt : 0,
              debit: amt < 0 ? Math.abs(amt) : 0,
            });
          }
        } else if (taxAccountId) {
          next.push({
            account_id: taxAccountId,
            account: accountLabelFromAccountsById(accountsById, taxAccountId),
            credit: totalTax > 0 ? totalTax : 0,
            debit: totalTax < 0 ? Math.abs(totalTax) : 0,
          });
        }
      }

      const paymentModeByType = new Map();
      for (const pm of paymentModes) {
        if (Number(pm.is_active) === 0) continue;
        const t = String(pm.type || "").toLowerCase();
        const n = String(pm.name || "").toLowerCase();
        
        if (!paymentModeByType.has(t)) paymentModeByType.set(t, pm);
        
        // Ensure "credit" maps to a credit payment mode even if its type is "cash"
        if (["credit", "on account", "account"].some((k) => n.includes(k))) {
          paymentModeByType.set("credit", pm);
        }
      }

      for (const [method, amt] of paymentTotals.entries()) {
        if (Math.abs(amt) < 0.01) continue;
        const pmKey = String(method).toLowerCase();
        const pm = paymentModeByType.get(pmKey);
        const payAccId = resolveAccountIdFromAccountRef(
          accounts,
          accountsById,
          pm?.account,
        );
        const payLabel = accountLabelFromAccountRef(
          accounts,
          accountsById,
          pm?.account,
        );
        if (!payLabel) {
          console.warn(`Missing account mapping for payment method: ${method}`);
          continue;
        }
        next.push({
          account_id: payAccId || undefined,
          account: payLabel,
          credit: amt < 0 ? Math.abs(amt) : 0,
          debit: amt > 0 ? amt : 0,
        });
      }

      setTransactions(next);
      toast.success(`Successfully populated ${sales.length} transaction(s)`);
    } catch (e) {
      setTransactions([]);
      toast.error(String(e?.message || "Failed to populate transactions"));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setVoucherNo("");
    setTransactions([]);
    setSearch("");
    setSelectedReturnsAccount("");
    setSelectedSalesAccount("");
  }

  function postToFinance() {
    const till = terminals.find((x) => String(x.id) === String(tillId));
    const tillLabel = till ? String(till.code || till.name || "").trim() : "";
    const vNo = String(voucherNo || "").trim() || "Auto-generated";
    const vDate = voucherDate;
    const wh = String(warehouse || "").trim() || "-";
    const totalAmount = totals.debit > 0 ? totals.debit.toFixed(2) : totals.credit.toFixed(2);
    const cTotal = cashTotal.toFixed(2);
    const ok = window.confirm(
      `Post transaction to finance?\n\nVoucher: ${vNo}\nDate: ${vDate}\nTill: ${
        tillLabel || "All Tills"
      }\nWarehouse: ${wh}\nTotal Amount: GH₵ ${totalAmount}${
        cashTotal > 0 ? `\nCash Denominations: GH₵ ${cTotal}` : ""
      }`,
    );
    if (!ok) return;
    setLoading(true);
    api
      .post("/pos/finance-post", {
        date: voucherDate,
        terminal_id: tillId ? Number(tillId) : undefined,
        warehouse: String(warehouse || "").trim() || undefined,
        lines: (Array.isArray(transactions) ? transactions : []).map((t) => ({
          account_id: t.account_id ? Number(t.account_id) : undefined,
          account: String(t.account || ""),
          debit: Number(t.debit || 0),
          credit: Number(t.credit || 0),
        })),
      })
      .then((res) => {
        const vn = res?.data?.voucher_no || vNo;
        toast.success(
          `Transaction posted to finance successfully! Voucher: ${vn}`,
        );
        resetForm();
      })
      .catch((e) => {
        const msg =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Failed to post to finance";
        window.alert(msg);
      })
      .finally(() => setLoading(false));
  }

  const paginationText = useMemo(() => {
    const start = visibleTransactions.length ? 1 : 0;
    const end = visibleTransactions.length;
    return `${start} - ${end}`;
  }, [visibleTransactions.length]);

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
        >
          ← Back to POS
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
          POS Finance Posting
        </h1>
      </div>

      <div className="card">
        <div className="card-body space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Voucher no.</label>
              <input
                className="input"
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
                placeholder="Auto-generated"
              />
            </div>
            <div>
              <label className="label">Voucher Date</label>
              <input
                className="input"
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Till</label>
              <FilterableSelect
                value={tillId}
                onChange={(val) => {
                  const next = String(val || "");
                  setTillId(next);
                  if (!next) {
                    setWarehouse("");
                  } else {
                    const t = terminals.find(
                      (x) => String(x.id) === String(next),
                    );
                    if (t) setWarehouse(String(t.warehouse || ""));
                  }
                }}
                options={tillSelectOptions}
                placeholder={!terminals.length ? "Loading..." : "Select till"}
                disabled={loading || !terminals.length}
              />
            </div>
            <div>
              <label className="label">Warehouse</label>
              <FilterableSelect
                value={warehouse}
                onChange={(val) => setWarehouse(String(val || ""))}
                options={warehouseSelectOptions}
                placeholder={!warehouseSelectOptions.length ? "-" : "Select"}
                disabled={loading || !warehouseSelectOptions.length}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Sales Account (Credit)</label>
              <select
                className="input"
                value={selectedSalesAccount}
                onChange={(e) => setSelectedSalesAccount(e.target.value)}
              >
                <option value="">Default Sales Revenue Account</option>
                {allAccounts
                  .filter(
                    (a) =>
                      String(a.nature || "").toUpperCase() === "INCOME" ||
                      String(a.code || "").match(/^40/),
                  )
                  .map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.code} — {a.name}
                    </option>
                  ))}
              </select>
              <small className="text-slate-500 mt-1 block">
                Account to be credited for sales revenue
              </small>
            </div>
            <div>
              <label className="label">POS Returns Account (Debit)</label>
              <select
                className="input"
                value={selectedReturnsAccount}
                onChange={(e) => setSelectedReturnsAccount(e.target.value)}
              >
                <option value="">Default Sales Returns / Contra Account</option>
                {allAccounts
                  .filter(
                    (a) =>
                      String(a.nature || "").toUpperCase() === "EXPENSE" ||
                      String(a.nature || "").toUpperCase() === "INCOME",
                  )
                  .map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.code} — {a.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <button
              type="button"
              className="btn-primary"
              onClick={populateTransactions}
              disabled={loading}
            >
              POPULATE DATA
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-5">
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <input
                    className="input"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={populateTransactions}
                  disabled={loading}
                >
                  Go
                </button>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-slate-600">Rows</div>
                  <select
                    className="input"
                    value={String(rowsPerPage)}
                    onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setActionsOpen((v) => !v)}
                  >
                    Actions ▼
                  </button>
                  {actionsOpen && (
                    <div className="absolute right-0 mt-2 w-40 rounded border border-slate-200 bg-white shadow-lg z-10">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                        onClick={() => {
                          setActionsOpen(false);
                          resetForm();
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="rounded border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Paid Sales</div>
                  <div className="text-sm font-semibold">
                    {`GH₵ ${salesReturnsImpact.salesTotal.toFixed(2)}`}
                  </div>
                  <div className="text-xs text-slate-500">
                    {`${salesReturnsImpact.salesCount} txns`}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">POS Returns</div>
                  <div className="text-sm font-semibold text-red-700">
                    {`GH₵ ${salesReturnsImpact.returnsTotal.toFixed(2)}`}
                  </div>
                  <div className="text-xs text-slate-500">
                    {`${salesReturnsImpact.returnsCount} returns`}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Net Sales</div>
                  <div className="text-sm font-semibold">
                    {`GH₵ ${salesReturnsImpact.netSales.toFixed(2)}`}
                  </div>
                  <div className="text-xs text-slate-500">
                    {`Date: ${voucherDate || "-"}`}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Voucher Debit</div>
                  <div className="text-sm font-semibold">
                    {totals.debit.toFixed(2)}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">Voucher Credit</div>
                  <div className="text-sm font-semibold">
                    {totals.credit.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="text-left p-2 text-xs uppercase">Sr No</th>
                      <th className="text-left p-2 text-xs uppercase">
                        Account Name
                      </th>
                      <th className="text-right p-2 text-xs uppercase">
                        Credit
                      </th>
                      <th className="text-right p-2 text-xs uppercase">
                        Debit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {!transactions.length ? (
                      <tr>
                        <td
                          className="p-10 text-center text-slate-500"
                          colSpan={4}
                        >
                          Click "POPULATE DATA" to load transactions
                        </td>
                      </tr>
                    ) : (
                      <>
                        {visibleTransactions.map((t, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2 text-center">{idx + 1}</td>
                            <td className="p-2">{t.account}</td>
                            <td className="p-2 text-right">
                              {Number(t.credit || 0) > 0
                                ? Number(t.credit || 0).toFixed(2)
                                : ""}
                            </td>
                            <td className="p-2 text-right">
                              {Number(t.debit || 0) > 0
                                ? Number(t.debit || 0).toFixed(2)
                                : ""}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t bg-slate-50 font-semibold">
                          <td className="p-2" />
                          <td className="p-2" />
                          <td className="p-2 text-right">
                            {totals.credit.toFixed(2)}
                          </td>
                          <td className="p-2 text-right">
                            {totals.debit.toFixed(2)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end text-xs text-slate-600">
                {paginationText}
              </div>

              <div className="overflow-x-auto rounded border border-slate-200">
                <div className="px-3 py-2 bg-slate-50 flex items-center justify-between">
                  <div className="text-sm font-semibold">POS Returns</div>
                  <div className="text-xs text-slate-600">
                    {`${salesReturnsImpact.returnsCount} returns • GH₵ ${salesReturnsImpact.returnsTotal.toFixed(2)}`}
                  </div>
                </div>
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="text-left p-2 text-xs uppercase">
                        Return #
                      </th>
                      <th className="text-left p-2 text-xs uppercase">Time</th>
                      <th className="text-left p-2 text-xs uppercase">
                        Refund Method
                      </th>
                      <th className="text-left p-2 text-xs uppercase">
                        Sale Receipt
                      </th>
                      <th className="text-right p-2 text-xs uppercase">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {!returnsForDate.length ? (
                      <tr>
                        <td
                          className="p-6 text-center text-slate-500"
                          colSpan={5}
                        >
                          No returns for selected date
                        </td>
                      </tr>
                    ) : (
                      returnsForDate.map((r) => {
                        const dt = String(r.return_datetime || "");
                        const time = dt.includes("T")
                          ? dt.split("T")[1].slice(0, 8)
                          : dt.slice(11, 19);
                        return (
                          <tr key={String(r.id)} className="border-t">
                            <td className="p-2">
                              {String(r.receipt_no || r.id || "-")}
                            </td>
                            <td className="p-2">{time || "-"}</td>
                            <td className="p-2">
                              {String(r.refund_method || "").toUpperCase() ||
                                "-"}
                            </td>
                            <td className="p-2">
                              {String(r.sale_receipt_no || "-")}
                            </td>
                            <td className="p-2 text-right">
                              {Number(r.total_refund || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg bg-brand text-white p-4 h-fit">
              <div className="text-center text-base font-semibold">
                Denomination Cash Count
              </div>
              <div className="text-center text-xs mt-1 text-white/80">
                Populated from Start/Close Day or enter counts below
              </div>
              <div className="mt-4 space-y-2">
                {DENOMINATIONS.map((d, idx) => (
                  <div
                    key={String(d)}
                    className="grid grid-cols-[1fr_80px_90px] gap-2 items-center"
                  >
                    <div className="text-sm">{`GHS ${Number(d).toFixed(
                      2,
                    )}`}</div>
                    <input
                      type="number"
                      min="0"
                      className="w-full rounded px-2 py-1 bg-white text-slate-900 text-right text-sm border-0 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      value={denomCounts[idx] === 0 ? "" : denomCounts[idx]}
                      placeholder="0"
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setDenomCounts((prev) => {
                          const nextArr = [...prev];
                          nextArr[idx] = val;
                          return nextArr;
                        });
                      }}
                    />
                    <div className="rounded px-2 py-1 bg-white/20 text-right text-sm">
                      {denomTotals[idx].toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded bg-white/20 px-3 py-3 flex items-center justify-between font-semibold">
                <div>TOTAL:</div>
                <div>{cashTotal.toFixed(2)}</div>
              </div>
              <button
                type="button"
                className="btn-primary w-full mt-4"
                onClick={postToFinance}
                disabled={loading || !transactions.length}
              >
                POST TO FINANCE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
