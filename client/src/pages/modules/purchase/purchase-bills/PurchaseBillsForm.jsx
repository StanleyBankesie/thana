/**
 * @fileoverview PurchaseBillsForm component.
 * Provides functionality for PurchaseBillsForm.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { Trash2, Plus } from "lucide-react";
import { useExchangeRate } from "../../../../hooks/useExchangeRate";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

const CURRENCIES = [
  { id: 4, code: "GHS", name: "Ghanaian Cedi" },
  { id: 1, code: "USD", name: "US Dollar" },
  { id: 2, code: "EUR", name: "Euro" },
  { id: 3, code: "GBP", name: "British Pound" },
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PurchaseBillsForm() {
  const { canAccessPath, isModuleEnabled } = usePermission();
  const canAccessProjects = Boolean(
    canAccessPath?.("/project-management") ||
      (typeof isModuleEnabled === "function" && isModuleEnabled("project-management")),
  );
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getExchangeRate } = useExchangeRate();

  const isNew = !id || id === "new";
  const billType = location.pathname.includes("purchase-bills-import")
    ? "IMPORT"
    : "LOCAL";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [grns, setGrns] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [itemOptions, setItemOptions] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [finCurrencies, setFinCurrencies] = useState([]);
  const [baseFinCurrencyId, setBaseFinCurrencyId] = useState(null);
  const [taxCodes, setTaxCodes] = useState([]);
  const [currentBillId, setCurrentBillId] = useState(
    id && id !== "new" ? Number(id) : null,
  );
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});
  const [projects, setProjects] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [poTaxCodeMap, setPoTaxCodeMap] = useState({});

  const [formData, setFormData] = useState({
    bill_no: "",
    bill_date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    po_id: "",
    grn_id: "",
    bill_type: billType,
    due_date: "",
    currency_id: "",
    exchange_rate: 1,
    payment_terms: 30,
    project_id: "",
    cost_center_id: "",
    status: "DRAFT",

    discount_amount: 0,
    freight_charges: 0,
    other_charges: 0,
  });

  const [lines, setLines] = useState([]);
  const [newItem, setNewItem] = useState({
    item_id: "",
    uom_id: "",
    qty: 1,
    unit_price: 0,
    discount_percent: 0,
    tax_code_id: "",
    tax_amount: 0,
  });

  const baseCurrencyCode = useMemo(() => {
    return (
      finCurrencies.find((c) => Number(c.is_base) === 1 || c.is_base === true)
        ?.code || "GHS"
    );
  }, [finCurrencies]);

  const selectedCurrencyCode = useMemo(() => {
    return (
      finCurrencies.find((c) => String(c.id) === String(formData.currency_id))
        ?.code || ""
    );
  }, [finCurrencies, formData.currency_id]);

  useEffect(() => {
    let mounted = true;

    const fetchLookups = async () => {
      try {
        if (isNew) {
          const initialNo =
            billType === "IMPORT"
              ? `PIB-${String(1).padStart(6, "0")}`
              : `PLB-${String(1).padStart(6, "0")}`;
          setFormData((prev) => ({ ...prev, bill_no: initialNo }));
        }
        const [supRes, poRes, itemsRes, uomsRes, taxesRes, curRes, projRes, ccRes] =
          await Promise.all([
            api
              .get("/purchase/suppliers")
              .catch(() => ({ data: { items: [] } })),
            api.get("/purchase/orders").catch(() => ({ data: { items: [] } })),
            api.get("/inventory/items").catch(() => ({ data: { items: [] } })),
            api.get("/inventory/uoms").catch(() => ({ data: { items: [] } })),
            api
              .get(
                `/finance/tax-codes?form=${billType === "IMPORT" ? "PURCHASE_BILL_IMPORT" : "PURCHASE_BILL_LOCAL"}`,
              )
              .catch(() => ({ data: { items: [] } })),
            api
              .get("/finance/currencies")
              .catch(() => ({ data: { items: [] } })),
            api
              .get("/projects/projects")
              .catch(() => ({ data: { items: [] } })),
            api
              .get("/finance/cost-centers")
              .catch(() => ({ data: { items: [] } })),
          ]);

        if (mounted) {
          setSuppliers(
            Array.isArray(supRes.data?.items) ? supRes.data.items : [],
          );
          setPurchaseOrders(
            Array.isArray(poRes.data?.items) ? poRes.data.items : [],
          );
          setAvailableItems(
            Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
          );
          setItemOptions(
            Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
          );
          setUoms(Array.isArray(uomsRes.data?.items) ? uomsRes.data.items : []);
          const fetchedTaxCodes = Array.isArray(taxesRes.data?.items)
            ? taxesRes.data.items
            : [];
          setTaxCodes(fetchedTaxCodes);
          setFinCurrencies(
            Array.isArray(curRes.data?.items) ? curRes.data.items : [],
          );
          setProjects(
            Array.isArray(projRes.data?.items) ? projRes.data.items : [],
          );
          setCostCenters(
            Array.isArray(ccRes.data?.items) ? ccRes.data.items : (Array.isArray(ccRes.data?.data?.items) ? ccRes.data.data.items : []),
          );
          // Auto-select the first tax code for new (blank) items
          if (fetchedTaxCodes.length > 0) {
            setNewItem((prev) =>
              !prev.tax_code_id
                ? { ...prev, tax_code_id: String(fetchedTaxCodes[0].id) }
                : prev,
            );
          }
        }

        // Fetch GRNs
        try {
          const grnRes = await api.get("/purchase/grns", {
            params: { status: "APPROVED" },
          });
          if (mounted) {
            setGrns(Array.isArray(grnRes.data?.items) ? grnRes.data.items : []);
          }
        } catch (e) {
          // Ignore
        }
        try {
          const curRes = await api.get("/finance/currencies");
          if (mounted) {
            const items = Array.isArray(curRes.data?.items)
              ? curRes.data.items
              : [];
            setFinCurrencies(items);
            const base = items.find((c) => Number(c.is_base) === 1 || c.is_base === true);
            setBaseFinCurrencyId(base ? Number(base.id) : null);

            if (isNew && !formData.currency_id && base) {
              setFormData((prev) => ({
                ...prev,
                currency_id: Number(base.id),
                exchange_rate: 1,
              }));
            }
          }
        } catch {}
      } catch (e) {
        if (mounted) setError("Failed to load lookups");
      }
    };

    fetchLookups();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!formData.currency_id || finCurrencies.length === 0) return;
    const selected = finCurrencies.find(
      (c) => String(c.id) === String(formData.currency_id),
    );
    const base = finCurrencies.find(
      (c) => Number(c.is_base) === 1 || c.is_base === true,
    );
    if (!selected || !base) return;

    if (selected.code === base.code) {
      if (formData.exchange_rate !== 1) {
        setFormData((p) => ({ ...p, exchange_rate: 1 }));
      }
      return;
    }

    getExchangeRate(selected.code, base.code).then((rate) => {
      if (rate && formData.exchange_rate !== rate) {
        setFormData((p) => ({ ...p, exchange_rate: rate }));
      }
    });
  }, [formData.currency_id, finCurrencies]);

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
        const amt = (taxableTotal * rate) / 100;
        components.push({ name: c.component_name, rate, amount: amt });
        taxTotal += amt;
      });
    } else if (newItem.tax_code_id) {
      const tc = taxCodes.find(
        (t) => String(t.id) === String(newItem.tax_code_id),
      );
      const rate = tc ? Number(tc.rate_percent) || 0 : 0;
      const amt = (taxableTotal * rate) / 100;
      if (rate > 0) {
        components.push({ name: "Tax", rate, amount: amt });
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
        const it = availableItems.find((i) => String(i.id) === String(value));
        if (it && it.uom) {
          const u = uoms.find((uom) => String(uom.uom_code) === String(it.uom));
          next.uom_id = u ? String(u.id) : "";
        }
        if (it && it.cost_price) {
          next.unit_price = Number(it.cost_price);
        }
        // Fetch default tax
        const fetchTax = async () => {
          try {
            const res = await api.get(`/finance/item-tax/${value}`);
            const tax = res.data?.tax;
            if (tax && tax.id) {
              setNewItem((p) =>
                p.item_id === value ? { ...p, tax_code_id: String(tax.id) } : p,
              );
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
    const it = availableItems.find(
      (x) => String(x.id) === String(newItem.item_id),
    );
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

    setNewItem({
      item_id: "",
      uom_id: "",
      qty: 1,
      unit_price: 0,
      discount_percent: 0,
      tax_code_id: "",
      tax_amount: 0,
    });
  };

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/purchase/bills/${id}`)
      .then((res) => {
        if (!mounted) return;
        const h = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!h) return;

        setFormData({
          bill_no: h.bill_no || "",
          bill_date: h.bill_date ? h.bill_date.split("T")[0] : "",
          supplier_id: h.supplier_id ? String(h.supplier_id) : "",
          po_id: h.po_id ? String(h.po_id) : "",
          grn_id: h.grn_id ? String(h.grn_id) : "",
          bill_type: h.bill_type || billType,
          due_date: h.due_date ? h.due_date.split("T")[0] : "",
          currency_id: h.currency_id || 4,
          exchange_rate: Number(h.exchange_rate) || 1,
          payment_terms: Number(h.payment_terms) || 30,
          status: h.status || "DRAFT",
          discount_amount: Number(h.discount_amount) || 0,
          freight_charges: Number(h.freight_charges) || 0,
          other_charges: Number(h.other_charges) || 0,
          project_id: h.project_id || "",
          cost_center_id: h.cost_center_id ? String(h.cost_center_id) : "",
        });

        setLines(
          details.length
            ? details.map((d) => ({
                id: d.id || Date.now() + Math.random(),
                item_id: d.item_id ? String(d.item_id) : "",
                uom_id: d.uom_id ? String(d.uom_id) : "",
                qty: Number(d.qty) || 0,
                unit_price: Number(d.unit_price) || 0,
                discount_percent: Number(d.discount_percent) || 0,
                tax_code_id: d.tax_code_id ? String(d.tax_code_id) : "",
                tax_amount: Number(d.tax_amount) || 0,
                line_total: Number(d.line_total) || 0,
              }))
            : [],
        );
      })
      .catch((e) => {
        if (mounted) setError("Failed to load purchase bill");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  const recalcLine = (line) => {
    const qty = Number(line.qty) || 0;
    const unitPrice = Number(line.unit_price) || 0;
    const discountPercent = Number(line.discount_percent) || 0;
    let taxAmount = 0;

    const gross = qty * unitPrice;
    const discount = gross * (discountPercent / 100);
    const taxable = gross - discount;

    const comps = taxComponentsByCode[String(line.tax_code_id)] || [];
    if (comps.length > 0) {
      comps.forEach((c) => {
        taxAmount += (taxable * (Number(c.rate_percent) || 0)) / 100;
      });
    } else if (line.tax_code_id) {
      const tc = taxCodes.find(
        (t) => String(t.id) === String(line.tax_code_id),
      );
      const rate = tc ? Number(tc.rate_percent) || 0 : 0;
      taxAmount = taxable * (rate / 100);
    }
    const lineTotal = taxable + taxAmount;

    return { ...line, tax_amount: taxAmount, line_total: lineTotal };
  };

  const applyItemDefaultTax = async (lineId, itemId) => {
    try {
      const res = await api.get(`/finance/item-tax/${itemId}`);
      const tax = res.data?.tax;
      if (!tax) return;
      setLines((prev) =>
        prev.map((l) => {
          if (l.id !== lineId) return l;
          const qty = Number(l.qty) || 0;
          const unitPrice = Number(l.unit_price) || 0;
          const discountPercent = Number(l.discount_percent) || 0;
          const gross = qty * unitPrice;
          const discount = gross * (discountPercent / 100);
          const taxable = gross - discount;
          const rate = Number(tax.tax_rate) || 0;
          const next = {
            ...l,
            tax_code_id: String(tax.id),
            tax_amount: taxable * (rate / 100),
          };
          return recalcLine(next);
        }),
      );
    } catch {}
  };

  const handleLineChange = (lineId, field, value) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        let next = { ...l, [field]: value };
        if (field === "item_id") {
          const it = availableItems.find((i) => String(i.id) === String(value));
          if (it && it.uom) {
            const u = uoms.find(
              (uom) => String(uom.uom_code) === String(it.uom),
            );
            next.uom_id = u ? String(u.id) : "";
          }
          if (value) {
            applyItemDefaultTax(lineId, value);
          }
        }
        if (field === "tax_code_id") {
          const tc = taxCodes.find((t) => String(t.id) === String(value));
          const qty = Number(next.qty) || 0;
          const unitPrice = Number(next.unit_price) || 0;
          const discountPercent = Number(next.discount_percent) || 0;
          const gross = qty * unitPrice;
          const discount = gross * (discountPercent / 100);
          const taxable = gross - discount;
          const rate = tc ? Number(tc.rate_percent) || 0 : 0;
          next.tax_amount = taxable * (rate / 100);
        }
        return recalcLine(next);
      }),
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: Date.now(),
        item_id: "",
        uom_id: "",
        qty: 0,
        unit_price: 0,
        discount_percent: 0,
        tax_amount: 0,
        line_total: 0,
      },
    ]);
  };

  const removeLine = (lineId) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const populatePoDetails = async (poId) => {
    try {
      const res = await api.get(`/purchase/orders/${poId}`);
      const poItem = res.data?.item;
      const poDetails =
        Array.isArray(res.data?.item?.details) && res.data.item.details.length
          ? res.data.item.details
          : Array.isArray(res.data?.details)
            ? res.data.details
            : [];

      if (poItem) {
        const code = String(
          poItem.currency || poItem.currency_code || poItem.currencyCode || "",
        ).toUpperCase();
        const cur =
          finCurrencies.find((c) => String(c.code).toUpperCase() === code) ||
          null;
        setFormData((prev) => ({
          ...prev,
          supplier_id: poItem.supplier_id
            ? String(poItem.supplier_id)
            : prev.supplier_id,
          po_id: String(poId),
          currency_id:
            Number(poItem.currency_id) ||
            (cur ? Number(cur.id) : prev.currency_id),
          exchange_rate:
            poItem.exchange_rate != null
              ? Number(poItem.exchange_rate || 1)
              : prev.exchange_rate,
        }));
      }

      if (poDetails.length > 0) {
        const newLines = poDetails.map((d) => {
          const uomObj = uoms.find(
            (u) => u.uom_code === d.uom || u.uom_name === d.uom,
          );
          const qty =
            Number(d.qty) || Number(d.qty_ordered) || Number(d.quantity) || 0;
          const unitPrice = Number(d.unit_price) || 0;
          const discountPercent = Number(d.discount_percent) || 0;
          const taxPercent = Number(d.tax_percent) || 0;
          const gross = qty * unitPrice;
          const discountAmt = gross * (discountPercent / 100);
          const taxable = gross - discountAmt;
          const taxAmt = taxable * (taxPercent / 100);
          const lineTotal = taxable + taxAmt;
          const matchedTax =
            taxCodes.find((t) => String(t.id) === String(d.tax_code_id)) ||
            taxCodes.find(
              (t) => Number(t.rate_percent) === Number(taxPercent),
            ) || null;
          return {
            id: Date.now() + Math.random(),
            item_id: d.item_id ? String(d.item_id) : "",
            uom_id: uomObj ? String(uomObj.id) : "",
            qty,
            unit_price: unitPrice,
            discount_percent: discountPercent,
            tax_amount: taxAmt,
            tax_code_id: matchedTax ? String(matchedTax.id) : "",
            line_total: lineTotal,
          };
        });
        setLines(newLines);
      }
    } catch (err) {
      console.error("Failed to load PO details", err);
    }
  };

  const populateGrnDetails = async (grnId, poTaxOverride = {}) => {
    try {
      const res = await api.get(`/purchase/grns/${grnId}`);
      const grnItem = res.data?.item || null;
      const grnDetails = Array.isArray(res.data?.item?.details)
        ? res.data.item.details
        : Array.isArray(res.data?.details)
          ? res.data.details
          : [];

      if (grnItem) {
        setFormData((prev) => ({
          ...prev,
          po_id: grnItem.po_id ? String(grnItem.po_id) : prev.po_id,
          supplier_id: grnItem.supplier_id
            ? String(grnItem.supplier_id)
            : prev.supplier_id,
          grn_id: String(grnId),
        }));
        if (grnItem.po_id) {
          try {
            const poRes = await api.get(`/purchase/orders/${grnItem.po_id}`);
            const poItem = poRes.data?.item;
            if (poItem) {
              const code = String(
                poItem.currency ||
                  poItem.currency_code ||
                  poItem.currencyCode ||
                  "",
              ).toUpperCase();
              const cur =
                finCurrencies.find((c) => String(c.code).toUpperCase() === code) ||
                null;
              setFormData((prev) => ({
                ...prev,
                currency_id:
                  Number(poItem.currency_id) ||
                  (cur ? Number(cur.id) : prev.currency_id),
                exchange_rate:
                  poItem.exchange_rate != null
                    ? Number(poItem.exchange_rate || 1)
                    : prev.exchange_rate,
              }));
            }
          } catch (e) {
            // ignore currency population failure
          }
        }
      }

      const uniqueItemIds = Array.from(
        new Set(
          (Array.isArray(grnDetails) ? grnDetails : [])
            .map((d) => (d?.item_id != null ? String(d.item_id) : ""))
            .filter(Boolean),
        ),
      );

      const itemTaxByItemId = {};
      if (uniqueItemIds.length > 0) {
        await Promise.all(
          uniqueItemIds.map(async (itemId) => {
            try {
              const taxRes = await api.get(`/finance/item-tax/${itemId}`);
              const tax = taxRes.data?.tax;
              if (tax && tax.id) {
                itemTaxByItemId[String(itemId)] = {
                  tax_code_id: String(tax.id),
                };
              }
            } catch {}
          }),
        );
      }

      if (Array.isArray(grnDetails) && grnDetails.length > 0) {
        const newLines = grnDetails.map((d) => {
          const uomObj = uoms.find(
            (u) =>
              String(u.uom_code) === String(d.uom) ||
              String(u.uom_name) === String(d.uom),
          );
          const itemId = d.item_id != null ? String(d.item_id) : "";
          const it = availableItems.find((i) => String(i.id) === itemId);

          const qty =
            Number(d.qty_accepted) ||
            Number(d.qtyAccepted) ||
            Number(d.qty_received) ||
            Number(d.qtyReceived) ||
            Number(d.qty) ||
            Number(d.quantity) ||
            0;
          const unitPrice =
            Number(d.unit_price) ||
            Number(d.unitPrice) ||
            Number(d.cost_price) ||
            Number(d.costPrice) ||
            Number(d.price) ||
            0;

          const defaultTaxCodeId =
            poTaxOverride[itemId] ||
            itemTaxByItemId[itemId]?.tax_code_id ||
            (newItem.tax_code_id ? String(newItem.tax_code_id) : "");

          const baseLine = {
            id: Date.now() + Math.random(),
            item_id: itemId,
            uom_id: uomObj ? String(uomObj.id) : "",
            qty,
            unit_price: unitPrice,
            discount_percent: 0,
            tax_code_id: defaultTaxCodeId,
            item_name: it?.item_name || "",
            item_code: it?.item_code || "",
          };
          return recalcLine(baseLine);
        });
        setLines(newLines);
      } else {
        setLines([]);
      }
      if (uniqueItemIds.length > 0) {
        const options = uniqueItemIds
          .map((id) => availableItems.find((i) => String(i.id) === id))
          .filter(Boolean);
        setItemOptions(options);
      } else {
        setItemOptions(availableItems);
      }
    } catch (err) {
      console.error("Failed to load GRN details", err);
      setItemOptions(availableItems);
    }
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "supplier_id") {
      if (value) {
        const sup = suppliers.find((s) => String(s.id) === String(value));
        const code =
          (sup && sup.supplier_code && String(sup.supplier_code).trim()) ||
          (sup ? `SU-${String(Number(sup.id || 0)).padStart(6, "0")}` : "");
        if (code) {
          try {
            const res = await api.get("/finance/accounts", {
              params: { search: code },
            });
            const items = Array.isArray(res.data?.items) ? res.data.items : [];
            const exact =
              items.find((a) => String(a.code) === code) || items[0] || null;
            const accCode =
              (exact && exact.currency_code && String(exact.currency_code)) ||
              null;
            if (accCode) {
              const cur =
                finCurrencies.find(
                  (c) => String(c.code).toUpperCase() === accCode.toUpperCase(),
                ) || null;
              if (cur) {
                setFormData((prev) => ({
                  ...prev,
                  currency_id: Number(cur.id),
                }));
              }
            }
          } catch (err) {
            // ignore currency population failure
          }
        }
      } else {
        setFormData((prev) => ({ ...prev, currency_id: baseFinCurrencyId || "" }));
      }
    }

    if (name === "grn_id" && value) {
      await populateGrnDetails(value, poTaxCodeMap);
    } else if (name === "grn_id" && !value) {
      setItemOptions(availableItems);
    }

    if (name === "po_id" && value) {
      // 1. Fetch PO details to get currency and line-item tax codes
      let poCurrencyId = null;
      let poExchangeRate = null;
      let poTaxOverride = {};
      try {
        const poRes = await api.get(`/purchase/orders/${value}`);
        const poItem = poRes.data?.item;
        if (poItem) {
          const code = String(poItem.currency || poItem.currency_code || "").toUpperCase();
          const cur = finCurrencies.find((c) => String(c.code).toUpperCase() === code) || null;
          poCurrencyId = Number(poItem.currency_id) || (cur ? Number(cur.id) : null);
          poExchangeRate = poItem.exchange_rate != null ? Number(poItem.exchange_rate || 1) : null;
          // Build tax code map from PO line items
          const details = Array.isArray(poItem.details) ? poItem.details : [];
          details.forEach((d) => {
            if (d.item_id && d.tax_code_id) {
              poTaxOverride[String(d.item_id)] = String(d.tax_code_id);
            }
          });
          setPoTaxCodeMap(poTaxOverride);
        }
      } catch (e) {
        // ignore PO fetch failure
      }

      // 2. Populate supplier
      const selectedPo = purchaseOrders.find((po) => String(po.id) === value);
      let newSupplierId = formData.supplier_id;

      if (selectedPo && selectedPo.supplier_id) {
        newSupplierId = String(selectedPo.supplier_id);
        setFormData((prev) => ({
          ...prev,
          currency_id: poCurrencyId || prev.currency_id,
          exchange_rate: poExchangeRate != null ? poExchangeRate : prev.exchange_rate,
          supplier_id: newSupplierId,
        }));
      } else if (poCurrencyId) {
        setFormData((prev) => ({
          ...prev,
          currency_id: poCurrencyId,
          exchange_rate: poExchangeRate != null ? poExchangeRate : prev.exchange_rate,
        }));
      }

      // 4. Try to find corresponding GRN
      // Filter GRNs that match this PO AND the current bill type
      const matchingGrns = grns.filter(
        (g) =>
          String(g.po_id) === value &&
          g.grn_type === billType &&
          String(g.status).toUpperCase() === "APPROVED",
      );

      if (matchingGrns.length === 1) {
        // If exactly one GRN, select it and populate items
        await populateGrnDetails(matchingGrns[0].id, poTaxOverride);
      } else {
        // If multiple or none, just ensure the GRN field is reset so user can choose
        // But if they had one selected that DOES match, keep it?
        setFormData((prev) => {
          const currentGrnMatches = matchingGrns.find(
            (g) => String(g.id) === prev.grn_id,
          );
          // If we updated supplier, make sure to preserve that in this update too if it raced
          return {
            ...prev,
            supplier_id: newSupplierId || prev.supplier_id,
            grn_id: currentGrnMatches ? prev.grn_id : "",
          };
        });
        // Keep item options as full list until a specific GRN is chosen
        setItemOptions(availableItems);
      }
    }
    if (name === "currency_id") {
      const selected = finCurrencies.find(
        (c) => String(c.id) === String(value),
      );
      const base = finCurrencies.find(
        (c) => Number(c.is_base) === 1 || c.is_base === true,
      );

      if (!selected || !base) {
        setFormData((prev) => ({
          ...prev,
          currency_id: value,
          exchange_rate: 1,
        }));
      } else if (selected.code === base.code) {
        setFormData((prev) => ({
          ...prev,
          currency_id: value,
          exchange_rate: 1,
        }));
      } else {
        setFormData((prev) => ({ ...prev, currency_id: value }));
        getExchangeRate(selected.code, base.code).then((rate) => {
          if (rate) {
            setFormData((prev) => ({ ...prev, exchange_rate: rate }));
          }
        });
      }
      return; // prevent double setFormData in the caller
    }
  };

  const totals = useMemo(() => {
    const subTotal = lines.reduce(
      (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unit_price) || 0),
      0,
    );
    const compTotals = {};

    lines.forEach((l) => {
      const gross = (Number(l.qty) || 0) * (Number(l.unit_price) || 0);
      const disc = (gross * (Number(l.discount_percent) || 0)) / 100;
      const base = gross - disc;

      const taxCodeId = l.tax_code_id;
      const comps = taxComponentsByCode[String(taxCodeId)] || [];
      if (comps.length > 0) {
        comps.forEach((c) => {
          const rate = Number(c.rate_percent) || 0;
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
        const amt = Number(l.tax_amount || 0);
        if (amt > 0) {
          const name = "Tax";
          if (!compTotals[name]) {
            compTotals[name] = { amount: 0, rate: 0, sort_order: 99 };
          }
          compTotals[name].amount += amt;
        }
      }
    });

    const components = Object.keys(compTotals)
      .map((name) => ({
        name,
        amount: compTotals[name].amount,
        rate: compTotals[name].rate,
        sort_order: compTotals[name].sort_order,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);

    const lineTaxTotal = components.reduce((s, c) => s + c.amount, 0);

    const itemDiscounts = lines.reduce((sum, l) => {
      const gross = (Number(l.qty) || 0) * (Number(l.unit_price) || 0);
      return sum + (gross * (Number(l.discount_percent) || 0)) / 100;
    }, 0);

    const totalDiscount =
      itemDiscounts + (Number(formData.discount_amount) || 0);
    const freight = Number(formData.freight_charges) || 0;
    const other = Number(formData.other_charges) || 0;

    const grandTotal =
      subTotal - totalDiscount + lineTaxTotal + freight + other;

    return { subTotal, itemDiscounts, lineTaxTotal, grandTotal, components };
  }, [
    lines,
    formData.discount_amount,
    formData.freight_charges,
    formData.other_charges,
    taxComponentsByCode,
  ]);
  const totalInCurrentCurrency = useMemo(() => {
    return (
      Number(totals.subTotal || 0) +
      (0 - Number(formData.discount_amount || 0)) +
      Number(totals.lineTaxTotal || 0) +
      Number(formData.freight_charges || 0) +
      Number(formData.other_charges || 0)
    );
  }, [
    totals.subTotal,
    totals.lineTaxTotal,
    formData.discount_amount,
    formData.freight_charges,
    formData.other_charges,
  ]);
  const totalInBaseCurrency = useMemo(
    () =>
      Number(totals.grandTotal || 0) *
      (Number(formData.exchange_rate || 1) || 1),
    [totals.grandTotal, formData.exchange_rate],
  );
  const showBaseTotalRow = useMemo(
    () =>
      Math.abs(
        Number(totalInBaseCurrency || 0) - Number(totalInCurrentCurrency || 0),
      ) > 0.000001,
    [totalInBaseCurrency, totalInCurrentCurrency],
  );

  const handleSubmit = async (status = "DRAFT") => {
    // Validation
    if (!formData.bill_date) {
      setError("Bill Date is required");
      return;
    }
    if (!formData.supplier_id) {
      setError("Supplier is required");
      return;
    }
    if (lines.length === 0 || !lines.some((l) => l.item_id)) {
      setError("At least one item is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        ...formData,
        bill_no: formData.bill_no || undefined,
        supplier_id: Number(formData.supplier_id),
        po_id: formData.po_id ? Number(formData.po_id) : null,
        grn_id: formData.grn_id ? Number(formData.grn_id) : null,
        project_id: canAccessProjects && formData.project_id ? Number(formData.project_id) : null,
        currency_id: Number(formData.currency_id),
        exchange_rate: Number(formData.exchange_rate),
        payment_terms: Number(formData.payment_terms),
        cost_center_id: formData.cost_center_id ? Number(formData.cost_center_id) : null,
        discount_amount: Number(formData.discount_amount),
        freight_charges: Number(formData.freight_charges),
        other_charges: Number(formData.other_charges),
        status,
        details: lines
          .filter((l) => l.item_id)
          .map((l) => ({
            item_id: Number(l.item_id),
            uom_id: l.uom_id ? Number(l.uom_id) : null,
            qty: Number(l.qty) || 0,
            unit_price: Number(l.unit_price) || 0,
            discount_percent: Number(l.discount_percent) || 0,
            tax_code_id: l.tax_code_id ? Number(l.tax_code_id) : null,
            taxCodeId: l.tax_code_id ? Number(l.tax_code_id) : null,
            tax_amount: Number(l.tax_amount) || 0,
            line_total: Number(l.line_total) || 0,
          })),
      };

      if (isNew) {
        const res = await api.post("/purchase/bills", payload);
        const newId = Number(res?.data?.id || 0) || null;
        if (newId) setCurrentBillId(newId);
      } else {
        await api.put(`/purchase/bills/${id}`, payload);
        setCurrentBillId(Number(id));
      }

      toast.success(
        isNew
          ? "Purchase bill created successfully"
          : "Purchase bill updated successfully",
      );
      navigate(`/purchase/purchase-bills-${billType.toLowerCase()}`);
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save purchase bill");
    } finally {
      setSaving(false);
    }
  };

  const handlePostClick = async () => {
    if (!formData.bill_date) {
      setError("Bill Date is required");
      return;
    }
    if (!formData.supplier_id) {
      setError("Supplier is required");
      return;
    }
    if (!formData.grn_id) {
      setError("GRN is required for posting");
      return;
    }
    if (lines.length === 0 || !lines.some((l) => l.item_id)) {
      setError("At least one item is required");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...formData,
        bill_no: formData.bill_no || undefined,
        supplier_id: Number(formData.supplier_id),
        po_id: formData.po_id ? Number(formData.po_id) : null,
        grn_id: formData.grn_id ? Number(formData.grn_id) : null,
        currency_id: Number(formData.currency_id),
        exchange_rate: Number(formData.exchange_rate),
        payment_terms: Number(formData.payment_terms),
        cost_center_id: formData.cost_center_id ? Number(formData.cost_center_id) : null,
        discount_amount: Number(formData.discount_amount),
        freight_charges: Number(formData.freight_charges),
        other_charges: Number(formData.other_charges),
        status: "DRAFT",
        details: lines
          .filter((l) => l.item_id)
          .map((l) => ({
            item_id: Number(l.item_id),
            uom_id: l.uom_id ? Number(l.uom_id) : null,
            qty: Number(l.qty) || 0,
            unit_price: Number(l.unit_price) || 0,
            discount_percent: Number(l.discount_percent) || 0,
            tax_code_id: l.tax_code_id ? Number(l.tax_code_id) : null,
            taxCodeId: l.tax_code_id ? Number(l.tax_code_id) : null,
            tax_amount: Number(l.tax_amount) || 0,
            line_total: Number(l.line_total) || 0,
          })),
      };
      let createdId = null;
      if (!currentBillId) {
        const createRes = await api.post("/purchase/bills", payload);
        createdId = Number(createRes?.data?.id || 0) || null;
        if (createdId) setCurrentBillId(createdId);
      } else {
        await api.put(`/purchase/bills/${currentBillId}`, payload);
      }
      const postId = currentBillId || createdId;
      if (!postId) {
        setError("Bill not found for posting");
        return;
      }
      await api.post(`/purchase/bills/${postId}/post`, {});
      setFormData((prev) => ({ ...prev, status: "POSTED" }));
      toast.success("Purchase bill posted successfully");
      navigate(`/purchase/purchase-bills-${billType.toLowerCase()}`);
    } catch (e) {
      setError(e?.response?.data?.message || "Posting failed");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setFormData((prev) => ({
      ...prev,
      supplier_id: "",
      po_id: "",
      grn_id: "",
      due_date: "",
      currency_id: baseFinCurrencyId || "",
      exchange_rate: 1,
      payment_terms: 30,
      discount_amount: 0,
      freight_charges: 0,
      other_charges: 0,
    }));
    setLines([
      {
        id: Date.now(),
        item_id: "",
        uom_id: "",
        qty: 0,
        unit_price: 0,
        discount_percent: 0,
        tax_amount: 0,
        line_total: 0,
      },
    ]);
  };

  const listPath = `/purchase/purchase-bills-${billType.toLowerCase()}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isNew ? "New" : "Edit"} Purchase Bill - {billType}
          </h1>
          <p className="text-sm mt-1">Record and manage supplier bills</p>
        </div>
        <Link to={listPath} className="btn-secondary">
          Back to List
        </Link>
      </div>

      {loading && <div className="p-4 bg-white rounded shadow">Loading...</div>}
      {error && (
        <div className="p-4 text-red-600 bg-white rounded shadow">{error}</div>
      )}

      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg px-4 py-2">
          <h3 className="font-semibold">Invoice Information</h3>
        </div>
        <div className="card-body p-4 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <div className="form-group">
            <label className="label required">Bill Date</label>
            <input
              type="date"
              className="input"
              name="bill_date"
              value={formData.bill_date}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="label required">Supplier</label>
            <select
              className="input"
              name="supplier_id"
              value={formData.supplier_id}
              onChange={handleChange}
            >
              <option value="">-- Select Supplier --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplier_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Related PO</label>
            <select
              className="input"
              name="po_id"
              value={formData.po_id}
              onChange={handleChange}
            >
              <option value="">-- Select PO --</option>
              {purchaseOrders
                .filter(
                  (po) =>
                    (!formData.supplier_id ||
                      String(po.supplier_id) ===
                        String(formData.supplier_id)) &&
                    po.po_type === billType,
                )
                .map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.po_no}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Related GRN</label>
            <select
              className="input"
              name="grn_id"
              value={formData.grn_id}
              onChange={handleChange}
            >
              <option value="">-- Select GRN --</option>
              {grns
                .filter(
                  (g) =>
                    (!formData.supplier_id ||
                      String(g.supplier_id) === String(formData.supplier_id)) &&
                    (!formData.po_id ||
                      String(g.po_id) === String(formData.po_id)) &&
                    g.grn_type === billType &&
                    String(g.status).toUpperCase() === "APPROVED",
                )
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.grn_no}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Due Date</label>
            <input
              type="date"
              className="input"
              name="due_date"
              value={formData.due_date}
              onChange={handleChange}
            />
          </div>

          {canAccessProjects && (
            <div className="form-group">
              <label className="label">Project</label>
              <select
                className="input"
                name="project_id"
                value={formData.project_id}
                onChange={handleChange}
                disabled={!canAccessProjects}
              >
                <option value="">-- Select Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name || p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="label">Cost Center</label>
            <select
              className="input"
              name="cost_center_id"
              value={formData.cost_center_id || ""}
              onChange={handleChange}
            >
              <option value="">-- Select Cost Center --</option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.name} ({cc.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Currency</label>
            <select
              className="input"
              name="currency_id"
              value={formData.currency_id}
              onChange={handleChange}
            >
              {finCurrencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">
              Exchange Rate{" "}
              {selectedCurrencyCode
                ? `(${baseCurrencyCode} per ${selectedCurrencyCode})`
                : ""}
            </label>
            <input
              type="number"
              className="input text-right"
              name="exchange_rate"
              value={formData.exchange_rate}
              onChange={handleChange}
              step="0.000001"
              readOnly
            />
          </div>

          <div className="form-group">
            <label className="label">Payment Terms (Days)</label>
            <input
              type="number"
              className="input text-right"
              name="payment_terms"
              value={formData.payment_terms}
              onChange={handleChange}
            />
          </div>


        </div>
      </div>

      <div className="card">
        {/* Manual item addition hidden as per request */}
        <div className="card-body overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="w-1/4">Item</th>
                <th className="w-28 text-right">Qty</th>
                <th className="w-36 text-right">UOM</th>
                <th className="w-32 text-right">Unit Price</th>
                <th className="w-28 text-right">Disc %</th>
                <th className="w-36">Tax Code</th>
                <th className="w-40 text-right">Tax Amt</th>
                <th className="w-32 text-right">Net Amount</th>
                <th className="w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="text-center py-10 text-slate-400 bg-slate-50 italic"
                    >
                      No items added yet. Use the section above to add items or
                      pick a PO/GRN.
                    </td>
                  </tr>
              ) : (
                lines.map((l, idx) => {
                  const gross =
                    (Number(l.qty) || 0) * (Number(l.unit_price) || 0);
                  const discAmt =
                    (gross * (Number(l.discount_percent) || 0)) / 100;
                  const net = gross - discAmt;
                  const taxAmt = (Number(l.line_total) || 0) - net;
                  const it = availableItems.find(
                    (i) => String(i.id) === String(l.item_id),
                  );
                  const uo = uoms.find(
                    (u) => String(u.id) === String(l.uom_id),
                  );
                  return (
                    <tr key={l.id || idx}>
                      <td>
                        <div className="font-semibold text-slate-800">
                          {l.item_name || it?.item_name || "Unknown Item"}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {l.item_code || it?.item_code || ""}
                        </div>
                      </td>
                      <td className="text-right">
                        {isNew ? (
                          <input
                            type="number"
                            className="input text-right text-xs w-20 ml-auto"
                            value={l.qty}
                            onChange={(e) =>
                              handleLineChange(l.id, "qty", e.target.value)
                            }
                          />
                        ) : (
                          l.qty
                        )}
                      </td>
                      <td className="text-right">
                        {l.uom_name || uo?.uom_code || ""}
                      </td>
                      <td className="text-right">
                        {isNew ? (
                          <input
                            type="number"
                            className="input text-right text-xs w-24 ml-auto"
                            value={l.unit_price}
                            onChange={(e) =>
                              handleLineChange(
                                l.id,
                                "unit_price",
                                e.target.value,
                              )
                            }
                          />
                        ) : (
                          Number(l.unit_price).toFixed(2)
                        )}
                      </td>
                      <td className="text-right">{l.discount_percent}%</td>
                      <td>
                        {isNew ? (
                          <select
                            className="input text-xs w-full min-w-[7rem]"
                            value={l.tax_code_id || ""}
                            onChange={(e) =>
                              handleLineChange(l.id, "tax_code_id", e.target.value)
                            }
                          >
                            <option value="">No Tax</option>
                            {taxCodes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({Number(t.rate_percent || 0)}%)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-600">
                            {taxCodes.find((t) => String(t.id) === String(l.tax_code_id))?.name || ""}
                          </span>
                        )}
                      </td>
                      <td className="text-right text-slate-500">
                        {taxAmt.toFixed(2)}
                      </td>
                      <td className="text-right font-medium">
                        {net.toFixed(2)}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-bold text-brand">
                            {Number(l.line_total).toFixed(2)}
                          </span>
                          {!isNew ? null : (
                            <button
                              type="button"
                              className="text-red-400 hover:text-red-700 transition-colors ml-2"
                              onClick={() => removeLine(l.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="hidden md:block"></div>
        <div className="card">
          <div className="card-header bg-gray-100 px-4 py-2 border-b">
            <h3 className="font-semibold text-gray-700">Summary</h3>
          </div>
          <div className="card-body p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Sub Total:</span>
              <span className="font-semibold">
                {totals.subTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-red-600">
              <span className="text-gray-600">
                Discount Amount (Items + Global):
              </span>
              <span>
                -{" "}
                {(
                  totals.itemDiscounts + Number(formData.discount_amount) || 0
                ).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Global Discount Input:</span>
              <input
                type="number"
                className="input w-32 text-right"
                name="discount_amount"
                value={formData.discount_amount}
                onChange={handleChange}
              />
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-sm">Tax</span>
              <span className="font-semibold">
                {totals.lineTaxTotal.toFixed(2)}
              </span>
            </div>
            {(totals.components || []).map((c) => (
              <div
                key={c.name}
                className="flex justify-between items-center py-1 text-xs text-slate-500 pl-4"
              >
                <span>
                  {c.name} ({c.rate}%):
                </span>
                <span>{Number(c.amount || 0).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Freight Charges:</span>
              <input
                type="number"
                className="input w-32 text-right"
                name="freight_charges"
                value={formData.freight_charges}
                onChange={handleChange}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Other Charges:</span>
              <input
                type="number"
                className="input w-32 text-right"
                name="other_charges"
                value={formData.other_charges}
                onChange={handleChange}
              />
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between items-center text-lg font-bold">
              <span>{`Total ${selectedCurrencyCode || baseCurrencyCode}:`}</span>
              <span>{Number(totalInCurrentCurrency || 0).toFixed(2)}</span>
            </div>
            {showBaseTotalRow ? (
              <div className="border-t pt-2 mt-2 flex justify-between items-center text-lg font-bold">
                <span>{`Total ${baseCurrencyCode}:`}</span>
                <span>{Number(totalInBaseCurrency || 0).toFixed(2)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-8">
        <button
          type="button"
          className="btn-secondary px-6"
          onClick={handleClear}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn-success px-6"
          onClick={handlePostClick}
          disabled={saving}
        >
          {saving ? "Posting..." : "Post Bill"}
        </button>
      </div>
    </div>
  );
}
