/**
 * @fileoverview Form component for creating or editing an inventory item.
 * Captures extensive item properties including pricing, stock thresholds, and categorization.
 */

import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { useAuth } from "../../../auth/AuthContext.jsx";
import { readStoredAuth } from "../../../auth/authStorage.js";

function findTaxExemptId(taxList) {
  if (!Array.isArray(taxList) || taxList.length === 0) return "";
  const found =
    taxList.find((t) => {
      const code = String(t.code || "").toUpperCase();
      const name = String(t.name || "").toUpperCase();
      return code.includes("EXEMPT") || name.includes("EXEMPT");
    }) ||
    taxList.find((t) => {
      const code = String(t.code || "").toUpperCase();
      const name = String(t.name || "").toUpperCase();
      return code.includes("ZERO") || name.includes("ZERO") || code.includes("NO TAX") || name.includes("NO TAX");
    }) ||
    taxList.find((t) => Number(t.rate_percent) === 0);
  return found ? String(found.id) : "";
}

function findInventoryTypeCode(typesList) {
  if (!Array.isArray(typesList) || typesList.length === 0) return "INVENTORY";
  const found = typesList.find((t) => {
    const code = String(t.type_code || t.code || t.item_type || "").toUpperCase();
    const name = String(t.type_name || t.name || "").toUpperCase();
    return code === "INVENTORY" || name.includes("INVENTORY") || code.includes("INVENTORY");
  });
  return found ? (found.type_code || found.code || found.type_name || found.item_type || "INVENTORY") : "INVENTORY";
}

/**
 * ItemForm component
 * Manages the data entry for a single item, resolving lookups (categories, groups, UOMs)
 * on mount to populate select fields.
 * 
 * @returns {JSX.Element} The item form view.
 */
