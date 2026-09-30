/**
 * @fileoverview PosDayManagement component.
 * Provides functionality for PosDayManagement.
 */

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../../api/client.js";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

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

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PosDayManagement() {
  const navigate = useNavigate();
  const { user, scope, logout } = useAuth();
  const { hasExceptional } = usePermission();
  function toLocalInputDateTime(value) {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      const pad = (n) => String(n).padStart(2, "0");
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      const ss = pad(d.getSeconds());
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
    } catch {
      return "";
    }
  }
  const [now, setNow] = useState(new Date());
  const [terminalId, setTerminalId] = useState("");
  const [terminalOptions, setTerminalOptions] = useState([]);
  const [terminalsLoading, setTerminalsLoading] = useState(false);
  const [supervisorUsers, setSupervisorUsers] = useState([]);
  const userId = useMemo(() => Number(user?.sub || user?.id || 0), [user]);
  const cashierName = useMemo(() => {
    const name = user?.username || user?.name || user?.fullName || "Cashier";
    return String(name);
  }, [user]);
  const [dayOpen, setDayOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [showForceOpenForm, setShowForceOpenForm] = useState(false);
  const [openData, setOpenData] = useState({
    dateTime: toLocalInputDateTime(new Date()),
    float: "",
    supervisor: "",
    shift: "Morning Shift",
    notes: "",
  });
  const [openChecklist, setOpenChecklist] = useState(new Array(6).fill(false));
  const openProgress = useMemo(() => {
    const total = openChecklist.length || 1;
    const done = openChecklist.filter(Boolean).length;
    return Math.round((done / total) * 100);
  }, [openChecklist]);

  const [salesData, setSalesData] = useState({
    cash: { count: 0, amount: 0 },
    card: { count: 0, amount: 0 },
    mobile: { count: 0, amount: 0 },
  });
  const totals = useMemo(() => {
    const totalAmount =
      Number(salesData.cash.amount || 0) +
      Number(salesData.card.amount || 0) +
      Number(salesData.mobile.amount || 0);
    const totalCount =
      Number(salesData.cash.count || 0) +
      Number(salesData.card.count || 0) +
      Number(salesData.mobile.count || 0);
    return { totalAmount, totalCount };
  }, [salesData]);
  const expectedCash = useMemo(() => {
    return Number(openData.float || 0) + Number(salesData.cash.amount || 0);
  }, [openData.float, salesData.cash.amount]);
  const [closing, setClosing] = useState({
    dateTime: toLocalInputDateTime(new Date()),
    actualCash: "",
    nextOpeningFloat: "",
    notes: "",
  });
  const [closeDenomCounts, setCloseDenomCounts] = useState(
    DENOMINATIONS.map(() => 0),
  );
  const [coinsValue, setCoinsValue] = useState(0);
  const [showCashConfirmModal, setShowCashConfirmModal] = useState(false);
  const cashVariance = useMemo(() => {
    const v = Number(closing.actualCash || 0) - Number(expectedCash || 0);
    return v;
  }, [closing.actualCash, expectedCash]);
  const [momoOpeningMain, setMomoOpeningMain] = useState(0);
  const [momoOpeningPay, setMomoOpeningPay] = useState(0);
  const [momoClosingMain, setMomoClosingMain] = useState(0);
  const [momoClosingPay, setMomoClosingPay] = useState(0);
  const momoClosingRef = useRef({ main: 0, pay: 0 });
  momoClosingRef.current = { main: momoClosingMain, pay: momoClosingPay };
  const [showMomoConfirmModal, setShowMomoConfirmModal] = useState(false);
  const momoOpeningBalance = useMemo(
    () => momoOpeningMain + momoOpeningPay,
    [momoOpeningMain, momoOpeningPay],
  );
  const momoClosingBalance = useMemo(
    () => momoClosingMain + momoClosingPay,
    [momoClosingMain, momoClosingPay],
  );
  const actualMoMo = useMemo(
    () => momoClosingMain + momoClosingPay,
    [momoClosingMain, momoClosingPay],
  );
  const expectedMoMo = useMemo(() => {
    return momoOpeningMain + momoOpeningPay + Number(salesData.mobile.amount || 0);
  }, [momoOpeningMain, momoOpeningPay, salesData.mobile.amount]);
  const momoVariance = useMemo(() => {
    return actualMoMo - expectedMoMo;
  }, [expectedMoMo, actualMoMo]);
  const closeDenomTotals = useMemo(
    () =>
      DENOMINATIONS.map((d, idx) =>
        Number((d * Number(closeDenomCounts[idx] || 0)).toFixed(2)),
      ),
    [closeDenomCounts],
  );
  const closeDenomTotal = useMemo(
    () =>
      Number(
        closeDenomTotals
          .reduce((s, n) => s + n, Number(coinsValue || 0))
          .toFixed(2),
      ),
    [closeDenomTotals, coinsValue],
  );

  const [timeline, setTimeline] = useState([
    { time: new Date(), title: "Waiting", description: "No activity yet" },
  ]);
  const [modal, setModal] = useState({
    open: false,
    title: "",
    icon: "",
    message: "",
  });
  const [sessionHistory, setSessionHistory] = useState([]);
  const currentSalesSummary = useMemo(() => {
    return {
      cashCount: Number(salesData.cash.count || 0),
      cashAmount: Number(salesData.cash.amount || 0),
      cardCount: Number(salesData.card.count || 0),
      cardAmount: Number(salesData.card.amount || 0),
      mobileCount: Number(salesData.mobile.count || 0),
      mobileAmount: Number(salesData.mobile.amount || 0),
    };
  }, [salesData]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Ensure supervisor stays empty until explicitly chosen
    if (openData.supervisor && supervisorUsers.length) {
      const exists = supervisorUsers.some(
        (u) =>
          String(u.username || u.name || u.full_name || "").trim() ===
          String(openData.supervisor || "").trim(),
      );
      if (!exists) {
        setOpenData((prev) => ({ ...prev, supervisor: "" }));
      }
    }
  }, [supervisorUsers, openData.supervisor]);

  useEffect(() => {
    // Auto-select first available supervisor (excluding current user) when empty
    if (!openData.supervisor && supervisorUsers.length) {
      const first = supervisorUsers[0];
      const value = String(
        first.username || first.name || first.full_name || "",
      ).trim();
      if (value) {
        setOpenData((prev) => ({ ...prev, supervisor: value }));
      }
    }
  }, [supervisorUsers, openData.supervisor]);

  useEffect(() => {
    let cancelled = false;
    async function loadTerminals() {
      if (!userId) return;
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
        const assignedTerminalIds = new Set(
          links
            .filter((x) => Number(x?.user_id) === Number(userId))
            .map((x) => Number(x?.terminal_id))
            .filter((n) => Number.isFinite(n) && n > 0),
        );
        const assigned = allTerminals.filter((t) =>
          assignedTerminalIds.has(Number(t?.id)),
        );
        const available = assigned.length > 0 ? assigned : allTerminals;
        setTerminalOptions(available);

        const currentOk = available.some(
          (t) => String(t?.code || "") === String(terminalId || ""),
        );
        const nextCode = currentOk ? terminalId : available[0]?.code || "";
        if (nextCode) {
          setTerminalId(String(nextCode));
        } else {
          setTerminalId("");
        }
      } catch {
        if (cancelled) return;
        setTerminalOptions([]);
        setTerminalId("");
      } finally {
        if (!cancelled) setTerminalsLoading(false);
      }
    }
    loadTerminals();
    return () => {
      cancelled = true;
    };
  }, [userId, cashierName]);

  useEffect(() => {
    let cancelled = false;
    async function loadSupervisors() {
      try {
        const companyId = Number(scope?.companyId || 0) || undefined;
        const branchId = Number(scope?.branchId || 0) || undefined;
        const res = await api.get("/admin/users", {
          params: {
            ...(companyId ? { company_id: companyId } : {}),
            ...(branchId ? { branch_id: branchId } : {}),
            active: 1,
            limit: 100,
          },
        });
        if (cancelled) return;
        const all = Array.isArray(res.data?.items) ? res.data.items : [];
        const meName = String(user?.username || "").trim();
        const filtered = all.filter(
          (u) =>
            Number(u?.id || 0) !== Number(userId || 0) &&
            String(u?.username || "").trim() !== meName &&
            String(u?.username || "").trim() !== "",
        );
        const fallback = all.filter(
          (u) => String(u?.username || "").trim() !== "",
        );
        setSupervisorUsers(filtered.length ? filtered : fallback);
      } catch {
        if (cancelled) return;
        setSupervisorUsers([]);
      }
    }
    loadSupervisors();
    return () => {
      cancelled = true;
    };
  }, [scope?.companyId, scope?.branchId]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/pos/analytics/day-summary")
      .then((res) => {
        if (cancelled) return;
        const s = res?.data?.summary || {};
        const next = {
          cash: {
            count: Number(s.cashCount || 0),
            amount: Number(s.cashAmount || 0),
          },
          card: {
            count: Number(s.cardCount || 0),
            amount: Number(s.cardAmount || 0),
          },
          mobile: {
            count: Number(s.mobileCount || 0),
            amount: Number(s.mobileAmount || 0),
          },
        };
        setSalesData(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const term = terminalId;
    if (!term) {
      if (!terminalsLoading) setStatusLoading(false);
      return undefined;
    }
    setStatusLoading(true);
    api
      .get("/pos/day/status", { params: { terminal: term } })
      .then((res) => {
        if (cancelled) return;
        const item = res?.data?.item;
        const suggestedNext = Number(res?.data?.nextOpeningFloat ?? 0);
        const suggestedNextMomoMain = Number(
          res?.data?.nextMomoOpeningMain ?? item?.momo_closing_main ?? 0,
        );
        const suggestedNextMomoPay = Number(
          res?.data?.nextMomoOpeningPay ?? item?.momo_closing_pay ?? 0,
        );
        if (!item || String(item.status || "").toUpperCase() !== "OPEN") {
          setDayOpen(false);
          const initialFloat =
            Number.isFinite(suggestedNext) && suggestedNext > 0
              ? String(suggestedNext)
              : item?.next_opening_float !== null && item?.next_opening_float !== undefined && Number(item.next_opening_float) > 0
                ? String(item.next_opening_float)
                : item?.actual_cash !== null && item?.actual_cash !== undefined
                  ? String(item.actual_cash)
                  : "";
          setOpenData((prev) => ({
            dateTime: toLocalInputDateTime(new Date()),
            float: initialFloat,
            shift: prev.shift || item?.shift || "Morning Shift",
            notes: "",
          }));
          setMomoOpeningMain(suggestedNextMomoMain || 0);
          setMomoOpeningPay(suggestedNextMomoPay || 0);
          setCloseDenomCounts(Array(DENOMINATIONS.length).fill(0));
          setClosing({
            dateTime: toLocalInputDateTime(new Date()),
            actualCash: "",
            nextOpeningFloat: "",
            notes: "",
          });
          setMomoClosingMain(0);
          setMomoClosingPay(0);
          setSessionHistory([]);
          return;
        }

        const isOpen = true;
        setDayOpen(true);
        setOpenData({
          dateTime: toLocalInputDateTime(item.open_datetime || ""),
          float:
            item.opening_float === null || item.opening_float === undefined
              ? ""
              : String(item.opening_float),
          shift: item.shift || "Morning Shift",
          notes: item.open_notes || "",
        });
        setMomoOpeningMain(Number(item.momo_opening_main || 0));
        setMomoOpeningPay(Number(item.momo_opening_pay || 0));
        setCloseDenomCounts(Array(DENOMINATIONS.length).fill(0));
        setClosing({
          dateTime: toLocalInputDateTime(new Date()),
          actualCash: "",
          nextOpeningFloat: "",
          notes: "",
        });
        setMomoClosingMain(0);
        setMomoClosingPay(0);
        const row = {
          dayStatusId: Number(item.id || 0) || null,
          no: `DAY-${String(item.id || "").padStart(6, "0")}`,
          terminal: String(item.terminal_code || term || ""),
          cashier: cashierName,
          start: item.open_datetime
            ? new Date(item.open_datetime).toLocaleString()
            : "-",
          startTime: item.open_datetime || null,
          end: item.close_datetime
            ? new Date(item.close_datetime).toLocaleString()
            : "-",
          endTime: item.close_datetime || null,
          opening: Number(item.opening_float || 0),
          status: isOpen ? "Open" : "Closed",
          startSummary: normalizeDaySummary({}),
          endSummary: isOpen ? null : currentSalesSummary,
          expectedCash: null,
          actualCash:
            item.actual_cash === null || item.actual_cash === undefined
              ? null
              : Number(item.actual_cash || 0),
          cashVariance: null,
          closeNotes: item.close_notes || "",
        };
        if (!isOpen && row.actualCash !== null) {
          const expectedAtClose =
            Number(row.opening || 0) +
            Number(currentSalesSummary.cashAmount || 0);
          row.expectedCash = expectedAtClose;
          row.cashVariance = Number(row.actualCash || 0) - expectedAtClose;
        }
        setSessionHistory([row]);
        addToTimeline(
          isOpen ? "Day Status" : "Last Day Status",
          isOpen ? "Day is currently open" : "Last day is closed",
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [terminalId, cashierName]);

  function addToTimeline(title, description) {
    const item = { time: new Date(), title, description };
    setTimeline((prev) => {
      const first =
        prev.length === 1 && String(prev[0]?.title).includes("Waiting");
      const base = first ? [] : prev.slice();
      return [item, ...base].slice(0, 50);
    });
  }

  function showSuccessModal(title, icon, message) {
    setModal({ open: true, title, icon, message });
  }
  function closeModal() {
    setModal((prev) => ({ ...prev, open: false }));
  }

  function handleOpenChecklistToggle(index) {
    setOpenChecklist((prev) => {
      const next = prev.slice();
      next[index] = !next[index];
      const label = [
        "Verify cash float count",
        "Check POS system connectivity",
        "Verify printer and receipt paper",
        "Test card payment terminal",
        "Review pending transactions",
        "Confirm inventory sync",
      ][index];
      addToTimeline(
        next[index] ? "Checklist Completed" : "Checklist Unchecked",
        label,
      );
      return next;
    });
  }

  async function handleOpenSubmit(e, force = false) {
    if (e?.preventDefault) e.preventDefault();
    if (!openData.dateTime) {
      toast.warn("Provide opening date/time");
      return;
    }
    try {
      const payload = {
        terminal: terminalId,
        openingDateTime: openData.dateTime,
        openingFloat: Number(openData.float || 0),
        shift: openData.shift || "Morning Shift",
        forceOpen: force,
        supervisor: undefined,
        notes: openData.notes,
        momoOpeningMain: Number(momoOpeningMain || 0),
        momoOpeningPay: Number(momoOpeningPay || 0),
      };
      const res = await api.post("/pos/day/open", payload);
      const item = res?.data?.item;
      if (item) {
        setDayOpen(String(item.status || "").toUpperCase() === "OPEN");
        setOpenData({
          dateTime:
            toLocalInputDateTime(item.open_datetime || "") || openData.dateTime,
          float:
            item.opening_float === null || item.opening_float === undefined
              ? String(openData.float || "")
              : String(item.opening_float),
          shift: item.shift || openData.shift || "Morning Shift",
          notes: item.open_notes || openData.notes,
        });
        setSessionHistory([
          {
            dayStatusId: Number(item.id || 0) || null,
            no: `DAY-${String(item.id || "").padStart(6, "0")}`,
            terminal: String(item.terminal_code || terminalId || ""),
            cashier: cashierName,
            start: item.open_datetime
              ? new Date(item.open_datetime).toLocaleString()
              : new Date(openData.dateTime).toLocaleString(),
            startTime: item.open_datetime || openData.dateTime,
            end: "-",
            endTime: null,
            opening: Number(item.opening_float ?? openData.float ?? 0),
            status: "Open",
            startSummary: normalizeDaySummary({}),
            endSummary: null,
            expectedCash: null,
            actualCash: null,
            cashVariance: null,
            closeNotes: "",
          },
        ]);
      } else {
        setDayOpen(true);
      }
      showSuccessModal(
        "Day Opened",
        "🌅",
        "Day is open. Complete transactions and close day when finished.",
      );
      addToTimeline("Day Opened", "Operations started");
      try {
        sessionStorage.setItem(
          "omni.pos.day",
          JSON.stringify({
            terminal: terminalId,
            status: "OPEN",
            ts: Date.now(),
          }),
        );
        toast.success("Day opened successfully");
        window.dispatchEvent(
          new CustomEvent("omni.pos.day", {
            detail: { terminal: terminalId, status: "OPEN" },
          }),
        );
      } catch {}
    } catch (err) {
      const code = err?.response?.data?.code;
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to open day";
      if ((code === "ALREADY_OPEN" || message.includes("already have an open shift")) && !force) {
        if (
          window.confirm(
            "A previous shift is currently still open on this terminal.\n\nWould you like to close the previous shift and open your new shift now?",
          )
        ) {
          handleOpenSubmit(null, true);
          return;
        }
      }
      toast.error(message);
    }
  }

  async function handleCloseSubmit(e) {
    e.preventDefault();
    if (!dayOpen) {
      toast.error("Open the day first");
      return;
    }
    if (!closing.dateTime) {
      toast.warn("Provide closing date/time");
      return;
    }
    // Auto-copy denomination total into actual cash if counts were entered
    const effectiveActualCash =
      closeDenomTotal > 0 ? closeDenomTotal : Number(closing.actualCash || 0);
    setClosing((p) => ({
      ...p,
      actualCash: String(effectiveActualCash.toFixed(2)),
    }));
    try {
      const momoOpenTotal =
        Number(momoOpeningMain || 0) + Number(momoOpeningPay || 0);
      const momoCloseTotal =
        Number(momoClosingRef.current.main || 0) + Number(momoClosingRef.current.pay || 0);
      const effectiveActualMoMo = momoCloseTotal;
      const payload = {
        terminal: terminalId,
        closingDateTime: closing.dateTime,
        actualCash: effectiveActualCash,
        actualMoMo: effectiveActualMoMo,
        momoOpeningBalance: momoOpenTotal,
        momoClosingBalance: momoCloseTotal,
        momoClosingMain: Number(momoClosingRef.current.main || 0),
        momoClosingPay: Number(momoClosingRef.current.pay || 0),
        nextOpeningFloat: Number(closing.nextOpeningFloat || 0),
        notes: closing.notes,
        denominationCounts: closeDenomCounts,
        coinsValue,
      };
      const res = await api.post("/pos/day/close", payload);
      const item = res?.data?.item;
      if (item) {
        setClosing({
          dateTime: toLocalInputDateTime(new Date()),
          actualCash: "",
          nextOpeningFloat: "",
          notes: "",
        });
        setCloseDenomCounts(DENOMINATIONS.map(() => 0));
        setCoinsValue(0);
        setMomoOpeningMain(momoClosingRef.current.main);
        setMomoOpeningPay(momoClosingRef.current.pay);
        setMomoClosingMain(0);
        setMomoClosingPay(0);
        setOpenData((prev) => ({
          ...prev,
          float:
            item.next_opening_float === null ||
            item.next_opening_float === undefined
              ? prev.float
              : String(item.next_opening_float),
        }));
        setDayOpen(
          String(item.status || "").toUpperCase() === "OPEN" ? true : false,
        );
        let endSummary = currentSalesSummary;
        try {
          const sRes = await api.get("/pos/analytics/day-summary");
          endSummary = normalizeDaySummary(sRes?.data?.summary || {});
        } catch {}
        setSessionHistory((prev) => {
          const base = Array.isArray(prev) && prev.length ? prev[0] : {};
          const opening = Number(
            base.opening ?? openData.float ?? item.opening_float ?? 0,
          );
          const expectedAtClose = opening + Number(endSummary.cashAmount || 0);
          const actualCash = Number(
            item.actual_cash ?? closing.actualCash ?? 0,
          );
          const momoOpenMain = Number(item.momo_opening_main ?? base.momoOpeningMain ?? momoOpeningMain ?? 0);
          const momoOpenPay = Number(item.momo_opening_pay ?? base.momoOpeningPay ?? momoOpeningPay ?? 0);
          const momoOpening = momoOpenMain + momoOpenPay;
          const totalMomoSales = Number(endSummary.mobileAmount || 0);
          const momoExpected = momoOpening + totalMomoSales;
          const momoActual = Number(item.actual_momo ?? effectiveActualMoMo ?? 0);
          const updated = {
            ...base,
            dayStatusId: Number(item.id || base.dayStatusId || 0) || null,
            no: base.no || `DAY-${String(item.id || "").padStart(6, "0")}`,
            terminal: String(
              item.terminal_code || terminalId || base.terminal || "",
            ),
            cashier: cashierName,
            start:
              base.start ||
              (openData.dateTime
                ? new Date(openData.dateTime).toLocaleString()
                : "-"),
            startTime: base.startTime || openData.dateTime || null,
            end: item.close_datetime
              ? new Date(item.close_datetime).toLocaleString()
              : new Date(closing.dateTime).toLocaleString(),
            endTime: item.close_datetime || closing.dateTime,
            opening,
            status: "Closed",
            startSummary: base.startSummary || normalizeDaySummary({}),
            endSummary,
            expectedCash: expectedAtClose,
            actualCash,
            cashVariance: actualCash - expectedAtClose,
            momoOpeningMain: momoOpenMain,
            momoOpeningPay: momoOpenPay,
            openingMoMo: momoOpening,
            totalMomoSales,
            expectedMoMo: momoExpected,
            actualMoMo: momoActual,
            momoVariance: momoActual - momoExpected,
            closeNotes: item.close_notes || closing.notes || "",
          };
          return [updated];
        });
      } else {
        setDayOpen(false);
      }
      showSuccessModal(
        "Day Closed",
        "🌙",
        "End-of-day reconciliation complete. See report summary below.",
      );
      addToTimeline("Day Closed", "Operations ended");
      try {
        sessionStorage.setItem(
          "omni.pos.day",
          JSON.stringify({
            terminal: terminalId,
            status: "CLOSED",
            ts: Date.now(),
          }),
        );
        window.dispatchEvent(
          new CustomEvent("omni.pos.day", {
            detail: { terminal: terminalId, status: "CLOSED" },
          }),
        );

        const rawSettings = localStorage.getItem("pos_general_settings");
        if (rawSettings) {
          const settings = JSON.parse(rawSettings);
          if (settings.autoLogoutAfterShiftClose) {
            setTimeout(() => {
              if (logout) logout();
            }, 1500);
          }
        }
      } catch {}
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to close day";
      toast.error(message);
    }
  }

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
    const hasStartSummary =
      session?.startSummary !== null && session?.startSummary !== undefined;
    const end = session?.endSummary || currentSalesSummary;
    const d = hasStartSummary
      ? diffDaySummary(end, session?.startSummary || null)
      : {
          cashCount: 0,
          cashAmount: 0,
          cardCount: 0,
          cardAmount: 0,
          mobileCount: 0,
          mobileAmount: 0,
        };
    const totalCount =
      Number(d.cashCount || 0) +
      Number(d.cardCount || 0) +
      Number(d.mobileCount || 0);
    const computedTotalAmount =
      Number(d.cashAmount || 0) +
      Number(d.cardAmount || 0) +
      Number(d.mobileAmount || 0);
    const totalAmount = hasStartSummary
      ? computedTotalAmount
      : Number(session?.sales || 0);
    const expectedCashAtClose =
      session?.status === "Closed" &&
      session?.expectedCash !== null &&
      session?.expectedCash !== undefined
        ? Number(session.expectedCash || 0)
        : Number(session?.opening || 0) + Number(d.cashAmount || 0);
    const actualCashAtClose =
      session?.status === "Closed" &&
      session?.actualCash !== null &&
      session?.actualCash !== undefined
        ? Number(session.actualCash || 0)
        : session?.actualCash === null || session?.actualCash === undefined
          ? null
          : Number(session.actualCash || 0);
    const cashVarianceAtClose =
      session?.status === "Closed" &&
      session?.cashVariance !== null &&
      session?.cashVariance !== undefined
        ? Number(session.cashVariance || 0)
        : actualCashAtClose === null
          ? null
          : actualCashAtClose - expectedCashAtClose;
    return {
      diff: d,
      totalCount,
      totalAmount,
      expectedCashAtClose,
      actualCashAtClose,
      cashVarianceAtClose,
    };
  }
  function fmtTime(d) {
    try {
      return new Date(d).toLocaleTimeString();
    } catch {
      return "--:--";
    }
  }
  function fmtDate(d) {
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return "";
    }
  }

  function handlePrint() {
    const totalSales = totals.totalAmount;
    const totalTxn = totals.totalCount;
    const w = window.open("", "_blank");
    if (!w) return;
    const dateStr = now.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>POS End of Day Report</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 20px 24px; max-width: 700px; margin: 0 auto; overflow-wrap: break-word; }
          h1 { text-align: center; border-bottom: 2px solid #0E3646; padding-bottom: 10px; color: #0E3646; }
          .row { display: flex; justify-content: space-between; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #0E3646; color: white; }
          .totals { background: #f0f0f0; font-weight: bold; }
          .footer { margin-top: 20px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h1>END OF DAY REPORT</h1>
        <div class="row"><strong>Terminal:</strong><span>${terminalId}</span></div>
        <div class="row"><strong>Cashier:</strong><span>${cashierName}</span></div>
        <div class="row"><strong>Shift:</strong><span>${openData.shift || "Morning Shift"}</span></div>
        <div class="row"><strong>Date:</strong><span>${dateStr}</span></div>
        <div class="row"><strong>Opening Float:</strong><span>${fmtCurrency(
          openData.float,
        )}</span></div>
        <table>
          <thead>
            <tr><th>Payment Method</th><th>Transactions</th><th>Amount Received</th></tr>
          </thead>
          <tbody>
            <tr><td>Cash</td><td>${salesData.cash.count}</td><td>${fmtCurrency(
              salesData.cash.amount,
            )}</td></tr>
            <tr><td>Card</td><td>${salesData.card.count}</td><td>${fmtCurrency(
              salesData.card.amount,
            )}</td></tr>
            <tr><td>Mobile Money</td><td>${
              salesData.mobile.count
            }</td><td>${fmtCurrency(salesData.mobile.amount)}</td></tr>
            <tr class="totals"><td><strong>TOTAL</strong></td><td><strong>${totalTxn}</strong></td><td><strong>${fmtCurrency(
              totalSales,
            )}</strong></td></tr>
          </tbody>
        </table>
        <div class="footer">
          <div class="row"><strong>Expected Cash:</strong><span>${fmtCurrency(
            expectedCash,
          )}</span></div>
          <div class="row"><strong>Actual Cash Count:</strong><span>${fmtCurrency(
            closing.actualCash || 0,
          )}</span></div>
          <div class="row"><strong>Variance:</strong><span>${fmtCurrency(
            cashVariance,
          )}</span></div>
        </div>
        <button onclick="window.print()">Print</button>
      </body>
      </html>
    `;
    w.document.write(html);
    w.document.close();
  }

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            POS Day Management
          </h1>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Open and close POS business day with reconciliation
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            {now.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-slate-500 text-sm">Terminal</div>
            <div className="space-y-1">
              <select
                className="input py-1 px-2 text-sm"
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                disabled={terminalsLoading || !terminalOptions.length}
              >
                {!terminalOptions.length && (
                  <option value="">
                    {terminalsLoading ? "Loading..." : "No terminals assigned"}
                  </option>
                )}
                {terminalOptions.map((t) => (
                  <option key={t.id} value={String(t.code || "")}>
                    {String(t.code || "")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-slate-500 text-sm">Cashier</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {cashierName}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-slate-500 text-sm">Shift</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {openData.shift || "Morning Shift"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-slate-500 text-sm">Date</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              {now.toLocaleDateString()}
            </div>
          </div>
          <div>
            <span className={dayOpen ? "badge-success" : "badge-danger"}>
              {dayOpen ? "OPEN" : "CLOSED"}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* OPEN DAY CARD */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <div className="card-title flex items-center gap-2">
              <span>Open Day</span>
              {dayOpen ? (
                <span className="badge-success text-xs font-semibold px-2 py-0.5 rounded">
                  Active (Open)
                </span>
              ) : (
                <span className="badge-danger text-xs font-semibold px-2 py-0.5 rounded">
                  Closed
                </span>
              )}
            </div>
            <div className="text-2xl">🌅</div>
          </div>
          <div className="card-body">
            {dayOpen && (
              <div className="alert-success rounded-lg p-3 mb-4 flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Day is currently open ({openData.shift || "Morning Shift"}, Opened at {fmtTime(openData.dateTime)} by {cashierName}).</span>
                </div>
              </div>
            )}
            <form onSubmit={handleOpenSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Opening Date & Time</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={openData.dateTime}
                    onChange={(e) =>
                      setOpenData((p) => ({ ...p, dateTime: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="md:ml-4">
                  <label className="label">Shift</label>
                  <select
                    className="input"
                    value={openData.shift || "Morning Shift"}
                    onChange={(e) =>
                      setOpenData((p) => ({ ...p, shift: e.target.value }))
                    }
                    disabled={dayOpen}
                  >
                    <option value="Morning Shift">Morning Shift</option>
                    <option value="Afternoon Shift">Afternoon Shift</option>
                    <option value="Night Shift">Night Shift</option>
                    <option value="General Shift">General Shift</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="label">Opening Float (₵)</label>
                  <input
                    type="number"
                    className="input"
                    step="1"
                    value={openData.float}
                    onChange={(e) =>
                      setOpenData((p) => ({
                        ...p,
                        float: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="label">Opening Main Account (₵)</label>
                  <input
                    type="number"
                    className="input"
                    step="0.01"
                    value={String(momoOpeningMain)}
                    onChange={(e) =>
                      setMomoOpeningMain(Number(e.target.value || 0))
                    }
                  />
                </div>
                <div className="md:ml-4">
                  <label className="label">
                    Opening MoMo Pay Account (₵)
                  </label>
                  <input
                    type="number"
                    className="input"
                    step="0.01"
                    value={String(momoOpeningPay)}
                    onChange={(e) =>
                      setMomoOpeningPay(Number(e.target.value || 0))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input w-full"
                  rows={4}
                  value={openData.notes}
                  onChange={(e) =>
                    setOpenData((p) => ({ ...p, notes: e.target.value }))
                  }
                />
              </div>

              <button
                type="submit"
                className="btn-success w-full font-bold py-2.5"
                data-rbac-exempt="true"
              >
                🌅 Open Day
              </button>
            </form>
          </div>
        </div>

        {/* CLOSE DAY CARD */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <div className="card-title flex items-center gap-2">
              <span>Close Day</span>
              <span className="text-sm font-normal text-slate-500">
                {closing.dateTime
                  ? new Date(closing.dateTime).toLocaleString()
                  : ""}
              </span>
            </div>
            <div className="text-2xl">🌙</div>
          </div>
          <div className="card-body">
            {!dayOpen && (
              <div className="alert-danger rounded-lg p-3 mb-4 flex items-center gap-2 text-sm">
                <span>ℹ️</span>
                <span>Day is currently closed. Submit below to close or record reconciliation.</span>
              </div>
            )}
            <form onSubmit={handleCloseSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hasExceptional("POS.EXPECTED_CASH.VIEW") ? (
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-600">
                      Total Cash Sales
                    </div>
                    <div className="font-bold">
                      {fmtCurrency(salesData.cash.amount)}
                    </div>
                  </div>
                ) : null}
                {hasExceptional("POS.CASH_VARIANCE.VIEW") ? (
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-xs text-slate-600">Total MoMo</div>
                    <div className="font-bold">
                      {fmtCurrency(salesData.mobile.amount)}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex gap-3">
                <div className="flex-1 rounded-lg border border-brand/30 bg-brand/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-700 dark:text-slate-200">
                      Cash entered. Confirm with denomination count.
                    </div>
                    <button
                      type="button"
                      className="btn-primary text-xs py-1"
                      onClick={() => setShowCashConfirmModal(true)}
                    >
                      Confirm Cash
                    </button>
                  </div>
                </div>
                <div className="flex-1 rounded-lg border border-brand/30 bg-brand/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-700 dark:text-slate-200">
                      MoMo balance. Confirm with opening/closing.
                    </div>
                    <button
                      type="button"
                      className="btn-primary text-xs py-1"
                      onClick={() => setShowMomoConfirmModal(true)}
                    >
                      Confirm MoMo
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Closing Date & Time</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={closing.dateTime}
                    onChange={(e) =>
                      setClosing((p) => ({ ...p, dateTime: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="md:ml-4">
                  <label className="label">Actual Cash Counted (₵)</label>
                  <input
                    type="number"
                    className="input"
                    step="0.01"
                    value={closing.actualCash}
                    onChange={(e) =>
                      setClosing((p) => ({
                        ...p,
                        actualCash: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hasExceptional("POS.EXPECTED_CASH.VIEW") ? (
                  <div>
                    <label className="label">Expected Cash</label>
                    <input
                      type="text"
                      className="input"
                      disabled
                      value={fmtCurrency(expectedCash)}
                    />
                  </div>
                ) : null}
                {hasExceptional("POS.CASH_VARIANCE.VIEW") ? (
                  <div className="md:ml-4">
                    <label className="label">Cash Variance</label>
                    <input
                      type="text"
                      className="input"
                      disabled
                      value={fmtCurrency(cashVariance)}
                      style={{
                        color: cashVariance >= 0 ? "#28a745" : "#dc3545",
                        fontWeight: 700,
                      }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="label">Closing Main Account (₵)</label>
                  <input
                    type="number"
                    className="input"
                    step="0.01"
                    value={String(momoClosingMain)}
                    onChange={(e) =>
                      setMomoClosingMain(Number(e.target.value || 0))
                    }
                  />
                </div>
                <div className="md:ml-4">
                  <label className="label">
                    Closing MoMo Pay Account (₵)
                  </label>
                  <input
                    type="number"
                    className="input"
                    step="0.01"
                    value={String(momoClosingPay)}
                    onChange={(e) =>
                      setMomoClosingPay(Number(e.target.value || 0))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="label">Total MoMo Closing Balance</label>
                  <input
                    type="text"
                    className="input"
                    disabled
                    value={fmtCurrency(momoClosingBalance)}
                  />
                </div>
                <div className="md:ml-4">
                  <label className="label">Expected MoMo Closing</label>
                  <input
                    type="text"
                    className="input"
                    disabled
                    value={fmtCurrency(expectedMoMo)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {hasExceptional("POS.CASH_VARIANCE.VIEW") ? (
                  <div>
                    <label className="label">MoMo Variance</label>
                    <input
                      type="text"
                      className="input"
                      disabled
                      value={fmtCurrency(momoVariance)}
                      style={{
                        color: momoVariance >= 0 ? "#28a745" : "#dc3545",
                        fontWeight: 700,
                      }}
                    />
                  </div>
                ) : null}
                <div className="md:ml-4">
                  <label className="label">Enter float for next sales</label>
                  <input
                    type="number"
                    className="input"
                    step="1"
                    value={closing.nextOpeningFloat}
                    onChange={(e) =>
                      setClosing((p) => ({
                        ...p,
                        nextOpeningFloat: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="label">Closing Notes</label>
                <textarea
                  className="input w-full"
                  rows={4}
                  value={closing.notes}
                  onChange={(e) =>
                    setClosing((p) => ({ ...p, notes: e.target.value }))
                  }
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-danger flex-1 px-4 py-2 font-bold"
                  data-rbac-exempt="true"
                  onClick={async () => {
                    if (!closing.dateTime) {
                      toast.warn("Provide closing date/time");
                      return;
                    }
                    await handleCloseSubmit({ preventDefault: () => {} });
                  }}
                >
                  🌙 Close Day
                </button>
                <button
                  type="button"
                  className="btn-info flex-1 px-4 py-2 font-bold"
                  data-rbac-exempt="true"
                  onClick={handlePrint}
                >
                  🖨️ Print Report
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Activity Timeline</div>
          <div className="text-2xl">🕘</div>
        </div>
        <div className="card-body">
          <div className="space-y-3">
            {timeline.map((t, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50"
              >
                <div className="text-sm font-semibold text-brand-700">
                  {new Date(t.time).toLocaleTimeString()} - {t.title}
                </div>
                <div className="text-sm">{t.description}</div>
              </div>
            ))}
            {!timeline.length && (
              <div className="text-sm text-slate-500">No activity yet</div>
            )}
          </div>
        </div>
      </div>

      {modal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-xl bg-white dark:bg-slate-800 shadow-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {modal.title}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-link"
                onClick={closeModal}
              >
                ✖
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center text-6xl">{modal.icon}</div>
              <div className="text-center">{modal.message}</div>
              <div className="flex gap-2 justify-center">
                <Link to="/pos?section=Reports" className="btn-secondary">
                  Return to POS
                </Link>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    closeModal();
                    if (modal.title === "Day Closed") {
                      navigate("/");
                    } else {
                      navigate("/pos/sales-entry");
                    }
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCashConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-xl bg-white dark:bg-slate-800 shadow-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-brand text-white rounded-t-xl">
              <div className="text-lg font-bold">Denomination Cash Count</div>
              <button
                type="button"
                className="text-white hover:text-slate-200 text-xl font-bold"
                onClick={() => setShowCashConfirmModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="p-4 rounded-b-xl">
              <div className="space-y-2">
                {DENOMINATIONS.map((d, idx) => (
                  <div
                    key={`close-modal-${String(d)}`}
                    className="grid grid-cols-[1fr_90px_110px] gap-2 items-center"
                  >
                    <div className="text-sm">{`GHS ${Number(d).toFixed(2)}`}</div>
                    <input
                      type="number"
                      min="0"
                      className="rounded px-2 py-1 border border-slate-300"
                      value={String(closeDenomCounts[idx] ?? 0)}
                      onChange={(e) => {
                        const next = closeDenomCounts.slice();
                        next[idx] = Number(e.target.value || 0);
                        setCloseDenomCounts(next);
                      }}
                    />
                    <div className="rounded px-2 py-1 bg-slate-100 text-right text-sm">
                      {closeDenomTotals[idx].toFixed(2)}
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_90px_110px] gap-2 items-center">
                  <div className="text-sm font-semibold">Coins</div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="rounded px-2 py-1 border border-slate-300"
                    value={String(coinsValue)}
                    onChange={(e) => setCoinsValue(Number(e.target.value || 0))}
                  />
                  <div className="rounded px-2 py-1 bg-slate-100 text-right text-sm">
                    {Number(coinsValue || 0).toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded bg-slate-100 px-3 py-3 flex items-center justify-between font-semibold">
                <div>TOTAL:</div>
                <div>{closeDenomTotal.toFixed(2)}</div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCashConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setClosing((p) => ({
                      ...p,
                      actualCash: String(closeDenomTotal.toFixed(2)),
                    }));
                    setShowCashConfirmModal(false);
                  }}
                >
                  Apply Total
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showMomoConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-xl bg-white dark:bg-slate-800 shadow-lg w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-brand text-white rounded-t-xl">
              <div className="text-lg font-bold">MoMo Balance Confirmation</div>
              <button
                type="button"
                className="text-white hover:text-slate-200 text-xl font-bold"
                onClick={() => setShowMomoConfirmModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="p-4 rounded-b-xl">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Opening Main Account (₵)</label>
                    <input
                      type="number"
                      className="input"
                      step="0.01"
                      value={String(momoOpeningMain)}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="label">
                      Opening MoMo Pay Account (₵)
                    </label>
                    <input
                      type="number"
                      className="input"
                      step="0.01"
                      value={String(momoOpeningPay)}
                      readOnly
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Closing Main Account (₵)</label>
                    <input
                      type="number"
                      className="input"
                      step="0.01"
                      value={String(momoClosingMain)}
                      onChange={(e) =>
                        setMomoClosingMain(Number(e.target.value || 0))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">
                      Closing MoMo Pay Account (₵)
                    </label>
                    <input
                      type="number"
                      className="input"
                      step="0.01"
                      value={String(momoClosingPay)}
                      onChange={(e) =>
                        setMomoClosingPay(Number(e.target.value || 0))
                      }
                    />
                  </div>
                </div>
                <div className="rounded bg-slate-100 px-3 py-3 flex items-center justify-between font-semibold">
                  <div>Expected MoMo (Opening + Sales)</div>
                  <div>{fmtCurrency(expectedMoMo)}</div>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowMomoConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowMomoConfirmModal(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
