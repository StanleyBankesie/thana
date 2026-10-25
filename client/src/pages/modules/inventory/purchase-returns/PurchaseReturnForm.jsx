import React, { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import { Plus, Trash2 } from "lucide-react";
import { usePermission } from "@/auth/PermissionContext.jsx";
import TaxPricingModal, { TaxModeRadioSelector } from "@/components/common/TaxPricingModal.jsx";

export default function PurchaseReturnForm() {
  const { hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || (id ? "view" : "new");
  const readOnly = mode === "view";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [itemsMaster, setItemsMaster] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [returnReasons, setReturnReasons] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});
  const [defaultTaxId, setDefaultTaxId] = useState("");
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [showTaxModeAlert, setShowTaxModeAlert] = useState(false);
  const [hasPromptedTaxMode, setHasPromptedTaxMode] = useState(false);
  const initialLineId = useMemo(() => Date.now(), []);
  const fallbackReasons = [
    { code: "DAMAGED", name: "Damaged" },
    { code: "WRONG_ITEM", name: "Wrong Item" },
    { code: "QUALITY_ISSUE", name: "Quality Issue" },
    { code: "EXCESS", name: "Excess" },
  ];

  const [formData, setFormData] = useState({
    returnNo: "Auto-generated",
    returnDate: new Date().toISOString().split("T")[0],
    supplierId: "",
    purchaseBillId: "",
    warehouseId: "",
    returnType: "",
    remarks: "",
    tax_mode: "EXCLUSIVE",
    tax_code_id: "",
    tax_rate: 0,
    tax_component_name: "",
  });

  const [lines, setLines] = useState([
    {
      id: initialLineId,
      item_id: "",
      itemCode: "",
      itemName: "",
      qtyReturned: 1,
      unitPrice: 0,
      tax_type: "",
      taxAmount: 0,
      reasonCode: "",
      remarks: "",
      uom: "",
      availableQty: 0,
    },
  ]);
  const [itemQueries, setItemQueries] = useState({ [initialLineId]: "" });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [supRes, whRes, itemsRes, taxRes, nextNoRes, reasonsRes] =
          await Promise.allSettled([
            api.get("/purchase/suppliers?active=true"),
            api.get("/inventory/warehouses"),
            api.get("/inventory/items"),
            api.get("/finance/tax-codes/by-page/20"),
            api.get("/purchase/returns/next-no"),
            api.get("/purchase/return-rejection-reasons"),
          ]);
        if (!mounted) return;
        setSuppliers(
          supRes.status === "fulfilled" && Array.isArray(supRes.value?.data?.items) ? supRes.value.data.items : [],
        );
        setWarehouses(
          whRes.status === "fulfilled" && Array.isArray(whRes.value?.data?.items) ? whRes.value.data.items : [],
        );
        setItemsMaster(
          itemsRes.status === "fulfilled" && Array.isArray(itemsRes.value?.data?.items) ? itemsRes.value.data.items : [],
        );
        const taxItems =
          taxRes.status === "fulfilled" && Array.isArray(taxRes.value?.data?.items)
            ? taxRes.value.data.items
            : [];
        setTaxes(taxItems);
        setDefaultTaxId("");
        const reasonItems =
          reasonsRes.status === "fulfilled" && Array.isArray(reasonsRes.value?.data?.items)
            ? reasonsRes.value.data.items
            : [];
        const activeReasons = reasonItems.filter((r) => r.is_active);
        setReturnReasons(activeReasons);
        if (activeReasons.length > 0 && !id) {
          const firstCode = activeReasons[0].reason_code;
          setFormData((p) => ({ ...p, returnType: firstCode }));
          setLines((prev) =>
            prev.map((l) => ({ ...l, reasonCode: firstCode })),
          );
        }
        const nextNo = nextNoRes.status === "fulfilled" ? String(nextNoRes.value?.data?.nextNo || "").trim() : "";
        if (nextNo) setFormData((p) => ({ ...p, returnNo: nextNo }));
      } catch (err) {
        if (!mounted) return;
        setError("Failed to load master data");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (id) {
      api
        .get(`/purchase/returns/${id}`)
        .then((res) => {
          const d = res.data || {};
          setFormData((p) => ({
            ...p,
            returnNo: d.return_no || p.returnNo,
            returnDate: String(d.return_date || p.returnDate).slice(0, 10),
            supplierId: String(d.supplier_id || ""),
            warehouseId: String(d.warehouse_id || ""),
            returnType: d.return_type || p.returnType,
            remarks: d.remarks || "",
          }));
          if (d.supplier_id) {
            const s = suppliers.find(
              (s) => String(s.id) === String(d.supplier_id),
            );
            if (s) setSupplierSearch(s.supplier_name);
          }
          if (Array.isArray(d.details) && d.details.length) {
            const newLines = d.details.map((det, idx) => ({
              id: Date.now() + idx,
              item_id: String(det.item_id || ""),
              itemCode: det.item_code || "",
              itemName: det.item_name || "",
              qtyReturned: Number(det.qty_returned || 0),
              unitPrice: Number(det.unit_price || 0),
              tax_type: String(det.tax_type || ""),
              taxAmount: Number(det.tax_amount || 0),
              reasonCode: det.reason_code || "",
              remarks: det.remarks || "",
              uom: "",
              availableQty: 0,
            }));
            setLines(newLines);
            const qs = {};
            newLines.forEach((l) => {
              qs[l.id] = l.itemCode ? `${l.itemCode} - ${l.itemName}` : "";
            });
            setItemQueries(qs);
          }
        })
        .catch(() => setError("Failed to load return"));
    }
  }, [id]);

  useEffect(() => {
    const supplierId = formData.supplierId;
    if (!supplierId) {
      setPurchaseBills([]);
      setFormData((p) => ({ ...p, purchaseBillId: "" }));
      return;
    }
    api
      .get("/purchase/bills/outstanding", {
        params: { supplier_id: supplierId },
      })
      .then((res) => {
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setPurchaseBills(items);
        if (
          !items.some((b) => String(b.id) === String(formData.purchaseBillId))
        ) {
          setFormData((p) => ({ ...p, purchaseBillId: "" }));
        }
      })
      .catch(() => setPurchaseBills([]));
  }, [formData.supplierId]);

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

  const fetchAvailable = async (warehouseId, itemId) => {
    if (!warehouseId || !itemId) return 0;
    try {
      const resp = await api.get("/inventory/stock/balance", {
        params: { item_id: itemId, warehouse_id: warehouseId },
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
    } catch {}
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
    let cancelled = false;
    (async () => {
      const billId = formData.purchaseBillId;
      if (!billId) return;
      const bill = purchaseBills.find((b) => String(b.id) === String(billId));
      if (!bill) return;
      const details = Array.isArray(bill.details) ? bill.details : [];
      const lineIds = details.map((_, idx) => Date.now() + idx);
      let mapped = details.map((d, idx) => {
        const item = itemsMaster.find(
          (i) => Number(i.id) === Number(d.item_id),
        );
        const taxId = String(
          d.tax_code_id || item?.vat_on_purchase_id || defaultTaxId || "",
        );
        const comps = taxComponentsByCode[taxId] || [];
        const rate = comps.reduce(
          (sum, c) => sum + Number(c.rate_percent || 0),
          0,
        );
        const qty = Math.round(Number(d.qty || 0) * 1000) / 1000;
        const price = Math.round(Number(d.unit_price || 0) * 100) / 100;
        const taxAmount = Math.round(((qty * price * rate) / 100) * 100) / 100;
        return {
          id: lineIds[idx],
          item_id: d.item_id ? String(d.item_id) : "",
          itemCode: d.item_code || "",
          itemName: d.item_name || "",
          qtyReturned: qty,
          unitPrice: price,
          tax_type: taxId,
          taxAmount,
          reasonCode:
            formData.returnType || returnReasons[0]?.reason_code || "",
          remarks: "",
          uom: d.uom || item?.uom || "",
          availableQty: 0,
        };
      });
      const wh = formData.warehouseId;
      if (wh) {
        const enriched = await Promise.all(
          mapped.map(async (l) => ({
            ...l,
            availableQty: await fetchAvailable(wh, l.item_id),
          })),
        );
        mapped = enriched;
      }
      if (cancelled) return;
      if (mapped.length) {
        setLines(mapped);
        setItemQueries((prev) => {
          const next = { ...prev };
          mapped.forEach((ln) => {
            next[ln.id] = ln.itemCode ? `${ln.itemCode} - ${ln.itemName}` : "";
          });
          Object.keys(next).forEach((k) => {
            if (!mapped.some((ln) => ln.id === Number(k))) delete next[k];
          });
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    formData.purchaseBillId,
    purchaseBills,
    itemsMaster,
    taxComponentsByCode,
    defaultTaxId,
    returnReasons,
    formData.warehouseId,
  ]);

  const handleItemChange = (lineId, itemId) => {
    const item = itemsMaster.find((i) => String(i.id) === String(itemId));
    const isInclusive = String(formData.tax_mode || "EXCLUSIVE").toUpperCase() === "INCLUSIVE";
    const qty = 1;
    const price =
      Number(item?.cost_price || 0) || Number(item?.standard_price || 0) || 0;
    const gross = qty * price;

    let taxAmount = 0;
    let taxRate = 0;
    let activeTaxId = "";

    taxRate = Number(formData.tax_rate || 0);
    activeTaxId = formData.tax_code_id || "";
    if (isInclusive) {
      if (taxRate > 0) {
        const net = Math.round((gross / (1 + taxRate / 100)) * 100) / 100;
        taxAmount = Math.round((gross - net) * 100) / 100;
      }
    } else {
      taxAmount = taxRate > 0 ? Math.round((gross * (taxRate / 100)) * 100) / 100 : 0;
    }

    setLines((prev) =>
      prev.map((l) =>
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
              tax_mode: isInclusive ? "INCLUSIVE" : "EXCLUSIVE",
              tax_type: activeTaxId,
              tax_rate: taxRate,
              taxAmount,
              uom: item?.uom || "",
            },
      ),
    );
    const wh = formData.warehouseId;
    if (wh && itemId) {
      fetchAvailable(wh, Number(itemId))
        .then((qty) =>
          setLines((prev) =>
            prev.map((l) =>
              l.id !== lineId ? l : { ...l, availableQty: qty },
            ),
          ),
        )
        .catch(() =>
          setLines((prev) =>
            prev.map((l) => (l.id !== lineId ? l : { ...l, availableQty: 0 })),
          ),
        );
    } else {
      setLines((prev) =>
        prev.map((l) =>
          l.id !== lineId ? l : { ...l, availableQty: undefined },
        ),
      );
    }
  };

  const updateLine = (lineId, field, value) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const updated = { ...l, [field]: value };
        if (field === "item_id" && value) {
          const item = itemsMaster.find((i) => String(i.id) === String(value));
          if (item) {
            updated.itemCode = item.item_code || "";
            updated.itemName = item.item_name || "";
            updated.uom = item.uom || "";
            const taxId = String(item.vat_on_purchase_id || defaultTaxId || "");
            updated.tax_type = taxId;
            const comps = taxComponentsByCode[taxId] || [];
            const rate = comps.reduce(
              (sum, c) => sum + Number(c.rate_percent || 0),
              0,
            );
            updated.unitPrice =
              Number(item.cost_price || 0) ||
              Number(item.standard_price || 0) ||
              0;
            updated.taxAmount =
              Math.round(
                ((Number(updated.qtyReturned || 0) * updated.unitPrice * rate) /
                  100) *
                  100,
              ) / 100;
            const wh = formData.warehouseId;
            if (wh) {
              fetchAvailable(wh, Number(value)).then((q) => {
                setLines((p) =>
                  p.map((x) =>
                    x.id !== lineId ? x : { ...x, availableQty: q },
                  ),
                );
              });
            }
          }
        }
        const qtyVal = Number(updated.qtyReturned || 0);
        const priceVal = Number(updated.unitPrice || 0);
        const gross = qtyVal * priceVal;
        const isInclusive = String(formData.tax_mode || "EXCLUSIVE").toUpperCase() === "INCLUSIVE";

        const taxRate = Number(updated.tax_rate) > 0
          ? Number(updated.tax_rate)
          : Number(formData.tax_rate || 0);
        if (isInclusive) {
          if (taxRate > 0) {
            const net = Math.round((gross / (1 + taxRate / 100)) * 100) / 100;
            updated.taxAmount = Math.round((gross - net) * 100) / 100;
          } else {
            updated.taxAmount = 0;
          }
        } else {
          updated.taxAmount = taxRate > 0 ? Math.round((gross * (taxRate / 100)) * 100) / 100 : 0;
        }
        return updated;
      }),
    );
  };

  const addLine = () => {
    const newId = Date.now() + Math.random();
    setLines((prev) => [
      ...prev,
      {
        id: newId,
        item_id: "",
        itemCode: "",
        itemName: "",
        qtyReturned: 1,
        unitPrice: 0,
        tax_type: "",
        taxAmount: 0,
        reasonCode: formData.returnType || returnReasons[0]?.reason_code || "",
        remarks: "",
        uom: "",
        availableQty: 0,
      },
    ]);
    setItemQueries((prev) => ({ ...prev, [newId]: "" }));
  };

  const removeLine = (id) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
    setItemQueries((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const normalizedItems = useMemo(() => {
    return lines
      .filter((ln) => ln.item_id && Number(ln.qtyReturned) > 0)
      .map((ln) => ({
        item_id: Number(ln.item_id),
        qty_returned: Number(ln.qtyReturned) || 0,
        unit_price: Number(ln.unitPrice) || 0,
        tax_type: ln.tax_type || null,
        reason_code: ln.reasonCode || null,
        remarks: ln.remarks || null,
        tax_amount: Number(ln.taxAmount) || 0,
      }));
  }, [lines]);

  const calcTaxComponentsTotals = () => {
    const sub = lines.reduce(
      (sum, ln) =>
        sum + Number(ln.qtyReturned || 0) * Number(ln.unitPrice || 0),
      0,
    );
    const compTotals = {};
    lines.forEach((ln) => {
      const comps = taxComponentsByCode[String(ln.tax_type)] || [];
      comps.forEach((comp) => {
        const rate = Number(comp.rate_percent) || 0;
        const amount =
          (Number(ln.qtyReturned || 0) * Number(ln.unitPrice || 0) * rate) /
          100;
        const name = comp.component_name;
        if (!compTotals[name]) {
          compTotals[name] = {
            amount: 0,
            rate,
            sort_order: comp.sort_order || 0,
          };
        }
        compTotals[name].amount += amount;
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
    const taxTotal = components.reduce((sum, comp) => sum + comp.amount, 0);
    const total = sub + taxTotal;
    return { sub, components, taxTotal, total };
  };

  const handleTaxModeChange = (newMode) => {
    setFormData((prev) => ({
      ...prev,
      tax_mode: newMode,
    }));
    setLines((prev) =>
      prev.map((ln) => {
        const gross = Number(ln.qtyReturned || 0) * Number(ln.unitPrice || 0);
        const isInclusive = newMode === "INCLUSIVE";
        const taxRate = Number(
          ln.tax_rate !== undefined && ln.tax_rate !== null
            ? ln.tax_rate
            : (formData.tax_rate || 0)
        );
        let taxAmount = 0;
        let lineTotal = gross;
        let net = gross;
        if (isInclusive && taxRate > 0) {
          net = Math.round((gross / (1 + taxRate / 100)) * 100) / 100;
          taxAmount = Math.round((gross - net) * 100) / 100;
          lineTotal = gross;
        } else if (!isInclusive && taxRate > 0) {
          taxAmount = Math.round((gross * (taxRate / 100)) * 100) / 100;
          lineTotal = Math.round((gross + taxAmount) * 100) / 100;
        }
        return {
          ...ln,
          tax_mode: newMode,
          tax_code_id: ln.tax_code_id || formData.tax_code_id || "",
          tax_rate: taxRate,
          taxAmount,
          net,
          lineTotal,
        };
      }),
    );
  };

  const totals = useMemo(() => {
    let grossSub = 0;
    let netSub = 0;
    let totalTax = 0;
    const isInclusive = String(formData.tax_mode || "").toUpperCase() === "INCLUSIVE";

    lines.forEach((ln) => {
      const gross = Number(ln.qtyReturned || 0) * Number(ln.unitPrice || 0);
      grossSub += gross;

      const taxRate = Number(
        ln.tax_rate !== undefined && ln.tax_rate !== null && Number(ln.tax_rate) > 0
          ? ln.tax_rate
          : (formData.tax_rate || 0)
      );
      if (isInclusive) {
        const lineNet = taxRate > 0 ? Math.round((gross / (1 + taxRate / 100)) * 100) / 100 : gross;
        const lineTax = Math.round((gross - lineNet) * 100) / 100;
        netSub += lineNet;
        totalTax += lineTax;
      } else {
        const lineTax = taxRate > 0 ? Math.round((gross * (taxRate / 100)) * 100) / 100 : 0;
        netSub += gross;
        totalTax += lineTax;
      }
    });

    const subTotal = isInclusive ? netSub : grossSub;
    const grandTotal = isInclusive ? grossSub : subTotal + totalTax;

    const components = [];
    if (totalTax > 0) {
      components.push({
        name: formData.tax_component_name || (formData.tax_rate ? `Tax (${formData.tax_rate}%)` : "Tax"),
        amount: totalTax,
        rate: formData.tax_rate || 0,
      });
    }

    return {
      subTotal: Math.round(subTotal * 100) / 100,
      components,
      taxTotal: Math.round(totalTax * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
    };
  }, [lines, formData.tax_mode, formData.tax_rate, formData.tax_component_name]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        supplier_id: Number(formData.supplierId || 0),
        warehouse_id: formData.warehouseId
          ? Number(formData.warehouseId)
          : null,
        return_type: formData.returnType || "DAMAGED",
        remarks: formData.remarks || null,
        return_date: String(formData.returnDate || "").slice(0, 10),
        items: normalizedItems,
      };
      const resp = await api.post("/purchase/returns", payload);
      toast.success("Purchase return created successfully");
      navigate("/purchase/purchase-returns", { state: { refresh: true } });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save purchase return",
      );
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
                {readOnly ? "View" : mode === "edit" ? "Edit" : "New"} Purchase
                Return
              </h1>
              <p className="text-sm mt-1">
                Record goods returned to supplier and auto-create a Debit Note
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

            <input type="hidden" value={formData.returnNo} />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Return Date</label>
                <input
                  type="date"
                  className="input"
                  value={formData.returnDate}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, returnDate: e.target.value }))
                  }
                  readOnly={readOnly}
                  disabled={readOnly}
                />
              </div>
              <div className="relative">
                <label className="label">Supplier *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Search supplier..."
                  required={!formData.supplierId}
                  value={
                    suppliers.find(
                      (s) => String(s.id) === String(formData.supplierId),
                    )?.supplier_name || supplierSearch
                  }
                  onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setFormData((prev) => ({
                      ...prev,
                      supplierId: "",
                      purchaseBillId: "",
                    }));
                  }}
                  readOnly={readOnly}
                  disabled={readOnly}
                />
                {supplierSearch &&
                  !readOnly &&
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
                      <div className="absolute z-30 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                        {matched.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                supplierId: String(s.id),
                              }));
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
              <div>
                <label className="label">Related Purchase Bill</label>
                {formData.supplierId ? (
                  <select
                    className="input"
                    value={formData.purchaseBillId || ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        purchaseBillId: e.target.value,
                      }))
                    }
                    disabled={readOnly}
                  >
                    <option value="">Select purchase bill</option>
                    {purchaseBills.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bill_no}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input bg-white dark:bg-slate-900"
                    value=""
                    readOnly
                    placeholder="Select supplier first"
                  />
                )}
              </div>
              <div>
                <label className="label">Warehouse</label>
                <select
                  className="input"
                  value={formData.warehouseId}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, warehouseId: e.target.value }))
                  }
                  disabled={readOnly}
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name || w.warehouse_code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Reason for Return</label>
                <select
                  className="input"
                  value={formData.returnType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((p) => ({ ...p, returnType: val }));
                    setLines((prev) =>
                      prev.map((l) => ({ ...l, reasonCode: val })),
                    );
                  }}
                  disabled={readOnly}
                >
                  <option value="">Select reason</option>
                  {returnReasons.map((r) => (
                    <option key={r.id} value={r.reason_code}>
                      {r.reason_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="w-full">
              <label className="label">Remarks / Notes</label>
              <textarea
                className="textarea w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2 focus:ring-2 focus:ring-brand focus:border-brand"
                rows={3}
                placeholder="Reason for rejection or return details"
                value={formData.remarks}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, remarks: e.target.value }))
                }
                readOnly={readOnly}
              />
            </div>

            <div className="rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="p-4 flex items-center justify-between">
                <div className="font-medium">Return Items</div>
                <div className="flex items-center gap-4">
                  <TaxModeRadioSelector
                    taxMode={formData.tax_mode || "EXCLUSIVE"}
                    onModeChange={handleTaxModeChange}
                    onOpenTaxModal={() => setTaxModalOpen(true)}
                    selectedTaxLabel={formData.tax_component_name}
                    openAlert={showTaxModeAlert}
                    onCloseAlert={() => setShowTaxModeAlert(false)}
                    anchorSelector={`#pr-item-search-${lines[0]?.id || 0}`}
                  />
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
                      const searchResults =
                        !readOnly && itemQuery.trim()
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
                      const lineTotal =
                        Math.round(
                          Number(ln.qtyReturned || 0) *
                            Number(ln.unitPrice || 0) *
                            100,
                        ) / 100;
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
                                  id={`pr-item-search-${ln.id}`}
                                  autoComplete="off"
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
                                    if (!val && ln.item_id)
                                      handleItemChange(ln.id, "");
                                  }}
                                  readOnly={readOnly}
                                  disabled={readOnly}
                                />
                                {searchResults.length > 0 &&
                                  (() => {
                                    const el = document.getElementById(
                                      `pr-item-search-${ln.id}`,
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
                                              handleItemChange(
                                                ln.id,
                                                String(o.id),
                                              );
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
                              className="input w-full min-w-[5rem] bg-white dark:bg-slate-900"
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
                              onChange={(e) =>
                                updateLine(ln.id, "qtyReturned", e.target.value)
                              }
                              readOnly={readOnly}
                              disabled={readOnly}
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
                              step="0.01"
                              className="input text-right w-full min-w-[5rem]"
                              value={ln.unitPrice}
                              onChange={(e) =>
                                updateLine(
                                  ln.id,
                                  "unitPrice",
                                  Number(e.target.value || 0),
                                )
                              }
                              readOnly={readOnly}
                              disabled={readOnly}
                            />
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              onClick={() => setTaxModalOpen(true)}
                              className="w-full text-left p-1.5 border border-slate-300 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-800 hover:bg-slate-50 flex items-center justify-between"
                            >
                              <span className="truncate">
                                {formData.tax_component_name || (ln.tax_rate ? `Tax (${ln.tax_rate}%)` : "Select Tax")}
                              </span>
                              <span className="text-blue-600 font-semibold ml-1">Edit</span>
                            </button>
                          </td>
                          <td className="text-right">
                            <input
                              type="number"
                              className="input text-right bg-white dark:bg-slate-900 w-full min-w-[5rem]"
                              value={Number(ln.taxAmount || 0).toFixed(2)}
                              readOnly
                            />
                            {Number(ln.tax_rate || 0) > 0 && (
                              <div className="mt-0.5">
                                <span className="inline-block px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded font-medium">
                                  {ln.tax_rate}%
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="text-right">
                            {(lineTotal + Number(ln.taxAmount || 0)).toFixed(2)}
                          </td>
                          <td>
                            <select
                              className="input"
                              value={ln.reasonCode || ""}
                              onChange={(e) =>
                                updateLine(ln.id, "reasonCode", e.target.value)
                              }
                              disabled={readOnly}
                            >
                              {returnReasons.length > 0
                                ? returnReasons.map((r) => (
                                    <option key={r.id} value={r.reason_code}>
                                      {r.reason_name}
                                    </option>
                                  ))
                                : fallbackReasons.map((r) => (
                                    <option key={r.code} value={r.code}>
                                      {r.name}
                                    </option>
                                  ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="input"
                              value={ln.remarks}
                              onChange={(e) =>
                                updateLine(ln.id, "remarks", e.target.value)
                              }
                              readOnly={readOnly}
                              disabled={readOnly}
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
              <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <div className="w-80 space-y-3">
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-semibold">
                      {totals.subTotal.toFixed(2)}
                    </span>
                  </div>
                  {totals.components.map((comp, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-sm text-slate-600 dark:text-slate-400 pl-4 border-l-2 border-slate-300"
                    >
                      <span>
                        {comp.name && comp.name.includes("%") ? comp.name : `${comp.name} (${comp.rate}%)`}
                      </span>
                      <span>{comp.amount.toFixed(2)}</span>
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
              <button onClick={() => window.history.back()} className="btn btn-secondary"
              >
                {readOnly ? "Back to List" : "Cancel"}
              </button>
              {!readOnly && (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Purchase Return"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
      <TaxPricingModal
        open={taxModalOpen}
        form="PURCHASE_RETURN"
        pageId={20}
        onClose={() => setTaxModalOpen(false)}
        taxMode={formData.tax_mode || "EXCLUSIVE"}
        price={0}
        selectedComponent={{
          name: formData.tax_component_name,
          rate: formData.tax_rate,
          id: formData.tax_code_id,
        }}
        onSelectComponent={(comp) => {
          const compLabel = `${comp.name}${comp.rate !== undefined ? ` (${comp.rate}%)` : ""}`;
          const taxCodeId = comp.taxCodeId || comp.originalId || comp.id;
          const taxRate = comp.rate;
          const currentMode = formData.tax_mode || "EXCLUSIVE";
          const isInclusive = currentMode === "INCLUSIVE";

          setFormData((prev) => ({
            ...prev,
            tax_mode: currentMode,
            tax_code_id: taxCodeId || prev.tax_code_id,
            tax_rate: taxRate,
            tax_component_name: compLabel,
          }));

          setLines((prev) =>
            prev.map((ln) => {
              const gross = Number(ln.qtyReturned || 0) * Number(ln.unitPrice || 0);
              let net = gross;
              let taxAmount = 0;
              let lineTotal = gross;
              if (isInclusive && taxRate > 0) {
                net = Math.round((gross / (1 + taxRate / 100)) * 100) / 100;
                taxAmount = Math.round((gross - net) * 100) / 100;
                lineTotal = gross;
              } else if (!isInclusive && taxRate > 0) {
                taxAmount = Math.round((gross * (taxRate / 100)) * 100) / 100;
                lineTotal = Math.round((gross + taxAmount) * 100) / 100;
              }
              return {
                ...ln,
                tax_mode: currentMode,
                tax_code_id: taxCodeId || ln.tax_code_id,
                tax_rate: taxRate,
                taxAmount,
                net,
                lineTotal,
              };
            })
          );
          setTaxModalOpen(false);
        }}
      />
    </div>
  );
}
