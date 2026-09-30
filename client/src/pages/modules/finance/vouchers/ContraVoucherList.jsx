/**
 * @fileoverview ContraVoucherList component.
 * Provides functionality for ContraVoucherList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import { api } from "api/client";
import { renderHtmlToPdf } from "@/utils/pdfUtils.js";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import ReverseApprovalButton from "../../../../components/ReverseApprovalButton.jsx";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

function StatusBadge({ status }) {
  const cls =
    status === "DRAFT"
      ? "badge badge-warning"
      : status === "APPROVED" || status === "POSTED"
        ? "badge badge-success"
        : status === "REVERSED" || status === "CANCELLED"
          ? "badge badge-error"
          : "badge badge-info";

  return <span className={cls}>{status}</span>;
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ContraVoucherList() {
  const [viewMode, setViewMode] = useViewMode();
  const { canPerformAction } = usePermission();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const voucherTypeCode = "CV";
  const title = "Account Transfer";
  const isPV = voucherTypeCode === "PV";
  const isRV = voucherTypeCode === "RV";
  const isCV = voucherTypeCode === "CV";
  const isSV = voucherTypeCode === "SV";
  const isJV = voucherTypeCode === "JV";
  const isPAYV = voucherTypeCode === "PAYV";
  const isPUV = voucherTypeCode === "PUV";
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: "",
  });
  const [receiptTemplateHtml, setReceiptTemplateHtml] = useState(null);
  const [paymentTemplateHtml, setPaymentTemplateHtml] = useState(null);
  const basePath =
    String(voucherTypeCode).toUpperCase() === "JV"
      ? "journal-voucher"
      : String(voucherTypeCode).toUpperCase() === "PAYV"
        ? "payment-voucher"
        : String(voucherTypeCode).toUpperCase() === "RV"
          ? "receipt-voucher"
          : String(voucherTypeCode).toUpperCase() === "CV"
            ? "contra-voucher"
            : String(voucherTypeCode).toUpperCase() === "SV"
              ? "sales-voucher"
              : String(voucherTypeCode).toUpperCase() === "PV"
                ? "purchase-voucher"
                : String(voucherTypeCode).toUpperCase() === "DN"
                  ? "debit-note"
                  : "credit-note";

  // Helper to format voucher numbers with correct prefixes
  function formatVoucherNoDisplay(voucherNo, typeCode) {
    return String(voucherNo || "");
  }

  function initDefaultDates() {
    const today = new Date();
    const year = today.getFullYear();
    const jan1 = new Date(year, 0, 1);
    setFrom((prev) => prev || jan1.toISOString().slice(0, 10));
    setTo((prev) => prev || today.toISOString().slice(0, 10));
  }
  async function load(currentPage = page) {
    try {
      setLoading(true);
      const res = await api.get("/finance/vouchers", {
        params: {
          voucherTypeCode,
          from: from || undefined,
          to: to || undefined,
          page: currentPage,
          limit: 50,
        },
      });
      setItems(res.data?.items || []);
      if (res.data?.pagination) {
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalCount(res.data.pagination.total || 0);
        setPage(currentPage);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load vouchers");
    } finally {
      setLoading(false);
    }
  }

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  async function loadAccounts() {
    try {
      setAccountsLoading(true);
      const res = await api.get("/finance/accounts", { params: { active: 1 } });
      setAccounts(res.data?.items || []);
    } catch (e) {
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        // Trigger a one-time tax-split backfill for SV/PUV lists
        if (isSV || isPUV) {
          await api
            .post("/finance/vouchers/backfill/tax-split")
            .catch(() => null);
        }
      } finally {
        if (!cancelled) {
          initDefaultDates();
          load();
          if (isCV) loadAccounts();
        }
      }
    }
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherTypeCode]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);
  useEffect(() => {
    const ref = location.state?.highlightRef;
    const hid = location.state?.highlightId;
    const refresh = location.state?.refresh;
    if (!ref && !hid && !refresh) return;
    let cancelled = false;
    async function ensureVisible() {
      const start = Date.now();
      while (!cancelled && Date.now() - start < 5000) {
        try {
          const res = await api.get("/finance/vouchers", {
            params: { voucherTypeCode },
          });
          const arr = Array.isArray(res.data?.items) ? res.data.items : [];
          setItems(arr);
          let hit = false;
          if (ref) {
            hit = arr.some(
              (v) =>
                String(v.voucher_no || "").toLowerCase() ===
                String(ref).toLowerCase(),
            );
          } else if (hid) {
            hit = arr.some((v) => Number(v.id) === Number(hid));
          } else {
            hit = true;
          }
          if (hit) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    ensureVisible();
    return () => {
      cancelled = true;
    };
  }, [
    location.state?.highlightRef,
    location.state?.highlightId,
    location.state?.refresh,
    voucherTypeCode,
  ]);
  useEffect(() => {
    function onWorkflowStatus(e) {
      try {
        const d = e.detail || {};
        const id = Number(d.documentId || d.document_id);
        const status = String(d.status || "").toUpperCase();
        if (!id || !status) return;
        setItems((prev) =>
          prev.map((x) =>
            Number(x.id) === id
              ? {
                  ...x,
                  status,
                  ...(status === "DRAFT"
                    ? { forwarded_to_username: null }
                    : {}),
                }
              : x,
          ),
        );
      } catch {}
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () =>
      window.removeEventListener("omni.workflow.status", onWorkflowStatus);
  }, []);
  useEffect(() => {
    let mounted = true;
    async function fetchCompanyInfo() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) return;
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        if (!mounted) return;
        setCompanyInfo((prev) => ({
          ...prev,
          name: item.name || prev.name || "",
          address: item.address || prev.address || "",
          phone: item.telephone || prev.phone || "",
          email: item.email || prev.email || "",
          city: item.city || prev.city || "",
          state: item.state || prev.state || "",
          country: item.country || prev.country || "",
          postalCode: item.postal_code || prev.postalCode || "",
          website: item.website || prev.website || "",
          taxId: item.tax_id || prev.taxId || "",
          registrationNo: item.registration_no || prev.registrationNo || "",
          logoUrl:
            item.has_logo === 1 || item.has_logo === true
              ? `/api/admin/companies/${companyId}/logo`
              : prev.logoUrl || "",
        }));
      } catch {}
    }
    fetchCompanyInfo();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const base =
      status === "ALL"
        ? items.slice()
        : items.filter((v) => v.status === status);
    const q = String(search || "").trim();
    if (!q) return base;
    return filterAndSort(base, {
      query: q,
      getKeys: (v) => [v.voucher_no, v.description, v.narration, v.remarks],
    });
  }, [items, search, status]);

  const { sorted: sortedVouchers, sortKey, sortDir, toggle } = useSort(filtered, "id", "desc");

  const accountNameByCode = useMemo(() => {
    const m = new Map();
    for (const a of accounts || []) {
      const code = String(a.code || "");
      const name = String(a.name || "");
      if (code) m.set(code, name);
    }
    return m;
  }, [accounts]);

  function renderDescription(v) {
    const raw = String(v.description || v.narration || v.remarks || "");
    if (!raw) return "-";
    // For CV, show From → To format
    if (isCV) {
      const parts = raw.split(" | ").map((p) => p.trim());
      let fromVal = "";
      let toVal = "";
      for (const t of parts) {
        if (t.toLowerCase().startsWith("from:")) {
          const val = t.split(":")[1]?.trim() || "";
          const name = accountNameByCode.get(val) || val;
          fromVal = name;
        } else if (t.toLowerCase().startsWith("to:")) {
          const val = t.split(":")[1]?.trim() || "";
          const name = accountNameByCode.get(val) || val;
          toVal = name;
        }
      }
      if (fromVal && toVal) return `${fromVal} → ${toVal}`;
      if (fromVal) return fromVal;
      if (toVal) return toVal;
    }
    // For all voucher types, return the full description
    return raw;
  }
  function escapeHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function wrapDoc(bodyHtml) {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Voucher</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
      .vh { font-size: 12px; }
      .vh table { border-collapse: collapse; width: 100%; }
      .vh th, .vh td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
      .vh th { background: #f8fafc; text-align: left; }
      .vh .right { text-align: right; }
      .vh .center { text-align: center; }
      .vh-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
      .vh-logo { min-width: 120px; max-width: 200px; }
      .vh-company { text-align: right; font-size: 11px; line-height: 1.35; }
      .vh-company .name { font-weight: 800; font-size: 14px; }
      .vh-titlebar { display: flex; align-items: center; gap: 10px; color: #0f172a; margin: 4px 0 10px; }
      .vh-titlebar .line { flex: 1; height: 1px; background: #0f172a; }
      .vh-titlebar .title { font-weight: 700; }
      .vh-details { width: 100%; margin-bottom: 10px; border: 1px solid #cbd5e1; }
      .vh-details td { border-color: #cbd5e1; }
      .vh-details .label { width: 32%; color: #475569; }
      .vh-details .label-wide { width: 40%; color: #475569; }
      .vh-items thead th { font-weight: 600; }
      .vh-footer a { color: inherit; text-decoration: underline; }
      @media print { button { display: none; } }
    </style>
  </head>
  <body>${bodyHtml || ""}</body>
</html>`;
  }
  function renderReceiptVoucherHtml(data) {
    const c = data.company || {};
    const r = data.receipt || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const t = data.totals || {};
    return `
    <div class="vh">
      <div class="vh-header">
        <div class="vh-logo">${c.logoHtml || ""}</div>
        <div class="vh-company">
          <div class="name">${escapeHtml(c.name || "")}</div>
          <div>${escapeHtml(c.addressLine1 || "")}</div>
          <div>${escapeHtml(c.addressLine2 || "")}</div>
          <div>Telephone: ${escapeHtml(c.phone || "")}</div>
          <div>${escapeHtml(c.website || "")}</div>
          <div>TIN: ${escapeHtml(c.taxId || "")} &nbsp; Reg: ${escapeHtml(c.registrationNo || "")}</div>
        </div>
      </div>
      <div class="vh-titlebar">
        <div class="line"></div>
        <div class="title">* Receipt Voucher *</div>
        <div class="line"></div>
      </div>
      <table class="vh-details">
        <tr>
          <td style="width:50%;vertical-align:top;border-right:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td class="label-wide">Receipt No</td><td>:</td><td>${escapeHtml(r.receiptNo || "")}</td></tr>
              <tr><td class="label-wide">Date/Time</td><td>:</td><td>${escapeHtml(r.dateTime || "")}</td></tr>
              <tr><td class="label-wide">Method</td><td>:</td><td>${escapeHtml(r.paymentMethod || "")}</td></tr>
            </table>
          </td>
          <td style="width:50%;vertical-align:top;">
            <div style="padding:8px;">
              <div class="label">Narration</div>
              <div>${escapeHtml(r.headerText || "")}</div>
            </div>
          </td>
        </tr>
      </table>
      <table class="vh-items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="right" style="width:22%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr>
              <td>${escapeHtml(it.name || "")}</td>
              <td class="right">${escapeHtml(it.lineTotal || it.price || "0.00")}</td>
            </tr>
          `,
            )
            .join("")}
          <tr>
            <td class="right"><strong>Subtotal</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.subtotal || 0).toFixed(2))}</strong></td>
          </tr>
          <tr>
            <td class="right">Tax</td>
            <td class="right">${escapeHtml(Number(t.tax || 0).toFixed(2))}</td>
          </tr>
          <tr>
            <td class="right"><strong>Total</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.total || t.grand || 0).toFixed(2))}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="vh-footer" style="margin-top:10px;text-align:center;">
        <div>${escapeHtml(r.footerText || "")}</div>
      </div>
    </div>
    `;
  }
  function renderPaymentVoucherHtml(data) {
    const c = data.company || {};
    const p = data.payment || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const t = data.totals || {};
    return `
    <div class="vh">
      <div class="vh-header">
        <div class="vh-logo">${c.logoHtml || ""}</div>
        <div class="vh-company">
          <div class="name">${escapeHtml(c.name || "")}</div>
          <div>${escapeHtml(c.addressLine1 || "")}</div>
          <div>${escapeHtml(c.addressLine2 || "")}</div>
          <div>Telephone: ${escapeHtml(c.phone || "")}</div>
          <div>${escapeHtml(c.website || "")}</div>
          <div>TIN: ${escapeHtml(c.taxId || "")} &nbsp; Reg: ${escapeHtml(c.registrationNo || "")}</div>
        </div>
      </div>
      <div class="vh-titlebar">
        <div class="line"></div>
        <div class="title">* Payment Voucher *</div>
        <div class="line"></div>
      </div>
      <table class="vh-details">
        <tr>
          <td style="width:50%;vertical-align:top;border-right:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td class="label-wide">Payment No</td><td>:</td><td>${escapeHtml(p.paymentNo || "")}</td></tr>
              <tr><td class="label-wide">Date/Time</td><td>:</td><td>${escapeHtml(p.dateTime || "")}</td></tr>
              <tr><td class="label-wide">Method</td><td>:</td><td>${escapeHtml(p.paymentMethod || "")}</td></tr>
            </table>
          </td>
          <td style="width:50%;vertical-align:top;">
            <div style="padding:8px;">
              <div class="label">Narration</div>
              <div>${escapeHtml(p.headerText || "")}</div>
            </div>
          </td>
        </tr>
      </table>
      <table class="vh-items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="right" style="width:22%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr>
              <td>${escapeHtml(it.name || "")}</td>
              <td class="right">${escapeHtml(it.lineTotal || it.price || "0.00")}</td>
            </tr>
          `,
            )
            .join("")}
          <tr>
            <td class="right"><strong>Subtotal</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.subtotal || 0).toFixed(2))}</strong></td>
          </tr>
          <tr>
            <td class="right">Tax</td>
            <td class="right">${escapeHtml(Number(t.tax || 0).toFixed(2))}</td>
          </tr>
          <tr>
            <td class="right"><strong>Total</strong></td>
            <td class="right"><strong>${escapeHtml(Number(t.total || t.grand || 0).toFixed(2))}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="vh-footer" style="margin-top:10px;text-align:center;">
        <div>${escapeHtml(p.footerText || "")}</div>
      </div>
    </div>
    `;
  }
  function renderJournalVoucherHtml(data) {
    const c = data.company || {};
    const v = data.voucher || {};
    const items = Array.isArray(data.items) ? data.items : [];
    return `
    <div class="vh">
      <div class="vh-header">
        <div class="vh-logo">${c.logoHtml || ""}</div>
        <div class="vh-company">
          <div class="name">${escapeHtml(c.name || "")}</div>
          <div>${escapeHtml(c.addressLine1 || "")}</div>
          <div>${escapeHtml(c.addressLine2 || "")}</div>
          <div>Telephone: ${escapeHtml(c.phone || "")}</div>
          <div>Email: ${escapeHtml(c.email || "")}</div>
          <div>${escapeHtml(c.website || "")}</div>
          <div>TIN: ${escapeHtml(c.taxId || "")} &nbsp; Reg: ${escapeHtml(c.registrationNo || "")}</div>
        </div>
      </div>
      <div class="vh-titlebar">
        <div class="line"></div>
        <div class="title">* Journal Voucher *</div>
        <div class="line"></div>
      </div>
      <table class="vh-details">
        <tr>
          <td style="width:50%;vertical-align:top;border-right:1px solid #cbd5e1;">
            <table style="width:100%;">
              <tr><td class="label-wide">Voucher No</td><td>:</td><td>${escapeHtml(v.voucher_no || "")}</td></tr>
              <tr><td class="label-wide">Date/Time</td><td>:</td><td>${escapeHtml(v.voucher_date ? new Date(v.voucher_date).toLocaleString() : "")}</td></tr>
            </table>
          </td>
          <td style="width:50%;vertical-align:top;">
            <div style="padding:8px;">
              <div class="label">Narration</div>
              <div>${escapeHtml(v.narration || v.remarks || "")}</div>
            </div>
          </td>
        </tr>
      </table>
      <table class="vh-items">
        <thead>
          <tr>
            <th>Account</th>
            <th>Description</th>
            <th class="right" style="width:16%;">Debit</th>
            <th class="right" style="width:16%;">Credit</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr>
              <td>${escapeHtml([it.account_code, it.account_name].filter(Boolean).join(" - "))}</td>
              <td>${escapeHtml(it.description || "")}</td>
              <td class="right">${escapeHtml(Number(it.debit || 0).toFixed(2))}</td>
              <td class="right">${escapeHtml(Number(it.credit || 0).toFixed(2))}</td>
            </tr>
          `,
            )
            .join("")}
          <tr>
            <td colspan="2" class="right"><strong>Totals</strong></td>
            <td class="right"><strong>${escapeHtml(
              Number(
                items.reduce((s, it) => s + Number(it.debit || 0), 0),
              ).toFixed(2),
            )}</strong></td>
            <td class="right"><strong>${escapeHtml(
              Number(
                items.reduce((s, it) => s + Number(it.credit || 0), 0),
              ).toFixed(2),
            )}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="vh-footer" style="margin-top:10px;text-align:center;">
        <div></div>
      </div>
    </div>
    `;
  }
  function buildReceiptVoucherTemplateDataFromApi(voucher, lines) {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const itemsArr = (Array.isArray(lines) ? lines : [])
      .filter((l) => Number(l.credit || 0) > 0)
      .map((l) => {
        const amt = Number(l.credit || 0);
        return {
          name: String(l.description || l.account_name || ""),
          qty: "1.00",
          price: amt.toFixed(2),
          discount: "0.00",
          lineTotal: amt.toFixed(2),
        };
      });
    const totals = itemsArr.reduce(
      (acc, it) => {
        const v = Number(it.lineTotal || 0);
        acc.subtotal += v;
        acc.total += v;
        return acc;
      },
      { subtotal: 0, total: 0 },
    );
    return {
      company: {
        name: companyInfo.name || "",
        addressLine1: companyInfo.address || "",
        addressLine2: [companyInfo.city, companyInfo.state, companyInfo.country]
          .filter(Boolean)
          .join(" • "),
        phone: companyInfo.phone || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      receipt: {
        receiptNo: String(voucher.voucher_no || ""),
        dateTime: voucher.voucher_date
          ? new Date(voucher.voucher_date).toLocaleString()
          : new Date().toLocaleString(),
        paymentMethod: "",
        headerText: "",
        footerText: "",
      },
      items: itemsArr,
      totals: {
        subtotal: totals.subtotal.toFixed(2),
        tax: "0.00",
        total: totals.total.toFixed(2),
      },
    };
  }
  function buildPaymentVoucherTemplateDataFromApi(voucher, lines) {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const itemsArr = (Array.isArray(lines) ? lines : [])
      .filter((l) => Number(l.debit || 0) > 0)
      .map((l) => {
        const amt = Number(l.debit || 0);
        return {
          name: String(l.description || l.account_name || ""),
          qty: "1.00",
          price: amt.toFixed(2),
          discount: "0.00",
          lineTotal: amt.toFixed(2),
        };
      });
    const totals = itemsArr.reduce(
      (acc, it) => {
        const v = Number(it.lineTotal || 0);
        acc.subtotal += v;
        acc.total += v;
        return acc;
      },
      { subtotal: 0, total: 0 },
    );
    return {
      company: {
        name: companyInfo.name || "",
        addressLine1: companyInfo.address || "",
        addressLine2: [companyInfo.city, companyInfo.state, companyInfo.country]
          .filter(Boolean)
          .join(" • "),
        phone: companyInfo.phone || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      payment: {
        paymentNo: String(voucher.voucher_no || ""),
        dateTime: voucher.voucher_date
          ? new Date(voucher.voucher_date).toLocaleString()
          : new Date().toLocaleString(),
        paymentMethod: "",
        headerText: "",
        footerText: "",
      },
      items: itemsArr,
      totals: {
        subtotal: totals.subtotal.toFixed(2),
        tax: "0.00",
        total: totals.total.toFixed(2),
      },
    };
  }
  function buildJournalVoucherTemplateDataFromApi(voucher, lines) {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(
          companyInfo.name || "Company",
        )}" style="max-height:80px;object-fit:contain;" />`
      : "";
    return {
      company: {
        name: companyInfo.name || "",
        addressLine1: companyInfo.address || "",
        addressLine2: [companyInfo.city, companyInfo.state, companyInfo.country]
          .filter(Boolean)
          .join(" • "),
        phone: companyInfo.phone || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      voucher: {
        id: voucher.id,
        voucher_no: String(voucher.voucher_no || ""),
        voucher_date: voucher.voucher_date || "",
        narration: voucher.narration || "",
        total_debit: Number(voucher.total_debit || 0),
        total_credit: Number(voucher.total_credit || 0),
        type_code: voucher.voucher_type_code || "JV",
        type_name: voucher.voucher_type_name || "Journal Voucher",
      },
      items: (Array.isArray(lines) ? lines : []).map((l) => ({
        account_code: l.account_code,
        account_name: l.account_name,
        description: l.description,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      })),
    };
  }
  async function printVoucher(id) {
    try {
      // Use the proper document templates system instead of hardcoded HTML
      const templateType = isRV
        ? "receipt-voucher"
        : isPV
          ? "payment-voucher"
          : isPAYV
            ? "payment-voucher"
            : isCV
              ? "contra-voucher"
              : "";
      if (!templateType) return;
      const templateName = isRV
        ? "Receipt Voucher"
        : isPV
          ? "Payment voucher"
          : isPAYV
            ? "Payment Voucher"
            : isCV
              ? "Contra Voucher"
              : "";
      let templateId = null;
      try {
        const tRes = await api.get(`/templates/${templateType}`, {
          params: { name: templateName },
        });
        const tItems = Array.isArray(tRes.data?.items) ? tRes.data.items : [];
        templateId = Number(tItems?.[0]?.id || 0) || null;
      } catch {}

      let payload_data = null;
      try {
        const docRes = await api.get(`/finance/vouchers/${id}`);
        if (docRes.data) payload_data = docRes.data;
      } catch (err) {
        console.warn('Failed to fetch document data for print:', err);
      }

      const resp = await api.post(
        `/documents/${templateType}/${id}/render`,
        { format: "html", feature_name: templateType, payload_data, ...(templateId ? { template_id: templateId } : {}) },
        { headers: { "Content-Type": "application/json" } },
      );

      const html =
        typeof resp.data === "string" ? resp.data : String(resp.data || "");

      // Add color preservation CSS to ensure logo colors are maintained
      const printStyle = `<style>
        @media print {
          img, svg {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      </style>`;

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const doc =
        iframe.contentWindow?.document || iframe.contentDocument || null;
      if (!doc) {
        document.body.removeChild(iframe);
        window.print();
        return;
      }

      doc.open();
      doc.write(printStyle + html);
      doc.close();

      const win = iframe.contentWindow || window;
      const doPrint = () => {
        win.focus();
        try {
          win.print();
        } catch {}
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
      };
      setTimeout(doPrint, 200);
    } catch (err) {
      console.error("Print error:", err);
      toast.error(err?.response?.data?.message || "Failed to print voucher");
    }
  }
  async function downloadVoucherPdf(id) {
    try {
      // Use the proper document templates system instead of hardcoded HTML
      const templateType = isRV
        ? "receipt-voucher"
        : isPV
          ? "payment-voucher"
          : isPAYV
            ? "payment-voucher"
            : isCV
              ? "contra-voucher"
              : "";
      if (!templateType) return;
      const templateName = isRV
        ? "Receipt Voucher"
        : isPV
          ? "Payment voucher"
          : isPAYV
            ? "Payment Voucher"
            : isCV
              ? "Contra Voucher"
              : "";
      let templateId = null;
      try {
        const tRes = await api.get(`/templates/${templateType}`, {
          params: { name: templateName },
        });
        const tItems = Array.isArray(tRes.data?.items) ? tRes.data.items : [];
        templateId = Number(tItems?.[0]?.id || 0) || null;
      } catch {}

      let payload_data = null;
      try {
        const docRes = await api.get(`/finance/vouchers/${id}`);
        if (docRes.data) payload_data = docRes.data;
      } catch (err) {
        console.warn('Failed to fetch document data for print:', err);
      }

      const resp = await api.post(
        `/documents/${templateType}/${id}/render`,
        { format: "html", feature_name: templateType, payload_data, ...(templateId ? { template_id: templateId } : {}) },
        { headers: { "Content-Type": "application/json" } },
      );
      const html =
        typeof resp.data === "string" ? resp.data : String(resp.data || "");
      const fname =
        (isRV
          ? "ReceiptVoucher_"
          : isPV || isPAYV
            ? "PaymentVoucher_"
            : isCV
              ? "ContraVoucher_"
              : "Voucher_") +
        id +
        ".pdf";
      await renderHtmlToPdf(html, fname);
    } catch (err) {
      console.error("PDF download error:", err);
      toast.error(
        err?.response?.data?.message || "Failed to download voucher PDF",
      );
    }
  }

  async function reverseVoucher(id) {
    try {
      const reason = window.prompt("Reason for reversal (optional):") || "";
      await api.post(`/finance/vouchers/${id}/reverse`, { reason });
      toast.success("Voucher reversed");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to reverse voucher");
    }
  }

  async function openForwardModal(v) {
    setSelectedVoucher(v);
    setShowForwardModal(true);
    setWfError("");
                    setForwardComments("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(items);
        await computeCandidateFromList(items);
      } catch (e) {
        setWfError(e?.response?.data?.message || "Failed to load workflows");
      } finally {
        setWfLoading(false);
      }
    } else {
      await computeCandidate();
    }
  }

  async function computeCandidate() {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWorkflowSteps([]);
      setWfError("");
                    setForwardComments("");
      return;
    }
    const route = isPV
      ? "/finance/payment-voucher"
      : isRV
        ? "/finance/receipt-voucher"
        : isCV
          ? "/finance/contra-voucher"
          : isPAYV
            ? "/finance/payment-voucher"
            : "/finance/journal-voucher";
    const synonyms = isPV
      ? ["PAYMENT_VOUCHER", "Payment Voucher", "PV"]
      : isRV
        ? ["RECEIPT_VOUCHER", "Receipt Voucher", "RV"]
        : isCV
          ? ["CONTRA_VOUCHER", "Contra Voucher", "CV"]
          : isPAYV
            ? [
                "PAYMENT_VOUCHER_PAYV",
                "Payment Voucher PAYV",
                "PAYV",
                "MAKE_PAYMENT",
                "Make Payment",
              ]
            : ["JOURNAL_VOUCHER", "Journal Voucher", "JV"];
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 && String(w.document_route || "") === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          (normalize(w.document_type) === normalize(synonyms[0]) ||
            normalize(w.document_type) === normalize(synonyms[1]) ||
            normalize(w.document_type) === normalize(synonyms[2]) ||
            normalize(w.document_type) === normalize(synonyms[3]) ||
            normalize(w.document_type) === normalize(synonyms[4])),
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    setTargetApproverId(null);
    setWorkflowSteps([]);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res?.data?.item || {};
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null,
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  }

  async function computeCandidateFromList(items) {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWorkflowSteps([]);
      setWfError("");
                    setForwardComments("");
      return;
    }
    const route = isPV
      ? "/finance/payment-voucher"
      : isRV
        ? "/finance/receipt-voucher"
        : isCV
          ? "/finance/contra-voucher"
          : isPAYV
            ? "/finance/payment-voucher"
            : "/finance/journal-voucher";
    const synonyms = isPV
      ? ["PAYMENT_VOUCHER", "Payment Voucher", "PV"]
      : isRV
        ? ["RECEIPT_VOUCHER", "Receipt Voucher", "RV"]
        : isCV
          ? ["CONTRA_VOUCHER", "Contra Voucher", "CV"]
          : isPAYV
            ? [
                "PAYMENT_VOUCHER_PAYV",
                "Payment Voucher PAYV",
                "PAYV",
                "MAKE_PAYMENT",
                "Make Payment",
              ]
            : ["JOURNAL_VOUCHER", "Journal Voucher", "JV"];
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      items.find(
        (w) =>
          Number(w.is_active) === 1 && String(w.document_route || "") === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          (normalize(w.document_type) === normalize(synonyms[0]) ||
            normalize(w.document_type) === normalize(synonyms[1]) ||
            normalize(w.document_type) === normalize(synonyms[2]) ||
            normalize(w.document_type) === normalize(synonyms[3]) ||
            normalize(w.document_type) === normalize(synonyms[4])),
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    setTargetApproverId(null);
    setWorkflowSteps([]);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res?.data?.item || {};
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null,
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  }

  async function forwardDocument() {
    if (!selectedVoucher) return;
    setSubmittingForward(true);
    setWfError("");
    // Optimistic update
    let optimisticApprover = null;
    try {
      const first =
        Array.isArray(workflowSteps) && workflowSteps.length
          ? workflowSteps[0]
          : null;
      const opts = first
        ? Array.isArray(first.approvers) && first.approvers.length
          ? first.approvers.map((u) => ({ id: u.id, name: u.username }))
          : first.approver_user_id
            ? [
                {
                  id: first.approver_user_id,
                  name: first.approver_name || String(first.approver_user_id),
                },
              ]
            : []
        : [];
      if (targetApproverId && opts.length) {
        const hit = opts.find((u) => Number(u.id) === Number(targetApproverId));
        optimisticApprover = hit ? hit.name : null;
      }
    } catch {}
    setItems((prev) =>
      prev.map((x) =>
        x.id === selectedVoucher.id
          ? {
              ...x,
              status: "PENDING_APPROVAL",
              forwarded_to_username:
                optimisticApprover || x.forwarded_to_username || "Approver",
            }
          : x,
      ),
    );
    setShowForwardModal(false);
    setSelectedVoucher(null);
    try {
      const amount =
        selectedVoucher.total_debit === undefined ||
        selectedVoucher.total_debit === null
          ? selectedVoucher.total_credit === undefined ||
            selectedVoucher.total_credit === null
            ? null
            : Number(selectedVoucher.total_credit || 0)
          : Number(selectedVoucher.total_debit || 0);
      const res = await api.post(
        `/finance/vouchers/${selectedVoucher.id}/submit`,
        {
          amount,
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
        comments: forwardComments,
        },
      );
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      let approverName = null;
      try {
        const first =
          Array.isArray(workflowSteps) && workflowSteps.length
            ? workflowSteps[0]
            : null;
        const opts = first
          ? Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers.map((u) => ({
                id: u.id,
                name: u.username,
              }))
            : first.approver_user_id
              ? [
                  {
                    id: first.approver_user_id,
                    name: first.approver_name || String(first.approver_user_id),
                  },
                ]
              : []
          : [];
        if (targetApproverId && opts.length) {
          const hit = opts.find(
            (u) => Number(u.id) === Number(targetApproverId),
          );
          approverName = hit ? hit.name : null;
        }
      } catch {}
      setItems((prev) =>
        prev.map((x) =>
          x.id === selectedVoucher.id
            ? {
                ...x,
                status: newStatus,
                forwarded_to_username:
                  approverName || x.forwarded_to_username || "Approver",
              }
            : x,
        ),
      );
      try {
        toast.success("Voucher forwarded for approval");
      } catch {}
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to forward for approval",
      );
    } finally {
      setSubmittingForward(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">{title}</h1>
            <p className="text-sm mt-1">List, review, and manage vouchers</p>
          </div>
          <div className="flex gap-2">
            <Link to="/finance?section=Voucher%20Management" className="font-sans btn btn-secondary">
              Return to Menu
            </Link>
            <button
              type="button"
              className="btn-success"
              onClick={load}
              disabled={loading}
            >
              Refresh
            </button>
            <Link to={`./create`} className="btn-success">
              Create New
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <div>
              <label className="label">From</label>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <input
                className="input"
                placeholder="Search voucher no or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full md:w-56">
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="POSTED">Posted</option>
                <option value="REVERSED">Reversed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="md:col-span-6 flex items-end"></div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
              <div className="mt-2">Loading...</div>
            </div>
          ) : sortedVouchers.length === 0 ? (
            <div className="text-center py-12">No vouchers found.</div>
          ) : (
            
                <>
<div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
              <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
                <thead>
                  <tr>
                    <SortableHeader label="Voucher No" sortKey="voucher_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Date" sortKey="voucher_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Description" sortKey="description" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Amount" sortKey="total_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                    <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <th className="text-right">Actions</th>
                    {(isPAYV || isRV || isJV) && <SortableHeader label="Created By" sortKey="created_by_username" currentKey={sortKey} direction={sortDir} onToggle={toggle} />}
                    {(isPAYV || isRV || isJV) && <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />}
                  </tr>
                </thead>
                <tbody>
                  {sortedVouchers.map((v) => (
                    <tr key={v.id}>
                      <td className="font-medium">
                        {formatVoucherNoDisplay(
                          v.voucher_no,
                          v.voucher_type_code,
                        )}
                      </td>
                      <td>{new Date(v.voucher_date).toLocaleDateString()}</td>
                      <td>{renderDescription(v)}</td>
                      <td className="text-right font-medium">
                        {`GH₵ ${Number(v.total_amount ?? v.amount ?? v.total_debit ?? v.total_credit ?? v.balanced_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </td>
                      <td>
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-2">
                          {/* Slot 1: View */}
                          <div className="min-w-[80px]">
                            <Link
                              to={`/finance/${basePath}/${v.id}?mode=view`}
                              data-rbac-exempt="true"
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                            >
                              View
                            </Link>
                          </div>

                          {/* Slot 2: Edit */}
                          <div className="min-w-[80px]">
                            {canPerformAction("finance:vouchers", "edit") &&
                            !isPV &&
                            !["APPROVED", "POSTED"].includes(
                              String(v.status || "").toUpperCase(),
                            ) ? (
                              <Link
                                to={`/finance/${basePath}/${v.id}?mode=edit`}
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                              >
                                Edit
                              </Link>
                            ) : (
                              <div className="w-full h-9" />
                            )}
                          </div>

                          {/* Slot 3: Print */}
                          <div className="min-w-[80px]">
                            {(isRV || isJV || isPAYV || isCV) ? (
                              <ListPrintIconButton
                                onClick={() => printVoucher(v.id)}
                              />
                            ) : (
                              <div className="w-full h-9" />
                            )}
                          </div>

                          {/* Slot 4: PDF */}
                          <div className="min-w-[80px]">
                            {(isRV || isJV || isPAYV || isCV) ? (
                              <ListPdfIconButton
                                onClick={() => downloadVoucherPdf(v.id)}
                              />
                            ) : (
                              <div className="w-full h-9" />
                            )}
                          </div>

                          {/* Slot 5: Attachments */}
                          <div className="w-9">
                            <ListAttachmentIconButton
                              onClick={() => {
                                setActiveDocId(v.id);
                                setShowAttach(true);
                              }}
                            />
                          </div>

                          {/* Slot 6: Workflow/Approval */}
                          <div className="min-w-[160px]">
                            {(isRV || isCV || isJV || isPAYV) && (
                              <div className="list-approval-slot">
                                {["APPROVED", "POSTED", "COMPLETED", "FINALIZED"].includes(
                                  String(v.status || "").toUpperCase(),
                                ) ? (
                                  <div className="flex items-center gap-2">
                                    <span className="list-approval-approved-pill">
                                      Approved
                                    </span>
                                    {/* Slot 7: Reverse Approval */}
                                    {((isRV || isCV || isJV || isPAYV) &&
                                      !isSV && !isPV) && (
                                      <ReverseApprovalButton
                                        docType={isRV ? "RECEIPT_VOUCHER" : isCV ? "CONTRA_VOUCHER" : isPAYV ? "PAYMENT_VOUCHER" : "JOURNAL_VOUCHER"}
                                        docId={v.id}
                                        className="list-approval-reverse-btn"
                                        onDone={() => setItems((prev) => prev.map((x) => x.id === v.id ? { ...x, status: "RETURNED", forwarded_to_username: null } : x))}
                                      >
                                        Reverse Approval
                                      </ReverseApprovalButton>
                                    )}
                                  </div>
                                ) : v.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(v.status || "").toUpperCase()) ? (
                                  <span className="list-approval-forwarded-pill">
                                    Forwarded to {v.forwarded_to_username}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="list-approval-forward-btn"
                                    onClick={() => openForwardModal(v)}
                                    disabled={submittingForward || ["POSTED", "PENDING_APPROVAL", "SUBMITTED", "APPROVED", "COMPLETED", "FINALIZED"].includes(String(v.status || "").toUpperCase())}
                                  >
                                    {isCV ? "Approve" : "Forward for Approval"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {(isPAYV || isRV || isJV) && <td className="py-2">{v.created_by_username || v.created_by_name || "-"}</td>}
                      {(isPAYV || isRV || isJV) && <td className="py-2">{v.created_at ? new Date(v.created_at).toLocaleDateString() : "-"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          
</>
)}
        </div>
      </div>
      {showForwardModal ? (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedVoucher(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                    setForwardComments("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Voucher:{" "}
                <span className="font-semibold">
                  {selectedVoucher?.voucher_no}
                </span>
              </div>
              <div className="text-sm text-slate-700">
                Workflow:{" "}
                <span className="font-semibold">
                  {candidateWorkflow
                    ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})`
                    : "None (inactive)"}
                </span>
              </div>
              <div>
                {wfLoading ? (
                  <div className="text-sm">Loading workflow...</div>
                ) : null}
                {wfError ? (
                  <div className="text-sm text-red-600">{wfError}</div>
                ) : null}
              </div>
              <div className="text-sm">
                <div className="font-medium">Target Approver</div>
                {(() => {
                  const hasSteps =
                    Array.isArray(workflowSteps) && workflowSteps.length > 0;
                  const first = hasSteps ? workflowSteps[0] : null;
                  const opts = first
                    ? Array.isArray(first.approvers) && first.approvers.length
                      ? first.approvers.map((u) => ({
                          id: u.id,
                          name: u.username,
                        }))
                      : first.approver_user_id
                        ? [
                            {
                              id: first.approver_user_id,
                              name:
                                first.approver_name ||
                                String(first.approver_user_id),
                            },
                          ]
                        : []
                    : [];
                  return opts.length > 0 ? (
                    <div className="mt-1">
                      <select
                        className="input w-full"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">Select target approver</option>
                        {opts.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${firstApprover.stepName}${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(
                                    firstApprover.approvalLimit,
                                  ).toLocaleString()}`
                                : ""
                            }`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      {candidateWorkflow
                        ? "No approver found in workflow definition"
                        : "No active workflow; default behavior will apply"}
                    </div>
                  );
                })()}
              </div>
            </div>
            
                <div className="mt-4 p-4 border-t border-slate-200">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Comments (Optional)</label>
                  <textarea
                    value={forwardComments}
                    onChange={(e) => setForwardComments(e.target.value)}
                    className="w-full border-slate-300 rounded-md focus:ring-brand focus:border-brand sm:text-sm"
                    rows={3}
                    placeholder="Add any comments for the approver..."
                  />
                </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedVoucher(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                    setForwardComments("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardDocument}
                disabled={
                  submittingForward ||
                  !selectedVoucher ||
                  (Array.isArray(workflowSteps) &&
                    workflowSteps.length > 0 &&
                    candidateWorkflow &&
                    !targetApproverId)
                }
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
