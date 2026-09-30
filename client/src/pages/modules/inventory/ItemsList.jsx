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

      // Build lookup maps for category/group/currency/tax/account codes -> IDs
      let categoryCodeToId = new Map();
      let categoryIdToName = new Map();
      let groupCodeToId = new Map();
      let groupIdToName = new Map();
      let currencyCodeToId = new Map();
      let taxCodeToId = new Map();
      let accountCodeToId = new Map();
      let priceTypeNameToId = new Map();
      let itemTypeSet = new Set();
      let itemTypeCodeToCode = new Map();
      let itemTypeNameToCode = new Map();
      try {
        const [catRes, grpRes, curRes, taxRes, accRes, typeRes, ptRes] =
          await Promise.all([
            api.get("/inventory/item-categories"),
            api.get("/inventory/item-groups"),
            api.get("/finance/currencies"),
            api.get("/finance/tax-codes"),
            api.get("/finance/accounts"),
            api.get("/inventory/item-types"),
            api.get("/sales/price-types?active=true"),
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
        // Only annotate (do not block) basic issues; server will decide final result
        const nameUpper = String(rowData.ITEM_NAME || "").toUpperCase();
        if (!nameUpper) errorsRow.push("Missing ITEM_NAME");
        // Validate category, group, and item type
        const categoryProvided =
          String(
            rowData.ITEM_CATEGORY ||
              rowData.ITEM_CATEGORY_CODE ||
              rowData.ITEM_CATEGORY_ID ||
              "",
          ).trim() !== "";
        const groupProvided =
          String(
            rowData.ITEM_GROUP ||
              rowData.ITEM_GROUP_CODE ||
              rowData.ITEM_GROUP_ID ||
              "",
          ).trim() !== "";
        if (categoryProvided && !categoryResolved) {
          errorsRow.push("Unknown CATEGORY (no match in system)");
        }
        if (groupProvided && !groupResolved) {
          errorsRow.push("Unknown GROUP (no match in system)");
        }
        if (String(itemTypeRaw || "") && !itemTypeValid) {
          errorsRow.push("Unknown ITEM_TYPE (no match in system)");
        }
        if (nameUpper) seenNames.add(nameUpper);
        rows.push({
          index: i + 1,
          raw: rowData,
          preview: {
            item_code: nextItemCode,
            item_name: rowData.ITEM_NAME,
            item_type: itemTypeResolved || itemTypeRaw || "",
            category_id: categoryResolved,
            item_group_id: groupResolved,
            category_label: String(categoryLabel),
            group_label: String(groupLabel),
            category_name: categoryName,
            group_name: groupName,
            uom: rowData.BASE_UOM || "PCS",
            barcode: barcodeExpanded,
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
      const priceTypeNameToId = new Map();
      try {
        const [curRes, taxRes, ptRes] = await Promise.all([
          api.get("/finance/currencies"),
          api.get("/finance/tax-codes"),
          api.get("/sales/price-types?active=true"),
        ]);
        const curs = Array.isArray(curRes?.data?.items) ? curRes.data.items : [];
        const taxes = Array.isArray(taxRes?.data?.items) ? taxRes.data.items : [];
        const pts = Array.isArray(ptRes?.data?.items) ? ptRes.data.items : [];
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
        pts.forEach((p) => {
          const id = Number(p.id);
          const name = String(p.name || "").toUpperCase();
          if (id > 0 && name) priceTypeNameToId.set(name, id);
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
            currency_code: rowData.CURRENCY_CODE || rowData.CURRENCY || "",
            price_type: rowData.PRICE_TYPE || "",
            price_type_name: rowData.PRICE_TYPE_NAME || "",
            image_url: rowData.IMAGE_URL || rowData.IMAGE || "",
            vat_on_purchase_code:
              rowData.VAT_ON_PURCHASE || rowData.VAT_PURCHASE_CODE || "",
            purchase_account_id:
              Number(rowData.PURCHASE_ACCOUNT_ID || 0) || null,
            sales_account_id: Number(rowData.SALES_ACCOUNT_ID || 0) || null,
            vat_on_sales_code:
              rowData.VAT_ON_SALES || rowData.VAT_SALES_CODE || "",
            purchase_account_code:
              rowData.PURCHASE_ACCOUNT_CODE || rowData.PURCHASE_ACCOUNT || "",
            sales_account_code:
              rowData.SALES_ACCOUNT_CODE || rowData.SALES_ACCOUNT || "",
            is_sellable: rowData.IS_SELLABLE === "Y",
            is_purchasable: rowData.IS_PURCHASABLE === "Y",
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
            toast.success(`Uploaded ${inserted} new, updated ${updated}`);
            const res = await api.get("/inventory/items?all=1");
            setItems(Array.isArray(res.data?.items) ? res.data.items : []);
          }
          if (failed) {
            toast.error(`Skipped ${failed} rows`);
            const errs = Array.isArray(resp?.data?.errors)
              ? resp.data.errors
              : [];
            if (errs.length) {
              alert(
                "Some rows failed:\n" +
                  errs
                    .slice(0, 10)
                    .map(
                      (e) =>
                        `Row ${e.index} (${e.item_name || "-"}) - ${e.message}`,
                    )
                    .join("\n") +
                  (errs.length > 10 ? "\n..." : ""),
              );
            }
          }
          return;
        } catch (bulkErr) {
          // Fallback to per-row upload when bulk endpoint is unavailable or fails
          console.error("Bulk upload failed, falling back to per-row:", bulkErr);
        }
      }
      let success = 0;
      let failed = 0;
      const errs = [];
      // Build quick lookup of existing items by name for update fallback
      const nameToId = new Map(
        (Array.isArray(items) ? items : [])
          .filter((it) => it && it.id && it.item_name)
          .map((it) => [
            String(it.item_name || "").toUpperCase(),
            Number(it.id),
          ]),
      );
      for (const r of previewRows.filter((x) => x && x.valid)) {
        const rowData = r.raw;
        let nextItemCode = rowData.ITEM_CODE;
        if (!nextItemCode) {
          nextItemCode = await getNextItemCode(r.index || 0);
        }
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
          currency_code: rowData.CURRENCY_CODE || rowData.CURRENCY || null,
          vat_on_purchase_code:
            rowData.VAT_ON_PURCHASE || rowData.VAT_PURCHASE_CODE || null,
          vat_on_sales_code:
            rowData.VAT_ON_SALES || rowData.VAT_SALES_CODE || null,
          purchase_account_code:
            rowData.PURCHASE_ACCOUNT_CODE || rowData.PURCHASE_ACCOUNT || null,
          sales_account_code:
            rowData.SALES_ACCOUNT_CODE || rowData.SALES_ACCOUNT || null,
          uom: rowData.BASE_UOM,
          barcode: r.preview.barcode || null,
          cost_price: Number(rowData.STANDARD_COST) || 0,
          selling_price: Number(rowData.SELLING_PRICE) || 0,
          currency_id:
            currencyCodeToId.get(
              String(
                rowData.CURRENCY_ID ||
                  rowData.CURRENCY_CODE ||
                  rowData.CURRENCY ||
                  "",
              ).toUpperCase(),
            ) || null,
          price_type_id:
            priceTypeNameToId.get(
              String(
                rowData.PRICE_TYPE || rowData.PRICE_TYPE_NAME || "",
              ).toUpperCase(),
            ) ||
            Number(rowData.PRICE_TYPE_ID || 0) ||
            null,
          image_url: rowData.IMAGE_URL || rowData.IMAGE || null,
          vat_on_purchase_id:
            taxCodeToId.get(
              String(
                rowData.VAT_ON_PURCHASE_ID ||
                  rowData.VAT_ON_PURCHASE ||
                  rowData.VAT_PURCHASE ||
                  rowData.VAT_PURCHASE_CODE ||
                  "",
              ).toUpperCase(),
            ) || null,
          vat_on_sales_id:
            taxCodeToId.get(
              String(
                rowData.VAT_ON_SALES_ID ||
                  rowData.VAT_ON_SALES ||
                  rowData.VAT_SALES ||
                  rowData.VAT_SALES_CODE ||
                  "",
              ).toUpperCase(),
            ) || null,
          purchase_account_id: Number(rowData.PURCHASE_ACCOUNT_ID || 0) || null,
          sales_account_id: Number(rowData.SALES_ACCOUNT_ID || 0) || null,
          description: rowData.DESCRIPTION,
          is_stockable: rowData.IS_STOCKABLE === "Y",
          is_sellable: rowData.IS_SELLABLE === "Y",
          is_purchasable: rowData.IS_PURCHASABLE === "Y",
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
            status === 409 &&
            String(code).toUpperCase() === "DUPLICATE_ITEM_NAME"
          ) {
            // Fallback to update existing item by name
            const key = String(payload.item_name || "").toUpperCase();
            let itemId = nameToId.get(key);
            if (!itemId) {
              try {
                const resAll = await api.get("/inventory/items?all=1", {
                  __skipOfflineQueue: true,
                });
                const arr = Array.isArray(resAll.data?.items)
                  ? resAll.data.items
                  : [];
                for (const it of arr) {
                  const nm = String(it.item_name || "").toUpperCase();
                  if (!nameToId.has(nm)) nameToId.set(nm, Number(it.id));
                }
                itemId = nameToId.get(key);
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

    try {
      const [taxRes, accRes, typeRes, catRes, grpRes, curRes, uomRes] =
        await Promise.all([
          api.get("/finance/tax-codes").catch(() => ({ data: { items: [] } })),
          api.get("/finance/accounts").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/item-types").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/item-categories").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/item-groups").catch(() => ({ data: { items: [] } })),
          api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/uoms").catch(() => ({ data: { items: [] } })),
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

    lookupSheet.state = "hidden";

    // Column definitions with all capitalized headings:
    worksheet.columns = [
      { header: "ITEM_NAME*", key: "ITEM_NAME", width: 26 },
      { header: "ITEM TYPE*", key: "ITEM_TYPE", width: 20 },
      { header: "ITEM CATEGORY", key: "ITEM_CATEGORY", width: 22 },
      { header: "ITEM GROUP", key: "ITEM_GROUP", width: 22 },
      { header: "UNIT OF MEASURE*", key: "BASE_UOM", width: 18 },
      { header: "BARCODE", key: "BARCODE", width: 18 },
      { header: "STANDARD_COST", key: "STANDARD_COST", width: 16 },
      { header: "SELLING_PRICE", key: "SELLING_PRICE", width: 16 },
      { header: "CURRENCY", key: "CURRENCY_CODE", width: 14 },
      { header: "PURCHAS VAT CODE", key: "VAT_PURCHASE_CODE", width: 20 },
      { header: "SALES VAT CODE", key: "VAT_SALES_CODE", width: 20 },
      { header: "PURCHASE_ACCOUNT_ID", key: "PURCHASE_ACCOUNT_ID", width: 22 },
      { header: "SALES_ACCOUNT_ID", key: "SALES_ACCOUNT_ID", width: 20 },
      { header: "DESCRIPTION", key: "DESCRIPTION", width: 26 },
      { header: "IS_STOCKABLE", key: "IS_STOCKABLE", width: 15 },
      { header: "IS_SELLABLE", key: "IS_SELLABLE", width: 15 },
      { header: "IS_PURCHASABLE", key: "IS_PURCHASABLE", width: 16 },
      { header: "MIN_STOCK_LEVEL", key: "MIN_STOCK_LEVEL", width: 18 },
      { header: "MAX_STOCK_LEVEL", key: "MAX_STOCK_LEVEL", width: 18 },
      { header: "REORDER_LEVEL", key: "REORDER_LEVEL", width: 16 },
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
      ITEM_NAME: "Raw Material 1",
      ITEM_TYPE: itemTypes[0] || "Raw Material",
      ITEM_CATEGORY: categories[0] || "",
      ITEM_GROUP: groups[0] || "",
      BASE_UOM: uomList[0] || "PCS",
      BARCODE: "",
      STANDARD_COST: 100.0,
      SELLING_PRICE: 120.0,
      CURRENCY_CODE: currencies[0] || "GHS",
      VAT_PURCHASE_CODE: taxCodes[0] || "No Tax",
      VAT_SALES_CODE: taxCodes[0] || "No Tax",
      PURCHASE_ACCOUNT_ID: samplePurchaseAccId,
      SALES_ACCOUNT_ID: sampleSalesAccId,
      DESCRIPTION: "Sample raw material",
      IS_STOCKABLE: "Y",
      IS_SELLABLE: "Y",
      IS_PURCHASABLE: "Y",
      MIN_STOCK_LEVEL: 10,
      MAX_STOCK_LEVEL: 100,
      REORDER_LEVEL: 20,
    });

    worksheet.addRow({
      ITEM_NAME: "Finished Good 1",
      ITEM_TYPE: itemTypes[1] || "Finished Good",
      ITEM_CATEGORY: categories[1] || categories[0] || "",
      ITEM_GROUP: groups[1] || groups[0] || "",
      BASE_UOM: uomList[0] || "PCS",
      BARCODE: "5060072082361",
      STANDARD_COST: 150.0,
      SELLING_PRICE: 180.0,
      CURRENCY_CODE: currencies[0] || "GHS",
      VAT_PURCHASE_CODE: taxCodes[0] || "No Tax",
      VAT_SALES_CODE: taxCodes[0] || "No Tax",
      PURCHASE_ACCOUNT_ID: samplePurchaseAccId,
      SALES_ACCOUNT_ID: sampleSalesAccId,
      DESCRIPTION: "Sample finished product",
      IS_STOCKABLE: "Y",
      IS_SELLABLE: "Y",
      IS_PURCHASABLE: "Y",
      MIN_STOCK_LEVEL: 5,
      MAX_STOCK_LEVEL: 50,
      REORDER_LEVEL: 10,
    });

    const maxCatRow = Math.max(categories.length + 1, 2);
    const maxGrpRow = Math.max(groups.length + 1, 2);
    const maxUomRow = Math.max(uomList.length + 1, 2);
    const maxCurRow = Math.max(currencies.length + 1, 2);
    const maxTypeRow = Math.max(itemTypes.length + 1, 2);
    const maxTaxRow = Math.max(taxCodes.length + 1, 2);

    for (let r = 2; r <= 1000; r++) {
      // B: Item Type
      worksheet.getCell(`B${r}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [`LookupData!$E$2:$E$${maxTypeRow}`],
        showErrorMessage: true,
        errorTitle: "Invalid Item Type",
        error: "Please select a valid Item Type from the list.",
      };
      // C: Item Category
      if (categories.length > 0) {
        worksheet.getCell(`C${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`LookupData!$A$2:$A$${maxCatRow}`],
          showErrorMessage: true,
          errorTitle: "Invalid Item Category",
          error: "Please select an Item Category from the list.",
        };
      }
      // D: Item Group
      if (groups.length > 0) {
        worksheet.getCell(`D${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`LookupData!$B$2:$B$${maxGrpRow}`],
          showErrorMessage: true,
          errorTitle: "Invalid Item Group",
          error: "Please select an Item Group from the list.",
        };
      }
      // E: Unit of Measure
      worksheet.getCell(`E${r}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [`LookupData!$C$2:$C$${maxUomRow}`],
        showErrorMessage: true,
        errorTitle: "Invalid UOM",
        error: "Please select a valid Unit of Measure from the list.",
      };
      // I: Currency
      worksheet.getCell(`I${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`LookupData!$D$2:$D$${maxCurRow}`],
        showErrorMessage: true,
        errorTitle: "Invalid Currency",
        error: "Please select a Currency from the list.",
      };
      // J: Purchas Vat Code
      worksheet.getCell(`J${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`LookupData!$F$2:$F$${maxTaxRow}`],
        showErrorMessage: true,
        errorTitle: "Invalid Purchase VAT Code",
        error: "Please select a Purchase VAT Code from the list.",
      };
      // K: Sales Vat Code
      worksheet.getCell(`K${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`LookupData!$F$2:$F$${maxTaxRow}`],
        showErrorMessage: true,
        errorTitle: "Invalid Sales VAT Code",
        error: "Please select a Sales VAT Code from the list.",
      };
      // O: IS_STOCKABLE
      worksheet.getCell(`O${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Y,N"'],
      };
      // P: IS_SELLABLE
      worksheet.getCell(`P${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Y,N"'],
      };
      // Q: IS_PURCHASABLE
      worksheet.getCell(`Q${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Y,N"'],
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
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Items Master
              </h1>
              <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                Configure items, UOM, pricing and barcodes
              </p>
            </div>
            <div className="flex gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
              <Link to="/inventory?section=Stock%20Operations" className="btn-secondary">
                Return to Menu
              </Link>
              <input
                type="file"
                ref={fileInputRef}
                onChange={processImport}
                className="hidden"
                accept=".xlsx,.xls,.csv"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleBulkUpload}
              >
                Bulk Upload
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={downloadTemplateCSV}
              >
                Download Template (Excel)
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={exportItemsExcel}
              >
                Export Items (Excel)
              </button>
              <Link to="/inventory/items/new" className="btn-primary">
                + New Item
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 bg-white rounded border">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-slate-500">Total Items</div>
            </div>
            <div className="p-3 bg-white rounded border">
              <div className="text-2xl font-bold">{stats.active}</div>
              <div className="text-sm text-slate-500">Active Items</div>
            </div>
            <div className="p-3 bg-white rounded border">
              <div className="text-2xl font-bold">{stats.lowStock}</div>
              <div className="text-sm text-slate-500">Low Stock</div>
            </div>
            <div className="p-3 bg-white rounded border">
              <div className="text-2xl font-bold">{stats.inactive}</div>
              <div className="text-sm text-slate-500">Inactive Items</div>
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
                          className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          View
                        </Link>
                        <Link
                          to={`/inventory/items/${it.id}?mode=edit`}
                          className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          Edit
                        </Link>
                        {it.is_active ? (
                          <button
                            onClick={() => handleToggleStatus(it, false)}
                            className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-full hover:bg-red-100 hover:text-red-700 transition-colors"
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(it, true)}
                            className="inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
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
                      <span
                        className={`badge ${
                          it.is_active ? "badge-success" : "badge-error"
                        }`}
                      >
                        {it.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
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
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setPreviewOpen(false);
                    setPreviewRows([]);
                    setPreviewHeaders([]);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-success"
                  onClick={confirmUpload}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload Valid Rows"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
