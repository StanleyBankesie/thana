/**
 * @fileoverview ServiceBillForm component for Service Management module.
 * Implements the Sales Invoice UI design layout with branded header, PDF download,
 * print functionality, inline service adder bar, modern table, and totals summary card.
 */

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client.js";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import TaxPricingModal, { TaxModeRadioSelector } from "@/components/common/TaxPricingModal.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { toast } from "react-toastify";
import { Printer, Download, Plus, Trash2, ArrowLeft, CheckCircle2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import defaultLogo from "../../../../assets/resources/OMNISUITE_LOGO_FILL.png";

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const map = {
    paid: { label: "✓ PAID", cls: "bg-green-100 text-green-700 border-green-200" },
    posted: { label: "✓ POSTED", cls: "bg-blue-100 text-blue-700 border-blue-200" },
    overdue: { label: "⚠ OVERDUE", cls: "bg-red-100 text-red-700 border-red-200" },
    pending: { label: "⏳ PENDING", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    completed: { label: "✓ COMPLETED", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  };
  const d = map[s] || map.pending;
  return <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-md border ${d.cls}`}>{d.label}</span>;
}

function PaymentBadge({ payment }) {
  const p = String(payment || "").toLowerCase();
  const map = {
    paid: { label: "Paid", cls: "bg-green-100 text-green-700 border-green-200" },
    unpaid: { label: "Unpaid", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    partial: { label: "Partial", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  };
  const d = map[p] || map.unpaid;
  return <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-md border ${d.cls}`}>{d.label}</span>;
}

export default function ServiceBillForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEdit = Boolean(id && id !== "new");
  const { getExchangeRate } = useExchangeRate();
  const readOnly =
    String(new URLSearchParams(location.search).get("mode") || "").toLowerCase() === "view";
  const disabledClass = readOnly
    ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 cursor-not-allowed font-medium"
    : "";
  const successMsg = location.state?.success || "";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pdfRef = useRef(null);

  const [bill, setBill] = useState({
    bill_no: "",
    status: "",
    bill_date: "",
    due_date: "",
    service_date: "",
    supplier_id: "",
    relatedExecId: "",
    currency_id: "",
    exchange_rate: 1,
    payment_terms: "",
    payment_status: "UNPAID",
    freight_charges: 0,
    other_charges: 0,
    payment_method: "",
    payment_reference: "",
    notes: "",
    cost_center_id: "",
    tax_mode: "EXCLUSIVE",
  });

  const [lines, setLines] = useState([]);
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [editingLineId, setEditingLineId] = useState(null);
  const [showTaxModeAlert, setShowTaxModeAlert] = useState(false);
  const [hasPromptedTaxMode, setHasPromptedTaxMode] = useState(false);
  const [newItem, setNewItem] = useState({
    item_id: "",
    category: "",
    qty: 1,
    rate: 0,
    discount_percent: 0,
    tax_code_id: "",
    tax_mode: "EXCLUSIVE",
    tax_component_name: "",
  });

  const [suppliers, setSuppliers] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [confirmedServices, setConfirmedServices] = useState([]);
  const [serviceItems, setServiceItems] = useState([]);
  const [finCurrencies, setFinCurrencies] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});
  const [costCenters, setCostCenters] = useState([]);
  const [companyInfo, setCompanyInfo] = useState({
    name: "OmniSuite ERP",
    address: "Stanness Technologies HQ, Accra, Ghana",
    phone: "+233 (0) 30 200 0000",
    email: "service@omnisuite.com",
    taxId: "C0012398471",
  });

  const baseCurrencyCode = useMemo(() => {
    return finCurrencies.find((c) => Number(c.is_base) === 1 || c.is_base === true)?.code || "GHS";
  }, [finCurrencies]);

  const selectedCurrencyCode = useMemo(() => {
    return finCurrencies.find((c) => String(c.id) === String(bill.currency_id))?.code || "";
  }, [finCurrencies, bill.currency_id]);

  const update = (field, value) => setBill((prev) => ({ ...prev, [field]: value }));

  const toYmd = (v) => {
    if (!v) return "";
    try {
      const d = new Date(v);
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    } catch {}
    return typeof v === "string" ? v.slice(0, 10) : "";
  };

  const fetchTaxComponentsForCode = async (taxCodeId) => {
    const key = String(taxCodeId || "");
    if (!key) return;
    try {
      const resp = await api.get(`/finance/tax-codes/${taxCodeId}/components`);
      const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
      setTaxComponentsByCode((prev) => ({ ...prev, [key]: items }));
    } catch {}
  };

  useEffect(() => {
    const uniqueTaxIds = Array.from(
      new Set([
        ...lines.map((l) => String(l.tax_code_id)).filter(Boolean),
        newItem.tax_code_id ? String(newItem.tax_code_id) : null,
      ].filter(Boolean)),
    );
    const missing = uniqueTaxIds.filter((id) => !(id in taxComponentsByCode));
    if (missing.length) {
      Promise.all(missing.map((id) => fetchTaxComponentsForCode(id)));
    }
  }, [lines, newItem.tax_code_id]);

  const calcNewItemTaxBreakdown = () => {
    const qty = Number(newItem.qty || 0);
    const rate = Number(newItem.rate || 0);
    const discP = Number(newItem.discount_percent || 0);
    const gross = qty * rate;
    const disc = gross * (discP / 100);
    const taxableTotal = Math.max(0, gross - disc);
    const isInclusive = String(newItem.tax_mode || '').toUpperCase() === 'INCLUSIVE';

    const tc = taxCodes.find((t) => String(t.id) === String(newItem.tax_code_id));
    const tcRate = newItem.tax_rate !== undefined && newItem.tax_rate !== null && Number(newItem.tax_rate) > 0
      ? Number(newItem.tax_rate)
      : (tc ? Number(tc.rate_percent) || 0 : 0);

    const components = [];
    let taxTotal = 0;
    if (tcRate > 0) {
      if (isInclusive) {
        const net = taxableTotal / (1 + tcRate / 100);
        taxTotal = taxableTotal - net;
      } else {
        taxTotal = Math.round((taxableTotal * (tcRate / 100)) * 100) / 100;
      }
      components.push({
        name: newItem.tax_component_name || tc?.name || (isInclusive ? "Tax (Inclusive)" : "Tax (Exclusive)"),
        rate: tcRate,
        amount: taxTotal,
      });
    }
    return { components, taxTotal, taxableTotal };
  };

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem((prev) => {
      let next = { ...prev, [name]: value };
      if (name === "item_id") {
        const it = serviceItems.find((x) => String(x.id) === String(value));
        if (it?.item_name) next.desc = it.item_name;
        if (it?.cost_price) next.rate = Number(it.cost_price);
        api.get(`/finance/item-tax/${value}`)
          .then((res) => {
            const tax = res.data?.tax;
            if (tax && tax.id) {
              setNewItem((p) => (p.item_id === value ? { ...p, tax_code_id: String(tax.id) } : p));
            }
          })
          .catch(() => {});
      }
      return next;
    });
  };

  const addItemToLines = () => {
    if (!newItem.item_id || !newItem.qty) {
      toast.warn("Please select a service item and enter quantity");
      return;
    }
    const { taxTotal, taxableTotal } = calcNewItemTaxBreakdown();
    const it = serviceItems.find((x) => String(x.id) === String(newItem.item_id));

    setLines((prev) => [
      ...prev,
      {
        ...newItem,
        id: Date.now(),
        item_name: it?.item_name || newItem.desc || "",
        item_code: it?.item_code || "",
        tax_amount: taxTotal,
        line_total: taxableTotal + taxTotal,
      },
    ]);

    setNewItem({ item_id: "", category: "", qty: 1, rate: 0, discount_percent: 0, tax_code_id: "" });
    setItemQuery("");
  };

  const removeRow = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const recalcLine = (line) => {
    const qty = Number(line.qty) || 0;
    const rate = Number(line.rate) || 0;
    const discountPercent = Number(line.discount_percent) || 0;
    const gross = qty * rate;
    const discount = gross * (discountPercent / 100);
    const taxable = gross - discount;

    const effectiveMode = String(line.tax_mode || bill.tax_mode || '').toUpperCase();
    const isInclusive = effectiveMode === 'INCLUSIVE';
    let taxAmount = 0;
    const fallbackRate = bill.tax_rate !== undefined && bill.tax_rate !== null ? Number(bill.tax_rate) : 0;
    const tc = taxCodes.find((t) => String(t.id) === String(line.tax_code_id || bill.tax_code_id));
    const tcRate = line.tax_rate !== undefined && line.tax_rate !== null && Number(line.tax_rate) > 0 ? Number(line.tax_rate) : (tc ? Number(tc.rate_percent) || 0 : fallbackRate);

    if (isInclusive && tcRate > 0) {
      const net = taxable / (1 + tcRate / 100);
      taxAmount = Math.round((taxable - net) * 100) / 100;
      return {
        ...line,
        tax_amount: taxAmount,
        line_total: taxable,
        amount: taxable,
        tax_rate: tcRate,
        tax_mode: bill.tax_mode || 'EXCLUSIVE',
        tax_code_id: line.tax_code_id || bill.tax_code_id || '',
        tax_component_name: line.tax_component_name || bill.tax_component_name || (tc?.name || ''),
      };
    } else if (!isInclusive && tcRate > 0) {
      taxAmount = Math.round((taxable * (tcRate / 100)) * 100) / 100;
      return {
        ...line,
        tax_amount: taxAmount,
        line_total: Math.round((taxable + taxAmount) * 100) / 100,
        amount: taxable,
        tax_rate: tcRate,
        tax_mode: 'EXCLUSIVE',
        tax_code_id: line.tax_code_id || bill.tax_code_id || '',
        tax_component_name: line.tax_component_name || bill.tax_component_name || (tc?.name || ''),
      };
    }
    return {
      ...line,
      tax_amount: 0,
      line_total: taxable,
      amount: taxable,
      tax_rate: 0,
      tax_mode: 'EXCLUSIVE',
      tax_code_id: line.tax_code_id || bill.tax_code_id || '',
      tax_component_name: line.tax_component_name || bill.tax_component_name || '',
    };
  };

  const handleLineChange = (lineId, field, value) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        let next = { ...l, [field]: value };
        return recalcLine(next);
      }),
    );
  };

  const totals = useMemo(() => {
    let grossSub = 0;
    let itemDiscounts = 0;
    const compTotals = {};
    const isInclusive = String(bill.tax_mode || '').toUpperCase() === 'INCLUSIVE';

    for (const r of lines) {
      const qty = Number(r.qty || 0);
      const rate = Number(r.rate || 0);
      const base = qty * rate;
      grossSub += base;
      const discPct = Number(r.discount_percent || 0);
      const discountAmt = base * (discPct / 100);
      itemDiscounts += discountAmt;

      const isLineIncl = String(r.tax_mode || bill.tax_mode || '').toUpperCase() === 'INCLUSIVE';
      const amt = Number(r.tax_amount || 0);
      if (amt > 0) {
        const tc = taxCodes.find((t) => String(t.id) === String(r.tax_code_id || bill.tax_code_id));
        const name = r.tax_component_name || bill.tax_component_name || tc?.name || (r.tax_rate ? `Tax (${r.tax_rate}%)` : (isLineIncl ? "Tax (Inclusive)" : "Tax (Exclusive)"));
        if (!compTotals[name]) compTotals[name] = { amount: 0, rate: Number(r.tax_rate !== undefined ? r.tax_rate : (bill.tax_rate || 0)) };
        compTotals[name].amount += amt;
      }
    }

    const compArray = Object.keys(compTotals).map((k) => ({
      name: k,
      amount: Math.round(compTotals[k].amount * 100) / 100,
      rate: compTotals[k].rate,
    }));
    const taxTotal = lines.reduce((s, r) => s + Number(r.tax_amount || 0), 0);
    if (compArray.length === 0 && taxTotal > 0) {
      const tc = taxCodes.find((t) => String(t.id) === String(bill.tax_code_id));
      const rate = bill.tax_rate !== undefined ? bill.tax_rate : (tc?.rate_percent || 0);
      compArray.push({
        name: bill.tax_component_name || tc?.name || (rate ? `Tax (${rate}%)` : "Tax"),
        amount: Math.round(taxTotal * 100) / 100,
        rate,
      });
    }
    const other = Number(bill.other_charges || 0);

    // Subtotal: when inclusive, Subtotal must be LESS TAX:
    const subtotal = isInclusive ? Math.max(0, grossSub - taxTotal) : grossSub;
    const grand = isInclusive
      ? grossSub - itemDiscounts + other
      : subtotal - itemDiscounts + taxTotal + other;

    return {
      grossSub,
      subtotal,
      discountAmount: itemDiscounts,
      taxAmount: taxTotal,
      other,
      total: grand,
      components: compArray,
    };
  }, [lines, bill.tax_mode, bill.tax_code_id, bill.tax_rate, bill.tax_component_name, bill.other_charges, taxComponentsByCode, taxCodes]);

  // Load Lookups
  useEffect(() => {
    let mounted = true;
    async function loadLookups() {
      try {
        const [supRes, soRes, currRes, itemsRes, taxesRes, ccRes, compRes] = await Promise.all([
          api.get("/purchase/suppliers?contractor=Y").catch(() => ({ data: { items: [] } })),
          api.get("/service-orders?status=DONE").catch(() => ({ data: { orders: [] } })),
          api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/items?type=service").catch(() => ({ data: { items: [] } })),
          api.get("/finance/tax-codes?form=SERVICE_BILL").catch(() => ({ data: { items: [] } })),
          api.get("/finance/cost-centers").catch(() => ({ data: { items: [] } })),
          api.get("/company/profile").catch(() => ({ data: {} })),
        ]);

        if (!mounted) return;
        const sups = supRes.data?.data?.items || supRes.data?.items || [];
        setSuppliers(sups);

        const orders = soRes.data?.orders || soRes.data?.items || [];
        setConfirmedServices(orders);

        const currs = Array.isArray(currRes.data?.items) ? currRes.data.items : [];
        setFinCurrencies(currs);

        const items = Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [];
        setServiceItems(items.map((x) => ({ id: x.id, item_name: x.item_name, item_code: x.item_code, cost_price: x.cost_price })));

        setTaxCodes(Array.isArray(taxesRes.data?.items) ? taxesRes.data.items : []);
        setCostCenters(Array.isArray(ccRes.data?.items) ? ccRes.data.items : (Array.isArray(ccRes.data?.data?.items) ? ccRes.data.data.items : []));

        if (compRes.data && compRes.data.company_name) {
          setCompanyInfo({
            name: compRes.data.company_name,
            address: compRes.data.address || "Accra, Ghana",
            phone: compRes.data.phone || "",
            email: compRes.data.email || "",
            taxId: compRes.data.tax_id || "",
          });
        }
      } catch {}
    }
    loadLookups();
    return () => { mounted = false; };
  }, []);

  // Fetch Next Bill Number
  useEffect(() => {
    let mounted = true;
    if (isEdit) return;
    async function getNextBillNo() {
      try {
        const res = await api.get("/purchase/service-bills/next-no");
        const s = res.data?.nextNo;
        const n = Number(String(s || "").replace(/\D/g, "")) || 1;
        if (!mounted) return;
        setBill((p) => (p.bill_no ? p : { ...p, bill_no: `SVB-${String(n).padStart(6, "0")}` }));
      } catch {
        if (!mounted) return;
        setBill((p) => (p.bill_no ? p : { ...p, bill_no: `SVB-${String(1).padStart(6, "0")}` }));
      }
    }
    getNextBillNo();
    return () => { mounted = false; };
  }, [isEdit]);

  // Exchange Rate
  useEffect(() => {
    if (!bill.currency_id || finCurrencies.length === 0) return;
    const selected = finCurrencies.find((c) => String(c.id) === String(bill.currency_id));
    const base = finCurrencies.find((c) => Number(c.is_base) === 1 || c.is_base === true);
    if (!selected || !base) return;

    if (selected.code === base.code) {
      if (bill.exchange_rate !== 1) setBill((p) => ({ ...p, exchange_rate: 1 }));
      return;
    }

    getExchangeRate(selected.code, base.code).then((rate) => {
      if (rate && bill.exchange_rate !== rate) setBill((p) => ({ ...p, exchange_rate: rate }));
    });
  }, [bill.currency_id, finCurrencies]);

  // Load Existing
  useEffect(() => {
    let mounted = true;
    async function loadExisting() {
      if (!id || id === "new") return;
      try {
        setLoading(true);
        const res = await api.get(`/purchase/service-bills/${id}`);
        const item = res.data?.item || {};
        const details = Array.isArray(res.data?.details) ? res.data.details : [];
        if (!mounted) return;

        setBill({
          bill_no: item.bill_no || "",
          status: String(item.status || "pending").toLowerCase(),
          bill_date: toYmd(item.bill_date) || new Date().toISOString().split("T")[0],
          due_date: toYmd(item.due_date) || "",
          service_date: toYmd(item.service_date) || "",
          supplier_id: item.supplier_id ? String(item.supplier_id) : "",
          relatedExecId: item.order_id ? String(item.order_id) : "",
          currency_id: item.currency_id || 4,
          exchange_rate: Number(item.exchange_rate) || 1,
          payment_terms: Number(item.payment_terms) || 30,
          payment_status: item.payment_status || "UNPAID",
          freight_charges: Number(item.freight_charges) || 0,
          other_charges: Number(item.other_charges) || 0,
          payment_method: item.payment_method || "cash",
          payment_reference: item.payment_reference || "",
          notes: item.notes || "",
          cost_center_id: item.cost_center_id ? String(item.cost_center_id) : "",
        });

        setLines(
          details.map((d) => ({
            id: d.id || Date.now() + Math.random(),
            item_id: d.item_id ? String(d.item_id) : "",
            item_name: d.item_name || d.description || "",
            category: d.category || "",
            qty: Number(d.qty) || 0,
            rate: Number(d.rate) || 0,
            discount_percent: Number(d.discount_percent) || 0,
            tax_code_id: d.tax_code_id ? String(d.tax_code_id) : "",
            tax_amount: Number(d.tax_amount) || 0,
            line_total: Number(d.line_total) || Number(d.amount) || 0,
          })),
        );
      } catch (err) {
        if (mounted) setError("Failed to load service bill");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadExisting();
    return () => { mounted = false; };
  }, [id]);

  const saveBill = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!bill.bill_date) {
      toast.error("Bill Date is required");
      return;
    }
    if (!bill.supplier_id) {
      toast.error("Please select a service provider / supplier");
      return;
    }
    if (lines.length === 0) {
      toast.error("Please add at least one service line");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        bill_no: bill.bill_no,
        bill_date: bill.bill_date,
        due_date: bill.due_date || null,
        service_date: bill.service_date || null,
        supplier_id: bill.supplier_id,
        order_id: bill.relatedExecId || null,
        currency_id: bill.currency_id,
        exchange_rate: bill.exchange_rate,
        payment_terms: bill.payment_terms,
        payment_method: bill.payment_method,
        payment_reference: bill.payment_reference,
        notes: bill.notes,
        cost_center_id: bill.cost_center_id || null,
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        other_charges: totals.other,
        total_amount: totals.total,
        status: bill.status || "pending",
        details: lines.map((l) => ({
          item_id: l.item_id || null,
          description: l.item_name || l.desc || "",
          category: l.category || "",
          qty: l.qty,
          rate: l.rate,
          discount_percent: l.discount_percent || 0,
          tax_code_id: l.tax_code_id || null,
          tax_amount: l.tax_amount || 0,
          amount: l.line_total,
        })),
      };

      if (isEdit) {
        await api.put(`/purchase/service-bills/${id}`, payload);
        toast.success("Service Bill updated successfully");
      } else {
        await api.post("/purchase/service-bills", payload);
        toast.success("Service Bill created successfully");
      }

      navigate("/service-management/service-bills", {
        state: { success: `Service Bill ${bill.bill_no} saved successfully.` },
      });
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to save service bill";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    const el = pdfRef.current;
    if (!el) return;
    const original = el.style.cssText;
    el.style.cssText =
      original +
      ";position:fixed;left:-10000px;top:0;display:block;z-index:-1;background:white;width:794px;padding:32px;";
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let rendered = 0;
      while (rendered < imgHeight) {
        pdf.addImage(imgData, "PNG", 0, -rendered, imgWidth, imgHeight);
        rendered += pageHeight;
        if (rendered < imgHeight) pdf.addPage();
      }
      const fname = `Service_Bill_${bill.bill_no || "Draft"}.pdf`;
      pdf.save(fname);
    } catch (err) {
      toast.error("Failed to generate PDF");
    } finally {
      el.style.cssText = original;
    }
  };

  const selectedSupplierObj = suppliers.find((s) => String(s.id) === String(bill.supplier_id));

  return (
    <div className="space-y-4">
      {/* Top Action Bar matching Sales Invoice */}
      <div className="card print:hidden">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300 flex items-center gap-2">
                <span>📋</span> {isEdit ? "Edit Service Bill" : "New Service Bill"}
              </h1>
              <p className="text-sm mt-1 text-slate-100">
                Prepare, review and issue vendor service bills, job order settlements and subcontractor billings
              </p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary text-xs flex items-center gap-1.5"
                title="Print Service Bill"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="btn-secondary text-xs flex items-center gap-1.5"
                title="Download PDF"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => navigate("/service-management/service-bills")}
                className="btn-success text-xs flex items-center gap-1"
              >
                <ArrowLeft size={14} /> Back
              </button>
            </div>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
          {error}
        </div>
      )}

      {/* Main Form Body */}
      <form onSubmit={saveBill} className="print:hidden space-y-4">
        <div className="card">
          <div className="card-body space-y-6">
            {/* Top Metadata Grid matching Sales Invoice */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Bill No *</label>
                <input
                  type="text"
                  className="input bg-slate-50 dark:bg-slate-900 font-mono font-bold text-slate-800 dark:text-slate-200"
                  value={bill.bill_no}
                  readOnly
                  placeholder="Auto-generated"
                />
              </div>

              <div>
                <label className="label">Bill Date *</label>
                <input
                  type="date"
                  className={`input ${disabledClass}`}
                  value={bill.bill_date}
                  onChange={(e) => update("bill_date", e.target.value)}
                  required
                  disabled={readOnly || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
                />
              </div>

              <div>
                <label className="label">Service Provider / Supplier *</label>
                <div className="relative">
                  <input
                    type="text"
                    className={`input ${disabledClass} w-full`}
                    placeholder="Search supplier..."
                    disabled={readOnly}
                    value={
                      selectedSupplierObj?.supplier_name ||
                      selectedSupplierObj?.name ||
                      supplierSearch
                    }
                    onChange={(e) => {
                      setSupplierSearch(e.target.value);
                      update("supplier_id", "");
                    }}
                  />
                  {!readOnly && supplierSearch && (
                    (() => {
                      const q = supplierSearch.trim();
                      const matched = q
                        ? filterByPrefix(suppliers, {
                            query: q,
                            searchFields: ["supplier_name", "name", "company", "supplier_code"],
                          }).slice(0, 10)
                        : [];
                      return matched.length > 0 ? (
                        <div className="absolute z-30 w-full bg-white dark:bg-slate-850 border border-gray-300 dark:border-slate-700 rounded-lg shadow-xl mt-1 max-h-52 overflow-y-auto">
                          {matched.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-b-0 text-xs"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                update("supplier_id", String(s.id));
                                if (s.currency_id) update("currency_id", Number(s.currency_id));
                                setSupplierSearch("");

                                // Match confirmed service
                                const supCode = s.supplier_code || s.code || null;
                                const matches = confirmedServices.filter(
                                  (so) =>
                                    supCode &&
                                    String(so.contractor_code) === String(supCode) &&
                                    String(so.status || "").toUpperCase() === "DONE",
                                );
                                if (matches.length === 1) {
                                  update("relatedExecId", String(matches[0].id));
                                }
                              }}
                            >
                              <div className="font-semibold text-slate-800 dark:text-slate-100">
                                {s.supplier_name || s.name}
                              </div>
                              {s.supplier_code && (
                                <div className="text-[10px] text-slate-400">{s.supplier_code}</div>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : null;
                    })()
                  )}
                </div>
              </div>

              <div>
                <label className="label">Confirmed Service Order</label>
                <select
                  className={`input ${disabledClass}`}
                  value={bill.relatedExecId || ""}
                  onChange={(e) => update("relatedExecId", e.target.value)}
                  disabled={readOnly}
                >
                  <option value="">-- Optional Confirmed Order --</option>
                  {(() => {
                    const supCode = selectedSupplierObj?.supplier_code || selectedSupplierObj?.code || null;
                    return confirmedServices
                      .filter(
                        (so) =>
                          supCode &&
                          String(so.contractor_code) === String(supCode) &&
                          String(so.status || "").toUpperCase() === "DONE",
                      )
                      .map((so) => (
                        <option key={so.id} value={String(so.id)}>
                          {so.order_no} - {so.customer_name || so.service_type || ""}
                        </option>
                      ));
                  })()}
                </select>
              </div>

              <div>
                <label className="label">Cost Center</label>
                <select
                  className={`input ${disabledClass}`}
                  value={bill.cost_center_id || ""}
                  onChange={(e) => update("cost_center_id", e.target.value)}
                  disabled={readOnly}
                >
                  <option value="">-- Select Cost Center --</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name} ({cc.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Service Date</label>
                <input
                  type="date"
                  className={`input ${disabledClass}`}
                  value={bill.service_date}
                  onChange={(e) => update("service_date", e.target.value)}
                  disabled={readOnly}
                />
              </div>

              <div>
                <label className="label">Due Date</label>
                <input
                  type="date"
                  className={`input ${disabledClass}`}
                  value={bill.due_date}
                  onChange={(e) => update("due_date", e.target.value)}
                  disabled={readOnly}
                />
              </div>

              <div>
                <label className="label">Currency</label>
                <select
                  className={`input ${disabledClass}`}
                  value={bill.currency_id}
                  onChange={(e) => update("currency_id", e.target.value)}
                  disabled={readOnly}
                >
                  {finCurrencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code || c.currency_code} - {c.name || c.currency_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  Exchange Rate {selectedCurrencyCode ? `(${baseCurrencyCode} per ${selectedCurrencyCode})` : ""}
                </label>
                <input
                  type="number"
                  step="0.000001"
                  className={`input text-right ${disabledClass}`}
                  value={bill.exchange_rate}
                  onChange={(e) => update("exchange_rate", e.target.value)}
                  readOnly
                />
              </div>
            </div>

            {/* Service Items Section */}
            <div className="pt-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>🔧</span> Service Breakdown & Line Items
                </h3>
                <div className="flex items-center gap-3">
                  <TaxModeRadioSelector
                    taxMode={bill.tax_mode || "EXCLUSIVE"}
                    onModeChange={(newMode) => {
                      update("tax_mode", newMode);
                      setNewItem((prev) => ({
                        ...prev,
                        tax_mode: newMode,
                        ...(newMode === "EXCLUSIVE" ? { tax_code_id: "", tax_rate: 0, tax_component_name: "" } : {}),
                      }));
                      setLines((prev) =>
                        prev.map((ln) => {
                          const updated = {
                            ...ln,
                            tax_mode: newMode,
                            ...(newMode === "EXCLUSIVE" ? { tax_code_id: "", tax_rate: 0, tax_component_name: "" } : {}),
                          };
                          const qty = Number(updated.qty || 0);
                          const rate = Number(updated.rate || 0);
                          const disc = qty * rate * (Number(updated.discount_percent || 0) / 100);
                          const net = qty * rate - disc;
                          const tcRate = newMode === "INCLUSIVE" ? Number(updated.tax_rate || 0) : 0;
                          let tax_amount = 0;
                          let line_total = net;
                          if (newMode === "INCLUSIVE" && tcRate > 0) {
                            const sub = net / (1 + tcRate / 100);
                            tax_amount = net - sub;
                            line_total = net;
                          }
                          return { ...updated, tax_amount, line_total, amount: line_total };
                        })
                      );
                    }}
                    onOpenTaxModal={() => {
                      setEditingLineId(null);
                      setTaxModalOpen(true);
                    }}
                    selectedTaxLabel={newItem.tax_component_name}
                    openAlert={showTaxModeAlert}
                    onCloseAlert={() => setShowTaxModeAlert(false)}
                    anchorSelector="#service-bill-item-search"
                  />
                  <StatusBadge status={bill.status} />
                  <PaymentBadge payment={bill.payment_status} />
                </div>
              </div>

              {/* Add Item Bar matching InvoiceForm */}
              {!readOnly && (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-brand uppercase tracking-wider">Add Service Item</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-4">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Service Item *
                      </label>
                      <div className="relative">
                        <input
                          id="service-bill-item-search"
                          autoComplete="off"
                          className="input w-full text-xs"
                          placeholder="Search service item..."
                          value={itemQuery}
                          onFocus={() => {
                            if (!hasPromptedTaxMode) {
                              setShowTaxModeAlert(true);
                              setHasPromptedTaxMode(true);
                            }
                          }}
                          onClick={() => {
                            if (!hasPromptedTaxMode) {
                              setShowTaxModeAlert(true);
                              setHasPromptedTaxMode(true);
                            }
                          }}
                          onChange={(e) => {
                            setItemQuery(e.target.value);
                            if (newItem.item_id) {
                              setNewItem((prev) => ({ ...prev, item_id: "", desc: e.target.value, rate: 0 }));
                            }
                          }}
                        />
                        {(() => {
                          const q = itemQuery.trim();
                          const results = q
                            ? filterByPrefix(serviceItems, { query: q, searchFields: ["item_code", "item_name"] })
                            : [];
                          return results.length && !newItem.item_id ? (
                            <div className="absolute z-30 w-full bg-white dark:bg-slate-850 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl mt-1 max-h-48 overflow-auto">
                              {results.map((o) => (
                                <button
                                  type="button"
                                  key={o.id}
                                  className="block w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    handleNewItemChange({ target: { name: "item_id", value: String(o.id) } });
                                    setItemQuery(o.item_name);
                                  }}
                                >
                                  {o.item_code} - {o.item_name}
                                </button>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Category
                      </label>
                      <select
                        name="category"
                        className="input w-full text-xs"
                        value={newItem.category}
                        onChange={handleNewItemChange}
                      >
                        <option value="">General</option>
                        <option value="installation">Installation</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="repair">Repair</option>
                        <option value="consultation">Consultation</option>
                      </select>
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Qty *
                      </label>
                      <input
                        type="number"
                        name="qty"
                        min="1"
                        step="1"
                        className="input w-full text-xs text-right"
                        value={newItem.qty}
                        onChange={handleNewItemChange}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Rate / Price *
                      </label>
                      <input
                        type="number"
                        name="rate"
                        step="0.01"
                        className="input w-full text-xs text-right"
                        value={newItem.rate}
                        onChange={handleNewItemChange}
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Disc %
                      </label>
                      <input
                        type="number"
                        name="discount_percent"
                        min="0"
                        max="100"
                        className="input w-full text-xs text-right"
                        value={newItem.discount_percent}
                        onChange={handleNewItemChange}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Tax Code
                      </label>
                      <div
                        data-tax-anchor="true"
                        onClick={() => {
                          setEditingLineId(null);
                          setTaxModalOpen(true);
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 cursor-pointer flex items-center justify-between hover:border-brand-500 transition-colors shadow-sm min-h-[38px]"
                        title="Click to select tax code"
                      >
                        <span className="truncate text-slate-800 dark:text-slate-200">
                          {newItem.tax_component_name || (newItem.tax_code_id ? taxCodes.find(t => String(t.id) === String(newItem.tax_code_id))?.name : '') || (newItem.tax_rate ? `Tax (${newItem.tax_rate}%)` : 'Select Tax')}
                        </span>
                        {newItem.tax_rate !== undefined && Number(newItem.tax_rate) > 0 && (
                          <span className="text-[11px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded shrink-0 ml-1">
                            {Number(newItem.tax_rate)}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-12 flex justify-end">
                      <button
                        type="button"
                        onClick={addItemToLines}
                        className="btn-brand text-xs px-4 py-2 flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" /> Add Service
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Line Items Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 mt-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3 min-w-[220px]">Service Item</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right w-20">Qty</th>
                      <th className="p-3 text-right w-28">Rate</th>
                      <th className="p-3 text-right w-20">Disc %</th>
                      <th className="p-3 text-right w-28">Tax</th>
                      <th className="p-3 text-right w-32">Total</th>
                      {!readOnly && <th className="p-3 text-center w-16">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lines.length === 0 ? (
                      <tr>
                        <td
                          colSpan={readOnly ? 8 : 9}
                          className="text-center py-12 text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 italic"
                        >
                          No service items added yet. Click &apos;+ Add Service&apos; above.
                        </td>
                      </tr>
                    ) : (
                      lines.map((row, i) => {
                        const qty = Number(row.qty || 0);
                        const rate = Number(row.rate || 0);
                        const base = qty * rate;
                        const discPct = Number(row.discount_percent || 0);
                        const discAmt = base * (discPct / 100);
                        const net = base - discAmt;
                        const tax = Number(row.tax_amount || 0);
                        const lineTotal = Number(row.line_total || 0) || net + tax;

                        return (
                          <tr key={row.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-3 text-center text-slate-400">{i + 1}</td>
                            <td className="p-3 font-semibold text-slate-800 dark:text-slate-100">
                              {row.item_name || row.desc}
                              {row.item_code && (
                                <span className="block text-[10px] text-slate-400 font-mono">{row.item_code}</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400 capitalize">{row.category || "General"}</td>
                            <td className="p-3 text-right font-mono">
                              {!readOnly ? (
                                <input
                                  type="number"
                                  min="1"
                                  className="input text-right text-xs w-20 p-1"
                                  value={row.qty}
                                  onChange={(e) => handleLineChange(row.id, "qty", Number(e.target.value))}
                                />
                              ) : (
                                row.qty
                              )}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {!readOnly ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  className="input text-right text-xs w-24 p-1"
                                  value={row.rate}
                                  onChange={(e) => handleLineChange(row.id, "rate", Number(e.target.value))}
                                />
                              ) : (
                                Number(row.rate).toFixed(2)
                              )}
                            </td>
                            <td className="p-3 text-right font-mono text-amber-600">{row.discount_percent || 0}%</td>
                            <td className="p-3 text-right font-mono text-slate-500">{tax.toFixed(2)}</td>
                            <td className="p-3 text-right font-mono font-bold text-brand dark:text-brand-300">
                              {lineTotal.toFixed(2)}
                            </td>
                            {!readOnly && (
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  className="text-red-500 hover:text-red-700 transition-colors p-1"
                                  title="Remove item"
                                  onClick={() => removeRow(i)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Remarks / Notes Field Full Width */}
            <div className="w-full pt-4 border-t border-slate-200 dark:border-slate-800">
              <label className="label">Remarks / Notes</label>
              <textarea
                className={`input ${disabledClass} w-full`}
                rows={3}
                value={bill.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Add notes, job order references, deliverables..."
                disabled={readOnly}
              />
            </div>

            {/* Bottom 2-Column Summary and Payment Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              {/* Left Column: Settlement & Payment Details */}
              <div className="lg:col-span-7 space-y-4">
                {/* Direct Settlement Card matching Sales Invoice */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Settlement & Payment Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="label">Payment Terms</label>
                      <select
                        className={`input ${disabledClass}`}
                        value={bill.payment_terms}
                        onChange={(e) => update("payment_terms", Number(e.target.value))}
                        disabled={readOnly}
                      >
                        <option value="0">Immediate</option>
                        <option value="15">Net 15</option>
                        <option value="30">Net 30</option>
                        <option value="60">Net 60</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">Payment Method</label>
                      <select
                        className={`input ${disabledClass}`}
                        value={bill.payment_method}
                        onChange={(e) => update("payment_method", e.target.value)}
                        disabled={readOnly}
                      >
                        <option value="cash">Cash</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="mobile">Mobile Money</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">Payment Reference</label>
                      <input
                        type="text"
                        className={`input ${disabledClass}`}
                        value={bill.payment_reference || ""}
                        onChange={(e) => update("payment_reference", e.target.value)}
                        placeholder="TR-XXXX / Cheque #"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Totals Summary Card matching Sales Invoice */}
              <div className="lg:col-span-5">
                <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-2.5 text-xs shadow-sm">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-slate-700">
                    Bill Summary
                  </div>

                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold">{totals.subtotal.toFixed(2)}</span>
                  </div>

                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between items-center text-amber-600 font-medium">
                      <span>Total Discount:</span>
                      <span className="font-mono">-{totals.discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  {totals.components.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                      <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-200">
                        <span>Tax Components:</span>
                        <span className="font-mono">{totals.taxAmount.toFixed(2)}</span>
                      </div>
                      {totals.components.map((c) => (
                        <div key={c.name} className="flex justify-between text-[11px] text-slate-500 pl-3">
                          <span>{c.name} ({c.rate}%):</span>
                          <span className="font-mono">{Number(c.amount || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-300">Other Charges:</span>
                    {!readOnly ? (
                      <input
                        type="number"
                        step="0.01"
                        className="input w-28 text-right text-xs p-1 font-mono"
                        value={bill.other_charges}
                        onChange={(e) => update("other_charges", Number(e.target.value))}
                      />
                    ) : (
                      <span className="font-mono">{totals.other.toFixed(2)}</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t-2 border-brand dark:border-brand-400 text-base font-bold text-brand dark:text-brand-300">
                    <span>Grand Total:</span>
                    <span className="font-mono text-lg">
                      {selectedCurrencyCode || baseCurrencyCode} {totals.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => navigate("/service-management/service-bills")}
                className="btn-secondary px-5 py-2 text-xs"
                disabled={saving}
              >
                Cancel
              </button>
              {!readOnly && (
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-success px-6 py-2 text-xs font-semibold shadow-sm flex items-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  {saving ? "Saving Bill..." : "Save Service Bill"}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Hidden Printable / PDF Container */}
      <div ref={pdfRef} style={{ display: "none" }} className="bg-white text-slate-900 p-8 text-xs font-sans">
        <div className="flex justify-between items-start pb-6 border-b border-slate-300">
          <div>
            <img src={defaultLogo} alt="Logo" className="h-10 mb-2 object-contain" />
            <h2 className="text-lg font-bold">{companyInfo.name}</h2>
            <p className="text-slate-600">{companyInfo.address}</p>
            <p className="text-slate-600">Phone: {companyInfo.phone} | Email: {companyInfo.email}</p>
            {companyInfo.taxId && <p className="text-slate-600">Tax ID: {companyInfo.taxId}</p>}
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold uppercase text-brand tracking-wider">SERVICE BILL</h1>
            <p className="font-mono font-bold text-sm mt-1">{bill.bill_no}</p>
            <p className="text-slate-600 mt-1">Date: {bill.bill_date}</p>
            {bill.due_date && <p className="text-slate-600">Due: {bill.due_date}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6 border-b border-slate-300">
          <div>
            <h4 className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1">Service Provider / Vendor:</h4>
            <p className="font-bold text-sm">{selectedSupplierObj?.supplier_name || selectedSupplierObj?.name || "N/A"}</p>
            {selectedSupplierObj?.address && <p className="text-slate-600">{selectedSupplierObj.address}</p>}
            {selectedSupplierObj?.phone && <p className="text-slate-600">Phone: {selectedSupplierObj.phone}</p>}
            {selectedSupplierObj?.email && <p className="text-slate-600">Email: {selectedSupplierObj.email}</p>}
          </div>
          <div className="text-right">
            <h4 className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mb-1">Payment Status:</h4>
            <p className="font-bold uppercase text-sm">{bill.payment_status || "UNPAID"}</p>
            <p className="text-slate-600">Terms: {bill.payment_terms} Days</p>
            {bill.payment_method && <p className="text-slate-600">Method: {bill.payment_method.toUpperCase()}</p>}
          </div>
        </div>

        <table className="w-full text-left my-6 border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-800 text-[11px] uppercase font-bold">
              <th className="py-2">#</th>
              <th className="py-2">Service Description</th>
              <th className="py-2">Category</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">Disc %</th>
              <th className="py-2 text-right">Tax</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {lines.map((l, i) => (
              <tr key={i} className="text-xs">
                <td className="py-2">{i + 1}</td>
                <td className="py-2 font-medium">{l.item_name || l.desc}</td>
                <td className="py-2">{l.category || "General"}</td>
                <td className="py-2 text-right font-mono">{l.qty}</td>
                <td className="py-2 text-right font-mono">{Number(l.rate).toFixed(2)}</td>
                <td className="py-2 text-right font-mono">{l.discount_percent || 0}%</td>
                <td className="py-2 text-right font-mono">{Number(l.tax_amount || 0).toFixed(2)}</td>
                <td className="py-2 text-right font-mono font-bold">{Number(l.line_total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end pt-4 border-t border-slate-300">
          <div className="w-64 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono">{totals.subtotal.toFixed(2)}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Discount:</span>
                <span className="font-mono">-{totals.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Total Tax:</span>
              <span className="font-mono">{totals.taxAmount.toFixed(2)}</span>
            </div>
            {totals.other > 0 && (
              <div className="flex justify-between">
                <span>Other Charges:</span>
                <span className="font-mono">{totals.other.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t-2 border-slate-800 font-bold text-sm">
              <span>Grand Total:</span>
              <span className="font-mono">{selectedCurrencyCode || baseCurrencyCode} {totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {bill.notes && (
          <div className="mt-8 pt-4 border-t border-slate-200">
            <h5 className="font-bold text-[10px] uppercase text-slate-500 mb-1">Remarks & Notes:</h5>
            <p className="text-slate-600 text-xs">{bill.notes}</p>
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
            <p className="text-slate-500">Prepared By</p>
          </div>
          <div>
            <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
            <p className="text-slate-500">Authorized Signature</p>
          </div>
        </div>
      </div>

      {/* Universal Tax Pricing & Components Modal */}
      <TaxPricingModal
        open={taxModalOpen}
        form="SERVICE_BILL"
        pageId={8}
        onClose={() => setTaxModalOpen(false)}
        taxMode={newItem.tax_mode || 'EXCLUSIVE'}
        price={newItem.rate || 0}
        selectedComponent={{
          name: newItem.tax_component_name,
          rate: newItem.tax_rate,
          id: newItem.tax_code_id,
        }}
        onSelectComponent={(comp) => {
          const compLabel = `${comp.name}${comp.rate !== undefined ? ` (${comp.rate}%)` : ''}`;
          const taxCodeId = comp.taxCodeId || comp.originalId || comp.id;
          const taxRate = comp.rate;
          setBill((prev) => ({
            ...prev,
            tax_mode: bill.tax_mode || 'EXCLUSIVE',
            tax_code_id: taxCodeId,
            tax_rate: taxRate,
            tax_component_name: compLabel,
          }));
          setNewItem((prev) => ({
            ...prev,
            tax_code_id: taxCodeId || prev.tax_code_id,
            tax_rate: taxRate,
            tax_component_name: compLabel,
            tax_mode: bill.tax_mode || 'EXCLUSIVE',
          }));
          setLines((prev) =>
            prev.map((ln) => {
              const updated = {
                ...ln,
                tax_code_id: taxCodeId || ln.tax_code_id,
                tax_rate: taxRate,
                tax_component_name: compLabel,
                tax_mode: bill.tax_mode || 'EXCLUSIVE',
              };
              return recalcLine(updated);
            })
          );
          if (taxCodeId) {
            fetchTaxComponentsForCode(taxCodeId);
          }
          setTaxModalOpen(false);
        }}
      />
    </div>
  );
}
