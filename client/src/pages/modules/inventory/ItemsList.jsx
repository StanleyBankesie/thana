/**
 * @fileoverview Main item listing page for the Inventory module.
 * Provides a paginated, filterable, and sortable table of all inventory items,
 * along with bulk operations like excel export.
 */

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "../../../api/client";
import { filterAndSort } from "@/utils/searchUtils.js";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { autosizeWorksheetColumns } from "../../../utils/xlsxUtils";
import SortableHeader from "@/components/SortableHeader.jsx";
import { usePermission } from "@/auth/PermissionContext.jsx";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ViewToggle";
import { Button, Badge } from "@/components/ui";
import {
  ChevronDown,
  Upload,
  FileSpreadsheet,
  Download,
  Layers,
  X,
  Plus,
} from "lucide-react";

function toCharYorN(val, defaultVal = "Y") {
  if (val === undefined || val === null || String(val).trim() === "") {
    return defaultVal;
  }
  if (typeof val === "boolean") {
    return val ? "Y" : "N";
  }
  if (typeof val === "number") {
    return val === 1 ? "Y" : (val === 0 ? "N" : defaultVal);
  }
  const s = String(val).trim().toUpperCase();
  if (["Y", "YES", "TRUE", "1", "T"].includes(s)) return "Y";
  if (["N", "NO", "FALSE", "0", "F"].includes(s)) return "N";
  return defaultVal;
}

/**
 * ItemsList component
 * Displays inventory items and manages search, filter, and pagination states.
 * 
 * @returns {JSX.Element} The item list view.
 */
