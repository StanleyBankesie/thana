/**
 * @fileoverview SalesReturnForm component.
 * Provides functionality for SalesReturnForm.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "api/client";
import { toast } from "react-toastify";
import { Plus, Trash2 } from "lucide-react";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SalesReturnForm() {
  const navigate = useNavigate();
  const { id: returnRouteId } = useParams();
  const existingId =
    returnRouteId && /^\d+$/.test(String(returnRouteId))
      ? Number(returnRouteId)
      : null;
  const isEdit = Boolean(existingId);
  const location = useLocation();
  const readOnly = new URLSearchParams(location.search).get("mode") === "view";
  const { hasExceptional } = usePermission();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [itemsMaster, setItemsMaster] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});
  const [defaultTaxId, setDefaultTaxId] = useState("");
  const [itemQueries, setItemQueries] = useState({});
  const [returnReasons, setReturnReasons] = useState([]);

  const [formData, setFormData] = useState({
    returnNo: "Auto-generated",
    returnDate: new Date().toISOString().split("T")[0],
    customerId: "",
    invoiceId: "",
    warehouseId: "",
    returnType: "DAMAGED",
    status: "DRAFT",
    remarks: "",
  });

  const [lines, setLines] = useState([
    {
      id: Date.now(),
      item_id: "",
      itemCode: "",
      itemName: "",
      qtyReturned: 1,
      unitPrice: 0,
      reasonCode: "DAMAGED",
      remarks: "",
      tax_type: "",
      taxAmount: 0,
    },
  ]);

  const fetchAvailable = async (warehouseId, itemId) => {
    if (!warehouseId || !itemId) return 0;
    try {
      const resp = await api.get("/inventory/stock/balance", {
        params: {
          item_id: itemId,
          warehouse_id: warehouseId,
        },
      });
      return Number(resp.data?.qty || 0);
    } catch {
      return 0;
    }
  };

  const fetchTaxComponentsForCode = async (taxCodeId) => {
    const key = String(taxCodeId || "");
    if (!key) return;
    try {
      const resp = await api.get(`/finance/tax-codes/${taxCodeId}/components`);
      const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
      setTaxComponentsByCode((prev) => ({ ...prev, [key]: items }));
    } catch {
      // noop
    }
  };

  const ensureTaxComponentsLoaded = async () => {
    const uniqueTaxIds = Array.from(
      new Set(
        lines.map((i) => i.tax_type).filter((id) => id && id !== "undefined"),
      ),
    );
    const missing = uniqueTaxIds.filter((id) => !(id in taxComponentsByCode));
    if (missing.length) {
      await Promise.all(missing.map((id) => fetchTaxComponentsForCode(id)));
    }
  };

  useEffect(() => {
    ensureTaxComponentsLoaded();
  }, [lines]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [custRes, whRes, itemsRes, taxRes, reasonRes] = await Promise.all(
          [
            api.get("/sales/customers?active=true"),
            api.get("/inventory/warehouses"),
            api.get("/inventory/items"),
            api.get("/finance/tax-codes/by-page/19"),
            api
              .get("/sales/return-reasons")
              .catch(() => ({ data: { items: [] } })),
          ],
        );
        if (!mounted) return;
        setCustomers(
          Array.isArray(custRes.data?.items) ? custRes.data.items : [],
        );
        setWarehouses(Array.isArray(whRes.data?.items) ? whRes.data.items : []);
        setItemsMaster(
          Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [],
        );
        const taxItems = Array.isArray(taxRes.data?.items)
          ? taxRes.data.items
          : [];
        setTaxes(taxItems);

        const reasonItems = Array.isArray(reasonRes.data?.items)
          ? reasonRes.data.items
          : [];
        const activeReasons = reasonItems.filter((r) => r.is_active);
        setReturnReasons(activeReasons);

        // Default to "No Tax" — user selects tax code per line
        setDefaultTaxId("");

        if (activeReasons.length > 0 && !existingId) {
          const firstCode = activeReasons[0].reason_code;
          setFormData((p) => ({ ...p, returnType: firstCode }));
          setLines((prev) =>
            prev.map((l) => ({
              ...l,
              reasonCode: firstCode,
            })),
          );
        }

        if (existingId) {
          const detRes = await api.get(`/sales/returns/${existingId}`);
          if (!mounted) return;
          const h = detRes.data?.item || {};
          const details = Array.isArray(detRes.data?.details)
            ? detRes.data.details
            : [];
          setFormData({
            returnNo: String(h.return_no || ""),
            returnDate: h.return_date
              ? String(h.return_date).slice(0, 10)
              : new Date().toISOString().split("T")[0],
            customerId:
              h.customer_id != null && h.customer_id !== ""
                ? String(h.customer_id)
                : "",
            invoiceId:
              h.invoice_id != null && h.invoice_id !== ""
                ? String(h.invoice_id)
                : "",
            warehouseId:
              h.warehouse_id != null && h.warehouse_id !== ""
                ? String(h.warehouse_id)
                : "",
            returnType: String(h.return_type || "DAMAGED"),
            status: String(h.status || "DRAFT"),
            remarks: h.remarks || "",
          });
          const mappedLines = details.map((d, idx) => ({
            id: d.id != null ? Number(d.id) : Date.now() + idx,
            item_id: d.item_id != null ? String(d.item_id) : "",
            itemCode: String(d.item_code || ""),
            itemName: String(d.item_name || ""),
            qtyReturned: Number(d.qty_returned || 0),
            unitPrice: Number(d.unit_price || 0),
            reasonCode: String(d.reason_code || "DAMAGED"),
            remarks: String(d.remarks || ""),
            tax_type:
              d.tax_type != null
                ? String(d.tax_type)
                : String(defCode?.id || ""),
            taxAmount: Number(d.tax_amount || 0),
            uom: String(d.uom || ""),
          }));
          setLines(
            mappedLines.length
              ? mappedLines
              : [
                  {
                    id: Date.now(),
                    item_id: "",
                    itemCode: "",
                    itemName: "",
                    qtyReturned: 1,
                    unitPrice: 0,
                    reasonCode: "DAMAGED",
                    remarks: "",
                    tax_type: String(defCode?.id || ""),
                    taxAmount: 0,
                  },
                ],
          );
        } else {
          const nextNoRes = await api.get("/sales/returns/next-no");
          if (!mounted) return;
          const nextNo = String(nextNoRes.data?.nextNo || "").trim();
          if (nextNo) {
            setFormData((p) => ({ ...p, returnNo: nextNo }));
          }
        }
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load data");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [existingId]);

  useEffect(() => {
    if (readOnly) return;
    setFormData((p) => ({ ...p, invoiceId: "" }));
    setInvoices([]);
    const cid = formData.customerId;
    if (!cid) return;
    api
      .get(`/sales/invoices?customer_id=${cid}`)
      .then((res) => {
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        setInvoices(list);
      })
      .catch(() => {
        setInvoices([]);
      });
  }, [formData.customerId, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    const invId = formData.invoiceId;
    if (!invId) return;
    api
      .get(`/sales/invoices/${invId}`)
      .then(async (res) => {
        const hdr = res.data?.item || {};
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (hdr?.warehouse_id) {
          setFormData((p) => ({
            ...p,
            warehouseId: String(hdr.warehouse_id),
          }));
        }
        let mapped = details.map((d, idx) => {
          const item = itemsMaster.find(
            (i) => Number(i.id) === Number(d.item_id),
          );
          const activeTaxId = String(
            item?.vat_on_sales_id || defaultTaxId || "",
          );
          const comps = taxComponentsByCode[activeTaxId] || [];
          const rate = comps.reduce(
            (sum, c) => sum + Number(c.rate_percent || 0),
            0,
          );
          const qty = Math.round(Number(d.quantity || 0) * 100) / 100;
          const price = Math.round(Number(d.unit_price || 0) * 100) / 100;
          const taxAmount =
            Math.round(((qty * price * rate) / 100) * 100) / 100;
          return {
            id: Date.now() + idx,
            item_id: d.item_id,
            itemCode: d.item_code || "",
            itemName: d.item_name || "",
            qtyReturned: qty,
            unitPrice: price,
            reasonCode: formData.returnType || "DAMAGED",
            remarks: "",
            tax_type: activeTaxId,
            taxAmount,
            uom: d.uom || "",
          };
        });
        const wh = hdr?.warehouse_id || formData.warehouseId || "";
        if (mapped.length && wh) {
          const enriched = await Promise.all(
            mapped.map(async (l) => ({
              ...l,
              availableQty: await fetchAvailable(wh, l.item_id),
            })),
          );
          mapped = enriched;
        }
        if (mapped.length) {
          setLines(mapped);
        }
      })
      .catch(() => {
        // ignore
      });
  }, [
    formData.invoiceId,
    itemsMaster,
    taxComponentsByCode,
    defaultTaxId,
    readOnly,
  ]);

  useEffect(() => {
    if (readOnly) return;
    const wh = formData.warehouseId;
    if (!wh) {
      setLines((prev) =>
        prev.map((l) => ({
          ...l,
          availableQty: undefined,
        })),
      );
      return;
    }
    const refresh = async () => {
      const updated = await Promise.all(
        lines.map(async (l) => {
          if (!l.item_id) {
            return { ...l, availableQty: undefined };
          }
          const qty = await fetchAvailable(wh, l.item_id);
          return { ...l, availableQty: qty };
        }),
      );
      setLines(updated);
    };
    refresh();
  }, [formData.warehouseId, readOnly]);

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: Date.now(),
        item_id: "",
        itemCode: "",
        itemName: "",
        qtyReturned: 1,
        unitPrice: 0,
        reasonCode: formData.returnType || "DAMAGED",
        remarks: "",
        tax_type: defaultTaxId,
        taxAmount: 0,
      },
    ]);
  };

  const removeLine = (lineId) => {
    setLines(lines.filter((l) => l.id !== lineId));
  };

  const handleItemChange = (lineId, itemId) => {
    const item = itemsMaster.find((i) => String(i.id) === String(itemId));
    const activeTaxId = String(item?.vat_on_sales_id || defaultTaxId || "");
    const comps = taxComponentsByCode[activeTaxId] || [];
    const rate = comps.reduce((sum, c) => sum + Number(c.rate_percent || 0), 0);

    const qty = 1;
    const price =
      Number(item?.selling_price || 0) ||
      Number(item?.standard_price || 0) ||
      0;
    const taxAmount = Math.round(((qty * price * rate) / 100) * 100) / 100;

    setLines(
      lines.map((l) =>
        l.id !== lineId
          ? l
          : {
              ...l,
              item_id: itemId,
              itemCode: item?.item_code || "",
              itemName: item?.item_name || "",
              qtyReturned: qty,
              unitPrice: price,
              reasonCode: formData.returnType || "DAMAGED",
              tax_type: activeTaxId,
              taxAmount,
              uom: item?.uom || "",
            },
      ),
    );
    const wh = formData.warehouseId;
    if (wh && itemId) {
      fetchAvailable(wh, Number(itemId))
        .then((qty) => {
          setLines((prev) =>
            prev.map((l) =>
              l.id !== lineId ? l : { ...l, availableQty: qty },
            ),
          );
        })
        .catch(() => {
          setLines((prev) =>
            prev.map((l) => (l.id !== lineId ? l : { ...l, availableQty: 0 })),
          );
        });
    } else {
      setLines((prev) =>
        prev.map((l) =>
          l.id !== lineId ? l : { ...l, availableQty: undefined },
        ),
      );
    }
  };

  const updateLine = (lineId, field, value) => {
    setLines(
      lines.map((l) => {
        if (l.id !== lineId) return l;
        const patch = { ...l, [field]: value };
        const comps = taxComponentsByCode[String(patch.tax_type)] || [];
        const rate = comps.reduce(
          (sum, c) => sum + Number(c.rate_percent || 0),
          0,
        );
        const qty =
          Number(field === "qtyReturned" ? value : patch.qtyReturned) || 0;
        const price =
          Number(field === "unitPrice" ? value : patch.unitPrice) || 0;
        patch.taxAmount = Math.round(((qty * price * rate) / 100) * 100) / 100;
        return patch;
      }),
    );
  };

  const normalizedItems = useMemo(() => {
    return lines
      .filter((l) => l.item_id && Number(l.qtyReturned) > 0)
      .map((l) => ({
        item_id: Number(l.item_id),
        qty_returned: Number(l.qtyReturned) || 0,
        unit_price: Number(l.unitPrice) || 0,
        tax_type: l.tax_type || null,
        reason_code: l.reasonCode || null,
        remarks: l.remarks || null,
        tax_amount: Number(l.taxAmount) || 0,
      }));
  }, [lines]);

  const calcTaxComponentsTotals = () => {
    const sub = lines.reduce(
      (s, i) => s + Number(i.qtyReturned || 0) * Number(i.unitPrice || 0),
      0,
    );
    const compTotals = {};
    lines.forEach((i) => {
      const comps = taxComponentsByCode[String(i.tax_type)] || [];
      comps.forEach((c) => {
        const rate = Number(c.rate_percent) || 0;
        const amt =
          (Number(i.qtyReturned || 0) * Number(i.unitPrice || 0) * rate) / 100;
        const name = c.component_name;
        if (!compTotals[name])
          compTotals[name] = { amount: 0, rate, sort_order: c.sort_order || 0 };
        compTotals[name].amount += amt;
      });
    });
    const components = Object.keys(compTotals)
      .map((name) => ({
        name,
        amount: compTotals[name].amount,
        rate: compTotals[name].rate,
        sort_order: compTotals[name].sort_order,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
    const taxTotal = components.reduce((s, c) => s + c.amount, 0);
    const total = sub + taxTotal;
    return { sub, components, taxTotal, total };
  };

  const totals = useMemo(() => {
    const grossSub = lines.reduce(
      (s, i) => s + Number(i.qtyReturned || 0) * Number(i.unitPrice || 0),
      0,
    );
    const tc = calcTaxComponentsTotals();
    const taxTotal = tc.taxTotal;
    const grand = grossSub + taxTotal;
    return {
      subTotal: Math.round(grossSub * 100) / 100,
      components: tc.components,
      taxTotal: Math.round(taxTotal * 100) / 100,
      grandTotal: Math.round(grand * 100) / 100,
    };
  }, [lines, taxComponentsByCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        return_date: formData.returnDate,
        customer_id: formData.customerId ? Number(formData.customerId) : null,
        invoice_id: formData.invoiceId ? Number(formData.invoiceId) : null,
        warehouse_id: formData.warehouseId
          ? Number(formData.warehouseId)
          : null,
        return_type: formData.returnType,
        status: formData.status,
        remarks: formData.remarks || null,
        items: normalizedItems,
      };
      const resp = await api.post("/sales/returns", payload);
      toast.success("Sales return created successfully");
      navigate("/sales/returns", { state: { refresh: true } });
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save sales return");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {readOnly ? "View Sales Return" : "New Sales Return"}
              </h1>
              <p className="text-sm mt-1">
                Record returned goods and auto-create a Credit Note
              </p>
            </div>
            <button onClick={() => window.history.back()} className="btn-success">
              Back to List
            </button>
          </div>
        </div>
        <div className="card-body p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error ? (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            ) : null}

            {/* Visual return no field is hidden */}
            <input type="hidden" value={formData.returnNo} />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Return Date</label>
                <input
                  type="date"
                  className="input"
                  value={formData.returnDate}
                  disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, returnDate: e.target.value }))
                  }
                />
              </div>

              <div className="relative">
                <label className="label">Customer *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Search customer..."
                  required={!formData.customerId}
                  disabled={readOnly}
                  value={
                    customers.find(
                      (c) => String(c.id) === String(formData.customerId),
                    )?.customer_name || customerSearch
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerSearch(val);
                    setFormData((prev) => ({
                      ...prev,
                      customerId: "",
                      invoiceId: "",
                    }));
                  }}
                />
                {!readOnly &&
                  customerSearch &&
                  (() => {
                    const q = customerSearch.toLowerCase();
                    const matched = customers
                      .filter(
                        (c) =>
                          String(c.customer_name || "")
                            .toLowerCase()
                            .includes(q) ||
                          String(c.customer_code || "")
                            .toLowerCase()
                            .includes(q),
                      )
                      .slice(0, 10);
                    return matched.length > 0 ? (
                      <div className="absolute z-30 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                        {matched.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                customerId: String(c.id),
                              }));
                              setCustomerSearch("");
                            }}
                          >
                            <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                              {c.customer_name}
                            </div>
                            {c.customer_code && (
                              <div className="text-xs text-slate-500">
                                {c.customer_code}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })()}
              </div>

              <div>
                <label className="label">Related Invoice</label>
                {formData.customerId ? (
                  <select
                    className="input"
                    value={formData.invoiceId}
                    disabled={readOnly}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, invoiceId: e.target.value }))
                    }
                  >
                    <option value="">Select Invoice</option>
                    {invoices.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.invoice_no}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input bg-gray-50"
                    value=""
                    readOnly
                    placeholder="Select customer first"
                  />
                )}
              </div>

              <div>
                <label className="label">Warehouse</label>
                <select
                  className="input"
                  value={formData.warehouseId}
                  disabled={readOnly}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, warehouseId: e.target.value }))
                  }
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Moved Remarks to the same row as reason for return, Remarks to be textarea rows=4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Reason for Return</label>
                <select
                  className="input w-full"
                  value={formData.returnType}
                  disabled={readOnly}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, returnType: e.target.value }))
                  }
                >
                  {returnReasons.length > 0 ? (
                    returnReasons.map((r) => (
                      <option key={r.id} value={r.reason_code}>
                        {r.reason_name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="DAMAGED">Damaged</option>
                      <option value="WRONG_ITEM">Wrong Item</option>
                      <option value="QUALITY_ISSUE">Quality Issue</option>
                      <option value="EXCESS">Excess</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="label">Reason / Remarks</label>
                <textarea
                  className="textarea w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2 focus:ring-2 focus:ring-brand focus:border-brand"
                  rows={4}
                  placeholder="Reason for rejection or return details"
                  value={formData.remarks}
                  readOnly={readOnly}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, remarks: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="p-4 flex items-center justify-between">
                <div className="font-medium">Return Items</div>
                {!readOnly ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={addLine}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Line
                  </button>
                ) : (
                  <div className="h-9 w-28" aria-hidden />
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="w-1/2 min-w-[280px]">Item</th>
                      <th className="w-24 min-w-[100px]">Code</th>
                      <th className="w-24">UOM</th>
                      <th className="text-right w-28">Qty</th>
                      <th className="text-right w-32">Available Qty</th>
                      <th className="text-right w-32">Unit Price</th>
                      <th className="text-right w-32">Tax Code</th>
                      <th className="text-right w-28">Tax Amt</th>
                      <th className="text-right w-32">Total Amount</th>
                      <th className="w-40">Reason</th>
                      <th className="w-64">Remarks</th>
                      {!readOnly && <th className="w-16"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((ln) => {
                      const itemQuery = itemQueries[ln.id] || "";
                      const searchResults = itemQuery.trim()
                        ? itemsMaster
                            .filter(
                              (i) =>
                                String(i.item_code || "")
                                  .toLowerCase()
                                  .includes(itemQuery.toLowerCase()) ||
                                String(i.item_name || "")
                                  .toLowerCase()
                                  .includes(itemQuery.toLowerCase()),
                            )
                            .slice(0, 10)
                        : [];

                      return (
                        <tr key={ln.id}>
                          <td>
                            {readOnly ? (
                              <div className="p-2 font-medium">
                                {ln.itemName}
                              </div>
                            ) : (
                              <div className="relative">
                                <input
                                  id={`sr-item-search-${ln.id}`}
                                  autoComplete="off"
                                  className="input text-sm py-1 w-full"
                                  placeholder="Type to search items..."
                                  value={
                                    itemQueries[ln.id] !== undefined
                                      ? itemQueries[ln.id]
                                      : ln.itemName || ""
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setItemQueries((prev) => ({
                                      ...prev,
                                      [ln.id]: val,
                                    }));
                                    if (!val && ln.item_id) {
                                      handleItemChange(ln.id, "");
                                    }
                                  }}
                                />
                                {searchResults.length > 0 &&
                                  (() => {
                                    const el = document.getElementById(
                                      `sr-item-search-${ln.id}`,
                                    );
                                    const r = el
                                      ? el.getBoundingClientRect()
                                      : { bottom: 0, left: 0, width: 0 };
                                    return (
                                      <div
                                        className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto"
                                        style={{
                                          position: "fixed",
                                          top: `${r.bottom + 4}px`,
                                          left: `${r.left}px`,
                                          width: `${r.width}px`,
                                          zIndex: 9999,
                                        }}
                                      >
                                        {searchResults.map((o) => (
                                          <button
                                            type="button"
                                            key={o.id}
                                            className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-xs border-b border-slate-100 last:border-b-0"
                                            onClick={() => {
                                              handleItemChange(ln.id, String(o.id));
                                              setItemQueries((prev) => ({
                                                ...prev,
                                                [ln.id]: o.item_name,
                                              }));
                                            }}
                                          >
                                            {o.item_code} - {o.item_name}
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })()}
                              </div>
                            )}
                          </td>
                          <td>{ln.itemCode || ""}</td>
                          <td>
                            <input
                              className="input w-full min-w-[5rem] bg-gray-50"
                              value={ln.uom || ""}
                              readOnly
                            />
                          </td>
                          <td className="text-right">
                            <input
                              type="number"
                              min={0}
                              className="input text-right w-full min-w-[5rem]"
                              value={ln.qtyReturned}
                              readOnly={readOnly}
                              onChange={(e) =>
                                updateLine(ln.id, "qtyReturned", e.target.value)
                              }
                            />
                          </td>
                          <td className="text-right">
                            {formData.warehouseId
                              ? Number(ln.availableQty || 0).toFixed(2)
                              : ""}
                          </td>
                          <td className="text-right">
                            <input
                              type="number"
                              min={0}
                              step="1"
                              className="input text-right w-full min-w-[6rem]"
                              value={ln.unitPrice}
                              readOnly={readOnly}
                              onChange={(e) =>
                                updateLine(ln.id, "unitPrice", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <select
                              className="input w-full min-w-[7rem]"
                              value={ln.tax_type}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateLine(ln.id, "tax_type", e.target.value)
                              }
                            >
                              <option value="">No Tax</option>
                              {taxes.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.code} ({Number(t.rate_percent || 0)}%)
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="text-right">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="input text-right w-full min-w-[6rem] bg-gray-50"
                              value={Number(ln.taxAmount || 0).toFixed(2)}
                              readOnly
                            />
                          </td>
                          <td className="text-right">
                            {(
                              (Number(ln.qtyReturned) || 0) *
                                (Number(ln.unitPrice) || 0) +
                              Number(ln.taxAmount || 0)
                            ).toFixed(2)}
                          </td>
                          <td>
                            <select
                              className="input w-full min-w-[8rem]"
                              value={ln.reasonCode}
                              disabled={readOnly}
                              onChange={(e) =>
                                updateLine(ln.id, "reasonCode", e.target.value)
                              }
                            >
                              {returnReasons.length > 0 ? (
                                returnReasons.map((r) => (
                                  <option key={r.id} value={r.reason_code}>
                                    {r.reason_name}
                                  </option>
                                ))
                              ) : (
                                <>
                                  <option value="DAMAGED">Damaged</option>
                                  <option value="WRONG_ITEM">Wrong Item</option>
                                  <option value="QUALITY_ISSUE">
                                    Quality Issue
                                  </option>
                                  <option value="EXCESS">Excess</option>
                                </>
                              )}
                            </select>
                          </td>
                          <td>
                            <input
                              className="input w-full min-w-[10rem]"
                              value={ln.remarks}
                              readOnly={readOnly}
                              onChange={(e) =>
                                updateLine(ln.id, "remarks", e.target.value)
                              }
                            />
                          </td>
                          {!readOnly && (
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm text-red-600"
                                onClick={() => removeLine(ln.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Dynamic Components-based Aggregates calculation display block */}
              <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <div className="w-80 space-y-3">
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-semibold">
                      {totals.subTotal.toFixed(2)}
                    </span>
                  </div>

                  {totals.components.map((c, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-sm text-slate-600 dark:text-slate-400 pl-4 border-l-2 border-slate-300"
                    >
                      <span>
                        {c.name} ({c.rate}%)
                      </span>
                      <span>{c.amount.toFixed(2)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 border-t border-dashed border-slate-300 pt-2">
                    <span>Tax Total</span>
                    <span>{totals.taxTotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-base font-bold text-slate-900 dark:text-slate-100 border-t border-slate-300 pt-2">
                    <span>Total Amount</span>
                    <span>{totals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => window.history.back()} className="btn btn-secondary">
                {readOnly ? "Back to List" : "Cancel"}
              </button>
              {!readOnly && (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Sales Return"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