export default function ItemForm({ isModal = false, modalItemId, onClose, onSaveSuccess, isProductionMode = false }) {
  const { user, scope } = useAuth() || {};
  const storedAuth = typeof window !== "undefined" ? readStoredAuth() : null;
  const activeBranchId =
    scope?.branchId ||
    scope?.branch?.id ||
    user?.branchId ||
    user?.branch_id ||
    user?.branch?.id ||
    user?.branchIds?.[0] ||
    storedAuth?.scope?.branchId ||
    storedAuth?.scope?.branch?.id ||
    storedAuth?.user?.branchId ||
    storedAuth?.user?.branch_id ||
    storedAuth?.user?.branch?.id ||
    storedAuth?.user?.branchIds?.[0] ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("active_branch_id") : "") ||
    "";
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isViewMode = searchParams.get("mode") === "view";
  const id = isModal ? (modalItemId || "new") : params.id;
  const isNew = id === "new";
  const returnTo = location.state?.from || "/inventory/items";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [branches, setBranches] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [itemTypes, setItemTypes] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [formData, setFormData] = useState({
    item_code: "",
    item_name: "",
    branch_id: activeBranchId ? String(activeBranchId) : "",
    uom: "PCS",
    barcode: "",
    cost_price: 0,
    selling_price: 0,
    currency_id: "1",
    image_url: "",
    is_active: true,
    item_type: "INVENTORY",
    category_id: "",
    item_group_id: "",
    description: "",
    min_stock_level: 0,
    max_stock_level: 0,
    reorder_level: 0,
    safety_stock: 0,
    vat_on_purchase_id: "",
    vat_on_sales_id: "",
    purchase_account_id: "",
    sales_account_id: "",
    service_item: false,
    is_stockable: true,
    is_sellable: true,
    is_purchasable: true,
    is_production_item: isProductionMode ? true : false,
    opening_quantity: 0,
    opening_warehouse_id: "",
  });

  useEffect(() => {
    let cancelled = false;
    async function loadLookups() {
      setLookupLoading(true);
      if (isNew) {
        api.get("/inventory/warehouses").then(r => {
          if (Array.isArray(r.data?.items)) setWarehouses(r.data.items);
        }).catch(() => {});
      }
      try {
        const res = await api.get("/inventory/item-setup-lookups");
        console.log("Consolidated lookup response:", res.data);
        if (cancelled) return;
        const d = res.data || {};
        const loadedItemGroups = Array.isArray(d.itemGroups)
          ? d.itemGroups
          : [];
        const loadedCategories = Array.isArray(d.categories)
          ? d.categories
          : [];
        const loadedUoms = Array.isArray(d.uoms)
          ? d.uoms
          : Array.isArray(d.uom)
            ? d.uom
            : [];
        const loadedItemTypes = Array.isArray(d.itemTypes)
          ? d.itemTypes
          : Array.isArray(d.item_types)
            ? d.item_types
            : [];
        setItemGroups(loadedItemGroups);
        const loadedBranches = Array.isArray(d.branches) ? d.branches : [];
        setBranches(loadedBranches);
        if (isNew && loadedBranches.length) {
          const matchedBranch =
            (activeBranchId &&
              loadedBranches.find(
                (b) =>
                  String(b.id) === String(activeBranchId) ||
                  Number(b.id) === Number(activeBranchId) ||
                  (b.code && String(b.code).toLowerCase() === String(activeBranchId).toLowerCase()) ||
                  (b.name && String(b.name).toLowerCase() === String(activeBranchId).toLowerCase())
              )) ||
            loadedBranches[0];
          if (matchedBranch) {
            setFormData((prev) => ({
              ...prev,
              branch_id: String(matchedBranch.id),
            }));
          }
        }
        const accs = Array.isArray(d.accounts) ? d.accounts : [];
        setAccounts(accs);
        if (isNew) {
          setFormData((prev) => ({
            ...prev,
            purchase_account_id: "36",
            sales_account_id: "123",
          }));
        }
        const taxList = Array.isArray(d.taxes) ? d.taxes : [];
        setTaxes(taxList);
        if (isNew) {
          const exemptTaxId = findTaxExemptId(taxList);
          if (exemptTaxId) {
            setFormData((prev) => ({
              ...prev,
              vat_on_purchase_id: prev.vat_on_purchase_id || exemptTaxId,
              vat_on_sales_id: prev.vat_on_sales_id || exemptTaxId,
            }));
          }
        }
        const curList = Array.isArray(d.currencies) ? d.currencies : [];
        setCurrencies(curList);
        const ghsCur =
          curList.find(
            (c) =>
              String(c.code || "").toUpperCase() === "GHS" ||
              String(c.name || "").toLowerCase().includes("ghana")
          ) ||
          curList.find((c) => Number(c.is_base) === 1 || c.is_base === true) ||
          curList[0];
        if (isNew && ghsCur) {
          setFormData((prev) => ({ ...prev, currency_id: String(ghsCur.id) }));
        }
        setUoms(loadedUoms);
        if (isNew) {
          const pcsUom = loadedUoms.find(
            (u) =>
              String(u.uom_code || u.code || u.uom || "").toUpperCase() === "PCS"
          );
          if (pcsUom) {
            setFormData((prev) => ({
              ...prev,
              uom: pcsUom.uom_code || pcsUom.code || pcsUom.uom || "PCS",
            }));
          }
        }
        setCategories(loadedCategories);
        setItemTypes(loadedItemTypes);
        if (isNew) {
          const invTypeCode = findInventoryTypeCode(loadedItemTypes);
          if (invTypeCode) {
            setFormData((prev) => ({
              ...prev,
              item_type: prev.item_type && prev.item_type !== "INVENTORY" ? prev.item_type : invTypeCode,
            }));
          }
        }

        // Hard fallback for environments where consolidated lookups return empty
        if (
          loadedItemGroups.length === 0 ||
          loadedCategories.length === 0 ||
          loadedUoms.length === 0 ||
          loadedItemTypes.length === 0
        ) {
          const [groupsRes, categoriesRes, uomsRes, itemTypesRes] =
            await Promise.all([
              api
                .get("/inventory/item-groups")
                .catch(() => ({ data: { items: [] } })),
              api
                .get("/inventory/item-categories")
                .catch(() => ({ data: { items: [] } })),
              api.get("/inventory/uoms").catch(() => ({ data: { items: [] } })),
              api
                .get("/inventory/item-types")
                .catch(() => ({ data: { items: [] } })),
            ]);
          console.log("Fallback item groups response:", groupsRes.data);
          console.log("Fallback categories response:", categoriesRes.data);
          if (cancelled) return;
          const fallbackGroups = Array.isArray(groupsRes.data?.items)
            ? groupsRes.data.items
            : [];
          const fallbackCategories = Array.isArray(categoriesRes.data?.items)
            ? categoriesRes.data.items
            : [];
          const fallbackUoms = Array.isArray(uomsRes.data?.items)
            ? uomsRes.data.items
            : [];
          const fallbackItemTypes = Array.isArray(itemTypesRes.data?.items)
            ? itemTypesRes.data.items
            : [];
          if (fallbackGroups.length > 0) setItemGroups(fallbackGroups);
          if (fallbackCategories.length > 0) setCategories(fallbackCategories);
          if (fallbackUoms.length > 0) setUoms(fallbackUoms);
          if (fallbackItemTypes.length > 0) {
            setItemTypes(fallbackItemTypes);
            if (isNew) {
              const invTypeCode = findInventoryTypeCode(fallbackItemTypes);
              if (invTypeCode) {
                setFormData((prev) => ({
                  ...prev,
                  item_type: prev.item_type && prev.item_type !== "INVENTORY" ? prev.item_type : invTypeCode,
                }));
              }
            }
          }
        }
      } catch {
        // Full fallback path when consolidated endpoint fails
        const [
          groupsRes,
          categoriesRes,
          accountsRes,
          taxesRes,
          currenciesRes,
          uomsRes,
          itemTypesRes,
          branchesRes,
        ] = await Promise.all([
          api
            .get("/inventory/item-groups")
            .catch(() => ({ data: { items: [] } })),
          api
            .get("/inventory/item-categories")
            .catch(() => ({ data: { items: [] } })),
          api.get("/finance/accounts").catch(() => ({ data: { items: [] } })),
          api.get("/finance/tax-codes").catch(() => ({ data: { items: [] } })),
          api.get("/finance/currencies").catch(() => ({ data: { items: [] } })),
          api.get("/inventory/uoms").catch(() => ({ data: { items: [] } })),
          api
            .get("/inventory/item-types")
            .catch(() => ({ data: { items: [] } })),
          api.get("/admin/branches").catch(() => ({ data: { items: [] } })),
        ]);
        if (cancelled) return;
        const fallbackBranches = Array.isArray(branchesRes.data?.items) ? branchesRes.data.items : [];
        if (fallbackBranches.length) {
          setBranches(fallbackBranches);
          if (isNew) {
            const matchedBranch =
              (activeBranchId &&
                fallbackBranches.find(
                  (b) =>
                    String(b.id) === String(activeBranchId) ||
                    Number(b.id) === Number(activeBranchId) ||
                    (b.code && String(b.code).toLowerCase() === String(activeBranchId).toLowerCase()) ||
                    (b.name && String(b.name).toLowerCase() === String(activeBranchId).toLowerCase())
                )) ||
              fallbackBranches[0];
            if (matchedBranch) {
              setFormData((prev) => ({
                ...prev,
                branch_id: String(matchedBranch.id),
              }));
            }
          }
        }
        setItemGroups(
          Array.isArray(groupsRes.data?.items) ? groupsRes.data.items : [],
        );
        setCategories(
          Array.isArray(categoriesRes.data?.items)
            ? categoriesRes.data.items
            : [],
        );
        const fallbackAccs = Array.isArray(accountsRes.data?.items)
          ? accountsRes.data.items
          : [];
        setAccounts(fallbackAccs);
        if (isNew) {
          setFormData((prev) => ({
            ...prev,
            purchase_account_id: "36",
            sales_account_id: "123",
          }));
        }
        const fallbackTaxes = Array.isArray(taxesRes.data?.items) ? taxesRes.data.items : [];
        setTaxes(fallbackTaxes);
        if (isNew) {
          const exemptTaxId = findTaxExemptId(fallbackTaxes);
          if (exemptTaxId) {
            setFormData((prev) => ({
              ...prev,
              vat_on_purchase_id: prev.vat_on_purchase_id || exemptTaxId,
              vat_on_sales_id: prev.vat_on_sales_id || exemptTaxId,
            }));
          }
        }
        const curList = Array.isArray(currenciesRes.data?.items) ? currenciesRes.data.items : [];
        setCurrencies(curList);
        const ghsCur =
          curList.find(
            (c) =>
              String(c.code || "").toUpperCase() === "GHS" ||
              String(c.name || "").toLowerCase().includes("ghana")
          ) ||
          curList.find((c) => Number(c.is_base) === 1 || c.is_base === true) ||
          curList[0];
        if (isNew && ghsCur) {
          setFormData((prev) => ({ ...prev, currency_id: String(ghsCur.id) }));
        }
        const fallbackUomsList = Array.isArray(uomsRes.data?.items) ? uomsRes.data.items : [];
        setUoms(fallbackUomsList);
        if (isNew) {
          const pcsUom = fallbackUomsList.find(
            (u) =>
              String(u.uom_code || u.code || u.uom || "").toUpperCase() === "PCS"
          );
          if (pcsUom) {
            setFormData((prev) => ({
              ...prev,
              uom: pcsUom.uom_code || pcsUom.code || pcsUom.uom || "PCS",
            }));
          }
        }
        const fallbackItemTypesList = Array.isArray(itemTypesRes.data?.items)
          ? itemTypesRes.data.items
          : [];
        setItemTypes(fallbackItemTypesList);
        if (isNew) {
          const invTypeCode = findInventoryTypeCode(fallbackItemTypesList);
          if (invTypeCode) {
            setFormData((prev) => ({
              ...prev,
              item_type: prev.item_type && prev.item_type !== "INVENTORY" ? prev.item_type : invTypeCode,
            }));
          }
        }
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    }

    loadLookups();

    if (isNew) {
      setFormData((prev) => ({
        ...prev,
        is_stockable: true,
        is_sellable: true,
        is_purchasable: true,
      }));
      // Fetch next item code
      api
        .get("/inventory/items/next-code")
        .then((res) => {
          if (res.data?.nextCode) {
            setFormData((prev) => ({ ...prev, item_code: res.data.nextCode }));
          }
        })
        .catch(() => {});
      return;
    }

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/items/${id}`)
      .then((res) => {
        if (!mounted) return;
        const it = res.data?.item;
        if (!it) return;
        setFormData({
          item_code: it.item_code || "",
          item_name: it.item_name || "",
          branch_id: it.branch_id ? String(it.branch_id) : "",
          uom: it.uom || "PCS",
          barcode: it.barcode || "",
          cost_price: Number(it.cost_price || 0),
          selling_price: Number(it.selling_price || 0),
          currency_id: it.currency_id || "",
          image_url: it.image_url || "",
          is_active: Boolean(it.is_active),
          item_type: it.item_type || "",
          category_id: it.category_id || "",
          item_group_id: it.item_group_id || "",
          description: it.description || "",
          min_stock_level: Number(it.min_stock_level || 0),
          max_stock_level: Number(it.max_stock_level || 0),
          reorder_level: Number(it.reorder_level || 0),
          safety_stock: Number(it.safety_stock || 0),
          vat_on_purchase_id: it.vat_on_purchase_id || "",
          vat_on_sales_id: it.vat_on_sales_id || "",
          purchase_account_id: it.purchase_account_id || "",
          sales_account_id: it.sales_account_id || "",
          service_item: String(it.service_item || "").toUpperCase() === "Y",
          is_stockable:
            it.is_stockable !== null && it.is_stockable !== undefined
              ? (String(it.is_stockable).toUpperCase() === "Y" || it.is_stockable === 1 || it.is_stockable === true)
              : true,
          is_sellable:
            it.is_sellable !== null && it.is_sellable !== undefined
              ? (String(it.is_sellable).toUpperCase() === "Y" || it.is_sellable === 1 || it.is_sellable === true)
              : true,
          is_purchasable:
            it.is_purchasable !== null && it.is_purchasable !== undefined
              ? (String(it.is_purchasable).toUpperCase() === "Y" || it.is_purchasable === 1 || it.is_purchasable === true)
              : true,
          is_production_item: String(it.is_production_item ?? (isProductionMode ? "Y" : "N")).toUpperCase() === "Y",
        });
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load item");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
      mounted = false;
    };
  }, [id, isNew]);

  function getUploadedImageUrl(data) {
    return (
      data?.url ||
      data?.secure_url ||
      data?.data?.url ||
      data?.data?.secure_url ||
      data?.item?.url ||
      data?.item?.secure_url ||
      ""
    );
  }

  const resolveItemGroupId = (cat, groups) => {
    if (!cat) return "";
    const rawGroupId = cat.item_group_id || cat.group_id;
    if (rawGroupId) {
      const matched = groups.find(
        (g) => String(g.id || g.group_id) === String(rawGroupId)
      );
      if (matched) return String(matched.id || matched.group_id);
      return String(rawGroupId);
    }
    if (cat.item_group_name || cat.item_group_code) {
      const nameNorm = String(cat.item_group_name || "").toLowerCase().trim();
      const codeNorm = String(cat.item_group_code || "").toLowerCase().trim();
      const matched = groups.find(
        (g) =>
          (codeNorm && String(g.group_code || "").toLowerCase().trim() === codeNorm) ||
          (nameNorm && String(g.group_name || "").toLowerCase().trim() === nameNorm)
      );
      if (matched) return String(matched.id || matched.group_id);
    }
    return "";
  };

  const resolveItemTypeOptionValue = (cat, grp, types) => {
    if (!cat && !grp) return "";

    // 1. Match by item_type_id if available
    const typeId = grp?.item_type_id || cat?.item_type_id;
    if (typeId && Array.isArray(types) && types.length > 0) {
      const match = types.find(
        (t) => String(t.id) === String(typeId) || Number(t.id) === Number(typeId)
      );
      if (match) {
        return (
          match.type_code ||
          match.code ||
          match.type_name ||
          match.name ||
          match.item_type ||
          ""
        );
      }
    }

    // 2. Match by candidates (code, name, type)
    const candidates = [
      cat?.item_type_code,
      grp?.item_type_code,
      cat?.item_type,
      grp?.item_type,
      cat?.item_type_name,
      grp?.item_type_name,
    ].filter(Boolean);

    if (Array.isArray(types) && types.length > 0) {
      for (const cand of candidates) {
        const norm = String(cand).toUpperCase().trim();
        const match = types.find(
          (t) =>
            String(t.type_code || t.code || t.item_type || "").toUpperCase().trim() === norm ||
            String(t.type_name || t.name || "").toUpperCase().trim() === norm
        );
        if (match) {
          return (
            match.type_code ||
            match.code ||
            match.type_name ||
            match.name ||
            match.item_type ||
            ""
          );
        }
      }
    }

    return candidates[0] || "";
  };

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    const selectedCat = categories.find((c) => String(c.id) === String(catId));

    const linkedGroupId = resolveItemGroupId(selectedCat, itemGroups);
    const linkedGroup = itemGroups.find(
      (g) => String(g.id || g.group_id) === String(linkedGroupId)
    );

    const resolvedType = resolveItemTypeOptionValue(selectedCat, linkedGroup, itemTypes);

    const valUpper = String(resolvedType || "").toUpperCase().trim();
    const isService = valUpper.includes("SERVICE");
    const isProd = valUpper.includes("PRODUCTION");

    setFormData((prev) => ({
      ...prev,
      category_id: catId,
      item_group_id: linkedGroupId || prev.item_group_id,
      item_type: resolvedType || prev.item_type,
      service_item: isService ? true : (resolvedType ? false : prev.service_item),
      is_production_item: isProd ? true : (resolvedType ? false : prev.is_production_item),
      is_stockable: isService ? false : prev.is_stockable,
    }));
  };

  useEffect(() => {
    if (formData.category_id && categories.length > 0) {
      const selectedCat = categories.find((c) => String(c.id) === String(formData.category_id));
      if (selectedCat) {
        const linkedGroupId = resolveItemGroupId(selectedCat, itemGroups);
        const linkedGroup = itemGroups.find(
          (g) => String(g.id || g.group_id) === String(linkedGroupId)
        );
        const resolvedType = resolveItemTypeOptionValue(selectedCat, linkedGroup, itemTypes);

        setFormData((prev) => {
          let updated = false;
          const next = { ...prev };
          if (linkedGroupId && (!prev.item_group_id || String(prev.item_group_id) !== String(linkedGroupId))) {
            next.item_group_id = linkedGroupId;
            updated = true;
          }
          if (resolvedType && (!prev.item_type || prev.item_type !== resolvedType)) {
            next.item_type = resolvedType;
            const valUpper = String(resolvedType).toUpperCase();
            if (valUpper.includes("SERVICE")) {
              next.service_item = true;
              next.is_stockable = false;
            }
            if (valUpper.includes("PRODUCTION")) {
              next.is_production_item = true;
            }
            updated = true;
          }
          return updated ? next : prev;
        });
      }
    }
  }, [formData.category_id, categories, itemGroups, itemTypes]);

  useEffect(() => {
    if (isNew && branches.length > 0) {
      const match =
        (activeBranchId &&
          branches.find(
            (b) =>
              String(b.id) === String(activeBranchId) ||
              Number(b.id) === Number(activeBranchId) ||
              (b.code && String(b.code).toLowerCase() === String(activeBranchId).toLowerCase()) ||
              (b.name && String(b.name).toLowerCase() === String(activeBranchId).toLowerCase())
          )) ||
        null;
      if (match) {
        setFormData((prev) => {
          if (!prev.branch_id || (activeBranchId && String(prev.branch_id) !== String(match.id))) {
            return { ...prev, branch_id: String(match.id) };
          }
          return prev;
        });
      }
    }
  }, [isNew, activeBranchId, branches]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("folder", "inventory_items");

    setUploading(true);
    try {
      const res = await api.post("/upload", uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploadedUrl = getUploadedImageUrl(res?.data);
      if (!uploadedUrl) {
        throw new Error("Upload completed without an image URL");
      }
      setFormData((prev) => ({ ...prev, image_url: uploadedUrl }));
      toast.success("Image uploaded successfully");
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to upload image",
      );
    } finally {
      setUploading(false);
      if (e?.target) e.target.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isViewMode) return;
    setSaving(true);
    setError("");

    try {
      const payload = {
        item_code: formData.item_code,
        item_name: formData.item_name,
        branch_id: formData.branch_id ? Number(formData.branch_id) : null,
        uom: formData.uom || "PCS",
        barcode: formData.barcode || null,
        cost_price: Number(formData.cost_price) || 0,
        selling_price: Number(formData.selling_price) || 0,
        currency_id:
          formData.currency_id ||
          currencies.find(
            (c) =>
              String(c.code || "").toUpperCase() === "GHS" ||
              String(c.name || "").toLowerCase().includes("ghana")
          )?.id ||
          1,
        image_url: formData.image_url || null,
        is_active: Boolean(formData.is_active),
        item_type: formData.item_type || null,
        category_id: formData.category_id || null,
        item_group_id: formData.item_group_id || null,
        description: formData.description || null,
        min_stock_level: Number(formData.min_stock_level) || 0,
        max_stock_level: Number(formData.max_stock_level) || 0,
        reorder_level: Number(formData.reorder_level) || 0,
        safety_stock: Number(formData.safety_stock) || 0,
        vat_on_purchase_id: formData.vat_on_purchase_id || null,
        vat_on_sales_id: formData.vat_on_sales_id || null,
        purchase_account_id: formData.purchase_account_id || null,
        sales_account_id: formData.sales_account_id || null,
        service_item: String(formData.item_type || "").toUpperCase().trim().includes("SERVICE") ? "Y" : "N",
        is_stockable: formData.is_stockable ? "Y" : "N",
        is_sellable: formData.is_sellable ? "Y" : "N",
        is_purchasable: formData.is_purchasable ? "Y" : "N",
        is_production_item: String(formData.item_type || "").toUpperCase().trim().includes("PRODUCTION") ? "Y" : "N",
        opening_quantity: Number(formData.opening_quantity) || 0,
        opening_warehouse_id: formData.opening_warehouse_id || null,
      };

      if (isNew) {
        await api.post("/inventory/items", payload);
      } else {
        await api.put(`/inventory/items/${id}`, payload);
      }

      if (isModal && onSaveSuccess) {
        onSaveSuccess();
      } else {
        navigate(returnTo);
      }
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={isModal ? "" : "space-y-6"}>
      <div className={isModal ? "" : "card"}>
        {!isModal && (
          <div className="card-header bg-brand text-white rounded-t-lg">
            <div className="flex flex-col md:flex-row justify-between items-center text-white gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold dark:text-brand-300">
                    {isViewMode ? "View Item" : isNew ? "New Item" : "Edit Item"}
                  </h1>
                  {isViewMode && (
                    <span className="bg-amber-400 text-slate-900 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Read-Only View
                    </span>
                  )}
                </div>
                <p className="text-sm mt-1">
                  {isViewMode
                    ? "Viewing item details (Editing is disabled in view mode)"
                    : "Define item attributes, pricing and stock rules"}
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                {isViewMode && (
                  <Link
                    to={`/inventory/items/${id}`}
                    className="btn-warning w-full md:w-auto text-center flex items-center justify-center gap-1.5"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                    Edit Item
                  </Link>
                )}
                <Link
                  to={returnTo}
                  className="btn-success w-full md:w-auto text-center"
                >
                  Back to List
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className={isModal ? "" : "card-body"}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? <div className="text-sm">Loading...</div> : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <fieldset disabled={isViewMode} className="space-y-6 border-0 p-0 m-0 min-w-0 disabled:opacity-95">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      Item Code * (System Generated)
                    </label>
                    <input
                      type="text"
                      className="input bg-gray-100 cursor-not-allowed"
                      value={formData.item_code}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="label">Item Name *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.item_name}
                      onChange={(e) =>
                        setFormData({ ...formData, item_name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Barcode</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.barcode}
                      onChange={(e) =>
                        setFormData({ ...formData, barcode: e.target.value })
                      }
                      placeholder="Scan or enter barcode"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 dark:bg-slate-800">
                {formData.image_url ? (
                  <div className="relative w-full h-40 mb-2">
                    <img
                      src={formData.image_url}
                      alt="Item"
                      className="w-full h-full object-contain"
                    />
                    {!isViewMode && (
                      <button
                        type="button"
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                        onClick={() =>
                          setFormData({ ...formData, image_url: "" })
                        }
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 mb-2 flex flex-col items-center">
                    <svg
                      className="w-12 h-12 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>No Image</span>
                  </div>
                )}
                {!isViewMode && (
                  <label
                    className={`btn-secondary cursor-pointer ${
                      uploading ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {uploading ? "Uploading..." : "Upload Image"}
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleImageUpload}
                      accept="image/*"
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label flex items-center justify-between">
                  <span>Category *</span>
                </label>
                <select
                  className="input"
                  value={formData.category_id}
                  onChange={handleCategoryChange}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {lookupLoading ? (
                    <option>Loading...</option>
                  ) : (
                    categories.map((c) =>
                      c ? (
                        <option key={c.id} value={c.id}>
                          {c.category_name}
                        </option>
                      ) : null,
                    )
                  )}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Select a category to automatically assign the linked item group and item type.
                </p>
              </div>

              <div>
                <label className="label flex items-center justify-between">
                  <span>Item Group *</span>
                  <span className="text-xs text-slate-400 font-normal flex items-center gap-1">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    Auto-linked
                  </span>
                </label>
                <select
                  className="input bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-700 dark:text-slate-300 pointer-events-none"
                  value={formData.item_group_id ? String(formData.item_group_id) : ""}
                  tabIndex={-1}
                  readOnly
                >
                  <option value="">-- Auto-populated Item Group --</option>
                  {itemGroups.map((g) =>
                    g ? (
                      <option key={g.id} value={String(g.id)}>
                        {g.group_name}
                      </option>
                    ) : null,
                  )}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Automatically assigned based on the selected category.
                </p>
              </div>

              <div>
                <label className="label flex items-center justify-between">
                  <span>Item Type *</span>
                  <span className="text-xs text-slate-400 font-normal flex items-center gap-1">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    Auto-linked
                  </span>
                </label>
                <select
                  className="input bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-700 dark:text-slate-300 pointer-events-none"
                  value={formData.item_type}
                  tabIndex={-1}
                  readOnly
                >
                  <option value="">-- Auto-populated Item Type --</option>
                  {itemTypes.map((t) =>
                    t ? (
                      <option
                        key={t.id || t.type_code || t.type_name}
                        value={
                          t.type_code ||
                          t.type_name ||
                          t.code ||
                          t.item_type ||
                          ""
                        }
                      >
                        {t.type_name || t.name || t.type_code || "-"}
                      </option>
                    ) : null,
                  )}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Automatically assigned based on the linked item group.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Unit of Measure</label>
                <select
                  className="input"
                  value={formData.uom || "PCS"}
                  onChange={(e) =>
                    setFormData({ ...formData, uom: e.target.value })
                  }
                >
                  <option value="">-- Select Unit of Measure --</option>
                  {!uoms.some(
                    (u) =>
                      String(u.uom_code || u.code || u.uom || "").toUpperCase() === "PCS"
                  ) && <option value="PCS">PCS</option>}
                  {lookupLoading ? (
                    <option>Loading...</option>
                  ) : (
                    uoms.map((u) => (
                      <option
                        key={u.id || u.uom_code || u.uom_name}
                        value={u.uom_code || u.code || u.uom || ""}
                      >
                        {u.uom_code || u.code || u.uom || "-"}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="label">Branch</label>
                <select
                  className="input"
                  value={formData.branch_id || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, branch_id: e.target.value })
                  }
                >
                  <option value="">-- Select Branch --</option>
                  {branches.map((b) =>
                    b ? (
                      <option key={b.id} value={String(b.id)}>
                        {b.name} ({b.code || b.id})
                      </option>
                    ) : null,
                  )}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={formData.is_active ? "ACTIVE" : "INACTIVE"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_active: e.target.value === "ACTIVE",
                    })
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Cost Price</label>
                <input
                  type="number"
                  className="input"
                  value={formData.cost_price}
                  onChange={(e) =>
                    setFormData({ ...formData, cost_price: e.target.value })
                  }
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="label">Selling Price</label>
                <input
                  type="number"
                  className="input"
                  value={formData.selling_price}
                  onChange={(e) =>
                    setFormData({ ...formData, selling_price: e.target.value })
                  }
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="label">Currency</label>
                <select
                  className="input"
                  value={
                    formData.currency_id ||
                    currencies.find(
                      (c) =>
                        String(c.code || "").toUpperCase() === "GHS" ||
                        String(c.name || "").toLowerCase().includes("ghana")
                    )?.id ||
                    "1"
                  }
                  onChange={(e) =>
                    setFormData({ ...formData, currency_id: e.target.value })
                  }
                >
                  <option value="">-- Select Currency --</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {`${c.name || ""}(${c.code || ""})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <h3 className="col-span-full font-semibold text-gray-700">
                Financial Details
              </h3>

              <div>
                <label className="label">TAX on Purchase *</label>
                <select
                  className="input"
                  value={formData.vat_on_purchase_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vat_on_purchase_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">-- Select Tax Code --</option>
                  {taxes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">TAX on Sales *</label>
                <select
                  className="input"
                  value={formData.vat_on_sales_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      vat_on_sales_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">-- Select Tax Code --</option>
                  {taxes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Purchase Account *</label>
                <select
                  className="input"
                  value={formData.purchase_account_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      purchase_account_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">-- Select Account --</option>
                  {accounts
                    .filter(
                      (a) =>
                        !a.nature ||
                        ["EXPENSE", "ASSET"].includes(a.nature.toUpperCase()),
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  {/* Fallback to show all if not found in filter or just append others */}
                  <option disabled>──────────</option>
                  {accounts.map((a) => (
                    <option key={`all-${a.id}`} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Sales Account *</label>
                <select
                  className="input"
                  value={formData.sales_account_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sales_account_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">-- Select Account --</option>
                  {accounts
                    .filter(
                      (a) => !a.nature || a.nature.toUpperCase() === "INCOME",
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  <option disabled>──────────</option>
                  {accounts.map((a) => (
                    <option key={`all-${a.id}`} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isNew && !isProductionMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                <h3 className="col-span-full font-semibold text-gray-700">
                  Quantity (Optional)
                </h3>
                <div>
                  <label className="label">Quantity</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.opening_quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, opening_quantity: e.target.value })
                    }
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">Warehouse</label>
                  <select
                    className="input"
                    value={formData.opening_warehouse_id}
                    onChange={(e) =>
                      setFormData({ ...formData, opening_warehouse_id: e.target.value })
                    }
                    required={Number(formData.opening_quantity) > 0}
                  >
                    <option value="">-- Select Warehouse --</option>
                    {warehouses
                      .filter((w) => !formData.branch_id || !w.branch_id || String(w.branch_id) === String(formData.branch_id))
                      .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.warehouse_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}


            {!isProductionMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="label">Min Stock Level</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.min_stock_level}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_stock_level: e.target.value,
                      })
                    }
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">Max Stock Level</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.max_stock_level}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_stock_level: e.target.value,
                      })
                    }
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">Reorder Level</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.reorder_level}
                    onChange={(e) =>
                      setFormData({ ...formData, reorder_level: e.target.value })
                    }
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">Safety Stock</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.safety_stock}
                    onChange={(e) =>
                      setFormData({ ...formData, safety_stock: e.target.value })
                    }
                    min="0"
                  />
                </div>
              </div>
            )}


            </fieldset>

            <div className="flex flex-col-reverse md:flex-row justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              {isModal ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary w-full md:w-auto text-center"
                >
                  {isViewMode ? "Close" : "Cancel"}
                </button>
              ) : (
                <Link
                  to={returnTo}
                  className="btn-secondary w-full md:w-auto text-center"
                >
                  {isViewMode ? "Back to Items" : "Cancel"}
                </Link>
              )}
              {isViewMode ? (
                !isModal && (
                  <Link
                    to={`/inventory/items/${id}`}
                    className="btn-primary w-full md:w-auto text-center flex items-center justify-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                    Edit This Item
                  </Link>
                )
              ) : (
                <button
                  type="submit"
                  className="btn-primary w-full md:w-auto"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Item"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
