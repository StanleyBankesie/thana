/**
 * @fileoverview SupplierQuotationForm component.
 * Provides functionality for SupplierQuotationForm.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { api } from "api/client";
import { useExchangeRate } from "../../../../hooks/useExchangeRate";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SupplierQuotationForm() {
  const { hasExceptional } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getExchangeRate } = useExchangeRate();
  const isEdit = Boolean(id) && id !== "new" && (location.pathname.endsWith("/edit") || new URLSearchParams(location.search).get("mode") === "edit");
  const isView = Boolean(id) && id !== "new" && !isEdit;

  const [formData, setFormData] = useState({
    quotation_no: "",
    quotation_date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    rfq_id: "",
    valid_until: "",
    status: "DRAFT",
    remarks: "",
    contact_person: "",
    email: "",
    phone: "",
    currency: "USD",
    exchange_rate: 1,
    payment_terms: "Net30",
    delivery_time: "",
    delivery_terms: "FOB",
    shipping_cost: 0,
    discount_percent: 0,
  });

  const [items, setItems] = useState([
    {
      item_id: "",
      item_name: "",
      qty: 0,
      unit_price: 0,
      tax_code_id: "",
      delivery_date: "",
      line_total: 0,
    },
  ]);

  const [suppliers, setSuppliers] = useState([]);
  const [rfqs, setRfqs] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [rfqSuppliersForSelection, setRfqSuppliersForSelection] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [itemQueries, setItemQueries] = useState({});

  const baseCurrencyCode = useMemo(() => {
    return (
      currencies.find((c) => Number(c.is_base) === 1 || c.is_base === true)
        ?.code || "GHS"
    );
  }, [currencies]);

  const selectedCurrencyCode = useMemo(() => {
    return formData.currency || "";
  }, [formData.currency]);
  const [initialQuotationCurrencyId, setInitialQuotationCurrencyId] =
    useState(null);
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});

  useEffect(() => {
    let mounted = true;

    async function loadLookups() {
      try {
        const [supRes, itemsRes, rfqsRes, taxRes, curRes] = await Promise.all([
          api.get("/purchase/suppliers"),
          api.get("/inventory/items"),
          api.get("/purchase/rfqs"),
          api.get("/finance/tax-codes?form=SUPPLIER_QUOTATION"),
          api.get("/finance/currencies"),
        ]);

        if (!mounted) return;
        setSuppliers(
          Array.isArray(supRes.data?.items) ? supRes.data.items : [],
        );
        setAvailableItems(
          Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
        );
        setRfqs(Array.isArray(rfqsRes.data?.items) ? rfqsRes.data.items : []);
        setTaxCodes(Array.isArray(taxRes.data?.items) ? taxRes.data.items : []);
        setCurrencies(
          Array.isArray(curRes.data?.items) ? curRes.data.items : [],
        );
      } catch (e) {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load suppliers/items",
        );
      }
    }

    loadLookups();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isEdit) return;

    let mounted = true;

    api
      .get("/purchase/supplier-quotations/next-no")
      .then((res) => {
        if (!mounted) return;
        if (res.data?.nextNo) {
          setFormData((prev) => ({ ...prev, quotation_no: res.data.nextNo }));
        }
      })
      .catch((err) =>
        console.error("Failed to load next supplier quotation number", err),
      );

    return () => {
      mounted = false;
    };
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/purchase/supplier-quotations/${id}`)
      .then((res) => {
        if (!mounted) return;
        const q = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!q) return;

        setFormData((prev) => {
          const merged = {
            ...prev,
            quotation_no: q.quotation_no || "",
            quotation_date: q.quotation_date
              ? String(q.quotation_date).split("T")[0]
              : new Date().toISOString().split("T")[0],
            supplier_id: q.supplier_id ? String(q.supplier_id) : "",
            rfq_id: q.rfq_id ? String(q.rfq_id) : "",
            valid_until: q.valid_until
              ? String(q.valid_until).split("T")[0]
              : "",
            status: q.status || "DRAFT",
            remarks: q.remarks || "",
            exchange_rate:
              q.exchange_rate !== undefined && q.exchange_rate !== null
                ? Number(q.exchange_rate) || prev.exchange_rate || 1
                : prev.exchange_rate || 1,
          };

          const extrasKey = `supplierQuoteExtras:${id}`;
          try {
            const savedExtras = window.localStorage.getItem(extrasKey);
            if (savedExtras) {
              const parsed = JSON.parse(savedExtras);
              if (parsed && parsed.formData) {
                Object.assign(merged, parsed.formData);
              }
            }
          } catch {}

          return merged;
        });
        setInitialQuotationCurrencyId(q.currency_id || null);

        setItems(() => {
          let baseItems =
            details.length &&
            details.map((d) => ({
              item_id: d.item_id ? String(d.item_id) : "",
              item_name: d.item_name || "",
              qty: Number(d.qty) || 0,
              unit_price: Number(d.unit_price) || 0,
              tax_code_id:
                d.tax_code_id !== undefined && d.tax_code_id !== null
                  ? String(d.tax_code_id)
                  : "",
              delivery_date: d.delivery_date
                ? String(d.delivery_date).split("T")[0]
                : "",
              line_total: Number(d.line_total) || 0,
            }));

          if (!baseItems || !baseItems.length) {
            baseItems = [
              {
                item_id: "",
                item_name: "",
                qty: 0,
                unit_price: 0,
                tax_code_id: "",
                delivery_date: "",
                line_total: 0,
              },
            ];
          }

          const extrasKey = `supplierQuoteExtras:${id}`;
          try {
            const savedExtras = window.localStorage.getItem(extrasKey);
            if (savedExtras) {
              const parsed = JSON.parse(savedExtras);
              if (parsed && Array.isArray(parsed.items)) {
                return baseItems.map((item, idx) => ({
                  ...item,
                  ...(parsed.items[idx] || {}),
                  tax_code_id:
                    parsed.items[idx]?.tax_code_id || item.tax_code_id || "",
                }));
              }
            }
          } catch {}

          return baseItems;
        });
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load supplier quotation",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isEdit]);

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
      new Set(items.map((l) => String(l.tax_code_id)).filter(Boolean)),
    );
    const missing = uniqueTaxIds.filter((id) => !(id in taxComponentsByCode));
    if (missing.length) {
      Promise.all(missing.map((id) => fetchTaxComponentsForCode(id)));
    }
  }, [items]);

  const fetchExchangeRateForCode = async (selectedCode) => {
    const code = String(selectedCode || "").toUpperCase();
    const arr = Array.isArray(currencies) ? currencies : [];
    if (!code || !arr.length) return;
    const base =
      arr.find(
        (c) =>
          String(c.is_base) === "1" || c.is_base === 1 || c.is_base === true,
      ) ||
      arr.find(
        (c) => String(c.code || c.currency_code || "").toUpperCase() === "GHS",
      ) ||
      arr.find((c) =>
        /ghana|cedi/i.test(String(c.name || c.currency_name || "")),
      );

    if (!base) return;
    if (code === base.code) {
      setFormData((prev) => ({ ...prev, exchange_rate: 1 }));
      return;
    }

    const rate = await getExchangeRate(code, base.code);
    if (rate) {
      setFormData((p) => ({ ...p, exchange_rate: rate }));
    }
  };

  useEffect(() => {
    // Map initial currency_id to code on edit
    if (
      isEdit &&
      initialQuotationCurrencyId &&
      Array.isArray(currencies) &&
      currencies.length
    ) {
      const match = currencies.find(
        (c) => String(c.id) === String(initialQuotationCurrencyId),
      );
      if (match) {
        const code = String(
          match.code || match.currency_code || "",
        ).toUpperCase();
        setFormData((prev) => ({ ...prev, currency: code || prev.currency }));
      }
    }
  }, [isEdit, initialQuotationCurrencyId, currencies]);

  useEffect(() => {
    // Auto-update exchange rate when currency or date changes
    fetchExchangeRateForCode(formData.currency);
  }, [currencies, formData.currency, formData.quotation_date]);

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "supplier_id" && value) {
      const selected = suppliers.find((s) => String(s.id) === String(value));
      if (selected && selected.currency_id) {
        const currencyMatch = currencies.find((c) => String(c.id) === String(selected.currency_id));
        if (currencyMatch) {
          const code = String(currencyMatch.code || currencyMatch.currency_code || "").toUpperCase();
          setFormData((prev) => ({ ...prev, currency: code }));
        }
      }
    }

    if (name === "rfq_id" && !value) {
      setRfqSuppliersForSelection([]);
      return;
    }

    if (name === "rfq_id" && value) {
      try {
        const res = await api.get(`/purchase/rfqs/${value}`);
        const rfq = res.data?.item;
        const rfqItems = Array.isArray(res.data?.items) ? res.data.items : [];
        const rfqSuppliers = Array.isArray(res.data?.suppliers)
          ? res.data.suppliers
          : [];

        setRfqSuppliersForSelection(rfqSuppliers);

        if (rfq) {
          setFormData((prev) => {
            const next = {
              ...prev,
              rfq_id: value,
              valid_until: rfq.expiry_date || prev.valid_until,
              delivery_terms: rfq.delivery_terms || prev.delivery_terms,
              remarks: rfq.remarks || prev.remarks,
            };

            if (rfqSuppliers.length === 1) {
              const s = rfqSuppliers[0];
              next.supplier_id = String(s.supplier_id);
              next.contact_person = s.supplier_name || prev.contact_person;
              next.email = s.email || prev.email;
              next.phone = s.phone || prev.phone;
            } else if (rfqSuppliers.length > 1) {
              next.supplier_id = "";
              next.contact_person = "";
              next.email = "";
              next.phone = "";
            }

            return next;
          });
        }

        if (rfqItems.length) {
          const newItems = rfqItems.map((d) => ({
            item_id: String(d.item_id),
            item_name: d.item_name || "",
            uom: d.uom || "PCS",
            qty: Number(d.qty) || 0,
            unit_price: Number(d.estimated_unit_cost) || Number(d.unit_price) || 0,
            tax_code_id: "",
            delivery_date: d.required_date || "",
            line_total: 0,
          }));
          setItems(newItems);
        }
      } catch (err) {
        console.error("Failed to fetch RFQ details", err);
      }
    }
    if (name === "currency") {
      await fetchExchangeRateForCode(value);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index][field] = value;

    if (field === "item_id") {
      const item = availableItems.find((i) => String(i.id) === String(value));
      if (item) {
        updatedItems[index].item_name = item.item_name || "";
      }
    }

    if (field === "qty" || field === "unit_price" || field === "tax_code_id") {
      const qty = parseFloat(updatedItems[index].qty || 0);
      const unitPrice = parseFloat(updatedItems[index].unit_price || 0);
      updatedItems[index].line_total = qty * unitPrice;
    }

    setItems(updatedItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        item_id: "",
        item_name: "",
        qty: 0,
        unit_price: 0,
        tax_code_id: "",
        delivery_date: "",
        line_total: 0,
      },
    ]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const totals = useMemo(() => {
    const compTotals = {};
    const sub = items.reduce(
      (sum, item) => sum + (parseFloat(item.line_total) || 0),
      0,
    );

    items.forEach((item) => {
      const qty = parseFloat(item.qty) || 0;
      const unitPrice = parseFloat(item.unit_price) || 0;
      const base = qty * unitPrice;

      const taxCodeId = item.tax_code_id;
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
        const tc = taxCodes.find((t) => String(t.id) === String(taxCodeId));
        const rate = tc ? Number(tc.rate_percent) || 0 : 0;
        const amt = (base * rate) / 100;
        if (rate > 0) {
          const name = "Tax";
          if (!compTotals[name]) {
            compTotals[name] = { amount: 0, rate, sort_order: 99 };
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

    const totalTax = components.reduce((s, c) => s + c.amount, 0);

    return { subtotal: sub, totalTax, components };
  }, [items, taxCodes, taxComponentsByCode]);

  const grandTotal = useMemo(() => {
    const shipping = parseFloat(formData.shipping_cost) || 0;
    const discountPct = parseFloat(formData.discount_percent) || 0;
    const sub = totals.subtotal;
    const tTax = totals.totalTax;
    const beforeDiscount = sub + tTax + shipping;
    const discount = beforeDiscount * (discountPct / 100);
    return beforeDiscount - discount;
  }, [totals, formData.shipping_cost, formData.discount_percent]);

  const totalTax = useMemo(() => totals.totalTax, [totals.totalTax]);
  const subtotal = useMemo(() => totals.subtotal, [totals.subtotal]);

  const totalAmount = useMemo(() => subtotal, [subtotal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const arr = Array.isArray(currencies) ? currencies : [];
      const curMatch = arr.find(
        (c) =>
          String(c.code || c.currency_code || "").toUpperCase() ===
          String(formData.currency || "").toUpperCase(),
      );
      const currencyId = curMatch?.id || null;

      const payload = {
        quotation_no: formData.quotation_no || undefined,
        quotation_date: formData.quotation_date,
        supplier_id: Number(formData.supplier_id),
        rfq_id: formData.rfq_id ? Number(formData.rfq_id) : null,
        valid_until: formData.valid_until || null,
        status: formData.status,
        remarks: formData.remarks || null,
        currency_id: currencyId,
        exchange_rate: Number(formData.exchange_rate) || 1,
        details: items
          .filter((r) => r.item_id)
          .map((r) => ({
            item_id: Number(r.item_id),
            qty: Number(r.qty) || 0,
            unit_price: Number(r.unit_price) || 0,
            tax_code_id: r.tax_code_id ? Number(r.tax_code_id) : null,
            line_total: Number(r.line_total) || 0,
          })),
        attachments: attachments.map((a) => ({
          url: a.url,
          filename: a.filename,
          note: a.note || null,
        })),
      };

      const extras = {
        formData: {
          contact_person: formData.contact_person,
          email: formData.email,
          phone: formData.phone,
          currency: formData.currency,
          payment_terms: formData.payment_terms,
          delivery_time: formData.delivery_time,
          delivery_terms: formData.delivery_terms,
          shipping_cost: formData.shipping_cost,
          discount_percent: formData.discount_percent,
        },
        items: items.map((r) => ({
          tax_code_id: r.tax_code_id,
          delivery_date: r.delivery_date,
        })),
      };

      if (isEdit) {
        await api.put(`/purchase/supplier-quotations/${id}`, payload);
        const extrasKey = `supplierQuoteExtras:${id}`;
        window.localStorage.setItem(extrasKey, JSON.stringify(extras));
      } else {
        const res = await api.post("/purchase/supplier-quotations", payload);
        const newId = res.data?.id;
        if (newId) {
          const extrasKey = `supplierQuoteExtras:${newId}`;
          window.localStorage.setItem(extrasKey, JSON.stringify(extras));
        }
      }

      navigate("/purchase/supplier-quotations");
    } catch (e2) {
      setError(
        e2?.response?.data?.message || "Failed to save supplier quotation",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      const res = await api.post("/upload", formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.url;
      const filename = res.data?.filename || file.name;
      if (url) {
        setAttachments((prev) => [...prev, { url, filename }]);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "File upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      await handleFileUpload(f);
    }
    e.target.value = "";
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="p-6">
      <div className="rounded-lg border border-[#dee2e6] bg-white dark:bg-slate-800 shadow-erp">
        <div className="px-6 py-4 border-b bg-brand text-white rounded-t-lg flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {isEdit ? "Edit" : "New"} Supplier Quotation
            </h1>
            <p className="text-sm mt-1 opacity-90">
              {isEdit
                ? "Update quotation details"
                : "Record a new supplier quotation"}
            </p>
          </div>
          <button onClick={() => window.history.back()} className="px-3 py-1.5 rounded bg-white text-brand hover:bg-slate-100 text-sm font-semibold">
            ← Back to List
          </button>
        </div>

      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-5">
          {loading && <div className="text-sm text-slate-500">Loading...</div>}
          {error && <div className="alert alert-error text-red-600 bg-red-50 p-3 rounded">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="hidden">
                <label className="label">Quotation No *</label>
                <input
                  type="text"
                  name="quotation_no"
                  className="input"
                  value={formData.quotation_no}
                  onChange={handleInputChange}
                  placeholder="Auto-generated"
                  disabled={isEdit}
                  required={false}
                />
              </div>
              <div>
                <label className="label">Quotation Date *</label>
                <input
                  type="date"
                  name="quotation_date"
                  className="input"
                  value={formData.quotation_date}
                  onChange={handleInputChange}
                  required
                
                  disabled={isView || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
                />
              </div>
              <div>
                <label className="label">Supplier *</label>
                <select
                  name="supplier_id"
                  className="input"
                  value={formData.supplier_id}
                  onChange={handleInputChange}
                  disabled={rfqSuppliersForSelection.length > 1}
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplier_name ||
                        supplier.name ||
                        supplier.supplier_code ||
                        `Supplier #${supplier.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">RFQ No</label>
                <select
                  name="rfq_id"
                  className="input"
                  value={formData.rfq_id}
                  onChange={handleInputChange}
                >
                  <option value="">Select RFQ</option>
                  {rfqs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.rfq_no} {r.status ? `- ${r.status}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {rfqSuppliersForSelection.length > 1 && (
                <div>
                  <label className="label">RFQ Supplier</label>
                  <select
                    className="input"
                    value={formData.supplier_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const s = rfqSuppliersForSelection.find(
                        (x) => String(x.supplier_id) === String(selectedId),
                      );
                      setFormData((prev) => ({
                        ...prev,
                        supplier_id: selectedId,
                        contact_person: s?.supplier_name || prev.contact_person,
                        email: s?.email || prev.email,
                        phone: s?.phone || prev.phone,
                      }));
                    }}
                  >
                    <option value="">Select Supplier from RFQ</option>
                    {rfqSuppliersForSelection.map((s) => (
                      <option key={s.supplier_id} value={s.supplier_id}>
                        {s.supplier_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Valid Until *</label>
                <input
                  type="date"
                  name="valid_until"
                  className="input"
                  value={formData.valid_until}
                  onChange={handleInputChange}
                  required
                
                  disabled={isView || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
                />
              </div>
              <div className="hidden">
                <label className="label">Status</label>
                <select
                  name="status"
                  className="input"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                </select>
              </div>
            </div>
          </div>
        <div className="card">
          <div className="card-header bg-brand text-white text-slate-800 rounded-t-lg border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">
              Terms
            </h2>
          </div>
          <div className="card-body">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label">Currency</label>
                <select
                  name="currency"
                  className="input w-full"
                  value={formData.currency}
                  onChange={handleInputChange}
                >
                  {currencies.map((c) => (
                    <option key={c.id} value={c.code || c.currency_code}>
                      {c.code || c.currency_code} - {c.name || c.currency_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">
                  Exchange Rate{" "}
                  {selectedCurrencyCode
                    ? `(${baseCurrencyCode} per ${selectedCurrencyCode})`
                    : ""}
                </label>
                <input
                  type="number"
                  name="exchange_rate"
                  className="input text-right"
                  value={formData.exchange_rate}
                  onChange={handleInputChange}
                  step="0.000001"
                  readOnly
                />
              </div>
              <div>
                <label className="label">Payment Terms</label>
                <select
                  name="payment_terms"
                  className="input"
                  value={formData.payment_terms}
                  onChange={handleInputChange}
                >
                  <option value="Net30">Net 30 days</option>
                  <option value="Net60">Net 60 days</option>
                  <option value="Advance50">50% Advance</option>
                  <option value="COD">Cash on Delivery</option>
                </select>
              </div>
              <div>
                <label className="label">Delivery Time</label>
                <input
                  type="text"
                  name="delivery_time"
                  className="input"
                  value={formData.delivery_time}
                  onChange={handleInputChange}
                  placeholder="e.g., 2-3 weeks"
                />
              </div>
              <div>
                <label className="label">Delivery Terms</label>
                <select
                  name="delivery_terms"
                  className="input"
                  value={formData.delivery_terms}
                  onChange={handleInputChange}
                >
                  <option value="FOB">FOB</option>
                  <option value="CIF">CIF</option>
                  <option value="EXW">EXW</option>
                  <option value="DDP">DDP</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl shadow-xl border border-slate-200 rounded-2xl overflow-hidden mb-6">
          <div className="bg-slate-50 p-5 text-slate-800 border-b border-slate-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Quotation Items
              </h2>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={addItem}
              >
                + Add Item
              </button>
            </div>
          </div>
          <div className="p-6 overflow-x-auto overflow-y-visible">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "30%" }}>Item</th>
                  <th className="text-right" style={{ width: "10%" }}>
                    Quantity
                  </th>
                  <th className="text-right" style={{ width: "15%" }}>
                    Unit Price
                  </th>
                  <th className="text-right" style={{ width: "15%" }}>
                    Tax
                  </th>
                  <th className="text-right" style={{ width: "15%" }}>
                    Line Total
                  </th>
                  <th style={{ width: "15%" }}>Delivery Date</th>
                  <th style={{ width: "10%" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                     <td>
                       <div className="relative">
                         <input
                           id={`sq-item-search-${index}`} autoComplete="off"
                           className="input w-72"
                            placeholder="Scan barcode or type item name"
                            value={itemQueries[index] !== undefined ? itemQueries[index] : (item.item_id && availableItems.find(i => String(i.id) === String(item.item_id)) ? availableItems.find(i => String(i.id) === String(item.item_id)).item_name : item.item_name || "")}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItemQueries((prev) => ({
                                ...prev,
                                [index]: val,
                              }));
                              if (item.item_id) {
                                handleItemChange(index, "item_id", "");
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const query = (itemQueries[index] || "").trim();
                                const results = query
                                  ? filterByPrefix(availableItems, {
                                      query,
                                      searchFields: [
                                        "item_code",
                                        "item_name",
                                        "barcode",
                                      ],
                                    })
                                  : [];
                                if (!query || !results.length) return;
                                e.preventDefault();
                                handleItemChange(
                                  index,
                                  "item_id",
                                  String(results[0].id),
                                );
                                setItemQueries((prev) => ({
                                  ...prev,
                                  [index]: results[0].item_name || "",
                                }));
                              }
                            }}
                         />
                         {(() => {
                           const query = (itemQueries[index] || "").trim();
                           const results = query
                             ? filterByPrefix(availableItems, {
                                 query,
                                 searchFields: [
                                   "item_code",
                                   "item_name",
                                   "barcode",
                                 ],
                               })
                             : [];
                            return results.length && !item.item_id ? (
                              (() => {
                                const el = document.getElementById(`sq-item-search-${index}`);
                               const r = el ? el.getBoundingClientRect() : { bottom: 0, left: 0, width: 0 };
                               return (
                                 <div
                                   className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto"
                                   style={{ position: 'fixed', top: `${r.bottom + 4}px`, left: `${r.left}px`, width: `${r.width}px`, zIndex: 9999 }}
                                 >
                                   {results.map((o) => (
                                     <button
                                       type="button"
                                       key={o.id}
                                       className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-xs"
                                      onClick={() => {
                                          handleItemChange(
                                            index,
                                            "item_id",
                                            String(o.id),
                                          );
                                          setItemQueries((prev) => ({
                                            ...prev,
                                            [index]: o.item_name || "",
                                          }));
                                        }}
                                      >
                                        {(o.item_code || o.code || o.id) +
                                          " - " +
                                          (o.item_name || "")}
                                     </button>
                                   ))}
                                 </div>
                               );
                             })()
                           ) : null;
                         })()}
                       </div>
                     </td>
                    <td>
                      <input
                        type="number"
                        className="input text-right w-28"
                        value={item.qty}
                        onChange={(e) =>
                          handleItemChange(index, "qty", e.target.value)
                        }
                        step="1"
                        min="0"
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="input text-right w-32"
                        value={item.unit_price}
                        onChange={(e) =>
                          handleItemChange(index, "unit_price", e.target.value)
                        }
                        step="1"
                        min="0"
                        required
                      />
                    </td>
                    <td>
                      <select
                        className="input text-right w-32"
                        value={item.tax_code_id}
                        onChange={(e) =>
                          handleItemChange(index, "tax_code_id", e.target.value)
                        }
                      >
                        <option value={0}>Select Tax</option>
                        {taxCodes.map((t) => (
                          <option key={t.id} value={String(t.id)}>
                            {t.code} - {t.name} (
                            {Number(t.rate_percent).toFixed(2)}
                            %)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-right font-medium">
                      {item.line_total.toFixed(2)}
                    </td>
                    <td>
                      <input
                        type="date"
                        className="input"
                        value={item.delivery_date}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "delivery_date",
                            e.target.value,
                          )
                        }
                      
                        disabled={isView || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                        disabled={items.length === 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 pt-0">
            <label className="label">Remarks</label>
            <textarea
              name="remarks"
              className="input w-full"
              rows="6"
              value={formData.remarks}
              onChange={handleInputChange}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-brand text-white text-slate-800 rounded-t-lg border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">
              Summary
            </h2>
          </div>
          <div className="card-body">
            <div className="space-y-7">
              <div className="flex items-center">
                <div className="flex items-center gap-4 flex-1">
                  <div>Subtotal</div>
                  <div className="font-semibold">{subtotal.toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2 justify-center flex-1">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span>Total Tax</span>
                      <span className="font-semibold">
                        {totalTax.toFixed(2)}
                      </span>
                    </div>
                    {(totals.components || []).map((c) => (
                      <div
                        key={c.name}
                        className="text-xs text-slate-500 pl-4 flex justify-between gap-2"
                      >
                        <span>
                          {c.name} ({c.rate}%):
                        </span>
                        <span>{Number(c.amount || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1" />
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center justify-between">
                  <div>Shipping Cost</div>
                  <div>
                    <input
                      type="number"
                      className="input w-32"
                      value={formData.shipping_cost}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          shipping_cost: e.target.value,
                        }))
                      }
                      step="1"
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>Discount (%)</div>
                  <div>
                    <input
                      type="number"
                      className="input w-32"
                      value={formData.discount_percent}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          discount_percent: e.target.value,
                        }))
                      }
                      step="1"
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-4 md:col-span-2 lg:col-span-3">
                  <div className="text-lg font-semibold">Grand Total</div>
                  <div className="text-lg font-bold">
                    {grandTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-brand text-white text-slate-800 rounded-t-lg border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">
              Supporting Documents
            </h2>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  className="input"
                  onChange={handleFileInputChange}
                  multiple
                />
                <span className="text-sm">
                  {uploading
                    ? "Uploading..."
                    : "Attach PDF, DOCX, XLSX, images"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Link</th>
                      <th>Note</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!attachments.length ? (
                      <tr>
                        <td
                          colSpan="4"
                          className="text-center py-6 text-slate-500 dark:text-slate-400"
                        >
                          No attachments
                        </td>
                      </tr>
                    ) : null}
                    {attachments.map((att, idx) => (
                      <tr key={`${att.url}-${idx}`}>
                        <td className="font-medium">{att.filename}</td>
                        <td>
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:text-brand-700"
                          >
                            View
                          </a>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input"
                            value={att.note || ""}
                            onChange={(e) =>
                              setAttachments((prev) =>
                                prev.map((a, i) =>
                                  i === idx
                                    ? { ...a, note: e.target.value }
                                    : a,
                                ),
                              )
                            }
                            placeholder="Optional note"
                          />
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn-success"
                            onClick={() => removeAttachment(idx)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 justify-end p-6 border-t mt-4">
          <button onClick={() => window.history.back()} className="btn-success">
            Cancel
          </button>
          <button type="submit" className="btn-success">
            {saving ? "Saving..." : isEdit ? "Update" : "Create"} Quotation
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

