/**
 * @fileoverview PriceSetup component.
 * Provides functionality for PriceSetup.
 */

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { api } from "../../../../api/client";
import { toast } from "react-toastify";
import { filterByPrefix } from "@/utils/searchUtils.js";
import "./PriceSetup.css";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PriceSetup() {
  const [activeTab, setActiveTab] = useState("standard");
  const [sellingView, setSellingView] = useState("picker");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [priceTypes, setPriceTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(""); // 'standard', 'customer'
  const [selectedItem, setSelectedItem] = useState(null);
  const fileInputRef = React.useRef(null);

  // Customer price type selector
  const [showPriceTypeSelector, setShowPriceTypeSelector] = useState(false);

  // Bulk price % state
  const [itemGroups, setItemGroups] = useState([]);
  const [customerModalSubType, setCustomerModalSubType] = useState("single");
  const [bulkCustomerId, setBulkCustomerId] = useState("");
  const [bulkGroupId, setBulkGroupId] = useState("");
  const [bulkPriceTypeId, setBulkPriceTypeId] = useState("");
  const [bulkPercentage, setBulkPercentage] = useState("");
  const [bulkOperator, setBulkOperator] = useState("+");
  const [bulkSelectedItems, setBulkSelectedItems] = useState([]);
  const [bulkFilteredItems, setBulkFilteredItems] = useState([]);
  const [bulkSelectAll, setBulkSelectAll] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    product: "",
    customer: "",
    category: "",
  });

  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Form states
  const [formData, setFormData] = useState({});
  const [productQuery, setProductQuery] = useState("");
  const [showProductResults, setShowProductResults] = useState(false);
  const [section, setSection] = useState("selector");
  const [costData, setCostData] = useState([]);
  const [costLoading, setCostLoading] = useState(false);
  const [costModalOpen, setCostModalOpen] = useState(false);
  const [costFormData, setCostFormData] = useState({});
  const [costProductQuery, setCostProductQuery] = useState("");
  const [showCostProductResults, setShowCostProductResults] = useState(false);
  const costFileInputRef = React.useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadTabData();
  }, [activeTab, filters]);

  useEffect(() => {
    if (!modalOpen || priceTypes.length === 0 || formData.product_id) return;
    const retailPt = priceTypes.find(
      (pt) =>
        String(pt.name || "").toUpperCase() === "RETAIL" ||
        String(pt.code || "").toUpperCase() === "RETAIL",
    );
    const ghsCurr = currencies.find(
      (c) => String(c.code || "").toUpperCase() === "GHS",
    );
    const today = new Date().toISOString().split("T")[0];
    setFormData((prev) => ({
      ...prev,
      price_type_id: prev.price_type_id || (retailPt ? retailPt.id : ""),
      currency_id: prev.currency_id || (ghsCurr ? ghsCurr.id : ""),
      effective_date: prev.effective_date || today,
      effective_from: prev.effective_from || today,
    }));
  }, [priceTypes, currencies, modalOpen]);

  useEffect(() => {
    if (section === "cost") loadCostData();
  }, [section]);

  // Filter products by selected group for bulk tool
  useEffect(() => {
    const groupId = Number(bulkGroupId);
    if (groupId) {
      setBulkFilteredItems(
        products.filter((p) => Number(p.item_group_id) === groupId),
      );
    } else {
      setBulkFilteredItems([]);
    }
    setBulkSelectedItems([]);
    setBulkSelectAll(false);
  }, [bulkGroupId, products]);

  // Sync bulkSelectAll
  useEffect(() => {
    if (bulkSelectAll && bulkFilteredItems.length) {
      setBulkSelectedItems(bulkFilteredItems.map((p) => p.id));
    } else if (!bulkSelectAll) {
      setBulkSelectedItems([]);
    }
  }, [bulkSelectAll, bulkFilteredItems]);

  const loadInitialData = async () => {
    try {
      console.log("Loading initial data...");
      const [productsRes, customersRes, priceTypesRes, currenciesRes, groupsRes] =
        await Promise.all([
          api.get("/inventory/items"),
          api.get("/sales/customers", { params: { active: "true" } }),
          api.get("/sales/price-types"),
          api.get("/finance/currencies"),
          api.get("/inventory/item-groups"),
        ]);

      console.log("Products loaded:", productsRes.data);
      console.log("Customers loaded:", customersRes.data);
      console.log("Price Types loaded:", priceTypesRes.data);
      console.log("Currencies loaded:", currenciesRes.data);

      setProducts(productsRes.data.items || []);
      setCustomers(customersRes.data.items || []);
      const ptItems = priceTypesRes.data.items || [];
      setPriceTypes(ptItems);
      const currItems = currenciesRes.data.items || [];
      setCurrencies(currItems);
      setItemGroups(groupsRes.data.items || []);
    } catch (err) {
      console.error("Error loading initial data:", err);
    }
  };

  const loadCostData = async () => {
    setCostLoading(true);
    try {
      const res = await api.get("/inventory/items");
      setCostData(res.data.items || []);
    } catch (err) {
      console.error("Error loading cost data:", err);
    } finally {
      setCostLoading(false);
    }
  };

  const loadTabData = async () => {
    setLoading(true);
    try {
      let endpoint = "";
      let params = {};
      switch (activeTab) {
        case "standard":
          endpoint = "/sales/prices/standard";
          break;
        case "customer":
          endpoint = "/sales/prices/customer";
          if (filters.customer) params.customer_id = filters.customer;
          break;
        default:
          return;
      }
      const res = await api.get(endpoint, { params });
      const items = Array.isArray(res.data) ? res.data : res.data.items || [];
      setData(items);
    } catch (err) {
      console.error("Error loading tab data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortedData = (items) => {
    if (!sortConfig.key) return items;
    const sorted = [...items];
    sorted.sort((a, b) => {
      let aVal, bVal;
      if (sortConfig.key === "product") {
        const aProd = products.find((p) => p.id === a.product_id);
        const bProd = products.find((p) => p.id === b.product_id);
        aVal = (aProd ? aProd.item_name : "").toLowerCase();
        bVal = (bProd ? bProd.item_name : "").toLowerCase();
      } else if (sortConfig.key === "customer") {
        const aCust = customers.find((c) => c.id === a.customer_id);
        const bCust = customers.find((c) => c.id === b.customer_id);
        aVal = (aCust ? aCust.customer_name : "").toLowerCase();
        bVal = (bCust ? bCust.customer_name : "").toLowerCase();
      } else if (sortConfig.key === "price_type") {
        const apt = priceTypes.find((pt) => pt.id === a.price_type_id);
        const bpt = priceTypes.find((pt) => pt.id === b.price_type_id);
        aVal = (apt ? apt.name : "").toLowerCase();
        bVal = (bpt ? bpt.name : "").toLowerCase();
      } else if (sortConfig.key === "currency") {
        const ac = currencies.find((c) => c.id === a.currency_id);
        const bc = currencies.find((c) => c.id === b.currency_id);
        aVal = (ac ? ac.code : "").toLowerCase();
        bVal = (bc ? bc.code : "").toLowerCase();
      } else {
        aVal = a[sortConfig.key];
        bVal = b[sortConfig.key];
      }
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";
      if (typeof aVal === "string") {
        return sortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  };

  const handleDownloadTemplate = () => {
    let headers = [];
    let filename = "";
    let rows = [];
    if (activeTab === "standard") {
      headers = [
        "Item Code",
        "Item Name",
        "Group Name",
        "Cost Price",
        "Selling Price",
        "Margin %",
        "Effective Date (YYYY-MM-DD)",
        "Price Type",
        "UOM",
        "Currency Name",
      ];
      filename = "standard_prices_template.xlsx";
      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      rows = data.map((item) => {
        const product = products.find((p) => p.id === item.product_id);
        const priceType = priceTypes.find((pt) => pt.id === item.price_type_id);
        const prodCurrency = product
          ? currencies.find((c) => c.id === product.currency_id) ||
            currencies.find(
              (c) =>
                String(c.code || "").toUpperCase() ===
                String(product.currency_code || "").toUpperCase(),
            ) ||
            currencies.find(
              (c) =>
                String(c.name || "").toUpperCase() ===
                String(product.currency_name || "").toUpperCase(),
            )
          : null;
        const uom =
          item.uom || (product && (product.uom || product.default_uom)) || "";
        const groupName =
          (product &&
            (product.group_name ||
              product.group ||
              product.category_name ||
              product.category)) ||
          "";
        const costPrice =
          item.cost_price ??
          (product &&
            (product.standard_cost ||
              product.cost_price ||
              product.purchase_price)) ??
          "";
        return [
          product ? product.item_code : "",
          product ? product.item_name : "",
          groupName,
          costPrice,
          "",
          "",
          todayStr,
          priceType ? priceType.name : "",
          uom,
          prodCurrency ? prodCurrency.name : product?.currency_name || "",
        ];
      });
    } else {
      headers = [
        "Customer Name",
        "Item Code",
        "Item Name",
        "Group Name",
        "Standard Price",
        "Customer Price",
        "Discount %",
        "Min Quantity",
        "Effective From (YYYY-MM-DD)",
        "Effective To (YYYY-MM-DD)",
        "Price Type",
        "UOM",
        "Currency Name",
      ];
      filename = "customer_prices_template.xlsx";
      rows = data.map((item) => {
        const product = products.find((p) => p.id === item.product_id);
        const customer = customers.find((c) => c.id === item.customer_id);
        const priceType = priceTypes.find((pt) => pt.id === item.price_type_id);
        const prodCurrency = product
          ? currencies.find((c) => c.id === product.currency_id) ||
            currencies.find(
              (c) =>
                String(c.code || "").toUpperCase() ===
                String(product.currency_code || "").toUpperCase(),
            ) ||
            currencies.find(
              (c) =>
                String(c.name || "").toUpperCase() ===
                String(product.currency_name || "").toUpperCase(),
            )
          : null;
        const uom =
          item.uom || (product && (product.uom || product.default_uom)) || "";
        const groupName =
          (product &&
            (product.group_name ||
              product.group ||
              product.category_name ||
              product.category)) ||
          "";
        return [
          customer ? customer.customer_name : "",
          product ? product.item_code : "",
          product ? product.item_name : "",
          groupName,
          item.standard_price,
          item.customer_price,
          item.discount_percent,
          item.min_quantity,
          item.effective_from ? item.effective_from.split("T")[0] : "",
          item.effective_to ? item.effective_to.split("T")[0] : "",
          priceType ? priceType.name : "",
          uom,
          prodCurrency ? prodCurrency.name : product?.currency_name || "",
        ];
      });
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    if (activeTab === "standard") {
      const totalRows = rows.length;
      for (let r = 2; r <= totalRows + 1; r++) {
        const addr = `F${r}`;
        // Keep blank unless both D and E are valid numbers > 0
        // Use N() to coerce non-numeric to 0 to avoid #VALUE!
        const formula = `IF(AND(N(E${r})>0,N(D${r})>=0),ROUND((E${r}-D${r})/E${r}*100,2),"")`;
        ws[addr] = { f: formula };
      }
    }
    try {
      const allRows = [headers, ...rows];
      const colCount = headers.length;
      const widths = [];
      for (let c = 0; c < colCount; c++) {
        let maxLen = String(headers[c] || "").length;
        for (let r = 0; r < rows.length; r++) {
          const val = allRows[r + 1]?.[c];
          const s =
            val == null
              ? ""
              : typeof val === "number"
                ? String(val)
                : String(val);
          if (s.length > maxLen) maxLen = s.length;
        }
        widths.push({ wch: Math.min(Math.max(maxLen + 2, 12), 40) });
      }
      ws["!cols"] = widths;
    } catch {}
    const wb = XLSX.utils.book_new();
    try {
      wb.Workbook = wb.Workbook || {};
      wb.Workbook.CalcPr = { fullCalcOnLoad: true };
    } catch {}
    XLSX.utils.book_append_sheet(wb, ws, "Prices");
    XLSX.writeFile(wb, filename);
  };

  const handleCostDownloadTemplate = () => {
    const headers = [
      "Item Code",
      "Item Name",
      "Current Cost Price",
      "New Cost Price",
    ];
    const filename = "cost_prices_template.xlsx";
    const rows = costData.map((item) => [
      item.item_code || "",
      item.item_name || "",
      Number(item.cost_price || 0).toFixed(2),
      "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    try {
      const colCount = headers.length;
      const widths = [];
      for (let c = 0; c < colCount; c++) {
        let maxLen = String(headers[c] || "").length;
        for (let r = 0; r < rows.length; r++) {
          const val = rows[r]?.[c];
          const s = val == null ? "" : String(val);
          if (s.length > maxLen) maxLen = s.length;
        }
        widths.push({ wch: Math.min(Math.max(maxLen + 2, 12), 40) });
      }
      ws["!cols"] = widths;
    } catch {}
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cost Prices");
    XLSX.writeFile(wb, filename);
  };

  const handleExportStandardPrices = async () => {
    try {
      const res = await api.get("/sales/prices/standard");
      const exportData = Array.isArray(res.data) ? res.data : res.data.items || [];

      const wb = XLSX.utils.book_new();
      const grouped = {};
      exportData.forEach((item) => {
        const ptName = item.price_type_name || "Uncategorized";
        if (!grouped[ptName]) grouped[ptName] = [];
        grouped[ptName].push(item);
      });

      if (Object.keys(grouped).length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([["Item Code", "Item Name", "Currency", "UOM", "Selling Price"]]);
        XLSX.utils.book_append_sheet(wb, ws, "Standard Prices");
      } else {
        Object.keys(grouped).forEach((ptName) => {
          const items = grouped[ptName];
          const rows = items.map((item) => {
            const currency = currencies.find((c) => c.id === item.currency_id);
            const currencyName = currency ? currency.code : item.currency_id || "-";
            const uom = item.uom || item.default_uom || "-";

            return [
              item.item_code || "",
              item.item_name || `Product ${item.product_id}`,
              currencyName,
              uom,
              Number(item.selling_price).toFixed(2),
            ];
          });
          const ws = XLSX.utils.aoa_to_sheet([["Item Code", "Item Name", "Currency", "UOM", "Selling Price"], ...rows]);
          let validName = ptName.replace(/[/\\?*:[\]]/g, "_").substring(0, 31);
          if (!validName) validName = "Sheet";
          XLSX.utils.book_append_sheet(wb, ws, validName);
        });
      }

      XLSX.writeFile(wb, "standard_prices_export.xlsx");
    } catch (err) {
      console.error("Export failed", err);
      alert("Export failed: " + (err.response?.data?.message || err.message));
    }
  };

  const handleExportCostPrices = () => {
    const headers = ["Item Code", "Item Name", "Currency", "UOM", "Cost Price"];
    const rows = costData.map((item) => {
      const currency = currencies.find((c) => c.id === item.currency_id) ||
        currencies.find((c) => String(c.code || "").toUpperCase() === String(item.currency_code || "").toUpperCase()) ||
        currencies.find((c) => String(c.name || "").toUpperCase() === String(item.currency_name || "").toUpperCase());

      const currencyName = currency ? currency.code : item.currency_name || item.currency_code || "-";
      const uom = item.uom || item.default_uom || "-";

      return [
        item.item_code || "",
        item.item_name || "",
        currencyName,
        uom,
        Number(item.cost_price || 0).toFixed(2),
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cost Prices");
    XLSX.writeFile(wb, "cost_prices_export.xlsx");
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const items = XLSX.utils.sheet_to_json(sheet);

        if (items.length === 0) {
          toast.warn("File is empty or invalid format");
          return;
        }

        const endpoint =
          activeTab === "standard"
            ? "/sales/prices/bulk/standard"
            : "/sales/prices/bulk/customer";
        await api.post(endpoint, { items });
        toast.success("✅ Prices uploaded successfully!");
        loadTabData();
      } catch (err) {
        console.error("Upload failed", err);
        toast.error("Upload failed: " + (err.response?.data?.message || err.message));
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleOpenCostUpload = () => {
    costFileInputRef.current.click();
  };

  const handleCostFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const items = XLSX.utils.sheet_to_json(sheet);
        if (items.length === 0) {
          toast.warn("File is empty or invalid format");
          return;
        }
        const res = await api.post("/inventory/items/cost-prices/bulk", {
          items,
        });
        toast.success(
          `✅ Cost prices uploaded! ${res.data.updated} updated, ${res.data.notFound} not found.`,
        );
        loadCostData();
      } catch (err) {
        console.error("Upload failed", err);
        toast.error("Upload failed: " + (err.response?.data?.message || err.message));
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleOpenModal = (type, item = null) => {
    setModalType(type);
    setSelectedItem(item);
    setCustomerModalSubType("single");
    setBulkCustomerId("");
    setBulkGroupId("");
    setBulkPriceTypeId("");
    setBulkPercentage("");
    setBulkOperator("+");
    setBulkSelectedItems([]);
    setBulkFilteredItems([]);
    setBulkSelectAll(false);
    const today = new Date().toISOString().split("T")[0];
    const retailPt = priceTypes.find(
      (pt) =>
        String(pt.name || "").toUpperCase() === "RETAIL" ||
        String(pt.code || "").toUpperCase() === "RETAIL",
    );
    const ghsCurr = currencies.find(
      (c) => String(c.code || "").toUpperCase() === "GHS",
    );
    const defaults = {
      price_type_id: retailPt ? retailPt.id : "",
      currency_id: ghsCurr ? ghsCurr.id : "",
      effective_date: today,
      effective_from: today,
      effective_to: "",
    };
    setFormData(item ? { ...item } : defaults);
    setProductQuery("");
    setShowProductResults(false);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedItem(null);
    setFormData({});
    setProductQuery("");
    setShowProductResults(false);
    setBulkCustomerId("");
    setBulkGroupId("");
    setBulkPriceTypeId("");
    setBulkPercentage("");
    setBulkOperator("+");
    setBulkSelectedItems([]);
    setBulkFilteredItems([]);
    setBulkSelectAll(false);
  };

  const handleSave = async () => {
    try {
      let endpoint = "";
      const payload = { ...formData };

      // Ensure margin_percent is consistent with cost & selling if both provided
      const cpN = Number(payload.cost_price);
      const spN = Number(payload.selling_price);
      if (Number.isFinite(cpN) && Number.isFinite(spN) && spN > 0 && cpN >= 0) {
        payload.margin_percent = Number((((spN - cpN) / spN) * 100).toFixed(2));
      } else if (!payload.margin_percent) {
        payload.margin_percent = 0;
      }

      // Sanitize numeric fields
      const numericFields = [
        "product_id",
        "customer_id",
        "cost_price",
        "selling_price",
        "margin_percent",
        "standard_price",
        "customer_price",
        "discount_percent",
        "min_quantity",
        "max_quantity",
        "unit_price",
        "price_type_id",
        "currency_id",
      ];

      numericFields.forEach((field) => {
        if (
          payload[field] !== undefined &&
          payload[field] !== null &&
          payload[field] !== ""
        ) {
          payload[field] = Number(payload[field]);
        } else if (
          [
            "cost_price",
            "selling_price",
            "customer_price",
            "unit_price",
          ].includes(field)
        ) {
          // Default required numeric fields to 0 if empty
          if (payload[field] === "" || payload[field] === undefined)
            payload[field] = 0;
        } else {
          // Default optional numeric fields to null if empty
          if (payload[field] === "") payload[field] = null;
        }
      });

      // Sanitize date fields
      const dateFields = ["effective_date", "effective_from", "effective_to"];
      dateFields.forEach((field) => {
        if (payload[field] === "") payload[field] = null;
      });

      switch (modalType) {
        case "standard":
          endpoint = "/sales/prices/standard";
          break;
        case "customer":
          endpoint = "/sales/prices/customer";
          break;
        default:
          return;
      }

      if (
        modalType === "standard" &&
        (payload.price_type_id == null || payload.price_type_id === "")
      ) {
        alert(
          "Select a price type (e.g. Retail or Wholesale) so this price is saved for that price list.",
        );
        return;
      }

      await api.post(endpoint, payload);
      handleCloseModal();
      loadTabData();
    } catch (err) {
      console.error("Error saving data:", err);
      alert(
        "Failed to save data: " + (err.response?.data?.message || err.message),
      );
    }
  };

  const handleOpenCostModal = () => {
    setCostFormData({ cost_price: "" });
    setCostProductQuery("");
    setShowCostProductResults(false);
    setCostModalOpen(true);
  };

  const handleCloseCostModal = () => {
    setCostModalOpen(false);
    setCostFormData({});
    setCostProductQuery("");
    setShowCostProductResults(false);
  };

  const handleCostProductSelect = (productId) => {
    const product = products.find((p) => p.id == productId);
    setCostProductQuery(product ? product.item_name : "");
    setShowCostProductResults(false);
    setCostFormData((prev) => ({
      ...prev,
      item_id: productId,
      current_cost: product ? Number(product.cost_price || 0).toFixed(2) : "",
    }));
  };

  const handleCostSave = async () => {
    try {
      const itemId = Number(costFormData.item_id);
      const costPrice = Number(costFormData.cost_price);
      if (!itemId) {
        toast.warn("Select a product");
        return;
      }
      if (!Number.isFinite(costPrice) || costPrice < 0) {
        toast.warn("Enter a valid cost price");
        return;
      }
      await api.post("/inventory/items/cost-price", {
        item_id: itemId,
        cost_price: costPrice,
      });
      toast.success("✅ Cost price saved successfully!");
      handleCloseCostModal();
      loadCostData();
    } catch (err) {
      console.error("Error saving cost price:", err);
      toast.error("Failed to save: " + (err.response?.data?.message || err.message));
    }
  };

  const handleBulkApply = async () => {
    const customerId = Number(bulkCustomerId);
    const priceTypeId = Number(bulkPriceTypeId);
    const pct = Number(bulkPercentage);
    if (!customerId) return alert("Select a customer");
    if (!bulkSelectedItems.length) return alert("Select at least one item");
    if (!pct || pct <= 0) return alert("Enter a valid percentage");
    try {
      await api.post("/sales/prices/customer/bulk-percentage", {
        customer_id: customerId,
        price_type_id: priceTypeId || null,
        item_ids: bulkSelectedItems,
        percentage: pct,
        operator: bulkOperator,
      });
      alert("Bulk prices applied successfully");
      setBulkSelectedItems([]);
      setBulkSelectAll(false);
      loadTabData();
    } catch (err) {
      console.error("Bulk apply failed", err);
      alert("Failed: " + (err.response?.data?.message || err.message));
    }
  };

  const renderStandardPrices = (tableData) => (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleSort("product")}>
              Product {sortConfig.key === "product" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("cost_price")}>
              Cost Price {sortConfig.key === "cost_price" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("selling_price")}>
              Selling Price {sortConfig.key === "selling_price" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("margin_percent")}>
              Margin % {sortConfig.key === "margin_percent" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("effective_date")}>
              Effective Date {sortConfig.key === "effective_date" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("price_type")}>
              Price Type {sortConfig.key === "price_type" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("uom")}>
              UOM {sortConfig.key === "uom" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("currency")}>
              Currency {sortConfig.key === "currency" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((item, index) => {
            const product = products.find((p) => p.id === item.product_id);
            const priceType = priceTypes.find(
              (pt) => pt.id === item.price_type_id,
            );
            const priceTypeLabel =
              item.price_type_name || (priceType ? priceType.name : null);
            const currency = currencies.find((c) => c.id === item.currency_id);
            return (
              <tr key={index}>
                <td>{product ? product.item_name : item.product_id}</td>
                <td>{Number(item.cost_price).toFixed(2)}</td>
                <td>{Number(item.selling_price).toFixed(2)}</td>
                <td>{Number(item.margin_percent).toFixed(2)}%</td>
                <td>{new Date(item.effective_date).toLocaleDateString()}</td>
                <td>{priceTypeLabel || "-"}</td>
                <td>{item.uom || "-"}</td>
                <td>
                  {currency
                    ? `${currency.code} - ${currency.name}`
                    : item.currency_id || "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderCustomerPrices = (tableData) => (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleSort("customer")}>
              Customer {sortConfig.key === "customer" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("product")}>
              Product {sortConfig.key === "product" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("standard_price")}>
              Standard Price {sortConfig.key === "standard_price" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("customer_price")}>
              Customer Price {sortConfig.key === "customer_price" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("discount_percent")}>
              Discount % {sortConfig.key === "discount_percent" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("price_type")}>
              Price Type {sortConfig.key === "price_type" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("uom")}>
              UOM {sortConfig.key === "uom" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
            <th className="sortable" onClick={() => handleSort("currency")}>
              Currency {sortConfig.key === "currency" ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((item, index) => {
            const customer = customers.find((c) => c.id === item.customer_id);
            const product = products.find((p) => p.id === item.product_id);
            const priceType = priceTypes.find(
              (pt) => pt.id === item.price_type_id,
            );
            const currency = currencies.find((c) => c.id === item.currency_id);
            return (
              <tr key={index}>
                <td>{customer ? customer.customer_name : item.customer_id}</td>
                <td>{product ? product.item_name : item.product_id}</td>
                <td>{Number(item.standard_price).toFixed(2)}</td>
                <td>{Number(item.customer_price).toFixed(2)}</td>
                <td>{Number(item.discount_percent).toFixed(2)}%</td>
                <td>{priceType ? priceType.name : "-"}</td>
                <td>{item.uom || "-"}</td>
                <td>
                  {currency
                    ? `${currency.code} - ${currency.name}`
                    : item.currency_id || "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderCostTable = () => (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>Group</th>
            <th>Current Cost Price</th>
          </tr>
        </thead>
        <tbody>
          {costData.map((item, index) => {
            const groupName = item.group_name || item.category_name || "";
            return (
              <tr key={index}>
                <td>{item.item_code}</td>
                <td>{item.item_name}</td>
                <td>{groupName || "-"}</td>
                <td>{Number(item.cost_price || 0).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const handleProductChange = (productId) => {
    const product = products.find((p) => p.id == productId);
    setShowProductResults(false);
    if (product) {
      const today = new Date().toISOString().split("T")[0];
      setFormData((prev) => ({
        ...prev,
        product_id: productId,
        uom: product.uom || product.default_uom || product.uom_code || "",
        cost_price:
          product.cost_price ||
          product.standard_cost ||
          product.purchase_price ||
          0,
        standard_price: product.selling_price || 0,
        currency_id: product.currency_id,
        price_type_id: product.price_type_id || prev.price_type_id,
        effective_from: today,
        effective_to: "",
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        product_id: productId,
      }));
    }
  };

  const renderModalContent = () => {
    if (modalType === "standard") {
      return (
        <div className="form-grid">
          <div className="form-group">
            <label className="required">Product</label>
            <div className="relative">
              <input
                id="price-setup-product-search-standard"
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="Type to search products"
                value={productQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setProductQuery(val);
                  setShowProductResults(true);
                  if (!val && formData.product_id) {
                    setFormData((prev) => ({
                      ...prev,
                      product_id: "",
                    }));
                  }
                }}
                onFocus={() => setShowProductResults(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const query = productQuery.trim();
                    const results = query
                      ? filterByPrefix(products, {
                          query,
                          searchFields: ["item_code", "item_name", "barcode"],
                        })
                      : [];
                    if (!query || !results.length) return;
                    handleProductChange(results[0].id);
                    const prod = products.find((p) => p.id === results[0].id);
                    setProductQuery(prod ? prod.item_name : "");
                    setShowProductResults(false);
                  }
                }}
              />
              {(() => {
                const query = productQuery.trim();
                const results = query
                  ? filterByPrefix(products, {
                      query,
                      searchFields: ["item_code", "item_name", "barcode"],
                    })
                  : [];
                return showProductResults && results.length
                  ? (() => {
                      const el = document.getElementById(
                        "price-setup-product-search-standard",
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
                              className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                              onClick={() => {
                                handleProductChange(o.id);
                                const prod = products.find(
                                  (p) => p.id === o.id,
                                );
                                setProductQuery(prod ? prod.item_name : "");
                                setShowProductResults(false);
                              }}
                            >
                              {o.item_name}
                            </button>
                          ))}
                        </div>
                      );
                    })()
                  : null;
              })()}
            </div>
          </div>
          <div className="form-group">
            <label className="required">Price type</label>
            <select
              value={formData.price_type_id || ""}
              onChange={(e) =>
                setFormData({ ...formData, price_type_id: e.target.value })
              }
            >
              <option value="">Select price type</option>
              {priceTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>UOM</label>
            <input
              type="text"
              value={formData.uom || ""}
              onChange={(e) =>
                setFormData({ ...formData, uom: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Currency</label>
            <select
              value={formData.currency_id || ""}
              onChange={(e) =>
                setFormData({ ...formData, currency_id: e.target.value })
              }
            >
              <option value="">Select Currency</option>
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="required">Cost Price</label>
            <input
              type="number"
              step="0.01"
              value={formData.cost_price || ""}
              onChange={(e) => {
                const cp = Number(e.target.value || 0);
                const sp = Number(formData.selling_price || 0);
                const both = cp > 0 && sp > 0;
                const mp = both
                  ? Number(((sp - cp) / sp) * 100).toFixed(2)
                  : "";
                setFormData({
                  ...formData,
                  cost_price: e.target.value,
                  margin_percent: mp === "" ? "" : Number(mp),
                });
              }}
            />
          </div>
          <div className="form-group">
            <label className="required">Selling Price</label>
            <input
              type="number"
              step="0.01"
              value={formData.selling_price || ""}
              onChange={(e) => {
                const sp = Number(e.target.value || 0);
                const cp = Number(formData.cost_price || 0);
                const both = cp > 0 && sp > 0;
                const mp = both ? Number(((sp - cp) / sp) * 100) : "";
                setFormData({
                  ...formData,
                  selling_price: e.target.value,
                  margin_percent: mp === "" ? "" : Number(mp.toFixed(2)),
                });
              }}
            />
          </div>
          <div className="form-group">
            <label>Margin %</label>
            <input
              type="number"
              step="0.01"
              value={
                Number(formData.selling_price || 0) > 0 &&
                Number(formData.cost_price || 0) > 0
                  ? Number(
                      ((Number(formData.selling_price || 0) -
                        Number(formData.cost_price || 0)) /
                        Number(formData.selling_price || 0)) *
                        100,
                    ).toFixed(2)
                  : ""
              }
              readOnly
            />
          </div>
          <div className="form-group">
            <label className="required">Effective Date</label>
            <input
              type="date"
              value={
                formData.effective_date
                  ? formData.effective_date.split("T")[0]
                  : ""
              }
              onChange={(e) =>
                setFormData({ ...formData, effective_date: e.target.value })
              }
            />
          </div>
        </div>
      );
    } else if (modalType === "customer") {
      if (customerModalSubType === "single") {
        const selectedProduct = formData.product_id
          ? products.find((p) => p.id == formData.product_id)
          : null;
        return (
          <div className="form-grid">
            <div className="form-group">
              <label className="required">Customer</label>
              <select
                value={formData.customer_id || ""}
                onChange={(e) =>
                  setFormData({ ...formData, customer_id: e.target.value })
                }
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="required">Product</label>
              <div className="relative">
                <input
                  id="price-setup-product-search-customer"
                  autoComplete="off"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Type to search products"
                  value={productQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProductQuery(val);
                    setShowProductResults(true);
                    if (!val && formData.product_id) {
                      setFormData((prev) => ({
                        ...prev,
                        product_id: "",
                      }));
                    }
                  }}
                  onFocus={() => setShowProductResults(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const query = productQuery.trim();
                      const results = query
                        ? filterByPrefix(products, {
                            query,
                            searchFields: ["item_code", "item_name", "barcode"],
                          })
                        : [];
                      if (!query || !results.length) return;
                      handleProductChange(results[0].id);
                      const prod = products.find((p) => p.id === results[0].id);
                      setProductQuery(prod ? prod.item_name : "");
                      setShowProductResults(false);
                    }
                  }}
                />
                {(() => {
                  const query = productQuery.trim();
                  const results = query
                    ? filterByPrefix(products, {
                        query,
                        searchFields: ["item_code", "item_name", "barcode"],
                      })
                    : [];
                  return showProductResults && results.length
                    ? (() => {
                        const el = document.getElementById(
                          "price-setup-product-search-customer",
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
                                className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                                onClick={() => {
                                  handleProductChange(o.id);
                                  const prod = products.find(
                                    (p) => p.id === o.id,
                                  );
                                  setProductQuery(prod ? prod.item_name : "");
                                  setShowProductResults(false);
                                }}
                              >
                                {o.item_name}
                              </button>
                            ))}
                          </div>
                        );
                      })()
                    : null;
                })()}
              </div>
              {selectedProduct && (
                <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                  <div>Code: <span className="font-medium">{selectedProduct.item_code}</span></div>
                  <div>Selling Price: <span className="font-medium">GHS {Number(selectedProduct.selling_price || 0).toFixed(2)}</span></div>
                  <div>UOM: <span className="font-medium">{selectedProduct.uom || selectedProduct.default_uom || "-"}</span></div>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Price Type</label>
              <select
                value={formData.price_type_id || ""}
                onChange={(e) =>
                  setFormData({ ...formData, price_type_id: e.target.value })
                }
              >
                <option value="">Select Price Type</option>
                {priceTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name}
                  </option>
                ))}
              </select>
            </div>
          <div className="form-group">
            <label className="required">Customer Price</label>
            <input
              type="number"
              value={formData.customer_price || ""}
              onChange={(e) =>
                setFormData({ ...formData, customer_price: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Effective To</label>
            <input
              type="date"
              value={
                formData.effective_to ? formData.effective_to.split("T")[0] : ""
              }
              onChange={(e) =>
                setFormData({ ...formData, effective_to: e.target.value })
              }
            />
          </div>
        </div>
      );
      } else {
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="form-group">
                <label className="required">Customer</label>
                <select
                  value={bulkCustomerId}
                  onChange={(e) => setBulkCustomerId(e.target.value)}
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Item Group</label>
                <select
                  value={bulkGroupId}
                  onChange={(e) => setBulkGroupId(e.target.value)}
                >
                  <option value="">All Groups</option>
                  {itemGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.group_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Price Type</label>
                <select
                  value={bulkPriceTypeId}
                  onChange={(e) => setBulkPriceTypeId(e.target.value)}
                >
                  <option value="">Select Price Type</option>
                  {priceTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="required">Percentage</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bulkPercentage}
                    onChange={(e) => setBulkPercentage(e.target.value)}
                    className="flex-1"
                    placeholder="e.g. 10"
                  />
                  <span className="text-sm text-gray-500 self-center">%</span>
                  <select
                    value={bulkOperator}
                    onChange={(e) => setBulkOperator(e.target.value)}
                    className="w-16"
                  >
                    <option value="+">+</option>
                    <option value="-">-</option>
                  </select>
                </div>
              </div>
            </div>
            {bulkFilteredItems.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Select Items
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={bulkSelectAll}
                      onChange={(e) => setBulkSelectAll(e.target.checked)}
                    />
                    Select All ({bulkFilteredItems.length} items)
                  </label>
                  <span className="text-xs text-gray-400">
                    {bulkSelectedItems.length} selected
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {bulkFilteredItems.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={bulkSelectedItems.includes(item.id)}
                        onChange={() => {
                          setBulkSelectedItems((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((id) => id !== item.id)
                              : [...prev, item.id],
                          );
                          setBulkSelectAll(false);
                        }}
                      />
                      <span>{item.item_name}</span>
                      <span className="text-gray-400 text-xs ml-auto">
                        {item.item_code} | GHS {Number(item.selling_price || 0).toFixed(2)}
                        {bulkPercentage && (
                          <span className="ml-2 font-semibold text-gray-700">
                            → GHS{" "}
                            {(() => {
                              const sp = Number(item.selling_price || 0);
                              const pct = Number(bulkPercentage || 0);
                              const adj = sp * (pct / 100);
                              const np = bulkOperator === "-" ? sp - adj : sp + adj;
                              return np.toFixed(2);
                            })()}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {!bulkGroupId && (
              <p className="text-xs text-gray-400 italic">
                Select an Item Group to view and select items
              </p>
            )}
          </div>
        );
      }
    }
  };

  const renderCostModalContent = () => (
    <div className="form-grid">
      <div className="form-group">
        <label className="required">Product</label>
        <div className="relative">
          <input
            autoComplete="off"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="Type to search products"
            value={costProductQuery}
            onChange={(e) => {
              const val = e.target.value;
              setCostProductQuery(val);
              setShowCostProductResults(true);
              if (!val && costFormData.item_id) {
                setCostFormData((prev) => ({
                  ...prev,
                  item_id: "",
                  current_cost: "",
                }));
              }
            }}
            onFocus={() => setShowCostProductResults(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const query = costProductQuery.trim();
                const results = query
                  ? filterByPrefix(products, {
                      query,
                      searchFields: ["item_code", "item_name", "barcode"],
                    })
                  : [];
                if (!query || !results.length) return;
                handleCostProductSelect(results[0].id);
              }
            }}
          />
          {(() => {
            const query = costProductQuery.trim();
            const results = query
              ? filterByPrefix(products, {
                  query,
                  searchFields: ["item_code", "item_name", "barcode"],
                })
              : [];
            return showCostProductResults && results.length ? (
              <div
                className="bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-auto"
                style={{ position: "fixed", zIndex: 9999, minWidth: "280px" }}
              >
                {results.map((o) => (
                  <button
                    type="button"
                    key={o.id}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                    onClick={() => handleCostProductSelect(o.id)}
                  >
                    {o.item_name}
                  </button>
                ))}
              </div>
            ) : null;
          })()}
        </div>
      </div>
      {costFormData.current_cost !== undefined && (
        <div className="form-group">
          <label>Current Cost Price</label>
          <input
            type="text"
            value={costFormData.current_cost || "0.00"}
            readOnly
            className="bg-gray-100"
          />
        </div>
      )}
      <div className="form-group">
        <label className="required">New Cost Price</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={costFormData.cost_price || ""}
          onChange={(e) =>
            setCostFormData((prev) => ({ ...prev, cost_price: e.target.value }))
          }
        />
      </div>
    </div>
  );

  return (
    <div className="price-setup-container">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept=".csv, .xlsx, .xls"
        onChange={handleFileChange}
      />
      <input
        type="file"
        ref={costFileInputRef}
        style={{ display: "none" }}
        accept=".csv, .xlsx, .xls"
        onChange={handleCostFileChange}
      />

      {section === "selector" && (
        <>
          <div className="flex items-center justify-between px-8 pt-8 pb-2">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-800">
                Price Setup
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Manage standard, customer, and cost pricing
              </p>
            </div>
            <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-800 transition-colors shrink-0"
            >
              ← Back to Menu
            </button>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => {
                  setSection("selling");
                  setSellingView("picker");
                }}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-left"
              >
                <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-emerald-500" />
                <div className="p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">💰</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                      Selling
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">
                      Selling Price Setup
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      Manage standard and customer selling prices, apply
                      discounts, and set price lists
                    </p>
                  </div>
                  <div className="mt-auto pt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                    Open
                    <svg
                      className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setSection("cost")}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-left"
              >
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-blue-500" />
                <div className="p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">📊</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                      Cost
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                      Cost Price Setup
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      Set and update item cost prices individually or via bulk
                      upload
                    </p>
                  </div>
                  <div className="mt-auto pt-2 flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                    Open
                    <svg
                      className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {section !== "selector" && (
        <div className="price-setup-header">
          <h1>
            <span>{section === "selling" ? "💰" : "📊"}</span>
            {section === "selling"
              ? sellingView === "picker"
                ? "Selling Price Setup"
                : sellingView === "standard"
                  ? "Standard Prices"
                  : "Customer Specific Prices"
              : "Cost Price Setup"}
          </h1>
          <div className="header-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (section === "selling" && sellingView !== "picker") {
                  setSellingView("picker");
                } else {
                  setSection("selector");
                }
              }}
            >
              ← Back
            </button>
            {section === "selling" && sellingView !== "picker" ? (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={handleDownloadTemplate}
                >
                  📥 Download Template
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleUploadClick}
                >
                  📤 Upload Prices
                </button>
                {sellingView === "standard" && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleExportStandardPrices}
                  >
                    📤 Export Prices
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    activeTab === "customer"
                      ? setShowPriceTypeSelector(true)
                      : handleOpenModal(activeTab)
                  }
                >
                  ➕ New Price
                </button>
              </>
            ) : section === "cost" ? (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={handleCostDownloadTemplate}
                >
                  📥 Download Template
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleOpenCostUpload}
                >
                  📤 Upload Cost Prices
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleExportCostPrices}
                >
                  📤 Export Cost Prices
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleOpenCostModal}
                >
                  ➕ New Cost
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {section === "selling" && sellingView === "picker" && (
        <div className="content">
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => {
                  setActiveTab("standard");
                  setSellingView("standard");
                }}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-left"
              >
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-amber-500" />
                <div className="p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">💵</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                      Standard
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 group-hover:text-amber-600 transition-colors">
                      Standard Prices
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      View and manage standard selling prices for all products
                    </p>
                  </div>
                  <div className="mt-auto pt-2 flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                    Open
                    <svg
                      className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab("customer");
                  setSellingView("customer");
                }}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-left"
              >
                <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 to-purple-500" />
                <div className="p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">👥</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                      Customer
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 group-hover:text-purple-600 transition-colors">
                      Customer Specific Prices
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      Set and manage customer-specific prices and discounts
                    </p>
                  </div>
                  <div className="mt-auto pt-2 flex items-center gap-1.5 text-sm font-semibold text-purple-600">
                    Open
                    <svg
                      className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {section === "selling" && sellingView !== "picker" && (
        <div className="content">
          {sellingView === "standard" && (
            <div className="tab-content active">
              <div className="filter-section">
                <div className="filter-grid">
                  <div className="form-group">
                    <label>Search Product</label>
                    <input
                      type="text"
                      placeholder="Search by code or name"
                      value={filters.product}
                      onChange={(e) =>
                        setFilters({ ...filters, product: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No standard prices found. Click "New Price" to add one.
                </div>
              ) : (() => {
                const filteredData = filters.product
                  ? data.filter((item) => {
                      const prod = products.find((p) => p.id === item.product_id);
                      if (!prod) return false;
                      const q = filters.product.toLowerCase();
                      return (
                        prod.item_name?.toLowerCase().includes(q) ||
                        prod.item_code?.toLowerCase().includes(q) ||
                        prod.barcode?.toLowerCase().includes(q)
                      );
                    })
                  : data;
                return renderStandardPrices(getSortedData(filteredData));
              })()}
            </div>
          )}

          {sellingView === "customer" && (
            <div className="tab-content active">
              <div className="filter-section">
                <div className="filter-grid">
                  <div className="form-group">
                    <label>Select Customer</label>
                    <select
                      value={filters.customer}
                      onChange={(e) =>
                        setFilters({ ...filters, customer: e.target.value })
                      }
                    >
                      <option value="">All Customers</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.customer_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No customer prices found. Click "New Price" to add one.
                </div>
              ) : (
                renderCustomerPrices(getSortedData(data))
              )}
            </div>
          )}
        </div>
      )}

      {section === "cost" && (
        <div className="content">
          {costLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : costData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No items found. Add items first in the item master.
            </div>
          ) : (
            renderCostTable()
          )}
        </div>
      )}

      {modalOpen && (
        <div className="price-modal-overlay">
          <div className={`price-modal-content ${modalType === "customer" ? "wide" : ""}`}>
            <div className="modal-header">
              <h2>
                {modalType === "standard" && "💰 Standard Price Setup"}
                {modalType === "customer" && "👥 Customer Price Setup"}
              </h2>
              <button className="close-btn" onClick={handleCloseModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">{renderModalContent()}</div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              {modalType === "customer" && customerModalSubType === "bulk" ? (
                <button
                  className="btn btn-primary"
                  onClick={handleBulkApply}
                  disabled={!bulkCustomerId || !bulkSelectedItems.length}
                >
                  Apply
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleSave}>
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showPriceTypeSelector && (
        <div className="price-modal-overlay">
          <div className="price-modal-content" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h2>👥 Customer Price Setup</h2>
              <button
                className="close-btn"
                onClick={() => setShowPriceTypeSelector(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-slate-500 mb-6">
                Choose how you want to set prices for this customer
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setShowPriceTypeSelector(false);
                    handleOpenModal("customer");
                  }}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-left"
                >
                  <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-amber-500" />
                  <div className="p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">💰</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                        Amount
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800 group-hover:text-amber-600 transition-colors">
                        Amount
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Set a specific price for a single item
                      </p>
                    </div>
                    <div className="mt-auto pt-1 flex items-center gap-1 text-sm font-semibold text-amber-600">
                      Open
                      <svg
                        className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowPriceTypeSelector(false);
                    setCustomerModalSubType("bulk");
                    setModalType("customer");
                    setBulkCustomerId("");
                    setBulkGroupId("");
                    setBulkPriceTypeId("");
                    setBulkPercentage("");
                    setBulkOperator("+");
                    setBulkSelectedItems([]);
                    setBulkFilteredItems([]);
                    setBulkSelectAll(false);
                    setModalOpen(true);
                  }}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 text-left"
                >
                  <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 to-purple-500" />
                  <div className="p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">📊</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                        Percentage
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800 group-hover:text-purple-600 transition-colors">
                        Percentage
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Apply a +/- percentage to multiple items at once
                      </p>
                    </div>
                    <div className="mt-auto pt-1 flex items-center gap-1 text-sm font-semibold text-purple-600">
                      Open
                      <svg
                        className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowPriceTypeSelector(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {costModalOpen && (
        <div className="price-modal-overlay">
          <div className="price-modal-content" style={{ maxWidth: "600px" }}>
            <div className="modal-header">
              <h2>📊 Set Cost Price</h2>
              <button className="close-btn" onClick={handleCloseCostModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">{renderCostModalContent()}</div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={handleCloseCostModal}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCostSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
