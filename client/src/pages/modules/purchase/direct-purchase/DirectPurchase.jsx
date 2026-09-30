/**
 * @fileoverview DirectPurchase component.
 * Provides functionality for DirectPurchase.
 */

import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../../../api/client.js";
import { useNavigate, useLocation, useParams, Link } from "react-router-dom";
import UnitConversionModal from "../../../../components/UnitConversionModal.jsx";
import { useUoms } from "../../../../hooks/useUoms.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { useExchangeRate } from "../../../../hooks/useExchangeRate";
import { Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { filterByPrefix } from "@/utils/searchUtils.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DirectPurchase() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { canEditDiscount, hasExceptional } = usePermission();
  const canRecordDirectPayment = hasExceptional(
    "PURCHASE.DIRECT_PURCHASE.AUTO_PAYMENT",
  );
  const { getExchangeRate } = useExchangeRate();
  const dpId = params?.id ? Number(params.id) : null;
  const isViewMode =
    location?.pathname?.endsWith(`/direct-purchase/${params?.id || ""}`) &&
    String(new URLSearchParams(location.search).get("mode") || "") === "view";
  const [suppliers, setSuppliers] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [approvedItemRequisitions, setApprovedItemRequisitions] = useState([]);
  const [selectedGeneralRequisitionId, setSelectedGeneralRequisitionId] =
    useState("");
  const [currencies, setCurrencies] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    supplier_id: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    supplier_invoice_number: "",
    supplier_invoice_date: "",
    warehouse_id: "",
    currency_id: "",
    exchange_rate: 1,
    payment_type: "CASH",
    payment_terms: "",
    remarks: "",
    auto_payment: false,
    payment_account_id: "",
    payment_method: "Cash",
    payment_reference: "",
    cheque_date: "",
    paid_amount: "",
  });
  const baseCurrencyCode = useMemo(() => {
    return (
      currencies.find((c) => Number(c.is_base) === 1 || c.is_base === true)
        ?.code || "GHS"
    );
  }, [currencies]);
  const selectedCurrencyCode = useMemo(() => {
    return (
      currencies.find((c) => String(c.id) === String(form.currency_id))?.code ||
      ""
    );
  }, [currencies, form.currency_id]);
  const [baseCurrencyId, setBaseCurrencyId] = useState(null);
  const [standardPrices, setStandardPrices] = useState([]);
  const [unitConversions, setUnitConversions] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const { uoms } = useUoms();
  const defaultUomCode = useMemo(() => {
    const list = Array.isArray(uoms) ? uoms : [];
    const pcs =
      list.find((u) => String(u.uom_code || "").toUpperCase() === "PCS") ||
      list[0];
    if (pcs && pcs.uom_code) return pcs.uom_code;
    return "PCS";
  }, [uoms]);
  const [lines, setLines] = useState([]);
  const [itemQueries, setItemQueries] = useState({});
  const [newItem, setNewItem] = useState({
    item_id: "",
    qty: 1,
    unit_price: "",
    discount_percent: "",
    tax_code_id: "",
    tax_percent: 0,
    uom: "PCS",
    batch_no: "",
    mfg_date: "",
    exp_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [convModal, setConvModal] = useState({
    open: false,
    itemId: null,
    defaultUom: "",
    currentUom: "",
    rowIdx: null,
  });
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});

  useEffect(() => {
    let cancelled = false;
    async function loadExisting() {
      if (!dpId) return;
      try {
        const res = await api.get(`/purchase/direct-purchases/${dpId}`);
        const hdr = res?.data || null;
        if (!hdr) return;
        if (cancelled) return;
        setForm({
          supplier_id: hdr.supplier_id || "",
          purchase_date: String(hdr.dp_date || "").slice(0, 10),
          supplier_invoice_number: hdr.supplier_invoice_number || "",
          supplier_invoice_date: hdr.supplier_invoice_date
            ? String(hdr.supplier_invoice_date).slice(0, 10)
            : "",
          warehouse_id: hdr.warehouse_id || "",
          currency_id: hdr.currency_id || "",
          exchange_rate: Number(hdr.exchange_rate || 1),
          payment_type: hdr.payment_type || "CASH",
          payment_terms: hdr.payment_terms || "",
          remarks: hdr.remarks || "",
        });
        const details = Array.isArray(hdr.details) ? hdr.details : [];
        setLines(
          details.length
            ? details.map((d) => ({
                item_id: d.item_id,
                qty: d.qty,
                unit_price: d.unit_price,
                discount_percent: d.discount_percent,
                tax_percent: d.tax_percent,
                uom: d.uom || "PCS",
                batch_no: d.batch_no || "",
                mfg_date: d.mfg_date ? String(d.mfg_date).slice(0, 10) : "",
                exp_date: d.exp_date ? String(d.exp_date).slice(0, 10) : "",
                line_total: d.line_total,
              }))
            : [
                {
                  item_id: "",
                  qty: "",
                  unit_price: "",
                  discount_percent: "",
                  tax_percent: "",
                  uom: "PCS",
                  batch_no: "",
                  mfg_date: "",
                  exp_date: "",
                  line_total: 0,
                },
              ],
        );
      } catch {}
    }
    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [dpId]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [sup, wh, it, cur, std, conv, tax, reqs, accs] = await Promise.all([
          api.get("/purchase/suppliers").then((r) => r.data.items || []),
          api.get("/inventory/warehouses").then((r) => r.data.items || []),
          api.get("/inventory/items").then((r) => r.data.items || []),
          api.get("/finance/currencies").then((r) => r.data.items || []),
          api
            .get("/sales/prices/standard")
            .catch(() => ({ data: { items: [] } }))
            .then((r) => r.data.items || []),
          api
            .get("/inventory/unit-conversions")
            .catch(() => ({ data: { items: [] } }))
            .then((r) => r.data.items || []),
          api
            .get("/finance/tax-codes?form=DIRECT_PURCHASE")
            .catch(() => ({ data: { items: [] } }))
            .then((r) => r.data.items || []),
          api
            .get("/purchase/general-requisitions", {
              params: {
                status: "APPROVED",
                requisition_type: "ITEM",
                only_unlinked: 1,
              },
            })
            .then((r) => r.data.items || []),
          api
            .get("/finance/accounts")
            .catch(() => ({ data: { items: [] } }))
            .then((r) => r.data.items || []),
        ]);
        if (mounted) {
          setSuppliers(sup);
          setWarehouses(wh);
          setItems(it);
          setCurrencies(cur);
          setAccounts(Array.isArray(accs) ? accs : []);
          setStandardPrices(Array.isArray(std) ? std : []);
          setUnitConversions(Array.isArray(conv) ? conv : []);
          const mappedTaxes = (Array.isArray(tax) ? tax : []).map((t) => ({
            value: t.id,
            label: t.name,
            rate: Number(t.rate_percent),
          }));
          setTaxes(mappedTaxes);
          setApprovedItemRequisitions(Array.isArray(reqs) ? reqs : []);
          const base =
            (cur || []).find((c) => Number(c.is_base) === 1 || c.is_base === true)?.id || null;
          setBaseCurrencyId(base);
          if (base) {
            setForm((prev) =>
              prev.currency_id ? prev : { ...prev, currency_id: base },
            );
          }
        }
      } catch (e) {}
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!form.currency_id || currencies.length === 0) return;
    const selected = currencies.find(
      (c) => String(c.id) === String(form.currency_id),
    );
    const base = currencies.find(
      (c) => Number(c.is_base) === 1 || c.is_base === true,
    );
    if (!selected || !base) return;

    if (selected.code === base.code) {
      setForm((p) => ({ ...p, exchange_rate: 1 }));
      return;
    }

    getExchangeRate(selected.code, base.code).then((rate) => {
      if (rate) {
        setForm((p) => ({ ...p, exchange_rate: rate }));
      }
    });
  }, [form.currency_id, currencies, getExchangeRate]);

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
    const ids = lines.map((l) => l.tax_code_id);
    if (newItem.tax_code_id) ids.push(newItem.tax_code_id);

    const uniqueTaxIds = Array.from(
      new Set(ids.filter((id) => id && id !== "undefined")),
    );
    const missing = uniqueTaxIds.filter((id) => !(id in taxComponentsByCode));
    if (missing.length) {
      Promise.all(missing.map((id) => fetchTaxComponentsForCode(id)));
    }
  }, [lines, newItem.tax_code_id]);

  const calcNewItemTaxBreakdown = () => {
    const qty = Number(newItem.qty || 0);
    const price = Number(newItem.unit_price || 0);
    const discP = Number(newItem.discount_percent || 0);
    const gross = qty * price;
    const disc = gross * (discP / 100);
    const taxableTotal = Math.max(0, gross - disc);

    const components = [];
    let taxTotal = 0;
    const comps = taxComponentsByCode[String(newItem.tax_code_id)] || [];

    if (comps.length > 0) {
      comps.forEach((c) => {
        const rate = Number(c.rate_percent) || 0;
        if (rate === 0) return;
        const amt = (taxableTotal * rate) / 100;
        components.push({
          name: c.component_name,
          rate,
          amount: amt,
        });
        taxTotal += amt;
      });
    } else {
      const rate = Number(newItem.tax_percent || 0);
      const amt = (taxableTotal * rate) / 100;
      if (rate > 0) {
        components.push({
          name: "Tax",
          rate,
          amount: amt,
        });
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
        const it = items.find((x) => Number(x.id) === Number(value));
        const fallbackUom = it?.uom || defaultUomCode;
        let unitPrice = it && Number(it.cost_price) ? Number(it.cost_price) : 0;
        next.uom = String(fallbackUom || "PCS");
        next.unit_price = unitPrice;

        // Try to fetch item tax if applicable (added in modernize)
        const fetchTax = async () => {
          try {
            const res = await api.get(`/finance/item-tax/${value}`);
            const tax = res.data?.tax;
            if (tax && tax.id) {
              setNewItem((p) =>
                p.item_id === value
                  ? {
                      ...p,
                      tax_code_id: String(tax.id),
                      tax_percent: Number(tax.tax_rate),
                    }
                  : p,
              );
            }
          } catch {}
        };
        fetchTax();
      }
      if (name === "tax_code_id") {
        const tax = taxes.find((t) => String(t.value) === String(value));
        next.tax_percent = tax ? tax.rate : 0;
      }
      return next;
    });
  };

  const addItemToLines = () => {
    if (!newItem.item_id) {
      toast.warning("Please search and select an item first");
      const el = document.getElementById("dp-item-search");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
      return;
    }
    if (!newItem.qty || Number(newItem.qty) <= 0) {
      toast.warning("Please enter a valid quantity greater than 0");
      return;
    }
    const { taxTotal, taxableTotal } = calcNewItemTaxBreakdown();
    const it = items.find((x) => Number(x.id) === Number(newItem.item_id));

    setLines((prev) => [
      ...prev,
      {
        ...newItem,
        id: Date.now(),
        item_name: it?.item_name || "",
        item_code: it?.item_code || "",
        line_total: taxableTotal + taxTotal,
      },
    ]);

    setItemQueries((prev) => ({ ...prev, new: "" }));
    setNewItem({
      item_id: "",
      qty: 1,
      unit_price: "",
      discount_percent: "",
      tax_code_id: "",
      tax_percent: 0,
      uom: defaultUomCode,
      batch_no: "",
      mfg_date: "",
      exp_date: "",
    });
    toast.success(`Added ${it?.item_name || "item"} to purchase`);
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    const compTotals = {};

    for (const l of lines) {
      const qty = Number(l.qty || 0);
      const unit = Number(l.unit_price || 0);
      const discP = Number(l.discount_percent || 0);
      const gross = qty * unit;
      const disc = gross * (discP / 100);
      const base = Math.max(0, gross - disc);
      subtotal += gross;
      totalDiscount += disc;

      const taxCodeId = l.tax_code_id;
      const comps = taxComponentsByCode[String(taxCodeId)] || [];
      if (comps.length > 0) {
        comps.forEach((c) => {
          const rate = Number(c.rate_percent) || 0;
          if (rate === 0) return;
          const amt = (base * rate) / 100;
          const name = c.component_name;
          if (!compTotals[name]) {
            compTotals[name] = {
              amount: 0,
              rate,
              sort_order: c.sort_order || 0,
            };
          }
          compTotals[name].amount += amt;
        });
      } else {
        const taxP = Number(l.tax_percent || 0);
        const taxVal = (base * taxP) / 100;
        if (taxP > 0) {
          const name = "Tax";
          if (!compTotals[name]) {
            compTotals[name] = { amount: 0, rate: taxP, sort_order: 99 };
          }
          compTotals[name].amount += taxVal;
        }
      }
    }

    const components = Object.keys(compTotals)
      .map((name) => ({
        name,
        amount: compTotals[name].amount,
        rate: compTotals[name].rate,
        sort_order: compTotals[name].sort_order,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);

    const totalTax = components.reduce((s, c) => s + c.amount, 0);
    const grandTotal = subtotal - totalDiscount + totalTax;

    return { subtotal, totalDiscount, totalTax, grandTotal, components };
  }, [lines, taxComponentsByCode]);

  const isChequeLike = useMemo(
    () =>
      ["Cheque", "Bank Transfer", "Credit Card"].includes(
        form.payment_method || "",
      ),
    [form.payment_method],
  );

  const selectablePaymentAccounts = useMemo(() => {
    const list = Array.isArray(accounts) ? accounts : [];
    return list.filter((a) => {
      const gc = String(a.group_code || "").toUpperCase();
      const gn = String(a.group_name || "").toUpperCase();
      return isChequeLike
        ? gc === "AST_BANK" || gn === "BANK ACCOUNTS"
        : gc === "AST_CASH" || gn === "CASH AND CASH EQUIVALENTS";
    });
  }, [accounts, isChequeLike]);

  useEffect(() => {
    if (!form.auto_payment) return;
    const acc = accounts.find(
      (a) => String(a.id) === String(form.payment_account_id || ""),
    );
    if (!acc) return;
    const gc = String(acc.group_code || "").toUpperCase();
    const gn = String(acc.group_name || "").toUpperCase();
    const wantsBank = isChequeLike;
    const ok = wantsBank
      ? gc === "AST_BANK" || gn === "BANK ACCOUNTS"
      : gc === "AST_CASH" || gn === "CASH AND CASH EQUIVALENTS";
    if (!ok) updateForm("payment_account_id", "");
  }, [form.auto_payment, isChequeLike, accounts, form.payment_account_id]);
  const totalInCurrentCurrency = useMemo(
    () =>
      Number(totals.subtotal || 0) +
      (0 - Number(totals.totalDiscount || 0)) +
      Number(totals.totalTax || 0) +
      Number(form.freight_charges || 0) +
      Number(form.other_charges || 0),
    [totals, form.freight_charges, form.other_charges],
  );
  const totalInBaseCurrency = useMemo(
    () =>
      Number(totalInCurrentCurrency || 0) *
      (Number(form.exchange_rate || 1) || 1),
    [totalInCurrentCurrency, form.exchange_rate],
  );
  const showBaseTotalRow = useMemo(
    () =>
      Math.abs(
        Number(totalInBaseCurrency || 0) - Number(totalInCurrentCurrency || 0),
      ) > 0.000001,
    [totalInBaseCurrency, totalInCurrentCurrency],
  );

  useEffect(() => {
    if (form.auto_payment) {
      updateForm(
        "paid_amount",
        totalInCurrentCurrency > 0 ? String(totalInCurrentCurrency) : "",
      );
    }
  }, [totalInCurrentCurrency, form.auto_payment]);

  function updateForm(k, v) {
    if (k === "payment_type") {
      setForm((prev) => {
        return { ...prev, payment_type: v };
      });
      return;
    }
    setForm((prev) => ({ ...prev, [k]: v }));
  }
  function onSupplierChange(id) {
    const sid = id ? Number(id) : null;
    const sup = suppliers.find((s) => Number(s.id) === sid) || null;
    const byCode = sup?.currency_code
      ? currencies.find(
          (c) =>
            String(c.code || "").toUpperCase() ===
            String(sup.currency_code || "").toUpperCase(),
        )
      : null;
    const curId = sup?.currency_id ?? byCode?.id ?? baseCurrencyId ?? "";
    const terms = sup?.payment_terms ?? "";
    setForm((prev) => ({
      ...prev,
      supplier_id: id,
      currency_id: curId || "",
      payment_terms: terms,
    }));
  }
  function recomputeLineTotals(row) {
    const qty = Number(row.qty || 0);
    const price = Number(row.unit_price || 0);
    const discPct = Number(row.discount_percent || 0);
    const taxPct = Number(row.tax_percent || 0);
    const base = qty * price;
    const disc = base * (discPct / 100);
    const taxable = base - disc;

    const comps = taxComponentsByCode[String(row.tax_code_id)] || [];
    let tax = 0;
    if (comps.length > 0) {
      comps.forEach((c) => {
        tax += (taxable * Number(c.rate_percent || 0)) / 100;
      });
    } else {
      tax = taxable * (taxPct / 100);
    }
    return { ...row, line_total: taxable + tax };
  }
  function updateLine(i, k, v) {
    setLines((prev) => {
      const next = [...prev];
      next[i] = recomputeLineTotals({ ...next[i], [k]: v });
      return next;
    });
  }
  function onItemChange(i, itemId) {
    const it = items.find((x) => Number(x.id) === Number(itemId));
    const fallbackUom = it?.uom || defaultUomCode;
    let unitPrice =
      it && Number(it.cost_price)
        ? Number(it.cost_price)
        : Number(lines[i]?.unit_price || 0);
    setLines((prev) => {
      const next = [...prev];
      next[i] = recomputeLineTotals({
        ...next[i],
        item_id: itemId,
        uom: String(fallbackUom || "PCS"),
        unit_price: unitPrice,
      });
      return next;
    });
  }
  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        item_id: "",
        qty: "",
        unit_price: "",
        discount_percent: "",
        tax_percent: "",
        uom: "PCS",
        mfg_date: "",
        exp_date: "",
        line_total: 0,
      },
    ]);
  }
  function removeLine(i) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function openVerifyQty(i, row) {
    if (isViewMode) return;
    const it = items.find((ai) => Number(ai.id) === Number(row.item_id));
    const defaultUom =
      (it?.uom && String(it.uom)) ||
      String(row.uom || "") ||
      String(defaultUomCode || "");
    const nonDefaults = (Array.isArray(unitConversions) ? unitConversions : [])
      .filter(
        (c) =>
          Number(c.is_active) &&
          Number(c.item_id) === Number(row.item_id) &&
          String(c.to_uom) === defaultUom,
      )
      .map((c) => String(c.from_uom));
    const currentUom = String(row.uom || "");
    const preferredUom =
      currentUom && currentUom !== defaultUom
        ? currentUom
        : nonDefaults[0] || "";
    const hasConv =
      nonDefaults.length > 0 && preferredUom && preferredUom !== defaultUom;
    if (!hasConv) return;
    setConvModal({
      open: true,
      itemId: row.item_id,
      defaultUom: defaultUom,
      currentUom: preferredUom,
      rowIdx: i,
    });
  }
  function applyConversion({ item_id, to_uom, converted_qty }) {
    setLines((prev) => {
      const next = [...prev];
      const idx = convModal.rowIdx;
      if (idx != null && next[idx]) {
        next[idx] = recomputeLineTotals({
          ...next[idx],
          qty: converted_qty,
          uom: to_uom,
        });
      }
      return next;
    });
  }

  async function fetchAccountBalance(accountId) {
    if (!accountId) return null;
    try {
      const res = await api.get(`/finance/accounts/${accountId}/balance`);
      return res.data?.balance ?? res.data?.item?.balance ?? null;
    } catch {
      return null;
    }
  }

  async function submit(action) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        supplier_id: Number(form.supplier_id),
        purchase_date: form.purchase_date,
        supplier_invoice_number: form.supplier_invoice_number
          ? String(form.supplier_invoice_number).trim()
          : null,
        supplier_invoice_date: form.supplier_invoice_date || null,
        warehouse_id: Number(form.warehouse_id),
        currency_id: form.currency_id ? Number(form.currency_id) : null,
        exchange_rate: Number(form.exchange_rate || 1),
        payment_type: String(form.payment_type || "CASH"),
        payment_terms: form.payment_terms ? Number(form.payment_terms) : null,
        remarks: form.remarks || null,
        status: action === "post" ? "POSTED" : "DRAFT",
        auto_payment: Boolean(canRecordDirectPayment && form.auto_payment),
        payment_account_id: form.auto_payment
          ? Number(form.payment_account_id) || null
          : null,
        payment_method: form.auto_payment ? form.payment_method || "Cash" : null,
        payment_reference: form.auto_payment
          ? form.payment_reference || null
          : null,
        cheque_date: form.auto_payment ? form.cheque_date || null : null,
        paid_amount: form.auto_payment
          ? Number(form.paid_amount || totalInCurrentCurrency || 0)
          : null,
        details: lines
          .filter((l) => Number(l.item_id) && Number(l.qty))
          .map((l) => ({
            item_id: Number(l.item_id),
            qty: Number(l.qty),
            unit_price: Number(l.unit_price || 0),
            discount_percent: Number(l.discount_percent || 0),
            tax_percent: Number(l.tax_percent || 0),
            uom: String(l.uom || "PCS"),
            tax_code_id: l.tax_code_id || null,
            batch_no: l.batch_no || null,
            mfg_date: l.mfg_date || null,
            exp_date: l.exp_date || null,
          })),
      };
      if (!payload.supplier_id) {
        setError("Supplier is required");
        setSaving(false);
        return;
      }
      if (!payload.warehouse_id) {
        setError("Warehouse is required");
        setSaving(false);
        return;
      }
      if (!payload.details.length) {
        setError("Add at least one item with quantity");
        setSaving(false);
        return;
      }
      if (payload.auto_payment) {
        if (!payload.payment_account_id) {
          setError("Payment Account is required for Paid Upon Purchase");
          setSaving(false);
          return;
        }
        const bal = await fetchAccountBalance(payload.payment_account_id);
        if (
          bal !== null &&
          bal !== undefined &&
          Number(bal) < Number(payload.paid_amount || 0)
        ) {
          const msg =
            "Insufficient funds in the selected payment account to settle this purchase amount.";
          setError(msg);
          toast.error(msg);
          setSaving(false);
          return;
        }
      }
      const resp = dpId
        ? await api.put(`/purchase/direct-purchases/${dpId}`, payload)
        : await api.post("/purchase/direct-purchases", payload);
      const dp = resp?.data || {};
      const createdId = dp?.id || dpId || null;
      if (createdId && selectedGeneralRequisitionId) {
        try {
          await api.post(
            `/purchase/general-requisitions/${selectedGeneralRequisitionId}/link`,
            { ref_type: "DIRECT_PURCHASE", ref_id: Number(createdId) },
          );
        } catch {}
      }
      toast.success(
        dpId
          ? "Direct Purchase updated successfully"
          : "Direct Purchase created successfully",
      );
      navigate("/purchase/direct-purchase");
    } catch (e) {
      setError(String(e?.response?.data?.message || e.message || "Error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="rounded-lg border border-[#dee2e6] bg-white shadow-erp">
        <div className="px-6 py-4 border-b bg-brand text-white rounded-t-lg flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Direct Purchase</h1>
            <p className="text-sm mt-1 opacity-90">
              Complete a full purchase in one step
            </p>
          </div>
          <button onClick={() => window.history.back()} className="px-3 py-1.5 rounded bg-white text-brand hover:bg-slate-100"
          >
            ← Back to List
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error ? <div className="alert alert-error">{error}</div> : null}
          {success ? (
            <div className="alert alert-success">{success}</div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative flex flex-col gap-1">
              <label className="label">Supplier</label>
              <input
                type="text"
                className="input"
                placeholder="Search supplier..."
                value={
                  suppliers.find(
                    (s) => String(s.id) === String(form.supplier_id),
                  )?.supplier_name || supplierSearch
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setSupplierSearch(val);
                  setForm((prev) => ({ ...prev, supplier_id: "" }));
                }}
                disabled={isViewMode}
              />
              {!isViewMode &&
                supplierSearch &&
                (() => {
                  const q = supplierSearch.toLowerCase();
                  const matched = suppliers
                    .filter(
                      (s) =>
                        String(s.supplier_name || "")
                          .toLowerCase()
                          .includes(q) ||
                        String(s.supplier_code || "")
                          .toLowerCase()
                          .includes(q),
                    )
                    .slice(0, 10);
                  return matched.length > 0 ? (
                    <div
                      className="absolute z-30 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto"
                      style={{ top: "100%" }}
                    >
                      {matched.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            onSupplierChange(String(s.id));
                            setSupplierSearch("");
                          }}
                        >
                          <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                            {s.supplier_name}
                          </div>
                          {s.supplier_code && (
                            <div className="text-xs text-slate-500">
                              {s.supplier_code}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Requisition</label>
              <select
                className="input"
                value={selectedGeneralRequisitionId}
                onChange={async (e) => {
                  const val = e.target.value;
                  setSelectedGeneralRequisitionId(val);
                  const rid = Number(val);
                  if (Number.isFinite(rid) && rid > 0) {
                    try {
                      const res = await api.get(
                        `/purchase/general-requisitions/${rid}`,
                      );
                      const gr = res.data || null;
                      const grItems = Array.isArray(gr?.items) ? gr.items : [];
                      const mapped = grItems
                        .filter((ln) => Number(ln.item_id))
                        .map((ln) => ({
                          item_id: String(ln.item_id),
                          qty: Number(ln.qty || 0),
                          unit_price: Number(ln.estimated_unit_cost || 0),
                          discount_percent: "",
                          tax_percent: "",
                          uom: String(ln.uom || "PCS"),
                          line_total:
                            Number(ln.qty || 0) *
                            Number(ln.estimated_unit_cost || 0),
                        }));
                      if (mapped.length) setLines(mapped);
                    } catch {}
                  }
                }}
                disabled={isViewMode}
              >
                <option value="">Select Approved Requisition</option>
                {approvedItemRequisitions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.requisition_no} — {r.department || ""} —{" "}
                    {String(r.requisition_date || "").slice(0, 10)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Purchase Date</label>
              <input
                type="date"
                className="input"
                value={form.purchase_date}
                onChange={(e) => updateForm("purchase_date", e.target.value)}
                disabled={isViewMode}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Supplier Invoice Number</label>
              <input
                className="input"
                value={form.supplier_invoice_number || ""}
                onChange={(e) =>
                  updateForm("supplier_invoice_number", e.target.value)
                }
                disabled={isViewMode}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Invoice Date</label>
              <input
                type="date"
                className="input"
                value={form.supplier_invoice_date || ""}
                onChange={(e) =>
                  updateForm("supplier_invoice_date", e.target.value)
                }
                disabled={isViewMode}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Warehouse</label>
              <select
                className="input"
                value={form.warehouse_id}
                onChange={(e) => updateForm("warehouse_id", e.target.value)}
                disabled={isViewMode}
              >
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Currency</label>
              <select
                className="input"
                value={form.currency_id}
                onChange={(e) => updateForm("currency_id", e.target.value)}
                disabled={isViewMode}
              >
                <option value="">Select currency</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} {c.is_base ? "(Base)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="label">Exchange Rate</label>
              <input
                type="number"
                className="input"
                value={form.exchange_rate}
                onChange={(e) => updateForm("exchange_rate", e.target.value)}
                readOnly
              />
            </div>
            {form.payment_type === "CREDIT" && (
              <div className="flex flex-col gap-1">
                <label className="label">Payment Terms</label>
                <input
                  type="number"
                  className="input"
                  value={form.payment_terms}
                  onChange={(e) => updateForm("payment_terms", e.target.value)}
                  disabled={isViewMode}
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="label">Payment Type</label>
              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="payment_type"
                    value="CASH"
                    checked={(form.payment_type || "CASH") === "CASH"}
                    onChange={(e) => updateForm("payment_type", e.target.value)}
                    disabled={isViewMode}
                  />
                  <span>Cash</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="payment_type"
                    value="CREDIT"
                    checked={form.payment_type === "CREDIT"}
                    onChange={(e) => updateForm("payment_type", e.target.value)}
                    disabled={isViewMode}
                  />
                  <span>Credit</span>
                </label>
              </div>
            </div>
            <div className="md:col-span-3 flex flex-col gap-1">
              <label className="label">Remarks</label>
              <textarea
                className="input w-96"
                rows="4"
                value={form.remarks}
                onChange={(e) => updateForm("remarks", e.target.value)}
                disabled={isViewMode}
              />
            </div>
          </div>
          {/* Add Item Card matching screenshot */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6">
            <h3 className="text-sm font-bold text-[#0E3646] mb-4">
              Add Item
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3 items-end">
              {/* Row 1 */}
              {/* Item * */}
              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Item *
                </label>
                <div className="relative">
                  <input
                    id="dp-item-search"
                    autoComplete="off"
                    className="input w-full text-xs"
                    placeholder="Scan barcode or type item name"
                    value={itemQueries.new || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItemQueries((prev) => ({ ...prev, new: val }));
                      if (newItem.item_id) {
                        setNewItem((prev) => ({
                          ...prev,
                          item_id: "",
                          uom: defaultUomCode,
                          unit_price: 0,
                        }));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const query = (itemQueries.new || "").trim();
                        const searchResults = query
                          ? filterByPrefix(items, {
                              query,
                              searchFields: [
                                "item_code",
                                "item_name",
                                "barcode",
                              ],
                            })
                          : [];
                        if (!query || !searchResults.length) return;
                        handleNewItemChange({
                          target: {
                            name: "item_id",
                            value: String(searchResults[0].id),
                          },
                        });
                        setItemQueries((prev) => ({
                          ...prev,
                          new: searchResults[0].item_name,
                        }));
                      }
                    }}
                    disabled={isViewMode}
                  />
                  {(() => {
                    const query = (itemQueries.new || "").trim();
                    const searchResults = query
                      ? filterByPrefix(items, {
                          query,
                          searchFields: ["item_code", "item_name", "barcode"],
                        })
                      : [];
                    return searchResults.length && !newItem.item_id ? (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                        {searchResults.map((o) => (
                          <button
                            type="button"
                            key={o.id}
                            className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-xs"
                            onClick={() => {
                              handleNewItemChange({
                                target: {
                                  name: "item_id",
                                  value: String(o.id),
                                },
                              });
                              setItemQueries((prev) => ({
                                ...prev,
                                new: o.item_name,
                              }));
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

              {/* Qty * */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Qty *
                </label>
                <input
                  type="number"
                  name="qty"
                  className="input w-full text-xs"
                  value={newItem.qty}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                  min="1"
                />
              </div>

              {/* UOM */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  UOM
                </label>
                <select
                  name="uom"
                  className="input w-full text-xs"
                  value={newItem.uom}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                >
                  {uoms.map((u) => (
                    <option key={u.id} value={u.uom_code}>
                      {u.uom_code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Price
                </label>
                <input
                  type="number"
                  name="unit_price"
                  className="input w-full text-xs"
                  value={newItem.unit_price}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                />
              </div>

              {/* Total */}
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Total
                </label>
                <input
                  type="text"
                  disabled
                  className="input w-full text-xs bg-slate-50 text-slate-700 font-semibold"
                  value={(Number(newItem.qty || 0) * Number(newItem.unit_price || 0)).toFixed(2)}
                />
              </div>

              {/* Disc % */}
              <div className="md:col-span-1">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Disc %
                </label>
                <input
                  type="number"
                  name="discount_percent"
                  className="input w-full text-xs"
                  value={newItem.discount_percent}
                  onChange={handleNewItemChange}
                  disabled={isViewMode || !canEditDiscount()}
                />
              </div>

              {/* Row 2 */}
              {/* Tax Code */}
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tax Code
                </label>
                <select
                  name="tax_code_id"
                  className="input w-full text-xs"
                  value={newItem.tax_code_id}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                >
                  <option value="">No Tax</option>
                  {taxes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch No */}
              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Batch No
                </label>
                <input
                  type="text"
                  name="batch_no"
                  className="input w-full text-xs"
                  value={newItem.batch_no}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                  placeholder="Optional"
                />
              </div>

              {/* Mfg Date */}
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mfg Date
                </label>
                <input
                  type="date"
                  name="mfg_date"
                  className="input w-full text-xs"
                  value={newItem.mfg_date}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                />
              </div>

              {/* Exp Date */}
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Exp Date
                </label>
                <input
                  type="date"
                  name="exp_date"
                  className="input w-full text-xs"
                  value={newItem.exp_date}
                  onChange={handleNewItemChange}
                  disabled={isViewMode}
                />
              </div>
            </div>

            {/* Bottom Row with + Add Item button */}
            <div className="flex justify-end mt-4 pt-1" data-rbac-exempt="true">
              {!isViewMode && (
                <button
                  type="button"
                  id="dp-add-item-btn"
                  data-rbac-exempt="true"
                  style={{ display: "inline-flex" }}
                  className="px-5 py-2 bg-[#0E3646] hover:bg-[#082330] text-white rounded-lg font-medium text-sm shadow-sm items-center gap-1.5 transition-all cursor-pointer"
                  onClick={addItemToLines}
                >
                  <span className="text-base leading-none font-bold">+</span> Add Item
                </button>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="overflow-x-auto rounded border border-[#dee2e6]" data-rbac-exempt="true">
              <table className="table" data-rbac-exempt="true">
                <thead className="bg-[#f8f9fa]">
                  <tr>
                    <th style={{ width: 960 }}>Item Details</th>
                    <th style={{ width: 100 }}>Qty</th>
                    <th style={{ width: 100 }}>UOM</th>
                    <th style={{ width: 180 }}>Batch/Mfg/Exp</th>
                    <th style={{ width: 120 }}>Unit Price</th>
                    <th style={{ width: 100 }}>Disc%</th>
                    <th style={{ width: 120 }}>Net</th>
                    <th style={{ width: 120 }}>Tax</th>
                    <th style={{ width: 140 }} className="text-right">
                      Line Total
                    </th>
                    <th style={{ width: 70 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td
                        colSpan="10"
                        className="text-center py-10 text-gray-500 italic bg-gray-50"
                      >
                        No items added yet. Use the section above to add items to this purchase.
                      </td>
                    </tr>
                  ) : (
                    lines.map((l, i) => {
                      const gross =
                        Number(l.qty || 0) * Number(l.unit_price || 0);
                      const disc =
                        gross * (Number(l.discount_percent || 0) / 100);
                      const net = gross - disc;
                      const tax = Number(l.line_total || 0) - net;
                      return (
                        <tr
                          key={l.id || i}
                          className="hover:bg-slate-50 transition-colors border-b last:border-0 border-slate-100"
                        >
                          <td>
                            <div className="font-semibold text-[#0E3646] truncate max-w-[900px]">
                              {l.item_name}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {l.item_code}
                            </div>
                          </td>
                          <td className="text-center font-medium">{l.qty}</td>
                          <td className="text-center">{l.uom}</td>
                          <td>
                            {l.batch_no && (
                              <div className="text-xs truncate max-w-[170px]">
                                <b>B:</b> {l.batch_no}
                              </div>
                            )}
                            {l.mfg_date && (
                              <div className="text-[10px] text-gray-500">
                                <b>M:</b> {l.mfg_date}
                              </div>
                            )}
                            {l.exp_date && (
                              <div className="text-[10px] text-red-500">
                                <b>E:</b> {l.exp_date}
                              </div>
                            )}
                          </td>
                          <td className="text-right">
                            {Number(l.unit_price).toFixed(2)}
                          </td>
                          <td className="text-right">{l.discount_percent}%</td>
                          <td className="text-right font-medium">
                            {net.toFixed(2)}
                          </td>
                          <td className="text-right text-gray-600">
                            {tax.toFixed(2)}
                          </td>
                          <td className="text-right font-bold text-[#0E3646]">
                            {Number(l.line_total).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td>
                            {!isViewMode && (
                              <button
                                type="button"
                                data-rbac-exempt="true"
                                className="text-red-600 hover:text-red-900 transition-colors p-1"
                                onClick={() => removeLine(i)}
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#f8f9fa] p-5 rounded-lg mt-5 border border-[#dee2e6]">
            <div className="flex justify-between py-2 border-b border-[#dee2e6]">
              <span className="text-sm font-medium">Subtotal:</span>
              <span className="font-bold">
                {Number(totals.subtotal || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#dee2e6]">
              <span className="text-sm font-medium">Total Discount:</span>
              <span className="font-bold">
                {Number(totals.totalDiscount || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            {(totals.components || []).map((c) => (
              <div
                key={c.name}
                className="flex justify-between py-1 text-xs text-gray-600 pl-4"
              >
                <span>{c.name}</span>
                <span>
                  {Number(c.amount || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            ))}
            <div className="flex justify-between py-2 border-b border-[#dee2e6]">
              <span className="text-sm font-medium">Total Tax:</span>
              <span className="font-bold">
                {Number(totals.totalTax || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between py-3 text-lg font-bold text-[#0E3646]">
              <span>Grand Total:</span>
              <span>
                {Number(totalInCurrentCurrency || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            {showBaseTotalRow ? (
              <div className="flex justify-between py-3 text-lg font-bold text-[#0E3646]">
                <span>{`Total ${baseCurrencyCode}:`}</span>
                <span>
                  {Number(totalInBaseCurrency || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            ) : null}
          </div>

          {canRecordDirectPayment && !isViewMode && (
            <div className="bg-brand/5 border border-brand/20 rounded-lg p-5 mt-5">
              <div className="flex items-center justify-between pb-3 border-b border-brand/15">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-brand rounded border-gray-300 focus:ring-brand"
                    checked={Boolean(form.auto_payment)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateForm("auto_payment", checked);
                      if (checked) {
                        updateForm(
                          "paid_amount",
                          totalInCurrentCurrency > 0
                            ? String(totalInCurrentCurrency)
                            : "",
                        );
                      }
                    }}
                  />
                  <span className="font-bold text-base text-brand dark:text-brand-300">
                    Paid Upon Purchase
                  </span>
                </label>
              </div>

              {form.auto_payment && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-1">
                  <div className="flex flex-col gap-1">
                    <label className="label font-medium">
                      Payment Method *
                    </label>
                    <select
                      className="input w-full"
                      value={form.payment_method || "Cash"}
                      onChange={(e) => {
                        updateForm("payment_method", e.target.value);
                        updateForm("payment_account_id", "");
                      }}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Mobile Money">Mobile Money</option>
                      <option value="Credit Card">Credit Card</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="label font-medium">
                      Payment Account *
                    </label>
                    <select
                      className="input w-full"
                      value={form.payment_account_id || ""}
                      onChange={(e) =>
                        updateForm("payment_account_id", e.target.value)
                      }
                      required
                    >
                      <option value="">-- Select Payment Account --</option>
                      {selectablePaymentAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}{" "}
                          {a.currency_code ? `(${a.currency_code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="label font-medium">
                      {isChequeLike ? "Cheque / Ref No" : "Payment Reference"}
                    </label>
                    <input
                      className="input w-full"
                      placeholder="e.g. TR-9481 / Cheque #"
                      value={form.payment_reference || ""}
                      onChange={(e) =>
                        updateForm("payment_reference", e.target.value)
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="label font-medium">
                      Amount Paid *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        className="input w-full font-semibold"
                        placeholder="0.00"
                        value={
                          form.paid_amount !== ""
                            ? form.paid_amount
                            : totalInCurrentCurrency > 0
                              ? totalInCurrentCurrency
                              : ""
                        }
                        onChange={(e) =>
                          updateForm("paid_amount", e.target.value)
                        }
                      />
                    </div>
                    <span className="text-[11px] text-gray-500">
                      Default: Total Bill Amount (
                      {selectedCurrencyCode || baseCurrencyCode}{" "}
                      {Number(totalInCurrentCurrency || 0).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2 },
                      )}
                      )
                    </span>
                  </div>

                  {isChequeLike && (
                    <div className="flex flex-col gap-1">
                      <label className="label font-medium">Cheque Date</label>
                      <input
                        type="date"
                        className="input w-full"
                        value={form.cheque_date || ""}
                        onChange={(e) =>
                          updateForm("cheque_date", e.target.value)
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!isViewMode ? (
            <div className="mt-6 flex justify-end gap-3 pb-28">
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={() => submit("post")}
              >
                Save
              </button>
              <button
                className="btn"
                onClick={() => navigate("/purchase/direct-purchase")}
              >
                Back
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <UnitConversionModal
        open={convModal.open}
        onClose={() => setConvModal((p) => ({ ...p, open: false }))}
        itemId={convModal.itemId}
        defaultUom={convModal.defaultUom}
        currentUom={convModal.currentUom}
        conversions={unitConversions}
        onApply={applyConversion}
      />
    </div>
  );
}
