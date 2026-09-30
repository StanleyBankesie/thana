/**
 * @fileoverview BillingList component.
 * Provides functionality for BillingList.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import { renderHtmlToPdf } from "@/utils/pdfUtils.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import ReverseApprovalButton from "../../../../components/ReverseApprovalButton.jsx";
import useSort from "../../../../hooks/useSort.js";
import SortableHeader from "../../../../components/SortableHeader.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function BillingList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const { canPerformAction, exceptionalPerms, canReverseApproval, hasExceptional } = usePermission();
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [firstApprover, setFirstApprover] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [wfError, setWfError] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const [wfLoading, setWfLoading] = useState(false);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [billing, setBillings] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [submittingId, setSubmittingId] = useState(null);
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

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async (page = 1) => {
    try {
      setLoading(true);
      setError("");
      
      const requests = [api.get(`/transport/billing?page=${page}&limit=50`)];
      if (currencies.length === 0) requests.push(api.get("/finance/currencies"));
      if (warehouses.length === 0) requests.push(api.get("/inventory/warehouses"));
      
      const [invRes, curRes, whRes] = await Promise.all(requests);
      
      const billingsData = invRes.data?.data?.items || invRes.data?.items || [];
      setBillings(Array.isArray(billingsData) ? billingsData : []);
      const pageData = invRes.data?.data?.pagination || invRes.data?.pagination;
      if (pageData) {
        setPagination(pageData);
      }
      
      if (curRes) setCurrencies(Array.isArray(curRes.data?.items) ? curRes.data.items : []);
      if (whRes) setWarehouses(Array.isArray(whRes.data?.items) ? whRes.data.items : []);
    } catch (error) {
      setError(error?.response?.data?.message || "Error fetching billing");
      console.error("Error fetching billing:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function fetchCompanyInfo() {
      try {
        const meResp = await api.get("/admin/me");
        const companyId = meResp.data?.scope?.companyId;
        if (!companyId) {
          if (!mounted) return;
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
          postalCode: item.postal_code || prev.postalCode || "",
          phone: item.telephone || prev.phone || "",
          email: item.email || prev.email || "",
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
    <title>Billing</title>
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
  const buildBillingTemplateDataFromApi = (header, details) => {
    const items = (Array.isArray(details) ? details : []).map((d) => {
      const qty = Number(d.quantity || d.qty || 0);
      const unit = Number(d.unit_price || 0);
      const disc = Number(d.discount_percent || 0);
      const total = Number(d.total_amount || qty * unit);
      const net = Number(d.net_amount || total - (qty * unit * disc) / 100);
      return {
        item_name: String(d.item_name || ""),
        qty: qty.toFixed(2),
        unit_price: unit.toFixed(2),
        total: total.toFixed(2),
        discount: Number(disc || 0).toFixed(2),
        net: net.toFixed(2),
      };
    });
    const currencyCode =
      currencies.find((c) => String(c.id) === String(header.currency_id))
        ?.code || "";
    return {
      company: {
        name: companyInfo.name || "Company",
        address: companyInfo.address || "",
        city: companyInfo.city || "",
        state: companyInfo.state || "",
        postalCode: companyInfo.postalCode || "",
        country: companyInfo.country || "",
        phone: companyInfo.phone || "",
        email: companyInfo.email || "",
        website: companyInfo.website || "",
        taxId: companyInfo.taxId || "",
        registrationNo: companyInfo.registrationNo || "",
        logoUrl: String(companyInfo.logoUrl || ""),
      },
      invoice: {
        invoice_no: String(header.invoice_no || ""),
        invoice_date: header.invoice_date
          ? String(header.invoice_date).slice(0, 10)
          : "",
        due_date: String(header.due_date || ""),
        payment_type: String(header.payment_type || ""),
        price_type: String(header.price_type || ""),
        currency: String(currencyCode || ""),
        prepared_by: "",
      },
      customer: {
        id: String(header.customer_id || ""),
        code: "",
        name: String(header.customer_name || ""),
        type: "",
        contactPerson: "",
        email: "",
        phone: String(header.phone || ""),
        mobile: "",
        address: String(header.address || ""),
        city: String(header.city || ""),
        state: String(header.state || ""),
        zone: "",
        country: String(header.country || ""),
        paymentTerms: "",
        creditLimit: "0.00",
      },
      items,
      totals: {
        subtotal: Number(
          items.reduce((s, it) => s + Number(it.total || 0), 0),
        ).toFixed(2),
        discount: Number(
          items.reduce((s, it) => s + Number(it.discount || 0), 0),
        ).toFixed(2),
        netSubtotal: Number(
          items.reduce((s, it) => s + Number(it.net || 0), 0),
        ).toFixed(2),
        tax: "0.00",
        total: Number(header.net_amount || header.total_amount || 0).toFixed(2),
      },
    };
  };
  function renderBillingHtml(data) {
    const company = data.company || {};
    const inv = data.invoice || {};
    const cust = data.customer || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const totals = data.totals || {};
    return `
      <style>
        .doc { color: #0f172a; font-size: 12px; }
        .doc-header { display: flex; justify-content: space-between; align-items: center; }
        .doc-title { font-weight: 800; font-size: 18px; color: #296d8f; }
        .company-block { display: flex; gap: 12px; align-items: center; }
        .company-logo { max-height: 80px; object-fit: contain; }
        .company-info div { line-height: 1.4; }
        .meta { text-align: right; font-size: 12px; }
        .section-title { font-weight: 700; margin-top: 8px; margin-bottom: 4px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
        th { background: #f8fafc; text-align: left; }
        .totals { display: flex; justify-content: flex-end; margin-top: 12px; }
        .totals table { width: 320px; }
      </style>
      <div class="doc">
        <div class="doc-header">
          <div class="company-block">
            ${company.logoUrl ? `<img src="${company.logoUrl}" alt="${escapeHtml(company.name || "Company")}" class="company-logo" />` : ""}
            <div class="company-info">
              <div>${escapeHtml(company.name || "")}</div>
              <div>${escapeHtml(company.address || "")}</div>
              <div>${escapeHtml(company.city || "")}${company.city ? "," : ""} ${escapeHtml(company.state || "")} ${escapeHtml(company.country || "")}</div>
              <div>${escapeHtml(company.phone || "")} ${escapeHtml(company.email || "")}</div>
              <div>${escapeHtml(company.website || "")}</div>
              <div>${company.taxId ? `Tax ID: ${escapeHtml(company.taxId)}` : ""}</div>
              <div>${company.registrationNo ? `Reg No: ${escapeHtml(company.registrationNo)}` : ""}</div>
            </div>
          </div>
          <div class="meta">
            <div class="doc-title">Billing</div>
            <div>Billing No: ${escapeHtml(inv.invoice_no || "")}</div>
            <div>Billing Date: ${escapeHtml(inv.invoice_date || "")}</div>
            <div>Due Date: ${escapeHtml(inv.due_date || "")}</div>
            <div>Status: ${escapeHtml(String(inv.status || ""))}</div>
          </div>
        </div>

        <div class="grid-2" style="margin-top: 6px;">
          <div>
            <div class="section-title">Customer</div>
            <div>${escapeHtml(cust.name || "")}</div>
            <div>${escapeHtml(cust.address || "")}</div>
            <div>${escapeHtml(cust.city || "")}${cust.city ? "," : ""} ${escapeHtml(cust.state || "")} ${escapeHtml(cust.country || "")}</div>
            <div>${escapeHtml(cust.phone || "")} ${escapeHtml(cust.email || "")}</div>
          </div>
          <div>
            <div class="section-title">Payment</div>
            <div>Currency: ${escapeHtml(inv.currency || "")}</div>
            <div>Payment Type: ${escapeHtml(inv.payment_type || "")}</div>
            <div>Price Type: ${escapeHtml(inv.price_type || "")}</div>
          </div>
        </div>

        <table style="margin-top: 8px;">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:right;">Qty</th>
              <th style="text-align:right;">Unit Price</th>
              <th style="text-align:right;">Discount</th>
              <th style="text-align:right;">Net</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (it) => `
                <tr>
                  <td>${escapeHtml(it.item_name || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.qty || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.unit_price || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.discount || "")}</td>
                  <td style="text-align:right;">${escapeHtml(it.net || "")}</td>
                </tr>
              `,
              )
              .join("")}
          </tbody>
        </table>

        <div class="totals">
          <table>
            <tbody>
              <tr><td>Subtotal</td><td style="text-align:right;">${escapeHtml(totals.subtotal || "")}</td></tr>
              <tr><td>Discount</td><td style="text-align:right;">${escapeHtml(totals.discount || "")}</td></tr>
              <tr><td>Net Subtotal</td><td style="text-align:right;">${escapeHtml(totals.netSubtotal || "")}</td></tr>
              <tr><td>Tax</td><td style="text-align:right;">${escapeHtml(totals.tax || "")}</td></tr>
              <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>${escapeHtml(totals.total || "")}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  async function printBilling(id) {
    try {
      const resp = await api.post(
        `/documents/invoice/${id}/render`,
        { format: "html", feature_name: "transport-billing" },
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
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to print invoice");
    }
  }
  async function downloadBillingPdf(id) {
    try {
      const resp = await api.post(
        `/documents/invoice/${id}/render`,
        { format: "html", feature_name: "transport-billing" },
        { headers: { "Content-Type": "application/json" } },
      );
      const html =
        typeof resp.data === "string" ? resp.data : String(resp.data || "");
      await renderHtmlToPdf(html, `invoice-${id}.pdf`);
    } catch (err) {
      console.error("PDF Download Error:", err);
      toast.error(
        err?.response?.data?.message || "Failed to download Billing PDF",
      );
    }
  }
  const getStatusBadge = (status) => {
    const statusClasses = {
      DRAFT: "badge badge-warning",
      PENDING_APPROVAL: "badge badge-info bg-blue-100 text-blue-800",
      POSTED: "badge badge-success",
      CANCELLED: "badge badge-error",
    };
    return <span className={statusClasses[status] || "badge"}>{status}</span>;
  };

  const getPaymentStatusBadge = (pstatus) => {
    const classes = {
      UNPAID: "badge badge-error",
      PARTIALLY_PAID: "badge badge-warning",
      PAID: "badge badge-success",
    };
    const label = String(pstatus || "").trim() || "UNPAID";
    return <span className={classes[label] || "badge"}>{label}</span>;
  };

  const openForwardModal = async (doc) => {
    setSelectedDoc(doc);
    setWfError("");
                    setForwardComments("");
    setShowForwardModal(true);
    try {
      const res = await api.get("/workflows");
      const wfs = Array.isArray(res.data?.items) ? res.data.items : [];
      const active = wfs.find((w) => Number(w.is_active) === 1 && (String(w.document_type).toUpperCase() === "TRANSPORT_BILLING" || String(w.document_type).toUpperCase() === "TRANSPORT BILLING" || String(w.document_route) === "/transport/billing"));
      setCandidateWorkflow(active || null);
      if (active) {
        setWfLoading(true);
        const wfRes = await api.get(`/workflows/${active.id}`);
        const steps = Array.isArray(wfRes.data?.item?.steps) ? wfRes.data.item.steps : [];
        setWorkflowSteps(steps);
        if (steps.length > 0) {
           const first = steps[0];
           const defaultTarget = (Array.isArray(first.approvers) && first.approvers.length ? first.approvers[0].id : first.approver_user_id) || null;
           setTargetApproverId(defaultTarget);
        } else {
           setTargetApproverId(null);
        }
        setWfLoading(false);
      } else {
        setWorkflowSteps([]);
        setTargetApproverId(null);
      }
    } catch {
      setCandidateWorkflow(null);
      setWorkflowSteps([]);
      setTargetApproverId(null);
      setWfLoading(false);
    }
  };

  async function handleForwardSubmit() {
    if (!selectedDoc) return;
    setSubmittingForward(true);
    setWfError("");
                    setForwardComments("");
    try {
      let optimisticApprover = null;
      try {
        const first = Array.isArray(workflowSteps) && workflowSteps.length ? workflowSteps[0] : null;
        const opts = first ? (Array.isArray(first.approvers) && first.approvers.length ? first.approvers.map((u) => ({ id: u.id, name: u.username })) : first.approver_user_id ? [{ id: first.approver_user_id, name: first.approver_name || String(first.approver_user_id) }] : []) : [];
        if (targetApproverId && opts.length) {
          const hit = opts.find((u) => Number(u.id) === Number(targetApproverId));
          optimisticApprover = hit ? hit.name : null;
        }
      } catch {}
      const submitRes = await api.post(`/transport/billing/${selectedDoc.id}/submit`, {
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_approver_id: targetApproverId || null,
        comments: forwardComments,
        });
      const newStatus = submitRes?.data?.status || "PENDING_APPROVAL";
      if (newStatus === "POSTED") {
        toast.success("Billing automatically approved and posted");
      } else {
        toast.success("Billing forwarded for approval");
      }
      setBillings((prev) =>
        prev.map((x) =>
          x.id === selectedDoc.id ? { ...x, forwarded_to_username: newStatus === "POSTED" ? null : (optimisticApprover || x.forwarded_to_username || "Approver"), status: newStatus } : x,
        ),
      );
      setShowForwardModal(false);
      setSelectedDoc(null);
      setCandidateWorkflow(null);
      setTargetApproverId(null);
      setWorkflowSteps([]);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to forward for approval");
      setWfError(e?.response?.data?.message || "Failed to forward for approval");
    } finally {
      setSubmittingForward(false);
    }
  }

  const filteredBase = useMemo(() => {
    const base =
      statusFilter === "ALL"
        ? billing.slice()
        : billing.filter((inv) => inv.status === statusFilter);
    if (!searchTerm.trim()) return base;
    return filterAndSort(base, {
      keys: ["invoice_no", "customer_name", "status", "created_by_name"],
      query: searchTerm,
    });
  }, [billing, statusFilter, searchTerm]);

  const { sorted: filteredBillings, sortKey, sortDir, toggle } = useSort(filteredBase, "created_at", "desc");

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Sales Billings
              </h1>
              <p className="text-sm mt-1">
                Generate and manage customer billing
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/transport" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/transport/billing/new" className="btn-success">
                + New Billing
              </Link>
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
                placeholder="Search by invoice number or customer..."
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
                <option value="POSTED">Posted</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading billing...</p>
            </div>
          ) : filteredBillings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">
                No billing found.
              </p>
            </div>
          ) : (
            <>
              
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
                <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
                <thead>
                  <tr>
                    <SortableHeader label="Billing No" sortKey="invoice_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Date" sortKey="invoice_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <th>Payment</th>
                    <SortableHeader label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Net Amount" sortKey="net_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <th className="text-right">Actions</th>
                    <SortableHeader label="Created By" sortKey="created_by_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <th>Payment Type</th>
                    <th>Price Type</th>
                    <SortableHeader label="Warehouse" sortKey="warehouse_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Balance" sortKey="balance_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                    <SortableHeader label="Remarks" sortKey="remarks" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  </tr>
                </thead>
                <tbody>
                  {filteredBillings.map((inv) => (
                    <tr key={inv.id}>
                      <td className="font-medium">{inv.invoice_no}</td>
                      <td>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                      <td>{inv.customer_name}</td>
                      <td>{getPaymentStatusBadge(inv.payment_status)}</td>
                      <td>{getStatusBadge(inv.status)}</td>
                      <td className="font-semibold">
                        {inv.net_amount.toLocaleString("en-US", {
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
                            onClick={() => navigate(`/transport/billing/${inv.id}?mode=view`)}
                          >
                            View
                          </button>
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="min-w-[80px]">
                          {inv.status === "DRAFT" || inv.status === "PENDING_APPROVAL" ? (
                            <button
                              type="button"
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors h-9"
                              onClick={() =>
                                navigate(`/transport/billing/${inv.id}?mode=edit`)
                              }
                            >
                              Edit
                            </button>
                          ) : (
                            <div className="w-full h-9" />
                          )}
                        </div>

                        {/* Slot 2.5: workflow (forward / approved / reverse) */}
                        <div className="min-w-[160px]">
                          <div className="list-approval-slot">
                            {String(inv.status || "").toUpperCase() === "APPROVED" || String(inv.status || "").toUpperCase() === "POSTED" ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">Approved</span>
                                {canReverseApproval() && (
                                  <ReverseApprovalButton
                                    docType="INVOICE"
                                    docId={inv.id}
                                    className="list-approval-reverse-btn"
                                    onDone={() =>
                                      setBillings((prev) =>
                                        prev.map((x) =>
                                          x.id === inv.id ? { ...x, status: "RETURNED", forwarded_to_username: null } : x,
                                        ),
                                      )
                                    }
                                  >
                                    Reverse Approval
                                  </ReverseApprovalButton>
                                )}
                              </div>
                            ) : inv.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(inv.status || "").toUpperCase()) ? (
                              <span className="list-approval-forwarded-pill">
                                Forwarded to {inv.forwarded_to_username}
                              </span>
                            ) : ["DRAFT", "RETURNED", "PENDING_APPROVAL"].includes(String(inv.status || "").toUpperCase()) ? (
                              <button
                                type="button"
                                className="list-approval-forward-btn"
                                onClick={() => openForwardModal(inv)}
                              >
                                Forward for Approval
                              </button>
                            ) : (
                              <div className="w-full h-9" />
                            )}
                          </div>
                        </div>

                        {/* Slot 3: Print */}
                        <div className="min-w-[80px]">
                          <ListPrintIconButton onClick={() => printBilling(inv.id)} />
                        </div>

                        {/* Slot 4: PDF */}
                        <div className="min-w-[80px]">
                          <ListPdfIconButton onClick={() => downloadBillingPdf(inv.id)} />
                        </div>

                        {/* Slot 5: Attachments */}
                        <div className="w-9">
                          <ListAttachmentIconButton
                            onClick={() => {
                              setActiveDocId(inv.id);
                              setShowAttach(true);
                            }}
                          />
                        </div>

                        {/* Slot 7: Cancel */}
                        <div className="min-w-[80px]">
                          {exceptionalPerms?.has?.("TRANSPORT.BILLING.CANCEL") ? (
                            <button
                              type="button"
                              className="list-approval-reverse-btn"
                              onClick={async () => {
                                if (!window.confirm("Cancel this invoice?")) return;
                                try {
                                  await api.post(`/transport/billing/${inv.id}/reverse-accounting`);
                                  toast.success("Billing cancelled");
                                  setBillings((prev) => prev.filter((x) => Number(x.id) !== Number(inv.id)));
                                } catch (e) {
                                  toast.error("Failed to cancel");
                                }
                              }}
                            >
                              Cancel
                            </button>
                          ) : (
                            <div className="w-full h-9" />
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{inv.created_by_name || "-"}</td>
                    <td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "-"}</td>
                      <td>{inv.payment_type || ""}</td>
                      <td>{inv.price_type || ""}</td>
                      <td>{warehouses.find((w) => String(w.id) === String(inv.warehouse_id))?.warehouse_name || ""}</td>
                      <td className="text-right">
                        {Number(inv.balance_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td>{inv.remarks || ""}</td>
                    </tr>
                  ))}
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
                    onClick={() => fetchAll(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchAll(pagination.page + 1)}
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
      <DocumentAttachmentsModal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setActiveDocId(null);
        }}
        docType="invoice"
        docId={activeDocId}
      />
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedDoc(null);
                  setCandidateWorkflow(null);
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
                  Billing No:{" "}
                  <span className="font-semibold">
                    {selectedDoc?.invoice_no || `#${selectedDoc?.id}`}
                  </span>
                </div>
                <div className="text-sm text-slate-700">
                  Workflow:{" "}
                  <span className="font-semibold">
                    {candidateWorkflow
                      ? `${candidateWorkflow.workflow_name || candidateWorkflow.name} (${candidateWorkflow.workflow_code || ""})`
                      : "None (inactive)"}
                  </span>
                </div>
                <div>
                  {wfLoading ? (
                    <div className="text-sm text-slate-500">Loading workflow...</div>
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
                    const hasSteps = Array.isArray(workflowSteps) && workflowSteps.length > 0;
                    const first = hasSteps ? workflowSteps[0] : null;
                    const opts = first
                      ? Array.isArray(first.approvers) && first.approvers.length
                        ? first.approvers.map((u) => ({ id: u.id, name: u.username }))
                        : first.approver_user_id
                          ? [{ id: first.approver_user_id, name: first.approver_name || String(first.approver_user_id) }]
                          : []
                      : [];

                    if (!hasSteps) {
                      return <div className="text-slate-500">None required</div>;
                    }
                    if (opts.length === 0) {
                      return <div className="text-slate-500">No approvers</div>;
                    }
                    if (opts.length === 1) {
                      return <div className="text-slate-700 font-semibold">{opts[0].name}</div>;
                    }
                    return (
                      <select
                        className="input mt-1"
                        value={targetApproverId || ""}
                        onChange={(e) => setTargetApproverId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">-- Select Approver --</option>
                        {opts.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    );
                  })()}
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
              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                    onClick={() => {
                      setShowForwardModal(false);
                      setSelectedDoc(null);
                      setCandidateWorkflow(null);
                      setWorkflowSteps([]);
                      setWfError("");
                    setForwardComments("");
                    }}
                    disabled={submittingForward}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-white bg-brand rounded hover:bg-brand/90 flex items-center justify-center disabled:opacity-50"
                    onClick={handleForwardSubmit}
                    disabled={submittingForward || wfLoading}
                  >
                    {submittingForward ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}
