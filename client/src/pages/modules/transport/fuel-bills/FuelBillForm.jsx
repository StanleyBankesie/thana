/**
 * @fileoverview FuelBillForm component.
 * Provides functionality for FuelBillForm.
 */

import React, { useMemo, useState, useEffect } from "react";
import { api } from "../../../../api/client";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { toast } from "react-toastify";

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const map = {
    paid: { label: "✓ PAID", cls: "bg-green-100 text-green-700 border-green-200" },
    overdue: { label: "⚠ OVERDUE", cls: "bg-red-100 text-red-700 border-red-200" },
    pending: { label: "⏳ PENDING", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    completed: { label: "✓ COMPLETED", cls: "bg-green-100 text-green-700 border-green-200" },
  };
  const d = map[s] || map.pending;
  return <span className={`inline-block px-3 py-1 text-xs rounded border ${d.cls}`}>{d.label}</span>;
}

function PaymentBadge({ payment }) {
  const p = String(payment || "").toLowerCase();
  const map = {
    paid: { label: "Paid", cls: "bg-green-100 text-green-700 border-green-200" },
    unpaid: { label: "Unpaid", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  };
  const d = map[p] || map.unpaid;
  return <span className={`inline-block px-3 py-1 text-xs rounded border ${d.cls}`}>{d.label}</span>;
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function FuelBillForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { getExchangeRate } = useExchangeRate();
  const readOnly =
    String(new URLSearchParams(location.search).get("mode") || "").toLowerCase() === "view";
  const disabledClass = readOnly
    ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 font-semibold"
    : "";
  const successMsg = location.state?.success || "";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [bill, setBill] = useState({
    bill_no: "",
    status: "pending",
    bill_date: new Date().toISOString().split("T")[0],
    due_date: "",
    service_date: "",
    supplier_id: "",
    relatedExecId: "",
    currency_id: 4,
    exchange_rate: 1,
    payment_terms: 30,
    payment_status: "UNPAID",
    freight_charges: 0,
    other_charges: 0,
    payment_method: "cash",
    payment_reference: "",
    notes: "",
    cost_center_id: "",
  });

  const [lines, setLines] = useState([]);
  const [newItem, setNewItem] = useState({
    item_id: "",
    category: "",
    qty: 1,
    rate: 0,
    discount_percent: 0,
    tax_code_id: "",
  });

  const [suppliers, setSuppliers] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [confirmedServices, setConfirmedServices] = useState([]);
  const [serviceItems, setServiceItems] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [finCurrencies, setFinCurrencies] = useState([]);
  const [baseFinCurrencyId, setBaseFinCurrencyId] = useState(null);
  const [taxCodes, setTaxCodes] = useState([]);
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});
  const [costCenters, setCostCenters] = useState([]);

  const [currentBillId, setCurrentBillId] = useState(id && id !== "new" ? Number(id) : null);

  const baseCurrencyCode = useMemo(() => {
    return finCurrencies.find((c) => Number(c.is_base) === 1 || c.is_base === true)?.code || "GHS";
  }, [finCurrencies]);

  const selectedCurrencyCode = useMemo(() => {
    return finCurrencies.find((c) => String(c.id) === String(bill.currency_id))?.code || "";
  }, [finCurrencies, bill.currency_id]);

  const methods = [
    { key: "cash", label: "Cash", icon: "💵" },
    { key: "card", label: "Card", icon: "💳" },
    { key: "mobile", label: "Mobile Money", icon: "📱" },
    { key: "bank", label: "Bank Transfer", icon: "🏦" },
  ];

  const update = (field, value) => setBill((prev) => ({ ...prev, [field]: value }));

  const toYmd = (v) => {
    if (!v) return null;
    try {
      const d = new Date(v);
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    } catch {}
    return typeof v === "string" ? v.slice(0, 10) : null;
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

    const components = [];
    let taxTotal = 0;
    const comps = taxComponentsByCode[String(newItem.tax_code_id)] || [];
    const tc = taxCodes.find((t) => String(t.id) === String(newItem.tax_code_id));
    const isNoTax = /no\s*tax/i.test(String(tc?.name || ""));

    if (!isNoTax && comps.length > 0) {
      comps.forEach((c) => {
        const rate = Number(c.rate_percent) || 0;
        const amt = (taxableTotal * rate) / 100;
        components.push({ name: c.component_name, rate, amount: amt });
        taxTotal += amt;
      });
    } else if (newItem.tax_code_id && !isNoTax) {
      const tcRate = tc ? Number(tc.rate_percent) || 0 : 0;
      const amt = (taxableTotal * tcRate) / 100;
      if (tcRate > 0) {
        components.push({ name: "Tax", rate: tcRate, amount: amt });
        taxTotal = amt;
      }
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
        if (it?.uom) {
          const u = uoms.find((uom) => String(uom.uom_code) === String(it.uom));
          next.uom_id = u ? String(u.id) : "";
        }
        if (it?.cost_price) next.rate = Number(it.cost_price);
        const fetchTax = async () => {
          try {
            const res = await api.get(`/finance/item-tax/${value}`);
            const tax = res.data?.tax;
            if (tax && tax.id) {
              setNewItem((p) => (p.item_id === value ? { ...p, tax_code_id: String(tax.id) } : p));
            }
          } catch {}
        };
        fetchTax();
      }
      return next;
    });
  };

  const addItemToLines = () => {
    if (!newItem.item_id || !newItem.qty) return;
    const { taxTotal, taxableTotal } = calcNewItemTaxBreakdown();
    const it = serviceItems.find((x) => String(x.id) === String(newItem.item_id));
    const uo = uoms.find((u) => String(u.id) === String(newItem.uom_id));

    setLines((prev) => [
      ...prev,
      {
        ...newItem,
        id: Date.now(),
        item_name: it?.item_name || "",
        item_code: it?.item_code || "",
        uom_name: uo?.uom_code || uo?.uom_name || "",
        tax_amount: taxTotal,
        line_total: taxableTotal + taxTotal,
      },
    ]);

    setNewItem({ item_id: "", category: "", qty: 1, rate: 0, discount_percent: 0, tax_code_id: "" });
  };

  const removeRow = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const recalcLine = (line) => {
    const qty = Number(line.qty) || 0;
    const rate = Number(line.rate) || 0;
    const discountPercent = Number(line.discount_percent) || 0;
    const gross = qty * rate;
    const discount = gross * (discountPercent / 100);
    const taxable = gross - discount;

    let taxAmount = 0;
    const comps = taxComponentsByCode[String(line.tax_code_id)] || [];
    const tc = taxCodes.find((t) => String(t.id) === String(line.tax_code_id));
    const isNoTax = /no\s*tax/i.test(String(tc?.name || ""));
    if (!isNoTax && comps.length > 0) {
      comps.forEach((c) => { taxAmount += (taxable * (Number(c.rate_percent) || 0)) / 100; });
    }

    return { ...line, tax_amount: taxAmount, line_total: taxable + taxAmount };
  };

  const handleLineChange = (lineId, field, value) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        let next = { ...l, [field]: value };
        if (field === "item_id") {
          const it = serviceItems.find((i) => String(i.id) === String(value));
          if (it?.uom) {
            const u = uoms.find((uom) => String(uom.uom_code) === String(it.uom));
            next.uom_id = u ? String(u.id) : "";
          }
        }
        return recalcLine(next);
      }),
    );
  };

  const totals = useMemo(() => {
    let sub = 0;
    let itemDiscounts = 0;
    const compTotals = {};

    for (const r of lines) {
      const qty = Number(r.qty || 0);
      const rate = Number(r.rate || 0);
      const base = qty * rate;
      sub += base;
      const discPct = Number(r.discount_percent || 0);
      const discountAmt = base * (discPct / 100);
      itemDiscounts += discountAmt;
      const taxable = base - discountAmt;

      const taxCodeId = r.tax_code_id;
      const comps = taxComponentsByCode[String(taxCodeId)] || [];
      const tc = taxCodes.find((t) => String(t.id) === String(taxCodeId));
      const isNoTax = /no\s*tax/i.test(String(tc?.name || ""));
      if (!isNoTax && comps.length > 0) {
        comps.forEach((c) => {
          const rate = Number(c.rate_percent) || 0;
          const amt = (taxable * rate) / 100;
          const name = c.component_name;
          if (!compTotals[name]) compTotals[name] = { amount: 0, rate, sort_order: c.sort_order || 0 };
          compTotals[name].amount += amt;
        });
      }
    }

    const components = Object.keys(compTotals)
      .map((name) => ({ name, amount: compTotals[name].amount, rate: compTotals[name].rate, sort_order: compTotals[name].sort_order }))
      .sort((a, b) => a.sort_order - b.sort_order);

    const taxTotal = components.reduce((s, c) => s + c.amount, 0);
    const freight = 0;
    const other = Number(bill.other_charges || 0);
    const total = sub - itemDiscounts + taxTotal + freight + other;

    return { subtotal: sub, discountAmount: itemDiscounts, taxAmount: taxTotal, freight, other, total, components };
  }, [lines, bill.freight_charges, bill.other_charges, taxCodes, taxComponentsByCode]);

  useEffect(() => {
    setBill((prev) => ({ ...prev, subtotal: totals.subtotal, tax: totals.taxAmount, total: totals.total }));
  }, [totals.subtotal, totals.taxAmount, totals.total]);

  useEffect(() => {
    let mounted = true;
    async function loadLookups() {
      try {
        const [supRes, svcOrdersRes, curRes, itemsRes, uomsRes, taxesRes, ccRes] = await Promise.all([
          api.get("/purchase/suppliers", { params: { contractor: "Y" } }).catch(() => ({ data: { items: [] } })),
          api.get("/purchase/service-orders").catch(() => ({ data: { items: [] } })),
          api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/items").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/uoms").catch(() => ({ data: { items: [] } })),
          api.get("/finance/tax-codes?form=SERVICE_BILL").catch(() => ({ data: { items: [] } })),
          api.get("/finance/cost-centers").catch(() => ({ data: { items: [] } })),
        ]);
        if (!mounted) return;

        setSuppliers(Array.isArray(supRes.data?.items) ? supRes.data.items : []);
        const allOrders = Array.isArray(svcOrdersRes.data?.items) ? svcOrdersRes.data.items : [];
        const validStatuses = ["DONE"];
        setConfirmedServices(allOrders.filter((o) => validStatuses.includes(String(o.status || "").toUpperCase())));
        setUoms(Array.isArray(uomsRes.data?.items) ? uomsRes.data.items : []);

        const currs = Array.isArray(curRes.data?.items) ? curRes.data.items : [];
        setFinCurrencies(currs);
        const base = currs.find((c) => Number(c.is_base) === 1) || currs.find((c) => /ghs/i.test(String(c.code || "")));
        setBaseFinCurrencyId(base ? Number(base.id) : null);

        const items = Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [];
        const svc = items.filter((it) => String(it.service_item || "").toUpperCase() === "Y");
        setServiceItems(svc.map((x) => ({ id: x.id, item_name: x.item_name, item_code: x.item_code, uom: x.uom, cost_price: x.cost_price })));

        const fetchedTaxCodes = Array.isArray(taxesRes.data?.items) ? taxesRes.data.items : [];
        setTaxCodes(fetchedTaxCodes);
        setCostCenters(Array.isArray(ccRes.data?.items) ? ccRes.data.items : (Array.isArray(ccRes.data?.data?.items) ? ccRes.data.data.items : []));
      } catch {}
    }
    loadLookups();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function getNextBillNo() {
      try {
        const res = await api.get("/transport/fuel-bills/next-no");
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
  }, []);

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

  useEffect(() => {
    let mounted = true;
    async function loadExisting() {
      if (!id || id === "new") return;
      try {
        setLoading(true);
        const res = await api.get(`/transport/fuel-bills/${id}`);
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
          freight_charges: Number(item.freight_charges) || 0,
          other_charges: Number(item.other_charges) || 0,
          payment_method: item.payment_method || "cash",
          payment_reference: item.payment_reference || "",
          notes: item.notes || "",
          cost_center_id: item.cost_center_id ? String(item.cost_center_id) : "",
          subtotal: Number(item.subtotal) || 0,
          tax: Number(item.tax_amount) || 0,
          total: Number(item.total_amount) || 0,
        });

        setLines(
          details.map((d) => ({
            id: d.id || Date.now() + Math.random(),
            item_id: d.item_id ? String(d.item_id) : "",
            item_name: d.description || "",
            category: d.category || "",
            uom_id: d.uom_id ? String(d.uom_id) : "",
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

  useEffect(() => {
    let mounted = true;
    async function loadOrderLines() {
      const orderId = bill.relatedExecId;
      if (!orderId) return;
      try {
        const res = await api.get(`/purchase/service-orders/${orderId}`);
        if (!mounted) return;
        const orderLines = Array.isArray(res.data?.lines) ? res.data.lines : [];
        setLines(orderLines.map((ln, idx) => ({
          id: Date.now() + idx,
          item_id: ln.item_id ? String(ln.item_id) : "",
          item_name: ln.item_name || ln.description || "",
          category: "",
          uom_id: "",
          qty: Number(ln.qty) || 0,
          rate: Number(ln.unit_price) || 0,
          discount_percent: 0,
          tax_code_id: "",
          tax_amount: 0,
          line_total: Number(ln.line_total) || 0,
        })));
      } catch {}
    }
    loadOrderLines();
    return () => { mounted = false; };
  }, [bill.relatedExecId]);

  const saveBill = async () => {
    if (!bill.bill_date) { setError("Bill Date is required"); return; }
    if (!bill.supplier_id) { setError("Supplier is required"); return; }
    if (lines.length === 0) { setError("At least one service line is required"); return; }

    setSaving(true);
    setError("");

    try {
      const status = "COMPLETED";
      const payload = {
        bill_no: bill.bill_no || null,
        bill_date: toYmd(bill.bill_date),
        due_date: toYmd(bill.due_date),
        supplier_id: bill.supplier_id ? Number(bill.supplier_id) : null,
        order_id: bill.relatedExecId ? Number(bill.relatedExecId) : null,
        service_date: toYmd(bill.service_date),
        status,
        payment_method: bill.payment_method || "cash",
        payment_reference: bill.payment_reference || null,
        payment_terms: bill.payment_terms ? Number(bill.payment_terms) : null,
        currency_id: bill.currency_id ? Number(bill.currency_id) : null,
        exchange_rate: Number(bill.exchange_rate) || 1,
        freight_charges: Number(bill.freight_charges) || 0,
        other_charges: Number(bill.other_charges) || 0,
        notes: bill.notes || null,
        cost_center_id: bill.cost_center_id ? Number(bill.cost_center_id) : null,
        details: lines
          .filter((l) => l.item_id || l.desc)
          .map((l) => ({
            item_id: l.item_id ? Number(l.item_id) : null,
            description: l.desc || l.item_name || "",
            category: l.category || null,
            uom_id: l.uom_id ? Number(l.uom_id) : null,
            qty: Number(l.qty) || 0,
            rate: Number(l.rate) || 0,
            amount: Number(l.qty || 0) * Number(l.rate || 0),
            discount_percent: Number(l.discount_percent) || 0,
            tax_code_id: l.tax_code_id ? Number(l.tax_code_id) : null,
            tax_amount: Number(l.tax_amount) || 0,
            line_total: Number(l.line_total) || 0,
          })),
        subtotal: Number(totals.subtotal || 0),
        discount_amount: Number(totals.discountAmount || 0),
        tax_amount: Number(totals.taxAmount || 0),
        total_amount: Number(totals.total || 0),
      };

      const isEdit = id && id !== "new";
      if (isEdit) {
        await api.put(`/transport/fuel-bills/${id}`, payload);
      } else {
        const res = await api.post("/transport/fuel-bills", payload);
        const newId = Number(res?.data?.id || 0) || null;
        if (newId) setCurrentBillId(newId);
      }

      toast.success("Service bill saved successfully");
      navigate("/transport/fuel-bills", {
        state: { success: "Service bill saved successfully" },
      });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save service bill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="btn-secondary">
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {id && id !== "new" ? "Edit" : "New"} Fuel Bill
            </h1>
            <p className="text-sm mt-1">Prepare and issue bill for services provided</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-600">Bill No</div>
          <div className="text-lg font-semibold">{bill.bill_no}</div>
        </div>
      </div>

      {successMsg && (
        <div className="mb-3 p-3 rounded bg-green-50 border border-green-200 text-green-700 text-sm">{successMsg}</div>
      )}
      {loading && <div className="p-4 bg-white rounded shadow text-center">Loading...</div>}
      {error && <div className="p-4 text-red-600 bg-white rounded shadow">{error}</div>}

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="font-semibold">Bill Details</div>
            <div className="flex items-center gap-2">
              <StatusBadge status={bill.status} />
              <PaymentBadge payment={bill.payment_status} />
            </div>
          </div>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="form-group">
            <label className="label required">Bill Date</label>
            <input type="date" className={`input ${disabledClass}`} value={bill.bill_date} onChange={(e) => update("bill_date", e.target.value)} readOnly={readOnly} 
              disabled={readOnly || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
            />
          </div>
          <div className="form-group">
            <label className="label required">Supplier</label>
            <div className="relative">
              <input
                type="text"
                className={`input ${disabledClass} w-full`}
                placeholder="Search supplier..."
                disabled={readOnly}
                value={
                  suppliers.find((s) => String(s.id) === String(bill.supplier_id))?.supplier_name ||
                  suppliers.find((s) => String(s.id) === String(bill.supplier_id))?.name ||
                  suppliers.find((s) => String(s.id) === String(bill.supplier_id))?.company ||
                  supplierSearch
                }
                onChange={(e) => {
                  setSupplierSearch(e.target.value);
                  update("supplier_id", "");
                  update("relatedExecId", ""); // clear related service when supplier changes
                }}
              />
              {!readOnly && supplierSearch && (
                (() => {
                  const q = supplierSearch.trim();
                  const matched = q ? filterByPrefix(suppliers, {
                    query: q,
                    searchFields: ["supplier_name", "name", "company", "supplier_code"],
                  }).slice(0, 10) : [];
                  return matched.length > 0 ? (
                    <div className="absolute z-30 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                      {matched.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            update("supplier_id", String(s.id));
                            if (s.currency_id) {
                              update("currency_id", Number(s.currency_id));
                            }
                            setSupplierSearch("");
                            
                            // Auto-select confirmed service
                            const supCode = s.supplier_code || s.code || null;
                            const matches = confirmedServices.filter(so => 
                              supCode && 
                              String(so.contractor_code) === String(supCode) && 
                              String(so.status || "").toUpperCase() === "DONE"
                            );
                            if (matches.length === 1) {
                              update("relatedExecId", String(matches[0].id));
                            } else {
                              update("relatedExecId", "");
                            }
                          }}
                        >
                          <div className="font-medium text-slate-800 text-sm">{s.supplier_name || s.name || s.company}</div>
                          {s.supplier_code && <div className="text-xs text-slate-500">{s.supplier_code}</div>}
                        </button>
                      ))}
                    </div>
                  ) : q.length >= 2 ? (
                    <div className="absolute z-30 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1">
                      <div className="p-3 text-sm text-slate-600 text-center">
                        Supplier not found.
                      </div>
                    </div>
                  ) : null;
                })()
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="label">Confirmed Service</label>
            <select className={`input ${disabledClass}`} value={bill.relatedExecId || ""} onChange={(e) => update("relatedExecId", e.target.value)} disabled={readOnly}>
              <option value="">-- Select Confirmed Service --</option>
              {(() => {
                const selectedSup = suppliers.find(s => String(s.id) === String(bill.supplier_id));
                const supCode = selectedSup?.supplier_code || selectedSup?.code || null;
                return confirmedServices
                  .filter(so => supCode && String(so.contractor_code) === String(supCode) && String(so.status || "").toUpperCase() === "DONE")
                  .map((so) => (<option key={so.id} value={String(so.id)}>{so.order_no} - {so.customer_name || so.service_type || ""}</option>));
              })()}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Due Date</label>
            <input type="date" className={`input ${disabledClass}`} value={bill.due_date} onChange={(e) => update("due_date", e.target.value)} readOnly={readOnly} 
              disabled={readOnly || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
            />
          </div>
          <div className="form-group">
            <label className="label">Service Date</label>
            <input type="date" className={`input ${disabledClass}`} value={bill.service_date} onChange={(e) => update("service_date", e.target.value)} readOnly={readOnly} 
              disabled={readOnly || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
            />
          </div>
          <div className="form-group">
            <label className="label">Currency</label>
            <select className={`input ${disabledClass}`} value={bill.currency_id} onChange={(e) => update("currency_id", e.target.value)} disabled={readOnly}>
              {finCurrencies.map((c) => (<option key={c.id} value={c.id}>{c.code || c.currency_code} - {c.name || c.currency_name}</option>))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Exchange Rate {selectedCurrencyCode ? `(${baseCurrencyCode} per ${selectedCurrencyCode})` : ""}</label>
            <input type="number" step="0.000001" className={`input text-right ${disabledClass}`} value={bill.exchange_rate} onChange={(e) => update("exchange_rate", e.target.value)} readOnly />
          </div>
          <div className="form-group">
            <label className="label">Payment Terms (Days)</label>
            <input type="number" className={`input text-right ${disabledClass}`} value={bill.payment_terms} onChange={(e) => update("payment_terms", e.target.value)} readOnly={readOnly} />
          </div>
          <div className="form-group">
            <label className="label">Cost Center</label>
            <select className={`input ${disabledClass}`} value={bill.cost_center_id || ""} onChange={(e) => update("cost_center_id", e.target.value)} disabled={readOnly}>
              <option value="">-- Select Cost Center --</option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.name} ({cc.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Service Lines</div>
        </div>
        <div className="card-body">
          {!readOnly && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg mb-6">
              <h4 className="text-sm font-semibold mb-3 text-brand">Add Service</h4>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-3">
                <div className="md:col-span-4">
                  <label className="text-xs uppercase font-semibold text-slate-500 mb-1 block">Service Item *</label>
                  <div className="relative">
                    <input
                      id="service-bill-item-search"
                      name="item_id"
                      autoComplete="off"
                      className="input text-sm w-full"
                      placeholder="Type item name or code..."
                      value={itemQuery}
                      onChange={(e) => {
                        setItemQuery(e.target.value);
                        if (newItem.item_id) {
                          setNewItem((prev) => ({ ...prev, item_id: "", item_name: "", rate: 0 }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const q = itemQuery.trim();
                          const results = q ? filterByPrefix(serviceItems, { query: q, searchFields: ["item_code", "item_name"] }) : [];
                          if (!q || !results.length) return;
                          e.preventDefault();
                          handleNewItemChange({ target: { name: "item_id", value: results[0].id } });
                          setItemQuery(results[0].item_name);
                        }
                      }}
                    />
                    {(() => {
                      const q = itemQuery.trim();
                      const results = q ? filterByPrefix(serviceItems, { query: q, searchFields: ["item_code", "item_name"] }) : [];
                      return results.length && !newItem.item_id ? (
                        (() => {
                          const el = document.getElementById("service-bill-item-search");
                          const r = el ? el.getBoundingClientRect() : { bottom: 0, left: 0, width: 0 };
                          return (
                            <div
                              className="bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-auto"
                              style={{ position: 'fixed', top: `${r.bottom + 4}px`, left: `${r.left}px`, width: `${r.width}px`, zIndex: 9999 }}
                            >
                              {results.map((o) => (
                                <button
                                  type="button"
                                  key={o.id}
                                  className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-xs"
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
                          );
                        })()
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs uppercase font-semibold text-slate-500 mb-1 block">Category</label>
                  <select name="category" className="input text-sm w-full" value={newItem.category} onChange={handleNewItemChange}>
                    <option value="">Select category</option>
                    <option value="installation">Installation</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="repair">Repair</option>
                    <option value="consultation">Consultation</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs uppercase font-semibold text-slate-500 mb-1 block">Qty</label>
                  <input type="number" name="qty" className="input text-sm w-full" value={newItem.qty} onChange={handleNewItemChange} />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs uppercase font-semibold text-slate-500 mb-1 block">Rate</label>
                  <input type="number" name="rate" className="input text-sm w-full" value={newItem.rate} onChange={handleNewItemChange} />
                </div>
                
                <div className="md:col-span-3">
                  <label className="text-xs uppercase font-semibold text-slate-500 mb-1 block">Disc %</label>
                  <input type="number" name="discount_percent" className="input text-sm w-full" value={newItem.discount_percent} onChange={handleNewItemChange} />
                </div>
                <div className="md:col-span-4">
                  <label className="text-xs uppercase font-semibold text-slate-500 mb-1 block">Tax Code</label>
                  <select name="tax_code_id" className="input text-sm w-full" value={newItem.tax_code_id} onChange={handleNewItemChange}>
                    <option value="">No Tax</option>
                    {taxCodes.map((t) => (<option key={t.id} value={String(t.id)}>{t.name}</option>))}
                  </select>
                  
                  {newItem.tax_code_id && (() => {
                    const tb = calcNewItemTaxBreakdown();
                    const tc = taxCodes.find((t) => String(t.id) === String(newItem.tax_code_id));
                    const isNoTax = /no\s*tax/i.test(String(tc?.name || ""));
                    if (isNoTax || tb.components.length === 0) return null;
                    return (
                      <div className="border border-brand/20 bg-brand/5 rounded-md p-2 text-[11px] mt-2">
                        <span className="font-bold block border-b border-brand/10 mb-1">Tax Calculation:</span>
                        {tb.components.map((c) => (
                          <div key={c.name} className="flex justify-between">
                            <span>{c.name} ({c.rate}%):</span>
                            <span className="font-semibold">{c.amount.toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between border-t border-brand/10 mt-1 pt-1 font-bold italic">
                          <span>Total Tax:</span>
                          <span>{tb.taxTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="md:col-span-5 flex items-end justify-end">
                  <button type="button" className="btn btn-primary px-6 py-2 text-sm flex items-center gap-2 h-10 w-full sm:w-auto justify-center" onClick={addItemToLines} disabled={!newItem.item_id || !newItem.qty}>
                    <span>+</span> Add Service
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="bg-[#f8f9fa]">
                <tr>
                  <th>#</th>
                  <th className="min-w-[300px]">Item</th>
                  <th>Category</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Disc%</th>
                  <th className="text-right">Tax</th>
                  <th className="text-right">Total</th>
                  {!readOnly && <th></th>}
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr><td colSpan="9" className="text-center py-10 text-slate-400 bg-slate-50 italic">No service items added yet.</td></tr>
                ) : (
                  lines.map((row, i) => {
                    const qty = Number(row.qty || 0);
                    const rate = Number(row.rate || 0);
                    const base = qty * rate;
                    const discPct = Number(row.discount_percent || 0);
                    const discAmt = base * (discPct / 100);
                    const net = base - discAmt;
                    const tax = Number(row.tax_amount || 0);
                    const total = Number(row.line_total || 0) || net + tax;
                    return (
                      <tr key={row.id || i} className="hover:bg-slate-50">
                        <td>{i + 1}</td>
                        <td>
                          {!readOnly ? (
                            <select className="input text-xs w-full" value={row.item_id || ""} onChange={(e) => handleLineChange(row.id, "item_id", e.target.value)}>
                              <option value="">Select item</option>
                              {serviceItems.map((it) => (<option key={it.id} value={String(it.id)}>{it.item_name}</option>))}
                            </select>
                          ) : (
                            <span className="font-medium text-[#0E3646]">{row.item_name || row.desc || "Unknown"}</span>
                          )}
                        </td>
                        <td className="text-xs text-slate-700 capitalize">{row.category}</td>
                        <td className="text-right">
                          {!readOnly ? (
                            <input type="number" className="input text-right text-xs w-20" value={row.qty} onChange={(e) => handleLineChange(row.id, "qty", e.target.value)} />
                          ) : row.qty}
                        </td>
                        <td className="text-right font-mono">
                          {!readOnly ? (
                            <input type="number" className="input text-right text-xs w-24" value={row.rate} onChange={(e) => handleLineChange(row.id, "rate", e.target.value)} />
                          ) : Number(row.rate).toFixed(2)}
                        </td>
                        <td className="text-right text-red-500">{row.discount_percent}%</td>
                        <td className="text-right text-slate-500">{tax.toFixed(2)}</td>
                        <td className="text-right font-bold text-[#0E3646]">{total.toFixed(2)}</td>
                        {!readOnly && (
                          <td className="text-center">
                            <button type="button" className="text-red-500 hover:text-red-800 transition-colors text-xs" onClick={() => removeRow(i)}>Remove</button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600">Sub Total:</span>
                <span className="font-semibold">{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-red-600">
                <span className="text-slate-600">Discount Amount:</span>
                <span>-{totals.discountAmount.toFixed(2)}</span>
              </div>
              {totals.components.length > 0 && (
              <>
              <div className="flex justify-between items-center py-2 border-b border-slate-200">
                <span className="font-medium">Tax</span>
                <span className="font-bold">{totals.taxAmount.toFixed(2)}</span>
              </div>
              {totals.components.map((c) => (
                <div key={c.name} className="flex justify-between items-center py-1 text-xs text-slate-500 pl-4">
                  <span>{c.name} ({c.rate}%):</span>
                  <span>{Number(c.amount || 0).toFixed(2)}</span>
                </div>
              ))}
              </>
              )}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600">Other Charges:</span>
                {!readOnly ? (
                  <input className={`input w-28 text-right text-xs ${disabledClass}`} type="number" value={bill.other_charges} onChange={(e) => update("other_charges", e.target.value)} readOnly={readOnly} />
                ) : totals.other.toFixed(2)}
              </div>
              <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-slate-900 dark:border-slate-100 text-lg font-bold text-[#0E3646]">
                <span>Total Amount:</span>
                <span>{totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>



      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Notes</div>
        </div>
        <div className="card-body">
          <textarea className={`input ${disabledClass}`} rows={3} value={bill.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Additional notes..." readOnly={readOnly} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => navigate("/transport/fuel-bills")} disabled={saving}>
          Cancel
        </button>
        {!readOnly && (
          <>
            <button type="button" className="btn-primary" onClick={() => saveBill()} disabled={saving}>
              {saving ? "Saving..." : "Save Bill"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
