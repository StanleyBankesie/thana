/**
 * @fileoverview PosInvoiceList component.
 * Provides functionality for PosInvoiceList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import api from "../../../../api/client.js";
import defaultLogo from "../../../../assets/resources/OMNISUITE_LOGO_FILL.png";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import QRCode from "qrcode";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

// POS receipt settings are loaded from the database (company/branch scoped)

function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function invoiceTotal(it) {
  return Number(it.gross_amount || 0) + Number(it.tax_amount || 0) - Number(it.discount_amount || 0);
}

// Removed legacy template parsing and wrapper utilities

function toAbsoluteUrl(url) {
  const v = String(url || "").trim();
  if (!v) return "";
  if (
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.startsWith("data:")
  )
    return v;
  const origin = window.location.origin || "";
  if (!origin) return v;
  return v.startsWith("/") ? origin + v : origin + "/" + v;
}

async function waitForImages(container) {
  const imgs = Array.from(container?.querySelectorAll?.("img") || []);
  if (imgs.length === 0) return;
  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) return resolve();
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          }),
      ),
    ),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PosInvoiceList() {
  const [viewMode, setViewMode] = useViewMode();
  const { user } = useAuth();
  const { canPerformAction } = usePermission();
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [fromDate, setFromDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [toDate, setToDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [status, setStatus] = useState("ALL");
  const [paymentMethod, setPaymentMethod] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [terminalCode, setTerminalCode] = useState("");
  const [assignedTerminals, setAssignedTerminals] = useState([]);
  const [terminalsLoading, setTerminalsLoading] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    country: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: "",
  });
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState("");
  const [receiptSettings, setReceiptSettings] = useState({});

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadReceiptSettings() {
      try {
        const res = await api.get("/pos/receipt-settings");
        const item = res.data?.item || null;
        if (!mounted) return;
        if (!item) {
          setReceiptSettings({});
          return;
        }
        setReceiptSettings({
          companyName: item.company_name || "",
          showLogo:
            item.show_logo === 1 ||
            item.show_logo === true ||
            String(item.show_logo).toLowerCase() === "true",
          showBarcode:
            item.show_barcode === 1 ||
            item.show_barcode === true ||
            String(item.show_barcode).toLowerCase() === "true",
          headerText: item.header_text || "",
          footerText: item.footer_text || "",
          contactNumber: item.contact_number || "",
          addressLine1: item.address_line1 || "",
          addressLine2: item.address_line2 || "",
          logoUrl: item.logo_url || "",
        });
      } catch {
        if (!mounted) return;
        setReceiptSettings({});
      }
    }
    loadReceiptSettings();
    return () => {
      mounted = false;
    };
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
    setLoading(true);
    const params = terminalCode ? { params: { terminal: terminalCode } } : {};
    api
      .get("/pos/sales", params)
      .then((res) => {
        if (cancelled) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [terminalCode]);

  useEffect(() => {
    let mounted = true;
    async function fetchCompanyInfo() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) {
          if (!mounted) return;
          setCompanyInfo((prev) => ({
            ...prev,
            logoUrl: prev.logoUrl || "",
          }));
          return;
        }
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        if (!mounted) return;
        setCompanyInfo((prev) => ({
          ...prev,
          name: item.name || prev.name || "",
          address: item.address || prev.address || "",
          city: item.city || prev.city || "",
          state: item.state || prev.state || "",
          country: item.country || prev.country || "",
          phone: item.telephone || prev.phone || "",
          email: item.email || prev.email || "",
          website: item.website || prev.website || "",
          taxId: item.tax_id || prev.taxId || "",
          registrationNo: item.registration_no || prev.registrationNo || "",
          logoUrl:
            item.has_logo === 1 || item.has_logo === true
              ? `/api/admin/companies/${companyId}/logo`
              : "",
        }));
      } catch {
        if (!mounted) return;
        setCompanyInfo((prev) => ({
          ...prev,
          logoUrl: prev.logoUrl || "",
        }));
      }
    }
    fetchCompanyInfo();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let base = items.filter((it) => {
      const statusMatch =
        status === "ALL" ? true : String(it.payment_status || "") === status;
      const paymentMatch =
        paymentMethod === "ALL"
          ? true
          : (() => {
              const pmts = it.payments;
              if (Array.isArray(pmts) && pmts.length > 1) {
                return pmts.some((p) => String(p.method || "").toUpperCase() === paymentMethod);
              }
              return String(it.payment_method || "").toUpperCase() === paymentMethod;
            })();
      const d = String(it.sale_date || "").slice(0, 10);
      const fromOk = fromDate ? d >= fromDate : true;
      const toOk = toDate ? d <= toDate : true;
      return statusMatch && paymentMatch && fromOk && toOk;
    });
    const q = String(searchTerm || "").trim();
    if (!q) return base;
    return filterAndSort(base, {
      query: q,
      getKeys: (it) => [it.sale_no, it.receipt_no, it.customer_name],
    });
  }, [items, searchTerm, status, paymentMethod, fromDate, toDate]);

  const totals = useMemo(() => {
    const count = filtered.length;
    const totalAmount = filtered.reduce(
      (sum, it) => sum + invoiceTotal(it),
      0,
    );
    const paid = filtered.reduce(
      (sum, it) =>
        sum +
        (String(it.payment_status || "") === "PAID"
          ? invoiceTotal(it)
          : 0),
      0,
    );
    const pending = totalAmount - paid;
    return { count, totalAmount, paid, pending };
  }, [filtered]);

  function exportCSV() {
    const headers = ["Invoice No", "Date", "Customer", "Amount", "Status"];
    const rows = filtered.map((it) => [
      String(it.sale_no || ""),
      String(it.sale_date || "")
        .replace("T", " ")
        .slice(0, 16),
      it.customer_id ? `#${it.customer_id}` : "-",
      invoiceTotal(it).toFixed(2),
      String(it.payment_status || ""),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pos_invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function printList() {
    window.print();
  }

  // Removed legacy receipt template fetching

  function buildReceiptTemplateData(sale, details) {
    const settings = receiptSettings || {};
    const when = sale && sale.sale_date ? new Date(sale.sale_date) : new Date();
    const dateStr = when.toLocaleString();
    const method = (function () {
      const paymentsRaw = sale?.payments;
      if (Array.isArray(paymentsRaw) && paymentsRaw.length > 1) {
        return paymentsRaw
          .map((p) => {
            const t = String(p.method || "").toUpperCase();
            if (t === "CASH") return "Cash";
            if (t === "CARD") return "Card";
            if (t === "MOBILE") return "Mobile Money";
            if (t === "BANK") return "Bank";
            return t || "Other";
          })
          .join(" + ");
      }
      const t = String(sale?.payment_method || "").toUpperCase();
      if (t === "CASH") return "Cash";
      if (t === "CARD") return "Card";
      if (t === "MOBILE") return "Mobile Money";
      if (t === "BANK") return "Bank";
      return "Other";
    })();
    const addressParts = [];
    if (companyInfo.address) addressParts.push(companyInfo.address);
    const cityState = [companyInfo.city, companyInfo.state]
      .filter(Boolean)
      .join(", ");
    if (cityState) addressParts.push(cityState);
    if (companyInfo.country) addressParts.push(companyInfo.country);
    const addressLine1 = String(
      addressParts[0] || settings.addressLine1 || "Street address",
    );
    const addressLine2 = String(
      addressParts.slice(1).join(" • ") ||
        settings.addressLine2 ||
        "City, State, ZIP",
    );
    const showLogo = !!settings.showLogo;
    const logoUrl = showLogo ? toAbsoluteUrl(String(settings.logoUrl || "").trim()) : "";
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || settings.companyName || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";

    const gross = Number(sale?.gross_amount || 0);
    const discountAmt = Number(sale?.discount_amount || 0);
    const tax = Number(sale?.tax_amount || 0);
    const subtotal = gross - discountAmt;
    const total = subtotal + tax;

    const itemsArr = (Array.isArray(details) ? details : []).map((d) => {
      const qty = Number(d.qty || 0);
      const price = Number(d.unit_price || 0);
      const lineTotal = Number(d.line_total || qty * price || 0);
      return {
        name: String(d.item_name || ""),
        qty: qty.toFixed(2),
        price: price.toFixed(2),
        discount: "0.00",
        lineTotal: lineTotal.toFixed(2),
      };
    });

    return {
      company: {
        name: String(
          companyInfo.name || settings.companyName || "Company Name",
        ),
        addressLine1,
        addressLine2,
        phone: String(companyInfo.phone || settings.contactNumber || ""),
        logoUrl,
        logoHtml,
      },
      receipt: {
        receiptNo: String(sale?.sale_no || "-"),
        dateTime: dateStr,
        paymentMethod: method,
        headerText: String(settings.headerText || ""),
        footerText: String(settings.footerText || ""),
      },
      items: itemsArr,
      totals: {
        subtotal: subtotal.toFixed(2),
        discount: discountAmt.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
      },
    };
  }

  // Removed legacy template printing helpers

  // Removed legacy template PDF download helper

  function buildReceiptHtml(sale, details, qrHtml) {
    const settings = receiptSettings || {};
    const companyName = String(
      companyInfo.name || settings.companyName || "Company Name",
    );
    const addressParts = [];
    if (companyInfo.address) addressParts.push(companyInfo.address);
    const cityState = [companyInfo.city, companyInfo.state]
      .filter(Boolean)
      .join(", ");
    if (cityState) addressParts.push(cityState);
    if (companyInfo.country) addressParts.push(companyInfo.country);
    const addressLine1 = String(
      addressParts[0] || settings.addressLine1 || "Street address",
    );
    const addressLine2 = String(
      addressParts.slice(1).join(" • ") ||
        settings.addressLine2 ||
        "City, State, ZIP",
    );
    const contactNumber = String(
      companyInfo.phone || settings.contactNumber || "+1234567890",
    );
    const headerText = String(
      settings.headerText || "Thank you for your purchase",
    );
    const footerText = String(settings.footerText || "Please visit again");
    const extras = [];
    if (companyInfo.taxId) extras.push(`TIN: ${companyInfo.taxId}`);
    if (companyInfo.website) extras.push(companyInfo.website);
    const extraLine = extras.join(" • ");
    const showLogo = !!settings.showLogo;
    let logoUrl = showLogo ? String(settings.logoUrl || "").trim() : "";
    if (logoUrl) {
      const isAbsolute =
        logoUrl.startsWith("http://") ||
        logoUrl.startsWith("https://") ||
        logoUrl.startsWith("data:");
      if (!isAbsolute) {
        const origin = window.location.origin || "";
        if (logoUrl.startsWith("/")) {
          logoUrl = origin + logoUrl;
        } else {
          logoUrl = origin + "/" + logoUrl;
        }
      }
    }
    const logoHtml = logoUrl
      ? `<div class="center"><img src="${logoUrl}" alt="${companyName}" style="max-height:100px;margin-bottom:8px;object-fit:contain;" /></div>`
      : "";
    const when = sale && sale.sale_date ? new Date(sale.sale_date) : new Date();
    const dateStr = when.toLocaleString();
    const method = (function () {
      const paymentsRaw = sale?.payments;
      if (Array.isArray(paymentsRaw) && paymentsRaw.length > 1) {
        return paymentsRaw
          .map((p) => {
            const t = String(p.method || "").toUpperCase();
            if (t === "CASH") return "Cash";
            if (t === "CARD") return "Card";
            if (t === "MOBILE") return "Mobile Money";
            if (t === "BANK") return "Bank";
            return t || "Other";
          })
          .join(" + ");
      }
      const t = String(sale?.payment_method || "").toUpperCase();
      if (t === "CASH") return "Cash";
      if (t === "CARD") return "Card";
      if (t === "MOBILE") return "Mobile Money";
      if (t === "BANK") return "Bank";
      return "Other";
    })();
    const rowsHtml = (Array.isArray(details) ? details : [])
      .map((d) => {
        const qty = Number(d.qty || 0);
        const price = Number(d.unit_price || 0);
        const lineTotal = Number(d.line_total || qty * price || 0);
        return `
          <tr>
            <td>${d.item_name || ""}</td>
            <td class="right">${qty.toFixed(2)}</td>
            <td class="right">GH₵ ${price.toFixed(2)}</td>
            <td class="right">GH₵ ${lineTotal.toFixed(2)}</td>
          </tr>
        `;
      })
      .join("");
    const gross = Number(sale?.gross_amount || 0);
    const discount = Number(sale?.discount_amount || 0);
    const tax = Number(sale?.tax_amount || 0);
    const subtotal = gross - discount;
    const total = subtotal + tax;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>POS Invoice</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 16px 24px; max-width: 480px; margin: 0 auto; overflow-wrap: break-word; font-weight: 600; }
          h1 { text-align: center; margin: 0 0 4px; font-size: 18px; font-weight: 700; }
          .center { text-align: center; }
          .muted { font-size: 12px; color: #555; font-weight: 500; }
          .row { display: flex; justify-content: space-between; font-size: 13px; margin: 2px 0; font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { padding: 4px; border-bottom: 1px solid #eee; }
          th { text-align: left; font-weight: 700; }
          th.right, td.right { text-align: right; }
          .totals { margin-top: 8px; border-top: 1px solid #000; padding-top: 4px; }
          .footer { margin-top: 10px; text-align: center; font-size: 11px; white-space: pre-wrap; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        ${logoHtml}
        <h1>${companyName}</h1>
        <div class="center muted">${addressLine1}</div>
        <div class="center muted">${addressLine2}</div>
        <div class="center muted">Mobile: ${contactNumber}</div>
        ${extraLine ? `<div class="center muted">${extraLine}</div>` : ""}
        <div class="center muted" style="margin-top:6px;">${headerText}</div>
        <hr />
        <div class="row"><span>Receipt No:</span><span>${
          sale?.sale_no || "-"
        }</span></div>
        <div class="row"><span>Date:</span><span>${dateStr}</span></div>
        <div class="row"><span>Cashier:</span><span>${sale?.created_by_name || "Cashier"}</span></div>
        <div class="row"><span>Payment:</span><span>${method}</span></div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="right">Qty</th>
              <th class="right">Price</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.replace(
              /<td class="right">(\d+(?:\.\d{1,2})?)<\/td>\s*<td class="right">(\d+(?:\.\d{1,2})?)<\/td>$/gm,
              '<td class="right">$1</td><td class="right">GH₵ $2',
            )}
          </tbody>
        </table>
        <div class="totals">
          <div class="row"><span>Subtotal</span><span>GH₵ ${subtotal.toFixed(
            2,
          )}</span></div>
          <div class="row"><span>Discount</span><span>GH₵ ${discount.toFixed(
            2,
          )}</span></div>
          <div class="row"><span>Tax</span><span>GH₵ ${tax.toFixed(2)}</span></div>
          <div class="row"><strong>Total</strong><strong>GH₵ ${total.toFixed(
            2,
          )}</strong></div>
        </div>
        ${qrHtml || ""}
        <div class="footer">${footerText}</div>
      </body>
      </html>
    `;
    return html;
  }

  async function generateReceiptQrHtml(sale, details) {
    try {
      const settings = receiptSettings || {};
      if (!settings.showBarcode) return "";
      const items = (Array.isArray(details) ? details : []).map((d) => ({
        name: d.item_name || "",
        qty: Number(d.qty || 0),
        price: Number(d.unit_price || 0),
        total: Number(d.line_total || Number(d.qty || 0) * Number(d.unit_price || 0) || 0),
      }));
      const gross = Number(sale?.gross_amount || 0);
      const discount = Number(sale?.discount_amount || 0);
      const tax = Number(sale?.tax_amount || 0);
      const total = gross - discount + tax;
      const payments = sale?.payments;
      const paymentQr = Array.isArray(payments) && payments.length > 1
        ? payments.map((p) => `${p.method || ""}:${Number(p.amount || 0).toFixed(2)}`).join(",")
        : String(sale?.payment_method || "");
      const qrData = JSON.stringify({
        receipt_no: sale?.sale_no || "",
        date: sale?.sale_date || "",
        company: String(settings.companyName || ""),
        payment: paymentQr,
        items,
        subtotal: gross - discount,
        discount,
        tax,
        total,
      });
      const qrDataUrl = await QRCode.toDataURL(qrData, { width: 140, margin: 2 });
      return `<div class="center" style="margin-top:12px;"><img src="${qrDataUrl}" alt="QR Code" style="width:140px;height:140px;" /></div>`;
    } catch {
      return "";
    }
  }

  async function handleView(row) {
    if (!row || !row.id) return;
    setActionLoadingId(row.id);
    try {
      const res = await api.get(`/pos/sales/${row.id}`);
      const sale = res.data?.item || null;
      const details = Array.isArray(res.data?.details) ? res.data.details : [];
      if (!sale) {
        alert("Invoice not found");
        return;
      }
      const qrHtml = await generateReceiptQrHtml(sale, details);
      const html = buildReceiptHtml(sale, details, qrHtml);
      setReceiptHtml(html);
      setShowReceiptModal(true);
    } catch {
      alert("Failed to load invoice");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handlePrint(row) {
    if (!row || !row.id) return;
    setActionLoadingId(row.id);
    try {
      const res = await api.get(`/pos/sales/${row.id}`);
      const sale = res.data?.item || null;
      const details = Array.isArray(res.data?.details) ? res.data.details : [];
      if (!sale) {
        alert("Invoice not found");
        return;
      }
      const qrHtml = await generateReceiptQrHtml(sale, details);
      const html = buildReceiptHtml(sale, details, qrHtml);
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
        return;
      }
      const printStyle = `<style>@media print { img, svg { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }</style>`;
      doc.open();
      doc.write(printStyle + html);
      doc.close();
      const win = iframe.contentWindow || window;
      const handlePrint = () => {
        win.focus();
        try {
          win.print();
        } catch {}
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
      };
      setTimeout(handlePrint, 200);
    } catch {
      alert("Failed to load invoice");
      setActionLoadingId(null);
    }
  }

  async function handleDownload(row) {
    if (!row || !row.id) return;
    setActionLoadingId(row.id);
    try {
      const res = await api.get(`/pos/sales/${row.id}`);
      const sale = res.data?.item || null;
      const details = Array.isArray(res.data?.details) ? res.data.details : [];
      if (!sale) {
        alert("Invoice not found");
        return;
      }
      const settings = receiptSettings || {};
      const companyName = String(
        companyInfo.name || settings.companyName || "Company Name",
      );
      const addressParts = [];
      if (companyInfo.address) addressParts.push(companyInfo.address);
      const cityState = [companyInfo.city, companyInfo.state]
        .filter(Boolean)
        .join(", ");
      if (cityState) addressParts.push(cityState);
      if (companyInfo.country) addressParts.push(companyInfo.country);
      const addressLine1 = String(
        addressParts[0] || settings.addressLine1 || "Street address",
      );
      const addressLine2 = String(
        addressParts.slice(1).join(" • ") ||
          settings.addressLine2 ||
          "City, State, ZIP",
      );
      const contactNumber = String(
        companyInfo.phone || settings.contactNumber || "+1234567890",
      );
      const headerText = String(
        settings.headerText || "Thank you for your purchase",
      );
      const footerText = String(settings.footerText || "Please visit again");
      const when =
        sale && sale.sale_date ? new Date(sale.sale_date) : new Date();
      const dateStr = when.toLocaleString();
    const method = (function () {
      const paymentsRaw = sale?.payments;
      if (Array.isArray(paymentsRaw) && paymentsRaw.length > 1) {
        return paymentsRaw
          .map((p) => {
            const t = String(p.method || "").toUpperCase();
            if (t === "CASH") return "Cash";
            if (t === "CARD") return "Card";
            if (t === "MOBILE") return "Mobile Money";
            if (t === "BANK") return "Bank";
            return t || "Other";
          })
          .join(" + ");
      }
      const t = String(sale?.payment_method || "").toUpperCase();
      if (t === "CASH") return "Cash";
      if (t === "CARD") return "Card";
      if (t === "MOBILE") return "Mobile Money";
      if (t === "BANK") return "Bank";
      return "Other";
    })();
      const gross = Number(sale?.gross_amount || 0);
      const discount = Number(sale?.discount_amount || 0);
      const tax = Number(sale?.tax_amount || 0);
      const subtotal = gross - discount;
      const total = subtotal + tax;
      const doc = new jsPDF("p", "mm", "a4");
      let y = 15;
      doc.setFontSize(14);
      doc.text(companyName, 10, y);
      y += 6;
      doc.setFontSize(10);
      doc.text(addressLine1, 10, y);
      y += 5;
      doc.text(addressLine2, 10, y);
      y += 5;
      doc.text("Mobile: " + contactNumber, 10, y);
      y += 5;
      const extras = [];
      if (companyInfo.taxId) extras.push(`TIN: ${companyInfo.taxId}`);
      if (companyInfo.website) extras.push(companyInfo.website);
      const extraLine = extras.join(" • ");
      if (extraLine) {
        doc.text(extraLine, 10, y);
        y += 5;
      }
      y += 1;
      doc.text(headerText, 10, y);
      y += 8;
      doc.setFontSize(11);
      doc.text("Receipt No: " + (sale.sale_no || "-"), 10, y);
      y += 5;
      doc.text("Date: " + dateStr, 10, y);
      y += 5;
      doc.text("Payment: " + method, 10, y);
      y += 8;
      doc.setFontSize(10);
      doc.text("Item", 10, y);
      doc.text("Qty", 90, y);
      doc.text("Price", 120, y);
      doc.text("Total", 160, y);
      y += 4;
      doc.line(10, y, 200, y);
      y += 5;
      (Array.isArray(details) ? details : []).forEach((d) => {
        const qty = Number(d.qty || 0);
        const price = Number(d.unit_price || 0);
        const lineTotal = Number(d.line_total || qty * price || 0);
        if (y > 270) {
          doc.addPage();
          y = 15;
        }
        const name = String(d.item_name || "");
        const maxLen = 40;
        const nameLines =
          name.length > maxLen
            ? [name.slice(0, maxLen), name.slice(maxLen)]
            : [name];
        nameLines.forEach((ln) => {
          doc.text(ln, 10, y);
          doc.text(qty.toFixed(2), 90, y, { align: "right" });
          doc.text(price.toFixed(2), 120, y, { align: "right" });
          doc.text(lineTotal.toFixed(2), 160, y, { align: "right" });
          y += 5;
        });
      });
      y += 4;
      doc.line(10, y, 200, y);
      y += 6;
      doc.text("Subtotal:", 120, y, { align: "right" });
      doc.text(subtotal.toFixed(2), 160, y, { align: "right" });
      y += 5;
      doc.text("Discount:", 120, y, { align: "right" });
      doc.text(discount.toFixed(2), 160, y, { align: "right" });
      y += 5;
      doc.text("Tax:", 120, y, { align: "right" });
      doc.text(tax.toFixed(2), 160, y, { align: "right" });
      y += 5;
      doc.text("Total:", 120, y, { align: "right" });
      doc.text(total.toFixed(2), 160, y, { align: "right" });
      y += 8;
      const footerLines = footerText.replace(/\r\n/g, "\n").split("\n");
      const prevFont = doc.getFont()?.fontName || "helvetica";
      try {
        doc.setFont("courier", "normal");
      } catch {}
      doc.setFontSize(10);
      footerLines.forEach((ln) => {
        if (y > 270) {
          doc.addPage();
          y = 15;
        }
        doc.text(ln, 10, y);
        y += 5;
      });
      try {
        doc.setFont(prevFont, "normal");
      } catch {}
      const fname = `POS_Invoice_${sale.sale_no || row.id}.pdf`;
      doc.save(fname);
    } catch {
      alert("Failed to download invoice");
    } finally {
      setActionLoadingId(null);
    }
  }

  function closeReceiptModal() {
    setShowReceiptModal(false);
    setReceiptHtml("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => window.history.back()} className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            ← Back to POS
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            POS Invoices
          </h1>
          <p className="text-sm mt-1">
            List of all invoices created from POS sales entry
          </p>
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
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1">
            <div className="md:col-span-3">
              <label className="label">Terminal</label>
              <select
                className="input w-full"
                value={terminalCode}
                onChange={(e) => setTerminalCode(e.target.value)}
                disabled={terminalsLoading}
              >
                <option value="">
                  {terminalsLoading
                    ? "Loading terminals..."
                    : "All Terminals (assigned)"}
                </option>
                {(Array.isArray(assignedTerminals)
                  ? assignedTerminals
                  : []
                ).map((t) => (
                  <option key={String(t.code)} value={String(t.code || "")}>
                    {String(t.code || t.name || "")}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">From</label>
              <input
                type="date"
                className="input w-full"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">To</label>
              <input
                type="date"
                className="input w-full"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Status</label>
              <select
                className="input w-full"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ALL">All</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="label">Payment</label>
              <select
                className="input w-full"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="ALL">All Payments</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="MOBILE">Mobile Money</option>
              </select>
            </div>
            <div className="md:col-span-12">
              <label className="label">Search</label>
              <input
                className="input w-full"
                placeholder="Search invoice no or customer"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-success" onClick={exportCSV}>
              Export CSV
            </button>
            <button className="btn-primary" onClick={printList}>
              Print
            </button>
          </div>
        </div>
      </div>



      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Customer</th>
                <th className="text-right">Amount</th>
                <th>Payment Method</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9">Loading...</td>
                </tr>
              ) : !filtered.length ? (
                <tr>
                  <td colSpan="9">
                    <div className="text-center text-slate-600 py-6">
                      No invoices found
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="font-medium">
                      {it.sale_no || it.receipt_no || "-"}
                    </td>
                    <td>
                      {String(it.sale_date || "")
                        .replace("T", " ")
                        .slice(0, 16)}
                    </td>
                    <td>{String(it.customer_name || "-")}</td>
                    <td className="text-right">
                      {`GH₵ ${invoiceTotal(it).toFixed(2)}`}
                    </td>
                    <td className="text-sm">
                      {(() => {
                        const pmts = it.payments;
                        if (Array.isArray(pmts) && pmts.length > 1) {
                          return pmts.map((p) => {
                            const t = String(p.method || "").toUpperCase();
                            const name = t === "CASH" ? "Cash" : t === "CARD" ? "Card" : t === "MOBILE" ? "Mobile Money" : t === "BANK" ? "Bank" : t;
                            return `${name} (GH₵${Number(p.amount || 0).toFixed(2)})`;
                          }).join(" + ");
                        }
                        const m = String(it.payment_method || "").toUpperCase();
                        if (m === "CASH") return "Cash";
                        if (m === "CARD") return "Card";
                        if (m === "MOBILE") return "Mobile Money";
                        if (m === "BANK") return "Bank";
                        return m || "-";
                      })()}
                    </td>
                    <td>
                      <span
                        className={
                          String(it.payment_status || "") === "PAID"
                            ? "px-2 py-1 rounded bg-green-100 text-green-700 text-xs"
                            : "px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs"
                        }
                      >
                        {String(it.payment_status || "")}
                      </span>
                    </td>
                    <td>{String(it.created_by_name || "-")}</td>
                    <td>
                      {String(it.created_at || it.sale_date || "")
                        .replace("T", " ")
                        .slice(0, 16) || "-"}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={`text-brand hover:text-brand-600 font-medium text-sm ${!canPerformAction("pos:invoices", "view") ? "invisible pointer-events-none" : ""}`}
                          onClick={() => handleView(it)}
                          disabled={actionLoadingId === it.id}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center px-3 py-1.5 rounded bg-brand hover:bg-brand-700 text-white text-xs font-semibold"
                          onClick={() => handlePrint(it)}
                          disabled={actionLoadingId === it.id}
                        >
                          Print
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center px-3 py-1.5 rounded bg-brand hover:bg-brand-700 text-white text-xs font-semibold"
                          onClick={() => handleDownload(it)}
                          disabled={actionLoadingId === it.id}
                        >
                          Download
                        </button>
                      </div>
                    </td>
                    <td>{it.created_by_name || "-"}</td>
                    <td>
                      {it.created_at
                        ? new Date(it.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showReceiptModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="text-lg font-semibold text-slate-900">
                Invoice Preview
              </div>
              <button
                type="button"
                className="btn btn-sm btn-link"
                onClick={closeReceiptModal}
              >
                ✖
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {receiptHtml ? (
                <iframe
                  title="Invoice Preview"
                  srcDoc={receiptHtml}
                  className="w-full h-[70vh] border-0"
                />
              ) : (
                <div className="p-4 text-center text-sm text-slate-500">
                  Loading invoice...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
