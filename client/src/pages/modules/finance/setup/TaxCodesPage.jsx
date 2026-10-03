/**
 * @fileoverview TaxCodesPage component.
 * Provides functionality for TaxCodesPage.
 */

import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Link } from "react-router-dom";

// Page ID constants (matching numeric IDs for storage in database)
const PAGE_IDS = {
  DIRECT_PURCHASE: 1,
  INVOICE: 2,
  PURCHASE_BILL_LOCAL: 3,
  PURCHASE_BILL_IMPORT: 4,
  LOCAL_PURCHASE_ORDER: 5,
  IMPORT_PURCHASE_ORDER: 6,
  MAINTENANCE_BILL: 7,
  SERVICE_BILL: 8,
  SALES_ORDER: 9,
  QUOTATION: 10,
  SUPPLIER_QUOTATION: 11,
  PAYMENT_VOUCHER: 12,
  RECEIPT_VOUCHER: 13,
  JOURNAL_VOUCHER: 14,
  DEBIT_NOTE: 16,
  CREDIT_NOTE: 17,
  SALES_VOUCHER: 18,
  SALES_RETURN: 19,
  PURCHASE_RETURN: 20,
  DELIVERY_NOTE: 21,
  TRANSPORT_EXPENSES: 22,
  TRANSPORT_INCOME: 23,
};

const ALL_PAGES = [
  {
    value: PAGE_IDS.DIRECT_PURCHASE,
    code: "DIRECT_PURCHASE",
    label: "Direct Purchase",
  },
  { value: PAGE_IDS.INVOICE, code: "INVOICE", label: "Invoice" },
  {
    value: PAGE_IDS.PURCHASE_BILL_LOCAL,
    code: "PURCHASE_BILL_LOCAL",
    label: "Purchase Bill Local",
  },
  {
    value: PAGE_IDS.PURCHASE_BILL_IMPORT,
    code: "PURCHASE_BILL_IMPORT",
    label: "Purchase Bill Import",
  },
  {
    value: PAGE_IDS.LOCAL_PURCHASE_ORDER,
    code: "LOCAL_PURCHASE_ORDER",
    label: "Local Purchase Orders",
  },
  {
    value: PAGE_IDS.IMPORT_PURCHASE_ORDER,
    code: "IMPORT_PURCHASE_ORDER",
    label: "Import Purchase Orders",
  },
  {
    value: PAGE_IDS.MAINTENANCE_BILL,
    code: "MAINTENANCE_BILL",
    label: "Maintenance Bill",
  },
  { value: PAGE_IDS.SERVICE_BILL, code: "SERVICE_BILL", label: "Service Bill" },
  { value: PAGE_IDS.SALES_ORDER, code: "SALES_ORDER", label: "Sales Order" },
  { value: PAGE_IDS.QUOTATION, code: "QUOTATION", label: "Quotation" },
  {
    value: PAGE_IDS.SUPPLIER_QUOTATION,
    code: "SUPPLIER_QUOTATION",
    label: "Supplier Quotation",
  },
  {
    value: PAGE_IDS.PAYMENT_VOUCHER,
    code: "PAYMENT_VOUCHER",
    label: "Payment Voucher",
  },
  {
    value: PAGE_IDS.RECEIPT_VOUCHER,
    code: "RECEIPT_VOUCHER",
    label: "Receipt Voucher",
  },
  {
    value: PAGE_IDS.JOURNAL_VOUCHER,
    code: "JOURNAL_VOUCHER",
    label: "Journal Voucher",
  },
  { value: PAGE_IDS.DEBIT_NOTE, code: "DEBIT_NOTE", label: "Debit Note" },
  { value: PAGE_IDS.CREDIT_NOTE, code: "CREDIT_NOTE", label: "Credit Note" },
  { value: PAGE_IDS.SALES_VOUCHER, code: "SALES_VOUCHER", label: "Sales Voucher" },
  { value: PAGE_IDS.SALES_RETURN, code: "SALES_RETURN", label: "Sales Return" },
  {
    value: PAGE_IDS.PURCHASE_RETURN,
    code: "PURCHASE_RETURN",
    label: "Purchase Return",
  },
  {
    value: PAGE_IDS.TRANSPORT_EXPENSES,
    code: "TRANSPORT_EXPENSES",
    label: "Transport Expenses & Logs",
  },
  {
    value: PAGE_IDS.TRANSPORT_INCOME,
    code: "TRANSPORT_INCOME",
    label: "Transportation Income",
  },
];