export default function ItemsList() {
  const [viewMode, setViewMode] = useViewMode();
  const { hasExceptional } = usePermission();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [itemType, setItemType] = useState("");
  const [status, setStatus] = useState("");
  const [hasBarcode, setHasBarcode] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState({ key: "item_code", asc: true });
  const fileInputRef = useRef(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showBulkOps, setShowBulkOps] = useState(false);

  const handleToggleStatus = async (item, targetActive) => {
    const action = targetActive ? "enable" : "disable";
    if (!window.confirm(`Are you sure you want to ${action} this item?`)) return;
    try {
      setLoading(true);
      await api.patch(`/inventory/items/${item.id}/status`, { is_active: targetActive ? 1 : 0 });
      toast.success(`Item ${targetActive ? "enabled" : "disabled"} successfully`);
      const res = await api.get("/inventory/items?all=1");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err.message || `Failed to ${action} item`,
      );
    } finally {
      setLoading(false);
    }
  };
  const normalizeBarcode = (v) => {
    if (v == null) return "";
    const s = String(v).trim();
    if (!s) return "";
    const m = /^([+-]?)(\d+(?:\.\d+)?)[eE]([+-]?\d+)$/.exec(s);
    if (!m) return s;
    const sign = m[1] || "";
    let num = m[2];
    const exp = parseInt(m[3], 10);
    if (!Number.isFinite(exp)) return s;
    if (num.includes(".")) {
      const parts = num.split(".");
      const intPart = parts[0];
      const fracPart = parts[1];
      if (exp >= 0) {
        const move = Math.min(exp, fracPart.length);
        const merged = intPart + fracPart.slice(0, move);
        const rem = fracPart.slice(move);
        const zeros =
          exp > fracPart.length ? "0".repeat(exp - fracPart.length) : "";
        num = merged + rem + zeros;
      } else {
        const k = -exp;
        const pad = "0".repeat(k - intPart.length);
        const left =
          intPart.length > k ? intPart.slice(0, intPart.length - k) : "";
        const right =
          (intPart.length > k
            ? intPart.slice(intPart.length - k)
            : pad + intPart) + fracPart;
        num = left + (left ? "" : "") + right;
      }
    } else {
      if (exp >= 0) {
        num = num + "0".repeat(exp);
      } else {
        const k = -exp;
        const pad = "0".repeat(k);
        num = "0." + pad + num;
      }
    }
    num = num.replace(/^0+(?=\d)/, "");
    return (sign === "-" ? "-" : "") + num;
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    api
      .get("/inventory/items?all=1")
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load items");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((it) => Boolean(it.is_active)).length;
    const inactive = total - active;
    const lowStock = items.filter(
      (it) =>
        Number(it.stock_level || 0) <= Number(it.reorder_level || -1) &&
        it.reorder_level != null,
    ).length;
    return { total, active, inactive, lowStock };
  }, [items]);

  const filtered = useMemo(() => {
    let base = items.filter((it) => {
      if (itemType && String(it.item_type || "") !== itemType) return false;
      if (status && (status === "Y" ? !it.is_active : it.is_active))
        return false;
      if (hasBarcode === "Y" && !it.barcode) return false;
      if (hasBarcode === "N" && it.barcode) return false;
      return true;
    });
    if (searchTerm && searchTerm.trim()) {
      base = filterAndSort(base, {
        query: searchTerm,
        getKeys: (it) => [it.item_name, it.item_code, it.barcode],
      });
      return base;
    }
    return base.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return sort.asc ? -1 : 1;
      if (bv == null) return sort.asc ? 1 : -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sort.asc ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return sort.asc ? -1 : 1;
      if (as > bs) return sort.asc ? 1 : -1;
      return 0;
    });
  }, [items, searchTerm, itemType, status, hasBarcode, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const onSort = (key) => {
    setSort((prev) =>
      prev.key === key ? { key, asc: !prev.asc } : { key, asc: true },
    );
  };

  const handleBulkUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  function parseCsv(text) {
    const rows = [];
    let i = 0;
    let field = "";
    let inQuotes = false;
    let row = [];
    const pushField = () => {
      row.push(field);
      field = "";
    };
    const pushRow = () => {
      // trim trailing CR
      if (row.length) rows.push(row.map((s) => s.replace(/\r$/, "")));
      row = [];
    };
    // Remove BOM if present
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }
    while (i < text.length) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i += 1;
            continue;
          }
        } else {
          field += ch;
          i += 1;
          continue;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i += 1;
          continue;
        }
        if (ch === ",") {
          pushField();
          i += 1;
          continue;
        }
        if (ch === "\n") {
          pushField();
          pushRow();
          i += 1;
          continue;
        }
        if (ch === "\r") {
          // handle CRLF
          if (text[i + 1] === "\n") {
            i += 2;
          } else {
            i += 1;
          }
          pushField();
          pushRow();
          continue;
        }
        field += ch;
        i += 1;
      }
    }
    // Final field/row
    pushField();
    pushRow();
    // Drop any empty trailing rows
    while (rows.length && rows[rows.length - 1].every((s) => s.trim() === "")) {
      rows.pop();
    }
    return rows;
  }

  const processImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isExcel = /\.xlsx?$/i.test(String(file.name || ""));
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let rowsCsv = [];
      try {
        if (isExcel) {
          const data = new Uint8Array(evt.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const aoa = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            blankrows: false,
          });
          rowsCsv = Array.isArray(aoa)
            ? aoa.map((row) =>
                row.map((c) => {
                  const v = c == null ? "" : c;
                  return String(v).trim();
                }),
              )
            : [];
        } else {
          const text = evt.target.result || "";
          rowsCsv = parseCsv(text);
        }
      } catch {
        toast.error("Failed to parse file");
        return;
      }
      if (!rowsCsv.length) {
        toast.error("Empty file");
        return;
      }
      const headers = rowsCsv[0].map((h) => String(h || "").trim());

      // Flexible validation of headers
      const hasItemName = headers.some((h) =>
        /item.*name/i.test(h.replace(/[*_\s]/g, " ")),
      );
      const hasItemType = headers.some((h) =>
        /item.*type/i.test(h.replace(/[*_\s]/g, " ")),
      );
      const hasUom = headers.some((h) =>
        /(base.*uom|unit.*of.*measure|uom)/i.test(h.replace(/[*_\s]/g, " ")),
      );

      const missing = [];
      if (!hasItemName) missing.push("ITEM_NAME* (Item Name)");
      if (!hasItemType) missing.push("ITEM_TYPE* (Item Type)");
      if (!hasUom) missing.push("BASE_UOM* (Unit of Measure)");

      if (missing.length > 0) {
        toast.error(
          `Invalid file format: Missing required header(s): ${missing.join(", ")}`,
        );
        return;
      }

      // Build lookup maps for category/group/currency/tax/account/warehouse codes -> IDs
      let categoryCodeToId = new Map();
      let categoryIdToName = new Map();
      let groupCodeToId = new Map();
      let groupIdToName = new Map();
      let currencyCodeToId = new Map();
      let taxCodeToId = new Map();
      let accountCodeToId = new Map();
      let priceTypeNameToId = new Map();
      let warehouseCodeToId = new Map();
      let warehouseIdToName = new Map();
      let warehouseIdToBranchId = new Map();
      let warehouseCodeToBranchId = new Map();
      let itemTypeSet = new Set();
      let itemTypeCodeToCode = new Map();
      let itemTypeNameToCode = new Map();
      try {
        const [catRes, grpRes, curRes, taxRes, accRes, typeRes, ptRes, whRes] =
          await Promise.all([
            api.get("/inventory/item-categories").catch(() => ({ data: { items: [] } })),
            api.get("/inventory/item-groups").catch(() => ({ data: { items: [] } })),
            api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
            api.get("/finance/tax-codes").catch(() => ({ data: { items: [] } })),
            api.get("/finance/accounts").catch(() => ({ data: { items: [] } })),
            api.get("/inventory/item-types").catch(() => ({ data: { items: [] } })),
            api.get("/sales/price-types?active=true").catch(() => ({ data: { items: [] } })),
            api.get("/inventory/warehouses").catch(() => ({ data: { items: [] } })),
          ]);
        const cats = Array.isArray(catRes?.data?.items)
          ? catRes.data.items
          : [];
        const grps = Array.isArray(grpRes?.data?.items)
          ? grpRes.data.items
          : [];
        const curs = Array.isArray(curRes?.data?.items)
          ? curRes.data.items
          : [];
        const taxes = Array.isArray(taxRes?.data?.items)
          ? taxRes.data.items
          : [];
        const accounts = Array.isArray(accRes?.data?.items)
          ? accRes.data.items
          : [];
        const types = Array.isArray(typeRes?.data?.items)
          ? typeRes.data.items
          : [];
        const whs = Array.isArray(whRes?.data?.items)
          ? whRes.data.items
          : Array.isArray(whRes?.data)
            ? whRes.data
            : [];
        cats.forEach((c) => {
          const id = Number(c.id);
          const code = String(c.category_code || "").toUpperCase();
          const name = String(c.category_name || "").toUpperCase();
          if (id > 0) {
            if (code) categoryCodeToId.set(code, id);
            if (name) categoryCodeToId.set(name, id);
            categoryIdToName.set(id, String(c.category_name || ""));
          }
        });
        grps.forEach((g) => {
          const id = Number(g.id);
          const code = String(g.group_code || "").toUpperCase();
          const name = String(g.group_name || "").toUpperCase();
          if (id > 0) {
            if (code) groupCodeToId.set(code, id);
            if (name) groupCodeToId.set(name, id);
            groupIdToName.set(id, String(g.group_name || ""));
          }
        });
        curs.forEach((c) => {
          const id = Number(c.id);
          const code = String(c.code || "").toUpperCase();
          const name = String(c.name || "").toUpperCase();
          if (id > 0) {
            if (code) currencyCodeToId.set(code, id);
            if (name) currencyCodeToId.set(name, id);
          }
        });
        taxes.forEach((t) => {
          const id = Number(t.id);
          const code = String(t.code || "").toUpperCase();
          const name = String(t.name || "").toUpperCase();
          if (id > 0) {
            if (code) taxCodeToId.set(code, id);
            if (name) taxCodeToId.set(name, id);
          }
        });
        accounts.forEach((a) => {
          const id = Number(a.id);
          const code = String(a.code || "").toUpperCase();
          const name = String(a.name || "").toUpperCase();
          if (id > 0) {
            if (code) accountCodeToId.set(code, id);
            if (name) accountCodeToId.set(name, id);
          }
        });
        whs.forEach((w) => {
          const id = Number(w.id);
          const code = String(w.warehouse_code || "").toUpperCase();
          const name = String(w.warehouse_name || "").toUpperCase();
          const bId = w.branch_id ? Number(w.branch_id) : null;
          if (id > 0) {
            if (code) {
              warehouseCodeToId.set(code, id);
              if (bId) warehouseCodeToBranchId.set(code, bId);
            }
            if (name) {
              warehouseCodeToId.set(name, id);
              if (bId) warehouseCodeToBranchId.set(name, bId);
            }
            warehouseIdToName.set(id, String(w.warehouse_name || w.warehouse_code || ""));
            if (bId) warehouseIdToBranchId.set(id, bId);
          }
        });
        const pts = Array.isArray(ptRes?.data?.items) ? ptRes.data.items : [];
        pts.forEach((p) => {
          const id = Number(p.id);
          const name = String(p.name || "").toUpperCase();
          if (id > 0 && name) priceTypeNameToId.set(name, id);
        });
        types.forEach((t) => {
          const code = String(
            t.type_code || t.code || t.key || "",
          ).toUpperCase();
          const name = String(t.type_name || t.name || "").toUpperCase();
          if (code) {
            itemTypeSet.add(code);
            itemTypeCodeToCode.set(code, code);
          }
          if (name) {
            itemTypeSet.add(name);
            if (code) {
              itemTypeNameToCode.set(name, code);
              itemTypeCodeToCode.set(name, code);
            }
          }
        });

        const standardMappings = [
          ["RAW MATERIAL", "RAW_MATERIAL"],
          ["RAW_MATERIAL", "RAW_MATERIAL"],
          ["FINISHED GOOD", "FINISHED_GOOD"],
          ["FINISHED GOODS", "FINISHED_GOOD"],
          ["FINISHED_GOOD", "FINISHED_GOOD"],
          ["SERVICE", "SERVICE"],
          ["SERVICES", "SERVICE"],
          ["CONSUMABLE", "CONSUMABLE"],
          ["CONSUMABLES", "CONSUMABLE"],
          ["EQUIPMENT", "EQUIPMENT"],
          ["SPARE PART", "SPARE_PART"],
          ["SPARE PARTS", "SPARE_PART"],
          ["SPARE_PART", "SPARE_PART"],
          ["ASSET", "ASSET"],
          ["ASSETS", "ASSET"],
        ];
        standardMappings.forEach(([n, c]) => {
          itemTypeSet.add(n);
          itemTypeSet.add(c);
          itemTypeNameToCode.set(n, c);
          itemTypeCodeToCode.set(n, c);
        });
      } catch (_) {
        // proceed without maps; numeric IDs in CSV will still work via fallback below
      }

      const rows = [];
      // Do not block on client. Let server handle duplicates/conflicts.
      const seenNames = new Set();
      // Build preview rows with validation using parsed CSV
      for (let i = 1; i < rowsCsv.length; i++) {
        const values = rowsCsv[i].map((v) => String(v || "").trim());
        if (values.length < headers.length) {
          // pad values with empties to match headers length
          for (let k = values.length; k < headers.length; k++) values.push("");
        }
        const rawMap = {};
        headers.forEach((h, idx) => {
          rawMap[h] = values[idx] ?? "";
        });

        const getVal = (aliases) => {
          for (const a of aliases) {
            const cleanA = a.replace(/[*_\s]/g, "").toUpperCase();
            for (const [k, v] of Object.entries(rawMap)) {
              const cleanK = k.replace(/[*_\s]/g, "").toUpperCase();
              if (
                cleanK === cleanA &&
                v !== undefined &&
                v !== null &&
                String(v).trim() !== ""
              ) {
                return String(v).trim();
              }
            }
          }
          return "";
        };

        const rowData = {
          ITEM_CODE: getVal(["ITEM_CODE", "ITEM CODE", "CODE"]),
          ITEM_NAME: getVal(["ITEM_NAME", "ITEM NAME", "NAME", "ITEM"]),
          ITEM_TYPE: getVal(["ITEM_TYPE", "ITEM TYPE", "TYPE"]),
          ITEM_CATEGORY: getVal([
            "ITEM_CATEGORY",
            "ITEM CATEGORY",
            "CATEGORY",
            "CATEGORY NAME",
          ]),
          ITEM_CATEGORY_CODE: getVal([
            "ITEM_CATEGORY_CODE",
            "CATEGORY CODE",
          ]),
          ITEM_CATEGORY_ID: getVal(["ITEM_CATEGORY_ID", "CATEGORY ID"]),
          ITEM_GROUP: getVal([
            "ITEM_GROUP",
            "ITEM GROUP",
            "GROUP",
            "GROUP NAME",
          ]),
          ITEM_GROUP_CODE: getVal(["ITEM_GROUP_CODE", "GROUP CODE"]),
          ITEM_GROUP_ID: getVal(["ITEM_GROUP_ID", "GROUP ID"]),
          BASE_UOM: getVal([
            "BASE_UOM",
            "BASE UOM",
            "UNIT OF MEASURE",
            "UNIT_OF_MEASURE",
            "UOM",
            "UNIT",
          ]),
          BARCODE: getVal(["BARCODE", "BAR CODE"]),
          STANDARD_COST: getVal([
            "STANDARD_COST",
            "STANDARD COST",
            "COST PRICE",
            "COST_PRICE",
            "COST",
          ]),
          SELLING_PRICE: getVal(["SELLING_PRICE", "SELLING PRICE", "PRICE"]),
          CURRENCY_CODE: getVal([
            "CURRENCY",
            "CURRENCY_CODE",
            "CURRENCY CODE",
          ]),
          VAT_PURCHASE_CODE: getVal([
            "PURCHAS VAT CODE",
            "PURCHASE VAT CODE",
            "VAT_PURCHASE_CODE",
            "VAT_ON_PURCHASE",
            "VAT PURCHASE",
            "PURCHASE VAT",
          ]),
          VAT_SALES_CODE: getVal([
            "SALES VAT CODE",
            "VAT_SALES_CODE",
            "VAT_ON_SALES",
            "VAT SALES",
            "SALES VAT",
          ]),
          PURCHASE_ACCOUNT_ID: getVal([
            "PURCHASE_ACCOUNT_ID",
            "PURCHASE ACCOUNT ID",
            "PURCHASE_ACCOUNT",
            "PURCHASE ACCOUNT",
          ]),
          SALES_ACCOUNT_ID: getVal([
            "SALES_ACCOUNT_ID",
            "SALES ACCOUNT ID",
            "SALES_ACCOUNT",
            "SALES ACCOUNT",
          ]),
          DESCRIPTION: getVal(["DESCRIPTION", "DESC", "REMARKS"]),
          IS_STOCKABLE: getVal(["IS_STOCKABLE", "IS STOCKABLE", "STOCKABLE"]),
          IS_SELLABLE: getVal(["IS_SELLABLE", "IS SELLABLE", "SELLABLE"]),
          IS_PURCHASABLE: getVal([
            "IS_PURCHASABLE",
            "IS PURCHASABLE",
            "PURCHASABLE",
          ]),
          MIN_STOCK_LEVEL: getVal([
            "MIN_STOCK_LEVEL",
            "MIN STOCK LEVEL",
            "MIN STOCK",
          ]),
          MAX_STOCK_LEVEL: getVal([
            "MAX_STOCK_LEVEL",
            "MAX STOCK LEVEL",
            "MAX STOCK",
          ]),
          REORDER_LEVEL: getVal(["REORDER_LEVEL", "REORDER LEVEL"]),
          SAFETY_STOCK: getVal(["SAFETY_STOCK", "SAFETY STOCK", "SAFETY"]),
          WAREHOUSE: getVal([
            "WAREHOUSE",
            "WAREHOUSE_NAME",
            "WAREHOUSE NAME",
            "WAREHOUSE_CODE",
            "WAREHOUSE CODE",
          ]),
          OPENING_QUANTITY: getVal([
            "OPENING_QUANTITY",
            "OPENING QUANTITY",
            "OPENING_STOCK",
            "OPENING STOCK",
            "QUANTITY",
            "QTY",
          ]),
          STATUS: getVal(["STATUS", "ACTIVE", "IS_ACTIVE"]),
        };
        let nextItemCode = rowData.ITEM_CODE || "";
        const itemTypeRaw = String(rowData.ITEM_TYPE || "").toUpperCase();
        const itemTypeResolved =
          itemTypeCodeToCode.get(itemTypeRaw) ||
          itemTypeNameToCode.get(itemTypeRaw) ||
          (itemTypeSet.has(itemTypeRaw) ? itemTypeRaw : null);
        const itemTypeValid =
          itemTypeSet.size === 0 ? true : !!itemTypeResolved;
        const barcodeExpanded = normalizeBarcode(rowData.BARCODE || "");
        const warehouseRaw = String(rowData.WAREHOUSE || "").trim().toUpperCase();
        const warehouseResolved = warehouseRaw
          ? (warehouseCodeToId.get(warehouseRaw) || (Number(warehouseRaw) > 0 ? Number(warehouseRaw) : null))
          : null;
        const branchResolved = warehouseResolved
          ? (warehouseIdToBranchId.get(Number(warehouseResolved)) || null)
          : (warehouseRaw ? (warehouseCodeToBranchId.get(warehouseRaw) || null) : null);
        const warehouseLabel = warehouseResolved
          ? (warehouseIdToName.get(Number(warehouseResolved)) || rowData.WAREHOUSE)
          : rowData.WAREHOUSE;
        const categoryResolved =
          (rowData.ITEM_CATEGORY &&
            categoryCodeToId.get(
              String(rowData.ITEM_CATEGORY).toUpperCase(),
            )) ||
          (rowData.ITEM_CATEGORY_CODE &&
            categoryCodeToId.get(
              String(rowData.ITEM_CATEGORY_CODE).toUpperCase(),
            )) ||
          rowData.ITEM_CATEGORY_ID ||
          null;
        const groupResolved =
          (rowData.ITEM_GROUP &&
            groupCodeToId.get(String(rowData.ITEM_GROUP).toUpperCase())) ||
          (rowData.ITEM_GROUP_CODE &&
            groupCodeToId.get(String(rowData.ITEM_GROUP_CODE).toUpperCase())) ||
          rowData.ITEM_GROUP_ID ||
          null;
        let categoryLabel = "";
        if (rowData.ITEM_CATEGORY_ID) {
          const cid = Number(rowData.ITEM_CATEGORY_ID);
          categoryLabel =
            categoryIdToName.get(cid) ||
            rowData.ITEM_CATEGORY ||
            rowData.ITEM_CATEGORY_CODE ||
            String(rowData.ITEM_CATEGORY_ID);
        } else {
          categoryLabel =
            rowData.ITEM_CATEGORY ||
            rowData.ITEM_CATEGORY_CODE ||
            (categoryResolved
              ? categoryIdToName.get(Number(categoryResolved)) || ""
              : "");
        }
        let groupLabel = "";
        if (rowData.ITEM_GROUP_ID) {
          const gid = Number(rowData.ITEM_GROUP_ID);
          groupLabel =
            groupIdToName.get(gid) ||
            rowData.ITEM_GROUP ||
            rowData.ITEM_GROUP_CODE ||
            String(rowData.ITEM_GROUP_ID);
        } else {
          groupLabel =
            rowData.ITEM_GROUP ||
            rowData.ITEM_GROUP_CODE ||
            (groupResolved
              ? groupIdToName.get(Number(groupResolved)) || ""
              : "");
        }
        const categoryName = categoryResolved
          ? categoryIdToName.get(Number(categoryResolved)) || ""
          : "";
        const groupName = groupResolved
          ? groupIdToName.get(Number(groupResolved)) || ""
          : "";
        const errorsRow = [];
        // Validate required fields (all fields except barcode, description, safety stock, reorder level, Min Stock Level, Max Stock Level, opening quantity)
        const nameUpper = String(rowData.ITEM_NAME || "").trim().toUpperCase();
        if (!nameUpper) errorsRow.push("Missing ITEM_NAME");

        const itemTypeUpper = String(itemTypeRaw || "").trim().toUpperCase();
        if (!itemTypeUpper) {
          errorsRow.push("Missing ITEM_TYPE");
        } else if (!itemTypeValid) {
          errorsRow.push("Unknown ITEM_TYPE (no match in system)");
        }

        const categoryProvided = String(
          rowData.ITEM_CATEGORY ||
            rowData.ITEM_CATEGORY_CODE ||
            rowData.ITEM_CATEGORY_ID ||
            "",
        ).trim() !== "";
        if (!categoryProvided) {
          errorsRow.push("Missing ITEM_CATEGORY");
        } else if (!categoryResolved) {
          errorsRow.push("Unknown CATEGORY (no match in system)");
        }

        const groupProvided = String(
          rowData.ITEM_GROUP ||
            rowData.ITEM_GROUP_CODE ||
            rowData.ITEM_GROUP_ID ||
            "",
        ).trim() !== "";
        if (!groupProvided) {
          errorsRow.push("Missing ITEM_GROUP");
        } else if (!groupResolved) {
          errorsRow.push("Unknown GROUP (no match in system)");
        }

        if (!String(rowData.BASE_UOM || "").trim()) {
          errorsRow.push("Missing UNIT_OF_MEASURE");
        }

        if (rowData.STANDARD_COST === "" || rowData.STANDARD_COST === null || rowData.STANDARD_COST === undefined) {
          errorsRow.push("Missing STANDARD_COST");
        }

        if (rowData.SELLING_PRICE === "" || rowData.SELLING_PRICE === null || rowData.SELLING_PRICE === undefined) {
          errorsRow.push("Missing SELLING_PRICE");
        }

        if (!String(rowData.CURRENCY_CODE || rowData.CURRENCY || "").trim()) {
          errorsRow.push("Missing CURRENCY");
        }

        if (!warehouseRaw) {
          errorsRow.push("Missing WAREHOUSE");
        } else if (!warehouseResolved) {
          errorsRow.push("Unknown WAREHOUSE (no match in system)");
        }

        if (!String(rowData.VAT_PURCHASE_CODE || "").trim()) {
          errorsRow.push("Missing PURCHASE VAT CODE");
        }

        if (!String(rowData.VAT_SALES_CODE || "").trim()) {
          errorsRow.push("Missing SALES VAT CODE");
        }

        if (!String(rowData.PURCHASE_ACCOUNT_ID || "").trim()) {
          errorsRow.push("Missing PURCHASE_ACCOUNT_ID");
        }

        if (!String(rowData.SALES_ACCOUNT_ID || "").trim()) {
          errorsRow.push("Missing SALES_ACCOUNT_ID");
        }

        // Auto determine is_stockable: if item type = service or non inventory item -> N, otherwise -> Y
        const typeNorm = String(itemTypeResolved || itemTypeRaw || "").toUpperCase().replace(/[-_\s]/g, "");
        const isServiceOrNonInv = typeNorm.includes("SERVICE") || typeNorm.includes("NONINVENTORY");
        const autoIsStockable = isServiceOrNonInv ? "N" : "Y";

        if (nameUpper) seenNames.add(nameUpper);
        rows.push({
          index: i + 1,
          raw: rowData,
          preview: {
            item_code: nextItemCode,
            item_name: rowData.ITEM_NAME,
            item_type: itemTypeResolved || itemTypeRaw || "",
            is_stockable: autoIsStockable,
            warehouse_id: warehouseResolved,
            branch_id: branchResolved,
            warehouse_label: warehouseLabel || "-",
            opening_quantity: Number(rowData.OPENING_QUANTITY) || 0,
            safety_stock: Number(rowData.SAFETY_STOCK) || 0,
            category_id: categoryResolved,
            item_group_id: groupResolved,
            category_label: String(categoryLabel),
            group_label: String(groupLabel),
            category_name: categoryName,
            group_name: groupName,
            uom: rowData.BASE_UOM || "PCS",
            barcode: barcodeExpanded,
            status: String(rowData.STATUS || "ACTIVE").toUpperCase(),
          },
          valid: errorsRow.length === 0,
          errors: errorsRow,
        });
      }
      setPreviewHeaders([
        "Row",
        "Item Code",
        "Name",
        "Type",
        "Warehouse",
        "Opening Qty",
        "Uploaded Category",
        "Category Name",
        "Uploaded Group",
        "Group Name",
        "UOM",
        "Barcode",
        "Status",
      ]);
      setPreviewRows(rows);
      setPreviewOpen(true);
      e.target.value = null;
    };
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const confirmUpload = async () => {
    try {
      setUploading(true);
      let shouldClosePreview = true;
      // Rebuild lookup maps here (upload runs independently of file-parse scope)
      const currencyCodeToId = new Map();
      const taxCodeToId = new Map();
      const accountCodeToId = new Map();
      const priceTypeNameToId = new Map();
      const whNameToId = new Map();
      const whIdToBranchId = new Map();
      const whNameToBranchId = new Map();
      try {
        const [curRes, taxRes, ptRes, whRes, accRes] = await Promise.all([
          api.get("/finance/currencies"),
          api.get("/finance/tax-codes"),
          api.get("/sales/price-types?active=true"),
          api
            .get("/inventory/warehouses?all_branches=1")
            .catch(() => api.get("/inventory/warehouses").catch(() => ({ data: { items: [] } }))),
          api.get("/finance/accounts").catch(() => ({ data: { items: [] } })),
        ]);
        const curs = Array.isArray(curRes?.data?.items) ? curRes.data.items : [];
        const taxes = Array.isArray(taxRes?.data?.items) ? taxRes.data.items : [];
        const pts = Array.isArray(ptRes?.data?.items) ? ptRes.data.items : [];
        const whs = Array.isArray(whRes?.data?.items) ? whRes.data.items : Array.isArray(whRes?.data) ? whRes.data : [];
        const accs = Array.isArray(accRes?.data?.items) ? accRes.data.items : [];

        curs.forEach((c) => {
          const id = Number(c.id);
          const code = String(c.code || "").trim().toUpperCase();
          const name = String(c.name || "").trim().toUpperCase();
          if (id > 0) {
            if (code) currencyCodeToId.set(code, id);
            if (name) currencyCodeToId.set(name, id);
            currencyCodeToId.set(String(id), id);
          }
        });
        taxes.forEach((t) => {
          const id = Number(t.id);
          const code = String(t.code || "").trim().toUpperCase();
          const name = String(t.name || "").trim().toUpperCase();
          if (id > 0) {
            if (code) taxCodeToId.set(code, id);
            if (name) taxCodeToId.set(name, id);
            taxCodeToId.set(String(id), id);
          }
        });
        accs.forEach((a) => {
          const id = Number(a.id);
          const code = String(a.code || "").trim().toUpperCase();
          const name = String(a.name || "").trim().toUpperCase();
          if (id > 0) {
            if (code) accountCodeToId.set(code, id);
            if (name) accountCodeToId.set(name, id);
            accountCodeToId.set(String(id), id);
          }
        });
        pts.forEach((p) => {
          const id = Number(p.id);
          const name = String(p.name || "").toUpperCase();
          if (id > 0 && name) priceTypeNameToId.set(name, id);
        });
        whs.forEach((w) => {
          const id = Number(w.id);
          const code = String(w.warehouse_code || "").toUpperCase();
          const name = String(w.warehouse_name || "").toUpperCase();
          const bId = Number(w.branch_id) || null;
          if (id > 0) {
            if (code) {
              whNameToId.set(code, id);
              if (bId) whNameToBranchId.set(code, bId);
            }
            if (name) {
              whNameToId.set(name, id);
              if (bId) whNameToBranchId.set(name, bId);
            }
            if (bId) whIdToBranchId.set(id, bId);
          }
        });
      } catch {
        // keep empty maps; payload still carries raw code fields for server-side resolution
      }
      const getNextItemCode = async (fallbackSeed) => {
        try {
          const res = await api.get("/inventory/items/next-code", {
            __skipOfflineQueue: true,
          });
          if (res?.data?.nextCode) return String(res.data.nextCode);
        } catch {}
        return `ITM-${String(Date.now()).slice(-6)}-${String(fallbackSeed).padStart(2, "0")}`;
      };
      const payloadRows = previewRows
        .filter((r) => r && r.valid) // only valid rows
        .map((r) => {
          const rowData = r.raw || {};
          const warehouseRaw = String(rowData.WAREHOUSE || "").trim().toUpperCase();
          const resolvedWhId = r.preview?.warehouse_id || (warehouseRaw ? (whNameToId.get(warehouseRaw) || (Number(warehouseRaw) > 0 ? Number(warehouseRaw) : null)) : null);
          const resolvedBranchId = r.preview?.branch_id || (resolvedWhId ? whIdToBranchId.get(resolvedWhId) : null) || (warehouseRaw ? whNameToBranchId.get(warehouseRaw) : null) || null;

          const rawCur = String(rowData.CURRENCY_ID || rowData.CURRENCY_CODE || rowData.CURRENCY || "").trim().toUpperCase();
          const resolvedCurId = (Number(rawCur) > 0 ? Number(rawCur) : null) || currencyCodeToId.get(rawCur) || 1;

          const rawVatPur = String(rowData.VAT_ON_PURCHASE_ID || rowData.VAT_PURCHASE_CODE || rowData.VAT_ON_PURCHASE || rowData.VAT_PURCHASE || "").trim().toUpperCase();
          const resolvedVatPurId = (Number(rawVatPur) > 0 ? Number(rawVatPur) : null) || taxCodeToId.get(rawVatPur) || null;

          const rawVatSal = String(rowData.VAT_ON_SALES_ID || rowData.VAT_SALES_CODE || rowData.VAT_ON_SALES || rowData.VAT_SALES || "").trim().toUpperCase();
          const resolvedVatSalId = (Number(rawVatSal) > 0 ? Number(rawVatSal) : null) || taxCodeToId.get(rawVatSal) || null;

          const rawPurAcc = String(rowData.PURCHASE_ACCOUNT_ID || rowData.PURCHASE_ACCOUNT_CODE || rowData.PURCHASE_ACCOUNT || "").trim().toUpperCase();
          const resolvedPurAccId = (Number(rawPurAcc) > 0 ? Number(rawPurAcc) : null) || accountCodeToId.get(rawPurAcc) || null;

          const rawSalAcc = String(rowData.SALES_ACCOUNT_ID || rowData.SALES_ACCOUNT_CODE || rowData.SALES_ACCOUNT || "").trim().toUpperCase();
          const resolvedSalAccId = (Number(rawSalAcc) > 0 ? Number(rawSalAcc) : null) || accountCodeToId.get(rawSalAcc) || null;

          const itemTypeStr = r.preview?.item_type || rowData.ITEM_TYPE || "";
          const typeNorm = String(itemTypeStr).toUpperCase().replace(/[-_\s]/g, "");
          const isServiceOrNonInv = typeNorm.includes("SERVICE") || typeNorm.includes("NONINVENTORY");
          const resolvedIsStockable = isServiceOrNonInv ? "N" : toCharYorN(rowData.IS_STOCKABLE || r.preview?.is_stockable, "Y");
          const resolvedIsSellable = toCharYorN(rowData.IS_SELLABLE, "Y");
          const resolvedIsPurchasable = toCharYorN(rowData.IS_PURCHASABLE, "Y");

          return {
            item_code: rowData.ITEM_CODE || r.preview.item_code || "",
            item_name: rowData.ITEM_NAME || "",
            item_type: r.preview.item_type || rowData.ITEM_TYPE || "",
            category_id: r.preview.category_id || null,
            item_group_id: r.preview.item_group_id || null,
            category_label: r.preview.category_label || "",
            category_name: r.preview.category_name || "",
            category_code: rowData.ITEM_CATEGORY_CODE || "",
            group_label: r.preview.group_label || "",
            group_name: r.preview.group_name || "",
            group_code: rowData.ITEM_GROUP_CODE || "",
            uom: rowData.BASE_UOM || "PCS",
            barcode: r.preview.barcode || "",
            cost_price: Number(rowData.STANDARD_COST) || 0,
            selling_price: Number(rowData.SELLING_PRICE) || 0,
            currency_id: resolvedCurId,
            currency_code: rowData.CURRENCY_CODE || rowData.CURRENCY || "",
            warehouse_id: resolvedWhId,
            opening_warehouse_id: resolvedWhId,
            warehouse_name: rowData.WAREHOUSE || "",
            branch_id: resolvedBranchId,
            opening_quantity: Number(rowData.OPENING_QUANTITY) || 0,
            safety_stock: Number(rowData.SAFETY_STOCK) || 0,
            price_type: rowData.PRICE_TYPE || "",
            price_type_name: rowData.PRICE_TYPE_NAME || "",
            image_url: rowData.IMAGE_URL || rowData.IMAGE || "",
            vat_on_purchase_id: resolvedVatPurId,
            vat_on_purchase_code:
              rowData.VAT_ON_PURCHASE || rowData.VAT_PURCHASE_CODE || "",
            vat_on_sales_id: resolvedVatSalId,
            vat_on_sales_code:
              rowData.VAT_ON_SALES || rowData.VAT_SALES_CODE || "",
            purchase_account_id: resolvedPurAccId,
            sales_account_id: resolvedSalAccId,
            purchase_account_code:
              rowData.PURCHASE_ACCOUNT_CODE || rowData.PURCHASE_ACCOUNT || "",
            sales_account_code:
              rowData.SALES_ACCOUNT_CODE || rowData.SALES_ACCOUNT || "",
            description: rowData.DESCRIPTION || "",
            is_stockable: resolvedIsStockable,
            is_sellable: resolvedIsSellable,
            is_purchasable: resolvedIsPurchasable,
            is_active: String(rowData.STATUS || "").toUpperCase() === "INACTIVE" ? false : true,
            min_stock_level: Number(rowData.MIN_STOCK_LEVEL) || 0,
            max_stock_level: Number(rowData.MAX_STOCK_LEVEL) || 0,
            reorder_level: Number(rowData.REORDER_LEVEL) || 0,
          };
        });
      if (payloadRows.length) {
        try {
          const resp = await api.post(
            "/inventory/items/bulk",
            { rows: payloadRows, auto_create_missing: true },
            { __skipOfflineQueue: true },
          );
          const inserted = Number(resp?.data?.inserted || 0);
          const updated = Number(resp?.data?.updated || 0);
          const failed = Number(resp?.data?.failed || 0);
          shouldClosePreview = failed === 0;
          if (inserted || updated) {
            toast.success(`Uploaded ${inserted} new, updated ${updated} existing items`);
            const res = await api.get("/inventory/items?all=1");
            setItems(Array.isArray(res.data?.items) ? res.data.items : []);
          }
          if (failed > 0) {
            console.warn(`Bulk endpoint reported ${failed} skipped rows; proceeding with individual fallback...`);
          } else {
            setPreviewOpen(false);
            setPreviewRows([]);
            setPreviewHeaders([]);
            return;
          }
        } catch (bulkErr) {
          // Fallback to per-row upload when bulk endpoint is unavailable or fails
          console.error("Bulk upload failed, falling back to per-row:", bulkErr);
        }
      }
      let success = 0;
      let failed = 0;
      const errs = [];
      // Build quick lookup of existing items by name and code for update fallback
      const nameToId = new Map(
        (Array.isArray(items) ? items : [])
          .filter((it) => it && it.id && it.item_name)
          .map((it) => [
            String(it.item_name || "").toUpperCase(),
            Number(it.id),
          ]),
      );
      const codeToId = new Map(
        (Array.isArray(items) ? items : [])
          .filter((it) => it && it.id && it.item_code)
          .map((it) => [
            String(it.item_code || "").toUpperCase(),
            Number(it.id),
          ]),
      );
      for (const r of previewRows.filter((x) => x && x.valid)) {
        const rowData = r.raw;
        let nextItemCode = rowData.ITEM_CODE;
        if (!nextItemCode) {
          nextItemCode = await getNextItemCode(r.index || 0);
        }
        const warehouseRaw = String(rowData.WAREHOUSE || "").trim().toUpperCase();
        const resolvedWhId = r.preview?.warehouse_id || (warehouseRaw ? (whNameToId.get(warehouseRaw) || (Number(warehouseRaw) > 0 ? Number(warehouseRaw) : null)) : null);
        const resolvedBranchId = r.preview?.branch_id || (resolvedWhId ? whIdToBranchId.get(resolvedWhId) : null) || (warehouseRaw ? whNameToBranchId.get(warehouseRaw) : null) || null;

        const rawCur = String(rowData.CURRENCY_ID || rowData.CURRENCY_CODE || rowData.CURRENCY || "").trim().toUpperCase();
        const resolvedCurId = (Number(rawCur) > 0 ? Number(rawCur) : null) || currencyCodeToId.get(rawCur) || 1;

        const rawVatPur = String(rowData.VAT_ON_PURCHASE_ID || rowData.VAT_PURCHASE_CODE || rowData.VAT_ON_PURCHASE || rowData.VAT_PURCHASE || "").trim().toUpperCase();
        const resolvedVatPurId = (Number(rawVatPur) > 0 ? Number(rawVatPur) : null) || taxCodeToId.get(rawVatPur) || null;

        const rawVatSal = String(rowData.VAT_ON_SALES_ID || rowData.VAT_SALES_CODE || rowData.VAT_ON_SALES || rowData.VAT_SALES || "").trim().toUpperCase();
        const resolvedVatSalId = (Number(rawVatSal) > 0 ? Number(rawVatSal) : null) || taxCodeToId.get(rawVatSal) || null;

        const rawPurAcc = String(rowData.PURCHASE_ACCOUNT_ID || rowData.PURCHASE_ACCOUNT_CODE || rowData.PURCHASE_ACCOUNT || "").trim().toUpperCase();
        const resolvedPurAccId = (Number(rawPurAcc) > 0 ? Number(rawPurAcc) : null) || accountCodeToId.get(rawPurAcc) || null;

        const rawSalAcc = String(rowData.SALES_ACCOUNT_ID || rowData.SALES_ACCOUNT_CODE || rowData.SALES_ACCOUNT || "").trim().toUpperCase();
        const resolvedSalAccId = (Number(rawSalAcc) > 0 ? Number(rawSalAcc) : null) || accountCodeToId.get(rawSalAcc) || null;

        const itemTypeStr = r.preview?.item_type || rowData.ITEM_TYPE || "";
        const typeNorm = String(itemTypeStr).toUpperCase().replace(/[-_\s]/g, "");
        const isServiceOrNonInv = typeNorm.includes("SERVICE") || typeNorm.includes("NONINVENTORY");
        const resolvedIsStockable = isServiceOrNonInv ? "N" : toCharYorN(rowData.IS_STOCKABLE || r.preview?.is_stockable, "Y");
        const resolvedIsSellable = toCharYorN(rowData.IS_SELLABLE, "Y");
        const resolvedIsPurchasable = toCharYorN(rowData.IS_PURCHASABLE, "Y");

        const basePayload = {
          item_code: nextItemCode,
          item_name: rowData.ITEM_NAME,
          item_type: r.preview.item_type || rowData.ITEM_TYPE,
          category_id: r.preview.category_id || null,
          item_group_id: r.preview.item_group_id || null,
          group_id: r.preview.item_group_id || null,
          // server-side fallback hints
          category_label: r.preview.category_label,
          category_name: r.preview.category_name,
          group_label: r.preview.group_label,
          group_name: r.preview.group_name,
          category_code: rowData.ITEM_CATEGORY_CODE || null,
          group_code: rowData.ITEM_GROUP_CODE || null,
          currency_id: resolvedCurId,
          currency_code: rowData.CURRENCY_CODE || rowData.CURRENCY || null,
          warehouse_name: rowData.WAREHOUSE || null,
          opening_warehouse_id: resolvedWhId,
          warehouse_id: resolvedWhId,
          branch_id: resolvedBranchId,
          opening_quantity: Number(rowData.OPENING_QUANTITY) || 0,
          vat_on_purchase_id: resolvedVatPurId,
          vat_on_purchase_code:
            rowData.VAT_ON_PURCHASE || rowData.VAT_PURCHASE_CODE || null,
          vat_on_sales_id: resolvedVatSalId,
          vat_on_sales_code:
            rowData.VAT_ON_SALES || rowData.VAT_SALES_CODE || null,
          purchase_account_id: resolvedPurAccId,
          purchase_account_code:
            rowData.PURCHASE_ACCOUNT_CODE || rowData.PURCHASE_ACCOUNT || null,
          sales_account_id: resolvedSalAccId,
          sales_account_code:
            rowData.SALES_ACCOUNT_CODE || rowData.SALES_ACCOUNT || null,
          uom: rowData.BASE_UOM,
          barcode: r.preview.barcode || null,
          cost_price: Number(rowData.STANDARD_COST) || 0,
          selling_price: Number(rowData.SELLING_PRICE) || 0,
          price_type_id:
            priceTypeNameToId.get(
              String(
                rowData.PRICE_TYPE || rowData.PRICE_TYPE_NAME || "",
              ).toUpperCase(),
            ) ||
            Number(rowData.PRICE_TYPE_ID || 0) ||
            null,
          image_url: rowData.IMAGE_URL || rowData.IMAGE || null,
          description: rowData.DESCRIPTION,
          is_stockable: resolvedIsStockable,
          is_sellable: resolvedIsSellable,
          is_purchasable: resolvedIsPurchasable,
          is_active: String(rowData.STATUS || "").toUpperCase() === "INACTIVE" ? false : true,
          min_stock_level: Number(rowData.MIN_STOCK_LEVEL) || 0,
          max_stock_level: Number(rowData.MAX_STOCK_LEVEL) || 0,
          reorder_level: Number(rowData.REORDER_LEVEL) || 0,
          safety_stock: Number(rowData.SAFETY_STOCK) || 0,
          // let server auto-create missing categories/groups when possible
          bulk_import: true,
          auto_create_missing: true,
        };
        const payload = basePayload;
        try {
          const resp = await api.post("/inventory/items", payload, {
            __skipOfflineQueue: true,
          });
          if (resp?.data?.offline) {
            throw new Error("Offline queued");
          }
          success++;
        } catch (err) {
          const code = err?.response?.data?.code || "";
          const status = err?.response?.status || 0;
          if (
            status === 409 ||
            /duplicate/i.test(code) ||
            /already exists/i.test(err?.response?.data?.message || "")
          ) {
            // Fallback to update existing item by code or name
            const keyCode = String(payload.item_code || "").toUpperCase();
            const keyName = String(payload.item_name || "").toUpperCase();
            let itemId = (keyCode ? codeToId.get(keyCode) : null) || nameToId.get(keyName);
            if (!itemId) {
              try {
                const resAll = await api.get("/inventory/items?all=1", {
                  __skipOfflineQueue: true,
                });
                const arr = Array.isArray(resAll.data?.items)
                  ? resAll.data.items
                  : [];
                for (const it of arr) {
                  const cd = String(it.item_code || "").toUpperCase();
                  const nm = String(it.item_name || "").toUpperCase();
                  if (cd && !codeToId.has(cd)) codeToId.set(cd, Number(it.id));
                  if (nm && !nameToId.has(nm)) nameToId.set(nm, Number(it.id));
                }
                itemId = (keyCode ? codeToId.get(keyCode) : null) || nameToId.get(keyName);
              } catch {}
            }
            if (itemId) {
              try {
                const up = await api.put(
                  `/inventory/items/${itemId}`,
                  payload,
                  { __skipOfflineQueue: true },
                );
                if (up?.data?.offline) {
                  throw new Error("Offline queued");
                }
                success++;
                continue;
              } catch (e2) {
                failed++;
                errs.push(
                  `Row ${r.index} (${payload.item_code || payload.item_name}): UPDATE FAILED - ${
                    e2?.response?.data?.message || e2?.message
                  }`,
                );
                continue;
              }
            }
          } else if (
            status === 400 &&
            /item_code.*required/i.test(
              String(err?.response?.data?.message || ""),
            )
          ) {
            // Try regenerate item code once and retry
            try {
              const regenerated = await getNextItemCode(r.index || 0);
              if (regenerated) {
                payload.item_code = regenerated;
                const resp2 = await api.post("/inventory/items", payload, {
                  __skipOfflineQueue: true,
                });
                if (resp2?.data?.offline) {
                  throw new Error("Offline queued");
                }
                success++;
                continue;
              }
            } catch {}
          } else {
            const msg = String(
              err?.response?.data?.message || err?.message || "",
            );
            if (/duplicate entry/i.test(msg)) {
              try {
                const regenerated = await getNextItemCode(r.index || 0);
                if (regenerated) {
                  payload.item_code = regenerated;
                  const resp3 = await api.post("/inventory/items", payload, {
                    __skipOfflineQueue: true,
                  });
                  if (resp3?.data?.offline) {
                    throw new Error("Offline queued");
                  }
                  success++;
                  continue;
                }
              } catch {}
            }
          }
          // If we reach here, record as failed
          failed++;
          errs.push(
            `Row ${r.index} (${payload.item_code || payload.item_name}): ${
              err?.response?.data?.message || err?.message
            }`,
          );
        }
      }
      if (success > 0) {
        toast.success(`Uploaded ${success} items`);
        const res = await api.get("/inventory/items?all=1");
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      }
      if (failed > 0) {
        shouldClosePreview = false;
        toast.error(`Skipped ${failed} invalid rows`);
        if (errs.length) {
          alert(
            "Some rows failed:\n" +
              errs.slice(0, 10).join("\n") +
              (errs.length > 10 ? "\n..." : ""),
          );
        }
      }
    } finally {
      setUploading(false);
      // Keep preview open if any row failed so user can review and re-submit
      if (typeof shouldClosePreview === "undefined" || shouldClosePreview) {
        setPreviewOpen(false);
        setPreviewRows([]);
        setPreviewHeaders([]);
      }
    }
  };

  const downloadTemplateCSV = async () => {
    let taxCodes = [];
    let accItems = [];
    let itemTypes = [];
    let categories = [];
    let groups = [];
    let currencies = [];
    let uomList = [];
    let warehouses = [];

    try {
      const [taxRes, accRes, typeRes, catRes, grpRes, curRes, uomRes, whRes] =
        await Promise.all([
          api.get("/finance/tax-codes").catch(() => ({ data: { items: [] } })),
          api.get("/finance/accounts").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/item-types").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/item-categories").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/item-groups").catch(() => ({ data: { items: [] } })),
          api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/uoms").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/warehouses").catch(() => ({ data: { items: [] } })),
        ]);

      taxCodes = (Array.isArray(taxRes?.data?.items) ? taxRes.data.items : [])
        .map((t) => String(t.code || t.name || "").trim())
        .filter(Boolean);
      accItems = Array.isArray(accRes?.data?.items) ? accRes.data.items : [];
      itemTypes = (Array.isArray(typeRes?.data?.items) ? typeRes.data.items : [])
        .map((t) =>
          String(
            t.type_name || t.name || t.type_code || t.code || "",
          ).trim(),
        )
        .filter(Boolean);
      categories = (Array.isArray(catRes?.data?.items) ? catRes.data.items : [])
        .map((c) => String(c.category_name || c.category_code || "").trim())
        .filter(Boolean);
      groups = (Array.isArray(grpRes?.data?.items) ? grpRes.data.items : [])
        .map((g) => String(g.group_name || g.group_code || "").trim())
        .filter(Boolean);
      currencies = (Array.isArray(curRes?.data?.items) ? curRes.data.items : [])
        .map((c) => String(c.code || c.currency_code || "").trim())
        .filter(Boolean);
      uomList = (Array.isArray(uomRes?.data?.items) ? uomRes.data.items : [])
        .map((u) => String(u.uom_code || u.code || u.name || "").trim())
        .filter(Boolean);
      warehouses = (Array.isArray(whRes?.data?.items) ? whRes.data.items : Array.isArray(whRes?.data) ? whRes.data : [])
        .map((w) => String(w.warehouse_name || w.warehouse_code || "").trim())
        .filter(Boolean);
    } catch {
      // ignore; fallbacks below
    }

    if (!itemTypes.length) {
      itemTypes = [
        "Raw Material",
        "Finished Good",
        "Service",
        "Consumable",
        "Equipment",
        "Spare Part",
        "Asset",
      ];
    }
    if (!uomList.length) {
      uomList = [
        "PCS",
        "BOX",
        "KG",
        "L",
        "M",
        "PACK",
        "DOZEN",
        "SET",
        "ROLL",
        "BOTTLE",
        "CARTON",
        "BAG",
        "PAIR",
        "TIN",
        "LTR",
        "UNIT",
      ];
    }
    if (!currencies.length) {
      currencies = ["GHS", "USD", "EUR", "GBP", "NGN", "KES", "RMB", "CAD"];
    }
    if (!taxCodes.length) {
      taxCodes = ["No Tax", "VAT", "Standard", "Exempt", "Zero Rated"];
    }
    if (!warehouses.length) {
      warehouses = ["Main Warehouse"];
    }

    const samplePurchaseAccId = 36;
    const sampleSalesAccId = 1;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("ItemsTemplate");

    // Populate LookupData sheet for autocomplete & dropdown validation
    const lookupSheet = workbook.addWorksheet("LookupData");
    lookupSheet.getCell("A1").value = "ITEM_CATEGORY";
    lookupSheet.getCell("B1").value = "ITEM_GROUP";
    lookupSheet.getCell("C1").value = "UNIT_OF_MEASURE";
    lookupSheet.getCell("D1").value = "CURRENCY";
    lookupSheet.getCell("E1").value = "ITEM_TYPE";
    lookupSheet.getCell("F1").value = "TAX_CODE";
    lookupSheet.getCell("G1").value = "WAREHOUSE";

    categories.forEach((c, idx) => {
      lookupSheet.getCell(`A${idx + 2}`).value = c;
    });
    groups.forEach((g, idx) => {
      lookupSheet.getCell(`B${idx + 2}`).value = g;
    });
    uomList.forEach((u, idx) => {
      lookupSheet.getCell(`C${idx + 2}`).value = u;
    });
    currencies.forEach((cur, idx) => {
      lookupSheet.getCell(`D${idx + 2}`).value = cur;
    });
    itemTypes.forEach((t, idx) => {
      lookupSheet.getCell(`E${idx + 2}`).value = t;
    });
    taxCodes.forEach((tc, idx) => {
      lookupSheet.getCell(`F${idx + 2}`).value = tc;
    });
    warehouses.forEach((w, idx) => {
      lookupSheet.getCell(`G${idx + 2}`).value = w;
    });

    lookupSheet.state = "hidden";

    // Column definitions with all capitalized headings (asterisk on all required fields):
    worksheet.columns = [
      { header: "ITEM_CODE*", key: "ITEM_CODE", width: 18 },
      { header: "ITEM_NAME*", key: "ITEM_NAME", width: 26 },
      { header: "ITEM TYPE*", key: "ITEM_TYPE", width: 20 },
      { header: "ITEM CATEGORY*", key: "ITEM_CATEGORY", width: 22 },
      { header: "ITEM GROUP*", key: "ITEM_GROUP", width: 22 },
      { header: "UNIT OF MEASURE*", key: "BASE_UOM", width: 18 },
      { header: "BARCODE", key: "BARCODE", width: 18 },
      { header: "STANDARD_COST*", key: "STANDARD_COST", width: 16 },
      { header: "SELLING_PRICE*", key: "SELLING_PRICE", width: 16 },
      { header: "CURRENCY*", key: "CURRENCY_CODE", width: 14 },
      { header: "WAREHOUSE*", key: "WAREHOUSE", width: 22 },
      { header: "OPENING_QUANTITY", key: "OPENING_QUANTITY", width: 18 },
      { header: "PURCHASE VAT CODE*", key: "VAT_PURCHASE_CODE", width: 20 },
      { header: "SALES VAT CODE*", key: "VAT_SALES_CODE", width: 20 },
      { header: "PURCHASE_ACCOUNT_ID*", key: "PURCHASE_ACCOUNT_ID", width: 22 },
      { header: "SALES_ACCOUNT_ID*", key: "SALES_ACCOUNT_ID", width: 20 },
      { header: "MIN_STOCK_LEVEL", key: "MIN_STOCK_LEVEL", width: 18 },
      { header: "MAX_STOCK_LEVEL", key: "MAX_STOCK_LEVEL", width: 18 },
      { header: "REORDER_LEVEL", key: "REORDER_LEVEL", width: 16 },
      { header: "SAFETY_STOCK", key: "SAFETY_STOCK", width: 16 },
      { header: "DESCRIPTION", key: "DESCRIPTION", width: 26 },
      { header: "IS_STOCKABLE*", key: "IS_STOCKABLE", width: 15 },
      { header: "IS_SELLABLE*", key: "IS_SELLABLE", width: 15 },
      { header: "IS_PURCHASABLE*", key: "IS_PURCHASABLE", width: 16 },
      { header: "STATUS*", key: "STATUS", width: 14 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FF1E293B" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };

    // Add sample rows
    worksheet.addRow({
      ITEM_CODE: "RM-0001",
      ITEM_NAME: "Raw Material 1",
      ITEM_TYPE: itemTypes[0] || "Raw Material",
      ITEM_CATEGORY: categories[0] || "",
      ITEM_GROUP: groups[0] || "",
      BASE_UOM: uomList[0] || "PCS",
      BARCODE: "",
      STANDARD_COST: 100.0,
      SELLING_PRICE: 120.0,
      CURRENCY_CODE: currencies[0] || "GHS",
      WAREHOUSE: warehouses[0] || "",
      OPENING_QUANTITY: 50,
      VAT_PURCHASE_CODE: taxCodes[0] || "No Tax",
      VAT_SALES_CODE: taxCodes[0] || "No Tax",
      PURCHASE_ACCOUNT_ID: samplePurchaseAccId,
      SALES_ACCOUNT_ID: sampleSalesAccId,
      MIN_STOCK_LEVEL: 10,
      MAX_STOCK_LEVEL: 100,
      REORDER_LEVEL: 20,
      SAFETY_STOCK: 15,
      DESCRIPTION: "Sample raw material",
      IS_STOCKABLE: "Y",
      IS_SELLABLE: "Y",
      IS_PURCHASABLE: "Y",
      STATUS: "ACTIVE",
    });

    worksheet.addRow({
      ITEM_CODE: "FG-0001",
      ITEM_NAME: "Finished Good 1",
      ITEM_TYPE: itemTypes[1] || "Finished Good",
      ITEM_CATEGORY: categories[1] || categories[0] || "",
      ITEM_GROUP: groups[1] || groups[0] || "",
      BASE_UOM: uomList[0] || "PCS",
      BARCODE: "5060072082361",
      STANDARD_COST: 150.0,
      SELLING_PRICE: 180.0,
      CURRENCY_CODE: currencies[0] || "GHS",
      WAREHOUSE: warehouses[0] || "",
      OPENING_QUANTITY: 25,
      VAT_PURCHASE_CODE: taxCodes[0] || "No Tax",
      VAT_SALES_CODE: taxCodes[0] || "No Tax",
      PURCHASE_ACCOUNT_ID: samplePurchaseAccId,
      SALES_ACCOUNT_ID: sampleSalesAccId,
      MIN_STOCK_LEVEL: 5,
      MAX_STOCK_LEVEL: 50,
      REORDER_LEVEL: 10,
      SAFETY_STOCK: 8,
      DESCRIPTION: "Sample finished product",
      IS_STOCKABLE: "Y",
      IS_SELLABLE: "Y",
      IS_PURCHASABLE: "Y",
      STATUS: "ACTIVE",
    });

    worksheet.addRow({
      ITEM_CODE: "SRV-0001",
      ITEM_NAME: "Consulting Service 1",
      ITEM_TYPE: "Service",
      ITEM_CATEGORY: categories[0] || "",
      ITEM_GROUP: groups[0] || "",
      BASE_UOM: uomList[0] || "PCS",
      BARCODE: "",
      STANDARD_COST: 50.0,
      SELLING_PRICE: 100.0,
      CURRENCY_CODE: currencies[0] || "GHS",
      WAREHOUSE: warehouses[0] || "",
      OPENING_QUANTITY: 0,
      VAT_PURCHASE_CODE: taxCodes[0] || "No Tax",
      VAT_SALES_CODE: taxCodes[0] || "No Tax",
      PURCHASE_ACCOUNT_ID: samplePurchaseAccId,
      SALES_ACCOUNT_ID: sampleSalesAccId,
      MIN_STOCK_LEVEL: 0,
      MAX_STOCK_LEVEL: 0,
      REORDER_LEVEL: 0,
      SAFETY_STOCK: 0,
      DESCRIPTION: "Sample service item",
      IS_STOCKABLE: "N",
      IS_SELLABLE: "Y",
      IS_PURCHASABLE: "Y",
      STATUS: "ACTIVE",
    });

    const maxCatRow = Math.max(categories.length + 1, 2);
    const maxGrpRow = Math.max(groups.length + 1, 2);
    const maxUomRow = Math.max(uomList.length + 1, 2);
    const maxCurRow = Math.max(currencies.length + 1, 2);
    const maxTypeRow = Math.max(itemTypes.length + 1, 2);
    const maxTaxRow = Math.max(taxCodes.length + 1, 2);
    const maxWhRow = Math.max(warehouses.length + 1, 2);

    for (let r = 2; r <= 1000; r++) {
      // C: Item Type
      worksheet.getCell(`C${r}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [`LookupData!$E$2:$E$${maxTypeRow}`],
        showErrorMessage: true,
        errorTitle: "Invalid Item Type",
        error: "Please select a valid Item Type from the list.",
      };
      // D: Item Category
      if (categories.length > 0) {
        worksheet.getCell(`D${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`LookupData!$A$2:$A$${maxCatRow}`],
          showErrorMessage: true,
          errorTitle: "Invalid Item Category",
          error: "Please select an Item Category from the list.",
        };
      }
      // E: Item Group
      if (groups.length > 0) {
        worksheet.getCell(`E${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`LookupData!$B$2:$B$${maxGrpRow}`],
          showErrorMessage: true,
          errorTitle: "Invalid Item Group",
          error: "Please select an Item Group from the list.",
        };
      }
      // F: Unit of Measure
      worksheet.getCell(`F${r}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [`LookupData!$C$2:$C$${maxUomRow}`],
        showErrorMessage: true,
        errorTitle: "Invalid UOM",
        error: "Please select a valid Unit of Measure from the list.",
      };
      // J: Currency
      worksheet.getCell(`J${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`LookupData!$D$2:$D$${maxCurRow}`],
        showErrorMessage: true,
        errorTitle: "Invalid Currency",
        error: "Please select a Currency from the list.",
      };
      // K: Warehouse
      if (warehouses.length > 0) {
        worksheet.getCell(`K${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`LookupData!$G$2:$G$${maxWhRow}`],
          showErrorMessage: true,
          errorTitle: "Invalid Warehouse",
          error: "Please select a Warehouse from the list.",
        };
      }
      // M: Purchas Vat Code
      worksheet.getCell(`M${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`LookupData!$F$2:$F$${maxTaxRow}`],
        showErrorMessage: true,
        errorTitle: "Invalid Purchase VAT Code",
        error: "Please select a Purchase VAT Code from the list.",
      };
      // N: Sales Vat Code
      worksheet.getCell(`N${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`LookupData!$F$2:$F$${maxTaxRow}`],
        showErrorMessage: true,
        errorTitle: "Invalid Sales VAT Code",
        error: "Please select a Sales VAT Code from the list.",
      };
      // V: IS_STOCKABLE
      worksheet.getCell(`V${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Y,N"'],
      };
      // W: IS_SELLABLE
      worksheet.getCell(`W${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Y,N"'],
      };
      // X: IS_PURCHASABLE
      worksheet.getCell(`X${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Y,N"'],
      };
      // Y: STATUS
      worksheet.getCell(`Y${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"ACTIVE,INACTIVE"'],
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "items_bulk_upload_template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportItemsExcel = () => {
    const headers = [
      "ITEM_CODE",
      "ITEM_NAME",
      "ITEM_TYPE",
      "CATEGORY_NAME",
      "GROUP_NAME",
      "UOM",
      "BARCODE",
      "STOCK_LEVEL",
      "COST_PRICE",
      "SELLING_PRICE",
      "IS_ACTIVE",
    ];
    const rows = filtered.map((it) => [
      it.item_code ?? "",
      it.item_name ?? "",
      it.item_type ?? "",
      it.category_name ?? "",
      it.group_name ?? "",
      it.uom ?? "",
      it.barcode ?? "",
      it.stock_level ?? "",
      it.cost_price ?? "",
      it.selling_price ?? "",
      it.is_active ? "Y" : "N",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    autosizeWorksheetColumns(ws);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Items");
    XLSX.writeFile(wb, "items_export.xlsx");
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemType, status, hasBarcode, pageSize]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Items Master
              </h1>
              <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                Configure items, units of measure, pricing and barcodes
              </p>
            </div>
            <div className="flex gap-2.5 flex-wrap w-full md:w-auto justify-start md:justify-end items-center">
              <Link to="/inventory?section=Stock%20Operations">
                <Button variant="secondary" size="md">
                  Return to Menu
                </Button>
              </Link>
              <input
                type="file"
                ref={fileInputRef}
                onChange={processImport}
                className="hidden"
                accept=".xlsx,.xls,.csv"
              />
              {/* Bulk Operations Dropdown & Popover */}
              <div className="relative">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShowBulkOps((prev) => !prev)}
                  icon={<Layers className="w-4 h-4 text-slate-500" />}
                >
                  <span>Bulk Operations</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      showBulkOps ? "rotate-180" : ""
                    }`}
                  />
                </Button>

                {showBulkOps && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowBulkOps(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-apple-xl border border-slate-200/80 dark:border-slate-800 z-50 p-5 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-lg shadow-apple-xs">
                            <Layers className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                              Bulk Operations
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Import, export, or download template
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowBulkOps(false)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          aria-label="Close"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-4 space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowBulkOps(false);
                            handleBulkUpload();
                          }}
                          className="w-full flex items-center gap-3 p-3 text-left rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-brand-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group active:scale-[0.99]"
                        >
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Upload className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-700 dark:group-hover:text-brand-300">
                              Bulk Upload
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              Upload Excel or CSV file with items
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowBulkOps(false);
                            downloadTemplateCSV();
                          }}
                          className="w-full flex items-center gap-3 p-3 text-left rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-brand-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group active:scale-[0.99]"
                        >
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-700 dark:group-hover:text-brand-300">
                              Download Template (Excel)
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              Get pre-formatted spreadsheet with lookups
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowBulkOps(false);
                            exportItemsExcel();
                          }}
                          className="w-full flex items-center gap-3 p-3 text-left rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-brand-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group active:scale-[0.99]"
                        >
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-brand-700 dark:text-brand-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Download className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-700 dark:group-hover:text-brand-300">
                              Export Items (Excel)
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              Export all items into an Excel workbook
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <Link to="/inventory/items/new">
                <Button variant="prominent" size="md" icon={<Plus className="w-4 h-4" />}>
                  New Item
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="card-body">
          {error ? (
            <div className="text-sm text-red-600 mb-4">{error}</div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <div className="col-span-2">
              <input
                type="text"
                placeholder="Search by code, name, barcode..."
                className="input w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <select
                className="input w-full"
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="RAW_MATERIAL">Raw Material</option>
                <option value="PRODUCTION_ITEM">Production Item</option>
                <option value="FIXED_ASSET">Fixed Asset</option>
                <option value="FINISHED_GOOD">Finished Good</option>
                <option value="SEMI_FINISHED">Semi-Finished</option>
                <option value="CONSUMABLE">Consumable</option>
                <option value="SERVICE">Service</option>
              </select>
            </div>
            <div>
              <select
                className="input w-full"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="Y">Active</option>
                <option value="N">Inactive</option>
              </select>
            </div>
            <div>
              <select
                className="input w-full"
                value={hasBarcode}
                onChange={(e) => setHasBarcode(e.target.value)}
              >
                <option value="">All</option>
                <option value="Y">With Barcode</option>
                <option value="N">Without Barcode</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-apple-xs flex flex-col justify-between">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Items</div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">{stats.total}</div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-apple-xs flex flex-col justify-between">
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Items</div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">{stats.active}</div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-apple-xs flex flex-col justify-between">
              <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Low Stock</div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">{stats.lowStock}</div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-apple-xs flex flex-col justify-between">
              <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Inactive Items</div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">{stats.inactive}</div>
            </div>
          </div>

          <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-slate-600">
              Showing {Math.min(pageItems.length, filtered.length)} of{" "}
              {filtered.length} items
            </div>
            <div>
              <select
                className="input"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          </div>

          
                <div className="flex justify-end mb-4">
                  <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                <div className="overflow-x-auto">
            <table className={"table " + (viewMode === 'grid' ? 'table-grid-mode' : '')}>
              <thead>
                <tr>
                  <SortableHeader
                    label="Item Code"
                    sortKey="item_code"
                    currentKey={sort.key}
                    direction={sort.asc ? "asc" : "desc"}
                    onToggle={onSort}
                  />
                  <SortableHeader
                    label="Item Name"
                    sortKey="item_name"
                    currentKey={sort.key}
                    direction={sort.asc ? "asc" : "desc"}
                    onToggle={onSort}
                  />
                  <SortableHeader
                    label="Type"
                    sortKey="item_type"
                    currentKey={sort.key}
                    direction={sort.asc ? "asc" : "desc"}
                    onToggle={onSort}
                  />
                  <SortableHeader
                    label="Category"
                    sortKey="category_name"
                    currentKey={sort.key}
                    direction={sort.asc ? "asc" : "desc"}
                    onToggle={onSort}
                  />
                  <SortableHeader
                    label="Group"
                    sortKey="group_name"
                    currentKey={sort.key}
                    direction={sort.asc ? "asc" : "desc"}
                    onToggle={onSort}
                  />
                  <SortableHeader
                    label="UOM"
                    sortKey="uom"
                    currentKey={sort.key}
                    direction={sort.asc ? "asc" : "desc"}
                    onToggle={onSort}
                  />
                  <th>Barcode</th>
                  <th>Actions</th>
                  <SortableHeader
                    label="Stock Level"
                    sortKey="stock_level"
                    currentKey={sort.key}
                    direction={sort.asc ? "asc" : "desc"}
                    onToggle={onSort}
                  />
                  <SortableHeader
                    label="Std Cost"
                    sortKey="cost_price"
                    currentKey={sort.key}
                    direction={sort.asc ? "asc" : "desc"}
                    onToggle={onSort}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Sell Price"
                    sortKey="selling_price"
                    currentKey={sort.key}
                    direction={sort.asc ? "asc" : "desc"}
                    onToggle={onSort}
                    className="text-right"
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="is_active"
                    currentKey={sort.key}
                    direction={sort.asc ? "asc" : "desc"}
                    onToggle={onSort}
                  />
                  <th>Created By</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan="14"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : null}
                {!loading && !pageItems.length ? (
                  <tr>
                    <td
                      colSpan="14"
                      className="text-center py-8 text-slate-500 dark:text-slate-400"
                    >
                      No items found
                    </td>
                  </tr>
                ) : null}
                {pageItems.map((it) => (
                  <tr key={it.id}>
                    <td className="font-medium text-brand-700 dark:text-brand-300">
                      {it.item_code}
                    </td>
                    <td>{it.item_name}</td>
                    <td>{it.item_type_name || it.item_type || "-"}</td>
                    <td>{it.category_name || "-"}</td>
                    <td>{it.group_name || "-"}</td>
                    <td>{it.uom}</td>
                    <td>{it.barcode || "-"}</td>
                    <td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Link
                          to={`/inventory/items/${it.id}?mode=view`}
                          className="inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 rounded-lg transition-all active:scale-95"
                        >
                          View
                        </Link>
                        <Link
                          to={`/inventory/items/${it.id}?mode=edit`}
                          className="inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/40 hover:bg-brand-100 dark:hover:bg-brand-900/70 rounded-lg transition-all active:scale-95"
                        >
                          Edit
                        </Link>
                        {it.is_active ? (
                          <button
                            onClick={() => handleToggleStatus(it, false)}
                            className="inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 rounded-lg transition-all active:scale-95"
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(it, true)}
                            className="inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-all active:scale-95"
                          >
                            Enable
                          </button>
                        )}
                      </div>
                    </td>
                    <td>{it.stock_level ?? "-"}</td>
                    <td className="text-right">
                      {Number(it.cost_price || 0).toFixed(2)}
                    </td>
                    <td className="text-right">
                      {Number(it.selling_price || 0).toFixed(2)}
                    </td>
                    <td>
                      <Badge
                        variant={it.is_active ? "success" : "neutral"}
                        size="sm"
                        dot
                      >
                        {it.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td>{it.created_by_name || "-"}</td>
                    <td>
                      {it.created_at
                        ? new Date(it.created_at).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center py-3 border-t gap-4">
            <div className="text-sm text-slate-600 order-2 md:order-1">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2 items-center order-1 md:order-2">
              <button
                className="btn-success"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
              >
                ««
              </button>
              <button
                className="btn-success"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                «
              </button>
              <span className="text-sm">
                {(currentPage - 1) * pageSize + 1}-
                {Math.min(currentPage * pageSize, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <button
                className="btn-success"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
              >
                »
              </button>
              <button
                className="btn-success"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                »»
              </button>
            </div>
          </div>
        </div>
      </div>
      {previewOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="w-[96vw] max-w-[1100px] max-h-[85vh] bg-white rounded-xl shadow-erp-lg overflow-hidden border border-slate-200">
            <div className="px-4 py-3 bg-brand text-white flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">Bulk Upload Preview</div>
                <div className="text-xs opacity-90">
                  Review parsed rows. Only valid rows will be uploaded.
                </div>
              </div>
              <button
                type="button"
                className="text-white hover:text-slate-100 text-xl"
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewRows([]);
                  setPreviewHeaders([]);
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-sm">
                {(() => {
                  const total = previewRows.length;
                  const invalid = previewRows.filter((r) => !r.valid).length;
                  if (invalid > 0) {
                    return (
                      <div className="mb-2 text-red-700">
                        {invalid} of {total} rows have issues (unknown
                        category/group/item type). Fix or proceed to upload only
                        valid rows.
                      </div>
                    );
                  }
                  return (
                    <div className="mb-2 text-green-700">
                      All {total} rows look valid.
                    </div>
                  );
                })()}
              </div>
              <div className="overflow-auto" style={{ maxHeight: "55vh" }}>
                <div className="min-w-[960px]">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        {previewHeaders.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r) => (
                        <tr
                          key={r.index}
                          className={r.valid ? "" : "bg-red-50"}
                        >
                          <td>{r.index}</td>
                          <td>{r.preview.item_code || "-"}</td>
                          <td>{r.preview.item_name || "-"}</td>
                          <td>{r.preview.item_type || "-"}</td>
                          <td>{r.preview.warehouse_label || "-"}</td>
                          <td>{r.preview.opening_quantity || 0}</td>
                          <td>{r.preview.category_label || "-"}</td>
                          <td>{r.preview.category_name || "-"}</td>
                          <td>{r.preview.group_label || "-"}</td>
                          <td>{r.preview.group_name || "-"}</td>
                          <td>{r.preview.uom || "-"}</td>
                          <td>{r.preview.barcode || "-"}</td>
                          <td>
                            {r.valid ? (
                              <span className="text-green-700 font-medium">
                                OK
                              </span>
                            ) : (
                              <span className="text-red-700 text-sm">
                                {r.errors.join("; ")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setPreviewOpen(false);
                    setPreviewRows([]);
                    setPreviewHeaders([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="prominent"
                  size="md"
                  onClick={confirmUpload}
                  loading={uploading}
                >
                  {uploading ? "Uploading..." : "Upload Valid Rows"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
