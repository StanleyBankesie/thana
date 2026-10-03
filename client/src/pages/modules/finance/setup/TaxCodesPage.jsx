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
      setComponents(res.data?.items || []);
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
    setCompOrder("");
    setCompCompoundLevels(["0"]);
    setCompActive(true);
    loadComponents(r.id);
  }

  async function addComponent(e) {
    e.preventDefault();
    if (!selectedTaxId) return;
    try {
      await api.post(`/finance/tax-codes/${selectedTaxId}/components`, {
        componentName: compName.trim(),
        accountId: compAccountId ? Number(compAccountId) : null,
        ratePercent: compRate ? Number(compRate) : 0,
        sortOrder: compOrder ? Number(compOrder) : 100,
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
      setCompOrder("");
      setCompCompoundLevels(["0"]);
      setCompActive(true);
      loadComponents(selectedTaxId);
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Failed to add tax component");
    }
  }

  const [compEditing, setCompEditing] = useState({});

  function compStartEdit(c) {
    setCompEditing((p) => ({
      ...p,
      [c.id]: {
        component_name: c.component_name,
        account_id: c.account_id || "",
        rate_percent: c.rate_percent,
        sort_order: c.sort_order,
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
              <form onSubmit={create} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div>
                    <label className="label">Code *</label>
                    <input
                      className="input w-full"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Name *</label>
                    <input
                      className="input w-full"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Rate (%)</label>
                    <input
                      className="input w-full"
                      type="number"
                      step="0.01"
                      min="0"
                      value={ratePercent}
                      onChange={(e) => setRatePercent(e.target.value)}
                    />
                  </div>
                  <div>
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
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      Active
                    </label>
                  </div>
                </div>

                {/* Tax Scope */}
                <div>
                  <label className="label mb-1">Tax Scope</label>
                  <div className="flex gap-6 flex-wrap">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSalesTax}
                        onChange={(e) =>
                          handleCreateScopeChange("SALES", e.target.checked)
                        }
                      />
                      Sales Tax
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isPurchaseTax}
                        onChange={(e) =>
                          handleCreateScopeChange("PURCHASE", e.target.checked)
                        }
                      />
                      Purchase Tax
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {ALL_PAGES.map((pg) => (
                      <label
                        key={pg.value}
                        className="inline-flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={validPages.includes(pg.value)}
                          onChange={() => togglePage(pg.value)}
                        />
                        {pg.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="pt-2">
                  <button className="btn btn-success shadow-sm">
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
            <table className="table w-full table-fixed">
              <colgroup>
                <col style={{ width: "14.285%" }} />
                <col style={{ width: "14.285%" }} />
                <col style={{ width: "14.285%" }} />
                <col style={{ width: "14.285%" }} />
                <col style={{ width: "14.285%" }} />
                <col style={{ width: "14.285%" }} />
                <col style={{ width: "14.285%" }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 text-left">Code</th>
                  <th className="py-3 px-4 text-left">Name</th>
                  <th className="py-3 px-4 text-left">Type</th>
                  <th className="py-3 px-4 text-left">Rate (%)</th>
                  <th className="py-3 px-4 text-left">Scope</th>
                  <th className="py-3 px-4 text-left">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
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
                  items.map((r) => {
                  const isRowEditing = false;
                  const draft = editing[r.id] || {};
                  return (
                    <React.Fragment key={r.id}>
                      <tr>
                        <td className="font-medium">{r.code}</td>
                        <td>
                          {isRowEditing ? (
                            <input
                              className="input"
                              value={draft.name ?? ""}
                              onChange={(e) =>
                                updateEdit(r.id, "name", e.target.value)
                              }
                            />
                          ) : (
                            r.name
                          )}
                        </td>
                        <td>
                          {isRowEditing ? (
                            <select
                              className="input"
                              value={draft.type ?? "TAX"}
                              onChange={(e) =>
                                updateEdit(r.id, "type", e.target.value)
                              }
                            >
                              <option value="TAX">Tax</option>
                              <option value="DEDUCTION">Deduction</option>
                            </select>
                          ) : (
                            r.type
                          )}
                        </td>
                        <td>
                          {isRowEditing ? (
                            <input
                              className="input"
                              type="number"
                              step="0.01"
                              min="0"
                              value={
                                draft.rate_percent === undefined
                                  ? r.rate_percent
                                  : draft.rate_percent
                              }
                              onChange={(e) =>
                                updateEdit(r.id, "rate_percent", e.target.value)
                              }
                            />
                          ) : (
                            Number(r.rate_percent || 0).toFixed(2)
                          )}
                        </td>
                        <td>
                          {isRowEditing ? (
                            <div className="flex flex-col gap-1 text-xs">
                              <label className="inline-flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={!!draft.is_sales_tax}
                                  onChange={(e) =>
                                    handleEditScopeChange(
                                      r.id,
                                      "is_sales_tax",
                                      e.target.checked,
                                    )
                                  }
                                />
                                Sales
                              </label>
                              <label className="inline-flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={!!draft.is_purchase_tax}
                                  onChange={(e) =>
                                    handleEditScopeChange(
                                      r.id,
                                      "is_purchase_tax",
                                      e.target.checked,
                                    )
                                  }
                                />
                                Purchase
                              </label>
                              <label className="inline-flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={!!draft.is_service_tax}
                                  onChange={(e) =>
                                    handleEditScopeChange(
                                      r.id,
                                      "is_service_tax",
                                      e.target.checked,
                                    )
                                  }
                                />
                                Service
                              </label>
                            </div>
                          ) : (
                            <div className="flex gap-1 flex-wrap">
                              {r.is_sales_tax ? (
                                <span className="badge badge-success text-xs">
                                  Sales
                                </span>
                              ) : null}
                              {r.is_purchase_tax ? (
                                <span className="badge badge-success text-xs">
                                  Purchase
                                </span>
                              ) : null}
                              {r.is_service_tax ? (
                                <span className="badge badge-success text-xs">
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
                          )}
                        </td>
                        <td>
                          {isRowEditing ? (
                            <select
                              className="input"
                              value={(draft.is_active ? 1 : 0).toString()}
                              onChange={(e) =>
                                updateEdit(
                                  r.id,
                                  "is_active",
                                  e.target.value === "1",
                                )
                              }
                            >
                              <option value="1">Active</option>
                              <option value="0">Inactive</option>
                            </select>
                          ) : r.is_active ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-error">Inactive</span>
                          )}
                        </td>
                        <td className="text-right">
                          {!isRowEditing ? (
                            <div className="flex justify-end gap-2">
                              <button
                                className="btn border border-brand text-brand hover:bg-brand hover:text-white transition-colors shadow-sm"
                                onClick={() => showComponents(r)}
                              >
                                Components
                              </button>
                              <button
                                className="btn"
                                onClick={() => startEdit(r)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn"
                                onClick={() => toggleActive(r)}
                              >
                                {r.is_active ? "Disable" : "Enable"}
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                className="btn-success"
                                onClick={() => saveEdit(r.id)}
                              >
                                Save
                              </button>
                              <button
                                className="btn"
                                onClick={() => cancelEdit(r.id)}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {/* Inline Valid Pages editing row */}
                      {isRowEditing && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50 px-6 py-3">
                            <label className="label mb-1 text-xs font-semibold">
                              Applicable Pages
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {ALL_PAGES.map((pg) => (
                                <label
                                  key={pg.value}
                                  className="inline-flex items-center gap-2 text-xs"
                                >
                                  <input
                                    type="checkbox"
                                    checked={(draft.valid_pages || []).includes(
                                      pg.value,
                                    )}
                                    onChange={() =>
                                      toggleEditPage(r.id, pg.value)
                                    }
                                  />
                                  {pg.label}
                                </label>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* Valid pages badges row removed per request */}
                    </React.Fragment>
                  );
                })
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
                className="grid grid-cols-1 md:grid-cols-10 gap-3"
              >
                <div className="md:col-span-3">
                  <label className="label">Component Name *</label>
                  <input
                    className="input w-full"
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Ledger Account</label>
                  <select
                    className="input text-xs"
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
                <div className="md:col-span-1">
                  <label className="label">Rate (%)</label>
                  <input
                    className="input w-full"
                    type="number"
                    step="0.01"
                    min="0"
                    value={compRate}
                    onChange={(e) => setCompRate(e.target.value)}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="label">Sort Order</label>
                  <input
                    className="input w-full"
                    type="number"
                    min="1"
                    value={compOrder}
                    onChange={(e) => setCompOrder(e.target.value)}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="label">Calculate On</label>
                  <div className="border rounded px-3 py-2 space-y-1">
                    {STEP_OPTIONS.map((s) => (
                      <label
                        key={s.value}
                        className="inline-flex items-center gap-2 mr-4"
                      >
                        <input
                          type="checkbox"
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
                        <span className="text-sm">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-end md:col-span-1">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={compActive}
                      onChange={(e) => setCompActive(e.target.checked)}
                    />
                    Active
                  </label>
                </div>
                <div className="flex items-end md:col-span-2">
                  <button className="btn-success w-full">Add</button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="table w-full table-fixed">
                  <colgroup>
                    <col style={{ width: "14.285%" }} />
                    <col style={{ width: "14.285%" }} />
                    <col style={{ width: "14.285%" }} />
                    <col style={{ width: "14.285%" }} />
                    <col style={{ width: "14.285%" }} />
                    <col style={{ width: "14.285%" }} />
                    <col style={{ width: "14.285%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                      <th className="py-3 px-4 text-left">Component</th>
                      <th className="py-3 px-4 text-left">Account Mapping</th>
                      <th className="py-3 px-4 text-left">Rate (%)</th>
                      <th className="py-3 px-4 text-left">Calculate On</th>
                      <th className="py-3 px-4 text-left">Sort</th>
                      <th className="py-3 px-4 text-left">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((c) => {
                      const isEdit = !!compEditing[c.id];
                      const d = compEditing[c.id] || {};
                      const acc = accounts.find(
                        (a) => String(a.id) === String(c.account_id),
                      );
                      return (
                        <tr key={c.id}>
                          <td className="font-medium">
                            {isEdit ? (
                              <input
                                className="input"
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
                          <td>
                            {isEdit ? (
                              <select
                                className="input text-xs"
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
                              `${acc.code} - ${acc.name}`
                            ) : (
                              <span className="text-slate-400 italic">
                                Auto-Resolve
                              </span>
                            )}
                          </td>
                          <td>
                            {isEdit ? (
                              <input
                                className="input"
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
                              Number(c.rate_percent || 0).toFixed(2)
                            )}
                          </td>
                          <td>
                            {isEdit ? (
                              <div className="border rounded px-2 py-1 space-y-1 min-w-[180px]">
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
                                      className="inline-flex items-center gap-2 mr-3"
                                    >
                                      <input
                                        type="checkbox"
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
                                      <span className="text-xs">{s.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              normalizeStepLevels(
                                Array.isArray(c.calculate_on_levels)
                                  ? c.calculate_on_levels
                                  : c.compound_level !== undefined &&
                                      c.compound_level !== null
                                    ? [c.compound_level]
                                    : [],
                              )
                                .map(stepLabel)
                                .join(", ")
                            )}
                          </td>
                          <td>
                            {isEdit ? (
                              <input
                                className="input"
                                type="number"
                                min="0"
                                value={
                                  d.sort_order === undefined
                                    ? c.sort_order
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
                              c.sort_order
                            )}
                          </td>
                          <td>
                            {isEdit ? (
                              <select
                                className="input"
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
                              <span className="badge badge-success">
                                Active
                              </span>
                            ) : (
                              <span className="badge badge-error">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="text-right">
                            {!isEdit ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  className="btn"
                                  onClick={() => compStartEdit(c)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn"
                                  onClick={() => compDisable(c.id)}
                                >
                                  Disable
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <button
                                  className="btn-success"
                                  onClick={() => compSaveEdit(c.id)}
                                >
                                  Save
                                </button>
                                <button
                                  className="btn"
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
                          colSpan={5}
                          className="text-center py-6 text-slate-600"
                        >
                          No components defined
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Name *</label>
                  <input
                    className="input"
                    value={editing[editingTaxId]?.name ?? ""}
                    onChange={(e) =>
                      updateEdit(editingTaxId, "name", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="label">Rate (%)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editing[editingTaxId]?.rate_percent ?? ""}
                    onChange={(e) =>
                      updateEdit(editingTaxId, "rate_percent", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="label">Type *</label>
                  <select
                    className="input"
                    value={editing[editingTaxId]?.type ?? "TAX"}
                    onChange={(e) =>
                      updateEdit(editingTaxId, "type", e.target.value)
                    }
                  >
                    <option value="TAX">Tax</option>
                    <option value="DEDUCTION">Deduction</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="input"
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
                <label className="label mb-1">Tax Scope</label>
                <div className="flex gap-6 flex-wrap">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
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
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
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
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {ALL_PAGES.map((pg) => (
                    <label
                      key={pg.value}
                      className="inline-flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={(
                          editing[editingTaxId]?.valid_pages || []
                        ).includes(pg.value)}
                        onChange={() => toggleEditPage(editingTaxId, pg.value)}
                      />
                      {pg.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  className="btn"
                  onClick={() => cancelEdit(editingTaxId)}
                >
                  Cancel
                </button>
                <button
                  className="btn-success"
                  onClick={() => saveEdit(editingTaxId)}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
