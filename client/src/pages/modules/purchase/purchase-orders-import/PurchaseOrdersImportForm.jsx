/**
 * @fileoverview PurchaseOrdersImportForm component.
 * Provides functionality for PurchaseOrdersImportForm.
 */

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "api/client";
import { useUoms } from "@/hooks/useUoms";
import UnitConversionModal from "@/components/UnitConversionModal";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import defaultLogo from "../../../../assets/resources/OMNISUITE_LOGO_FILL.png";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {} from "lucide-react";
import useSocket from "../../../../hooks/useSocket.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { useExchangeRate } from "../../../../hooks/useExchangeRate";
import { filterByPrefix } from "@/utils/searchUtils.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PurchaseOrdersImportForm() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();
  const { canEditDiscount, hasExceptional } = usePermission();
  const { getExchangeRate } = useExchangeRate();

  const isNew = !id || id === "new";
  const isEdit =
    Boolean(id) &&
    id !== "new" &&
    (location.pathname.includes("/edit") ||
      (() => {
        try {
          const params = new URLSearchParams(location.search || "");
          const mode = String(params.get("mode") || "").toLowerCase();
          const editFlag = String(params.get("edit") || "").toLowerCase();
          return mode === "edit" || editFlag === "1" || editFlag === "true";
        } catch {
          return false;
        }
      })());
  const isView = Boolean(id) && id !== "new" && !isEdit;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState("");
  const [forwardComments, setForwardComments] = useState("");
  const [candidateWorkflow, setCandidateWorkflow] = useState(null);
  const [firstApprover, setFirstApprover] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [submittingForward, setSubmittingForward] = useState(false);
  const [workflowsCache, setWorkflowsCache] = useState(null);
  const [targetApproverId, setTargetApproverId] = useState(null);

  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [allQuotations, setAllQuotations] = useState([]);
  const [approvedItemRequisitions, setApprovedItemRequisitions] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [standardPrices, setStandardPrices] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});
  const [projects, setProjects] = useState([]);
  const [unitConversions, setUnitConversions] = useState([]);
  const pdfRef = useRef(null);
  const dataLoadedRef = useRef(false); // tracks whether existing PO data has been fetched
  const [convModal, setConvModal] = useState({
    open: false,
    itemId: null,
    defaultUom: "",
    currentUom: "",
    rowIdx: null,
  });
  const [itemQueries, setItemQueries] = useState({});

  // Form State
  const [formData, setFormData] = useState({
    po_no: "",
    po_date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    quotation_id: "",
    po_type: "IMPORT",
    status: "DRAFT",
    warehouse_id: "",
    currency: "USD",
    exchange_rate: 1,
    delivery_date: "",
    payment_type: "CASH",
    payment_terms: 30,
    delivery_terms: "",
    remarks: "",
    // Import specific fields
    port_loading: "",
    port_discharge: "",
    incoterms: "",
    hs_code: "",
    shipping_date: "",
    insurance_required: false,
    // Summary fields
    project_id: "",
    freight_amount: 0,
    other_charges: 0,
    discount_amount: 0,
    tax_amount: 0,
    terms_conditions: `1. All goods must meet specified quality standards
2. Delivery to be made as per schedule
3. Payment terms: Net 30 days from delivery
4. Supplier responsible for any defects within warranty period
5. Late delivery penalties may apply as per agreement
6. All disputes subject to arbitration in Accra, Ghana`,
  });

  const [items, setItems] = useState([
    {
      item_id: "",
      qty: 0,
      uom: "",
      unit_price: 0,
      discount_percent: 0,
      tax_code_id: "",
      tax_percent: 0,
      line_total: 0,
    },
  ]);
  const [companyInfo, setCompanyInfo] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    country: "",
    logoUrl: "",
  });

  const { uoms } = useUoms();

  const defaultUomCode = useMemo(() => {
    const list = Array.isArray(uoms) ? uoms : [];
    const pcs =
      list.find((u) => String(u.uom_code || "").toUpperCase() === "PCS") ||
      list[0];
    if (pcs && pcs.uom_code) return pcs.uom_code;
    return "PCS";
  }, [uoms]);

  useEffect(() => {
    let mounted = true;
    async function loadLookups() {
      try {
        const [supRes, whRes, itemsRes, quotRes, convRes, reqRes, projRes] =
          await Promise.allSettled([
            api.get("/purchase/suppliers"),
            api.get("/inventory/warehouses"),
            api.get("/inventory/items"),
            api.get("/purchase/quotations"),
            api.get("/inventory/unit-conversions"),
            api.get("/purchase/general-requisitions", {
              params: {
                status: "APPROVED",
                requisition_type: "ITEM",
                only_unlinked: 1,
              },
            }),
            api.get("/projects/projects"),
          ]);

        if (!mounted) return;

        if (supRes.status === "fulfilled") {
          const rawSuppliers = Array.isArray(supRes.value.data?.items)
            ? supRes.value.data.items
            : [];
          setSuppliers(rawSuppliers);
        }

        if (whRes.status === "fulfilled") {
          setWarehouses(
            Array.isArray(whRes.value.data?.items)
              ? whRes.value.data.items
              : [],
          );
        }

        if (itemsRes.status === "fulfilled") {
          setAvailableItems(
            Array.isArray(itemsRes.value.data?.items)
              ? itemsRes.value.data.items
              : [],
          );
        }

        if (quotRes.status === "fulfilled") {
          const rawQuotations = Array.isArray(quotRes.value.data?.items)
            ? quotRes.value.data.items
            : [];
          setAllQuotations(rawQuotations);
          const sid = String(formData.supplier_id || "");
          const filtered =
            sid && sid.length
              ? rawQuotations.filter(
                  (q) => String(q.supplier_id) === String(sid),
                )
              : [];
          setQuotations(filtered);
        }
        if (convRes.status === "fulfilled") {
          setUnitConversions(
            Array.isArray(convRes.value.data?.items)
              ? convRes.value.data.items
              : [],
          );
        }
        if (reqRes.status === "fulfilled") {
          setApprovedItemRequisitions(
            Array.isArray(reqRes.value.data?.items)
              ? reqRes.value.data.items
              : [],
          );
        }
        if (projRes.status === "fulfilled") {
          setProjects(
            Array.isArray(projRes.value.data?.items)
              ? projRes.value.data.items
              : [],
          );
        }
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load lookups");
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
      .get("/purchase/orders/next-no", {
        params: { po_type: formData.po_type || "IMPORT" },
      })
      .then((res) => {
        if (!mounted) return;
        if (res.data?.nextNo) {
          setFormData((prev) => ({
            ...prev,
            po_no: prev.po_no || res.data.nextNo,
          }));
        }
      })
      .catch((err) =>
        console.error("Failed to load next purchase order number", err),
      );

    return () => {
      mounted = false;
    };
  }, [isEdit, formData.po_type]);

  useEffect(() => {
    fetchCompanyInfo();
  }, []);

  async function fetchCompanyInfo() {
    try {
      const meResp = await api.get("/admin/me");
      const companyId = meResp.data?.scope?.companyId;
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
          country: item.country || prev.country || "",
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
      setCompanyInfo((prev) => ({
        ...prev,
        logoUrl: prev.logoUrl || defaultLogo,
      }));
    }
  }

  useEffect(() => {
    let mounted = true;
    async function fetchCurrencies() {
      try {
        const response = await api.get("/finance/currencies");
        if (!mounted) return;
        const arr = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        setCurrencies(arr);
      } catch (error) {
        console.error("Error fetching currencies:", error);
      }
    }
    fetchCurrencies();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadStandardPrices() {
      try {
        const res = await api.get("/sales/prices/standard");
        if (!mounted) return;
        const arr = Array.isArray(res.data?.items) ? res.data.items : [];
        setStandardPrices(arr);
      } catch (e) {
        console.error("Error fetching standard prices:", e);
      }
    }
    loadStandardPrices();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadTaxCodes() {
      try {
        const response = await api.get(
          "/finance/tax-codes?form=PURCHASE_BILL_IMPORT",
        );
        if (!mounted) return;
        const fetchedTaxes = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        setTaxes(fetchedTaxes);
        // Auto-apply first tax to any new (empty) item rows
        if (fetchedTaxes.length > 0) {
          const defaultId = String(fetchedTaxes[0].id);
          const defaultRate = Number(fetchedTaxes[0].rate_percent) || 0;
          setItems((prev) =>
            prev.map((it) =>
              !it.item_id && !it.tax_code_id
                ? { ...it, tax_code_id: defaultId, tax_percent: defaultRate }
                : it,
            ),
          );
        }
      } catch (error) {
        console.error("Error fetching tax codes:", error);
      }
    }
    loadTaxCodes();
    return () => {
      mounted = false;
    };
  }, []);

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
      new Set(
        items
          .map((it) => it.tax_code_id)
          .filter((id) => id && id !== "undefined"),
      ),
    );
    const missing = uniqueTaxIds.filter((id) => !(id in taxComponentsByCode));
    if (missing.length) {
      Promise.all(missing.map((id) => fetchTaxComponentsForCode(id)));
    }
  }, [items, taxComponentsByCode]);

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
    const baseCode = String(
      base.code || base.currency_code || "",
    ).toUpperCase();
    if (code === baseCode) {
      setFormData((prev) => ({ ...prev, exchange_rate: 1 }));
      return;
    }

    const rate = await getExchangeRate(code, baseCode);
    if (rate) {
      setFormData((p) => ({ ...p, exchange_rate: rate }));
    }
  };

  useEffect(() => {
    // Only auto-fetch on currencies load (for new POs) or date change.
    // Currency changes are handled explicitly in handleInputChange to avoid
    // overwriting the saved exchange_rate when PO data is loaded programmatically.
    if (!isNew && !dataLoadedRef.current) return;
    fetchExchangeRateForCode(formData.currency);
  }, [currencies, formData.po_date]); // NOTE: formData.currency intentionally omitted

  // Load PO Data
  useEffect(() => {
    if (!id || id === "new") return;

    let mounted = true;

    setLoading(true);
    setError("");

    api
      .get(`/purchase/orders/${id}`)
      .then((res) => {
        if (!mounted) return;
        const po = res.data?.item;
        const details = Array.isArray(res.data?.item?.details)
          ? res.data.item.details
          : [];

        if (!po) return;

        setFormData({
          po_no: po.po_no || "",
          po_date: po.po_date ? String(po.po_date).split("T")[0] : new Date().toISOString().split("T")[0],
          supplier_id: po.supplier_id ? String(po.supplier_id) : "",
          po_type: po.po_type || "IMPORT",
          status: po.status || "DRAFT",
          warehouse_id: po.warehouse_id ? String(po.warehouse_id) : "",
          currency: po.currency || "GHS",
          exchange_rate: Number(po.exchange_rate) || 1,
          delivery_date: po.delivery_date ? String(po.delivery_date).split("T")[0] : "",
          payment_type: po.payment_type || "CASH",
          payment_terms: po.payment_terms || 30,
          delivery_terms: po.delivery_terms || "",
          remarks: po.remarks || "",
          port_loading: po.port_loading || "",
          port_discharge: po.port_discharge || "",
          incoterms: po.incoterms || "",
          hs_code: po.hs_code || "",
          shipping_date: po.shipping_date || "",
          insurance_required: Boolean(po.insurance_required),
          freight_amount: Number(po.freight_amount) || 0,
          other_charges: Number(po.other_charges) || 0,
          discount_amount: Number(po.discount_amount) || 0,
          tax_amount: Number(po.tax_amount) || 0,
          terms_conditions: po.terms_conditions || formData.terms_conditions,
          project_id: po.project_id || "",
        });
        // Mark data as loaded so the exchange rate effect no longer skips
        dataLoadedRef.current = true;

        const newQueries = {};
        const parsedDetails = details.length
          ? details.filter((d) => d).map((d, i) => {
              newQueries[i] = d.item_name || d.name || d.item_code || "";
              return {
                item_id: d.item_id ? String(d.item_id) : "",
                qty: Number(d.qty) || 0,
                uom: d.uom || "",
                unit_price: Number(d.unit_price) || 0,
                discount_percent: Number(d.discount_percent) || 0,
                tax_code_id: d.tax_code_id ? String(d.tax_code_id) : "",
                tax_percent: Number(d.tax_percent) || 0,
                line_total: Number(d.line_total) || 0,
              };
            })
          : [
              {
                item_id: "",
                qty: 0,
                uom: "",
                unit_price: 0,
                discount_percent: 0,
                tax_percent: 0,
                line_total: 0,
              },
            ];
        setItemQueries(newQueries);
        setItems(parsedDetails);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load purchase order");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  // Calculations
  const summary = useMemo(() => {
    let subTotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const compTotals = {};

    (items || []).forEach((item) => {
      if (!item) return;
      const qty = Number(item.qty) || 0;
      const price = Number(item.unit_price) || 0;
      const discPct = Number(item.discount_percent) || 0;
      const taxCodeId = String(item.tax_code_id || "");

      const base = qty * price;
      const disc = base * (discPct / 100);
      const taxable = base - disc;

      let itemTax = 0;
      const comps =
        (taxComponentsByCode && taxComponentsByCode[taxCodeId]) || [];
      if (comps.length > 0) {
        comps.forEach((c) => {
          if (!c) return;
          const rate = Number(c.rate_percent) || 0;
          const amt = (taxable * rate) / 100;
          const name = c.component_name || "Tax";
          if (!compTotals[name]) {
            compTotals[name] = {
              amount: 0,
              rate,
              sort_order: c.sort_order || 0,
            };
          }
          compTotals[name].amount += amt;
          itemTax += amt;
        });
      } else {
        const taxPct = Number(item.tax_percent) || 0;
        itemTax = taxable * (taxPct / 100);
        if (itemTax > 0) {
          const name = "Tax";
          if (!compTotals[name]) {
            compTotals[name] = { amount: 0, rate: taxPct, sort_order: 99 };
          }
          compTotals[name].amount += itemTax;
        }
      }

      subTotal += base;
      totalDiscount += disc;
      totalTax += itemTax;
    });

    const freight = Number(formData.freight_amount) || 0;
    const other = Number(formData.other_charges) || 0;

    const components = Object.keys(compTotals)
      .map((name) => ({
        name,
        amount: compTotals[name].amount,
        rate: compTotals[name].rate,
        sort_order: compTotals[name].sort_order,
      }))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const grandTotal = subTotal - totalDiscount + totalTax + freight + other;

    return {
      subTotal,
      totalDiscount,
      totalTax,
      freight,
      other,
      grandTotal,
      components,
    };
  }, [
    items,
    formData.freight_amount,
    formData.other_charges,
    taxComponentsByCode,
  ]);

  const baseCurrencyCode = useMemo(() => {
    const arr = Array.isArray(currencies) ? currencies : [];
    const base =
      arr.find(
        (c) =>
          String(c.is_base) === "1" || c.is_base === 1 || c.is_base === true,
      ) ||
      arr.find((c) => String(c.code || "").toUpperCase() === "GHS") ||
      null;
    return String(base?.code || base?.currency_code || "GHS").toUpperCase();
  }, [currencies]);
  const totalInBaseCurrency = useMemo(
    () =>
      Number(summary.grandTotal || 0) *
      (Number(formData.exchange_rate || 1) || 1),
    [summary.grandTotal, formData.exchange_rate],
  );
  const totalInCurrentCurrency = useMemo(
    () =>
      Number(summary.subTotal || 0) +
      Number(summary.totalDiscount || 0) +
      Number(summary.totalTax || 0) +
      Number(summary.freight || 0) +
      Number(summary.other || 0),
    [summary],
  );
  const showBaseTotalRow = useMemo(
    () =>
      Math.abs(
        Number(totalInBaseCurrency || 0) - Number(totalInCurrentCurrency || 0),
      ) > 0.000001,
    [totalInBaseCurrency, totalInCurrentCurrency],
  );

  // Handlers
  const handleInputChange = async (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "payment_type") {
      setFormData((prev) => {
        const isCash = String(value).toUpperCase() === "CASH";
        const nextTerms = isCash
          ? 0
          : (Number(prev.payment_terms || 0) || 0) === 0
            ? 30
            : prev.payment_terms;
        return { ...prev, payment_type: value, payment_terms: nextTerms };
      });
      return;
    }
    // Handle currency change explicitly so we control when the rate is fetched
    if (name === "currency") {
      const newCode = String(value || "").toUpperCase();
      setFormData((prev) => ({ ...prev, currency: newCode }));
      await fetchExchangeRateForCode(newCode);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (name === "supplier_id") {
      const supId = String(value || "");
      if (supId) {
        const filtered = (
          Array.isArray(allQuotations) ? allQuotations : []
        ).filter((q) => String(q.supplier_id) === supId);
        setQuotations(filtered);
        setFormData((prev) => {
          const stillValid = filtered.some(
            (q) => String(q.id) === String(prev.quotation_id || ""),
          );
          return {
            ...prev,
            quotation_id: stillValid ? prev.quotation_id : "",
          };
        });
        try {
          const sup = suppliers.find((s) => String(s.id) === supId);
          const supCurrencyId = String(sup?.currency_id || "").trim();
          const supCurrencyCodeRaw =
            sup?.currency_code || sup?.currency || sup?.currencyCode || "";
          const byId = supCurrencyId
            ? (Array.isArray(currencies) ? currencies : []).find(
                (c) => String(c.id) === supCurrencyId,
              )
            : null;
          const supplierCurrencyCode = String(
            byId?.code || byId?.currency_code || supCurrencyCodeRaw || "",
          )
            .trim()
            .toUpperCase();
          if (supplierCurrencyCode) {
            setFormData((prev) => ({
              ...prev,
              currency: supplierCurrencyCode,
            }));
            await fetchExchangeRateForCode(supplierCurrencyCode);
            return;
          }
          const acctSearch =
            (sup && sup.supplier_code && String(sup.supplier_code).trim()) ||
            (sup ? `SU-${String(Number(sup.id || 0)).padStart(6, "0")}` : "");
          if (acctSearch) {
            const res = await api.get("/finance/accounts", {
              params: { search: acctSearch },
            });
            const items = Array.isArray(res.data?.items) ? res.data.items : [];
            const exact =
              items.find((a) => String(a.code) === acctSearch) ||
              items[0] ||
              null;
            const accCode =
              (exact &&
                (exact.currency_code ||
                  exact.currency ||
                  exact.currencyCode)) ||
              null;
            if (accCode) {
              const code = String(accCode).toUpperCase();
              setFormData((prev) => ({
                ...prev,
                currency: code,
              }));
              await fetchExchangeRateForCode(code);
            }
          }
        } catch {}
      } else {
        setQuotations(Array.isArray(allQuotations) ? allQuotations : []);
      }
    }

    if (name === "quotation_id" && value) {
      try {
        const res = await api.get(`/purchase/quotations/${value}`);
        const q = res.data?.item;
        if (q) {
          const arr = Array.isArray(currencies) ? currencies : [];
          const currencyMatch = arr.find(
            (c) => String(c.id) === String(q.currency_id || ""),
          );
          const currencyCode =
            String(
              currencyMatch?.code ||
                currencyMatch?.currency_code ||
                q.currency_code ||
                q.currency ||
                "",
            ).toUpperCase() || formData.currency;
          const allowedCurrencyCodes = new Set(["USD", "EUR", "GBP"]);
          const newCurrency = allowedCurrencyCodes.has(currencyCode)
            ? currencyCode
            : formData.currency;
          setFormData((prev) => ({
            ...prev,
            supplier_id: q.supplier_id
              ? String(q.supplier_id)
              : prev.supplier_id,
            currency: newCurrency,
            exchange_rate:
              q.exchange_rate !== undefined && q.exchange_rate !== null
                ? Number(q.exchange_rate) || prev.exchange_rate || 1
                : prev.exchange_rate,
            delivery_date: q.valid_until || prev.delivery_date || "",
            remarks: q.remarks || prev.remarks || "",
          }));
          if (!(q.exchange_rate !== undefined && q.exchange_rate !== null)) {
            await fetchExchangeRateForCode(newCurrency);
          }

          if (q.details) {
            const newItems = q.details.map((d) => {
              const taxCode =
                taxes.find(
                  (t) => Number(t.rate_percent) === Number(d.tax_percent),
                ) || null;
              return {
                item_id: String(d.item_id),
                qty: Number(d.qty) || 0,
                uom: d.uom || defaultUomCode,
                unit_price: Number(d.unit_price) || 0,
                discount_percent: Number(d.discount_percent) || 0,
                tax_code_id: taxCode ? String(taxCode.id) : "",
                tax_percent: Number(d.tax_percent) || 0,
                line_total: Number(d.line_total) || 0,
              };
            });
            setItems(newItems);
          }
        }
      } catch (err) {
        console.error("Failed to fetch quotation details", err);
      }
    }

    if (name === "currency") {
      await fetchExchangeRateForCode(value);
    }
  };
  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    const el = pdfRef.current;
    if (!el) return;
    const original = el.style.cssText;
    el.style.cssText =
      original +
      ";position:fixed;left:-10000px;top:0;display:block;z-index:-1;background:white;width:794px;padding:32px;";
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
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
        "PurchaseOrder_" +
        (formData.po_no || new Date().toISOString().slice(0, 10)) +
        ".pdf";
      pdf.save(fname);
    } finally {
      el.style.cssText = original;
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "item_id") {
      const selectedItem = availableItems.find(
        (i) => String(i.id) === String(value),
      );
      const fallbackUom = selectedItem?.uom || defaultUomCode;
      updated[index].uom = fallbackUom;

      const fallbackPrice = selectedItem
        ? Number(selectedItem.cost_price) || 0
        : 0;
      let unitPrice = fallbackPrice;

      updated[index].unit_price = unitPrice;
    }

    const qty = Number(updated[index].qty) || 0;
    const price = Number(updated[index].unit_price) || 0;
    const discPct = Number(updated[index].discount_percent) || 0;
    const taxCodeId = String(updated[index].tax_code_id || "");

    if (field === "tax_code_id") {
      const tc = taxes.find((t) => String(t.id) === taxCodeId);
      updated[index].tax_percent = tc ? Number(tc.rate_percent) || 0 : 0;
    }

    const base = qty * price;
    const disc = base * (discPct / 100);
    const taxable = base - disc;

    let itemTax = 0;
    const comps = taxComponentsByCode[taxCodeId] || [];
    if (comps.length > 0) {
      comps.forEach((c) => {
        itemTax += (taxable * (Number(c.rate_percent) || 0)) / 100;
      });
    } else {
      const taxPct = Number(updated[index].tax_percent) || 0;
      itemTax = taxable * (taxPct / 100);
    }

    updated[index].tax_amount = itemTax;
    updated[index].line_total = taxable + itemTax;

    setItems(updated);
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        item_id: "",
        qty: 0,
        uom: "",
        unit_price: 0,
        discount_percent: 0,
        tax_code_id: taxes.length > 0 ? String(taxes[0].id) : "",
        tax_percent: 0,
        line_total: 0,
      },
    ]);
  };

  const removeItem = (index) => {
    setItems((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const submitType = e?.nativeEvent?.submitter?.dataset?.submitType;
      const computedStatus =
        submitType === "pending"
          ? "PENDING_APPROVAL"
          : submitType === "draft"
            ? "DRAFT"
            : formData.status || "DRAFT";

      if (!formData.supplier_id) {
        setError("Supplier is required");
        setSaving(false);
        return;
      }

      const validItems = items.filter(
        (r) => r.item_id && Number(r.qty) > 0 && Number(r.unit_price) > 0,
      );
      if (validItems.length === 0) {
        setError("At least one item with quantity and unit price is required");
        setSaving(false);
        return;
      }

      const payload = {
        po_no: formData.po_no,
        po_date: formData.po_date,
        po_type: "IMPORT",
        status: computedStatus,
        supplier_id: Number(formData.supplier_id),
        warehouse_id: Number(formData.warehouse_id) || null,
        currency: formData.currency,
        exchange_rate: Number(formData.exchange_rate) || 1,
        delivery_date: formData.delivery_date || "",
        payment_type: String(formData.payment_type || "CASH"),
        payment_terms: Number(formData.payment_terms) || 0,
        delivery_terms: formData.delivery_terms || "",
        remarks: formData.remarks || "",
        project_id: formData.project_id || null,
        port_loading: formData.port_loading || "",
        port_discharge: formData.port_discharge || "",
        incoterms: formData.incoterms || "",
        hs_code: formData.hs_code || "",
        shipping_date: formData.shipping_date || "",
        insurance_required: Boolean(formData.insurance_required),
        freight_amount: Number(formData.freight_amount) || 0,
        other_charges: Number(formData.other_charges) || 0,
        discount_amount: summary.totalDiscount,
        tax_amount: summary.totalTax,
        total_amount: summary.grandTotal,
        terms_conditions: formData.terms_conditions || "",
        quotation_id: formData.quotation_id
          ? Number(formData.quotation_id)
          : undefined,
        details: validItems.map((r) => ({
          item_id: Number(r.item_id),
          qty: Number(r.qty) || 0,
          uom: r.uom || "",
          unit_price: Number(r.unit_price) || 0,
          discount_percent: Number(r.discount_percent) || 0,
          tax_code_id: r.tax_code_id ? Number(r.tax_code_id) : null,
          tax_percent: Number(r.tax_percent) || 0,
          line_total: Number(r.line_total) || 0,
        })),
      };

      if (submitType === "pending") {
        if (isEdit) {
          await api.put(`/purchase/orders/${id}`, payload);
          await api.post(`/purchase/orders/${id}/submit`, {
            amount: summary.grandTotal ?? null,
            workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
            target_user_id: targetApproverId || null,
        comments: forwardComments,
        });
          if (formData.general_requisition_id) {
            try {
              await api.post(
                `/purchase/general-requisitions/${formData.general_requisition_id}/link`,
                { ref_type: "PO_IMPORT", ref_id: Number(id) },
              );
            } catch {}
          }
        } else {
          const resp = await api.post("/purchase/orders", payload);
          const createdId = resp?.data?.id;
          if (createdId) {
            await api.post(`/purchase/orders/${createdId}/submit`, {
              amount: summary.grandTotal ?? null,
              workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
              target_user_id: targetApproverId || null,
        comments: forwardComments,
        });
            if (formData.general_requisition_id) {
              try {
                await api.post(
                  `/purchase/general-requisitions/${formData.general_requisition_id}/link`,
                  { ref_type: "PO_IMPORT", ref_id: Number(createdId) },
                );
              } catch {}
            }
          }
        }
        navigate("/purchase/purchase-orders-import", {
          state: { refresh: true },
        });
        return;
      }

      if (isEdit) {
        await api.put(`/purchase/orders/${id}`, payload);
        await api.put(`/purchase/orders/${id}/status`, {
          status: computedStatus,
        });
        if (formData.general_requisition_id) {
          try {
            await api.post(
              `/purchase/general-requisitions/${formData.general_requisition_id}/link`,
              { ref_type: "PO_IMPORT", ref_id: Number(id) },
            );
          } catch {}
        }
      } else {
        const resp = await api.post("/purchase/orders", payload);
        const createdId = resp?.data?.id;
        if (createdId && computedStatus !== "DRAFT") {
          await api.put(`/purchase/orders/${createdId}/status`, {
            status: computedStatus,
          });
          if (formData.general_requisition_id) {
            try {
              await api.post(
                `/purchase/general-requisitions/${formData.general_requisition_id}/link`,
                { ref_type: "PO_IMPORT", ref_id: Number(createdId) },
              );
            } catch {}
          }
        }
      }
      navigate("/purchase/purchase-orders-import", {
        state: { refresh: true },
      });
    } catch (e2) {
      const msg =
        e2?.response?.data?.message ||
        e2?.message ||
        "Error saving purchase order. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const openForwardModal = async () => {
    setShowForwardModal(true);
    setWfError("");
                    setForwardComments("");
    if (!workflowsCache) {
      try {
        setWfLoading(true);
        const res = await api.get("/workflows");
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setWorkflowsCache(items);
        await computeCandidateFromList(items);
      } catch (e) {
        setWfError(e?.response?.data?.message || "Failed to load workflows");
      } finally {
        setWfLoading(false);
      }
    } else {
      await computeCandidate();
    }
  };

  const computeCandidate = async () => {
    if (!workflowsCache || !workflowsCache.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
                    setForwardComments("");
      return;
    }
    const route = "/purchase/purchase-orders-import";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      workflowsCache.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      workflowsCache.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "PURCHASE_ORDER",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null,
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  };

  const computeCandidateFromList = async (items) => {
    if (!items || !items.length) {
      setCandidateWorkflow(null);
      setFirstApprover(null);
      setWfError("");
                    setForwardComments("");
      return;
    }
    const route = "/purchase/purchase-orders-import";
    const normalize = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    const chosen =
      items.find(
        (w) => Number(w.is_active) === 1 && String(w.document_route) === route,
      ) ||
      items.find(
        (w) =>
          Number(w.is_active) === 1 &&
          normalize(w.document_type) === "PURCHASE_ORDER",
      ) ||
      null;
    setCandidateWorkflow(chosen || null);
    setFirstApprover(null);
    if (!chosen) return;
    try {
      setWfLoading(true);
      const res = await api.get(`/workflows/${chosen.id}`);
      const item = res.data?.item;
      const steps = Array.isArray(item?.steps) ? item.steps : [];
      setWorkflowSteps(steps);
      const first = steps[0] || null;
      setFirstApprover(
        first
          ? {
              userId: first.approver_user_id,
              name: first.approver_name,
              stepName: first.step_name,
              stepOrder: first.step_order,
              approvalLimit: first.approval_limit,
            }
          : null,
      );
      if (first) {
        const defaultTarget =
          (Array.isArray(first.approvers) && first.approvers.length
            ? first.approvers[0].id
            : first.approver_user_id) || null;
        setTargetApproverId(defaultTarget);
      } else {
        setTargetApproverId(null);
      }
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to load workflow details",
      );
    } finally {
      setWfLoading(false);
    }
  };

  const forwardDocument = async () => {
    if (isNew) return;
    setSubmittingForward(true);
    setWfError("");
    try {
      const res = await api.post(`/purchase/orders/${id}/submit`, {
        amount: summary.grandTotal ?? null,
        workflow_id: candidateWorkflow ? candidateWorkflow.id : null,
        target_user_id: targetApproverId || null,
        comments: forwardComments,
        });
      const newStatus = res?.data?.status || "PENDING_APPROVAL";
      setFormData((prev) => ({ ...prev, status: newStatus }));
      try {
        if (socket) {
          socket.emit("workflow:forwarded", {
            module: "purchase",
            docType: "PO_IMPORT",
            docId: Number(id),
            target_user_id: targetApproverId || null,
            amount: summary.grandTotal ?? null,
            url: `/purchase/purchase-orders-import/${id}`,
            title: "Import Purchase Order forwarded for approval",
          });
        }
      } catch {}
      setShowForwardModal(false);
    } catch (e) {
      setWfError(
        e?.response?.data?.message || "Failed to forward for approval",
      );
    } finally {
      setSubmittingForward(false);
    }
  };

  // Styles matched to adopt.txt
  const colors = {
    primary: "#0E3646",
    primaryDark: "#082330",
    light: "#f8f9fa",
    border: "#dee2e6",
    success: "#28a745",
    danger: "#dc3545",
    info: "#17a2b8",
  };

  console.log("Rendering PurchaseOrdersImportForm", {
    id,
    isNew,
    isEdit,
    isView,
  });

  return (
    <div className="w-full pb-10">
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
            <div className="text-xl font-semibold">Purchase Order</div>
          </div>
          <div className="text-right text-sm">
            <div>DATE: {formData.po_date || ""}</div>
            <div>PO #: {formData.po_no || ""}</div>
          </div>
        </div>
      </div>
      <div className="w-full bg-white rounded-xl shadow-[0_4px_20px_rgba(14,54,70,0.15)] overflow-hidden">
        {/* Header */}
        <div className="bg-[#0E3646] text-white p-8">
          <h1 className="text-3xl font-bold mb-2">📝 Purchase Order</h1>
          <p className="opacity-90">Create local and import purchase orders</p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap justify-between items-center p-5 bg-[#f8f9fa] border-b border-[#dee2e6] gap-4">
          <div className="flex bg-[#f8f9fa] p-1 rounded-md border border-[#dee2e6]">
            <button
              type="button"
              className={`px-5 py-2.5 rounded text-sm font-semibold transition-all ${
                formData.po_type === "IMPORT"
                  ? "bg-[#0E3646] text-white"
                  : "text-gray-500 hover:bg-gray-200"
              }`}
              onClick={() => setFormData({ ...formData, po_type: "IMPORT" })}
            >
              🌍 Import Order
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={() => window.history.back()} className="btn-success font-medium flex items-center gap-2"
            >
              Back
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-8">
          {loading && <div className="text-center py-4">Loading...</div>}
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded mb-6 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* PO Info Section */}
            <div className="mb-8">
              <div className="text-lg font-semibold text-[#0E3646] mb-5 pb-2 border-b-2 border-[#0E3646]">
                📋 Purchase Order Information
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <div className="flex flex-col">
                  <label className="label required">
                    PO Date
                  </label>
                  <input
                    type="date"
                    name="po_date"
                    value={formData.po_date}
                    onChange={handleInputChange}
                    className="input"
                    required
                    disabled={isView || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <div className="flex flex-col">
                  <label className="label required">
                    Supplier
                  </label>
                  <select
                    name="supplier_id"
                    value={formData.supplier_id}
                    onChange={handleInputChange}
                    className="input"
                    required
                  >
                    <option value="">Select Supplier</option>
                    {Array.isArray(suppliers) &&
                      suppliers.map(
                        (s) =>
                          s && (
                            <option key={s.id} value={s.id}>
                              {s.supplier_name || s.name || "Unknown Supplier"}
                            </option>
                          ),
                      )}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="label">
                    Reference Quotation
                  </label>
                  <select
                    name="quotation_id"
                    value={formData.quotation_id}
                    onChange={handleInputChange}
                    className="input"
                  >
                    <option value="">Select Quotation</option>
                    {Array.isArray(quotations) &&
                      quotations.map(
                        (q) =>
                          q && (
                            <option key={q.id} value={q.id}>
                              {q.quotation_no} - {q.supplier_name}
                            </option>
                          ),
                      )}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="label">
                    Requisition
                  </label>
                  <select
                    name="general_requisition_id"
                    value={formData.general_requisition_id || ""}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setFormData((p) => ({
                        ...p,
                        general_requisition_id: val,
                      }));
                      const rid = Number(val);
                      if (Number.isFinite(rid) && rid > 0) {
                        try {
                          const res = await api.get(
                            `/purchase/general-requisitions/${rid}`,
                          );
                          const gr = res.data || null;
                          const grItems = Array.isArray(gr?.items)
                            ? gr.items
                            : [];
                          const mapped = grItems
                            .filter((ln) => Number(ln.item_id))
                            .map((ln) => ({
                              item_id: String(ln.item_id),
                              qty: Number(ln.qty || 0),
                              uom: ln.uom || "",
                              unit_price: Number(ln.estimated_unit_cost || 0),
                              discount_percent: 0,
                              tax_percent: 0,
                              line_total:
                                Number(ln.qty || 0) *
                                Number(ln.estimated_unit_cost || 0),
                            }));
                          if (mapped.length) setItems(mapped);
                        } catch {}
                      }
                    }}
                    className="input"
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
                <div className="flex flex-col">
                  <label className="label required">
                    Warehouse
                  </label>
                  <select
                    name="warehouse_id"
                    value={formData.warehouse_id}
                    onChange={handleInputChange}
                    className="input"
                  >
                    <option value="">Select Warehouse</option>
                    {Array.isArray(warehouses) &&
                      warehouses.map(
                        (w) =>
                          w && (
                            <option key={w.id} value={w.id}>
                              {w.warehouse_name ||
                                w.name ||
                                "Unknown Warehouse"}
                            </option>
                          ),
                      )}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="label required">
                    Currency
                  </label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleInputChange}
                    className="input"
                  >
                    {currencies.map((c) => (
                      <option key={c.id} value={c.code || c.currency_code}>
                        {c.code || c.currency_code} -{" "}
                        {c.name || c.currency_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="label">
                    Exchange Rate
                  </label>
                  <input
                    type="number"
                    name="exchange_rate"
                    value={formData.exchange_rate}
                    onChange={handleInputChange}
                    step="0.01"
                    className="input"
                    readOnly
                  />
                </div>
                <div className="flex flex-col">
                  <label className="label">
                    Project
                  </label>
                  <select
                    name="project_id"
                    value={formData.project_id}
                    onChange={handleInputChange}
                    className="input"
                  >
                    <option value="">-- Select Project --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_name || p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex flex-col">
                  <label className="label required">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    name="delivery_date"
                    value={formData.delivery_date}
                    onChange={handleInputChange}
                    className="input"
                  
                    disabled={isView || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="label">
                    Payment Type
                  </label>
                  <div className="flex items-center gap-6">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment_type"
                        value="CASH"
                        checked={(formData.payment_type || "CASH") === "CASH"}
                        onChange={handleInputChange}
                      />
                      <span>Cash</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment_type"
                        value="CREDIT"
                        checked={formData.payment_type === "CREDIT"}
                        onChange={handleInputChange}
                      />
                      <span>Credit</span>
                    </label>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="label">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    name="payment_terms"
                    value={formData.payment_terms}
                    onChange={handleInputChange}
                    disabled={
                      String(formData.payment_type || "CASH") === "CASH"
                    }
                    className="input"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="label">
                    Delivery Terms
                  </label>
                  <select
                    name="delivery_terms"
                    value={formData.delivery_terms}
                    onChange={handleInputChange}
                    className="input"
                  >
                    <option value="">Select Terms</option>
                    <option value="FOB">FOB - Free on Board</option>
                    <option value="CIF">CIF - Cost, Insurance & Freight</option>
                    <option value="EXW">EXW - Ex Works</option>
                    <option value="DDP">DDP - Delivered Duty Paid</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Import Specific Section */}
            {formData.po_type === "IMPORT" && (
              <div className="mb-8 bg-[#fff3cd] border-l-4 border-[#ffc107] p-6 rounded">
                <div className="text-lg font-semibold text-[#0E3646] mb-4">
                  🌍 Import Order Details
                </div>
                <div className="bg-[#e7f3ff] border-l-4 border-[#17a2b8] p-4 rounded mb-5 text-sm text-[#0c5460]">
                  <strong>ℹ️ Import Order:</strong> Additional documentation and
                  compliance requirements apply for international procurement.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="flex flex-col">
                    <label className="label">
                      Port of Loading
                    </label>
                    <input
                      type="text"
                      name="port_loading"
                      value={formData.port_loading}
                      onChange={handleInputChange}
                      placeholder="e.g., Shanghai, China"
                      className="input"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="label">
                      Port of Discharge
                    </label>
                    <input
                      type="text"
                      name="port_discharge"
                      value={formData.port_discharge}
                      onChange={handleInputChange}
                      placeholder="e.g., Tema Port, Ghana"
                      className="input"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="label">
                      Incoterms
                    </label>
                    <select
                      name="incoterms"
                      value={formData.incoterms}
                      onChange={handleInputChange}
                      className="input"
                    >
                      <option value="">Select</option>
                      <option value="FOB">FOB</option>
                      <option value="CIF">CIF</option>
                      <option value="CFR">CFR</option>
                      <option value="EXW">EXW</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col">
                    <label className="label">
                      HS Code
                    </label>
                    <input
                      type="text"
                      name="hs_code"
                      value={formData.hs_code}
                      onChange={handleInputChange}
                      placeholder="Harmonized System Code"
                      className="input"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="label">
                      Expected Shipping Date
                    </label>
                    <input
                      type="date"
                      name="shipping_date"
                      value={formData.shipping_date}
                      onChange={handleInputChange}
                      className="input"
                    
                      disabled={isView || (isEdit && !hasExceptional("DOCUMENT.EDIT_DATE"))}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="label">
                      Insurance Required
                    </label>
                    <select
                      name="insurance_required"
                      value={formData.insurance_required ? "YES" : "NO"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          insurance_required: e.target.value === "YES",
                        })
                      }
                      className="input"
                    >
                      <option value="YES">Yes</option>
                      <option value="NO">No</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Items Section */}
            <div className="mb-8">
              <div className="bg-[#f8f9fa] p-5 rounded-lg border border-[#dee2e6]">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-lg font-semibold text-[#0E3646]">
                    📦 Order Items
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-4 py-2 bg-[#0E3646] text-white rounded hover:bg-[#082330] transition-all text-sm font-medium flex items-center gap-2"
                  >
                    ➕ Add Item
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {/* <div className="mb-2 text-xs text-slate-600">
                    If a unit conversion exists for the selected item and UOM,
                    use the “number of UOM” button beside the UOM to convert
                    quantity to the item’s default for accurate costing.
                  </div> */}
                  <table className="w-full border-collapse bg-white rounded-lg overflow-hidden">
                    <thead className="bg-[#0E3646] text-white">
                      <tr>
                        <th className="p-3 text-left text-[13px] w-[50px]">
                          #
                        </th>
                        <th className="p-3 text-left text-[13px] w-80">
                          Item Name
                        </th>
                        <th className="p-3 text-left text-[13px] w-[100px]">
                          Qty
                        </th>
                        <th className="p-3 text-left text-[13px] w-[120px]">
                          UOM
                        </th>
                        <th className="p-3 text-left text-[13px] w-[120px]">
                          Unit Price
                        </th>
                        <th className="p-3 text-left text-[13px] w-[100px]">
                          Disc %
                        </th>
                        <th className="p-3 text-left text-[13px] w-[140px]">
                          Tax Code
                        </th>
                        <th className="p-3 text-right text-[13px] w-[100px]">
                          Tax Amount
                        </th>
                        <th className="p-3 text-right text-[13px] w-[150px]">
                          Net Amount
                        </th>
                        <th className="p-3 text-left text-[13px] w-[80px]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(
                        (row, idx) =>
                          row && (
                            <tr
                              key={idx}
                              className="border-b border-[#dee2e6] hover:bg-[#0E3646]/5 transition-colors"
                            >
                              <td className="p-3 text-sm">{idx + 1}</td>
                              <td className="p-3">
                                <div className="relative">
                                  <input
                                    id={`po-import-item-search-${idx}`} autoComplete="off"
                                    className="w-full p-2 border border-[#dee2e6] rounded text-sm focus:outline-none focus:border-[#0E3646]"
                                          placeholder="Scan barcode or type item name"
                                          value={itemQueries[idx] || ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setItemQueries((prev) => ({
                                              ...prev,
                                              [idx]: val,
                                            }));
                                            if (row.item_id) {
                                              handleItemChange(idx, "item_id", "");
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              const query = (
                                                itemQueries[idx] || ""
                                              ).trim();
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
                                              handleItemChange(
                                                idx,
                                                "item_id",
                                                String(results[0].id),
                                              );
                                              setItemQueries((prev) => ({
                                                ...prev,
                                                [idx]: results[0].item_name || results[0].name || results[0].item_code || "",
                                              }));
                                            }
                                          }}
                                  />
                                  {(() => {
                                    const query = (
                                      itemQueries[idx] || ""
                                    ).trim();
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
                                    return results.length && !row.item_id
                                      ? (() => {
                                          const el = document.getElementById(
                                            `po-import-item-search-${idx}`,
                                          );
                                          const r = el
                                            ? el.getBoundingClientRect()
                                            : { bottom: 0, left: 0, width: 0 };
                                          return (
                                            <div
                                              className="bg-white border border-[#dee2e6] rounded-lg shadow-lg max-h-48 overflow-auto"
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
                                                  className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-xs"
                                                  onClick={() => {
                                                    handleItemChange(
                                                      idx,
                                                      "item_id",
                                                      String(o.id),
                                                    );
                                                    setItemQueries((prev) => ({
                                                      ...prev,
                                                      [idx]: o.item_name || o.name || o.item_code || "",
                                                    }));
                                                  }}
                                                >
                                                  {o.item_name ||
                                                    o.item_code ||
                                                    "Unknown Item"}
                                                </button>
                                              ))}
                                            </div>
                                          );
                                        })()
                                      : null;
                                  })()}
                                </div>
                              </td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={row.qty}
                                  onChange={(e) =>
                                    handleItemChange(idx, "qty", e.target.value)
                                  }
                                  className="w-full p-2 border border-[#dee2e6] rounded text-sm text-right focus:outline-none focus:border-[#0E3646]"
                                  min="0"
                                  step="1"
                                />
                              </td>
                              <td className="p-3">
                                <select
                                  value={row.uom || defaultUomCode || ""}
                                  onChange={(e) =>
                                    handleItemChange(idx, "uom", e.target.value)
                                  }
                                  className="w-full p-2 border border-[#dee2e6] rounded text-sm text-center focus:outline-none focus:border-[#0E3646]"
                                >
                                  <option value="">Select UOM</option>
                                  {Array.isArray(uoms) &&
                                    uoms.map(
                                      (u) =>
                                        u && (
                                          <option key={u.id} value={u.uom_code}>
                                            {u.uom_code}
                                          </option>
                                        ),
                                    )}
                                </select>
                                {(() => {
                                  const it = availableItems.find(
                                    (ai) =>
                                      String(ai.id) === String(row.item_id),
                                  );
                                  const defaultUom =
                                    (it?.uom && String(it.uom)) ||
                                    (defaultUomCode
                                      ? String(defaultUomCode)
                                      : "");
                                  const currentUom = String(row.uom || "");
                                  const hasConversion =
                                    Array.isArray(unitConversions) &&
                                    unitConversions.some(
                                      (c) =>
                                        Number(c.is_active) &&
                                        Number(c.item_id) ===
                                          Number(row.item_id) &&
                                        String(c.from_uom) === currentUom &&
                                        String(c.to_uom) === defaultUom,
                                    );
                                  const showBtn =
                                    currentUom &&
                                    defaultUom &&
                                    currentUom !== defaultUom &&
                                    String(row.item_id || "") &&
                                    hasConversion;
                                  return showBtn ? (
                                    <button
                                      type="button"
                                      className="ml-2 px-2 py-1 text-xs border border-brand text-brand rounded hover:bg-brand hover:text-white transition-colors"
                                      onClick={() =>
                                        setConvModal({
                                          open: true,
                                          itemId: row.item_id,
                                          defaultUom: defaultUom,
                                          currentUom: currentUom,
                                          rowIdx: idx,
                                        })
                                      }
                                    >
                                      {`number of ${currentUom}`}
                                    </button>
                                  ) : null;
                                })()}
                              </td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  value={row.unit_price}
                                  onChange={(e) =>
                                    handleItemChange(
                                      idx,
                                      "unit_price",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full p-2 border border-[#dee2e6] rounded text-sm text-right focus:outline-none focus:border-[#0E3646]"
                                  min="0"
                                  step="1"
                                />
                              </td>
                              <td className="p-3">
                                <div
                                  className={
                                    !canEditDiscount()
                                      ? "disabled-light-blue"
                                      : ""
                                  }
                                >
                                  <input
                                    type="number"
                                    value={row.discount_percent}
                                    onChange={(e) =>
                                      handleItemChange(
                                        idx,
                                        "discount_percent",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full p-2 border border-[#dee2e6] rounded text-sm text-right focus:outline-none focus:border-[#0E3646]"
                                    min="0"
                                    max="100"
                                    step="1"
                                    disabled={!canEditDiscount()}
                                  />
                                </div>
                              </td>
                              <td className="p-3">
                                <select
                                  value={row.tax_code_id}
                                  onChange={(e) =>
                                    handleItemChange(
                                      idx,
                                      "tax_code_id",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full p-2 border border-[#dee2e6] rounded text-sm text-left focus:outline-none focus:border-[#0E3646]"
                                >
                                  <option value="">No Tax</option>
                                  {taxes.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-3 text-right text-sm text-slate-500">
                                {Number(row.tax_amount || 0).toLocaleString(
                                  undefined,
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  },
                                )}
                              </td>
                              <td className="p-3 text-right font-medium text-sm">
                                {formData.currency}{" "}
                                {row.line_total.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeItem(idx)}
                                  className="text-[#dc3545] hover:bg-[#dc3545]/10 p-1.5 rounded transition-colors"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ),
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#f8f9fa] p-5 rounded-lg mt-5 border border-[#dee2e6]">
                  <div className="flex justify-between py-2 border-b border-[#dee2e6]">
                    <span className="text-sm font-medium">Total Items:</span>
                    <span className="font-bold">
                      {items.filter((i) => i && i.item_id).length}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#dee2e6]">
                    <span className="text-sm font-medium">Sub Total:</span>
                    <span className="font-bold">
                      {formData.currency}{" "}
                      {summary.subTotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#dee2e6] text-[#dc3545]">
                    <span className="text-sm font-medium">Discount:</span>
                    <span className="font-bold">
                      -{formData.currency}{" "}
                      {summary.totalDiscount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-[#dee2e6] text-[#0E3646]">
                    <span className="text-sm font-medium">Tax:</span>
                    <span className="font-bold">
                      {formData.currency}{" "}
                      {summary.totalTax.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {(summary?.components || []).map((c, ci) => (
                    <div
                      key={ci}
                      className="flex justify-between py-2 border-b border-[#dee2e6] text-[#0E3646]"
                    >
                      <span className="text-sm font-medium">{c.name}:</span>
                      <span className="font-bold">
                        {formData.currency}{" "}
                        {Number(c.amount || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 border-b border-[#dee2e6] items-center">
                    <span className="text-sm font-medium">
                      Freight Charges:
                    </span>
                    <input
                      type="number"
                      name="freight_amount"
                      value={formData.freight_amount}
                      onChange={handleInputChange}
                      className="w-[150px] p-1.5 border border-[#dee2e6] rounded text-sm text-right focus:outline-none focus:border-[#0E3646]"
                    />
                  </div>
                  <div className="flex justify-between py-2 border-b border-[#dee2e6] items-center">
                    <span className="text-sm font-medium">Other Charges:</span>
                    <input
                      type="number"
                      name="other_charges"
                      value={formData.other_charges}
                      onChange={handleInputChange}
                      className="w-[150px] p-1.5 border border-[#dee2e6] rounded text-sm text-right focus:outline-none focus:border-[#0E3646]"
                    />
                  </div>
                  <div className="flex justify-between py-3 text-lg font-bold text-[#0E3646]">
                    <span>{`Total ${formData.currency || ""}:`}</span>
                    <span>
                      {formData.currency}{" "}
                      {totalInCurrentCurrency.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {showBaseTotalRow ? (
                    <div className="flex justify-between py-3 text-lg font-bold text-[#0E3646]">
                      <span>{`Total ${baseCurrencyCode}:`}</span>
                      <span>
                        {baseCurrencyCode}{" "}
                        {totalInBaseCurrency.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="mb-8">
              <div className="text-lg font-semibold text-[#0E3646] mb-5 pb-2 border-b-2 border-[#0E3646]">
                📜 Terms & Conditions
              </div>
              <div className="flex flex-col">
                <textarea
                  name="terms_conditions"
                  value={formData.terms_conditions}
                  onChange={handleInputChange}
                  rows="6"
                  className="p-3 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#0E3646] focus:ring-2 focus:ring-[#0E3646]/10"
                  placeholder="Enter terms and conditions..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-end items-center mt-8 gap-3">
              {!isView && (
                <button
                  type="submit"
                  disabled={saving}
                  data-submit-type="draft"
                  className="px-5 py-2.5 bg-[#0E3646] text-white rounded hover:bg-[#082330] transition-all font-medium flex items-center gap-2 disabled:opacity-70"
                >
                  {saving ? "Saving..." : "💾 Save"}
                </button>
              )}
              {!isView && (
                <button
                  type="submit"
                  disabled={saving}
                  data-submit-type="pending"
                  className="px-5 py-2.5 bg-[#28a745] text-white rounded hover:bg-[#218838] transition-all font-medium flex items-center gap-2 disabled:opacity-70"
                >
                  ✅ Submit for Approval
                </button>
              )}
            </div>
          </form>
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
              <div className="flex gap-3">
                {companyInfo.phone && <span>{companyInfo.phone}</span>}
                {companyInfo.email && <span>{companyInfo.email}</span>}
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold">Purchase Order</div>
          </div>
          <div className="text-right text-sm">
            <div>DATE: {formData.po_date || ""}</div>
            <div>PO #: {formData.po_no || ""}</div>
            <div>
              Supplier:{" "}
              {suppliers.find(
                (s) => String(s.id) === String(formData.supplier_id),
              )?.supplier_name ||
                suppliers.find(
                  (s) => String(s.id) === String(formData.supplier_id),
                )?.name ||
                ""}
            </div>
            <div>Currency: {formData.currency || ""}</div>
            <div>
              Exchange Rate: {Number(formData.exchange_rate || 1).toFixed(2)}
            </div>
            {formData.incoterms && <div>Incoterms: {formData.incoterms}</div>}
            {formData.port_loading && (
              <div>Port Loading: {formData.port_loading}</div>
            )}
            {formData.port_discharge && (
              <div>Port Discharge: {formData.port_discharge}</div>
            )}
          </div>
        </div>
        <div
          className="mb-2"
          style={{ width: "100%", overflow: "visible", margin: "0 auto" }}
        >
          <table
            className="text-sm"
            style={{ width: "100%", tableLayout: "fixed" }}
          >
            <colgroup>
              <col style={{ width: "40%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-right">Quantity</th>
                <th className="px-2 py-2 text-right">Unit Price</th>
                <th className="px-2 py-2 text-right">Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => {
                const it = availableItems.find(
                  (i) => String(i.id) === String(row.item_id),
                );
                const name = it?.item_name || it?.item_code || "Item";
                return (
                  <tr key={idx}>
                    <td className="px-2 py-2">{name}</td>
                    <td className="px-2 py-2 text-right">
                      {Number(row.qty || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {Number(row.unit_price || 0).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {Number(row.line_total || 0).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div></div>
          <div>
            <div>
              <div className="grid grid-cols-2">
                <div className="px-2 py-1 font-medium">Gross Subtotal</div>
                <div className="px-2 py-1 text-right">
                  {Number(summary.subTotal || 0).toFixed(2)}
                </div>
                <div className="px-2 py-1 font-medium">Discount</div>
                <div className="px-2 py-1 text-right">
                  {Number(summary.totalDiscount || 0).toFixed(2)}
                </div>
                <div className="px-2 py-1 font-medium">Net Sub Total</div>
                <div className="px-2 py-1 text-right font-semibold">
                  {Number(
                    summary.subTotal - summary.totalDiscount || 0,
                  ).toFixed(2)}
                </div>
                {(summary?.components || []).map((c, ci) => (
                  <React.Fragment key={ci}>
                    <div className="px-2 py-1 font-medium">{c.name}</div>
                    <div className="px-2 py-1 text-right">
                      {Number(c.amount || 0).toFixed(2)}
                    </div>
                  </React.Fragment>
                ))}
                <div className="px-2 py-1 font-medium">Freight Charges</div>
                <div className="px-2 py-1 text-right">
                  {Number(summary.freight || 0).toFixed(2)}
                </div>
                <div className="px-2 py-1 font-medium">Other Charges</div>
                <div className="px-2 py-1 text-right">
                  {Number(summary.other || 0).toFixed(2)}
                </div>
                <div className="px-2 py-1 font-semibold">Total</div>
                <div className="px-2 py-1 text-right font-semibold">
                  {Number(summary.grandTotal || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showForwardModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-erp w-full max-w-md overflow-hidden">
            <div className="p-4 bg-brand text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Forward for Approval</h2>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setWfError("");
                    setForwardComments("");
                }}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-slate-700">
                Document No:{" "}
                <span className="font-semibold">{formData.po_no}</span>
              </div>
              <div className="text-sm text-slate-700">
                Workflow:{" "}
                <span className="font-semibold">
                  {candidateWorkflow
                    ? `${candidateWorkflow.workflow_name} (${candidateWorkflow.workflow_code})`
                    : "None (inactive)"}
                </span>
              </div>
              <div>
                {wfLoading ? (
                  <div className="text-sm">Loading workflow...</div>
                ) : null}
              </div>
              <div>
                {wfError ? (
                  <div className="text-sm text-red-600">{wfError}</div>
                ) : null}
              </div>
              <div className="text-sm">
                <div className="font-medium">Target Approver</div>
                {(() => {
                  const hasSteps =
                    Array.isArray(workflowSteps) && workflowSteps.length > 0;
                  const first = hasSteps ? workflowSteps[0] : null;
                  const opts = first
                    ? Array.isArray(first.approvers) && first.approvers.length
                      ? first.approvers.map((u) => ({
                          id: u.id,
                          name: u.username,
                        }))
                      : first.approver_user_id
                        ? [
                            {
                              id: first.approver_user_id,
                              name:
                                first.approver_name ||
                                String(first.approver_user_id),
                            },
                          ]
                        : []
                    : [];
                  return opts.length > 0 ? (
                    <div className="mt-1">
                      <select
                        className="input w-full"
                        value={targetApproverId || ""}
                        onChange={(e) =>
                          setTargetApproverId(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      >
                        <option value="">Select target approver</option>
                        {opts.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-600 mt-1">
                        {firstApprover
                          ? `Step ${firstApprover.stepOrder} • ${
                              firstApprover.stepName
                            }${
                              firstApprover.approvalLimit != null
                                ? ` • Limit: ${Number(
                                    firstApprover.approvalLimit,
                                  ).toLocaleString()}`
                                : ""
                            }`
                          : ""}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600">
                      {candidateWorkflow
                        ? "No approver found in workflow definition"
                        : "No active workflow; default behavior will apply"}
                    </div>
                  );
                })()}
              </div>
            </div>
            
                <div className="mt-4 p-4 border-t border-slate-200">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Comments (Optional)</label>
                  <textarea
                    value={forwardComments}
                    onChange={(e) => setForwardComments(e.target.value)}
                    className="w-full border-slate-300 rounded-md focus:ring-brand focus:border-brand sm:text-sm"
                    rows={3}
                    placeholder="Add any comments for the approver..."
                  />
                </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                onClick={() => {
                  setShowForwardModal(false);
                  setCandidateWorkflow(null);
                  setFirstApprover(null);
                  setWfError("");
                    setForwardComments("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-700"
                onClick={forwardDocument}
                disabled={submittingForward || isNew}
              >
                {submittingForward ? "Forwarding..." : "Forward"}
              </button>
            </div>
          </div>
        </div>
      )}
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
            rowIdx: null,
          })
        }
        onApply={(payload) => {
          const { converted_qty } = payload || {};
          const idx = convModal.rowIdx;
          if (idx == null) return;
          setItems((prev) => {
            const updated = [...prev];
            const row = { ...updated[idx] };
            const qty = Number(converted_qty || 0);
            row.qty = qty;
            row.uom = convModal.defaultUom || row.uom;
            const price = Number(row.unit_price || 0);
            const discPct = Number(row.discount_percent || 0);
            const taxCodeId = String(row.tax_code_id || "");

            const base = qty * price;
            const disc = base * (discPct / 100);
            const taxable = base - disc;

            let itemTax = 0;
            const comps = taxComponentsByCode[taxCodeId] || [];
            if (comps.length > 0) {
              comps.forEach((c) => {
                itemTax += (taxable * (Number(c.rate_percent) || 0)) / 100;
              });
            } else {
              const taxPct = Number(row.tax_percent || 0);
              itemTax = taxable * (taxPct / 100);
            }
            row.line_total = taxable + itemTax;
            updated[idx] = row;
            return updated;
          });
        }}
      />
    </div>
  );
}

