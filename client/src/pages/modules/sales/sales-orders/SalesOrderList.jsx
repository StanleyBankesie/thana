/**
 * @fileoverview SalesOrderList component.
 * Provides functionality for SalesOrderList.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { api } from "../../../../api/client";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { renderHtmlToPdf } from "@/utils/pdfUtils.js";
import { toast } from "react-toastify";
import { filterAndSort } from "@/utils/searchUtils.js";
import useSort from "../../../../hooks/useSort.js";
import SortableHeader from "../../../../components/SortableHeader.jsx";
import addNotification from "../../../../utils/addNotification.js";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SalesOrderList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    canPerformAction,
    canCreateOnPage,
    canDeleteOnPage,
    hasExceptional,
    canReverseApproval,
  } = usePermission();
  const [orders, setOrders] = useState([]);
  const [exceptionalAllowed, setExceptionalAllowed] = useState(false);
  const [cancelDenied, setCancelDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [forwardedTo, setForwardedTo] = useState({});
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: "",
  });
  const [preparedBy, setPreparedBy] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadWorkflowFlags() {
      try {
        const res = await api.get("/workflows");
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        if (cancelled) return;
        setWorkflowsCache(list);
        const route = "/sales/sales-orders";
        const normalize = (s) =>
          String(s || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "_");
        const matching = list.filter(
          (w) =>
            String(w.document_route) === route ||
            normalize(w.document_type) === "SALES_ORDER",
        );
        const hasInactive = matching.some((w) => Number(w.is_active) === 0);
        const chosen =
          list.find(
            (w) =>
              Number(w.is_active) === 1 && String(w.document_route) === route,
          ) ||
          list.find(
            (w) =>
              Number(w.is_active) === 1 &&
              normalize(w.document_type) === "SALES_ORDER",
          ) ||
          null;
        setCandidateWorkflow(chosen || null);
        setHasInactiveWorkflow(!chosen && hasInactive);
      } catch {}
    }
    loadWorkflowFlags();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reverseSalesOrder(id) {
    try {
      await api.post(`/sales/orders/${id}/reverse`, {
        desired_status: "DRAFT",
      });
      setOrders((prev) =>
        prev.map((x) =>
          x.id === id
            ? { ...x, status: "DRAFT", forwarded_to_username: null }
            : x,
        ),
      );
      toast.success("Sales order reversed");
      try {
        const so = orders.find((o) => Number(o.id) === Number(id));
        const icon = "/OMNISUITE_ICON_CLEAR.png";
        const link = `/sales/sales-orders/${id}?mode=edit`;
        addNotification({
          title: "Sales Order reversed",
          message: `SO ${so?.order_no || id} is now ready to forward for approval`,
          native:
            typeof window !== "undefined" &&
            "Notification" in window &&
            window.Notification?.permission === "granted",
          icon,
          onClick: () => {
            navigate(link);
          },
        });
      } catch {}
    } catch (e1) {
      try {
        await api.post("/workflows/reverse-by-document", {
          document_type: "SALES_ORDER",
          document_id: id,
          desired_status: "DRAFT",
        });
        setOrders((prev) =>
          prev.map((x) =>
            x.id === id
              ? { ...x, status: "DRAFT", forwarded_to_username: null }
              : x,
          ),
        );
        toast.success("Sales order reversed");
        try {
          const so = orders.find((o) => Number(o.id) === Number(id));
          const icon = "/OMNISUITE_ICON_CLEAR.png";
          const link = `/sales/sales-orders/${id}?mode=edit`;
          addNotification({
            title: "Sales Order reversed",
            message: `SO ${so?.order_no || id} is now ready to forward for approval`,
            native:
              typeof window !== "undefined" &&
              "Notification" in window &&
              window.Notification?.permission === "granted",
            icon,
            onClick: () => {
              navigate(link);
            },
          });
        } catch {}
      } catch (e2) {
        toast.error(
          e2?.response?.data?.message ||
            e1?.response?.data?.message ||
            "Failed to reverse sales order",
        );
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function checkExceptional() {
      try {
        const me = await api.get("/admin/me");
        const uid = Number(me?.data?.user?.id || me?.data?.user?.sub || 0);
        if (!uid || cancelled) return;
        const resp = await api.get(
          `/admin/users/${uid}/exceptional-permissions`,
        );
        const items = Array.isArray(resp?.data?.data?.items)
          ? resp.data.data.items
          : Array.isArray(resp?.data?.items)
            ? resp.data.items
            : [];
        let allowed = items.some((p) => {
          const effect = String(p.effect || "").toUpperCase();
          const active = Number(p.is_active || p.isActive) === 1;
          const code = String(
            p.permission_code || p.permissionCode || "",
          ).toUpperCase();
          const codeOk = code === "SALES.ORDER.CANCEL";
          return effect === "ALLOW" && active && codeOk;
        });
        const denied = items.some((p) => {
          const effect = String(p.effect || "").toUpperCase();
          const active = Number(p.is_active || p.isActive) === 1;
          const code = String(
            p.permission_code || p.permissionCode || "",
          ).toUpperCase();
          return effect === "DENY" && active && code === "SALES.ORDER.CANCEL";
        });
        if (!cancelled) setExceptionalAllowed(allowed);
        if (!cancelled) setCancelDenied(denied);
      } catch {
        if (!cancelled) setExceptionalAllowed(false);
        if (!cancelled) setCancelDenied(false);
      }
    }
    checkExceptional();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadCompanyAndUser() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        const u = meResp.data?.user || {};
        const uname = String(u.username || "").trim();
        const fname = String(u.full_name || "").trim();
        const name = String(u.name || "").trim();
        const email = String(u.email || "").trim();
        const pb = uname || fname || name || email || "";
        if (mounted) setPreparedBy(pb);
        if (!companyId) return;
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        const logoUrl =
          item.has_logo === 1 || item.has_logo === true
            ? `/api/admin/companies/${companyId}/logo`
            : "";
        if (!mounted) return;
        setCompanyInfo({
          name: String(item.name || ""),
          address: String(item.address || ""),
          city: String(item.city || ""),
          state: String(item.state || ""),
          country: String(item.country || ""),
          postalCode: String(item.postal_code || ""),
          phone: String(item.telephone || ""),
          email: String(item.email || ""),
          website: String(item.website || ""),
          taxId: String(item.tax_id || ""),
          registrationNo: String(item.registration_no || ""),
          logoUrl: String(logoUrl || ""),
        });
      } catch {}
    }
    loadCompanyAndUser();
    return () => {
      mounted = false;
    };
  }, []);

  // Ensure highlighted document is present after redirect
  useEffect(() => {
    const ref = location.state?.highlightRef;
    if (!ref) return;
    let cancelled = false;
    async function ensureVisible() {
      const start = Date.now();
      while (!cancelled && Date.now() - start < 5000) {
        try {
          const res = await api.get("/sales/orders");
          const items = Array.isArray(res.data?.items) ? res.data.items : [];
          setOrders(items);
          const hit = items.find((it) => String(it.order_no) === String(ref));
          if (hit) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    ensureVisible();
    return () => {
      cancelled = true;
    };
  }, [location.state?.highlightRef]);

  useEffect(() => {
    function onWorkflowStatus(e) {
      try {
        const d = e.detail || {};
        const id = Number(d.documentId || d.document_id);
        const status = String(d.status || "").toUpperCase();
        const action = String(d.action || "").toUpperCase();
        if (!id || !status) return;
        const normalized = status === "RETURNED" ? "DRAFT" : status;
        setOrders((prev) =>
          prev.map((x) =>
            Number(x.id) === id
              ? {
                  ...x,
                  status: normalized,
                  ...(normalized === "DRAFT"
                    ? { forwarded_to_username: null }
                    : {}),
                }
              : x,
          ),
        );
      } catch {}
      if (String(status).toUpperCase() === "DRAFT") {
        setForwardedTo((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () =>
      window.removeEventListener("omni.workflow.status", onWorkflowStatus);
  }, []);
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
    <title>Sales Order</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 16px; color: #0f172a; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
      th { background: #f8fafc; text-align: left; }
    </style>
  </head>
  <body>${bodyHtml || ""}</body>
</html>`;
  }
  async function waitForImages(container) {
    const imgs = Array.from(container?.querySelectorAll?.("img") || []);
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
  const buildSalesOrderTemplateDataFromApi = (header, details) => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const items = (Array.isArray(details) ? details : []).map((d, idx) => {
      const qty = Number(d.qty ?? d.quantity ?? 0);
      const unit = Number(d.unit_price ?? 0);
      const disc = Number(d.discount_percent ?? 0);
      const tax = Number(d.tax_amount ?? 0);
      const total = Number(
        d.total_amount ?? qty * unit - (qty * unit * disc) / 100 + tax,
      );
      return {
        sr: String(idx + 1),
        code: String(d.item_code || ""),
        name: String(d.item_name || ""),
        quantity: qty.toFixed(2),
        uom: String(d.uom || d.uom_code || ""),
        price: unit.toFixed(2),
        discount: disc.toFixed(2),
        tax: tax.toFixed(2),
        amount: total.toFixed(2),
      };
    });
    const sub = items.reduce(
      (s, it) => s + Number(it.price) * Number(it.quantity),
      0,
    );
    const discTotal = items.reduce(
      (s, it) =>
        s +
        (Number(it.price) * Number(it.quantity) * Number(it.discount)) / 100,
      0,
    );
    const taxTotal = items.reduce((s, it) => s + Number(it.tax || 0), 0);
    const net = sub - discTotal;
    const totalBase =
      header.net_amount ?? header.total_amount ?? net + taxTotal;
    const total = Number(totalBase ?? 0);
    return {
      company: {
        name: companyInfo.name || "",
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
      sales_order: {
        number: String(header.order_no || ""),
        date: header.order_date ? String(header.order_date).slice(0, 10) : "",
        payment_type: String(header.payment_type || ""),
        price_type: String(header.price_type || ""),
      },
      customer: {
        name: String(header.customer_name || ""),
        address: String(header.address || ""),
        city: String(header.city || ""),
        state: String(header.state || ""),
        country: String(header.country || ""),
        phone: String(header.phone || ""),
        email: String(header.email || ""),
      },
      items,
      totals: {
        sub_total: sub.toFixed(2),
        discount: discTotal.toFixed(2),
        tax_amount: taxTotal.toFixed(2),
        total: Number(total || 0).toFixed(2),
      },
      prepared_by: preparedBy || "",
    };
  };
  function renderSalesOrderHtml(data) {
    const c = data.company || {};
    const s = data.sales_order || {};
    const u = data.customer || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const t = data.totals || {};
    return `
      <style>
        .doc { color: #0f172a; font-size: 12px; }
        .doc-header { display: flex; justify-content: space-between; align-items: center; }
        .doc-title { font-weight: 800; font-size: 18px; color: #296d8f; }
        .company-block { display: flex; gap: 12px; align-items: center; }
        .company-logo { max-height: 80px; object-fit: contain; }
        .company-info div { line-height: 1.4; }
        .meta { text-align: right; font-size: 12px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
        th { background: #f8fafc; text-align: left; }
        .totals { display: flex; justify-content: flex-end; margin-top: 12px; }
        .totals table { width: 360px; }
      </style>
      <div class="doc">
        <div class="doc-header">
          <div class="company-block">
            ${c.logoUrl ? `<img src="${c.logoUrl}" alt="${escapeHtml(c.name || "Company")}" class="company-logo" />` : ""}
            <div class="company-info">
              <div>${escapeHtml(c.name || "")}</div>
              <div>${escapeHtml(c.address || "")}</div>
              <div>${escapeHtml(c.city || "")}${c.city ? "," : ""} ${escapeHtml(c.state || "")} ${escapeHtml(c.country || "")}</div>
              <div>${escapeHtml(c.phone || "")} ${escapeHtml(c.email || "")}</div>
              <div>${escapeHtml(c.website || "")}</div>
              <div>${c.taxId ? `Tax ID: ${escapeHtml(c.taxId)}` : ""}</div>
              <div>${c.registrationNo ? `Reg No: ${escapeHtml(c.registrationNo)}` : ""}</div>
            </div>
          </div>
          <div class="meta">
            <div class="doc-title">Sales Order</div>
            <div>Order No: ${escapeHtml(s.number || "")}</div>
            <div>Order Date: ${escapeHtml(s.date || "")}</div>
          </div>
        </div>
        <div class="grid-2" style="margin-top: 6px;">
          <div>
            <div style="font-weight:700;margin-bottom:4px;">Customer</div>
            <div>${escapeHtml(u.name || "")}</div>
            <div>${escapeHtml(u.address || "")}</div>
            <div>${escapeHtml(u.city || "")}${u.city ? "," : ""} ${escapeHtml(u.state || "")} ${escapeHtml(u.country || "")}</div>
            <div>${escapeHtml(u.phone || "")} ${escapeHtml(u.email || "")}</div>
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:4px;">Payment</div>
            <div>Payment Type: ${escapeHtml(s.payment_type || "")}</div>
            <div>Price Type: ${escapeHtml(s.price_type || "")}</div>
          </div>
        </div>
        <table style="margin-top: 8px;">
          <thead>
            <tr>
              <th>#</th>
              <th>Code</th>
              <th>Description</th>
              <th style="text-align:right;">Qty</th>
              <th>UOM</th>
              <th style="text-align:right;">Unit Price</th>
              <th style="text-align:right;">Disc%</th>
              <th style="text-align:right;">Tax</th>
              <th style="text-align:right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (it) => `
                <tr>
                  <td>${escapeHtml(it.sr || "")}</td>
                  <td>${escapeHtml(it.code || "")}</td>
                  <td>${escapeHtml(it.name || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.quantity || "")}</td>
                  <td>${escapeHtml(it.uom || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.price || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.discount || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.tax || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.amount || "")}</td>
                </tr>
              `,
              )
              .join("")}
          </tbody>
        </table>
        <div class="totals">
          <table>
            <tbody>
              <tr><td>Sub Total</td><td style="text-align:right;">${escapeHtml(t.sub_total || "")}</td></tr>
              <tr><td>Discount</td><td style="text-align:right;">${escapeHtml(t.discount || "")}</td></tr>
              <tr><td>Tax</td><td style="text-align:right;">${escapeHtml(t.tax_amount || "")}</td></tr>
              <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>${escapeHtml(t.total || "")}</strong></td></tr>
            </tbody>
          </table>
        </div>
        <div style="margin-top:10px;font-size:12px;">
          <div>Prepared By: ${escapeHtml(String(data.prepared_by || ""))}</div>
        </div>
      </div>
    `;
  }
  async function printSalesOrder(id) {
    try {
      const resp = await api.post(
        `/documents/sales-order/${id}/render`,
        { format: "html", feature_name: "sales-order" },
        { headers: { "Content-Type": "application/json" } },
      );
      const html =
        typeof resp.data === "string" ? resp.data : String(resp.data || "");
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.top = "0";
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
      const doPrint = () => {
        win.focus();
        try {
          win.print();
        } catch {}
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
      };
      const waitForImages = () => {
        const images = doc.images || [];
        if (images.length === 0) { doPrint(); return; }
        let loaded = 0;
        for (const img of images) {
          if (img.complete && img.naturalWidth > 0) { loaded++; continue; }
          img.onload = () => { loaded++; if (loaded === images.length) doPrint(); };
          img.onerror = () => { loaded++; if (loaded === images.length) doPrint(); };
        }
        if (loaded === images.length) doPrint();
      };
      waitForImages();
    } catch (e) {
      toast.error("Failed to render template for print");
    }
  }
  async function downloadSalesOrderPdf(id) {
    try {
      const resp = await api.post(
        `/documents/sales-order/${id}/render`,
        { format: "html", feature_name: "sales-order" },
        { headers: { "Content-Type": "application/json" } },
      );
      const html =
        typeof resp.data === "string" ? resp.data : String(resp.data || "");
      await renderHtmlToPdf(html, `sales-order-${id}.pdf`);
    } catch (err) {
      console.error("PDF Download Error:", err);
      toast.error(
        err?.response?.data?.message || "Failed to download Sales Order PDF",
      );
    }
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      // lightweight refresh to update forwarded_to_username and statuses
      fetchOrders();
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const fetchOrders = async (page = 1) => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/sales/orders?page=${page}&limit=50`);
      const items = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      if (response.data?.pagination) {
        setPagination(response.data.pagination);
      }
      const fwd = {};
      for (const it of items) {
        const st = String(it.status || "").toUpperCase();
        if (
          it.forwarded_to_username &&
          !["DRAFT", "RETURNED", "REJECTED"].includes(st)
        ) {
          fwd[it.id] = String(it.forwarded_to_username);
        }
      }
      setForwardedTo(fwd);
      setOrders(items);
    } catch (error) {
      setError(error?.response?.data?.message || "Error fetching orders");
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const hydratedIds = useRef(new Set());

  useEffect(() => {
    async function hydrateMissing() {
      try {
        const targets = orders
          .filter(
            (o) =>
              (!o.customer_name || o.customer_name === "" || !o.priority || o.priority === "") &&
              !hydratedIds.current.has(o.id)
          )
          .slice(0, 20);
        if (!targets.length) return;
        targets.forEach(t => hydratedIds.current.add(t.id));
        const updates = await Promise.all(
          targets.map(async (o) => {
            try {
              const res = await api.get(`/sales/orders/${o.id}`);
              const item = res.data?.item || {};
              return {
                id: o.id,
                customer_name:
                  item.customer_name ||
                  item.customer?.name ||
                  o.customer_name ||
                  "",
                priority: item.priority || o.priority || "",
                status:
                  String(item.status || o.status || "").toUpperCase() ||
                  "DRAFT",
              };
            } catch {
              return null;
            }
          }),
        );
        const valid = updates.filter(Boolean);
        if (!valid.length) return;
        setOrders((prev) =>
          prev.map((x) => {
            const u = valid.find((v) => v.id === x.id);
            return u
              ? {
                  ...x,
                  customer_name: u.customer_name,
                  priority: u.priority,
                  status: u.status,
                }
              : x;
          }),
        );
      } catch {}
    }
    hydrateMissing();
  }, [orders]);

  const getStatusBadge = (status) => {
    const statusClasses = {
      DRAFT: "badge badge-warning",
      PENDING_APPROVAL: "badge badge-warning",
      RETURNED: "badge badge-error",
      REJECTED: "badge badge-error",
      APPROVED: "badge badge-info",
      PROCESSING: "badge badge-primary",
      SHIPPED: "badge badge-secondary",
      DELIVERED: "badge badge-success",
      CANCELLED: "badge badge-error",
    };
    const formattedStatus = String(status || "").split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return <span className={statusClasses[status] || "badge"}>{formattedStatus}</span>;
  };

  const filteredBase = useMemo(() => {
    const base =
      statusFilter === "ALL"
        ? orders.slice()
        : orders.filter((order) => order.status === statusFilter);
    if (!searchTerm.trim()) return base;
    return filterAndSort(base, {
      query: searchTerm,
      getKeys: (order) => [order.order_no, order.customer_name],
    });
  }, [orders, statusFilter, searchTerm]);

  const {
    sorted: filteredOrders,
    sortKey,
    sortDir,
    toggle,
  } = useSort(filteredBase, "created_at", "desc");

  const workflowDisabled = hasInactiveWorkflow && !candidateWorkflow;

  const openForwardModal = async (order) => {
    setSelectedOrder(order);
    setShowForwardModal(true);
    setWfError("");
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
  };

  const computeCandidateFromList = async (items) => {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/sales/sales-orders";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = items.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "SALES_ORDER",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "SALES_ORDER",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setHasInactiveWorkflow(!chosen && hasInactive);
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
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
  };

  const computeCandidate = async () => {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/sales/sales-orders";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = workflowsCache.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "SALES_ORDER",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "SALES_ORDER",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setHasInactiveWorkflow(!chosen && hasInactive);
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
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
  };

  async function forwardDocument() {
    if (!selectedOrder) return;
    setSubmittingForward(true);
    setWfError("");
    try {
      // Optimistically update UI to "Forwarded to {username}" immediately
      let optimisticApprover = null;
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
          optimisticApprover = hit ? hit.name : null;
        }
      } catch {}
      setOrders((prev) =>
        prev.map((x) =>
          x.id === selectedOrder.id
            ? {
                ...x,
                status: "PENDING_APPROVAL",
                forwarded_to_username:
                  optimisticApprover || x.forwarded_to_username || "Approver",
              }
            : x,
        ),
      );
      setForwardedTo((prev) => ({
        ...prev,
        [selectedOrder.id]:
          optimisticApprover || prev[selectedOrder.id] || "Approver",
      }));
      setShowForwardModal(false);

      const amount =
        selectedOrder.total_amount === undefined ||
        selectedOrder.total_amount === null
          ? null
          : Number(selectedOrder.total_amount || 0);
      const res = await api.post(`/sales/orders/${selectedOrder.id}/submit`, {
        amount,
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
      });
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      setOrders((prev) =>
        prev.map((x) =>
          x.id === selectedOrder.id ? { ...x, status: newStatus } : x,
        ),
      );
      try {
        toast.success("Sales order forwarded for approval");
      } catch {}
      try {
        await fetchOrders();
      } catch {}
    } catch (e) {
      console.error("Sales Order Submit Failed:", e?.response?.data || e.message, e);
      try {
        const amount =
          selectedOrder.total_amount === undefined ||
          selectedOrder.total_amount === null
            ? null
            : Number(selectedOrder.total_amount || 0);
        const wfRes = await api.post("/workflows/forward-by-document", {
          document_type: "SALES_ORDER",
          document_id: selectedOrder.id,
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
          amount,
        });
        const newStatus = wfRes?.data?.status || "PENDING_APPROVAL";
        setOrders((prev) =>
          prev.map((x) =>
            x.id === selectedOrder.id ? { ...x, status: newStatus } : x,
          ),
        );
        try {
          toast.success("Sales order forwarded for approval");
        } catch {}
      } catch (e2) {
        try {
          await api.put(`/sales/orders/${selectedOrder.id}/status`, {
            status: "PENDING_APPROVAL",
          });
          setOrders((prev) =>
            prev.map((x) =>
              x.id === selectedOrder.id
                ? { ...x, status: "PENDING_APPROVAL" }
                : x,
            ),
          );
          try {
            toast.success("Sales order forwarded for approval");
          } catch {}
        } catch (e3) {
          setWfError(
            e?.response?.data?.message ||
              e2?.response?.data?.message ||
              e3?.response?.data?.message ||
              "Failed to forward for approval",
          );
        }
      }
      try {
        await fetchOrders();
      } catch {}
    } finally {
      setSubmittingForward(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading orders...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Sales Orders
              </h1>
              <p className="text-sm mt-1">
                Manage customer orders and track fulfillment
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/sales?section=Sales%20Transactions" className="btn btn-secondary">
                Return to Menu
              </Link>
              {canCreateOnPage() && (
                <Link to="/sales/sales-orders/new" className="btn-success">
                  + New Sales Order
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by order number or customer..."
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading sales orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">
                No sales orders found.
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
              </div>
              <div className="overflow-x-auto">
                <table className={"table " + (viewMode === "grid" ? "table-grid-mode" : "")}>
                <thead>
                  <tr>
                    <SortableHeader
                      label="Order No"
                      sortKey="order_no"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                    <SortableHeader
                      label="Order Date"
                      sortKey="order_date"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                    <SortableHeader
                      label="Customer"
                      sortKey="customer_name"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                    <SortableHeader
                      label="Status"
                      sortKey="status"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                    <SortableHeader
                      label="Amount"
                      sortKey="total_amount"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                    <th className="text-right">Actions</th>
                    <SortableHeader
                      label="Created By"
                      sortKey="created_by_name"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                    <SortableHeader
                      label="Created Date"
                      sortKey="created_at"
                      currentKey={sortKey}
                      direction={sortDir}
                      onToggle={toggle}
                    />
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const upperStatus = String(order.status || "").toUpperCase();
                    const autoApproved =
                      workflowDisabled &&
                      upperStatus !== "CANCELLED" &&
                      upperStatus !== "REVERSED";
                    const displayStatus = autoApproved
                      ? "APPROVED"
                      : upperStatus || "DRAFT";
                    return (
                    <tr key={order.id}>
                      <td className="font-medium">{order.order_no}</td>
                      <td>{new Date(order.order_date).toLocaleDateString()}</td>
                      <td>{order.customer_name}</td>
                      <td>
                        {getStatusBadge(
                          displayStatus,
                        )}
                      </td>
                      <td className="font-semibold">
                        {order.total_amount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Slot 1: View */}
                          <div className="min-w-[80px]">
                            <button
                              type="button"
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                              onClick={() =>
                                navigate(
                                  `/sales/sales-orders/${order.id}?mode=view`,
                                )
                              }
                            >
                              View
                            </button>
                          </div>

                          {/* Slot 2: Edit */}
                          <div className="min-w-[80px]">
                            {!["APPROVED", "POSTED"].includes(displayStatus) &&
                            canPerformAction("sales:sales-orders", "edit") ? (
                              <button
                                type="button"
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                                onClick={() =>
                                  navigate(
                                    `/sales/sales-orders/${order.id}?mode=edit`,
                                  )
                                }
                              >
                                Edit
                              </button>
                            ) : (
                              <div className="w-full h-9" />
                            )}
                          </div>

                          {/* Slot 3: Print */}
                          <div className="min-w-[80px]">
                            <ListPrintIconButton
                              onClick={() => printSalesOrder(order.id)}
                            />
                          </div>

                          {/* Slot 4: PDF */}
                          <div className="min-w-[80px]">
                            <ListPdfIconButton
                              onClick={() => downloadSalesOrderPdf(order.id)}
                            />
                          </div>

                          {/* Slot 5: Workflow */}
                          <div className="min-w-[160px]">
                            <div className="list-approval-slot">
                                {displayStatus === "APPROVED" ? (
                                  <div className="flex items-center gap-2">
                                    <span className="list-approval-approved-pill">
                                      Approved
                                    </span>
                                    {!autoApproved && canReverseApproval() && (
                                      <button
                                        type="button"
                                        onClick={() => openReverseModal(order)}
                                        className="list-approval-reverse-btn"
                                      >
                                        Reverse Approval
                                      </button>
                                    )}
                                  </div>
                                ) : displayStatus === "PENDING_APPROVAL" ? (
                                  <span className="list-approval-forwarded-pill">
                                    Forwarded to{" "}
                                    {order.forwarded_to_username ||
                                      forwardedTo[order.id] ||
                                      "Approver"}
                                  </span>
                                ) : displayStatus === "SUBMITTED" ? (
                                  <span className="list-approval-forwarded-pill">
                                    Submitted
                                  </span>
                                ) : displayStatus !== "CANCELLED" &&
                                  displayStatus !== "REVERSED" &&
                                  displayStatus !== "REJECTED" ? (
                                  <button
                                    type="button"
                                    onClick={() => openForwardModal(order)}
                                    className="list-approval-forward-btn"
                                    disabled={submittingForward}
                                  >
                                    Forward for Approval
                                  </button>
                                ) : null}
                            </div>
                          </div>

                          {/* Slot 6: Attachments */}
                          <div className="min-w-[80px]">
                            <ListAttachmentIconButton
                              onClick={() => {
                                setActiveDocId(order.id);
                                setShowAttach(true);
                              }}
                            />
                          </div>

                          {/* Slot 8: exceptional cancel — fixed cell */}
                          <div className="min-w-[80px]">
                            {!order.has_invoice &&
                            hasExceptional("SALES.ORDER.CANCEL") ? (
                              <button
                                type="button"
                                className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-white bg-[#990000] rounded-lg hover:bg-[#770000] transition-colors h-9"
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      `Cancel this Sales Order (${order.order_no})?`,
                                    )
                                  )
                                    return;
                                  try {
                                    await api.delete(
                                      `/sales/orders/${order.id}`,
                                    );
                                    toast.success("Sales order cancelled");
                                    setOrders((prev) =>
                                      prev.filter((x) => x.id !== order.id),
                                    );
                                  } catch (e) {
                                    toast.error("Unable to cancel");
                                  }
                                }}
                              >
                                Cancel
                              </button>
                            ) : (
                              <div className="w-full h-9" aria-hidden />
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="grid-created-by-cell">
                        {order.created_by_username ||
                          order.created_by_name ||
                          "-"}
                      </td>
                      <td className="grid-created-date-cell">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
                <div className="text-sm text-slate-500">
                  Showing <span className="font-medium">{(pagination.page - 1) * pagination.pageSize + 1}</span> to <span className="font-medium">{Math.min(pagination.page * pagination.pageSize, pagination.total)}</span> of <span className="font-medium">{pagination.total}</span> results
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => fetchOrders(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchOrders(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
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
                  setSelectedOrder(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Document No:{" "}
                <span className="font-semibold">
                  {selectedOrder?.order_no || "-"}
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
              </div>
              <div>
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
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedOrder(null);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setTargetApproverId(null);
                  setWorkflowSteps([]);
                  setWfError("");
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
                  !selectedOrder ||
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
      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setActiveDocId(null);
        }}
        docType="sales-order"
        docId={activeDocId}
      />
    </div>
  );
}
