/**
 * @fileoverview ProjectInvoiceForm component.
 * Provides functionality for ProjectInvoiceForm.
 */

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "api/client";
import { useUoms } from "@/hooks/useUoms";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import UnitConversionModal from "@/components/UnitConversionModal";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { Plus, ArrowLeft, FileText, Save } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import defaultLogo from "../../../../assets/resources/OMNISUITE_LOGO_FILL.png";
import { toast } from "react-toastify";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import TaxPricingModal, { TaxModeRadioSelector } from "@/components/common/TaxPricingModal.jsx";

/**
 *  component
 *
 * @returns {JSX.Element} The rendered component
 */
export default function ProjectInvoiceForm() {
  const { canEditDiscount, canAccessPath, hasExceptional } = usePermission();
  const navigate = useNavigate();
  const { id } = useParams();
  const { getExchangeRate } = useExchangeRate();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const { search } = useLocation();
  const searchParams = new URLSearchParams(search);
  const actionParam = searchParams.get("action");
  const modeParam = searchParams.get("mode");
  const readOnly = modeParam === "view";
  const canEdit = !readOnly;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);

  const [customerSearch, setCustomerSearch] = useState("");
  const [itemsCatalog, setItemsCatalog] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [form, setForm] = useState({
    invoice_no: "",
    invoice_date: new Date().toISOString().split("T")[0],
    customer_id: "",
    status: "POSTED",
    tax_mode: "EXCLUSIVE",
    tax_type: "",
    tax_rate: 0,
    tax_component_name: "",
    currency_id: "",
    exchange_rate: 1,
    address: "",
    address2: "",
    city: "",
    state: "",
    country: "",
    phone: "",
    remarks: "",
    project_id: "",
  });

  const [lines, setLines] = useState([]);
  const [newItem, setNewItem] = useState({
    item_id: "",
    item_name: "",
    qty: "",
    unit_price: "",
    discount_percent: "",
    tax_type: "",
    tax_rate: undefined,
    tax_mode: "EXCLUSIVE",
    tax_component_name: "",
    remarks: "",
    uom: "",
  });
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [editingLineTaxIdx, setEditingLineTaxIdx] = useState(null);
  const [showTaxModeAlert, setShowTaxModeAlert] = useState(false);
  const [hasPromptedTaxMode, setHasPromptedTaxMode] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const pdfRef = useRef(null);
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    website: "",
    taxId: "",
    registrationNo: "",
    logoUrl: "",
  });
  const [preparedBy, setPreparedBy] = useState("");
  const [customerPrices, setCustomerPrices] = useState([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);
  const { uoms } = useUoms();
  const defaultUomCode = React.useMemo(() => {
    const list = Array.isArray(uoms) ? uoms : [];
    const pcs =
      list.find((u) => String(u.uom_code || "").toUpperCase() === "PCS") ||
      list[0];
    if (pcs && pcs.uom_code) return pcs.uom_code;
    return "PCS";
  }, [uoms]);
  const [convModal, setConvModal] = useState({
    open: false,
    itemId: null,
    defaultUom: "",
    currentUom: "",
    rowId: null,
  });
  const [unitConversions, setUnitConversions] = useState([]);
  const [autoDelivery, setAutoDelivery] = useState(true);
  const [projects, setProjects] = useState([]);

  const baseCurrencyCode = React.useMemo(() => {
    return (
      currencies.find((c) => Number(c.is_base) === 1 || c.is_base === true)
        ?.code || "GHS"
    );
  }, [currencies]);

  const selectedCurrencyCode = React.useMemo(() => {
    return (
      currencies.find((c) => String(c.id) === String(form.currency_id))?.code ||
      ""
    );
  }, [currencies, form.currency_id]);

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
  }, [form.currency_id, currencies]);

  useEffect(() => {
    api
      .get("/inventory/unit-conversions")
      .then((res) => {
        setUnitConversions(
          Array.isArray(res.data?.items) ? res.data.items : [],
        );
      })
      .catch(() => {
        setUnitConversions([]);
      });
  }, []);

  // Helper function to format invoice number with '-' between INV and digits
  const formatInvoiceNumber = (invoiceNo) => {
    if (!invoiceNo || typeof invoiceNo !== "string") return invoiceNo;
    if (
      invoiceNo.startsWith("INV") &&
      invoiceNo.length === 9 &&
      /^\d{6}$/.test(invoiceNo.substring(3))
    ) {
      return `INV-${invoiceNo.substring(3)}`;
    }
    return invoiceNo;
  };

  useEffect(() => {
    fetchCustomers();
    fetchItems();
    fetchCurrencies();
    fetchTaxCodes();
    fetchCompanyInfo();
    fetchProjects();
    if (isEdit) {
      fetchInvoice();
    } else {
      const due = calcDueDate(form.invoice_date, form.payment_terms);
      setForm((p) => ({ ...p, due_date: due }));
      api
        .get("/projects/project-invoices/next-no")
        .then((resp) => {
          const nextNo = resp.data?.nextNo;
          if (nextNo) {
            setForm((p) => ({ ...p, invoice_no: formatInvoiceNumber(nextNo) }));
          }
        })
        .catch(() => {
          setForm((p) => ({
            ...p,
            invoice_no: p.invoice_no || "INV-000001",
          }));
        });
    }
  }, [isEdit, id]);

  useEffect(() => {
    const run = async () => {
      if (!isEdit) return;
      if (actionParam === "print") {
        try {
          await ensureTaxComponentsLoaded();
        } catch {}
        setTimeout(() => window.print(), 200);
      } else if (actionParam === "pdf") {
        const el = pdfRef.current;
        if (!el) return;
        const original = el.style.cssText;
        el.style.cssText =
          original +
          ";position:fixed;left:-10000px;top:0;display:block;z-index:-1;background:white;width:794px;padding:32px;";
        try {
          const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
          });
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
          const fname =
            "Invoice_" +
            (form.invoice_no || new Date().toISOString().slice(0, 10)) +
            ".pdf";
          pdf.save(fname);
        } finally {
          el.style.cssText = original;
        }
      }
    };
    run();
  }, [actionParam, isEdit]);



  const fetchCustomers = async () => {
    try {
      const response = await api.get("/sales/customers", {
        params: { active: "true" },
      });
      setCustomers(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchItems = async () => {
    try {
      const [itemsRes, stdRes] = await Promise.allSettled([
        api.get("/inventory/items"),
        api.get("/sales/prices/standard"),
      ]);
      const items =
        itemsRes.status === "fulfilled" &&
        Array.isArray(itemsRes.value?.data?.items)
          ? itemsRes.value.data.items
          : [];
      const std =
        stdRes.status === "fulfilled" &&
        Array.isArray(stdRes.value?.data?.items)
          ? stdRes.value.data.items
          : [];
      const latestByProduct = new Map();
      for (const s of std) {
        const pid = s.product_id;
        if (!pid) continue;
        if (!latestByProduct.has(pid)) {
          latestByProduct.set(pid, s);
        }
      }
      const joined = items.map((it) => {
        const sp = latestByProduct.get(it.id);
        const price =
          sp && sp.selling_price !== undefined && sp.selling_price !== null
            ? Number(sp.selling_price)
            : it.selling_price;
        return { ...it, selling_price: price };
      });
      setItemsCatalog(joined);
    } catch (error) {
      console.error("Error fetching items:", error);
      setItemsCatalog([]);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await api.get("/finance/currencies");
      const arr = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      setCurrencies(arr);
      const baseCur = arr.find((c) => Number(c.is_base) === 1 || c.is_base === true);
      setForm((p) => ({
        ...p,
        currency_id: p.currency_id || baseCur?.id || "",
        exchange_rate: p.exchange_rate || 1,
      }));
    } catch (error) {
      console.error("Error fetching currencies:", error);
    }
  };

  useEffect(() => {
    const uniqueTaxIds = Array.from(
      new Set(
        lines.map((i) => i.tax_type).filter((id) => id && id !== "undefined"),
      ),
    );
    const missing = uniqueTaxIds.filter((id) => !(id in taxComponentsByCode));
    if (missing.length) {
      ensureTaxComponentsLoaded();
    }
  }, [lines, taxComponentsByCode]);

  const fetchTaxCodes = async () => {
    try {
      const response = await api.get("/finance/tax-codes?form=PROJECT_INVOICE");
      const fetchedTaxes = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      const mappedTaxes = fetchedTaxes.map((t) => ({
        value: t.id,
        label: t.name,
        rate: Number(t.rate_percent),
      }));
      setTaxes(mappedTaxes);
      if (mappedTaxes.length > 0 && !newItem.tax_type) {
        const defaultTaxId = mappedTaxes[0].value;
        setNewItem((prev) => ({ ...prev, tax_type: defaultTaxId }));
        fetchTaxComponentsForCode(defaultTaxId);
      }
    } catch (error) {
      console.error("Error fetching tax codes:", error);
    }
  };

  const fetchCustomerPrices = async () => {
    if (!form.customer_id) return;
    try {
      const response = await api.get(
        `/sales/prices/customer?customer_id=${form.customer_id}`,
      );
      setCustomerPrices(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (error) {
      console.error("Error fetching customer prices:", error);
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
  const calcTaxComponentsTotals = () => {
    const sub = lines.reduce((s, i) => s + (i.net || 0), 0);
    const compTotals = {};
    lines.forEach((i) => {
      const taxKey = String(i.tax_type || form.tax_type || "");
      const comps = taxComponentsByCode[taxKey] || [];
      if (comps.length > 0) {
        comps.forEach((c) => {
          const rate = Number(c.rate_percent) || 0;
          const amt = Math.round((((i.net || 0) * rate) / 100) * 100) / 100;
          const name = c.component_name;
          if (!compTotals[name])
            compTotals[name] = { amount: 0, rate, sort_order: c.sort_order || 0 };
          compTotals[name].amount += amt;
        });
      } else {
        const name =
          i.tax_component_name ||
          form.tax_component_name ||
          (i.tax_rate ? `Tax (${i.tax_rate}%)` : "");
        const rate = Number(
          i.tax_rate !== undefined && i.tax_rate !== null
            ? i.tax_rate
            : (form.tax_rate || 0),
        );
        const amt = Number(i.taxAmt || 0);
        if (name && amt > 0) {
          if (!compTotals[name])
            compTotals[name] = { amount: 0, rate, sort_order: 0 };
          compTotals[name].amount += amt;
        }
      }
    });
    const components = Object.keys(compTotals)
      .map((name) => ({
        name,
        amount: Math.round(compTotals[name].amount * 100) / 100,
        rate: compTotals[name].rate,
        sort_order: compTotals[name].sort_order,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
    const taxTotal = Math.round(components.reduce((s, c) => s + c.amount, 0) * 100) / 100;
    const total = sub + taxTotal;
    return { sub, components, taxTotal, total };
  };
  const calcNewItemTaxBreakdown = () => {
    const qty = parseFloat(newItem.qty) || 0;
    const price = parseFloat(newItem.unit_price) || 0;
    const disc = parseFloat(newItem.discount_percent) || 0;
    const sub = qty * price;
    const discAmt = (sub * disc) / 100;
    const net = sub - discAmt;
    const comps = taxComponentsByCode[String(newItem.tax_type)] || [];
    const components = comps
      .map((c) => {
        const rate = Number(c.rate_percent) || 0;
        return {
          name: c.component_name,
          rate,
          sort_order: Number(c.sort_order || 0),
          amount: (net * rate) / 100,
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order);
    return {
      net,
      components,
      taxTotal: components.reduce((s, c) => s + c.amount, 0),
    };
  };
  const calcAggregates = () => {
    const isInclusive = String(form.tax_mode || "").toUpperCase() === "INCLUSIVE";
    const grossSub = lines.reduce((s, i) => s + (i.sub || 0), 0);
    const discountTotal = lines.reduce((s, i) => s + (i.discAmt || 0), 0);
    const netSub = lines.reduce((s, i) => s + (i.net || 0), 0);
    const lineTax = lines.reduce((s, i) => s + Number(i.taxAmt || 0), 0);
    const tc = calcTaxComponentsTotals();
    const taxTotal = tc.taxTotal > 0 ? tc.taxTotal : Math.round(lineTax * 100) / 100;
    const grand = isInclusive
      ? lines.reduce((s, i) => s + (i.total || 0), 0)
      : Math.round((netSub + taxTotal) * 100) / 100;
    // Subtotal: when inclusive, user wants: "recalculate the subtotal, this amount should be less tax"
    const subtotal = isInclusive ? netSub : grossSub;
    const components = [...tc.components];
    if (components.length === 0 && taxTotal > 0) {
      const name = form.tax_component_name || (form.tax_rate ? `Tax (${form.tax_rate}%)` : "Tax");
      const rate = form.tax_rate || 0;
      components.push({ name, amount: taxTotal, rate, sort_order: 1 });
    }
    return {
      grossSub,
      subtotal,
      discountTotal,
      netSub,
      components,
      taxTotal,
      grand,
    };
  };
  useEffect(() => {
    const key = String(newItem.tax_type || "");
    if (!key || key in taxComponentsByCode) return;
    fetchTaxComponentsForCode(key);
  }, [newItem.tax_type, taxComponentsByCode]);

  function resolveUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (
      u.startsWith("http://") ||
      u.startsWith("https://") ||
      u.startsWith("data:")
    )
      return u;
    const origin =
      typeof window !== "undefined" && window.location
        ? window.location.origin
        : "";
    if (!origin) return u;
    if (u.startsWith("/")) return origin + u;
    return origin + "/" + u;
  }

  // Removed old document template fetch/print/download; using CSS-based on-page layout instead

  const fetchCompanyInfo = async () => {
    try {
      const usernameFromAuth = user?.username || "";
      setPreparedBy(usernameFromAuth);
      const meResp = await api.get("/admin/me");
      const companyId = meResp.data?.scope?.companyId;
      const usernameFromApi = meResp.data?.user?.username || "";
      if (!usernameFromAuth && usernameFromApi) {
        setPreparedBy(usernameFromApi);
      }
      if (companyId) {
        const cResp = await api.get(`/admin/companies/${companyId}`);
        const item = cResp.data?.item || {};
        setCompanyInfo((prev) => ({
          ...prev,
          name: item.name || prev.name || "",
          address: item.address || prev.address || "",
          phone: item.telephone || prev.phone || "",
          email: item.email || prev.email || "",
          city: item.city || prev.city || "",
          state: item.state || prev.state || "",
          postalCode: item.postal_code || prev.postalCode || "",
          country: item.country || prev.country || "",
          website: item.website || prev.website || "",
          taxId: item.tax_id || prev.taxId || "",
          registrationNo: item.registration_no || prev.registrationNo || "",
          logoUrl:
            item.has_logo === 1 || item.has_logo === true
              ? `/api/admin/companies/${companyId}/logo`
              : defaultLogo,
        }));
      } else {
        setCompanyInfo((prev) => ({
          ...prev,
          logoUrl: prev.logoUrl || defaultLogo,
        }));
      }
    } catch {
      if (user?.username) {
        setPreparedBy(user.username);
      }
      setCompanyInfo((prev) => ({
        ...prev,
        logoUrl: prev.logoUrl || defaultLogo,
      }));
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await api.get("/projects/projects");
      setProjects(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch {
      setProjects([]);
    }
  };

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects/project-invoices/${id}`);
      const data = response.data?.item;
      if (data) {
        setForm({
          invoice_no: data.invoice_no || "",
          invoice_date: toYmd(data.invoice_date || new Date()),
          customer_id: data.customer_id || "",
          status: data.status || "POSTED",
          due_date: toYmd(data.due_date || ""),
          address: "",
          address2: "",
          city: "",
          state: "",
          country: "",
          phone: "",
          remarks: data.remarks || "",
          payment_type: data.payment_type || "CASH",
          currency_id: data.currency_id || "",
          exchange_rate: Number(data.exchange_rate || 1),
          project_id: data.project_id || "",
        });
        const cust = customers.find(
          (c) => String(c.id) === String(data.customer_id),
        );
        if (cust) {
          setForm((p) => ({
            ...p,
            address: cust.address || "",
            address2: cust.address2 || "",
            city: cust.city || "",
            state: cust.state || "",
            country: cust.country || "",
            phone: cust.phone || cust.customer_phone || "",
          }));
        }
      }
      if (response.data?.details) {
        const mapped = response.data.details.map((d, i) => {
          const qty = Math.round(Number(d.quantity || 0) * 100) / 100;
          const unit = Math.round(Number(d.unit_price || 0) * 100) / 100;
          const disc = Math.round(Number(d.discount_percent || 0) * 100) / 100;
          const taxId = d.tax_id || "";
          const taxRate =
            d.tax_rate !== undefined && d.tax_rate !== null
              ? Number(d.tax_rate)
              : taxes.find((t) => String(t.value) === String(taxId))?.rate || 0;
          const fallback = calcItemTotals({
            qty,
            unit_price: unit,
            discount_percent: disc,
            tax_type: taxId,
          });
          const netAmt =
            d.net_amount !== undefined && d.net_amount !== null
              ? Math.round(Number(d.net_amount) * 100) / 100
              : fallback.net;
          const taxAmt =
            d.tax_amount !== undefined && d.tax_amount !== null
              ? Math.round(Number(d.tax_amount) * 100) / 100
              : fallback.taxAmt;
          const totalAmt =
            d.total_amount !== undefined && d.total_amount !== null
              ? Math.round(Number(d.total_amount) * 100) / 100
              : fallback.total;
          return {
            line_id: i + 1,
            item_id: d.item_id,
            item_name: d.item_name || "",
            remarks: d.remarks || "",
            qty,
            unit_price: unit,
            discount_percent: disc,
            tax_rate: taxRate,
            tax_type: taxId,
            sub: Math.round(Number(qty * unit) * 100) / 100,
            discAmt: Math.round(Number((qty * unit * disc) / 100) * 100) / 100,
            net: netAmt,
            taxAmt,
            total: totalAmt,
          };
        });
        setLines(mapped);
      }
    } catch (error) {
      setError(error?.response?.data?.message || "Error fetching invoice");
      console.error("Error fetching invoice:", error);
    } finally {
      setLoading(false);
    }
  };

  async function repriceLinesByCustomer(newCustomerId) {
    try {
      const cId =
        newCustomerId !== undefined ? newCustomerId : form.customer_id;
      const currentLines = [...lines];
      const results = await Promise.all(
        currentLines.map(async (l) => {
          if (!l.item_id) {
            const next = { ...l };
            return { ...next, ...calcItemTotals(next) };
          }
          try {
            const res = await api.post("/sales/prices/best-price", {
              product_id: l.item_id,
              customer_id: cId,
              quantity: Number(l.qty || 1),
              date: form.invoice_date,
              only_standard: true,
            });
            if (res.data && res.data.price !== undefined) {
              const next = {
                ...l,
                unit_price: Math.round(Number(res.data.price || 0) * 100) / 100,
              };
              return { ...next, ...calcItemTotals(next) };
            }
          } catch {}
          const next = { ...l };
          return { ...next, ...calcItemTotals(next) };
        }),
      );
      setLines(results);
    } catch {}
  }

  function update(name, value) {
    let next = { ...form, [name]: value };
    if (name === "customer_id") {
      const cust = customers.find((c) => c.id == value);
      next.address = cust?.address || "";
      next.address2 = cust?.address2 || "";
      next.city = cust?.city || "";
      next.state = cust?.state || "";
      next.country = cust?.country || "";
      next.phone = cust?.phone || cust?.customer_phone || "";
      fetchCustomerPrices();
      repriceLinesByCustomer(value);
    }
    setForm(next);
  }

  function handleNewItemChange(e) {
    const { name, value } = e.target;
    if (name === "item_id") {
      const prod = itemsCatalog.find((p) => p.id === parseInt(value));
      const currentTaxMode = form.tax_mode || newItem.tax_mode || "EXCLUSIVE";
      const isInclusive = currentTaxMode === "INCLUSIVE";
      setNewItem((prev) => ({
        ...prev,
        item_id: value,
        item_name: prod?.item_name || "",
        unit_price: "",
        qty: 1,
        uom: String(prod?.uom || "") || defaultUomCode,
        tax_mode: currentTaxMode,
        tax_type: form.tax_type || prev.tax_type || "",
        tax_rate: form.tax_rate !== undefined ? form.tax_rate : (prev.tax_rate || 0),
        tax_component_name: form.tax_component_name || prev.tax_component_name || "",
      }));
      if (value) {
        {
          const payload = {
            product_id: value,
            quantity: 1,
            date: form.invoice_date,
            only_standard: true,
            ...(form.customer_id ? { customer_id: form.customer_id } : {}),
          };
          api
            .post("/sales/prices/best-price", payload)
            .then((res) => {
              if (res.data && res.data.price !== undefined) {
                setNewItem((prev) => ({
                  ...prev,
                  unit_price:
                    Math.round(Number(res.data.price || 0) * 100) / 100,
                }));
              }
            })
            .catch((err) => console.error("Error fetching price:", err));
        }
        const currentMode = form.tax_mode || "EXCLUSIVE";
        if (form.tax_rate !== undefined || form.tax_type) {
          setNewItem((prev) => ({
            ...prev,
            tax_type: form.tax_type || prev.tax_type,
            tax_rate: form.tax_rate !== undefined ? form.tax_rate : prev.tax_rate,
            tax_component_name: form.tax_component_name || prev.tax_component_name,
            tax_mode: currentMode,
          }));
        } else {
          api
            .get(`/finance/item-tax/${value}`)
            .then((resp) => {
              const tax = resp.data?.tax;
              if (tax) {
                const resolvedTaxType =
                  tax.id ||
                  taxes.find((t) => t.code === tax.tax_code)?.value ||
                  null;
                const resolvedTaxRate = resolvedTaxType
                  ? taxes.find((t) => String(t.value) === String(resolvedTaxType))
                      ?.rate
                  : null;
                setNewItem((prev) => ({
                  ...prev,
                  tax_type: resolvedTaxType ?? prev.tax_type,
                  tax_rate:
                    resolvedTaxRate !== null && resolvedTaxRate !== undefined
                      ? resolvedTaxRate
                      : tax.tax_rate,
                }));
                if (resolvedTaxType) {
                  fetchTaxComponentsForCode(resolvedTaxType);
                }
              } else {
                setNewItem((prev) => ({
                  ...prev,
                  tax_rate: prev.tax_rate !== undefined ? prev.tax_rate : 0,
                }));
              }
            })
            .catch(() => {
              setNewItem((prev) => ({
                ...prev,
                tax_rate: prev.tax_rate !== undefined ? prev.tax_rate : 0,
              }));
            });
        }
      }
    } else {
      if (
        name === "unit_price" ||
        name === "qty" ||
        name === "discount_percent"
      ) {
        const num = value === "" ? "" : Math.round(Number(value) * 100) / 100;
        setNewItem((prev) => ({ ...prev, [name]: num }));
      } else {
        if (name === "tax_type" && value) {
          fetchTaxComponentsForCode(value);
        }
        setNewItem((prev) => ({ ...prev, [name]: value }));
      }
    }
  }

  const handleInvoiceTaxModeChange = (newMode) => {
    update("tax_mode", newMode);
    setForm((prev) => ({
      ...prev,
      tax_mode: newMode,
    }));
    setNewItem((prev) => ({
      ...prev,
      tax_mode: newMode,
    }));
    setLines((prev) =>
      prev.map((ln) => {
        const updated = {
          ...ln,
          tax_mode: newMode,
        };
        return { ...updated, ...calcItemTotals(updated) };
      })
    );
  };

  function addLine() {
    if ((!newItem.item_id && !newItem.item_name) || !newItem.qty || !newItem.unit_price) {
      toast.error("Please fill in the item name, quantity, and unit price");
      return;
    }
    const currentTaxMode = form.tax_mode || newItem.tax_mode || "EXCLUSIVE";
    const lineItemData = {
      ...newItem,
      tax_mode: currentTaxMode,
      tax_type: newItem.tax_type || form.tax_type || "",
      tax_rate: newItem.tax_rate !== undefined && newItem.tax_rate !== null ? newItem.tax_rate : (form.tax_rate || 0),
      tax_component_name: newItem.tax_component_name || form.tax_component_name || "",
    };
    const calculations = calcItemTotals(lineItemData);
    setLines((prev) => [
      ...prev,
      {
        ...lineItemData,
        line_id: Date.now(),
        ...calculations,
        uom: newItem.uom || defaultUomCode,
      },
    ]);
    setNewItem({
      item_id: "",
      item_name: "",
      qty: "",
      unit_price: "",
      discount_percent: "",
      tax_type: form.tax_type || newItem.tax_type || "",
      tax_rate: form.tax_rate !== undefined ? form.tax_rate : (newItem.tax_rate || 0),
      tax_mode: currentTaxMode,
      tax_component_name: form.tax_component_name || newItem.tax_component_name || "",
      remarks: "",
      uom: defaultUomCode,
    });
    setItemQuery("");
  }

  async function fetchAndApplyBestPrice(idx, itemId) {
    try {
      const payload = {
        product_id: itemId,
        quantity: 1,
        date: form.invoice_date,
        only_standard: true,
        ...(form.customer_id ? { customer_id: form.customer_id } : {}),
      };
      const res = await api.post("/sales/prices/best-price", payload);
      if (res.data && res.data.price !== undefined) {
        setLines((prev) =>
          prev.map((l, i) => {
            if (i !== idx) return l;
            const next = {
              ...l,
              unit_price: Math.round(Number(res.data.price || 0) * 100) / 100,
            };
            return { ...next, ...calcItemTotals(next) };
          }),
        );
      }
    } catch (e) {
      console.error("Error fetching price:", e);
    }
  }

  function updateLine(idx, patch) {
    if (patch.item_id) {
      fetchAndApplyBestPrice(idx, patch.item_id);
    }
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        let next = { ...l, ...patch };
        if ("unit_price" in patch) {
          next.unit_price =
            patch.unit_price === "" || patch.unit_price == null
              ? ""
              : Math.round(Number(patch.unit_price) * 100) / 100;
        }
        if ("qty" in patch) {
          next.qty =
            patch.qty === "" || patch.qty == null
              ? ""
              : Math.round(Number(patch.qty) * 100) / 100;
        }
        if ("discount_percent" in patch) {
          next.discount_percent =
            patch.discount_percent === "" || patch.discount_percent == null
              ? ""
              : Math.round(Number(patch.discount_percent) * 100) / 100;
        }
        if (patch.item_id) {
          const prod = itemsCatalog.find((p) => p.id == patch.item_id);
          next.item_name = prod?.item_name || next.item_name || "";
          next.uom = next.uom || String(prod?.uom || "") || defaultUomCode;
          fetchItemTax(patch.item_id, (tax) => {
            next.tax_rate = tax?.tax_rate;
            next.tax_type = tax?.tax_code || next.tax_type || "VAT15";
          });
        }
        if (patch.tax_type) {
          const tr =
            taxes.find((t) => String(t.value) === String(patch.tax_type))
              ?.rate || 0;
          next.tax_rate = tr;
        }
        next = { ...next, ...calcItemTotals(next) };
        return next;
      }),
    );
  }

  function getItemCode(itemId) {
    const p = itemsCatalog.find((x) => String(x.id) === String(itemId));
    return p ? p.item_code || "" : "";
  }

  function removeLine(lineId) {
    setLines((p) => p.filter((x) => x.line_id !== lineId));
  }

  function calcItemTotals(itm) {
    const qty = Math.round(Number(itm.qty || 0) * 100) / 100;
    const price = Math.round(Number(itm.unit_price || 0) * 100) / 100;
    const disc = Math.round(Number(itm.discount_percent || 0) * 100) / 100;
    const sub = Math.round(qty * price * 100) / 100;
    const discAmt = Math.round(((sub * disc) / 100) * 100) / 100;
    const discountedGross = Math.round((sub - discAmt) * 100) / 100;

    const effectiveMode = String(itm.tax_mode || form.tax_mode || "").toUpperCase();
    const isInclusive = effectiveMode === "INCLUSIVE";

    const fallbackRate = form.tax_rate !== undefined && form.tax_rate !== null ? Number(form.tax_rate) : 0;
    const taxRate =
      itm.tax_rate !== undefined && itm.tax_rate !== null && Number(itm.tax_rate) > 0
        ? Number(itm.tax_rate)
        : (fallbackRate > 0
            ? fallbackRate
            : (taxes.find((t) => String(t.value) === String(itm.tax_type || form.tax_type))?.rate ?? fallbackRate));

    let net = discountedGross;
    let taxAmt = 0;
    let total = discountedGross;

    if (isInclusive && taxRate > 0) {
      total = discountedGross;
      net = Math.round((total / (1 + taxRate / 100)) * 100) / 100;
      taxAmt = Math.round((total - net) * 100) / 100;
    } else if (!isInclusive && taxRate > 0) {
      net = discountedGross;
      taxAmt = Math.round((discountedGross * (taxRate / 100)) * 100) / 100;
      total = Math.round((discountedGross + taxAmt) * 100) / 100;
    } else {
      net = discountedGross;
      taxAmt = 0;
      total = discountedGross;
    }

    return { sub, discAmt, net, taxAmt, total, line_total: total, tax_mode: isInclusive ? "INCLUSIVE" : "EXCLUSIVE", isInclusive };
  }

  function calcGrandTotal() {
    const isInclusive = String(form.tax_mode || "").toUpperCase() === "INCLUSIVE";
    const sub = lines.reduce((s, l) => s + Number(l.net || 0), 0);
    const tax = lines.reduce((s, l) => s + Number(l.taxAmt || 0), 0);
    const total = isInclusive
      ? lines.reduce((s, l) => s + Number(l.total || 0), 0)
      : sub + tax;
    return { sub, tax, total };
  }
  function toYmd(value) {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().split("T")[0];
    const s = String(value);
    if (s.includes("T")) return s.split("T")[0];
    return s.slice(0, 10);
  }

  function calcDueDate(dateStr, days) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    d.setDate(d.getDate() + Number(days || 0));
    return d.toISOString().split("T")[0];
  }

  function fetchItemTax(itemId, cb) {
    api
      .get(`/finance/item-tax/${itemId}`)
      .then((resp) => cb(resp.data?.tax || null))
      .catch(() => cb(null));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const pendingLineReady =
        newItem.item_id && newItem.qty && newItem.unit_price;
      const workingLines = pendingLineReady
        ? [
            ...lines,
            {
              ...newItem,
              ...calcItemTotals(newItem),
            },
          ]
        : [...lines];
      if (!workingLines.length) {
        toast.error("Add at least one item before saving the invoice");
        setLoading(false);
        return;
      }
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      let invoiceNo = form.invoice_no;
      if (!invoiceNo) {
        const randomSuffix = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0");
        invoiceNo = `INV-${dateStr}-${randomSuffix}`;
      }
      const sums = (() => {
        const sub = workingLines.reduce((s, l) => s + Number(l.net || 0), 0);
        const tax = workingLines.reduce((s, l) => s + Number(l.taxAmt || 0), 0);
        return { sub, tax, total: sub + tax };
      })();
      const payload = {
        ...form,
        invoice_date: toYmd(form.invoice_date),
        invoice_no: invoiceNo,
        customer_id: Number(form.customer_id),
        due_date: toYmd(form.due_date) || null,
        payment_type: form.payment_type,
        currency_id: form.currency_id ? Number(form.currency_id) : null,
        exchange_rate: Number(form.exchange_rate || 1),
        total_amount: Math.round(Number(sums.total || 0) * 100) / 100,
        tax_amount: Math.round(Number(sums.tax || 0) * 100) / 100,
        net_amount: Math.round(Number(sums.sub || 0) * 100) / 100,
        items: workingLines.map((l) => {
          const rawTax = l.tax_type;
          const numericTax = Number(rawTax);
          let effTaxId =
            Number.isFinite(numericTax) && numericTax > 0 ? numericTax : null;
          if (!effTaxId && rawTax) {
            const byLabel = taxes.find(
              (t) =>
                String(t.label || "").toUpperCase() ===
                String(rawTax || "").toUpperCase(),
            );
            if (byLabel) effTaxId = Number(byLabel.value);
          }
          const effRate =
            taxes.find((t) => Number(t.value) === Number(effTaxId))?.rate || 0;
          return {
            item_id: l.item_id,
            quantity: Math.round(Number(l.qty || 0) * 100) / 100,
            unit_price: Math.round(Number(l.unit_price || 0) * 100) / 100,
            discount_percent:
              Math.round(Number(l.discount_percent || 0) * 100) / 100,
            tax_id: effTaxId || null,
            tax_rate: effRate,
            tax_amount: Math.round(Number(l.taxAmt || 0) * 100) / 100,
            total_amount: Math.round(Number(l.total || 0) * 100) / 100,
            net_amount: Math.round(Number(l.net || 0) * 100) / 100,
            uom: String(l.uom || defaultUomCode),
          };
        }),
      };
      let savedId = 0;
      if (isEdit) {
        const resp = await api.put(`/projects/project-invoices/${id}`, payload);
        savedId = Number(resp?.data?.id || id);
      } else {
        const resp = await api.post("/projects/project-invoices", payload);
        savedId = Number(resp?.data?.id || 0);
      }

      toast.success(`Invoice ${invoiceNo} saved successfully`);
      // Auto delivery is always performed after invoice is created/saved
      try {
        const deliverableItems = workingLines.filter((l) => l.item_id);
        if (deliverableItems.length > 0) {
          const nextNoResp = await api.get("/sales/deliveries/next-no");
          const nextNo = nextNoResp?.data?.nextNo || "";
          const dPayload = {
            delivery_no: nextNo || `DN${String(Date.now()).slice(-6)}`,
            delivery_date: toYmd(form.invoice_date),
            customer_id: Number(form.customer_id),
            invoice_id: savedId || null,
            remarks: `Auto delivery for invoice ${invoiceNo}`,
            status: "DELIVERED",
            items: deliverableItems.map((l) => ({
              item_id: Number(l.item_id),
              quantity: Math.round(Number(l.qty || 0) * 100) / 100,
              unit_price: Math.round(Number(l.unit_price || 0) * 100) / 100,
              uom: String(l.uom || defaultUomCode),
            })),
          };
          const dResp = await api.post("/sales/deliveries", dPayload);
          const createdNo = nextNo || dPayload.delivery_no;
          if (dResp?.data?.item?.delivery_no) {
            toast.success(
              `Delivery ${dResp.data.item.delivery_no} created automatically`,
            );
          } else {
            toast.success(`Delivery ${createdNo} created automatically`);
          }
        }
      } catch (delErr) {
        const dmsg =
          delErr?.response?.data?.message || "Failed to create delivery note";
        toast.error(dmsg);
      }
      navigate("/project-management/project-invoices");
    } catch (err) {
      const msg = err?.response?.data?.message || "Error saving invoice";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { margin: 1cm; }
          body { 
            background: white; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          #root > div > header,
          #root > div > div > aside { display: none !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          #root > div > div > main { padding: 0 !important; }
          input, select, textarea {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            resize: none;
            overflow: visible;
          }
        }
        .quotation-table { 
          border-collapse: collapse; 
          table-layout: fixed; 
          width: 100%; 
          max-width: 100%; 
          border-spacing: 0; 
          box-sizing: border-box;
          margin: 0 auto;
        }
        .quotation-table th, .quotation-table td { 
          border: 1px solid #000000; 
          box-sizing: border-box; 
          word-break: break-word; 
          overflow-wrap: anywhere; 
          white-space: normal; 
          padding: 6px 4px;
          font-size: 10px;
        }
        .quotation-table thead th { 
          background: #0E3646; 
          color: #ffffff; 
        }
        .quotation-table thead th:last-child,
        .quotation-table tbody td:last-child {
          background: #ffffff;
          color: #000000;
        }
        .quotation-table thead th:last-child {
          border-top: 1px solid #ffffff;
          border-right: 1px solid #ffffff;
          border-bottom: 1px solid #ffffff;
          border-left: 1px solid #000000;
        }
        .quotation-table tbody td:last-child {
          border-top: 1px solid #ffffff;
          border-right: 1px solid #ffffff;
          border-bottom: 1px solid #ffffff;
          border-left: 1px solid #000000;
        }
        @media print {
          .quotation-table {
            width: 100%;
            max-width: 100%;
          }
          .quotation-table thead th:last-child,
          .quotation-table tbody td:last-child {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .quotation-table thead th:last-child {
            border-top: 1px solid #ffffff !important;
            border-right: 1px solid #ffffff !important;
            border-bottom: 1px solid #ffffff !important;
            border-left: 1px solid #000000 !important;
          }
          .quotation-table tbody td:last-child {
            border-top: 1px solid #ffffff !important;
            border-right: 1px solid #ffffff !important;
            border-bottom: 1px solid #ffffff !important;
            border-left: 1px solid #000000 !important;
          }
        }
      `}</style>
      {/* Canonical ERP Flex Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <FileText size={26} className="text-brand-900 dark:text-brand-400" />
              {isEdit ? "Edit Invoice" : "New Invoice"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Create and manage project invoices
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn btn-secondary text-sm"
          >
            Cancel
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
            >
              <Save size={16} /> {loading ? "Saving..." : "Save Invoice"}
            </button>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="print:hidden">
        <div className="card">
          <div className="card-body space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="hidden">
                <label className="label">Invoice #</label>
                <input
                  className="input bg-white dark:bg-slate-900"
                  value={form.invoice_no}
                  onChange={(e) => update("invoice_no", e.target.value)}
                  placeholder="Auto-generated"
                  readOnly={!isEdit && !form.invoice_no}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="label">Project Invoice Date *</label>
                <input
                  className="input w-56"
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => update("invoice_date", e.target.value)}
                  required
                  disabled={
                    readOnly ||
                    (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))
                  }
                />
              </div>
              <div className="relative">
                <label className="label">Client *</label>
                <input
                  type="text"
                  className="input w-56"
                  placeholder="Search client..."
                  required={!form.customer_id}
                  disabled={readOnly}
                  value={
                    customers.find(
                      (c) => String(c.id) === String(form.customer_id),
                    )?.customer_name || customerSearch
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerSearch(val);
                    // Reset customer details to allow search again
                    update("customer_id", "");
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
                              update("customer_id", String(c.id));
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
                    ) : q.length >= 2 ? (
                      <div className="absolute z-30 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg mt-1">
                        <div className="p-3 text-sm text-slate-600 dark:text-slate-400 text-center">
                          Client not found.{" "}
                          <button
                            type="button"
                            className="text-brand-700 dark:text-brand-400 font-medium underline ml-1"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setShowCustomerModal(true)}
                          >
                            Add client
                          </button>
                        </div>
                      </div>
                    ) : null;
                  })()}
              </div>
              <div>
                <label className="label">Project</label>
                <select
                  className="input w-56"
                  value={form.project_id}
                  onChange={(e) => update("project_id", e.target.value)}
                  disabled={readOnly}
                >
                  <option value="">-- Select Project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_name || p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Payment Type</label>
                <div className="flex items-center gap-6">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="payment_type"
                      value="CASH"
                      checked={(form.payment_type || "CASH") === "CASH"}
                      onChange={(e) => update("payment_type", e.target.value)}
                      disabled={readOnly}
                    />
                    <span>Cash</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="payment_type"
                      value="CREDIT"
                      checked={form.payment_type === "CREDIT"}
                      onChange={(e) => update("payment_type", e.target.value)}
                      disabled={readOnly}
                    />
                    <span>Credit</span>
                  </label>
                </div>
              </div>
              {form.payment_type === "CREDIT" && (
                <div>
                  <label className="label">Payment Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={form.payment_date || ""}
                    onChange={(e) => update("payment_date", e.target.value)}
                    required={form.payment_type === "CREDIT"}
                    disabled={readOnly}
                  />
                </div>
              )}
              <div>
                <label className="label">Currency</label>
                <select
                  className="input w-56"
                  value={form.currency_id}
                  onChange={(e) => update("currency_id", e.target.value)}
                  disabled={readOnly}
                >
                  <option value="">Select Currency</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
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
                  step="0.000001"
                  className="input w-56"
                  value={form.exchange_rate}
                  onChange={(e) => update("exchange_rate", e.target.value)}
                  readOnly
                />
              </div>
              <div className="hidden">
                <label className="label">City</label>
                <input
                  className="input bg-white dark:bg-slate-900 w-56"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="Auto"
                  readOnly
                />
              </div>
              <div className="hidden">
                <label className="label">State</label>
                <input
                  className="input bg-white dark:bg-slate-900 w-56"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                  placeholder="Auto"
                  readOnly
                />
              </div>
              <div className="hidden">
                <label className="label">Country</label>
                <input
                  className="input bg-white dark:bg-slate-900 w-56"
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                  placeholder="Auto"
                  readOnly
                />
              </div>
              <div className="hidden">
                <label className="label">Phone</label>
                <input
                  className="input bg-white dark:bg-slate-900 w-56"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="Auto"
                  readOnly
                />
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="flex justify-between items-center mb-3">
                <div className="font-semibold">Invoice Items</div>
                <TaxModeRadioSelector
                  taxMode={form.tax_mode || "EXCLUSIVE"}
                  onModeChange={handleInvoiceTaxModeChange}
                  onOpenTaxModal={() => {
                    setEditingLineTaxIdx(null);
                    setTaxModalOpen(true);
                  }}
                  selectedTaxLabel={newItem.tax_component_name}
                  openAlert={showTaxModeAlert}
                  onCloseAlert={() => setShowTaxModeAlert(false)}
                  anchorSelector="#invoice-item-search"
                />
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-lg mb-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Item *
                    </label>
                    <div className="relative">
                      <input
                        id="invoice-item-search"
                        name="item_id"
                        autoComplete="off"
                        className="input text-sm w-full"
                        placeholder="Scan barcode or type item name"
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
                          const val = e.target.value;
                          setItemQuery(val);
                          if (newItem.item_id) {
                            setNewItem((prev) => ({
                              ...prev,
                              item_id: "",
                              item_name: val,
                              unit_price: "",
                            }));
                          } else {
                            setNewItem((prev) => ({
                              ...prev,
                              item_name: val,
                            }));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const query = itemQuery.trim();
                            const results = query
                              ? filterByPrefix(itemsCatalog, {
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
                            handleNewItemChange({
                              target: { name: "item_id", value: results[0].id },
                            });
                            setItemQuery(results[0].item_name);
                          }
                        }}
                      />
                      {(() => {
                        const query = itemQuery.trim();
                        const results = query
                          ? filterByPrefix(itemsCatalog, {
                              query,
                              searchFields: [
                                "item_code",
                                "item_name",
                                "barcode",
                              ],
                            })
                          : [];
                        return results.length && !newItem.item_id
                          ? (() => {
                              const el = document.getElementById(
                                "invoice-item-search",
                              );
                              const r = el
                                ? el.getBoundingClientRect()
                                : { bottom: 0, left: 0, width: 0 };
                              return (
                                <div
                                  className="bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-auto"
                                  style={{
                                    position: "fixed",
                                    top: `${r.bottom + 4}px`,
                                    left: `${r.left}px`,
                                    width: `${r.width}px`,
                                    zIndex: 9999,
                                  }}
                                >
                                  {results.map((o) => (
                                    <button
                                      type="button"
                                      key={o.id}
                                      className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-xs"
                                      onClick={() => {
                                        handleNewItemChange({
                                          target: {
                                            name: "item_id",
                                            value: o.id,
                                          },
                                        });
                                        setNewItem((prev) => ({
                                          ...prev,
                                          item_name: o.item_name,
                                        }));
                                        setItemQuery(o.item_name);
                                      }}
                                    >
                                      {o.item_code} - {o.item_name}
                                    </button>
                                  ))}
                                </div>
                              );
                            })()
                          : null;
                      })()}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      UOM *
                    </label>
                    <select
                      name="uom"
                      value={newItem.uom || defaultUomCode}
                      onChange={handleNewItemChange}
                      className="input text-sm w-full"
                    >
                      {(Array.isArray(uoms) ? uoms : []).map((u) => (
                        <option key={u.id} value={u.uom_code}>
                          {u.uom_name
                            ? `${u.uom_name} (${u.uom_code})`
                            : u.uom_code}
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const it = itemsCatalog.find(
                        (p) => String(p.id) === String(newItem.item_id),
                      );
                      const defaultUom =
                        (it?.uom && String(it.uom)) ||
                        (newItem.uom && String(newItem.uom)) ||
                        (defaultUomCode ? String(defaultUomCode) : "");
                      const currentUom = String(newItem.uom || "");
                      const showBtn =
                        currentUom &&
                        defaultUom &&
                        currentUom !== defaultUom &&
                        String(newItem.item_id || "");
                      return showBtn ? (
                        <button
                          type="button"
                          className="mt-2 px-2 py-1 text-xs border border-brand text-brand rounded hover:bg-brand hover:text-white transition-colors"
                          onClick={() =>
                            setConvModal({
                              open: true,
                              itemId: newItem.item_id,
                              defaultUom: defaultUom,
                              currentUom: currentUom,
                            })
                          }
                        >
                          {`number of ${currentUom}`}
                        </button>
                      ) : null;
                    })()}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Qty *
                    </label>
                    <input
                      type="number"
                      name="qty"
                      value={newItem.qty === "" ? "" : newItem.qty}
                      onChange={handleNewItemChange}
                      className="input text-sm w-full"
                      min="1"
                      step="1"
                    />
                  </div>
                  <div className="flex items-end">
                    {(() => {
                      const it = itemsCatalog.find(
                        (p) => String(p.id) === String(newItem.item_id),
                      );
                      const defaultUom =
                        (it?.uom && String(it.uom)) ||
                        (newItem.uom && String(newItem.uom)) ||
                        (defaultUomCode ? String(defaultUomCode) : "");
                      const nonDefaults = (
                        Array.isArray(unitConversions) ? unitConversions : []
                      )
                        .filter(
                          (c) =>
                            Number(c.is_active) &&
                            String(c.to_uom) === defaultUom &&
                            Number(c.item_id) === Number(newItem.item_id),
                        )
                        .map((c) => String(c.from_uom));
                      const preferredUom = nonDefaults[0] || "";
                      const hasConv =
                        nonDefaults.length > 0 &&
                        preferredUom &&
                        preferredUom !== defaultUom;
                      return hasConv ? (
                        <button
                          type="button"
                          className="ml-2 px-2 py-1 text-xs border border-brand text-brand rounded hover:bg-brand hover:text-white transition-colors"
                          onClick={() =>
                            setConvModal({
                              open: true,
                              itemId: newItem.item_id,
                              defaultUom: defaultUom,
                              currentUom: preferredUom,
                              rowId: null,
                            })
                          }
                        >
                          {`number of ${preferredUom}`}
                        </button>
                      ) : null;
                    })()}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Price *
                    </label>
                    <input
                      type="number"
                      name="unit_price"
                      value={
                        newItem.unit_price === "" ? "" : newItem.unit_price
                      }
                      onChange={handleNewItemChange}
                      className="input text-sm w-full"
                      step="1"
                    />
                  </div>
                  <div
                    className={!canEditDiscount() ? "disabled-light-blue" : ""}
                  >
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Disc %
                    </label>
                    <input
                      type="number"
                      name="discount_percent"
                      value={
                        newItem.discount_percent === ""
                          ? ""
                          : newItem.discount_percent
                      }
                      onChange={handleNewItemChange}
                      className="input text-sm w-full"
                      min="0"
                      max="100"
                      step="1"
                      disabled={!canEditDiscount()}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tax Code
                    </label>
                    <div
                      data-tax-anchor="true"
                      onClick={() => {
                        setEditingLineTaxIdx(null);
                        setTaxModalOpen(true);
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-slate-900 cursor-pointer flex items-center justify-between hover:border-brand-500 transition-colors shadow-sm min-h-[38px]"
                      title="Click to select tax code"
                    >
                      <span className="truncate text-xs text-slate-800 dark:text-slate-200">
                        {newItem.tax_component_name || (newItem.tax_type ? taxes.find(t => String(t.value) === String(newItem.tax_type))?.label : '') || (newItem.tax_rate ? `Tax (${newItem.tax_rate}%)` : 'Select Tax')}
                      </span>
                      {newItem.tax_rate !== undefined && Number(newItem.tax_rate) > 0 && (
                        <span className="text-[11px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded shrink-0 ml-1">
                          {Number(newItem.tax_rate)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={addLine}
                      className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold"
                    >
                      <Plus className="w-4 h-4" /> Add Item
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <colgroup>
                    <col style={{ width: "24rem" }} />
                    <col style={{ width: "10rem" }} />
                    <col style={{ width: "9rem" }} />
                    <col style={{ width: "8rem" }} />
                    <col style={{ width: "10rem" }} />
                    <col style={{ width: "8rem" }} />
                    <col style={{ width: "10rem" }} />
                    <col style={{ width: "8rem" }} />
                    <col style={{ width: "12rem" }} />
                    <col style={{ width: "8rem" }} />
                    <col style={{ width: "9rem" }} />
                    <col style={{ width: "16rem" }} />
                    <col style={{ width: "8rem" }} />
                  </colgroup>
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        UOM
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Convert
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Disc%
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Tax Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Net
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Tax
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Remarks
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {lines.length === 0 ? (
                      <tr>
                        <td
                          colSpan="13"
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          No items added yet
                        </td>
                      </tr>
                    ) : (
                      lines.map((i, idx) => (
                        <tr key={i.line_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900">
                            {canEdit ? (
                              <select
                                className="input w-full min-w-[20rem]"
                                value={i.item_id}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    item_id: Number(e.target.value),
                                  })
                                }
                              >
                                <option value="">Select Item</option>
                                {itemsCatalog.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.item_code} - {p.item_name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              i.item_name
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {getItemCode(i.item_id)}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {canEdit ? (
                              <select
                                className="input w-full min-w-[7rem]"
                                value={i.uom || defaultUomCode}
                                onChange={(e) =>
                                  updateLine(idx, { uom: e.target.value })
                                }
                              >
                                {(Array.isArray(uoms) ? uoms : []).map((u) => (
                                  <option key={u.id} value={u.uom_code}>
                                    {u.uom_name
                                      ? `${u.uom_name} (${u.uom_code})`
                                      : u.uom_code}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              i.uom || defaultUomCode
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {canEdit ? (
                              <input
                                className="input w-full min-w-[7rem]"
                                type="number"
                                min="0"
                                step="0.01"
                                value={i.qty === "" ? "" : i.qty}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    qty:
                                      e.target.value === ""
                                        ? ""
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            ) : (
                              i.qty
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {(() => {
                              const it = itemsCatalog.find(
                                (p) => String(p.id) === String(i.item_id),
                              );
                              const defaultUom =
                                (it?.uom && String(it.uom)) ||
                                (i.uom && String(i.uom)) ||
                                (defaultUomCode ? String(defaultUomCode) : "");
                              const nonDefaults = (
                                Array.isArray(unitConversions)
                                  ? unitConversions
                                  : []
                              )
                                .filter(
                                  (c) =>
                                    Number(c.is_active) &&
                                    String(c.to_uom) === defaultUom &&
                                    Number(c.item_id) === Number(i.item_id),
                                )
                                .map((c) => String(c.from_uom));
                              const preferredUom = nonDefaults[0] || "";
                              const hasConv =
                                nonDefaults.length > 0 &&
                                preferredUom &&
                                preferredUom !== defaultUom;
                              return hasConv ? (
                                <button
                                  type="button"
                                  className="px-2 py-1 text-xs border border-brand text-brand rounded hover:bg-brand hover:text-white transition-colors"
                                  onClick={() =>
                                    setConvModal({
                                      open: true,
                                      itemId: i.item_id,
                                      defaultUom: defaultUom,
                                      currentUom: preferredUom,
                                      rowId: i.line_id,
                                    })
                                  }
                                >
                                  {`number of ${preferredUom}`}
                                </button>
                              ) : null;
                            })()}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {canEdit ? (
                              <input
                                className="input w-full min-w-[8rem]"
                                type="number"
                                step="0.01"
                                value={i.unit_price === "" ? "" : i.unit_price}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    unit_price:
                                      e.target.value === ""
                                        ? ""
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            ) : (
                              parseFloat(i.unit_price).toFixed(2)
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {canEdit ? (
                              <div
                                className={
                                  !canEditDiscount()
                                    ? "disabled-light-blue"
                                    : ""
                                }
                              >
                                <input
                                  className="input w-full min-w-[7rem]"
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  value={
                                    i.discount_percent === ""
                                      ? ""
                                      : i.discount_percent || 0
                                  }
                                  onChange={(e) =>
                                    updateLine(idx, {
                                      discount_percent:
                                        e.target.value === ""
                                          ? ""
                                          : Number(e.target.value),
                                    })
                                  }
                                  disabled={!canEditDiscount()}
                                />
                              </div>
                            ) : (
                              parseFloat(i.discount_percent || 0).toFixed(2)
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {canEdit ? (
                              <div
                                onClick={() => {
                                  setEditingLineTaxIdx(idx);
                                  setTaxModalOpen(true);
                                }}
                                className="cursor-pointer border border-dashed border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs hover:border-brand-500 bg-slate-50 dark:bg-slate-800/50 transition-colors"
                                title="Click to change tax component or mode"
                              >
                                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {i.tax_component_name || form.tax_component_name || (taxes.find((t) => String(t.value) === String(i.tax_type || form.tax_type))?.label) || (i.tax_rate ? `Tax (${i.tax_rate}%)` : '-')}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center justify-between gap-1 mt-0.5">
                                  <span className={`px-1 rounded text-[9px] font-bold ${(i.tax_mode || form.tax_mode) === 'INCLUSIVE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {(i.tax_mode || form.tax_mode) === 'INCLUSIVE' ? 'Incl' : 'Excl'}
                                  </span>
                                  <span className="font-bold text-brand-600">
                                    {Number(i.tax_rate !== undefined && i.tax_rate !== null ? i.tax_rate : (form.tax_rate !== undefined && form.tax_rate !== null ? form.tax_rate : (taxes.find((t) => String(t.value) === String(i.tax_type || form.tax_type))?.rate || 0)))}%
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span>
                                {i.tax_component_name || (taxes.find((t) => String(t.value) === String(i.tax_type))?.label) || ''}
                                {i.tax_mode ? ` [${i.tax_mode === 'INCLUSIVE' ? 'Incl' : 'Excl'}]` : ''}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {Number(i.net || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {Number(i.taxAmt || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {Number(i.total || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {canEdit ? (
                              <input
                                className="input w-full min-w-[12rem]"
                                type="text"
                                value={i.remarks || ""}
                                onChange={(e) =>
                                  updateLine(idx, { remarks: e.target.value })
                                }
                              />
                            ) : (
                              i.remarks || ""
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => removeLine(i.line_id)}
                                className="text-red-600 hover:text-red-900 transition-colors"
                              >
                                Discard
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td
                        colSpan="6"
                        className="px-4 py-3 text-right font-semibold text-gray-700"
                      >
                        Totals:
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {calcGrandTotal().sub.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {calcGrandTotal().tax.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {calcGrandTotal().total.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div />
                <div className="space-y-2">
                  <div className="flex justify-between font-medium">
                    <span>Subtotal:</span>
                    <span>{calcAggregates().subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Total Discount:</span>
                    <span>{calcAggregates().discountTotal.toFixed(2)}</span>
                  </div>
                  {calcAggregates().components.length > 0 &&
                    calcAggregates().components.map((c) => (
                      <div
                        key={c.name}
                        className="flex justify-between text-sm text-gray-700"
                      >
                        <span>{c.name}</span>
                        <span>{c.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between font-medium">
                    <span>Total Tax:</span>
                    <span>{calcAggregates().taxTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-900">
                    <span>Grand Total:</span>
                    <span>{calcAggregates().grand.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full">
              <label className="label">Remarks / Notes</label>
              <textarea
                className="input w-full"
                rows={3}
                value={form.remarks}
                onChange={(e) => update("remarks", e.target.value)}
                placeholder="Additional notes or terms..."
                disabled={readOnly}
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="btn btn-secondary text-sm"
              >
                Cancel
              </button>
              {!readOnly && (
                <button
                  type="submit"
                  className="btn btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
                  disabled={loading}
                >
                  <Save size={16} /> {loading ? "Saving..." : "Save Invoice"}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
      <div className="hidden print:block p-8 max-w-[19cm] mx-auto">
        <div className="grid grid-cols-3 gap-4 items-start mb-4">
          <div className="flex items-center gap-3">
            <img
              src={companyInfo.logoUrl || defaultLogo}
              alt={companyInfo.name || "Company"}
              className="w-16 h-16 object-contain border border-gray-300"
            />
            <div className="text-sm">
              <div className="font-semibold text-base">
                {companyInfo.name || "Company"}
              </div>
              {companyInfo.address && <div>{companyInfo.address}</div>}
              {(companyInfo.city ||
                companyInfo.state ||
                companyInfo.country) && (
                <div>
                  {[companyInfo.city, companyInfo.state, companyInfo.country]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
              <div className="flex gap-3">
                {companyInfo.phone && <span>{companyInfo.phone}</span>}
                {companyInfo.email && <span>{companyInfo.email}</span>}
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold">Project Invoice</div>
          </div>
          <div className="text-right text-sm">
            <div>DATE: {form.invoice_date || ""}</div>
            <div>Invoice #: {form.invoice_no || ""}</div>
            <div>
              Client:{" "}
              {customers.find((c) => String(c.id) === String(form.customer_id))
                ?.customer_name || ""}
            </div>
            {form.address && (
              <div>
                Address: {form.address} {form.address2}
              </div>
            )}
            <div>City: {form.city || ""}</div>
            <div>State: {form.state || ""}</div>
            <div>Country: {form.country || ""}</div>
            <div>Phone: {form.phone || ""}</div>
            <div>Payment Type: {form.payment_type || ""}</div>
            <div>
              Currency:{" "}
              {currencies.find((c) => String(c.id) === String(form.currency_id))
                ?.code || ""}
            </div>
            <div>
              Project:{" "}
              {projects.find((p) => String(p.id) === String(form.project_id))
                ?.project_name || ""}
            </div>
            <div>Prepared by: {preparedBy || ""}</div>
          </div>
        </div>
        <div className="mb-2 mx-auto">
          <table className="quotation-table text-sm">
            <colgroup>
              <col style={{ width: "35%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "25%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-right">Quantity</th>
                <th className="px-2 py-2 text-right">Unit Price</th>
                <th className="px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((i) => (
                <tr key={i.line_id}>
                  <td className="px-2 py-2">{i.item_name}</td>
                  <td className="px-2 py-2 text-right">
                    {Number(i.qty || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {Number(i.unit_price || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {Number(i.total || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div></div>
          <div>
            <div>
              <div className="grid grid-cols-2">
                <div className="px-2 py-1 font-medium">Subtotal</div>
                <div className="px-2 py-1 text-right">
                  {calcAggregates().subtotal.toFixed(2)}
                </div>
                <div className="px-2 py-1 font-medium">Discount</div>
                <div className="px-2 py-1 text-right">
                  {calcAggregates().discountTotal.toFixed(2)}
                </div>
                <div className="px-2 py-1 font-medium">Net Sub Total</div>
                <div className="px-2 py-1 text-right font-semibold">
                  {calcAggregates().netSub.toFixed(2)}
                </div>
                {calcAggregates().components.map((c) => (
                  <React.Fragment key={c.name}>
                    <div className="px-2 py-1">{c.name}</div>
                    <div className="px-2 py-1 text-right">
                      {c.amount.toFixed(2)}
                    </div>
                  </React.Fragment>
                ))}
                <div className="px-2 py-1 font-semibold">Total</div>
                <div className="px-2 py-1 text-right font-semibold">
                  {calcAggregates().grand.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center text-sm">
          THANK YOU FOR YOUR BUSINESS!
        </div>
      </div>
      <div
        ref={pdfRef}
        className="hidden p-8 bg-white"
        style={{ width: "794px", maxWidth: "794px" }}
      >
        <div className="grid grid-cols-3 gap-4 items-start mb-4">
          <div className="flex items-center gap-3">
            <img
              src={companyInfo.logoUrl || defaultLogo}
              alt={companyInfo.name || "Company"}
              className="w-16 h-16 object-contain border border-gray-300"
            />
            <div className="text-sm">
              <div className="font-semibold text-base">
                {companyInfo.name || "Company"}
              </div>
              {companyInfo.address && <div>{companyInfo.address}</div>}
              {(companyInfo.city ||
                companyInfo.state ||
                companyInfo.country) && (
                <div>
                  {[companyInfo.city, companyInfo.state, companyInfo.country]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
              <div className="flex gap-3 w-56">
                {companyInfo.phone && <span>{companyInfo.phone}</span>}
                {companyInfo.email && <span>{companyInfo.email}</span>}
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold">Project Invoice</div>
          </div>
          <div className="text-right text-sm">
            <div>DATE: {form.invoice_date || ""}</div>
            <div>Invoice #: {form.invoice_no || ""}</div>
            <div>
              Client:{" "}
              {customers.find((c) => String(c.id) === String(form.customer_id))
                ?.customer_name || ""}
            </div>
            <div>City: {form.city || ""}</div>
            <div>State: {form.state || ""}</div>
            <div>Country: {form.country || ""}</div>
            <div>Phone: {form.phone || ""}</div>
            <div>Payment Type: {form.payment_type || ""}</div>
            <div>
              Currency:{" "}
              {currencies.find((c) => String(c.id) === String(form.currency_id))
                ?.code || ""}
            </div>
            <div>
              Project:{" "}
              {projects.find((p) => String(p.id) === String(form.project_id))
                ?.project_name || ""}
            </div>
            <div>Prepared by: {preparedBy || ""}</div>
          </div>
        </div>
        <div
          className="mb-2"
          style={{ width: "100%", overflow: "visible", margin: "0 auto" }}
        >
          <table
            className="quotation-table text-sm"
            style={{ width: "100%", tableLayout: "fixed" }}
          >
            <colgroup>
              <col style={{ width: "35%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "25%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-right">Quantity</th>
                <th className="px-2 py-2 text-right">Unit Price</th>
                <th className="px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((i) => (
                <tr key={i.line_id}>
                  <td className="px-2 py-2">{i.item_name}</td>
                  <td className="px-2 py-2 text-right">
                    {Number(i.qty || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {Number(i.unit_price || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {Number(i.total || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div></div>
          <div>
            <div>
              <div className="grid grid-cols-2">
                <div className="px-2 py-1 font-medium">Subtotal</div>
                <div className="px-2 py-1 text-right">
                  {calcAggregates().subtotal.toFixed(2)}
                </div>
                <div className="px-2 py-1 font-medium">Discount</div>
                <div className="px-2 py-1 text-right">
                  {calcAggregates().discountTotal.toFixed(2)}
                </div>
                <div className="px-2 py-1 font-medium">Net Sub Total</div>
                <div className="px-2 py-1 text-right font-semibold">
                  {calcAggregates().netSub.toFixed(2)}
                </div>
                {calcAggregates().components.map((c) => (
                  <div key={c.name} className="contents">
                    <div className="px-2 py-1">{c.name}</div>
                    <div className="px-2 py-1 text-right">
                      {c.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
                <div className="px-2 py-1 font-semibold">Total</div>
                <div className="px-2 py-1 text-right font-semibold">
                  {calcAggregates().grand.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <UnitConversionModal
        open={convModal.open}
        itemId={convModal.itemId}
        defaultUom={convModal.defaultUom}
        currentUom={convModal.currentUom}
        onClose={() =>
          setConvModal({
            open: false,
            itemId: null,
            defaultUom: "",
            currentUom: "",
            rowId: null,
          })
        }
        onApply={(payload) => {
          const { converted_qty } = payload || {};
          const qty = Number(converted_qty || 0);
          if (convModal.rowId != null) {
            setLines((prev) =>
              prev.map((it) =>
                String(it.line_id) === String(convModal.rowId)
                  ? { ...it, qty: qty, uom: convModal.defaultUom || it.uom }
                  : it,
              ),
            );
          } else {
            setNewItem((prev) => ({
              ...prev,
              qty: qty,
              uom: convModal.defaultUom || prev.uom,
            }));
          }
        }}
      />
      {showCustomerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowCustomerModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 max-w-sm mx-4 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Client not found
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Client cannot be found in the system. Would you like to add a
              new client?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCustomerModal(false)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setShowCustomerModal(false);
                  if (!canAccessPath("/sales/customers/new")) {
                    setShowPermModal(true);
                  } else {
                    navigate("/sales/customers/new");
                  }
                }}
              >
                Add Client
              </button>
            </div>
          </div>
        </div>
      )}
      {showPermModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowPermModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 max-w-sm mx-4 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Access Denied
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              You do not have permission to access this page.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPermModal(false)}
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Tax Pricing & Components Modal */}
      <TaxPricingModal
        open={taxModalOpen}
        form="PROJECT_INVOICE"
        pageId={26}
        onClose={() => {
          setTaxModalOpen(false);
          setEditingLineTaxIdx(null);
        }}
        taxMode={
          editingLineTaxIdx !== null && lines[editingLineTaxIdx]
            ? (lines[editingLineTaxIdx].tax_mode || form.tax_mode || 'EXCLUSIVE')
            : (form.tax_mode || 'EXCLUSIVE')
        }
        price={
          editingLineTaxIdx !== null && lines[editingLineTaxIdx]
            ? (lines[editingLineTaxIdx].unit_price || 0)
            : (newItem.unit_price || 0)
        }
        selectedComponent={
          editingLineTaxIdx !== null && lines[editingLineTaxIdx]
            ? {
                name: lines[editingLineTaxIdx].tax_component_name,
                rate: lines[editingLineTaxIdx].tax_rate,
                id: lines[editingLineTaxIdx].tax_type,
              }
            : {
                name: newItem.tax_component_name,
                rate: newItem.tax_rate,
                id: newItem.tax_type,
              }
        }
        onSelectComponent={(comp) => {
          const compLabel = `${comp.name}${comp.rate !== undefined ? ` (${comp.rate}%)` : ''}`;
          const taxTypeId = comp.taxCodeId || comp.originalId || comp.id;
          const taxRate = comp.rate;
          const currentMode = form.tax_mode || 'EXCLUSIVE';

          setForm((prev) => ({
            ...prev,
            tax_mode: currentMode,
            tax_type: taxTypeId || prev.tax_type,
            tax_rate: taxRate,
            tax_component_name: compLabel,
          }));

          setNewItem((prev) => ({
            ...prev,
            tax_type: taxTypeId || prev.tax_type,
            tax_rate: taxRate,
            tax_component_name: compLabel,
            tax_mode: currentMode,
          }));

          setLines((prev) =>
            prev.map((ln) => {
              const updated = {
                ...ln,
                tax_type: taxTypeId || ln.tax_type,
                tax_rate: taxRate,
                tax_component_name: compLabel,
                tax_mode: currentMode,
              };
              return { ...updated, ...calcItemTotals(updated) };
            })
          );

          if (taxTypeId) {
            fetchTaxComponentsForCode(taxTypeId);
          }
          setTaxModalOpen(false);
          setEditingLineTaxIdx(null);
        }}
      />
    </div>
  );
}
