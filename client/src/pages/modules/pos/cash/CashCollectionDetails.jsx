/**
 * @fileoverview CashCollectionDetails component.
 * Provides functionality for CashCollectionDetails.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import api from "../../../../api/client.js";
import defaultLogo from "../../../../assets/resources/OMNISUITE_LOGO_FILL.png";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";

function FilterableSelect({
  value,
  onChange,
  options,
  disabled,
  filterPlaceholder,
}) {
  const filtered = Array.isArray(options) ? options : [];
  return (
    <div className="space-y-2">
      <select
        className="input w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {filtered.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function invoiceTotal(it) {
  return Number(it.gross_amount || 0) + Number(it.tax_amount || 0) - Number(it.discount_amount || 0);
}
function isCredit(it) {
  return String(it.payment_method || "").toUpperCase() === "CREDIT";
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CashCollectionDetails() {
  const { canPerformAction } = usePermission();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("ALL");
  const [fromDate, setFromDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [toDate, setToDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [searchNo, setSearchNo] = useState("");
  const [collector, setCollector] = useState("ALL");
  const [actionLoadingId, setActionLoadingId] = useState(null);
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
    logoUrl: defaultLogo,
  });
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState("");
  const [receiptSettings, setReceiptSettings] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/pos/sales")
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
    let mounted = true;
    async function fetchCompanyInfo() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) {
          if (!mounted) return;
          setCompanyInfo((prev) => ({
            ...prev,
            logoUrl: prev.logoUrl || defaultLogo,
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
              : prev.logoUrl || defaultLogo,
        }));
      } catch {
        if (!mounted) return;
        setCompanyInfo((prev) => ({
          ...prev,
          logoUrl: prev.logoUrl || defaultLogo,
        }));
      }
    }
    fetchCompanyInfo();
    return () => {
      mounted = false;
    };
  }, []);

  const collectorOptions = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = String(it.created_by_name || "").trim();
      if (!key) continue;
      if (map.has(key)) continue;
      map.set(key, {
        key,
        label: key,
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      String(a.label || "").localeCompare(String(b.label || "")),
    );
  }, [items]);

  const collectorSelectOptions = useMemo(() => {
    return [
      { value: "ALL", label: "All collectors" },
      ...collectorOptions.map((c) => ({
        value: c.key,
        label: c.label,
      })),
    ];
  }, [collectorOptions]);

  const filtered = useMemo(() => {
    const q = String(searchNo || "").trim();
    const collectorKey =
      collector === "ALL" ? "" : String(collector || "").trim();
    let base = items.filter((it) => {
      const statusMatch =
        status === "ALL" ? true : String(it.payment_status || "") === status;
      const dateVal = String(it.sale_date || "").slice(0, 10);
      const fromOk = fromDate ? dateVal >= fromDate : true;
      const toOk = toDate ? dateVal <= toDate : true;
      const coll = String(it.created_by_name || "").trim();
      const collectorMatch = collectorKey ? coll === collectorKey : true;
      return statusMatch && fromOk && toOk && collectorMatch;
    });
    if (!q) return base;
    return filterAndSort(base, { query: q, getKeys: (it) => [it.sale_no] });
  }, [items, searchNo, status, fromDate, toDate, collector]);

  const totals = useMemo(() => {
    const totalAmount = filtered.reduce(
      (sum, it) =>
        sum + (isCredit(it) ? 0 : invoiceTotal(it)),
      0,
    );
    const cashCollected = filtered.reduce(
      (sum, it) =>
        sum +
        (String(it.payment_status || "") === "PAID" && !isCredit(it)
          ? invoiceTotal(it)
          : 0),
      0,
    );
    const outstanding = totalAmount - cashCollected;
    return {
      count: filtered.length,
      totalAmount,
      cashCollected,
      outstanding,
    };
  }, [filtered]);

  const paymentModeTotals = useMemo(() => {
    const map = {};
    for (const it of filtered) {
      const isPaid = String(it.payment_status || "") === "PAID";
      const paymentsRaw = it.payments;
      let payments = [];
      if (Array.isArray(paymentsRaw) && paymentsRaw.length > 0) {
        payments = paymentsRaw.map((p) => ({
          method: String(p.method || "CASH").toUpperCase(),
          amount: Number(p.amount || 0),
        }));
      } else {
        payments = [{ method: String(it.payment_method || "CASH").toUpperCase(), amount: invoiceTotal(it) }];
      }
      payments.forEach(({ method, amount }) => {
        const m = method || "UNKNOWN";
        if (!map[m]) {
          map[m] = {
            method: m,
            invoices: 0,
            totalAmount: 0,
            collectedAmount: 0,
          };
        }
        map[m].invoices += 1;
        map[m].totalAmount += amount;
        if (isPaid) {
          map[m].collectedAmount += amount;
        }
      });
    }
    return Object.values(map);
  }, [filtered]);

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
    let logoUrl = String(settings.logoUrl || companyInfo.logoUrl || "").trim();
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
      const payments = sale?.payments;
      if (Array.isArray(payments) && payments.length > 1) {
        return payments.map((p) => {
          const t = String(p.method || "").toUpperCase();
          if (t === "CASH") return `Cash (GH₵ ${Number(p.amount || 0).toFixed(2)})`;
          if (t === "CARD") return `Card (GH₵ ${Number(p.amount || 0).toFixed(2)})`;
          if (t === "MOBILE") return `Mobile Money (GH₵ ${Number(p.amount || 0).toFixed(2)})`;
          if (t === "BANK") return `Bank (GH₵ ${Number(p.amount || 0).toFixed(2)})`;
          return `Other (GH₵ ${Number(p.amount || 0).toFixed(2)})`;
        }).join(" + ");
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
            <td class="right">${price.toFixed(2)}</td>
            <td class="right">${lineTotal.toFixed(2)}</td>
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
          .footer { margin-top: 10px; text-align: center; font-size: 11px; }
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
            ${rowsHtml}
          </tbody>
        </table>
        <div class="totals">
          <div class="row"><span>Subtotal</span><span>${subtotal.toFixed(
            2,
          )}</span></div>
          <div class="row"><span>Discount</span><span>${discount.toFixed(
            2,
          )}</span></div>
          <div class="row"><span>Tax</span><span>${tax.toFixed(2)}</span></div>
          <div class="row"><strong>Total</strong><strong>${total.toFixed(
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
      const settings = loadReceiptSettings();
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
      const when =
        sale && sale.sale_date ? new Date(sale.sale_date) : new Date();
      const dateStr = when.toLocaleString();
      const method = (function () {
        const payments = sale?.payments;
        if (Array.isArray(payments) && payments.length > 1) {
          return payments.map((p) => {
            const t = String(p.method || "").toUpperCase();
            if (t === "CASH") return `Cash (GH₵ ${Number(p.amount || 0).toFixed(2)})`;
            if (t === "CARD") return `Card (GH₵ ${Number(p.amount || 0).toFixed(2)})`;
            if (t === "MOBILE") return `Mobile Money (GH₵ ${Number(p.amount || 0).toFixed(2)})`;
            if (t === "BANK") return `Bank (GH₵ ${Number(p.amount || 0).toFixed(2)})`;
            return `Other (GH₵ ${Number(p.amount || 0).toFixed(2)})`;
          }).join(" + ");
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
            Cash Collection Details
          </h1>
          <p className="text-sm mt-1">
            List of all invoices from POS sales with collection summary
          </p>
        </div>

      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <div className="md:col-span-2">
                <label className="label">From Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">To Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <div>
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
              <div className="md:col-span-2">
                <label className="label">Collector</label>
                <FilterableSelect
                  value={collector}
                  onChange={setCollector}
                  options={collectorSelectOptions}
                  disabled={!collectorSelectOptions.length}
                  filterPlaceholder="Filter collectors..."
                />
              </div>
              <div className="md:col-span-4">
                <label className="label">Invoice No</label>
                <input
                  className="input w-full"
                  placeholder="Search by invoice number"
                  value={searchNo}
                  onChange={(e) => setSearchNo(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-slate-200 bg-white">
            <div className="text-xs uppercase text-slate-500">Invoices</div>
            <div className="text-2xl font-bold text-slate-900">
              {totals.count}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 bg-white">
            <div className="text-xs uppercase text-slate-500">Total Amount</div>
            <div className="text-2xl font-bold text-brand-700">
              {`GH₵ ${Number(totals.totalAmount).toFixed(2)}`}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-slate-200 bg-white">
            <div className="text-xs uppercase text-slate-500">
              Cash Collected
            </div>
            <div className="text-2xl font-bold text-green-700">
              {`GH₵ ${Number(totals.cashCollected).toFixed(2)}`}
            </div>
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

      <div className="card">
        <div className="card-body">
          <div className="text-sm font-semibold text-slate-900">
            Payment Mode Summary
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 mt-3">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-left p-2 text-xs uppercase">
                    Payment Mode
                  </th>
                  <th className="text-right p-2 text-xs uppercase">Invoices</th>
                  <th className="text-right p-2 text-xs uppercase">
                    Total Amount
                  </th>
                  <th className="text-right p-2 text-xs uppercase">
                    Amount Collected
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {!paymentModeTotals.length ? (
                  <tr>
                    <td className="p-3 text-center text-slate-500" colSpan={4}>
                      No data for selected filters
                    </td>
                  </tr>
                ) : (
                  paymentModeTotals.map((m) => (
                    <tr key={m.method} className="border-t">
                      <td className="p-2">{m.method}</td>
                      <td className="p-2 text-right">
                        {Number(m.invoices || 0).toLocaleString()}
                      </td>
                      <td className="p-2 text-right">
                        {`GH₵ ${Number(m.totalAmount || 0).toFixed(2)}`}
                      </td>
                      <td className="p-2 text-right">
                        {`GH₵ ${Number(m.collectedAmount || 0).toFixed(2)}`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="text-left p-2 text-xs uppercase">
                    Invoice No
                  </th>
                  <th className="text-left p-2 text-xs uppercase">Date</th>
                  <th className="text-left p-2 text-xs uppercase">
                    Payment Mode
                  </th>
                  <th className="text-right p-2 text-xs uppercase">
                    Amount Collected
                  </th>
                  <th className="text-left p-2 text-xs uppercase">Collector</th>
                  <th className="text-left p-2 text-xs uppercase">Status</th>
                  <th className="text-left p-2 text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <tr>
                    <td className="p-3" colSpan={6}>
                      Loading...
                    </td>
                  </tr>
                ) : !filtered.length ? (
                  <tr>
                    <td className="p-3" colSpan={6}>
                      No invoices found
                    </td>
                  </tr>
                ) : (
                  filtered.map((it) => (
                    <tr key={it.id} className="border-t">
                      <td className="p-2">{it.sale_no}</td>
                      <td className="p-2">
                        {String(it.sale_date || "")
                          .replace("T", " ")
                          .slice(0, 16)}
                      </td>
                      <td className="p-2">
                        {(() => {
                          const raw = it.payments;
                          if (Array.isArray(raw) && raw.length > 1) {
                            return raw.map((p) => String(p.method || "").toUpperCase() || "-").join(" + ");
                          }
                          return String(it.payment_method || "").toUpperCase() || "-";
                        })()}
                      </td>
                      <td className="p-2 text-right">
                        {String(it.payment_method || "").toUpperCase() === "CREDIT"
                          ? "-"
                          : `GH₵ ${invoiceTotal(it).toFixed(2)}`}
                      </td>
                      <td className="p-2">
                        {it.created_by_name || "-"}
                      </td>
                      <td className="p-2">
                        <span
                          className={
                            String(it.payment_status || "") === "PAID"
                              ? "inline-block px-2 py-1 rounded bg-green-100 text-green-800"
                              : "inline-block px-2 py-1 rounded bg-yellow-100 text-yellow-800"
                          }
                        >
                          {String(it.payment_status || "") || "-"}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={`text-brand hover:text-brand-600 font-medium text-sm ${!canPerformAction("pos:cash-collection", "view") ? 'invisible pointer-events-none' : ''}`}
                            onClick={() => handleView(it)}
                            disabled={actionLoadingId === it.id}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn-primary text-xs px-3 py-1.5"
                            onClick={() => handlePrint(it)}
                            disabled={actionLoadingId === it.id}
                          >
                            Print
                          </button>
                          <button
                            type="button"
                            className="btn-outline text-xs px-3 py-1.5"
                            onClick={() => handleDownload(it)}
                            disabled={actionLoadingId === it.id}
                          >
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td className="p-2 font-semibold" colSpan={4}>
                    Totals
                  </td>
                  <td className="p-2 text-right font-bold">
                    {`GH₵ ${Number(totals.totalAmount).toFixed(2)}`}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col text-xs">
                      <span className="text-green-700">
                        Collected:{" "}
                        {`GH₵ ${Number(totals.cashCollected).toFixed(2)}`}
                      </span>
                      <span className="text-red-700">
                        Outstanding:{" "}
                        {`GH₵ ${Number(totals.outstanding).toFixed(2)}`}
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
