/**
 * @fileoverview MaintenanceBillForm component.
 * Provides functionality for MaintenanceBillForm.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "../../../../api/client";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { usePermission } from "@/auth/PermissionContext.jsx";
import TaxPricingModal, { TaxModeRadioSelector } from "@/components/common/TaxPricingModal.jsx";


/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function MaintenanceBillForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const { getExchangeRate } = useExchangeRate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isEdit = !!id;
  const isView = params.get("mode") === "view";
  const readOnly = isView;

  const [form, setForm] = useState({
    bill_no: "", bill_date: new Date().toISOString().slice(0,10), due_date: "",
    execution_id: params.get("execution_id") || "", supplier_id: "", supplier_name: "",
    currency: "GHS", exchange_rate: 1, other_charges: 0,
    payment_terms: "30", payment_method: "bank", payment_reference: "",
    payment_status: "UNPAID", status: "DRAFT", notes: "", cost_center_id: "",
    tax_mode: "EXCLUSIVE",
    tax_code_id: "",
    tax_rate: 0,
    tax_component_name: "",
  });
  const [lines, setLines] = useState([]);
  const [newItem, setNewItem] = useState({
    description: "",
    category: "",
    qty: 1,
    rate: 0,
    discount_percent: 0,
    tax_code_id: "",
    tax_mode: "EXCLUSIVE",
    tax_component_name: "",
  });
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [showTaxModeAlert, setShowTaxModeAlert] = useState(false);
  const [hasPromptedTaxMode, setHasPromptedTaxMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let mounted = true;
    api.get("/purchase/suppliers").then(r => { if (mounted) setSuppliers(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    api.get("/maintenance/job-executions?status=COMPLETED").then(r => { if (mounted) setExecutions(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    api.get("/finance/currencies").then(r => { if (mounted) setCurrencies(Array.isArray(r.data?.items) ? r.data.items : []); }).catch(() => {});
    api.get("/finance/cost-centers").then(r => { if (mounted) setCostCenters(Array.isArray(r.data?.items) ? r.data.items : (Array.isArray(r.data?.data?.items) ? r.data.data.items : [])); }).catch(() => {});
    api.get("/finance/tax-codes?form=MAINTENANCE_BILL").then(r => {
      if (!mounted) return;
      const fetchedTaxCodes = Array.isArray(r.data?.items) ? r.data.items : [];
      setTaxCodes(fetchedTaxCodes);
      // Auto-select first tax code for new items
      if (fetchedTaxCodes.length > 0) {
        setNewItem((prev) =>
          !prev.tax_code_id
            ? { ...prev, tax_code_id: String(fetchedTaxCodes[0].id) }
            : prev,
        );
      }
    }).catch(() => {});
    if (!isEdit) {
      api.get("/maintenance/bills/next-no").then(r => { if (mounted && r.data?.nextNo) update("bill_no", r.data.nextNo); }).catch(() => {});
    }
    if (isEdit) {
      api.get(`/maintenance/bills/${id}`).then(r => {
        const item = r.data?.item || {};
        if (mounted) {
          setForm(p => ({ ...p, ...item, bill_date: (item.bill_date || "").slice(0,10), due_date: (item.due_date || "").slice(0,10) }));
          setLines(Array.isArray(r.data?.lines) ? r.data.lines : []);
        }
      }).catch(() => toast.error("Failed to load bill"));
    }
    return () => { mounted = false; };
  }, [id]);

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

    const components = [];
    let taxTotal = 0;
    const comps = taxComponentsByCode[String(newItem.tax_code_id)] || [];
    const tc = taxCodes.find((t) => String(t.id) === String(newItem.tax_code_id));
    const singleRate = newItem.tax_rate !== undefined && newItem.tax_rate !== null
      ? Number(newItem.tax_rate)
      : (tc ? Number(tc.rate_percent) || 0 : 0);

    if (singleRate > 0) {
      if (isInclusive) {
        const net = taxableTotal / (1 + singleRate / 100);
        taxTotal = taxableTotal - net;
      } else {
        taxTotal = Math.round((taxableTotal * (singleRate / 100)) * 100) / 100;
      }
      components.push({
        name: newItem.tax_component_name || tc?.name || (isInclusive ? "Tax (Inclusive)" : "Tax (Exclusive)"),
        rate: singleRate,
        amount: taxTotal,
      });
      return { components, taxTotal, taxableTotal };
    }

    return { components: [], taxTotal: 0, taxableTotal };
  };

  const recalcLine = (line) => {
    const qty = Number(line.qty) || 0;
    const rate = Number(line.rate) || 0;
    const discountPercent = Number(line.discount_percent) || 0;
    const gross = qty * rate;
    const discount = gross * (discountPercent / 100);
    const net = gross - discount;

    const effectiveMode = String(line.tax_mode || form.tax_mode || '').toUpperCase();
    const isInclusive = effectiveMode === 'INCLUSIVE';
    let taxAmount = 0;
    const fallbackRate = form.tax_rate !== undefined && form.tax_rate !== null ? Number(form.tax_rate) : 0;
    const tc = taxCodes.find((t) => String(t.id) === String(line.tax_code_id || form.tax_code_id));
    const tcRate = line.tax_rate !== undefined && line.tax_rate !== null && Number(line.tax_rate) > 0 ? Number(line.tax_rate) : (tc ? Number(tc.rate_percent) || 0 : fallbackRate);

    if (isInclusive && tcRate > 0) {
      const sub = net / (1 + tcRate / 100);
      taxAmount = Math.round((net - sub) * 100) / 100;
      return {
        ...line,
        tax_amount: taxAmount,
        amount: net,
        line_total: net,
        tax_rate: tcRate,
        tax_mode: form.tax_mode || 'EXCLUSIVE',
        tax_code_id: line.tax_code_id || form.tax_code_id || '',
        tax_component_name: line.tax_component_name || form.tax_component_name || (tc?.name || ''),
      };
    } else if (!isInclusive && tcRate > 0) {
      taxAmount = Math.round((net * (tcRate / 100)) * 100) / 100;
      return {
        ...line,
        tax_amount: taxAmount,
        amount: net,
        line_total: Math.round((net + taxAmount) * 100) / 100,
        tax_rate: tcRate,
        tax_mode: 'EXCLUSIVE',
        tax_code_id: line.tax_code_id || form.tax_code_id || '',
        tax_component_name: line.tax_component_name || form.tax_component_name || (tc?.name || ''),
      };
    }
    return {
      ...line,
      tax_amount: 0,
      amount: net,
      line_total: net,
      tax_rate: 0,
      tax_mode: 'EXCLUSIVE',
      tax_code_id: line.tax_code_id || form.tax_code_id || '',
      tax_component_name: line.tax_component_name || form.tax_component_name || '',
    };
  };

  const addItemToLines = () => {
    if (!newItem.description || !newItem.qty) return;
    setLines((p) => [
      ...p,
      recalcLine({
        ...newItem,
        id: Date.now(),
        tax_code_id: newItem.tax_code_id || form.tax_code_id || "",
        tax_mode: newItem.tax_mode || form.tax_mode || "EXCLUSIVE",
        tax_rate: newItem.tax_rate !== undefined ? newItem.tax_rate : form.tax_rate,
        tax_component_name: newItem.tax_component_name || form.tax_component_name || "",
      }),
    ]);
    setNewItem({
      description: "",
      category: "",
      qty: 1,
      rate: 0,
      discount_percent: 0,
      tax_code_id: form.tax_code_id || "",
      tax_mode: form.tax_mode || "EXCLUSIVE",
      tax_rate: form.tax_rate,
      tax_component_name: form.tax_component_name || "",
    });
  };

  const totals = useMemo(() => {
    let grossSub = 0, disc = 0;
    const compTotals = {};
    const isInclusive = String(form.tax_mode || '').toUpperCase() === 'INCLUSIVE';

    for (const r of lines) {
      const base = Number(r.qty || 0) * Number(r.rate || 0);
      grossSub += base;
      const d = base * (Number(r.discount_percent || 0) / 100);
      disc += d;
      const isLineIncl = String(r.tax_mode || form.tax_mode || '').toUpperCase() === 'INCLUSIVE';

      const amt = Number(r.tax_amount || 0);
      if (amt > 0) {
        const tc = taxCodes.find((t) => String(t.id) === String(r.tax_code_id || form.tax_code_id));
        const singleRate = Number(r.tax_rate !== undefined ? r.tax_rate : (form.tax_rate || 0));
        const name = r.tax_component_name || form.tax_component_name || tc?.name || (isLineIncl ? "Tax (Inclusive)" : "Tax (Exclusive)");
        if (!compTotals[name]) {
          compTotals[name] = { amount: 0, rate: singleRate, sort_order: 99 };
        }
        compTotals[name].amount += amt;
      }
    }
    const components = Object.keys(compTotals)
      .map((name) => ({
        name,
        amount: Math.round(compTotals[name].amount * 100) / 100,
        rate: compTotals[name].rate,
        sort_order: compTotals[name].sort_order,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);

    const taxTotal = lines.reduce((s, r) => s + Number(r.tax_amount || 0), 0);
    if (components.length === 0 && taxTotal > 0) {
      const tc = taxCodes.find((t) => String(t.id) === String(form.tax_code_id));
      const rate = form.tax_rate !== undefined ? form.tax_rate : (tc?.rate_percent || 0);
      components.push({
        name: form.tax_component_name || tc?.name || (rate ? `Tax (${rate}%)` : "Tax"),
        amount: Math.round(taxTotal * 100) / 100,
        rate,
        sort_order: 1,
      });
    }
    const other = Number(form.other_charges || 0);

    // Subtotal: when inclusive, Subtotal must be LESS TAX:
    const subtotal = isInclusive ? Math.max(0, grossSub - taxTotal) : grossSub;
    const grandTotal = isInclusive
      ? grossSub - disc + other
      : subtotal - disc + taxTotal + other;

    return {
      subtotal,
      discountAmount: disc,
      taxAmount: taxTotal,
      otherCharges: other,
      total: grandTotal,
      components,
    };
  }, [lines, taxCodes, form.tax_mode, form.other_charges, form.tax_code_id, form.tax_rate, form.tax_component_name]);

  const addLine = () => setLines(p => [...p, { description: "", category: "", qty: 1, rate: 0, discount_percent: 0, tax_code_id: "" }]);
  const removeLine = i => setLines(p => p.filter((_, idx) => idx !== i));
  const updateLine = (i, row) => setLines(p => p.map((r, idx) => idx === i ? row : r));

  const handleCurrencyChange = async (code) => {
    update("currency", code);
    const target = currencies.find(c => (c.code || c.currency_code) === code);
    const base = currencies.find(c => Number(c.is_base) === 1);
    if (!target || !base || target.code === base.code) {
      update("exchange_rate", 1);
      return;
    }
    try {
      const rate = await getExchangeRate(target.code || target.currency_code, base.code || base.currency_code);
      if (rate) update("exchange_rate", rate);
      else update("exchange_rate", 1);
    } catch {
      update("exchange_rate", 1);
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, lines, subtotal: totals.subtotal, discount_amount: totals.discountAmount, tax_amount: totals.taxAmount, total_amount: totals.total };
      if (isEdit) { await api.put(`/maintenance/bills/${id}`, payload); toast.success("Bill updated"); }
      else { const r = await api.post("/maintenance/bills", payload); toast.success(`Bill ${r.data?.bill_no} created`); }
      navigate("/maintenance/bills", { state: { refresh: true } });
    } catch (e) { toast.error(e?.response?.data?.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/maintenance/maintenance-bills" className="btn btn-secondary flex items-center gap-1.5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isEdit ? "Edit" : "New"} Maintenance Bill</h1>
            <p className="text-sm mt-1">Raise a payment bill for completed maintenance work</p>
          </div>
        </div>
        <div className="text-right"><div className="text-xs text-slate-500">Bill No</div><div className="text-lg font-semibold">{form.bill_no}</div></div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold">Bill Details</div>
          <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="label">Bill Date</label><input className="input w-56" type="date" value={form.bill_date} onChange={e => update("bill_date", e.target.value)} 
              disabled={readOnly || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
            /></div>
            <div><label className="label">Due Date</label><input className="input w-56" type="date" value={form.due_date} onChange={e => update("due_date", e.target.value)} 
              disabled={readOnly || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
            /></div>
            <div>
              <label className="label">Job Execution</label>
              <select className="input w-56" value={form.execution_id} onChange={e => update("execution_id", e.target.value)}>
                <option value="">-- None --</option>
                {executions.map(ex => <option key={ex.id} value={ex.id}>{ex.execution_no}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Supplier / Contractor</label>
              <select className="input w-56" value={form.supplier_id} onChange={e => { const s = suppliers.find(x => String(x.id) === e.target.value); update("supplier_id", e.target.value); update("supplier_name", s?.supplier_name || s?.name || ""); }}>
                <option value="">-- Select --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name || s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input w-56" value={form.currency} onChange={e => handleCurrencyChange(e.target.value)}>
                {currencies.map(c => (
                  <option key={c.id} value={c.code || c.currency_code}>
                    {c.code || c.currency_code} - {c.name || c.currency_name}
                  </option>
                ))}
              </select>
            </div>
            <div><label className="label">Exchange Rate</label><input className="input w-56 text-right" type="number" step="0.000001" value={form.exchange_rate} readOnly /></div>
            <div><label className="label">Payment Terms (Days)</label><input className="input w-56" type="number" value={form.payment_terms} onChange={e => update("payment_terms", e.target.value)} /></div>
            <div>
              <label className="label">Cost Center</label>
              <select className="input w-56" value={form.cost_center_id || ""} onChange={e => update("cost_center_id", e.target.value)}>
                <option value="">-- Select Cost Center --</option>
                {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name} ({cc.code})</option>)}
              </select>
            </div>
            <div className="md:col-span-3 w-full">
              <label className="label">Remarks / Notes</label>
              <textarea
                className="input w-full"
                rows={3}
                value={form.notes}
                onChange={e => update("notes", e.target.value)}
                placeholder="Additional notes or terms..."
              />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header bg-brand text-white rounded-t-lg font-semibold flex justify-between items-center">
            <span>Bill Lines</span>
            <TaxModeRadioSelector
              taxMode={form.tax_mode || "EXCLUSIVE"}
              onModeChange={(newMode) => {
                setForm((prev) => ({
                  ...prev,
                  tax_mode: newMode,
                  ...(newMode === "EXCLUSIVE" ? { tax_code_id: "", tax_rate: 0, tax_component_name: "" } : {}),
                }));
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
                    return recalcLine(updated);
                  })
                );
              }}
              onOpenTaxModal={() => setTaxModalOpen(true)}
              selectedTaxLabel={newItem.tax_component_name}
              openAlert={showTaxModeAlert}
              onCloseAlert={() => setShowTaxModeAlert(false)}
              anchorSelector="#maintenance-bill-desc"
            />
          </div>
          <div className="card-body">
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg mb-6">
              <h4 className="text-sm font-semibold mb-3 text-brand">Add Service Line</h4>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-3">
                <div className="md:col-span-3">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Description *</label>
                  <input
                    id="maintenance-bill-desc"
                    className="input text-sm w-full"
                    value={newItem.description}
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
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="Enter service details"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Category</label>
                  <input
                    className="input text-sm w-full"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Qty</label>
                  <input
                    type="number"
                    className="input text-sm w-full"
                    value={newItem.qty}
                    onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Rate / Price</label>
                  <input
                    type="number"
                    className="input text-sm w-full"
                    value={newItem.rate}
                    onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Disc %</label>
                  <input
                    type="number"
                    className="input text-sm w-full"
                    value={newItem.discount_percent}
                    onChange={(e) => setNewItem({ ...newItem, discount_percent: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Tax Component</label>
                  <div
                    data-tax-anchor="true"
                    onClick={() => setTaxModalOpen(true)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 cursor-pointer flex items-center justify-between hover:border-brand-500 transition-colors shadow-sm min-h-[38px]"
                    title="Click to select tax component"
                  >
                    <span className="truncate text-slate-800 dark:text-slate-200">
                      {newItem.tax_component_name || (newItem.tax_code_id ? taxCodes.find(t => String(t.id) === String(newItem.tax_code_id))?.name : '') || (newItem.tax_rate ? `Tax (${newItem.tax_rate}%)` : 'Select Tax')}
                    </span>
                    {newItem.tax_rate !== undefined && (
                      <span className="text-[11px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded shrink-0 ml-1">
                        {Number(newItem.tax_rate)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2">
                   {newItem.tax_code_id && calcNewItemTaxBreakdown().components.length > 0 && (
                     <div className="border border-brand/20 bg-brand/5 rounded-md p-2 text-[11px] mt-1">
                       <span className="font-bold block border-b border-brand/10 mb-1">Tax Calculation:</span>
                       {calcNewItemTaxBreakdown().components.map(c => (
                         <div key={c.name} className="flex justify-between">
                           <span>{c.name} ({c.rate}%):</span>
                           <span className="font-semibold">{c.amount.toFixed(2)}</span>
                         </div>
                       ))}
                       <div className="flex justify-between border-t border-brand/10 mt-1 pt-1 font-bold italic">
                         <span>Total Tax:</span>
                         <span>{calcNewItemTaxBreakdown().taxTotal.toFixed(2)}</span>
                       </div>
                     </div>
                   )}
                </div>
                <div className="md:col-span-2 flex items-end justify-end">
                  <button
                    type="button"
                    className="btn btn-primary px-4 py-1.5 text-xs flex items-center gap-2"
                    onClick={addItemToLines}
                    disabled={!newItem.description || !newItem.qty}
                  >
                    <span>+</span> Add Line
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="bg-[#f8f9fa]">
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Disc%</th>
                    <th className="text-right">Tax</th>
                    <th className="text-right">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-10 text-slate-400 bg-slate-50 italic">
                        No service lines added yet.
                      </td>
                    </tr>
                  ) : (
                    lines.map((row, i) => {
                       const gross = (Number(row.qty) || 0) * (Number(row.rate) || 0);
                       const disc = gross * (Number(row.discount_percent || 0) / 100);
                       const net = gross - disc;
                       const tax = (Number(row.amount) || 0) - net;
                       return (
                         <tr key={row.id || i} className="hover:bg-slate-50">
                           <td>{i + 1}</td>
                           <td className="font-medium text-[#0E3646] truncate max-w-[200px]">{row.description}</td>
                           <td className="text-xs text-slate-500">{row.category}</td>
                           <td className="text-right font-semibold">{row.qty}</td>
                           <td className="text-right font-mono">{Number(row.rate).toFixed(2)}</td>
                           <td className="text-right text-red-500">{row.discount_percent}%</td>
                           <td className="text-right text-slate-500">
                             {tax.toFixed(2)}
                             {Number(row.tax_rate !== undefined && row.tax_rate !== null ? row.tax_rate : (form.tax_rate || 0)) > 0 && (
                               <span className="block text-[10px] text-brand font-bold">
                                 ({Number(row.tax_rate !== undefined && row.tax_rate !== null ? row.tax_rate : (form.tax_rate || 0))}%)
                                </span>
                             )}
                           </td>
                           <td className="text-right font-bold text-[#0E3646]">{Number(row.amount).toFixed(2)}</td>
                           <td className="text-center">
                             <button type="button" className="text-red-500 hover:text-red-800 transition-colors" onClick={() => removeLine(i)}>Discard</button>
                           </td>
                         </tr>
                       );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{totals.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>-{totals.discountAmount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{totals.taxAmount.toFixed(2)}</span></div>
                {(totals.components || []).map((c) => (
                  <div
                    key={c.name}
                    className="flex justify-between text-xs text-slate-500 pl-4"
                  >
                    <span>
                      {c.name} ({c.rate}%):
                    </span>
                    <span>{Number(c.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center"><span>Other Charges</span><input className="input w-28 text-right" type="number" value={form.other_charges} onChange={e => update("other_charges", e.target.value)} /></div>
                <div className="flex justify-between font-bold border-t pt-1 text-base"><span>Total</span><span>{totals.total.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Bill"}</button>
        </div>
      </form>
      {/* Universal Tax Pricing & Components Modal */}
      <TaxPricingModal
        open={taxModalOpen}
        form="MAINTENANCE_BILL"
        pageId={7}
        onClose={() => setTaxModalOpen(false)}
        taxMode={newItem.tax_mode || form.tax_mode || 'EXCLUSIVE'}
        price={newItem.rate || 0}
        selectedComponent={{
          name: newItem.tax_component_name || form.tax_component_name,
          rate: newItem.tax_rate !== undefined ? newItem.tax_rate : form.tax_rate,
          id: newItem.tax_code_id || form.tax_code_id,
        }}
        onSelectComponent={(comp) => {
          const compLabel = `${comp.name}${comp.rate !== undefined ? ` (${comp.rate}%)` : ''}`;
          const taxCodeId = comp.taxCodeId || comp.originalId || comp.id;
          const taxRate = comp.rate;
          setForm((prev) => ({
            ...prev,
            tax_mode: form.tax_mode || 'EXCLUSIVE',
            tax_code_id: taxCodeId,
            tax_rate: taxRate,
            tax_component_name: compLabel,
          }));
          setNewItem((prev) => ({
            ...prev,
            tax_code_id: taxCodeId || prev.tax_code_id,
            tax_rate: taxRate,
            tax_component_name: compLabel,
            tax_mode: form.tax_mode || 'EXCLUSIVE',
          }));
          setLines((prev) =>
            prev.map((ln) => {
              const updated = {
                ...ln,
                tax_code_id: taxCodeId || ln.tax_code_id,
                tax_rate: taxRate,
                tax_component_name: compLabel,
                tax_mode: form.tax_mode || 'EXCLUSIVE',
              };
              return recalcLine(updated);
            })
          );
          setTaxModalOpen(false);
        }}
      />
    </div>
  );
}