const SALES_PAGES = [
  PAGE_IDS.INVOICE,
  PAGE_IDS.SALES_ORDER,
  PAGE_IDS.QUOTATION,
  PAGE_IDS.SUPPLIER_QUOTATION,
  PAGE_IDS.SALES_VOUCHER,
  PAGE_IDS.SALES_RETURN,
  PAGE_IDS.DELIVERY_NOTE,
  PAGE_IDS.CREDIT_NOTE,
];
const PURCHASE_PAGES = [
  PAGE_IDS.DIRECT_PURCHASE,
  PAGE_IDS.PURCHASE_BILL_IMPORT,
  PAGE_IDS.PURCHASE_BILL_LOCAL,
  PAGE_IDS.LOCAL_PURCHASE_ORDER,
  PAGE_IDS.IMPORT_PURCHASE_ORDER,
  PAGE_IDS.PURCHASE_RETURN,
  PAGE_IDS.DEBIT_NOTE,
];
const SERVICE_PAGES = [PAGE_IDS.SERVICE_BILL, PAGE_IDS.MAINTENANCE_BILL];
const VOUCHER_PAGES = [
  PAGE_IDS.PAYMENT_VOUCHER,
  PAGE_IDS.RECEIPT_VOUCHER,
  PAGE_IDS.JOURNAL_VOUCHER,
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function TaxCodesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [ratePercent, setRatePercent] = useState("");
  const [type, setType] = useState("TAX");
  const [isActive, setIsActive] = useState(true);
  const [isSalesTax, setIsSalesTax] = useState(false);
  const [isPurchaseTax, setIsPurchaseTax] = useState(false);
  const [isServiceTax, setIsServiceTax] = useState(false);
  const [validPages, setValidPages] = useState([]);

  const [editing, setEditing] = useState({});
  const [selectedTaxId, setSelectedTaxId] = useState(null);
  const [selectedTax, setSelectedTax] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [components, setComponents] = useState([]);
  const [compName, setCompName] = useState("");
  const [compAccountId, setCompAccountId] = useState("");
  const [compRate, setCompRate] = useState("");
  const [compOrder, setCompOrder] = useState("");
  const [compCompoundLevels, setCompCompoundLevels] = useState(["0"]);
  const [compActive, setCompActive] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTaxId, setEditingTaxId] = useState(null);

  const STEP_OPTIONS = [
    { value: "0", label: "Step 1 (Base)" },
    { value: "1", label: "Step 2" },
    { value: "2", label: "Step 3" },
    { value: "3", label: "Step 4" },
  ];

  function normalizeStepLevels(values) {
    const arr = Array.isArray(values) ? values : [];
    const clean = Array.from(
      new Set(
        arr
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n) && n >= 0 && n <= 9),
      ),
    ).sort((a, b) => a - b);
    return clean.length ? clean.map(String) : ["0"];
  }

  function stepLabel(level) {
    const n = Number(level);
    if (!Number.isFinite(n) || n < 0) return "Step 1 (Base)";
    if (n === 0) return "Step 1 (Base)";
    return `Step ${n + 1}`;
  }

  function toggleStep(values, step, checked) {
    const current = normalizeStepLevels(values);
    const exists = current.includes(String(step));
    if (checked && !exists)
      return normalizeStepLevels([...current, String(step)]);
    if (!checked && exists)
      return normalizeStepLevels(current.filter((s) => s !== String(step)));
    return current;
  }

  async function load() {
    try {
      setLoading(true);
      const [taxesRes, accountsRes] = await Promise.all([
        api.get("/finance/tax-codes", {
          params: { _t: Date.now() },
          __skipWarmCache: true,
        }),
        api.get("/finance/accounts", {
          params: { postable: 1, active: 1, _t: Date.now() },
          __skipWarmCache: true,
        }),
      ]);
      setItems(taxesRes.data?.items || []);
      setAccounts(
        Array.isArray(accountsRes.data?.items) ? accountsRes.data.items : [],
      );
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to load tax codes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function loadComponents(taxId) {
    try {
      const res = await api.get(`/finance/tax-codes/${taxId}/components`);
      const items = res.data?.items || [];
      setComponents(items);
      setCompOrder(String(items.length + 1));
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Failed to load tax components",
      );
    }
  }

  function showComponents(r) {
    setSelectedTaxId(r.id);
    setSelectedTax(r);
    setCompName("");
    setCompAccountId("");
    setCompRate("");
    setCompOrder("1");
    setCompCompoundLevels(["0"]);
    setCompActive(true);
    loadComponents(r.id);
  }

  async function addComponent(e) {
    e.preventDefault();
    if (!selectedTaxId) return;
    try {
      const parsedOrder =
        compOrder &&
        !isNaN(Number(compOrder)) &&
        Number(compOrder) > 0 &&
        Number(compOrder) < 100
          ? Number(compOrder)
          : components.length + 1;

      await api.post(`/finance/tax-codes/${selectedTaxId}/components`, {
        componentName: compName.trim(),
        accountId: compAccountId ? Number(compAccountId) : null,
        ratePercent: compRate ? Number(compRate) : 0,
        sortOrder: parsedOrder,
        compoundLevel: Number(normalizeStepLevels(compCompoundLevels)[0]),
        compoundLevels: normalizeStepLevels(compCompoundLevels).map(Number),
        isActive: compActive,
      });
      toast.success(
        "Component added (account auto-created under Tax Payables)",
      );
      setCompName("");
      setCompAccountId("");
      setCompRate("");
      setCompOrder(String(components.length + 2));
      setCompCompoundLevels(["0"]);
      setCompActive(true);
      loadComponents(selectedTaxId);
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to add tax component");
    }
  }

  const [compEditing, setCompEditing] = useState({});

  function compStartEdit(c) {
    const defaultIdx = components.findIndex((item) => item.id === c.id) + 1;
    const safeSortOrder =
      c.sort_order && Number(c.sort_order) < 100 ? c.sort_order : defaultIdx;
    setCompEditing((p) => ({
      ...p,
      [c.id]: {
        component_name: c.component_name,
        account_id: c.account_id || "",
        rate_percent: c.rate_percent,
        sort_order: safeSortOrder,
        compound_level: c.compound_level,
        compound_levels: normalizeStepLevels(
          Array.isArray(c.calculate_on_levels)
            ? c.calculate_on_levels
            : c.compound_level !== undefined && c.compound_level !== null
              ? [c.compound_level]
              : [],
        ),
        is_active: c.is_active,
      },
    }));
  }

  function compUpdateEdit(id, field, value) {
    setCompEditing((p) => ({
      ...p,
      [id]: { ...(p[id] || {}), [field]: value },
    }));
  }

  async function compSaveEdit(id) {
    const data = compEditing[id];
    if (!data) return;
    try {
      await api.put(`/finance/tax-components/${id}`, {
        componentName: data.component_name,
        accountId: data.account_id ? Number(data.account_id) : null,
        ratePercent:
          data.rate_percent === "" || data.rate_percent === null
            ? undefined
            : Number(data.rate_percent),
        sortOrder:
          data.sort_order === "" || data.sort_order === null
            ? undefined
            : Number(data.sort_order),
        compoundLevel:
          data.compound_level === "" || data.compound_level === null
            ? undefined
            : Number(data.compound_level),
        compoundLevels: normalizeStepLevels(
          data.compound_levels ??
            (data.compound_level !== undefined && data.compound_level !== null
              ? [data.compound_level]
              : []),
        ).map(Number),
        isActive: data.is_active,
      });
      toast.success("Component updated");
      setCompEditing((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      loadComponents(selectedTaxId);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update component");
    }
  }

  async function compDisable(id) {
    if (!window.confirm("Disable this component?")) return;
    try {
      await api.delete(`/finance/tax-components/${id}`);
      toast.success("Component disabled");
      setCompEditing((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      loadComponents(selectedTaxId);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to disable component");
    }
  }

  function togglePage(page) {
    setValidPages((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page],
    );
  }

  function handleCreateScopeChange(scope, checked) {
    if (scope === "SALES") {
      setIsSalesTax(checked);
      setValidPages((prev) =>
        checked
          ? Array.from(new Set([...prev, ...SALES_PAGES, PAGE_IDS.RECEIPT_VOUCHER]))
          : prev.filter((p) => !SALES_PAGES.includes(p) && p !== PAGE_IDS.RECEIPT_VOUCHER),
      );
    } else if (scope === "PURCHASE") {
      setIsPurchaseTax(checked);
      setValidPages((prev) =>
        checked
          ? Array.from(new Set([...prev, ...PURCHASE_PAGES, PAGE_IDS.PAYMENT_VOUCHER]))
          : prev.filter((p) => !PURCHASE_PAGES.includes(p) && p !== PAGE_IDS.PAYMENT_VOUCHER),
      );
    } else if (scope === "SERVICE") {
      setIsServiceTax(checked);
      setValidPages((prev) =>
        checked
          ? Array.from(new Set([...prev, ...SERVICE_PAGES]))
          : prev.filter((p) => !SERVICE_PAGES.includes(p)),
      );
    }
  }

  function handleEditScopeChange(id, scopeField, checked) {
    setEditing((p) => {
      const draft = p[id] || {};
      let updatedPages = draft.valid_pages || [];

      const scopePages =
        scopeField === "is_sales_tax"
          ? SALES_PAGES
          : scopeField === "is_purchase_tax"
            ? PURCHASE_PAGES
            : SERVICE_PAGES;

      if (checked) {
        updatedPages = Array.from(new Set([...updatedPages, ...scopePages]));
        // Add corresponding voucher pages
        if (scopeField === "is_sales_tax") {
          updatedPages = Array.from(new Set([...updatedPages, PAGE_IDS.RECEIPT_VOUCHER]));
        } else if (scopeField === "is_purchase_tax") {
          updatedPages = Array.from(new Set([...updatedPages, PAGE_IDS.PAYMENT_VOUCHER]));
        }
      } else {
        updatedPages = updatedPages.filter((pg) => !scopePages.includes(pg));
        // Remove corresponding voucher pages
        if (scopeField === "is_sales_tax") {
          updatedPages = updatedPages.filter((pg) => pg !== PAGE_IDS.RECEIPT_VOUCHER);
        } else if (scopeField === "is_purchase_tax") {
          updatedPages = updatedPages.filter((pg) => pg !== PAGE_IDS.PAYMENT_VOUCHER);
        }
      }

      return {
        ...p,
        [id]: { ...draft, [scopeField]: checked, valid_pages: updatedPages },
      };
    });
  }

  async function create(e) {
    e.preventDefault();
    try {
      await api.post("/finance/tax-codes", {
        code: code.trim(),
        name: name.trim(),
        ratePercent: ratePercent ? Number(ratePercent) : 0,
        type,
        isActive,
        isSalesTax,
        isPurchaseTax,
        isServiceTax,
        validPages,
      });
      toast.success("Tax code created");
      setCode("");
      setName("");
      setRatePercent("");
      setType("TAX");
      setIsActive(true);
      setIsSalesTax(false);
      setIsPurchaseTax(false);
      setIsServiceTax(false);
      setValidPages([]);
      setShowCreateModal(false);
      await load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to create tax code");
    }
  }

  function startEdit(r) {
    // Parse valid_pages and convert old page codes to new page IDs
    let parsedPages = [];
    if (typeof r.valid_pages === "string" && r.valid_pages.trim() !== "") {
      parsedPages = r.valid_pages
        .split(",")
        .map((s) => {
          const trimmed = s.trim();
          // If it's a numeric string, convert to number
          if (/^\d+$/.test(trimmed)) {
            return Number(trimmed);
          }
          // If it's a page code, look up the ID
          const pageObj = ALL_PAGES.find((p) => p.code === trimmed);
          return pageObj ? pageObj.value : null;
        })
        .filter((v) => v !== null);
    } else if (Array.isArray(r.valid_pages)) {
      parsedPages = r.valid_pages
        .map((v) => {
          if (typeof v === "number") return v;
          const pageObj = ALL_PAGES.find((p) => p.code === v);
          return pageObj ? pageObj.value : null;
        })
        .filter((v) => v !== null);
    }
    setEditing((p) => ({
      ...p,
      [r.id]: {
        name: r.name,
        rate_percent: r.rate_percent,
        type: r.type,
        is_active: r.is_active,
        is_sales_tax: !!r.is_sales_tax,
        is_purchase_tax: !!r.is_purchase_tax,
        is_service_tax: !!r.is_service_tax,
        valid_pages: parsedPages,
      },
    }));
    setEditingTaxId(r.id);
    setShowEditModal(true);
  }

  function updateEdit(id, field, value) {
    setEditing((p) => ({
      ...p,
      [id]: { ...(p[id] || {}), [field]: value },
    }));
  }

  function toggleEditPage(id, page) {
    setEditing((p) => {
      const current = p[id]?.valid_pages || [];
      const updated = current.includes(page)
        ? current.filter((pg) => pg !== page)
        : [...current, page];
      return { ...p, [id]: { ...(p[id] || {}), valid_pages: updated } };
    });
  }

  async function saveEdit(id) {
    const data = editing[id];
    if (!data) return;
    try {
      await api.put(`/finance/tax-codes/${id}`, {
        name: data.name,
        ratePercent:
          data.rate_percent === "" || data.rate_percent === null
            ? undefined
            : Number(data.rate_percent),
        type: data.type,
        isActive: data.is_active,
        isSalesTax: data.is_sales_tax,
        isPurchaseTax: data.is_purchase_tax,
        isServiceTax: data.is_service_tax,
        validPages: data.valid_pages,
      });
      toast.success("Tax code updated");
      setEditing((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      setShowEditModal(false);
      setEditingTaxId(null);
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to update tax code");
    }
  }

  function cancelEdit(id) {
    setEditing((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
    setShowEditModal(false);
    setEditingTaxId(null);
  }

  async function toggleActive(r) {
    try {
      await api.put(`/finance/tax-codes/${r.id}`, {
        isActive: !r.is_active,
      });
      load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to toggle status");
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="card shadow-md">
        <div className="card-header bg-brand text-white rounded-t-lg p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors mb-2"
              >
                ← Back to Accounting Setup
              </button>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Tax Codes & Deductions Setup
              </h1>
              <p className="text-sm mt-0.5 opacity-90">
                Configure tax codes, compound rates, component splits & module applicability
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-success text-xs px-3.5 py-2 flex items-center gap-1.5 font-bold"
                onClick={() => setShowCreateModal(true)}
              >
                + Create Tax Code
              </button>
              <button
                type="button"
                className="px-3.5 py-2 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-1.5"
                onClick={load}
                disabled={loading}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ───── Create New Tax Code (Modal) ───── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl relative">
            <div className="flex items-center justify-between border-b px-6 py-4 bg-brand text-white rounded-t-lg">
              <h2 className="text-lg font-semibold text-white">
                Create Tax Code
              </h2>
              <button
                className="text-white hover:text-slate-200 text-3xl font-bold leading-none cursor-pointer"
                onClick={() => setShowCreateModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={create} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4">
                    <label className="label">Code *</label>
                    <input
                      className="input w-full font-mono uppercase"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="e.g. VAT-15"
                      required
                    />
                  </div>
                  <div className="md:col-span-8">
                    <label className="label">Name *</label>
                    <input
                      className="input w-full"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Value Added Tax 15%"
                      required
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="label">Type *</label>
                    <select
                      className="input w-full"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      required
                    >
                      <option value="TAX">Tax</option>
                      <option value="DEDUCTION">Deduction</option>
                    </select>
                  </div>
                  <div className="md:col-span-4">
                    <label className="label">Rate (%)</label>
                    <input
                      className="input w-full font-mono"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={ratePercent}
                      onChange={(e) => setRatePercent(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-4 flex items-end">
                    <label className="inline-flex items-center gap-2 h-[38px] px-3.5 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 w-full transition-colors">
                      <input
                        type="checkbox"
                        className="rounded text-brand focus:ring-brand"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Active Status</span>
                    </label>
                  </div>
                </div>

                {/* Tax Scope */}
                <div>
                  <label className="label mb-1.5">Tax Scope</label>
                  <div className="flex gap-4 flex-wrap p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        className="rounded text-brand focus:ring-brand"
                        checked={isSalesTax}
                        onChange={(e) =>
                          handleCreateScopeChange("SALES", e.target.checked)
                        }
                      />
                      Sales Tax
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        className="rounded text-brand focus:ring-brand"
                        checked={isPurchaseTax}
                        onChange={(e) =>
                          handleCreateScopeChange("PURCHASE", e.target.checked)
                        }
                      />
                      Purchase Tax
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        className="rounded text-brand focus:ring-brand"
                        checked={isServiceTax}
                        onChange={(e) =>
                          handleCreateScopeChange("SERVICE", e.target.checked)
                        }
                      />
                      Service Tax
                    </label>
                  </div>
                </div>

                {/* Valid Pages */}
                <div>
                  <label className="label mb-1">Applicable Pages</label>
                  <p className="text-xs text-slate-500 mb-2">
                    Select which pages/forms this tax code can be used on. If no
                    pages are selected, the tax code will not be displayed in
                    any transaction forms.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 max-h-56 overflow-y-auto">
                    {ALL_PAGES.map((pg) => (
                      <label
                        key={pg.value}
                        className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="rounded text-brand focus:ring-brand"
                          checked={validPages.includes(pg.value)}
                          onChange={() => togglePage(pg.value)}
                        />
                        <span className="truncate">{pg.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary text-xs px-4 py-2 cursor-pointer"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-success text-xs px-4 py-2 font-semibold cursor-pointer shadow-sm">
                    Create Tax Code
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ───── Tax Code List ───── */}
      <div className="card shadow-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table w-full min-w-[960px]">
              <colgroup>
                <col style={{ width: "12%" }} />
                <col style={{ width: "25%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4 text-left">Code</th>
                  <th className="py-3 px-4 text-left">Name</th>
                  <th className="py-3 px-4 text-left">Type</th>
                  <th className="py-3 px-4 text-left">Rate (%)</th>
                  <th className="py-3 px-4 text-left">Scope</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-medium">Loading tax codes...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="text-base font-semibold text-slate-600 dark:text-slate-300">
                          No tax codes or deductions found
                        </span>
                        <span className="text-xs text-slate-400">
                          Click &quot;+ Create Tax Code&quot; above to add your first tax or deduction.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-brand dark:text-brand-300">
                        {r.code}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-100">
                        {r.name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            r.type === "TAX"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                              : "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                          }`}
                        >
                          {r.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">
                        {Number(r.rate_percent || 0).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1.5 flex-wrap items-center">
                          {r.is_sales_tax ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Sales
                            </span>
                          ) : null}
                          {r.is_purchase_tax ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Purchase
                            </span>
                          ) : null}
                          {r.is_service_tax ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                              Service
                            </span>
                          ) : null}
                          {!r.is_sales_tax &&
                            !r.is_purchase_tax &&
                            !r.is_service_tax && (
                              <span className="text-xs text-slate-400">
                                —
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {r.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            className="px-2.5 py-1 text-xs font-medium rounded border border-brand text-brand hover:bg-brand hover:text-white transition-colors cursor-pointer shadow-sm"
                            onClick={() => showComponents(r)}
                          >
                            Components
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary text-xs px-2.5 py-1 cursor-pointer"
                            onClick={() => startEdit(r)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer ${
                              r.is_active
                                ? "border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/30"
                                : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
                            }`}
                            onClick={() => toggleActive(r)}
                          >
                            {r.is_active ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ───── Components Section (Modal) ───── */}
      {selectedTaxId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl relative shadow-2xl scale-100 transition-transform">
            <div className="flex justify-between items-center border-b px-6 py-4 bg-brand text-white rounded-t-lg shadow-sm">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Components for {selectedTax?.code} - {selectedTax?.name}
                </h2>
                <p className="text-sm opacity-90 text-white mt-1">
                  Define composite taxes/deductions. Each component auto-creates
                  a ledger account under "Tax Payables".
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 rounded bg-white text-brand hover:bg-slate-100 font-semibold shadow-sm transition-colors"
                  onClick={() => loadComponents(selectedTaxId)}
                >
                  Refresh
                </button>
                <button
                  className="px-3 py-1.5 rounded bg-white text-brand hover:bg-slate-100 font-semibold shadow-sm transition-colors"
                  onClick={() => setSelectedTaxId(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <form
                onSubmit={addComponent}
                className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Add New Component
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3.5">
                  <div className="md:col-span-4">
                    <label className="label text-xs">Component Name *</label>
                    <input
                      className="input w-full text-sm"
                      placeholder="e.g. NHIL or GETFund"
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="label text-xs">Ledger Account</label>
                    <select
                      className="input w-full text-xs"
                      value={compAccountId}
                      onChange={(e) => setCompAccountId(e.target.value)}
                    >
                      <option value="">Auto-Resolve (Recommended)</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1 md:col-span-2">
                    <label className="label text-xs">Rate (%)</label>
                    <input
                      className="input w-full text-sm font-mono"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={compRate}
                      onChange={(e) => setCompRate(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-1 md:col-span-2">
                    <label className="label text-xs">Sort Order</label>
                    <input
                      className="input w-full text-sm font-mono"
                      type="number"
                      min="1"
                      placeholder={String(components.length + 1)}
                      value={compOrder}
                      onChange={(e) => setCompOrder(e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-7">
                    <label className="label text-xs">Calculate On</label>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 flex flex-wrap gap-4 min-h-[38px] items-center">
                      {STEP_OPTIONS.map((s) => (
                        <label
                          key={s.value}
                          className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          <input
                            type="checkbox"
                            className="rounded text-brand focus:ring-brand"
                            checked={normalizeStepLevels(
                              compCompoundLevels,
                            ).includes(s.value)}
                            onChange={(e) =>
                              setCompCompoundLevels(
                                toggleStep(
                                  compCompoundLevels,
                                  s.value,
                                  e.target.checked,
                                ),
                              )
                            }
                          />
                          <span>{s.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-1 md:col-span-2 flex items-end">
                    <label className="inline-flex items-center gap-2 h-[38px] px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 w-full transition-colors">
                      <input
                        type="checkbox"
                        className="rounded text-brand focus:ring-brand"
                        checked={compActive}
                        onChange={(e) => setCompActive(e.target.checked)}
                      />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Active</span>
                    </label>
                  </div>

                  <div className="sm:col-span-1 md:col-span-3 flex items-end">
                    <button
                      type="submit"
                      className="btn-success w-full h-[38px] text-xs font-semibold flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                    >
                      + Add Component
                    </button>
                  </div>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="table w-full min-w-[880px]">
                  <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "24%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "10%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider font-semibold">
                      <th className="py-3 px-3 text-left">Component</th>
                      <th className="py-3 px-3 text-left">Account Mapping</th>
                      <th className="py-3 px-3 text-left">Rate (%)</th>
                      <th className="py-3 px-3 text-left">Calculate On</th>
                      <th className="py-3 px-3 text-left">Sort</th>
                      <th className="py-3 px-3 text-left">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {components.map((c, index) => {
                      const isEdit = !!compEditing[c.id];
                      const d = compEditing[c.id] || {};
                      const acc = accounts.find(
                        (a) => String(a.id) === String(c.account_id),
                      );
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-100">
                            {isEdit ? (
                              <input
                                className="input w-full text-xs"
                                value={
                                  d.component_name === undefined
                                    ? c.component_name
                                    : d.component_name
                                }
                                onChange={(e) =>
                                  compUpdateEdit(
                                    c.id,
                                    "component_name",
                                    e.target.value,
                                  )
                                }
                              />
                            ) : (
                              c.component_name
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {isEdit ? (
                              <select
                                className="input w-full text-xs"
                                value={
                                  d.account_id === undefined
                                    ? c.account_id || ""
                                    : d.account_id
                                }
                                onChange={(e) =>
                                  compUpdateEdit(
                                    c.id,
                                    "account_id",
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="">Auto-Resolve</option>
                                {accounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} - {a.name}
                                  </option>
                                ))}
                              </select>
                            ) : acc ? (
                              <span className="text-xs text-slate-700 dark:text-slate-300">
                                {acc.code} - {acc.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-xs">
                                Auto-Resolve
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {isEdit ? (
                              <input
                                className="input w-full text-xs font-mono"
                                type="number"
                                step="0.01"
                                min="0"
                                value={
                                  d.rate_percent === undefined
                                    ? c.rate_percent
                                    : d.rate_percent
                                }
                                onChange={(e) =>
                                  compUpdateEdit(
                                    c.id,
                                    "rate_percent",
                                    e.target.value,
                                  )
                                }
                              />
                            ) : (
                              `${Number(c.rate_percent || 0).toFixed(2)}%`
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {isEdit ? (
                              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-1 bg-white dark:bg-slate-800 text-xs">
                                {STEP_OPTIONS.map((s) => {
                                  const currentLevels = normalizeStepLevels(
                                    d.compound_levels ??
                                      (Array.isArray(c.calculate_on_levels)
                                        ? c.calculate_on_levels
                                        : c.compound_level !== undefined &&
                                            c.compound_level !== null
                                          ? [c.compound_level]
                                          : []),
                                  );
                                  return (
                                    <label
                                      key={s.value}
                                      className="inline-flex items-center gap-1.5 mr-3 cursor-pointer text-xs"
                                    >
                                      <input
                                        type="checkbox"
                                        className="rounded text-brand focus:ring-brand"
                                        checked={currentLevels.includes(
                                          s.value,
                                        )}
                                        onChange={(e) =>
                                          compUpdateEdit(
                                            c.id,
                                            "compound_levels",
                                            toggleStep(
                                              currentLevels,
                                              s.value,
                                              e.target.checked,
                                            ),
                                          )
                                        }
                                      />
                                      <span>{s.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                {normalizeStepLevels(
                                  Array.isArray(c.calculate_on_levels)
                                    ? c.calculate_on_levels
                                    : c.compound_level !== undefined &&
                                        c.compound_level !== null
                                      ? [c.compound_level]
                                      : [],
                                )
                                  .map(stepLabel)
                                  .join(", ") || "—"}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs">
                            {isEdit ? (
                              <input
                                className="input w-full text-xs font-mono"
                                type="number"
                                min="1"
                                value={
                                  d.sort_order === undefined
                                    ? c.sort_order && Number(c.sort_order) < 100
                                      ? c.sort_order
                                      : index + 1
                                    : d.sort_order
                                }
                                onChange={(e) =>
                                  compUpdateEdit(
                                    c.id,
                                    "sort_order",
                                    e.target.value,
                                  )
                                }
                              />
                            ) : (
                              c.sort_order && Number(c.sort_order) < 100
                                ? c.sort_order
                                : index + 1
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {isEdit ? (
                              <select
                                className="input w-full text-xs"
                                value={(d.is_active ? 1 : 0).toString()}
                                onChange={(e) =>
                                  compUpdateEdit(
                                    c.id,
                                    "is_active",
                                    e.target.value === "1",
                                  )
                                }
                              >
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                              </select>
                            ) : c.is_active ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {!isEdit ? (
                              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  className="btn btn-secondary text-xs px-2.5 py-1 cursor-pointer"
                                  onClick={() => compStartEdit(c)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="text-xs px-2.5 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                  onClick={() => compDisable(c.id)}
                                >
                                  Disable
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  className="btn-success text-xs px-2.5 py-1 cursor-pointer font-semibold shadow-sm"
                                  onClick={() => compSaveEdit(c.id)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary text-xs px-2.5 py-1 cursor-pointer"
                                  onClick={() =>
                                    setCompEditing((p) => {
                                      const n = { ...p };
                                      delete n[c.id];
                                      return n;
                                    })
                                  }
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {components.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center py-8 text-slate-500"
                        >
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                              No components defined for this tax code yet.
                            </span>
                            <span className="text-xs text-slate-400">
                              Use the form above to add composite breakdown components (e.g. NHIL, GETFund, COVID Levy).
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───── Edit Tax Code (Modal) ───── */}
      {showEditModal && editingTaxId && editing[editingTaxId] && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl relative">
            <div className="flex items-center justify-between border-b px-6 py-4 bg-brand text-white rounded-t-lg">
              <h2 className="text-lg font-semibold text-white">
                Edit Tax Code
              </h2>
              <button
                className="text-white hover:text-slate-200 text-3xl font-bold leading-none cursor-pointer"
                onClick={() => cancelEdit(editingTaxId)}
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4">
                  <label className="label">Code</label>
                  <input
                    className="input w-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono"
                    value={items.find((i) => i.id === editingTaxId)?.code || ""}
                    disabled
                  />
                </div>
                <div className="md:col-span-8">
                  <label className="label">Name *</label>
                  <input
                    className="input w-full"
                    value={editing[editingTaxId]?.name ?? ""}
                    onChange={(e) =>
                      updateEdit(editingTaxId, "name", e.target.value)
                    }
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="label">Type *</label>
                  <select
                    className="input w-full"
                    value={editing[editingTaxId]?.type ?? "TAX"}
                    onChange={(e) =>
                      updateEdit(editingTaxId, "type", e.target.value)
                    }
                  >
                    <option value="TAX">Tax</option>
                    <option value="DEDUCTION">Deduction</option>
                  </select>
                </div>
                <div className="md:col-span-4">
                  <label className="label">Rate (%)</label>
                  <input
                    className="input w-full font-mono"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editing[editingTaxId]?.rate_percent ?? ""}
                    onChange={(e) =>
                      updateEdit(editingTaxId, "rate_percent", e.target.value)
                    }
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="label">Status</label>
                  <select
                    className="input w-full"
                    value={(editing[editingTaxId]?.is_active
                      ? 1
                      : 0
                    ).toString()}
                    onChange={(e) =>
                      updateEdit(
                        editingTaxId,
                        "is_active",
                        e.target.value === "1",
                      )
                    }
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label mb-1.5">Tax Scope</label>
                <div className="flex gap-4 flex-wrap p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      className="rounded text-brand focus:ring-brand"
                      checked={!!editing[editingTaxId]?.is_sales_tax}
                      onChange={(e) =>
                        handleEditScopeChange(
                          editingTaxId,
                          "is_sales_tax",
                          e.target.checked,
                        )
                      }
                    />
                    Sales Tax
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      className="rounded text-brand focus:ring-brand"
                      checked={!!editing[editingTaxId]?.is_purchase_tax}
                      onChange={(e) =>
                        handleEditScopeChange(
                          editingTaxId,
                          "is_purchase_tax",
                          e.target.checked,
                        )
                      }
                    />
                    Purchase Tax
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      className="rounded text-brand focus:ring-brand"
                      checked={!!editing[editingTaxId]?.is_service_tax}
                      onChange={(e) =>
                        handleEditScopeChange(
                          editingTaxId,
                          "is_service_tax",
                          e.target.checked,
                        )
                      }
                    />
                    Service Tax
                  </label>
                </div>
              </div>

              <div>
                <label className="label mb-1">Applicable Pages</label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 max-h-56 overflow-y-auto">
                  {ALL_PAGES.map((pg) => (
                    <label
                      key={pg.value}
                      className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="rounded text-brand focus:ring-brand"
                        checked={(
                          editing[editingTaxId]?.valid_pages || []
                        ).includes(pg.value)}
                        onChange={() => toggleEditPage(editingTaxId, pg.value)}
                      />
                      <span className="truncate">{pg.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-secondary text-xs px-4 py-2 cursor-pointer"
                  onClick={() => cancelEdit(editingTaxId)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-success text-xs px-4 py-2 font-semibold cursor-pointer shadow-sm"
                  onClick={() => saveEdit(editingTaxId)}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
