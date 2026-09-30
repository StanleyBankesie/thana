/**
 * @fileoverview DeliveryList component.
 * Provides functionality for DeliveryList.
 */

import React, { useEffect, useMemo, useState } from "react";
import { filterAndSort } from "@/utils/searchUtils.js";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client";
import { renderHtmlToPdf } from "@/utils/pdfUtils.js";
import {
  ListPrintIconButton,
  ListPdfIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import defaultLogo from "../../../../assets/resources/OMNISUITE_LOGO_FILL.png";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

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
    <title>Delivery Note</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #fff; }
      .dn { font-size: 12px; }
      .dn table { border-collapse: collapse; width: 100%; }
      .dn th, .dn td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
      .dn th { background: #f8fafc; text-align: left; }
      .dn .right { text-align: right; }
      .dn .center { text-align: center; }
      .dn-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px; }
      .dn-logo { min-width: 120px; max-width: 200px; }
      .dn-company { text-align: right; font-size: 11px; line-height: 1.35; }
      .dn-company .name { font-weight: 800; font-size: 14px; }
      .dn-titlebar { display: flex; align-items: center; gap: 10px; color: #0f172a; margin: 4px 0 10px; }
      .dn-titlebar .line { flex: 1; height: 1px; background: #0f172a; }
      .dn-titlebar .title { font-weight: 700; }
      .dn-details { width: 100%; margin-bottom: 10px; border: 1px solid #cbd5e1; }
      .dn-details td { border-color: #cbd5e1; }
      .dn-details .label { width: 32%; color: #475569; }
      .dn-details .label-wide { width: 40%; color: #475569; }
      .dn-cust { padding: 8px; }
      .dn-cust .row { display: flex; gap: 6px; margin: 2px 0; }
      .dn-cust .label { color: #475569; min-width: 110px; }
      .dn-cust .value { flex: 1; }
      .dn-items thead th { font-weight: 600; }
      .dn-footer a { color: inherit; text-decoration: underline; }
      .dn-sign { margin-top: 14px; }
      .dn-sign .line { border-bottom: 1px solid #0f172a; display: inline-block; }
    </style>
  </head>
  <body>${bodyHtml || ""}</body>
</html>`;
}

function renderDeliveryNoteHtml(data) {
  const c = data.company || {};
  const d = data.delivery || {};
  const u = data.customer || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const total = String(data.totals?.total || "");
  return `
  <div class="dn">
  <div class="dn-header">
    <div class="dn-logo">${c.logoHtml || ""}</div>
    <div class="dn-company">
      <div class="name">${escapeHtml(c.name || "")}</div>
      <div>${escapeHtml(c.address || "")}</div>
      <div>${escapeHtml([c.city, c.state, c.country].filter(Boolean).join(", "))} ${escapeHtml(c.postalCode || "")}</div>
      <div>Telephone: ${escapeHtml(c.phone || "")}</div>
      <div>Email: ${escapeHtml(c.email || "")}</div>
      <div>${escapeHtml(c.website || "")}</div>
      <div>TIN: ${escapeHtml(c.taxId || "")} &nbsp; Reg: ${escapeHtml(c.registrationNo || "")}</div>
    </div>
  </div>
  <div class="dn-titlebar">
    <div class="line"></div>
    <div class="title">* Delivery Note *</div>
    <div class="line"></div>
  </div>
  <table class="dn-details">
    <tr>
      <td style="width:50%;vertical-align:top;border-right:1px solid #cbd5e1;">
        <div class="dn-cust">
          <div class="row"><div class="label">Customer Name</div><div class="value">: ${escapeHtml(u.name || "")}</div></div>
          <div class="row"><div class="label">Address</div><div class="value">: ${escapeHtml(u.address || "")}</div></div>
          <div class="row"><div class="label">City</div><div class="value">: ${escapeHtml(u.city || "")}</div></div>
          <div class="row"><div class="label">State</div><div class="value">: ${escapeHtml(u.state || "")}</div></div>
          <div class="row"><div class="label">Country</div><div class="value">: ${escapeHtml(u.country || "")}</div></div>
        </div>
      </td>
      <td style="width:50%;vertical-align:top;">
        <table style="width:100%;">
          <tr><td class="label-wide">Delivery No</td><td>:</td><td>${escapeHtml(d.delivery_no || "")}</td></tr>
          <tr><td class="label-wide">Delivery Date</td><td>:</td><td>${escapeHtml(d.delivery_date || "")}</td></tr>
          <tr><td class="label-wide">Order No</td><td>:</td><td>${escapeHtml(d.order_no || "")}</td></tr>
          <tr><td class="label-wide">Order Date</td><td>:</td><td>${escapeHtml(d.order_date || "")}</td></tr>
          <tr><td class="label-wide">Del Method</td><td>:</td><td>${escapeHtml(d.delivery_method || "")}</td></tr>
          <tr><td class="label-wide">Our Ref</td><td>:</td><td>${escapeHtml(d.our_ref || "")}</td></tr>
        </table>
      </td>
    </tr>
  </table>
  <table class="dn-items">
    <thead>
      <tr>
        <th style="width:6%;">Sr No.</th>
        <th style="width:16%;">Product Code</th>
        <th style="width:36%;">Product Description</th>
        <th class="right" style="width:18%;">Quantity Unit</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (it, idx) => `
        <tr>
          <td class="center">${String(idx + 1)}</td>
          <td>${escapeHtml(it.item_code || "")}</td>
          <td>${escapeHtml(it.item_name || "")}</td>
          <td class="right">${escapeHtml(it.qty_display || it.qty || "")}</td>
        </tr>
      `,
        )
        .join("")}
      <tr>
        <td colspan="3" class="right"><strong>Total Quantity</strong></td>
        <td class="right"><strong>${escapeHtml(items.reduce((s, x) => s + Number(x.qty || 0), 0).toFixed(2))}</strong></td>
      </tr>
    </tbody>
  </table>
  <div class="dn-footer" style="margin-top:10px;">
    <table style="width:100%;">
      <tr><td style="width:20%;">Item Count</td><td>:</td><td>${String(items.length)}</td></tr>
      <tr><td>Vehicle No</td><td>:</td><td>${escapeHtml(d.vehicle_no || "")}</td></tr>
      <tr><td>DRIVER NAME AND SIGN</td><td>:</td><td></td></tr>
      <tr><td>WAY BILL NO & CARRIER</td><td>:</td><td>${escapeHtml(d.waybill_no || "")}</td></tr>
      <tr><td>GOODS ISSUED BY (SIGN)</td><td>:</td><td></td></tr>
    </table>
  </div>
  <div class="dn-sign">
    <div style="text-align:right;">
      <span class="line">All above goods received in good order and condition</span>
    </div>
    <div style="height:40px;"></div>
    <div style="text-align:right;">
      <span class="line">Signature with Company's Rubber Stamp</span>
    </div>
  </div>
  </div>
  `;
}

async function waitForImages(rootEl) {
  const imgs = Array.from(rootEl.querySelectorAll("img"));
  if (!imgs.length) return;
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DeliveryList() {
  const [viewMode, setViewMode] = useViewMode();
  const { canPerformAction } = usePermission();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
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

  useEffect(() => {
    fetchDeliveries();
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

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/sales/deliveries");
      setItems(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching deliveries");
      console.error("Error fetching deliveries:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = items.filter((r) => {
    return true;
  });
  const filteredSorted = useMemo(() => {
    const s = String(search || "").trim();
    if (!s) return filtered;
    return filterAndSort(filtered, {
      query: s,
      getKeys: (r) => [r.delivery_no, r.customer_name],
    });
  }, [filtered, search]);

  const { sorted: sortedFiltered, sortKey, sortDir, toggle } = useSort(filteredSorted, "created_at", "desc");

  async function markDelivered(id) {
    try {
      setLoading(true);
      setError("");
      await api.put(`/sales/deliveries/${id}/status`, { status: "DELIVERED" });
      setItems((prev) =>
        prev.map((it) =>
          Number(it.id) === Number(id) ? { ...it, status: "DELIVERED" } : it,
        ),
      );
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to mark delivered");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function buildPrintHtmlFor(id) {
    await ensureCompanyInfoLoaded();
    const res = await api.get(`/sales/deliveries/${id}`);
    const header = res.data?.item || {};
    const details = Array.isArray(res.data?.details) ? res.data.details : [];
    const customer =
      (await fetchCustomerFromHeader(header)) ||
      (await fetchCustomerById(header.customer_id)) ||
      null;
    const data = buildDeliveryNoteTemplateData(header, details, customer);
    const body = renderDeliveryNoteHtml(data);
    return wrapDoc(body);
  }

  async function buildPdfFor(id) {
    return null;
  }

  async function fetchCustomerById(customerId) {
    try {
      const id = Number(customerId);
      const resp = await api.get("/sales/customers", {
        params: { active: "true" },
      });
      const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
      if (Number.isFinite(id)) {
        const byId = items.find((c) => Number(c.id) === id) || null;
        if (byId) return byId;
      }
      return null;
    } catch {
      return null;
    }
  }
  async function ensureCompanyInfoLoaded() {
    try {
      const missing =
        !String(companyInfo.name || "").trim() ||
        !String(companyInfo.address || "").trim() ||
        !String(companyInfo.phone || "").trim() ||
        !String(companyInfo.email || "").trim();
      if (!missing) return;
      const meResp = await api.get("/admin/me");
      const companyId = meResp.data?.scope?.companyId;
      if (!companyId) return;
      const cResp = await api.get(`/admin/companies/${companyId}`);
      const item = cResp.data?.item || {};
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
            : prev.logoUrl || defaultLogo,
      }));
    } catch {}
  }
  async function fetchCustomerFromHeader(header) {
    try {
      const resp = await api.get("/sales/customers", {
        params: { active: "true" },
      });
      const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
      const id = Number(header.customer_id);
      if (Number.isFinite(id)) {
        const byId = items.find((c) => Number(c.id) === id) || null;
        if (byId) return byId;
      }
      const name = String(header.customer_name || "")
        .trim()
        .toLowerCase();
      if (name) {
        const byName =
          items.find(
            (c) =>
              String(c.customer_name || "")
                .trim()
                .toLowerCase() === name,
          ) || null;
        if (byName) return byName;
      }
      return null;
    } catch {
      return null;
    }
  }

  const buildDeliveryNoteTemplateData = (header, details, customer) => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const itemsData = (Array.isArray(details) ? details : []).map((d, idx) => {
      const qty = Number(d.quantity || d.qty || 0);
      const unit = Number(d.unit_price || 0);
      const total = qty * unit;
      return {
        sr_no: idx + 1,
        item_code: String(d.item_code || d.item_id || ""),
        item_name: String(d.item_name || d.item_code || d.item_id || ""),
        qty: qty.toFixed(2),
        qty_display: [qty.toFixed(2), String(d.uom || "").trim()]
          .filter(Boolean)
          .join(" "),
        unit_price: unit.toFixed(2),
        total: total.toFixed(2),
      };
    });
    const grandTotal = itemsData.reduce(
      (s, it) => s + Number(it.total || 0),
      0,
    );
    const totalQty = itemsData.reduce((s, it) => s + Number(it.qty || 0), 0);
    return {
      company: {
        name: companyInfo.name || "Company",
        address: companyInfo.address || "",
        city: companyInfo.city || "",
        state: companyInfo.state || "",
        country: companyInfo.country || "",
        postalCode: companyInfo.postalCode || "",
        phone: companyInfo.phone || "",
        email: companyInfo.email || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl,
        logoHtml,
      },
      delivery: {
        delivery_no: String(header.delivery_no || ""),
        delivery_date: header.delivery_date
          ? String(header.delivery_date).slice(0, 10)
          : "",
        order_no: String(header.order_no || ""),
        order_date: header.order_date
          ? String(header.order_date).slice(0, 10)
          : "",
        delivery_method: String(header.delivery_method || ""),
        our_ref: String(header.our_ref || ""),
        vehicle_no: String(header.vehicle_no || ""),
        waybill_no: String(header.waybill_no || ""),
      },
      customer: {
        id: String((customer && customer.id) ?? header.customer_id ?? ""),
        code: String(
          (customer && customer.customer_code) ?? header.customer_code ?? "",
        ),
        name: String(
          (customer && customer.customer_name) ?? header.customer_name ?? "",
        ),
        type: String(
          (customer && customer.customer_type) ?? header.customer_type ?? "",
        ),
        contactPerson: String(
          (customer && customer.contact_person) ?? header.contact_person ?? "",
        ),
        email: String((customer && customer.email) ?? header.email ?? ""),
        phone: String((customer && customer.phone) ?? header.phone ?? ""),
        mobile: String((customer && customer.mobile) ?? header.mobile ?? ""),
        address: String((customer && customer.address) ?? header.address ?? ""),
        city: String((customer && customer.city) ?? header.city ?? ""),
        state: String((customer && customer.state) ?? header.state ?? ""),
        zone: String((customer && customer.zone) ?? header.zone ?? ""),
        country: String((customer && customer.country) ?? header.country ?? ""),
        paymentTerms: String(
          (customer && customer.payment_terms) ?? header.payment_terms ?? "",
        ),
        creditLimit: Number(
          (customer && customer.credit_limit) ?? header.credit_limit ?? 0,
        ).toFixed(2),
        priceTypeName: String((customer && customer.price_type_name) ?? ""),
        currencyId: String((customer && customer.currency_id) ?? ""),
      },
      items: itemsData,
      totals: { total: grandTotal.toFixed(2), total_qty: totalQty.toFixed(2) },
    };
  };

  async function printDelivery(id) {
    try {
      setError("");
      const resp = await api.post(
        `/documents/delivery-note/${id}/render`,
        { format: "html", feature_name: "delivery-note" },
        { headers: { "Content-Type": "application/json" } },
      );
      const html =
        typeof resp.data === "string" ? resp.data : String(resp.data || "");
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.width = "800px";
      iframe.style.height = "600px";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const doc =
        iframe.contentWindow?.document || iframe.contentDocument || null;
      if (!doc) {
        document.body.removeChild(iframe);
        return;
      }
      doc.open();
      const patchCss = `<style>@media print{img{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
      doc.write(patchCss + html);
      doc.close();
      const win = iframe.contentWindow || window;
      const imgs = iframe.contentDocument?.querySelectorAll("img") || [];
      let loaded = 0;
      if (imgs.length === 0) {
        win.focus();
        try { win.print(); } catch {}
        setTimeout(() => { document.body.removeChild(iframe); }, 100);
      } else {
        imgs.forEach((img) => {
          if (img.complete) {
            loaded++;
            if (loaded === imgs.length) {
              win.focus();
              try { win.print(); } catch {}
              setTimeout(() => { document.body.removeChild(iframe); }, 100);
            }
          } else {
            img.onload = () => {
              loaded++;
              if (loaded === imgs.length) {
                win.focus();
                try { win.print(); } catch {}
                setTimeout(() => { document.body.removeChild(iframe); }, 100);
              }
            };
            img.onerror = () => {
              loaded++;
              if (loaded === imgs.length) {
                win.focus();
                try { win.print(); } catch {}
                setTimeout(() => { document.body.removeChild(iframe); }, 100);
              }
            };
          }
        });
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to print delivery");
      console.error(err);
    }
  }

  async function downloadDelivery(id) {
    try {
      setError("");
      const resp = await api.post(
        `/documents/delivery-note/${id}/render`,
        { format: "html", feature_name: "delivery-note" },
        { headers: { "Content-Type": "application/json" } },
      );
      const html = typeof resp.data === "string" ? resp.data : String(resp.data || "");
      await renderHtmlToPdf(html, `delivery-note-${id}.pdf`);
    } catch (err) {
      console.error("PDF Download Error:", err);
      setError(err?.response?.data?.message || "Failed to download Delivery Note PDF");
    }
  }

  async function buildPdfFor(id) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Delivery Notes
              </h1>
              <p className="text-sm mt-1">
                Track deliveries issued for sales orders
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/sales?section=Sales%20Transactions" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/sales/delivery/new" className="btn-success">
                + New Delivery
              </Link>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <input
                className="input"
                placeholder="Search delivery no or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
              <p className="mt-2">Loading deliveries...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">No deliveries found.</div>
          ) : (
            
                <>
<div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
              <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
                <thead>
                  <tr>
                    <SortableHeader label="Delivery No" sortKey="delivery_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Date" sortKey="delivery_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <th>Actions</th>
                    <SortableHeader label="Created By" sortKey="created_by_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{r.delivery_no}</td>
                      <td>{new Date(r.delivery_date).toLocaleDateString()}</td>
                      <td>{r.customer_name}</td>
                      <td>{r.status}</td>
                      <td className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <div className="min-w-[80px]">
                            <button
                              type="button"
                              className={`w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9 ${
                                !canPerformAction("sales:delivery", "view")
                                  ? "invisible pointer-events-none"
                                  : ""
                              }`}
                              onClick={() =>
                                navigate(`/sales/delivery/${r.id}?mode=view`)
                              }
                            >
                              View
                            </button>
                          </div>
                          <div className="min-w-[80px]">
                            <ListPrintIconButton
                              onClick={() => printDelivery(r.id)}
                            />
                          </div>
                          <div className="min-w-[80px]">
                            <ListPdfIconButton
                              title="PDF"
                              onClick={() => downloadDelivery(r.id)}
                            />
                          </div>
                        </div>
                      </td>
                      <td>{r.created_by_name || "-"}</td>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          
</>
)}
        </div>
      </div>
    </div>
  );
}
