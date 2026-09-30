/**
 * @fileoverview ProjectQuotationList component.
 * Provides functionality for ProjectQuotationList.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import { renderHtmlToPdf } from "@/utils/pdfUtils.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterAndSort } from "@/utils/searchUtils.js";
import DocumentAttachmentsModal from "@/components/attachments/DocumentAttachmentsModal.jsx";
import useSort from "@/hooks/useSort.js";
import SortableHeader from "@/components/SortableHeader.jsx";
import {
  ListPrintIconButton,
  ListPdfIconButton,
  ListAttachmentIconButton,
} from "@/components/list/ListDocActionIconButtons.jsx";
import { X } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProjectQuotationList() {
  const [viewMode, setViewMode] = useViewMode();
  const navigate = useNavigate();
  const { canPerformAction, exceptionalPerms } = usePermission();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [canCancelQuotation, setCanCancelQuotation] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  // Workflow states
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [selectedQuot, setSelectedQuot] = useState(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [hasInactiveWorkflow, setHasInactiveWorkflow] = useState(false);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);
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
    fetchQuotations();
    loadWorkflows();
  }, []);

  useEffect(() => {
    setCanCancelQuotation(!!exceptionalPerms?.has?.("PM.QUOTATION.CANCEL"));
  }, [exceptionalPerms]);

  // Load workflows on mount to determine if Forward button should show
  const loadWorkflows = async () => {
    try {
      const res = await api.get("/workflows");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setWorkflowsCache(items);
      // Compute if there's an active workflow for quotations
      const route = "/projects/project-quotations";
      const normalize = (s) =>
        String(s || "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "_");
      const chosen =
        items.find(
          (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
        ) ||
        items.find(
          (w) =>
            Number(w.is_active) === 1 &&
            normalize(w.document_type) === "QUOTATION",
        ) ||
        null;
      setCandidateWorkflow(chosen);
      setHasInactiveWorkflow(
        !chosen && items.some((w) => normalize(w.document_type) === "QUOTATION" && Number(w.is_active) === 0),
      );
    } catch {
      setCandidateWorkflow(null);
    }
  };

  // Workflow status listener
  useEffect(() => {
    function onWorkflowStatus(e) {
      try {
        const d = e.detail || {};
        const id = Number(d.documentId || d.document_id);
        const status = d.status;
        if (!id || !status) return;
        setQuotations((prev) =>
          prev.map((r) =>
            Number(r.id) === id
              ? {
                  ...r,
                  status,
                  ...(status === "DRAFT"
                    ? { forwarded_to_username: null }
                    : {}),
                }
              : r,
          ),
        );
      } catch {}
    }
    window.addEventListener("omni.workflow.status", onWorkflowStatus);
    return () =>
      window.removeEventListener("omni.workflow.status", onWorkflowStatus);
  }, []);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/projects/project-quotations");
      const items =
        (response.data && response.data.data && response.data.data.items) ||
        response.data?.items ||
        [];
      setQuotations(Array.isArray(items) ? items : []);
    } catch (error) {
      setError(error?.response?.data?.message || "Error fetching quotations");
      console.error("Error fetching quotations:", error);
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
        if (!companyId) return;
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        const logoUrl =
          item.has_logo === 1 || item.has_logo === true
            ? `/api/admin/companies/${companyId}/logo`
            : "";
        if (!mounted) return;
        setCompanyInfo({
          name: item.name || "Company",
          address: item.address || "",
          city: item.city || "",
          state: item.state || "",
          country: item.country || "",
          postalCode: item.postal_code || "",
          phone: item.telephone || "",
          email: item.email || "",
          website: item.website || "",
          taxId: item.tax_id || "",
          registrationNo: item.registration_no || "",
          logoUrl: String(logoUrl || ""),
        });
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
    <title>Quotation</title>
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
  const buildQuotationTemplateDataFromApi = (header, details) => {
    const logoUrl = String(companyInfo.logoUrl || "").trim();
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || "Company")}" style="max-height:80px;object-fit:contain;" />`
      : "";
    const items = (Array.isArray(details) ? details : []).map((d) => {
      const qty = Number(d.qty ?? d.quantity ?? 0);
      const unit = Number(d.unit_price ?? 0);
      const disc = Number(d.discount_percent ?? 0);
      const net = Number(
        d.net_amount ?? qty * unit - (qty * unit * disc) / 100,
      );
      return {
        item_name: String(d.item_name || ""),
        qty: qty.toFixed(2),
        unit_price: unit.toFixed(2),
        discount: disc.toFixed(2),
        net: net.toFixed(2),
      };
    });
    const subtotal = items.reduce(
      (s, it) => s + Number(it.qty) * Number(it.unit_price),
      0,
    );
    const discount = items.reduce(
      (s, it) =>
        s +
        (Number(it.qty) * Number(it.unit_price) * Number(it.discount)) / 100,
      0,
    );
    const netSubtotal = subtotal - discount;
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
      quotation: {
        quotation_no: String(header.quotation_no || ""),
        quotation_date: header.quotation_date
          ? String(header.quotation_date).slice(0, 10)
          : "",
        valid_until: header.valid_until
          ? String(header.valid_until).slice(0, 10)
          : "",
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
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        netSubtotal: netSubtotal.toFixed(2),
        total: Number(
          header.net_amount ?? header.total_amount ?? netSubtotal,
        ).toFixed(2),
      },
    };
  };
  function renderQuotationHtml(data) {
    const c = data.company || {};
    const q = data.quotation || {};
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
            <div class="doc-title">Quotation</div>
            <div>Quotation No: ${escapeHtml(q.quotation_no || "")}</div>
            <div>Date: ${escapeHtml(q.quotation_date || "")}</div>
            <div>Valid Until: ${escapeHtml(q.valid_until || "")}</div>
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
            <div>Payment Type: ${escapeHtml(q.payment_type || "")}</div>
            <div>Price Type: ${escapeHtml(q.price_type || "")}</div>
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
              <tr><td>Subtotal</td><td style="text-align:right;">${escapeHtml(t.subtotal || "")}</td></tr>
              <tr><td>Discount</td><td style="text-align:right;">${escapeHtml(t.discount || "")}</td></tr>
              <tr><td>Net Subtotal</td><td style="text-align:right;">${escapeHtml(t.netSubtotal || "")}</td></tr>
              <tr><td><strong>Total</strong></td><td style="text-align:right;"><strong>${escapeHtml(t.total || "")}</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
  async function printQuotation(id) {
    try {
      const resp = await api.post(
        `/documents/quotation/${id}/render`,
        { format: "html", feature_name: "quotation" },
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
        const images = doc.querySelectorAll("img");
        if (images.length === 0) { doPrint(); return; }
        let loaded = 0;
        images.forEach((img) => {
          if (img.complete) { loaded++; if (loaded === images.length) doPrint(); return; }
          img.onload = () => { loaded++; if (loaded === images.length) doPrint(); };
          img.onerror = () => { loaded++; if (loaded === images.length) doPrint(); };
        });
      };
      setTimeout(waitForImages, 200);
    } catch (err) {
      console.error("Print error:", err);
      toast.error(err?.response?.data?.message || "Failed to print quotation");
    }
  }
  async function downloadQuotationPdf(id) {
    try {
      const resp = await api.post(
        `/documents/quotation/${id}/render`,
        { format: "html", feature_name: "quotation" },
        { headers: { "Content-Type": "application/json" } },
      );
      const html = typeof resp.data === "string" ? resp.data : String(resp.data || "");
      await renderHtmlToPdf(html, `quotation-${id}.pdf`);
    } catch (err) {
      console.error("PDF Download Error:", err);
      toast.error(err?.response?.data?.message || "Failed to download Quotation PDF");
    }
  }

  const filteredQuotations = (() => {
    const base =
      statusFilter === "ALL"
        ? quotations.slice()
        : quotations.filter((q) => q.status === statusFilter);
    if (!searchTerm.trim()) return base;
    return filterAndSort(base, {
      query: searchTerm,
      getKeys: (q) => [q.quotation_no, q.customer_name],
    });
  })();

  const { sorted: sortedQuotations, sortKey, sortDir, toggle } = useSort(filteredQuotations, "created_at", "desc");

  const workflowDisabled = hasInactiveWorkflow && !candidateWorkflow;

  function safeDate(v) {
    const s = String(v || "").trim();
    if (!s) return "-";
    const d = new Date(s);
    return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
  }
  function safeAmount(v) {
    const n = Number(v);
    if (!isFinite(n)) return "0.00";
    return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
  }

  async function cancelQuotation(id) {
    if (!canCancelQuotation) return;
    const ok = window.confirm("Cancel (delete) this quotation?");
    if (!ok) return;
    try {
      await api.delete(`/projects/project-quotations/${id}`);
      setQuotations((prev) => prev.filter((q) => Number(q.id) !== Number(id)));
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to cancel quotation");
    }
  }

  // Workflow functions
  const openForwardModal = async (quot) => {
    setSelectedQuot(quot);
    setShowForwardModal(true);
    setWfError("");
                    setForwardComments("");
    setTargetApproverId("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        setWorkflowsCache(Array.isArray(res.data?.items) ? res.data.items : []);
        await computeCandidateFromList(
          Array.isArray(res.data?.items) ? res.data.items : [],
        );
      } catch (e) {
        setWfError(e?.response?.data?.message || "Failed to load workflows");
      } finally {
        setWfLoading(false);
      }
    } else {
      await computeCandidate();
    }
  };

  const computeCandidate = async () => {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
                    setForwardComments("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/projects/project-quotations";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = workflowsCache.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "QUOTATION",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "QUOTATION",
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
              step_id: first.id || first.step_id,
              name: first.step_name || first.name || "First Approver",
              approvers: Array.isArray(first.approvers) ? first.approvers : [],
            }
          : null,
      );
      const defaultApprover =
        Array.isArray(first?.approvers) && first.approvers.length
          ? first.approvers[0]
          : null;
      if (defaultApprover) {
        setTargetApproverId(String(defaultApprover.user_id || ""));
      }
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  const computeCandidateFromList = async (items) => {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
                    setForwardComments("");
      setHasInactiveWorkflow(false);
      return;
    }
    const route = "/projects/project-quotations";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const matching = items.filter(
      (w) =>
        String(w.document_route) === route ||
        normalize(w.document_type) === "QUOTATION",
    );
    const hasInactive = matching.some((w) => Number(w.is_active) === 0);
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "QUOTATION",
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
              step_id: first.id || first.step_id,
              name: first.step_name || first.name || "First Approver",
              approvers: Array.isArray(first.approvers) ? first.approvers : [],
            }
          : null,
      );
      const defaultApprover =
        Array.isArray(first?.approvers) && first.approvers.length
          ? first.approvers[0]
          : null;
      if (defaultApprover) {
        setTargetApproverId(String(defaultApprover.user_id || ""));
      }
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to load workflow details");
    } finally {
      setWfLoading(false);
    }
  };

  const submitForward = async () => {
    if (!selectedQuot || !candidateWorkflow) return;
    setSubmittingForward(true);
    let optimisticApprover = null;
    try {
      const first =
        Array.isArray(workflowSteps) && workflowSteps.length
          ? workflowSteps[0]
          : null;
      const opts = first
        ? Array.isArray(first.approvers) && first.approvers.length
          ? first.approvers
          : []
        : [];
      if (targetApproverId) {
        const hit = opts.find(
          (a) => String(a.user_id) === String(targetApproverId),
        );
        if (hit) optimisticApprover = hit.username || hit.name || "Approver";
      }
      if (!optimisticApprover && opts.length) {
        optimisticApprover = opts[0].username || opts[0].name || "Approver";
      }
    } catch {}
    setQuotations((prev) =>
      prev.map((r) =>
        Number(r.id) === Number(selectedQuot.id)
          ? {
              ...r,
              status: "PENDING_APPROVAL",
              forwarded_to_username:
                optimisticApprover || r.forwarded_to_username || "Approver",
            }
          : r,
      ),
    );
    try {
      const resp = await api.post(
        `/projects/project-quotations/${selectedQuot.id}/submit`,
        {
          amount: null,
          workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
          target_user_id: targetApproverId || null,
        comments: forwardComments,
        },
      );
      toast.success(resp.data?.message || "Forwarded for approval");
      const newStatus = resp.data?.status || "PENDING_APPROVAL";
      let approverName = null;
      try {
        const first =
          Array.isArray(workflowSteps) && workflowSteps.length
            ? workflowSteps[0]
            : null;
        const opts = first
          ? Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers
            : []
          : [];
        const hit = targetApproverId
          ? opts.find((a) => String(a.user_id) === String(targetApproverId))
          : opts[0] || null;
        approverName = hit?.username || hit?.name || null;
      } catch {}
      setQuotations((prev) =>
        prev.map((r) =>
          Number(r.id) === Number(selectedQuot.id)
            ? {
                ...r,
                status: newStatus,
                forwarded_to_username:
                  approverName || r.forwarded_to_username || "Approver",
              }
            : r,
        ),
      );
      setShowForwardModal(false);
      setSelectedQuot(null);
    } catch (e) {
      setWfError(e?.response?.data?.message || "Failed to forward for approval");
      setQuotations((prev) =>
        prev.map((r) =>
          Number(r.id) === Number(selectedQuot.id)
            ? { ...r, status: selectedQuot.status }
            : r,
        ),
      );
    } finally {
      setSubmittingForward(false);
    }
  };

  const canForward = (status) => {
    const s = String(status || "").toUpperCase();
    return s === "DRAFT" || s === "SENT" || s === "REJECTED";
  };

  if (loading) {
    return <div className="text-center py-8">Loading quotations...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Sales Quotations
              </h1>
              <p className="text-sm mt-1">
                Manage customer quotations and proposals
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/project-management?section=Reports%20%26%20Analytics" className="btn btn-secondary">
                Return to Menu
              </Link>
              <Link to="/project-management/quotations/new" className="btn-success">
                + New Quotation
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
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by quotation number or customer..."
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
                <option value="SENT">Sent</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
              <p className="mt-2">Loading quotations...</p>
            </div>
          ) : filteredQuotations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">
                No quotations found.
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
                    <SortableHeader label="Quotation No" sortKey="quotation_no" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Date" sortKey="quotation_date" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Customer" sortKey="customer_name" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Vilidity Date" sortKey="valid_until" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Amount" sortKey="total_amount" currentKey={sortKey} direction={sortDir} onToggle={toggle} className="text-right" />
                    <th className="text-right">Actions</th>
                    <SortableHeader label="Created By" sortKey="created_by_username" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                    <SortableHeader label="Created Date" sortKey="created_at" currentKey={sortKey} direction={sortDir} onToggle={toggle} />
                  </tr>
                </thead>
                <tbody>
                  {sortedQuotations.map((quot) => (
                    <tr key={quot.id}>
                      <td className="font-medium">{quot.quotation_no}</td>
                      <td>{safeDate(quot.quotation_date)}</td>
                      <td>{quot.customer_name}</td>
                      <td>{safeDate(quot.valid_until)}</td>
                      <td className="font-semibold">
                        {safeAmount(quot.total_amount)}
                      </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Slot 1: View */}
                        <div className="min-w-[80px]">
                          <button
                            type="button"
                            className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                            onClick={() => navigate(`/project-management/quotations/${quot.id}?mode=view`)}
                          >
                            View
                          </button>
                        </div>

                        {/* Slot 2: Edit */}
                        <div className="min-w-[80px]">
                          {canPerformAction("sales:quotation", "edit") ? (
                            <button
                              type="button"
                              className="w-full inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors h-9"
                              onClick={() => navigate(`/project-management/quotations/${quot.id}?mode=edit`)}
                            >
                              Edit
                            </button>
                          ) : (
                            <div className="w-full h-9" />
                          )}
                        </div>

                        {/* Slot 3: Print */}
                        <div className="min-w-[80px]">
                          <ListPrintIconButton onClick={() => printQuotation(quot.id)} />
                        </div>

                        {/* Slot 4: PDF */}
                        <div className="min-w-[80px]">
                          <ListPdfIconButton onClick={() => downloadQuotationPdf(quot.id)} />
                        </div>

                        {/* Slot 5: Attachments */}
                        <div className="w-9">
                          <ListAttachmentIconButton
                            onClick={() => {
                              setActiveDocId(quot.id);
                              setShowAttach(true);
                            }}
                          />
                        </div>

                        {/* Slot 6: Workflow / Status */}
                        <div className="min-w-[160px]">
                          <div className="list-approval-slot">
                            {workflowDisabled && quot.status !== "ACCEPTED" && quot.status !== "APPROVED" ? (
                              <span className="list-approval-approved-pill">Approved</span>
                            ) : quot.status === "ACCEPTED" || quot.status === "APPROVED" ? (
                              <div className="flex items-center gap-2">
                                <span className="list-approval-approved-pill">
                                  {quot.status === "APPROVED" ? "Approved" : "Accepted"}
                                </span>
                                {canCancelQuotation && (
                                  <button
                                    type="button"
                                    className="list-approval-reverse-btn"
                                    onClick={() => cancelQuotation(quot.id)}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            ) : quot.forwarded_to_username && !["RETURNED", "DRAFT"].includes(String(quot.status || "").toUpperCase()) ? (
                              <span className="list-approval-forwarded-pill">
                                Forwarded to {quot.forwarded_to_username}
                              </span>
                            ) : canForward(quot.status) ? (
                              <button
                                type="button"
                                className="list-approval-forward-btn"
                                onClick={() => openForwardModal(quot)}
                              >
                                Forward for Approval
                              </button>
                            ) : (
                              <div className="w-full h-9" />
                            )}
                          </div>
                        </div>

                        {/* Extra Action: Force Cancel if allowed and not accepted/approved */}
                        {canCancelQuotation && !["ACCEPTED", "APPROVED"].includes(quot.status) && (
                          <div className="min-w-[80px]">
                            <button
                              type="button"
                              className="list-approval-reverse-btn"
                              onClick={() => cancelQuotation(quot.id)}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="grid-created-by-cell">{quot.created_by_username || quot.created_by_name || "-"}</td>
                    <td className="grid-created-date-cell">{quot.created_at ? new Date(quot.created_at).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        docType="quotation"
        docId={activeDocId}
      />

      {/* Forward for Approval Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedQuot(null);
                  setWfError("");
                    setForwardComments("");
                }}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {wfLoading ? (
                <div className="text-center py-4 text-gray-500">Loading workflows...</div>
              ) : wfError ? (
                <div className="text-red-600 text-sm">{wfError}</div>
              ) : (
                <>
                  {hasInactiveWorkflow && !candidateWorkflow && (
                    <div className="text-amber-600 text-sm">
                      No active workflow found for quotations. Please configure a workflow.
                    </div>
                  )}
                  {candidateWorkflow && (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">
                        Workflow: <span className="font-medium">{candidateWorkflow.name}</span>
                      </div>
                      {firstApprover && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Approver
                          </label>
                          {firstApprover.approvers && firstApprover.approvers.length > 1 ? (
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                              value={targetApproverId}
                              onChange={(e) => setTargetApproverId(e.target.value)}
                            >
                              <option value="">Select Approver</option>
                              {firstApprover.approvers.map((a) => (
                                <option key={a.user_id} value={a.user_id}>
                                  {a.username || a.name || `User ${a.user_id}`}
                                </option>
                              ))}
                            </select>
                          ) : firstApprover.approvers && firstApprover.approvers.length === 1 ? (
                            <div className="text-sm text-gray-900 py-2">
                              {firstApprover.approvers[0].username || firstApprover.approvers[0].name}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 py-2">
                              No specific approver assigned
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
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
              <div className="p-4 border-t flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                onClick={() => {
                  setShowForwardModal(false);
                  setSelectedQuot(null);
                  setWfError("");
                    setForwardComments("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-white rounded-lg hover:opacity-90"
                style={{ backgroundColor: "#0E3646" }}
                onClick={submitForward}
                disabled={!candidateWorkflow || submittingForward}
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
