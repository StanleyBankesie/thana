/**
 * @fileoverview PosRegister component.
 * Provides functionality for PosRegister.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../../api/client.js";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { getAllLocalSales } from "../../../../offline/posStore.js";

function FilterableSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  filterPlaceholder,
}) {
  const filtered = Array.isArray(options) ? options : [];
  return (
    <div>
      <select
        className="input w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder || "All"}</option>
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
export default function PosRegister() {
  const { user } = useAuth();
  const { canPerformAction } = usePermission();
  const [now, setNow] = useState(new Date());
  const [dateFrom, setDateFrom] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [dateTo, setDateTo] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [terminalCode, setTerminalCode] = useState("");
  const [assignedTerminals, setAssignedTerminals] = useState([]);
  const [terminalsLoading, setTerminalsLoading] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [sessionDetail, setSessionDetail] = useState({
    open: false,
    mode: "details",
    index: -1,
    item: null,
  });

  const cashierName = useMemo(() => {
    const name = user?.username || user?.name || user?.fullName || "Cashier";
    return String(name);
  }, [user]);
  const sessionModalItem = useMemo(() => {
    if (!sessionDetail.open) return null;
    if (sessionDetail.index >= 0 && sessionDetail.index < sessionHistory.length) {
      return sessionHistory[sessionDetail.index];
    }
    return sessionDetail.item;
  }, [sessionDetail.open, sessionDetail.index, sessionDetail.item, sessionHistory]);

  function fmtCurrency(n) {
    return `₵${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  function normalizeDaySummary(summary) {
    const s = summary || {};
    return {
      cashCount: Number(s.cashCount || 0),
      cashAmount: Number(s.cashAmount || 0),
      cardCount: Number(s.cardCount || 0),
      cardAmount: Number(s.cardAmount || 0),
      mobileCount: Number(s.mobileCount || 0),
      mobileAmount: Number(s.mobileAmount || 0),
    };
  }
  function diffDaySummary(endSummary, startSummary) {
    const end = normalizeDaySummary(endSummary);
    const start = normalizeDaySummary(startSummary);
    const diff = (a, b) => Math.max(0, Number(a || 0) - Number(b || 0));
    return {
      cashCount: diff(end.cashCount, start.cashCount),
      cashAmount: diff(end.cashAmount, start.cashAmount),
      cardCount: diff(end.cardCount, start.cardCount),
      cardAmount: diff(end.cardAmount, start.cardAmount),
      mobileCount: diff(end.mobileCount, start.mobileCount),
      mobileAmount: diff(end.mobileAmount, start.mobileAmount),
    };
  }
  function sessionSalesTotals(session) {
    // Use server-computed breakdown when available (provides accurate per-method totals)
    if (session?.salesBreakdown) {
      const sb = session.salesBreakdown;
      const totalCount = Number(sb.cashCount || 0) + Number(sb.cardCount || 0) + Number(sb.mobileCount || 0);
      const totalAmount = Number(sb.cashAmount || 0) + Number(sb.cardAmount || 0) + Number(sb.mobileAmount || 0);
      const expectedCashAtClose = session?.status === "Closed" && session?.expectedCash !== null && session?.expectedCash !== undefined
        ? Number(session.expectedCash || 0) : Number(session?.opening || 0) + Number(sb.cashAmount || 0);
      const actualCashAtClose = session?.status === "Closed" && session?.actualCash !== null && session?.actualCash !== undefined
        ? Number(session.actualCash || 0) : session?.actualCash === null || session?.actualCash === undefined ? null : Number(session.actualCash || 0);
      const cashVarianceAtClose = session?.status === "Closed" && session?.cashVariance !== null && session?.cashVariance !== undefined
        ? Number(session.cashVariance || 0) : actualCashAtClose === null ? null : actualCashAtClose - expectedCashAtClose;
      return { diff: sb, totalCount, totalAmount, expectedCashAtClose, actualCashAtClose, cashVarianceAtClose };
    }
    // Fallback: compute from start/end summaries (legacy)
    const hasStartSummary = session?.startSummary !== null && session?.startSummary !== undefined;
    const end = session?.endSummary || { cashCount: 0, cashAmount: 0, cardCount: 0, cardAmount: 0, mobileCount: 0, mobileAmount: 0 };
    const d = hasStartSummary ? diffDaySummary(end, session?.startSummary || null) : { cashCount: 0, cashAmount: 0, cardCount: 0, cardAmount: 0, mobileCount: 0, mobileAmount: 0 };
    const totalCount = Number(d.cashCount || 0) + Number(d.cardCount || 0) + Number(d.mobileCount || 0);
    const computedTotalAmount = Number(d.cashAmount || 0) + Number(d.cardAmount || 0) + Number(d.mobileAmount || 0);
    const totalAmount = hasStartSummary ? computedTotalAmount : Number(session?.sales || 0);
    const expectedCashAtClose = session?.status === "Closed" && session?.expectedCash !== null && session?.expectedCash !== undefined
      ? Number(session.expectedCash || 0) : Number(session?.opening || 0) + Number(d.cashAmount || 0);
    const actualCashAtClose = session?.status === "Closed" && session?.actualCash !== null && session?.actualCash !== undefined
      ? Number(session.actualCash || 0) : session?.actualCash === null || session?.actualCash === undefined ? null : Number(session.actualCash || 0);
    const cashVarianceAtClose = session?.status === "Closed" && session?.cashVariance !== null && session?.cashVariance !== undefined
      ? Number(session.cashVariance || 0) : actualCashAtClose === null ? null : actualCashAtClose - expectedCashAtClose;
    return { diff: d, totalCount, totalAmount, expectedCashAtClose, actualCashAtClose, cashVarianceAtClose };
  }

  useEffect(() => {
    let cancelled = false;
    const term = terminalCode;
    if (!term) return undefined;
    const params = { terminal: term };
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    api.get("/pos/day/history", { params })
      .then((res) => {
        if (cancelled) return;
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        const mapped = items.map((item) => {
          const isOpen = String(item.status || "").toUpperCase() === "OPEN";
          const opening = Number(item.opening_float || 0);
          const actualCash = item.actual_cash === null || item.actual_cash === undefined ? null : Number(item.actual_cash || 0);
          const cashSales = Number(item.cash_amount || 0);
          let expectedCash = null;
          let cashVariance = null;
          if (!isOpen) {
            expectedCash = opening + cashSales;
            cashVariance = actualCash !== null ? actualCash - expectedCash : null;
          }
          const mobileSales = Number(item.mobile_amount || 0);
          const momoOpenMain = Number(item.momo_opening_main || 0);
          const momoOpenPay = Number(item.momo_opening_pay || 0);
          const momoOpeningTotal =
            item.momo_opening_balance !== null && item.momo_opening_balance !== undefined
              ? Number(item.momo_opening_balance)
              : momoOpenMain + momoOpenPay;
          const storedActualMoMo = item.actual_momo === null || item.actual_momo === undefined ? null : Number(item.actual_momo);
          let expectedMoMo = null;
          let momoVariance = null;
          if (!isOpen && storedActualMoMo !== null) {
            expectedMoMo = momoOpeningTotal + mobileSales;
            momoVariance = storedActualMoMo - expectedMoMo;
          }
          return {
            dayStatusId: Number(item.id || 0) || null,
            no: `DAY-${String(item.id || "").padStart(6, "0")}`,
            terminal: String(item.terminal_code || term || ""),
            cashier: String(item.created_by_name || cashierName),
            start: item.open_datetime ? new Date(item.open_datetime).toLocaleString() : "-",
            startTime: item.open_datetime || null,
            end: item.close_datetime ? new Date(item.close_datetime).toLocaleString() : "-",
            endTime: item.close_datetime || null,
            opening,
            status: isOpen ? "Open" : "Closed",
            startSummary: normalizeDaySummary({}),
            endSummary: null,
            expectedCash,
            actualCash,
            cashVariance,
            openingMoMo: momoOpeningTotal,
            totalMomoSales: mobileSales,
            expectedMoMo,
            actualMoMo: storedActualMoMo,
            momoVariance,
            closeNotes: item.close_notes || "",
            sales: Number(item.total_sales || 0),
            cashSales,
            salesBreakdown: {
              cashAmount: cashSales,
              cashCount: Number(item.cash_count || 0),
              cardAmount: Number(item.card_amount || 0),
              cardCount: Number(item.card_count || 0),
              mobileAmount: mobileSales,
              mobileCount: Number(item.mobile_count || 0),
            },
          };
        });
        setSessionHistory(mapped);
      })
      .catch(() => { setSessionHistory([]); });
    return () => { cancelled = true; };
  }, [terminalCode, cashierName, dateFrom, dateTo]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAssignedTerminals() {
      setTerminalsLoading(true);
      try {
        const [termsRes, linksRes] = await Promise.all([
          api.get("/pos/terminals"),
          api.get("/pos/terminal-users"),
        ]);
        if (cancelled) return;
        const allTerminals = Array.isArray(termsRes.data?.items)
          ? termsRes.data.items
          : [];
        const links = Array.isArray(linksRes.data?.items)
          ? linksRes.data.items
          : [];
        const uid =
          Number(user?.sub || 0) || Number(user?.id || 0) || undefined;
        const assignedIds = new Set(
          links
            .filter((x) => Number(x?.user_id) === uid)
            .map((x) => Number(x?.terminal_id))
            .filter((n) => Number.isFinite(n) && n > 0),
        );
        const assigned = allTerminals.filter((t) =>
          assignedIds.has(Number(t?.id)),
        );
        setAssignedTerminals(assigned);
        const code =
          (assigned.length ? String(assigned[0]?.code || "") : "") || "";
        setTerminalCode(code);
      } catch {
        if (cancelled) return;
        setAssignedTerminals([]);
        setTerminalCode("");
      } finally {
        if (cancelled) return;
        setTerminalsLoading(false);
      }
    }
    loadAssignedTerminals();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.sub]);

  useEffect(() => {
    let cancelled = false;

    async function loadTransactions() {
      let serverMapped = [];
      try {
        const params = terminalCode ? { params: { terminal: terminalCode } } : {};
        const res = await api.get("/pos/sales", params);
        const rows = Array.isArray(res.data?.items) ? res.data.items : [];
        serverMapped = rows.map((it) => {
          const dt = String(it.sale_date || "");
          const date = dt.slice(0, 10);
          const time = dt.includes("T") ? dt.split("T")[1].slice(0, 8) : "";
          return {
            id: it.id,
            receiptNo: String(it.receipt_no || it.sale_no || ""),
            date,
            time,
            customer: String(it.customer_name || ""),
            phone: "",
            payment: (() => {
              const pmts = it.payments;
              if (Array.isArray(pmts) && pmts.length > 1) {
                return pmts.map((p) => String(p.method || "").toLowerCase()).join("+");
              }
              return String(it.payment_method || "").toLowerCase();
            })(),
            status: String(it.payment_status || "").toLowerCase(),
            items: [],
            total_amount: Number(it.gross_amount || 0) + Number(it.tax_amount || 0) - Number(it.discount_amount || 0),
            net_after_returns: Number(
              it.net_after_returns !== null && it.net_after_returns !== undefined
                ? it.net_after_returns
                : Number(it.gross_amount || 0) + Number(it.tax_amount || 0) - Number(it.discount_amount || 0),
            ),
            return_total: Number(it.return_total || 0),
            items_count: Number(it.items_count || 0),
            has_returns: Boolean(it.has_returns),
          };
        });
      } catch {}

      let localMapped = [];
      try {
        const localSales = await getAllLocalSales();
        const pendingLocal = localSales.filter(
          (s) => s.status === "pending" || s.syncStatus === "pending" || s.status === "failed",
        );
        localMapped = pendingLocal.map((ls) => {
          const dt = ls.createdAt ? new Date(ls.createdAt).toISOString() : new Date().toISOString();
          const date = dt.slice(0, 10);
          const time = dt.includes("T") ? dt.split("T")[1].slice(0, 8) : "";
          const totalAmt = Number(ls.net_amount || ls.gross_amount || 0) ||
            (ls.items || []).reduce((sum, i) => sum + Number(i.unit_price || 0) * Number(i.quantity || 0), 0);
          return {
            id: ls.id,
            receiptNo: String(ls.receipt_no || ls.id || "OFFLINE"),
            date,
            time,
            customer: String(ls.customer_name || "Walk-in"),
            phone: "",
            payment: String(ls.payment_mode || "cash").toLowerCase(),
            status: "pending (offline)",
            items: ls.items || [],
            total_amount: totalAmt,
            net_after_returns: totalAmt,
            return_total: 0,
            items_count: (ls.items || []).length,
            has_returns: false,
            isOffline: true,
          };
        });
      } catch {}

      if (!cancelled) {
        setTransactions([...localMapped, ...serverMapped]);
      }
    }

    loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [terminalCode]);

  const calculateTotal = (items) => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const tax = subtotal * 0.125;
    return subtotal + tax;
  };
  const calculateSubtotal = (items) =>
    items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const filtered = useMemo(() => {
    const q = String(searchTerm || "").trim();
    let base = transactions.filter((t) => {
      const okDate =
        (!dateFrom || t.date >= dateFrom) && (!dateTo || t.date <= dateTo);
      const okStatus = !statusFilter || t.status === statusFilter;
      const okPayment = !paymentFilter || t.payment === paymentFilter;
      return okDate && okStatus && okPayment;
    });
    if (!q) return base;
    return filterAndSort(base, {
      query: q,
      getKeys: (t) => [t.receiptNo, t.customer],
    });
  }, [transactions, dateFrom, dateTo, statusFilter, paymentFilter, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageItems = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filtered.slice(start, end);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, statusFilter, paymentFilter, searchTerm]);

  function exportToCSV() {
    const headers = [
      "Receipt",
      "Date",
      "Time",
      "Customer",
      "Phone",
      "Payment",
      "Status",
      "Items",
      "Total",
    ];
    const rows = filtered.map((t) => [
      t.receiptNo,
      t.date,
      t.time,
      t.customer,
      t.phone,
      t.payment,
      t.status,
      t.items.reduce((s, i) => s + i.quantity, 0),
      calculateTotal(t.items).toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pos_register.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function printRegister() {
    window.print();
  }

  function closeRegister() {
    alert("Register closing flow will be implemented with sessions.");
  }

  function printTransaction(id) {
    alert("Printing transaction " + id);
  }

  function deleteTransaction(id) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  async function openDetails(t) {
    try {
      const res = await api.get(`/pos/sales/${t.id}`);
      const details = Array.isArray(res.data?.details) ? res.data.details : [];
      const items = details.map((d) => ({
        name: String(d.item_name || ""),
        price: Number(d.unit_price || 0),
        quantity: Number(d.qty || 0),
        returned_qty: Number(d.returned_qty || 0),
      }));
      setSelected({ ...t, items });
    } catch {
      setSelected(t);
    }
  }

  function closeModal() {
    setSelected(null);
  }

  function printReceipt() {
    alert("Printing receipt " + String(selected?.receiptNo || ""));
  }

  function emailReceipt() {
    alert("Emailing receipt " + String(selected?.receiptNo || ""));
  }

  const showingFrom = filtered.length ? (page - 1) * itemsPerPage + 1 : 0;
  const showingTo = Math.min(page * itemsPerPage, filtered.length);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/pos?section=Transactions"
            className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 inline-flex items-center gap-1"
          >
            ← Back to POS
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            POS Register
          </h1>
          <p className="text-sm mt-1">Transactions listing and details</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-700">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="text-sm font-semibold text-brand-700">
            {now.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 flex-1">
            <div className="min-w-0">
              <label className="label">Terminal</label>
              <FilterableSelect
                value={terminalCode}
                onChange={setTerminalCode}
                placeholder={
                  terminalsLoading
                    ? "Loading terminals..."
                    : "All Terminals (assigned)"
                }
                options={(Array.isArray(assignedTerminals)
                  ? assignedTerminals
                  : []
                ).map((t) => ({
                  value: String(t.code || ""),
                  label: String(t.code || t.name || ""),
                }))}
                disabled={terminalsLoading}
                filterPlaceholder="Filter terminals..."
              />
            </div>
            <div className="min-w-0">
              <label className="label">From</label>
              <input
                type="date"
                className="input w-full"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label className="label">To</label>
              <input
                type="date"
                className="input w-full"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <label className="label">Status</label>
              <FilterableSelect
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="All Status"
                options={[
                  { value: "completed", label: "Completed" },
                  { value: "pending", label: "Pending" },
                  { value: "returned", label: "Returned" },
                ]}
                filterPlaceholder="Filter status..."
              />
            </div>
            <div className="min-w-0">
              <label className="label">Payment</label>
              <FilterableSelect
                value={paymentFilter}
                onChange={setPaymentFilter}
                placeholder="All Payments"
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "card", label: "Card" },
                  { value: "mobile", label: "Mobile Money" },
                ]}
                filterPlaceholder="Filter payments..."
              />
            </div>
            <div className="min-w-0 md:col-span-2">
              <label className="label">Search</label>
              <input
                className="input w-full"
                placeholder="Search receipt or customer"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-success" onClick={exportToCSV}>
              Export CSV
            </button>
            <button className="btn-primary" onClick={printRegister}>
              Print
            </button>
            <button className="btn-danger" onClick={closeRegister}>
              Close Register
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Session History</div>
          <div className="text-2xl">📊</div>
        </div>
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Session #</th>
                  <th>Terminal</th>
                  <th>Cashier</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Total Sales</th>
                  <th>Opening Cash</th>
                  <th>Total Cash Sales</th>
                  <th>Actual Cash</th>
                  <th>Cash Variance</th>
                  <th>Opening MoMo</th>
                  <th>Total MoMo Sales</th>
                  <th>Actual MoMo</th>
                  <th>MoMo Variance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!sessionHistory.length ? (
                  <tr>
                    <td colSpan="16">
                      <div className="text-center text-slate-600 py-6">
                        No session history found
                      </div>
                    </td>
                  </tr>
                ) : (
                  sessionHistory.map((h, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{h.no}</td>
                      <td className="p-2">{h.terminal}</td>
                      <td className="p-2">{h.cashier}</td>
                      <td className="p-2">{h.start}</td>
                      <td className="p-2">{h.end}</td>
                      <td className="p-2">{fmtCurrency(Number(h.sales || 0))}</td>
                      <td className="p-2">{fmtCurrency(h.opening)}</td>
                      <td className="p-2">{fmtCurrency(Number(h.cashSales || 0))}</td>
                      <td className="p-2">
                        {h.actualCash !== null ? fmtCurrency(h.actualCash) : "-"}
                      </td>
                      <td className="p-2">
                        {h.cashVariance !== null ? (
                          <span style={{ color: h.cashVariance >= 0 ? "#28a745" : "#dc3545", fontWeight: 700 }}>
                            {fmtCurrency(h.cashVariance)}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="p-2">
                        {h.openingMoMo !== null && h.openingMoMo !== undefined ? fmtCurrency(h.openingMoMo) : "-"}
                      </td>
                      <td className="p-2">
                        {fmtCurrency(Number(h.totalMomoSales || 0))}
                      </td>
                      <td className="p-2">
                        {h.actualMoMo !== null && h.actualMoMo !== undefined ? fmtCurrency(h.actualMoMo) : "-"}
                      </td>
                      <td className="p-2">
                        {h.momoVariance !== null ? (
                          <span style={{ color: h.momoVariance >= 0 ? "#28a745" : "#dc3545", fontWeight: 700 }}>
                            {fmtCurrency(h.momoVariance)}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${h.status === "Open" ? "bg-blue-100 text-blue-700" : h.status === "Closed" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}>
                          {h.status}
                        </span>
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          className="btn btn-info"
                          onClick={() => setSessionDetail({ open: true, mode: "details", index: idx, item: h })}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {sessionDetail.open && sessionModalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-xl bg-white dark:bg-slate-800 shadow-lg w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Session {sessionModalItem.no}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-link"
                onClick={() => setSessionDetail({ open: false, mode: "details", index: -1, item: null })}
              >
                ✖
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
              {(() => {
                const s = sessionModalItem;
                const t = sessionSalesTotals(s);
                const startLabel = s.start || (s.startTime ? new Date(s.startTime).toLocaleString() : "-");
                const endLabel = s.end && s.end !== "-" ? s.end : s.endTime ? new Date(s.endTime).toLocaleString() : "-";
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-600">Terminal</div>
                        <div className="font-semibold">{s.terminal}</div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-600">Cashier</div>
                        <div className="font-semibold">{s.cashier}</div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-600">Status</div>
                        <div className="font-semibold">{s.status}</div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-600">Start Time</div>
                        <div className="font-semibold">{startLabel}</div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-600">End Time</div>
                        <div className="font-semibold">{endLabel}</div>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-xs text-slate-600">Opening Cash</div>
                        <div className="font-bold">{fmtCurrency(s.opening)}</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <div className="p-3 font-semibold bg-slate-50">Sales Breakdown</div>
                      <div className="overflow-x-auto">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Payment Method</th>
                              <th>Transactions</th>
                              <th>Amount Received</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>Cash</td>
                              <td>{t.diff.cashCount}</td>
                              <td>{fmtCurrency(t.diff.cashAmount)}</td>
                            </tr>
                            <tr>
                              <td>Card</td>
                              <td>{t.diff.cardCount}</td>
                              <td>{fmtCurrency(t.diff.cardAmount)}</td>
                            </tr>
                            <tr>
                              <td>Mobile Money</td>
                              <td>{t.diff.mobileCount}</td>
                              <td>{fmtCurrency(t.diff.mobileAmount)}</td>
                            </tr>
                            <tr className="bg-blue-50 font-semibold">
                              <td>TOTAL</td>
                              <td>{t.totalCount}</td>
                              <td>{fmtCurrency(t.totalAmount)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <div className="p-3 font-semibold bg-slate-50">Cash Reconciliation</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                        <div className="p-3 rounded-lg border border-slate-200 bg-white">
                          <div className="text-xs text-slate-600">Actual Cash</div>
                          <div className="font-bold">{t.actualCashAtClose === null ? "-" : fmtCurrency(t.actualCashAtClose)}</div>
                        </div>
                        <div className="p-3 rounded-lg border border-slate-200 bg-white">
                          <div className="text-xs text-slate-600">Variance</div>
                          <div className="font-bold" style={{ color: t.cashVarianceAtClose === null ? undefined : t.cashVarianceAtClose >= 0 ? "#28a745" : "#dc3545" }}>
                            {t.cashVarianceAtClose !== null ? fmtCurrency(t.cashVarianceAtClose) : "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                    {s.actualMoMo !== null && (
                      <div className="rounded-lg border border-slate-200 overflow-hidden">
                        <div className="p-3 font-semibold bg-slate-50">MoMo Reconciliation</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                          <div className="p-3 rounded-lg border border-slate-200 bg-white">
                            <div className="text-xs text-slate-600">Actual MoMo</div>
                            <div className="font-bold">{fmtCurrency(s.actualMoMo)}</div>
                          </div>
                          <div className="p-3 rounded-lg border border-slate-200 bg-white">
                            <div className="text-xs text-slate-600">Variance</div>
                            <div className="font-bold" style={{ color: s.momoVariance !== null && s.momoVariance >= 0 ? "#28a745" : "#dc3545" }}>
                              {s.momoVariance !== null ? fmtCurrency(s.momoVariance) : "-"}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {(s.closeNotes || sessionModalItem?.closeNotes) && (
                      <div className="px-4 pb-4 text-sm text-slate-700">
                        {s.closeNotes || sessionModalItem?.closeNotes}
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button type="button" className="btn-primary" onClick={() => setSessionDetail({ open: false, mode: "details", index: -1, item: null })}>
                        Close
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date/Time</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Payment</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!pageItems.length ? (
                <tr>
                  <td colSpan="8">
                    <div className="text-center text-slate-600 py-6">
                      No transactions found
                    </div>
                  </td>
                </tr>
              ) : (
                pageItems.map((t) => {
                  const total = Number(
                    t.net_after_returns !== null && t.net_after_returns !== undefined
                      ? t.net_after_returns
                      : t.total_amount || 0,
                  );
                  const itemCount = Number(t.items_count || 0);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => openDetails(t)}
                      className="cursor-pointer"
                    >
                      <td className="font-medium">
                        {t.receiptNo}
                        {t.has_returns && (
                          <span className="ml-1 badge badge-warning text-[10px]">RTN</span>
                        )}
                      </td>
                      <td>
                        {t.date}
                        <div className="text-xs text-slate-500">{t.time}</div>
                      </td>
                      <td>
                        {t.customer}
                        <div className="text-xs text-slate-500">{t.phone}</div>
                      </td>
                      <td>{itemCount}</td>
                      <td>
                        <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">
                          {String(t.payment || "").toUpperCase()}
                        </span>
                      </td>
                      <td className="text-right">
                        {`GH₵ ${Number(total).toFixed(2)}`}
                      </td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            t.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : t.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {String(t.status || "").toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className={`btn btn-secondary ${!canPerformAction("pos:register", "view") ? 'invisible pointer-events-none' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetails(t);
                            }}
                          >
                            View
                          </button>
                          <div style={{ display: 'none' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                printTransaction(t.id);
                              }}
                            >
                              Print
                            </button>
                            <button
                              className={`btn btn-danger ${!canPerformAction("pos:register", "delete") ? 'invisible pointer-events-none' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTransaction(t.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
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

      <div className="flex items-center justify-between">
        <div className="text-sm">
          Showing {showingFrom} to {showingTo} of {filtered.length} transactions
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Previous
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className={`btn ${page === n ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
          >
            Next →
          </button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between">
              <div className="text-xl font-bold">Transaction Details</div>
              <button className="btn btn-secondary" onClick={closeModal}>
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div>
                <div className="text-slate-500 text-sm">Receipt Number</div>
                <div className="font-medium">{selected.receiptNo}</div>
              </div>
              <div>
                <div className="text-slate-500 text-sm">Date & Time</div>
                <div className="font-medium">
                  {selected.date} {selected.time}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-sm">Customer</div>
                <div className="font-medium">{selected.customer}</div>
              </div>
              <div>
                <div className="text-slate-500 text-sm">Payment Method</div>
                <div className="font-medium">
                  {String(selected.payment || "").toUpperCase()}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-sm">Cashier</div>
                <div className="font-medium">{selected.cashier}</div>
              </div>
              <div>
                <div className="text-slate-500 text-sm">Status</div>
                <div className="font-medium">
                  {String(selected.status || "").toUpperCase()}
                </div>
              </div>
            </div>
            <div className="mt-6">
              <div className="font-semibold mb-2">Items Purchased</div>
              <div className="space-y-2">
                {selected.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-slate-600">
                        {it.quantity} × GH₵ {Number(it.price).toFixed(2)}
                        {it.returned_qty > 0 && (
                          <span className="ml-2 text-red-500">
                            ( {it.returned_qty} returned )
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="font-semibold">
                      {`GH₵ ${(it.quantity * it.price).toFixed(2)}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <div className="flex justify-between">
                <div>Subtotal</div>
                <div>{`GH₵ ${calculateSubtotal(selected.items).toFixed(
                  2,
                )}`}</div>
              </div>
              <div className="flex justify-between">
                <div>Tax</div>
                <div>{`GH₵ ${(
                  calculateSubtotal(selected.items) * 0.125
                ).toFixed(2)}`}</div>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t">
                <div>Total</div>
                <div>{`GH₵ ${calculateTotal(selected.items).toFixed(2)}`}</div>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button className="btn btn-primary" onClick={printReceipt}>
                Print Receipt
              </button>
              <button className="btn btn-secondary" onClick={emailReceipt}>
                Email Receipt
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
