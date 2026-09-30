/**
 * @fileoverview QuotationForm component.
 * Provides functionality for QuotationForm.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import {
  Save,
  Trash2,
  X,
  Plus,
  ArrowLeft,
  Printer,
  Download,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import defaultLogo from "../../../../assets/resources/OMNISUITE_LOGO_FILL.png";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { filterByPrefix } from "@/utils/searchUtils.js";
import { usePermission } from "../../../../auth/PermissionContext.jsx";

// Ghana Regions and Countries data
const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
];

const COUNTRIES = [
  "Ghana",
  "Nigeria",
  "Ivory Coast",
  "Togo",
  "Benin",
  "Burkina Faso",
  "Mali",
  "Niger",
  "Senegal",
  "Sierra Leone",
  "Liberia",
  "Guinea",
  "Guinea-Bissau",
  "Gambia",
  "Mauritania",
  "Cameroon",
  "United Kingdom",
  "United States",
  "Canada",
  "Germany",
  "France",
  "Netherlands",
  "Italy",
  "Spain",
  "China",
  "India",
  "Japan",
  "South Africa",
  "Kenya",
  "Ethiopia",
  "Other",
];

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function QuotationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get("mode");
  const readOnly = modeParam === "view";
  const isEditMode = !!id;
  const { user } = useAuth();
  const { getExchangeRate } = useExchangeRate();
  const { hasExceptional } = usePermission();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Form State matching change.txt structure but adapted for API
  const [formData, setFormData] = useState({
    quotation_no: "",
    quotation_date: new Date().toISOString().split("T")[0],
    customer_id: "",
    valid_days: 30,
    valid_until: "", // Calculated from date + valid_days
    status: "DRAFT",
    terms_and_conditions:
      "1. Validity: This quotation is valid for the period stated above.\n2. Payment: Payment is required as per the payment type selected.\n3. Delivery: Delivery will be made within the agreed timeline after order confirmation.\n4. Taxes: All prices are subject to applicable taxes as shown.",
    remarks: "",
    warehouse_id: "",
    price_type: "",
    payment_type: "CASH",
    currency_id: 4,
    exchange_rate: 1,
  });

  const [items, setItems] = useState([]); // Replaces 'lines'

  // New Item State for the input row
  const [newItem, setNewItem] = useState({
    item_id: "",
    item_name: "",
    qty: "",
    unit_price: "",
    discount_percent: 0,
    tax_type: "",
    remarks: "",
  });
  const [itemQuery, setItemQuery] = useState("");

  const [customers, setCustomers] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]); // Renamed to avoid confusion with form items
  const [warehouses, setWarehouses] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  const baseCurrencyCode = useMemo(() => {
    return (
      currencies.find((c) => Number(c.is_base) === 1 || c.is_base === true)
        ?.code || "GHS"
    );
  }, [currencies]);

  const selectedCurrencyCode = useMemo(() => {
    return (
      currencies.find((c) => String(c.id) === String(formData.currency_id))
        ?.code || ""
    );
  }, [currencies, formData.currency_id]);

  const [taxes, setTaxes] = useState([]);
  const [priceTypes, setPriceTypes] = useState([]);
  const [customerNameInput, setCustomerNameInput] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [taxComponentsByCode, setTaxComponentsByCode] = useState({});
  const [customerAddressInput, setCustomerAddressInput] = useState("");
  const [customerCityInput, setCustomerCityInput] = useState("");
  const [customerStateInput, setCustomerStateInput] = useState("");
  const [customerCountryInput, setCustomerCountryInput] = useState("");
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
  const [preparedBy, setPreparedBy] = useState("");
  const pdfRef = useRef(null);

  // Constants from change.txt
  /* const taxes = [
    { value: "VAT0", label: "VAT 0%", rate: 0 },
    { value: "VAT5", label: "VAT 5%", rate: 5 },
    { value: "VAT15", label: "VAT 15%", rate: 15 },
  ]; */

  const statuses = [
    { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
    { value: "SENT", label: "Sent", color: "bg-blue-100 text-blue-800" },
    {
      value: "ACCEPTED",
      label: "Accepted",
      color: "bg-green-100 text-green-800",
    },
    { value: "REJECTED", label: "Rejected", color: "bg-red-100 text-red-800" },
    {
      value: "EXPIRED",
      label: "Expired",
      color: "bg-orange-100 text-orange-800",
    },
  ];

  // Helper: Calculate Expiry
  const calcExpiry = (date, days) => {
    if (!date || !days) return "";
    const d = new Date(date);
    d.setDate(d.getDate() + parseInt(days));
    return d.toISOString().split("T")[0];
  };

  // Helper: Calculate Item Totals
  const calcItemTotals = (itm) => {
    const qty = parseFloat(itm.qty) || 0;
    const price = parseFloat(itm.unit_price) || 0;
    const disc = parseFloat(itm.discount_percent) || 0;

    const sub = qty * price;
    const discAmt = (sub * disc) / 100;
    const net = sub - discAmt;

    const taxRate =
      taxes.find((t) => String(t.value) === String(itm.tax_type))?.rate || 0;
    const taxAmt = (net * taxRate) / 100;

    return { sub, discAmt, net, taxAmt, total: net + taxAmt };
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

  // Helper: Calculate Grand Totals
  const calcGrandTotal = () => {
    const sub = items.reduce((s, i) => s + (i.net || 0), 0);
    const tax = items.reduce((s, i) => s + (i.taxAmt || 0), 0);
    return { sub, tax, total: sub + tax };
  };

  const calcTaxComponentsTotals = () => {
    const sub = items.reduce((s, i) => s + (i.net || 0), 0);
    const compTotals = {};
    items.forEach((i) => {
      const comps = taxComponentsByCode[String(i.tax_type)] || [];
      comps.forEach((c) => {
        const rate = Number(c.rate_percent) || 0;
        const amt = ((i.net || 0) * rate) / 100;
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

  const calcAggregates = () => {
    const grossSub = items.reduce((s, i) => s + (i.sub || 0), 0);
    const discountTotal = items.reduce((s, i) => s + (i.discAmt || 0), 0);
    const netSub = items.reduce((s, i) => s + (i.net || 0), 0);
    const tc = calcTaxComponentsTotals();
    const taxTotal = tc.taxTotal;
    const grand = netSub + taxTotal;
    return {
      grossSub,
      discountTotal,
      netSub,
      components: tc.components,
      taxTotal,
      grand,
    };
  };

  const getItemCode = (itemId) => {
    const p = inventoryItems.find((x) => String(x.id) === String(itemId));
    return p ? p.item_code || "" : "";
  };

  const ensureTaxComponentsLoaded = async () => {
    const uniqueTaxIds = Array.from(
      new Set(
        items.map((i) => i.tax_type).filter((id) => id && id !== "undefined"),
      ),
    );
    const missing = uniqueTaxIds.filter((id) => !(id in taxComponentsByCode));
    if (missing.length) {
      await Promise.all(missing.map((id) => fetchTaxComponentsForCode(id)));
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchProspects();
    fetchInventoryItems();
    fetchWarehouses();
    fetchCurrencies();
    fetchTaxCodes();
    fetchPriceTypes();
    fetchCompanyInfo();
    if (isEditMode) {
      fetchQuotation();
    } else {
      // Set initial expiry for new quotation
      setFormData((prev) => ({
        ...prev,
        valid_until: calcExpiry(prev.quotation_date, prev.valid_days),
      }));
      // Fetch next quotation number
      api
        .get("/sales/quotations/next-no")
        .then((resp) => {
          const nextNo = resp.data?.nextNo;
          if (nextNo) {
            setFormData((p) => ({ ...p, quotation_no: nextNo }));
          }
        })
        .catch(() => {
          // Fallback to QN000001
          setFormData((p) => ({
            ...p,
            quotation_no: p.quotation_no || "QN000001",
          }));
        });
    }
  }, [id]);

  useEffect(() => {
    if (!formData.currency_id || currencies.length === 0) return;
    const selected = currencies.find(
      (c) => String(c.id) === String(formData.currency_id),
    );
    const base = currencies.find(
      (c) => Number(c.is_base) === 1 || c.is_base === true,
    );
    if (!selected || !base) return;

    if (selected.code === base.code) {
      setFormData((p) => ({ ...p, exchange_rate: 1 }));
      return;
    }

    getExchangeRate(selected.code, base.code).then((rate) => {
      if (rate) {
        setFormData((p) => ({ ...p, exchange_rate: rate }));
      }
    });
  }, [formData.currency_id, currencies]);

  useEffect(() => {
    ensureTaxComponentsLoaded();
  }, [items]);

  useEffect(() => {
    const key = String(newItem.tax_type || "");
    if (!key || key in taxComponentsByCode) return;
    fetchTaxComponentsForCode(key);
  }, [newItem.tax_type, taxComponentsByCode]);

  // Update preparedBy when user changes
  useEffect(() => {
    if (user?.username) {
      setPreparedBy(user.username);
    }
  }, [user]);

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

  const fetchProspects = async () => {
    try {
      const response = await api.get("/sales/prospect-customers", {
        params: { active: "true" },
      });
      setProspects(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (error) {
      console.error("Error fetching prospects:", error);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const response = await api.get("/inventory/items");
      setInventoryItems(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await api.get("/inventory/warehouses");
      setWarehouses(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (error) {
      console.error("Error fetching warehouses:", error);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await api.get("/finance/currencies");
      const arr = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      setCurrencies(arr);
      const cedi =
        arr.find(
          (c) =>
            String(c.code || c.currency_code || "").toUpperCase() === "GHS",
        ) ||
        arr.find((c) =>
          /ghana|cedi/i.test(String(c.name || c.currency_name || "")),
        );
      if (cedi) {
        setFormData((prev) => ({ ...prev, currency_id: cedi.id }));
      }
    } catch (error) {
      console.error("Error fetching currencies:", error);
    }
  };

  const fetchTaxCodes = async () => {
    try {
      const response = await api.get("/finance/tax-codes?form=QUOTATION");
      const fetchedTaxes = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      const mappedTaxes = fetchedTaxes.map((t) => ({
        value: t.id,
        label: t.name,
        rate: Number(t.rate_percent),
        code: t.code,
      }));
      setTaxes(mappedTaxes);

      // Update newItem default tax if taxes are loaded and newItem has no tax set
      if (mappedTaxes.length > 0 && !newItem.tax_type) {
        const vat20 =
          mappedTaxes.find(
            (t) => Number(t.rate) === 20 && /vat/i.test(t.label),
          ) ||
          mappedTaxes.find((t) => Number(t.rate) === 20) ||
          mappedTaxes.find((t) => /vat/i.test(t.label)) ||
          mappedTaxes[0];
        setNewItem((prev) => ({
          ...prev,
          tax_type: vat20?.value,
          tax_rate: vat20?.rate,
        }));
        if (vat20?.value) {
          fetchTaxComponentsForCode(vat20.value);
        }
      }
    } catch (error) {
      console.error("Error fetching tax codes:", error);
    }
  };

  useEffect(() => {
    if (!taxes.length || !items.length) return;
    setItems((prev) => prev.map((i) => ({ ...i, ...calcItemTotals(i) })));
  }, [taxes]);

  // Removed tax component prefetching, as components are not displayed in calculations
  const fetchPriceTypes = async () => {
    try {
      const response = await api.get("/sales/price-types");
      setPriceTypes(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (error) {
      console.error("Error fetching price types:", error);
    }
  };

  const fetchCompanyInfo = async () => {
    try {
      // Set prepared by from AuthContext first (most reliable)
      const usernameFromAuth = user?.username || "";
      setPreparedBy(usernameFromAuth);

      const meResp = await api.get("/admin/me");
      const companyId = meResp.data?.scope?.companyId;

      // Update prepared by from API response if available and AuthContext didn't have it
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
      // Fallback to AuthContext username if API call fails
      if (user?.username) {
        setPreparedBy(user.username);
      }
      setCompanyInfo((prev) => ({
        ...prev,
        logoUrl: prev.logoUrl || defaultLogo,
      }));
    }
  };

  const getPriceTypeIdFromName = (name) => {
    if (!name || !priceTypes.length) return null;
    const match = priceTypes.find(
      (pt) =>
        String(pt.name || "").toUpperCase() === String(name).toUpperCase(),
    );
    return match ? match.id : null;
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

  const fetchStandardPriceForItem = async (productId, fallbackPrice) => {
    try {
      const res = await api.post("/sales/prices/best-price", {
        product_id: productId,
        quantity: 1,
        date: formData.quotation_date,
        price_type: formData.price_type || "",
        only_standard: true,
        ...(formData.customer_id ? { customer_id: formData.customer_id } : {}),
      });
      const price = Number(res.data?.price);
      if (Number.isFinite(price)) {
        return price;
      }
      return fallbackPrice || 0;
    } catch (e) {
      console.error("Error fetching standard price:", e);
      return fallbackPrice || 0;
    }
  };

  const repriceQuotationLinesByPriceType = async (newPriceType, newCustomerId) => {
    const pType = newPriceType !== undefined ? newPriceType : formData.price_type;
    const cId = newCustomerId !== undefined ? newCustomerId : formData.customer_id;
    const dateStr = formData.quotation_date;

    const fetchPrice = async (prodId) => {
      try {
        const res = await api.post("/sales/prices/best-price", {
          product_id: prodId,
          quantity: 1,
          date: dateStr,
          price_type: typeof pType === "string" ? pType : String(pType || ""),
          only_standard: true,
          ...(cId ? { customer_id: cId } : {}),
        });
        if (res.data?.price !== undefined) {
          return Number(res.data.price);
        }
      } catch {
        // fall through
      }
      return null;
    };

    const out = await Promise.all(
      items.map(async (line) => {
        if (!line.item_id) {
          return { ...line, ...calcItemTotals(line) };
        }
        const newPrice = await fetchPrice(line.item_id);
        if (newPrice !== null) {
          const nextLine = { ...line, unit_price: newPrice };
          return { ...nextLine, ...calcItemTotals(nextLine) };
        }
        return { ...line, ...calcItemTotals(line) };
      }),
    );
    setItems(out);

    if (newItem.item_id) {
      const newPrice = await fetchPrice(newItem.item_id);
      if (newPrice !== null) {
        setNewItem((prev) => ({ ...prev, unit_price: newPrice }));
      }
    }
  };

  const fetchQuotation = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/sales/quotations/${id}`);
      const data = response.data?.item;
      if (data) {
        setFormData({
          quotation_no: data.quotation_no || "",
          quotation_date:
            data.quotation_date || new Date().toISOString().split("T")[0],
          customer_id: data.customer_id || "",
          valid_days: data.valid_days || 30,
          valid_until: data.valid_until || "",
          status: data.status || "DRAFT",
          terms_and_conditions: data.terms_and_conditions || "",
          remarks: data.remarks || "",
          warehouse_id: data.warehouse_id || "",
          price_type: data.price_type || "",
          payment_type: data.payment_type || "CASH",
          currency_id: data.currency_id || 4,
          exchange_rate: data.exchange_rate || 1,
        });

        // Set customer name input from customer lookup
        if (data.customer_id) {
          const customer = customers.find(
            (c) => String(c.id) === String(data.customer_id),
          );
          if (customer) {
            setCustomerNameInput(
              data.customer_name || customer.customer_name || "",
            );
            setCustomerAddressInput(
              data.customer_address || customer.address || "",
            );
            setCustomerCityInput(data.customer_city || customer.city || "");
            setCustomerStateInput(data.customer_state || customer.state || "");
            setCustomerCountryInput(
              data.customer_country || customer.country || "",
            );
          }
        }

        if (response.data?.details) {
          // Map existing lines to include calculated fields
          const mappedItems = response.data.details.map((line, index) => {
            const calculations = calcItemTotals({
              qty: line.qty,
              unit_price: line.unit_price,
              discount_percent: line.discount_percent,
              tax_type: line.tax_type || taxes?.[0]?.value || "", // Default if missing
            });
            return {
              ...line,
              line_id: index + 1, // distinct from database id
              ...calculations,
            };
          });
          setItems(mappedItems);
        }
      }
    } catch (error) {
      setError(error?.response?.data?.message || "Error fetching quotation");
      console.error("Error fetching quotation:", error);
    } finally {
      setLoading(false);
    }
  };

  const ensureCustomerIdFromInput = async () => {
    if (formData.customer_id) return Number(formData.customer_id);
    const name = customerNameInput.trim();
    if (!name) {
      throw new Error("Please enter a customer name");
    }
    setCreatingCustomer(true);
    try {
      const priceTypeId = getPriceTypeIdFromName(formData.price_type);
      const resp = await api.post("/sales/customers", {
        customer_name: name,
        price_type_id: priceTypeId,
        address: customerAddressInput || null,
        city: customerCityInput || null,
        state: customerStateInput || null,
        country: customerCountryInput || null,
      });
      const newId = resp.data?.id;
      if (!newId) throw new Error("Failed to create customer");
      setFormData((prev) => ({ ...prev, customer_id: newId }));
      return Number(newId);
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleCustomerSelect = (name) => {
    setCustomerNameInput(name);

    // Find in customers
    const cust = customers.find(
      (c) => String(c.customer_name).trim() === String(name).trim(),
    );
    if (cust) {
      const priceTypeToUse = cust.price_type_id
        ? String(cust.price_type_id)
        : formData.price_type;
      setFormData((prev) => ({
        ...prev,
        customer_id: cust.id,
        // Auto-apply customer's linked price type if available
        ...(cust.price_type_id ? { price_type: String(cust.price_type_id) } : {}),
      }));
      setCustomerAddressInput(cust.address || "");
      setCustomerCityInput(cust.city || "");
      setCustomerStateInput(cust.state || "");
      setCustomerCountryInput(cust.country || "");
      void repriceQuotationLinesByPriceType(priceTypeToUse, cust.id);
      return;
    }

    // Find in prospects
    const pros = prospects.find(
      (p) =>
        String(p.customer_name || p.prospect_customer).trim() ===
        String(name).trim(),
    );
    if (pros) {
      // For prospects, we'll create them as customers later if not in edit mode
      // or if they don't have a real customer_id yet.
      setCustomerAddressInput(pros.address || "");
      setCustomerCityInput(pros.city || "");
      setCustomerStateInput(pros.state || "");
      setCustomerCountryInput(pros.country || "");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "quotation_date" || name === "valid_days") {
      const d = name === "quotation_date" ? value : formData.quotation_date;
      const v = name === "valid_days" ? value : formData.valid_days;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        valid_until: calcExpiry(d, v),
      }));
    } else if (name === "price_type") {
      setFormData((prev) => ({ ...prev, [name]: value }));
      void repriceQuotationLinesByPriceType(value, formData.customer_id);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    if (name === "item_id") {
      const prod = inventoryItems.find((p) => p.id === parseInt(value));
      // Default to product master selling price, then try standard price by price type
      const fallbackPrice = prod?.selling_price || 0;
      setNewItem((prev) => ({
        ...prev,
        item_id: value,
        item_name: prod?.item_name || "",
        unit_price: fallbackPrice,
        qty: 1, // Default qty
      }));
      fetchStandardPriceForItem(value, fallbackPrice).then((sp) =>
        setNewItem((prev) => ({ ...prev, unit_price: sp })),
      );
      if (value) {
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
                tax_rate: undefined,
              }));
            }
          })
          .catch(() => {
            setNewItem((prev) => ({
              ...prev,
              tax_rate: undefined,
            }));
          });
      }
    } else {
      if (name === "tax_type") {
        const selectedTaxRate =
          taxes.find((t) => String(t.value) === String(value))?.rate || 0;
        if (value) fetchTaxComponentsForCode(value);
        setNewItem((prev) => ({
          ...prev,
          [name]: value,
          tax_rate: selectedTaxRate,
        }));
        return;
      }
      setNewItem((prev) => ({ ...prev, [name]: value }));
    }
  };

  const addItem = () => {
    if (!newItem.item_id || !newItem.qty || !newItem.unit_price) {
      alert("Please fill all required item fields");
      return;
    }

    const calculations = calcItemTotals(newItem);
    setItems([
      ...items,
      {
        ...newItem,
        line_id: Date.now(), // temporary ID
        ...calculations,
      },
    ]);

    // Reset new item input
    setNewItem({
      item_id: "",
      item_name: "",
      qty: "",
      unit_price: "",
      discount_percent: 0,
      tax_type:
        (
          taxes.find((t) => Number(t.rate) === 20 && /vat/i.test(t.label)) ||
          taxes.find((t) => Number(t.rate) === 20) ||
          taxes.find((t) => /vat/i.test(t.label)) ||
          taxes[0]
        )?.value || "",
      tax_rate:
        (
          taxes.find((t) => Number(t.rate) === 20 && /vat/i.test(t.label)) ||
          taxes.find((t) => Number(t.rate) === 20) ||
          taxes.find((t) => /vat/i.test(t.label)) ||
          taxes[0]
        )?.rate || undefined,
      remarks: "",
    });
    setItemQuery("");
  };

  const removeItem = (lineId) => {
    setItems(items.filter((i) => i.line_id !== lineId));
  };

  const handlePrint = () => {
    ensureTaxComponentsLoaded().finally(() => window.print());
  };

  const handleDownload = async () => {
    await ensureTaxComponentsLoaded();
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
        "Quotation_" +
        (formData.quotation_no || new Date().toISOString().slice(0, 10)) +
        ".pdf";
      pdf.save(fname);
    } finally {
      el.style.cssText = original;
    }
  };

  // Helper function to remove undefined values and convert to null
  const cleanPayload = (obj) => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => {
        return item === undefined ? null : cleanPayload(item);
      });
    }

    const cleaned = {};
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      cleaned[key] = value === undefined ? null : cleanPayload(value);
    });
    return cleaned;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      (!formData.customer_id && !customerNameInput.trim()) ||
      items.length === 0
    ) {
      alert("Please enter customer name and add at least one item");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");
    const totalsAgg = calcAggregates();

    // Auto-generate Quotation No if empty
    let finalQuotationNo = formData.quotation_no;
    if (!finalQuotationNo) {
      try {
        const resp = await api.get("/sales/quotations/next-no");
        finalQuotationNo = resp.data?.nextNo || "QN000001";
      } catch {
        finalQuotationNo = "QN000001";
      }
    }

    try {
      const customerId = await ensureCustomerIdFromInput();
      if (!customerId) {
        alert("Failed to get customer ID. Please try again.");
        setLoading(false);
        return;
      }

      // Ensure all items have calculated values and filter out invalid items
      const processedItems = items
        .filter((item) => item.item_id && Number(item.item_id) > 0)
        .map((item) => {
          const calculations = calcItemTotals(item);
          const taxTypeId =
            item.tax_type !== null &&
            item.tax_type !== undefined &&
            item.tax_type !== ""
              ? Number(item.tax_type)
              : null;
          const taxInfo =
            taxTypeId !== null
              ? taxes.find((t) => String(t.value) === String(taxTypeId))
              : null;

          // Ensure all values are explicitly set (no undefined)
          return {
            item_id: Number(item.item_id),
            qty: Number(item.qty) || 0,
            quantity: Number(item.qty) || 0, // Also send as quantity for server compatibility
            unit_price: Number(item.unit_price) || 0,
            discount_percent: Number(item.discount_percent) || 0,
            tax_type: taxTypeId,
            tax_id: taxTypeId,
            tax_rate: taxInfo ? Number(taxInfo.rate) || 0 : 0,
            tax_amount: Number(calculations.taxAmt) || 0,
            line_total: Number(calculations.total) || 0,
            total_amount: Number(calculations.total) || 0,
            net_amount: Number(calculations.net) || 0,
          };
        });

      // Build payload ensuring all values are explicitly set (no undefined)
      const payload = {
        quotation_no: finalQuotationNo ? String(finalQuotationNo) : null,
        quotation_date: formData.quotation_date
          ? String(formData.quotation_date)
          : null,
        customer_id: customerId ? Number(customerId) : null,
        valid_until: formData.valid_until ? String(formData.valid_until) : null,
        status: formData.status ? String(formData.status) : "DRAFT",
        terms_and_conditions:
          formData.terms_and_conditions && formData.terms_and_conditions.trim()
            ? String(formData.terms_and_conditions)
            : null,
        remarks:
          formData.remarks && formData.remarks.trim()
            ? String(formData.remarks)
            : null,
        warehouse_id: formData.warehouse_id
          ? Number(formData.warehouse_id)
          : null,
        price_type: formData.price_type ? String(formData.price_type) : null,
        payment_type: formData.payment_type
          ? String(formData.payment_type)
          : null,
        customer_name: customerNameInput ? String(customerNameInput) : null,
        customer_address: customerAddressInput
          ? String(customerAddressInput)
          : null,
        customer_city: customerCityInput ? String(customerCityInput) : null,
        customer_state: customerStateInput ? String(customerStateInput) : null,
        customer_country: customerCountryInput
          ? String(customerCountryInput)
          : null,
        total_amount: totalsAgg.grand ? Number(totalsAgg.grand) : 0,
        items: processedItems,
      };

      // Clean payload to remove any undefined values (double-check)
      const cleanedPayload = cleanPayload(payload);

      // Final validation: ensure customer_id is a valid number
      if (!cleanedPayload.customer_id || isNaN(cleanedPayload.customer_id)) {
        alert("Invalid customer ID. Please try again.");
        setLoading(false);
        return;
      }

      // Ensure all string fields that could be undefined are null
      cleanedPayload.quotation_no = cleanedPayload.quotation_no || null;
      cleanedPayload.quotation_date = cleanedPayload.quotation_date || null;
      cleanedPayload.valid_until = cleanedPayload.valid_until || null;
      cleanedPayload.status = cleanedPayload.status || "DRAFT";
      cleanedPayload.remarks = cleanedPayload.remarks || null;
      cleanedPayload.terms_and_conditions =
        cleanedPayload.terms_and_conditions || null;
      cleanedPayload.warehouse_id = cleanedPayload.warehouse_id || null;
      cleanedPayload.price_type = cleanedPayload.price_type || null;
      cleanedPayload.payment_type = cleanedPayload.payment_type || null;
      cleanedPayload.customer_name = cleanedPayload.customer_name || null;
      cleanedPayload.customer_address = cleanedPayload.customer_address || null;
      cleanedPayload.customer_city = cleanedPayload.customer_city || null;
      cleanedPayload.customer_state = cleanedPayload.customer_state || null;
      cleanedPayload.customer_country = cleanedPayload.customer_country || null;
      cleanedPayload.total_amount = cleanedPayload.total_amount || 0;

      // Ensure all items have valid values
      if (cleanedPayload.items && Array.isArray(cleanedPayload.items)) {
        cleanedPayload.items = cleanedPayload.items.map((item) => ({
          item_id: Number(item.item_id) || null,
          qty: Number(item.qty) || 0,
          quantity: Number(item.qty) || 0,
          unit_price: Number(item.unit_price) || 0,
          tax_id:
            item.tax_id !== null && item.tax_id !== undefined
              ? Number(item.tax_id)
              : null,
          tax_type:
            item.tax_type !== null && item.tax_type !== undefined
              ? Number(item.tax_type)
              : null,
          tax_rate: Number(item.tax_rate) || 0,
          tax_amount: Number(item.tax_amount) || 0,
          line_total: Number(item.line_total) || 0,
          total_amount: Number(item.total_amount) || 0,
        }));
      }

      if (isEditMode) {
        await api.put(`/sales/quotations/${id}`, cleanedPayload);
      } else {
        await api.post("/sales/quotations", cleanedPayload);
      }

      toast.success(
        isEditMode
          ? "Quotation updated successfully."
          : "Quotation created successfully.",
      );
      setTimeout(() => {
        navigate("/sales/quotations");
      }, 600);
    } catch (error) {
      console.error("Error saving quotation:", error);
      const msg =
        error.response?.data?.message || error.message || "Unknown error";
      setError(`Error saving quotation: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden my-6 print:shadow-none print:my-0 print:w-full print:max-w-none">
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
          margin: 0;
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
        .quotation-table td {
          overflow: visible;
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
      {/* Header */}
      <div
        className="p-6 border-b text-white print:hidden"
        style={{ backgroundColor: "#0E3646" }}
      >
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">
              {isEditMode ? "Edit" : "New"} Quotation
            </h2>
            <p className="text-sm opacity-80">
              {isEditMode
                ? "Update quotation details"
                : "Create a new sales quotation"}
            </p>
          </div>
          <div className="flex gap-4 print:hidden items-center">
            <Link
              to="/sales/prospect-customers/new"
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors text-sm font-medium border border-green-500"
            >
              <Plus className="w-4 h-4" />
              Create Prospect
            </Link>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors text-sm font-medium border border-white/20"
              title="Save as PDF"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="text-white hover:text-gray-200"
              title="Print"
            >
              <Printer className="w-6 h-6" />
            </button>
            <Link
              to="/sales/quotations"
              className="text-white hover:text-gray-200"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </div>
      <div className="p-6 print:hidden">
        {successMessage ? (
          <div className="alert alert-success mb-4">
            <span>{successMessage}</span>
          </div>
        ) : null}
        {error ? (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        ) : null}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quotation #
              </label>
              <input
                type="text"
                name="quotation_no"
                value={formData.quotation_no}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                placeholder="Auto-generated"
                readOnly={!isEditMode && !formData.quotation_no}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                name="quotation_date"
                value={formData.quotation_date}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                required
                disabled={isEditMode && !hasExceptional("DOCUMENT.EDIT_DATE")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer *
              </label>
              <input
                type="text"
                value={customerNameInput}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                list="customer-suggestions"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                placeholder="Type customer name"
                required
              />
              <datalist id="customer-suggestions">
                {Array.from(
                  new Set(
                    [
                      ...customers.map((c) => c.customer_name),
                      ...prospects.map(
                        (p) => p.customer_name || p.prospect_customer,
                      ),
                    ].filter(Boolean),
                  ),
                )
                  .sort()
                  .map((name) => (
                    <option key={name} value={name} />
                  ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={customerAddressInput}
                onChange={(e) => setCustomerAddressInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                placeholder="Enter address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={customerCityInput}
                onChange={(e) => setCustomerCityInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                placeholder="Enter city"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State/Region
              </label>
              <select
                value={customerStateInput}
                onChange={(e) => setCustomerStateInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
              >
                <option value="">Select Region</option>
                {GHANA_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <select
                value={customerCountryInput}
                onChange={(e) => setCustomerCountryInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
              >
                <option value="">Select Country</option>
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warehouse
              </label>
              <select
                name="warehouse_id"
                value={formData.warehouse_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid Days *
              </label>
              <input
                type="number"
                name="valid_days"
                value={formData.valid_days}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={formData.valid_until}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                readOnly
              
                disabled={readOnly || (isEditMode && !hasExceptional("DOCUMENT.EDIT_DATE"))}
              />
            </div>
            <div className="hidden">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price Type
              </label>
              <select
                name="price_type"
                value={formData.price_type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
              >
                <option value="">Select price type</option>
                {priceTypes.map((pt) => (
                  <option key={pt.id} value={pt.name}>{pt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Type
              </label>
              <select
                name="payment_type"
                value={formData.payment_type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
              >
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                name="currency_id"
                value={formData.currency_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
              >
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code || c.currency_code} - {c.name || c.currency_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Exchange Rate{" "}
                {selectedCurrencyCode
                  ? `(${baseCurrencyCode} per ${selectedCurrencyCode})`
                  : ""}
              </label>
              <input
                type="number"
                step="0.000001"
                name="exchange_rate"
                value={formData.exchange_rate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                readOnly
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Terms & Conditions
              </label>
              <textarea
                name="terms_and_conditions"
                value={formData.terms_and_conditions}
                onChange={handleInputChange}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646] print:hidden"
                placeholder="Enter terms and conditions..."
              />
              <div className="hidden print:block whitespace-pre-wrap text-sm text-gray-800 border-none p-0">
                {formData.terms_and_conditions || "None"}
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleInputChange}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646] print:hidden"
                placeholder="Enter remarks..."
              />
              <div className="hidden print:block whitespace-pre-wrap text-sm text-gray-800 border-none p-0">
                {formData.remarks || "None"}
              </div>
            </div>
          </div>
          <div className="border-t pt-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Quotation Items
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200 print:hidden">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Item *
                  </label>
                  <div className="relative">
                    <input
                      id="quotation-item-search"
                      name="item_id"
                      autoComplete="off"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                      placeholder="Scan barcode or type item name"
                      value={itemQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItemQuery(val);
                        if (newItem.item_id) {
                          setNewItem((prev) => ({
                            ...prev,
                            item_id: "",
                            item_name: "",
                            unit_price: "",
                          }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const query = itemQuery.trim();
                          const results = query
                            ? filterByPrefix(inventoryItems, {
                                query,
                                searchFields: ["item_code", "item_name", "barcode"],
                              })
                            : [];
                          if (!query || !results.length) return;
                          handleNewItemChange({ target: { name: "item_id", value: results[0].id } });
                          e.preventDefault();
                          setItemQuery(results[0].item_name);
                        }
                      }}
                    />
                    {(() => {
                      const query = itemQuery.trim();
                      const results = query
                        ? filterByPrefix(inventoryItems, {
                            query,
                            searchFields: ["item_code", "item_name", "barcode"],
                          })
                        : [];
                      return results.length && !newItem.item_id ? (
                        (() => {
                          const el = document.getElementById("quotation-item-search");
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
                                  onClick={() => {
                                    handleNewItemChange({ target: { name: "item_id", value: o.id } });
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
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Qty *
                  </label>
                  <input
                    type="number"
                    name="qty"
                    value={newItem.qty}
                    onChange={handleNewItemChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Price *
                  </label>
                  <input
                    type="number"
                    name="unit_price"
                    value={newItem.unit_price}
                    onChange={handleNewItemChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Disc %
                  </label>
                  <input
                    type="number"
                    name="discount_percent"
                    value={newItem.discount_percent}
                    onChange={handleNewItemChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Tax
                  </label>
                  <select
                    name="tax_type"
                    value={newItem.tax_type}
                    onChange={handleNewItemChange}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
                  >
                    {taxes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "#0E3646" }}
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>
            </div>
            {items.length > 0 && (
              <>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Item
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          Disc%
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider print:hidden">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {items.map((i) => (
                        <tr key={i.line_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900">
                            {i.item_name}
                          </td>
                          <td className="px-4 py-3 text-gray-900">{i.qty}</td>
                          <td className="px-4 py-3 text-gray-900">
                            {parseFloat(i.unit_price).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {parseFloat(i.discount_percent || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {i.net.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {i.taxAmt.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {i.total.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 print:hidden">
                            <button
                              type="button"
                              onClick={() => removeItem(i.line_id)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 ml-auto w-full max-w-md rounded-md bg-gray-100 px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                    <span>Subtotal:</span>
                    <span>{calcAggregates().netSub.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                    <span>Total Discount:</span>
                    <span>{calcAggregates().discountTotal.toFixed(2)}</span>
                  </div>
                  {calcAggregates().components.map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center justify-between text-sm italic text-slate-600"
                    >
                      <span>{c.name}</span>
                      <span>{c.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-base font-bold text-slate-800 pt-1">
                    <span>Total Tax:</span>
                    <span>{calcAggregates().taxTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xl font-bold text-slate-900 pt-1">
                    <span>Grand Total:</span>
                    <span>{calcAggregates().grand.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
            {items.length === 0 && (
              <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <p>
                  No items added yet. Use the form above to add items to this
                  quotation.
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200 print:hidden">
            <button onClick={() => window.history.back()} className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#0E3646" }}
              disabled={loading}
            >
              <Save className="w-5 h-5" />
              {loading
                ? "Saving..."
                : isEditMode
                  ? "Update Quotation"
                  : "Create Quotation"}
            </button>
          </div>
        </form>
      </div>
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
            <div className="text-xl font-semibold">Quotation</div>
          </div>
          <div className="text-right text-sm">
            <div>DATE: {formData.quotation_date || ""}</div>
            <div>Quotation #: {formData.quotation_no || ""}</div>
            <div>
              Customer:{" "}
              {customerNameInput || formData.potential_cust_name || ""}
            </div>
            <div>Valid until: {formData.valid_until || ""}</div>
            <div>Prepared by: {preparedBy || ""}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <div className="flex">
              <div className="w-32">Customer Name</div>
              <div className="flex-1">
                {customerNameInput ||
                  customers.find(
                    (c) => String(c.id) === String(formData.customer_id),
                  )?.customer_name ||
                  ""}
              </div>
            </div>
            <div className="flex">
              <div className="w-32">Address</div>
              <div className="flex-1">{customerAddressInput || ""}</div>
            </div>
            <div className="flex">
              <div className="w-32">City</div>
              <div className="flex-1">{customerCityInput || ""}</div>
            </div>
            <div className="flex">
              <div className="w-32">State</div>
              <div className="flex-1">{customerStateInput || ""}</div>
            </div>
            <div className="flex">
              <div className="w-32">Country</div>
              <div className="flex-1">{customerCountryInput || ""}</div>
            </div>
          </div>
          <div className="text-right"></div>
        </div>
        <div className="mb-2">
          <table className="quotation-table text-sm">
            <colgroup>
              <col style={{ width: "40%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "20%" }} />
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
              {items.map((i, idx) => (
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
            <div className="rounded-md bg-gray-100 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-[30px] font-semibold text-slate-700">
                <span>Subtotal:</span>
                <span>{calcAggregates().netSub.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[30px] font-semibold text-slate-700">
                <span>Total Discount:</span>
                <span>{calcAggregates().discountTotal.toFixed(2)}</span>
              </div>
              {calcAggregates().components.length > 0 &&
                calcAggregates().components.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between text-[24px] text-slate-600"
                  >
                    <span>{c.name}</span>
                    <span>{c.amount.toFixed(2)}</span>
                  </div>
                ))}
              <div className="flex items-center justify-between text-[34px] font-bold text-slate-800 pt-1">
                <span>Total Tax:</span>
                <span>{calcAggregates().taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[38px] font-bold text-slate-900 pt-1">
                <span>Grand Total:</span>
                <span>{calcAggregates().grand.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 text-sm">
          <div>Terms and conditions :</div>
          <div className="mt-1">{formData.terms_and_conditions || "None"}</div>
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
              <div className="flex gap-3">
                {companyInfo.phone && <span>{companyInfo.phone}</span>}
                {companyInfo.email && <span>{companyInfo.email}</span>}
              </div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold">Quotation</div>
          </div>
          <div className="text-right text-sm">
            <div>DATE: {formData.quotation_date || ""}</div>
            <div>Quotation #: {formData.quotation_no || ""}</div>
            <div>Customer: {customerNameInput || ""}</div>
            <div>Valid until: {formData.valid_until || ""}</div>
            <div>Prepared by: {preparedBy || ""}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <div className="flex">
              <div className="w-32">Customer Name</div>
              <div className="flex-1">
                {customerNameInput ||
                  customers.find(
                    (c) => String(c.id) === String(formData.customer_id),
                  )?.customer_name ||
                  ""}
              </div>
            </div>
            <div className="flex">
              <div className="w-32">Address</div>
              <div className="flex-1">{customerAddressInput || ""}</div>
            </div>
            <div className="flex">
              <div className="w-32">City</div>
              <div className="flex-1">{customerCityInput || ""}</div>
            </div>
            <div className="flex">
              <div className="w-32">State</div>
              <div className="flex-1">{customerStateInput || ""}</div>
            </div>
            <div className="flex">
              <div className="w-32">Country</div>
              <div className="flex-1">{customerCountryInput || ""}</div>
            </div>
          </div>
          <div className="text-right"></div>
        </div>
        <div className="mb-2" style={{ width: "100%", overflow: "visible" }}>
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
              {items.map((i) => (
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
            <div className="rounded-md bg-gray-100 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between text-[30px] font-semibold text-slate-700">
                <span>Subtotal:</span>
                <span>{calcAggregates().netSub.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[30px] font-semibold text-slate-700">
                <span>Total Discount:</span>
                <span>{calcAggregates().discountTotal.toFixed(2)}</span>
              </div>
              {calcAggregates().components.length > 0 &&
                calcAggregates().components.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between text-[24px] text-slate-600"
                  >
                    <span>{c.name}</span>
                    <span>{c.amount.toFixed(2)}</span>
                  </div>
                ))}
              <div className="flex items-center justify-between text-[34px] font-bold text-slate-800 pt-1">
                <span>Total Tax:</span>
                <span>{calcAggregates().taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[38px] font-bold text-slate-900 pt-1">
                <span>Grand Total:</span>
                <span>{calcAggregates().grand.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center text-sm">
          THANK YOU FOR YOUR BUSINESS!
        </div>
      </div>
    </div>
  );
}
