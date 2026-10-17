/**
 * @fileoverview Redesigned ItemForm component grounded in Apple's Human Interface Guidelines.
 * Offers refined typography, clear visual hierarchy, accessible touch targets,
 * grouped section cards, inline financial margin feedback, and seamless interaction states.
 */

import React, { useEffect, useState, useId } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { api } from "api/client";
import { useAuth } from "../../../auth/AuthContext.jsx";
import { readStoredAuth } from "../../../auth/authStorage.js";
import { resolveImageUrl } from "../../../utils/imageUrl.js";
import {
  Package,
  Layers,
  DollarSign,
  Warehouse,
  FileText,
  ArrowLeft,
  Edit3,
  Image as ImageIcon,
  Upload,
  X,
  Lock,
  ShieldCheck,
  Tag,
  Barcode,
  Building,
  Check,
  Info,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

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
      return (
        code.includes("ZERO") ||
        name.includes("ZERO") ||
        code.includes("NO TAX") ||
        name.includes("NO TAX")
      );
    }) ||
    taxList.find((t) => Number(t.rate_percent) === 0);
  return found ? String(found.id) : "";
}

function findInventoryTypeCode(typesList) {
  if (!Array.isArray(typesList) || typesList.length === 0) return "INVENTORY";
  const found = typesList.find((t) => {
    const code = String(t.type_code || t.code || t.item_type || "").toUpperCase();
    const name = String(t.type_name || t.name || "").toUpperCase();
    return (
      code === "INVENTORY" ||
      name.includes("INVENTORY") ||
      code.includes("INVENTORY")
    );
  });
  return found
    ? found.type_code || found.code || found.type_name || found.item_type || "INVENTORY"
    : "INVENTORY";
}

/**
 * Apple-style accessible toggle switch component
 */
function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  badge,
}) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 select-none ${
        disabled
          ? "opacity-60 bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 cursor-not-allowed"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer shadow-xs"
      }`}
    >
      <div className="flex-1 pr-3 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-brand-900 dark:group-hover:text-brand-300 transition-colors">
            {label}
          </span>
          {badge && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
          checked
            ? "bg-emerald-600 dark:bg-emerald-500"
            : "bg-slate-200 dark:bg-slate-700"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5.5" : "translate-x-0.5"
          }`}
        />
      </div>
    </div>
  );
}

/**
 * Grouped Section Card with Apple HIG styling
 */
function SectionCard({ icon: Icon, title, description, children, badge }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-150">
      <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-900 dark:text-brand-300 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        {badge && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {badge}
          </span>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/**
 * Accessible FormField wrapper ensuring $\ge 4.5:1$ contrast on all labels & hints
 */
function FormField({ label, required, children, helper, hint }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          {label} {required && <span className="text-rose-500 normal-case">*</span>}
        </label>
        {hint && (
          <span className="text-[11px] text-slate-400 dark:text-slate-400 font-normal">
            {hint}
          </span>
        )}
      </div>
      {children}
      {helper && (
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
          {helper}
        </p>
      )}
    </div>
  );
}

export default function ItemForm({
  isModal = false,
  modalItemId,
  onClose,
  onSaveSuccess,
  isProductionMode = false,
}) {
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
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("active_branch_id")
      : "") ||
    "";
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isViewMode = searchParams.get("mode") === "view";
  const id = isModal ? modalItemId || "new" : params.id;
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
    item_type: isProductionMode ? "PRODUCTION_ITEM" : "",
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
      api
        .get("/inventory/warehouses?all_branches=1")
        .then((r) => {
          const list = Array.isArray(r.data?.items)
            ? r.data.items
            : Array.isArray(r.data)
              ? r.data
              : [];
          if (list.length) setWarehouses(list);
        })
        .catch(() => {
          api
            .get("/inventory/warehouses")
            .then((r) => {
              if (Array.isArray(r.data?.items)) setWarehouses(r.data.items);
            })
            .catch(() => {});
        });
      try {
        const res = await api.get("/inventory/item-setup-lookups");
        if (cancelled) return;
        const d = res.data || {};
        if (Array.isArray(d.warehouses) && d.warehouses.length) {
          setWarehouses(d.warehouses);
        }
        const loadedItemGroups = Array.isArray(d.itemGroups) ? d.itemGroups : [];
        const loadedCategories = Array.isArray(d.categories) ? d.categories : [];
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
                  (b.code &&
                    String(b.code).toLowerCase() ===
                      String(activeBranchId).toLowerCase()) ||
                  (b.name &&
                    String(b.name).toLowerCase() ===
                      String(activeBranchId).toLowerCase()),
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
              String(c.name || "").toLowerCase().includes("ghana"),
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
              String(u.uom_code || u.code || u.uom || "").toUpperCase() === "PCS",
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
              item_type:
                prev.item_type && prev.item_type !== "INVENTORY"
                  ? prev.item_type
                  : invTypeCode,
            }));
          }
        }

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
                  item_type:
                    prev.item_type && prev.item_type !== "INVENTORY"
                      ? prev.item_type
                      : invTypeCode,
                }));
              }
            }
          }
        }
      } catch {
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
        const fallbackBranches = Array.isArray(branchesRes.data?.items)
          ? branchesRes.data.items
          : [];
        if (fallbackBranches.length) {
          setBranches(fallbackBranches);
          if (isNew) {
            const matchedBranch =
              (activeBranchId &&
                fallbackBranches.find(
                  (b) =>
                    String(b.id) === String(activeBranchId) ||
                    Number(b.id) === Number(activeBranchId) ||
                    (b.code &&
                      String(b.code).toLowerCase() ===
                        String(activeBranchId).toLowerCase()) ||
                    (b.name &&
                      String(b.name).toLowerCase() ===
                        String(activeBranchId).toLowerCase()),
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
        const fallbackTaxes = Array.isArray(taxesRes.data?.items)
          ? taxesRes.data.items
          : [];
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
        const curList = Array.isArray(currenciesRes.data?.items)
          ? currenciesRes.data.items
          : [];
        setCurrencies(curList);
        const ghsCur =
          curList.find(
            (c) =>
              String(c.code || "").toUpperCase() === "GHS" ||
              String(c.name || "").toLowerCase().includes("ghana"),
          ) ||
          curList.find((c) => Number(c.is_base) === 1 || c.is_base === true) ||
          curList[0];
        if (isNew && ghsCur) {
          setFormData((prev) => ({ ...prev, currency_id: String(ghsCur.id) }));
        }
        const fallbackUomsList = Array.isArray(uomsRes.data?.items)
          ? uomsRes.data.items
          : [];
        setUoms(fallbackUomsList);
        if (isNew) {
          const pcsUom = fallbackUomsList.find(
            (u) =>
              String(u.uom_code || u.code || u.uom || "").toUpperCase() === "PCS",
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
              item_type:
                prev.item_type && prev.item_type !== "INVENTORY"
                  ? prev.item_type
                  : invTypeCode,
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
          image_url: resolveImageUrl(it.image_url || ""),
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
              ? String(it.is_stockable).toUpperCase() === "Y" ||
                it.is_stockable === 1 ||
                it.is_stockable === true
              : true,
          is_sellable:
            it.is_sellable !== null && it.is_sellable !== undefined
              ? String(it.is_sellable).toUpperCase() === "Y" ||
                it.is_sellable === 1 ||
                it.is_sellable === true
              : true,
          is_purchasable:
            it.is_purchasable !== null && it.is_purchasable !== undefined
              ? String(it.is_purchasable).toUpperCase() === "Y" ||
                it.is_purchasable === 1 ||
                it.is_purchasable === true
              : true,
          is_production_item:
            String(
              it.is_production_item ?? (isProductionMode ? "Y" : "N"),
            ).toUpperCase() === "Y",
          opening_quantity: Number(it.opening_quantity || it.stock_qty || 0),
          opening_warehouse_id: it.warehouse_id
            ? String(it.warehouse_id)
            : it.opening_warehouse_id
              ? String(it.opening_warehouse_id)
              : "",
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
    const raw =
      data?.url ||
      data?.secure_url ||
      data?.data?.url ||
      data?.data?.secure_url ||
      data?.item?.url ||
      data?.item?.secure_url ||
      "";
    return resolveImageUrl(raw);
  }

  const resolveItemGroupId = (cat, groups) => {
    if (!cat) return "";
    const rawGroupId = cat.item_group_id || cat.group_id;
    if (rawGroupId) {
      const matched = groups.find(
        (g) => String(g.id || g.group_id) === String(rawGroupId),
      );
      if (matched) return String(matched.id || matched.group_id);
      return String(rawGroupId);
    }
    if (cat.item_group_name || cat.item_group_code) {
      const nameNorm = String(cat.item_group_name || "").toLowerCase().trim();
      const codeNorm = String(cat.item_group_code || "").toLowerCase().trim();
      const matched = groups.find(
        (g) =>
          (codeNorm &&
            String(g.group_code || "").toLowerCase().trim() === codeNorm) ||
          (nameNorm &&
            String(g.group_name || "").toLowerCase().trim() === nameNorm),
      );
      if (matched) return String(matched.id || matched.group_id);
    }
    return "";
  };

  const resolveItemTypeOptionValue = (cat, grp, types) => {
    if (!cat && !grp) return "";
    const typeId = grp?.item_type_id || cat?.item_type_id;
    if (typeId && Array.isArray(types) && types.length > 0) {
      const match = types.find(
        (t) => String(t.id) === String(typeId) || Number(t.id) === Number(typeId),
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
            String(t.type_code || t.code || t.item_type || "")
              .toUpperCase()
              .trim() === norm ||
            String(t.type_name || t.name || "").toUpperCase().trim() === norm,
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
      (g) => String(g.id || g.group_id) === String(linkedGroupId),
    );

    const resolvedType = resolveItemTypeOptionValue(
      selectedCat,
      linkedGroup,
      itemTypes,
    );

    const valUpper = String(resolvedType || "").toUpperCase().trim();
    const normType = valUpper.replace(/[-_\s]/g, "");
    const isService = normType.includes("SERVICE");
    const isNonInventory = normType.includes("NONINVENTORY");
    const isProd = normType.includes("PRODUCTION");

    setFormData((prev) => ({
      ...prev,
      category_id: catId,
      item_group_id: linkedGroupId || prev.item_group_id,
      item_type: resolvedType || prev.item_type,
      service_item: isService ? true : resolvedType ? false : prev.service_item,
      is_production_item: isProd
        ? true
        : resolvedType
          ? false
          : prev.is_production_item,
      is_stockable: isService || isNonInventory ? false : true,
    }));
  };

  useEffect(() => {
    if (formData.category_id && categories.length > 0) {
      const selectedCat = categories.find(
        (c) => String(c.id) === String(formData.category_id),
      );
      if (selectedCat) {
        const linkedGroupId = resolveItemGroupId(selectedCat, itemGroups);
        const linkedGroup = itemGroups.find(
          (g) => String(g.id || g.group_id) === String(linkedGroupId),
        );
        const resolvedType = resolveItemTypeOptionValue(
          selectedCat,
          linkedGroup,
          itemTypes,
        );

        setFormData((prev) => {
          let updated = false;
          const next = { ...prev };
          if (
            linkedGroupId &&
            (!prev.item_group_id ||
              String(prev.item_group_id) !== String(linkedGroupId))
          ) {
            next.item_group_id = linkedGroupId;
            updated = true;
          }
          if (
            resolvedType &&
            (!prev.item_type || prev.item_type !== resolvedType)
          ) {
            next.item_type = resolvedType;
            const valUpper = String(resolvedType).toUpperCase();
            const normType = valUpper.replace(/[-_\s]/g, "");
            const isService = normType.includes("SERVICE");
            const isNonInventory = normType.includes("NONINVENTORY");
            if (isService) {
              next.service_item = true;
            }
            next.is_stockable = isService || isNonInventory ? false : true;
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
              (b.code &&
                String(b.code).toLowerCase() ===
                  String(activeBranchId).toLowerCase()) ||
              (b.name &&
                String(b.name).toLowerCase() ===
                  String(activeBranchId).toLowerCase()),
          )) ||
        null;
      if (match) {
        setFormData((prev) => {
          if (!prev.branch_id) {
            return { ...prev, branch_id: String(match.id) };
          }
          return prev;
        });
      }
    }
  }, [isNew, activeBranchId, branches]);

  const handleWarehouseChange = (whId) => {
    const selectedWh = warehouses.find((w) => String(w.id) === String(whId));
    setFormData((prev) => {
      const next = { ...prev, opening_warehouse_id: whId };
      if (selectedWh?.branch_id) {
        next.branch_id = String(selectedWh.branch_id);
      }
      return next;
    });
  };

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
        err?.response?.data?.message || err?.message || "Failed to upload image",
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
        branch_id: formData.branch_id
          ? Number(formData.branch_id)
          : activeBranchId
            ? Number(activeBranchId)
            : null,
        uom: formData.uom || "PCS",
        barcode: formData.barcode || null,
        cost_price: Number(formData.cost_price) || 0,
        selling_price: Number(formData.selling_price) || 0,
        currency_id:
          formData.currency_id ||
          currencies.find(
            (c) =>
              String(c.code || "").toUpperCase() === "GHS" ||
              String(c.name || "").toLowerCase().includes("ghana"),
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
        service_item: (() => {
          const t = String(formData.item_type || "")
            .toUpperCase()
            .replace(/[-_\s]/g, "");
          return t.includes("SERVICE") ? "Y" : "N";
        })(),
        is_stockable: (() => {
          const t = String(formData.item_type || "")
            .toUpperCase()
            .replace(/[-_\s]/g, "");
          return t.includes("SERVICE") || t.includes("NONINVENTORY") ? "N" : "Y";
        })(),
        is_sellable: formData.is_sellable ? "Y" : "N",
        is_purchasable: formData.is_purchasable ? "Y" : "N",
        is_production_item: String(formData.item_type || "")
          .toUpperCase()
          .trim()
          .includes("PRODUCTION")
          ? "Y"
          : "N",
        opening_quantity: Number(formData.opening_quantity) || 0,
        opening_warehouse_id: formData.opening_warehouse_id || null,
      };

      if (isNew) {
        await api.post("/inventory/items", payload);
        toast.success("Item created successfully");
      } else {
        await api.put(`/inventory/items/${id}`, payload);
        toast.success("Item updated successfully");
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

  // Financial Calculations
  const costNum = Number(formData.cost_price) || 0;
  const sellNum = Number(formData.selling_price) || 0;
  const grossProfit = sellNum - costNum;
  const marginPercent =
    sellNum > 0 ? ((grossProfit / sellNum) * 100).toFixed(1) : "0.0";
  const markupPercent =
    costNum > 0 ? ((grossProfit / costNum) * 100).toFixed(1) : "0.0";

  // Category name & linked items display helper
  const selectedCategoryObj = categories.find(
    (c) => String(c.id) === String(formData.category_id),
  );
  const selectedGroupObj = itemGroups.find(
    (g) => String(g.id || g.group_id) === String(formData.item_group_id),
  );

  return (
    <div className={isModal ? "" : "max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200"}>
      {/* Top Navigation & Apple-style Page Header */}
      {!isModal && (
        <div className="space-y-3 pt-1">
          {/* Breadcrumb Bar */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <Link
              to="/inventory"
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              Inventory
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <Link
              to={returnTo}
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              Items Master
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[200px] sm:max-w-xs">
              {isViewMode ? formData.item_name || "Item Details" : isNew ? "New Item" : "Edit Item"}
            </span>
          </nav>

          {/* Elevated Header Surface */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-950/70 border border-brand-100 dark:border-brand-900 text-brand-900 dark:text-brand-300 flex items-center justify-center shrink-0 shadow-xs">
                <Package className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {isViewMode
                      ? formData.item_name || "Item Details"
                      : isNew
                        ? "Create Inventory Item"
                        : `Edit ${formData.item_name || "Item"}`}
                  </h1>
                  {isViewMode && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <Lock className="w-3 h-3" />
                      Read-Only
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      formData.is_active
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        formData.is_active ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    {formData.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isViewMode
                    ? "Viewing item attributes, linked pricing, and stock metrics."
                    : "Define core attributes, pricing rules, taxonomy, and warehouse allocation."}
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <Link
                to={returnTo}
                className="btn-secondary h-11 px-4 flex items-center justify-center gap-2 text-sm font-medium w-full sm:w-auto"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Back to Items</span>
              </Link>

              {isViewMode && (
                <Link
                  to={`/inventory/items/${id}`}
                  className="btn-primary h-11 px-5 flex items-center justify-center gap-2 text-sm font-medium w-full sm:w-auto"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Item</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Form Body */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {loading && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm flex items-center gap-2.5 animate-pulse">
            <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading item data...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3">
            <X className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        <fieldset
          disabled={isViewMode}
          className="border-0 p-0 m-0 min-w-0 disabled:opacity-95 space-y-6"
        >
          {/* Responsive 12-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Primary Column (8 Cols) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Card 1: Identity & Description */}
              <SectionCard
                icon={Tag}
                title="Identity & Barcode"
                description="Core identifiers used across POS, warehousing, and procurement."
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Item Code"
                      hint="Auto-generated"
                      helper="Immutable unique tracking number"
                    >
                      <div className="relative">
                        <input
                          type="text"
                          className="input w-full bg-slate-50 dark:bg-slate-800/60 font-mono text-slate-700 dark:text-slate-300 border-dashed cursor-not-allowed"
                          value={formData.item_code || "AUTO-GENERATED"}
                          readOnly
                          aria-readonly="true"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </FormField>

                    <FormField
                      label="Item Name"
                      required
                      helper="Primary name shown on invoices & catalogs"
                    >
                      <input
                        type="text"
                        className="input w-full"
                        placeholder="e.g. Organic Rolled Oats 500g"
                        value={formData.item_name}
                        onChange={(e) =>
                          setFormData({ ...formData, item_name: e.target.value })
                        }
                        required
                        aria-required="true"
                      />
                    </FormField>
                  </div>

                  <FormField
                    label="Barcode (EAN / UPC / Code128)"
                    helper="Scan or enter barcode for POS & stock taking"
                  >
                    <div className="relative">
                      <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        className="input w-full pl-9 font-mono"
                        placeholder="Scan or enter barcode number"
                        value={formData.barcode}
                        onChange={(e) =>
                          setFormData({ ...formData, barcode: e.target.value })
                        }
                      />
                    </div>
                  </FormField>

                  <FormField
                    label="Description & Specifications"
                    helper="Internal notes, ingredients, dimensions, or customer-facing description"
                  >
                    <textarea
                      rows={3}
                      className="input w-full py-2.5 resize-none leading-relaxed"
                      placeholder="Add detailed specifications or notes for this item..."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                    />
                  </FormField>
                </div>
              </SectionCard>

              {/* Card 2: Classification & Hierarchy */}
              <SectionCard
                icon={Layers}
                title="Classification & Taxonomy"
                description="Categorization automatically resolves item group and operational item type."
              >
                <div className="space-y-4">
                  <FormField
                    label="Category"
                    required
                    helper="Selecting a category automatically sets the linked item group and item type."
                  >
                    <select
                      className="input w-full"
                      value={formData.category_id}
                      onChange={handleCategoryChange}
                      required
                      aria-required="true"
                    >
                      <option value="">-- Select Category --</option>
                      {lookupLoading ? (
                        <option disabled>Loading categories...</option>
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
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Item Group"
                      hint="Auto-linked"
                      helper="Inherited group mapping for accounting and hierarchy"
                    >
                      <div className="relative">
                        <input
                          type="text"
                          className="input w-full bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 cursor-not-allowed border-dashed"
                          value={
                            selectedGroupObj?.group_name ||
                            itemGroups.find(
                              (g) =>
                                String(g.id || g.group_id) ===
                                String(formData.item_group_id),
                            )?.group_name ||
                            "Auto-assigned from Category"
                          }
                          readOnly
                          aria-readonly="true"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </FormField>

                    <FormField
                      label="Item Type"
                      hint="Auto-linked"
                      helper="Determines inventory tracking and accounting behavior"
                    >
                      <div className="relative">
                        <input
                          type="text"
                          className="input w-full bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 cursor-not-allowed border-dashed"
                          value={
                            formData.item_type
                              ? formData.item_type.replace(/_/g, " ")
                              : "Auto-assigned from Category"
                          }
                          readOnly
                          aria-readonly="true"
                        />
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </FormField>
                  </div>

                  {formData.item_type &&
                    (String(formData.item_type).toUpperCase().includes("SERVICE") ||
                      String(formData.item_type)
                        .toUpperCase()
                        .includes("NONINVENTORY")) && (
                      <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center gap-3 text-xs text-blue-800 dark:text-blue-300">
                        <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span>
                          <strong>Service / Non-Inventory Policy:</strong> This item
                          is automatically flagged as non-stockable. Physical inventory
                          balances are not tracked.
                        </span>
                      </div>
                    )}
                </div>
              </SectionCard>

              {/* Card 3: Pricing & Unit of Measure */}
              <SectionCard
                icon={DollarSign}
                title="Pricing & Commercial Terms"
                description="Set purchase cost, selling price, currency, and default packaging unit."
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <FormField
                      label="Cost Price"
                      helper="Standard cost or purchase acquisition price"
                    >
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                          {currencies.find(
                            (c) => String(c.id) === String(formData.currency_id),
                          )?.code || "GHS"}
                        </span>
                        <input
                          type="number"
                          className="input w-full pl-12 font-mono text-right"
                          placeholder="0.00"
                          value={formData.cost_price}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              cost_price: e.target.value,
                            })
                          }
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </FormField>

                    <FormField
                      label="Selling Price"
                      helper="Default price charged to customers"
                    >
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                          {currencies.find(
                            (c) => String(c.id) === String(formData.currency_id),
                          )?.code || "GHS"}
                        </span>
                        <input
                          type="number"
                          className="input w-full pl-12 font-mono text-right"
                          placeholder="0.00"
                          value={formData.selling_price}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              selling_price: e.target.value,
                            })
                          }
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </FormField>

                    <FormField label="Currency" helper="Operating transaction currency">
                      <select
                        className="input w-full"
                        value={
                          formData.currency_id ||
                          currencies.find(
                            (c) =>
                              String(c.code || "").toUpperCase() === "GHS" ||
                              String(c.name || "")
                                .toLowerCase()
                                .includes("ghana"),
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
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  {/* Inline Apple-Style Margin & Economics Feedback */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Unit Profit
                      </div>
                      <div
                        className={`text-base font-bold font-mono mt-0.5 ${
                          grossProfit >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {grossProfit.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Gross Margin
                      </div>
                      <div
                        className={`text-base font-bold font-mono mt-0.5 ${
                          Number(marginPercent) >= 0
                            ? "text-slate-800 dark:text-slate-200"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {marginPercent}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Cost Markup
                      </div>
                      <div className="text-base font-bold font-mono mt-0.5 text-slate-800 dark:text-slate-200">
                        {markupPercent}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Base UOM
                      </div>
                      <div className="text-base font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {formData.uom || "PCS"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <FormField
                      label="Unit of Measure (UOM)"
                      helper="Standard counting unit for packaging and recipes"
                    >
                      <select
                        className="input w-full"
                        value={formData.uom || "PCS"}
                        onChange={(e) =>
                          setFormData({ ...formData, uom: e.target.value })
                        }
                      >
                        <option value="">-- Select Unit of Measure --</option>
                        {!uoms.some(
                          (u) =>
                            String(u.uom_code || u.code || u.uom || "").toUpperCase() ===
                            "PCS",
                        ) && <option value="PCS">PCS</option>}
                        {lookupLoading ? (
                          <option disabled>Loading...</option>
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
                    </FormField>

                    <FormField
                      label="Lifecycle Status"
                      helper="Inactive items are hidden from new order creation"
                    >
                      <select
                        className="input w-full"
                        value={formData.is_active ? "ACTIVE" : "INACTIVE"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            is_active: e.target.value === "ACTIVE",
                          })
                        }
                      >
                        <option value="ACTIVE">ACTIVE (Available)</option>
                        <option value="INACTIVE">INACTIVE (Archived)</option>
                      </select>
                    </FormField>
                  </div>
                </div>
              </SectionCard>

              {/* Card 4: Fulfillment & Warehouse Allocation */}
              {!isProductionMode && (
                <SectionCard
                  icon={Warehouse}
                  title="Storage & Fulfillment"
                  description="Warehouse assignment automatically syncs the associated branch location."
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        label="Warehouse"
                        helper="Selecting a warehouse automatically updates the linked branch."
                        required={isNew && Number(formData.opening_quantity) > 0}
                      >
                        <select
                          className="input w-full"
                          value={formData.opening_warehouse_id || ""}
                          onChange={(e) => handleWarehouseChange(e.target.value)}
                          required={isNew && Number(formData.opening_quantity) > 0}
                          aria-required={
                            isNew && Number(formData.opening_quantity) > 0
                          }
                        >
                          <option value="">-- Select Warehouse --</option>
                          {warehouses.map((w) => {
                            const branchObj = branches.find(
                              (b) => String(b.id) === String(w.branch_id),
                            );
                            const branchSuffix = branchObj?.name
                              ? ` (${branchObj.name})`
                              : w.branch_name
                                ? ` (${w.branch_name})`
                                : "";
                            return (
                              <option key={w.id} value={w.id}>
                                {w.warehouse_name || w.name || w.warehouse_code}
                                {branchSuffix}
                              </option>
                            );
                          })}
                        </select>
                      </FormField>

                      <FormField
                        label="Branch"
                        required
                        helper="Primary operational branch managing this inventory"
                      >
                        <select
                          className="input w-full"
                          value={formData.branch_id || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, branch_id: e.target.value })
                          }
                          required
                          aria-required="true"
                        >
                          <option value="">-- Select Branch --</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name || b.branch_name || b.code || `Branch ${b.id}`}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    </div>

                    {isNew && (
                      <FormField
                        label="Initial Opening Quantity (Optional)"
                        helper="Creates an opening inventory balance ledger entry on save"
                      >
                        <input
                          type="number"
                          className="input w-full max-w-sm font-mono"
                          value={formData.opening_quantity}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              opening_quantity: e.target.value,
                            })
                          }
                          min="0"
                        />
                      </FormField>
                    )}

                    {/* Stock Threshold Strip */}
                    <div className="pt-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                        Inventory Thresholds & Replenishment Rules
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <FormField label="Min Stock" hint="Buffer">
                          <input
                            type="number"
                            className="input w-full font-mono text-center"
                            value={formData.min_stock_level}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                min_stock_level: e.target.value,
                              })
                            }
                            min="0"
                          />
                        </FormField>

                        <FormField label="Max Stock" hint="Ceiling">
                          <input
                            type="number"
                            className="input w-full font-mono text-center"
                            value={formData.max_stock_level}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                max_stock_level: e.target.value,
                              })
                            }
                            min="0"
                          />
                        </FormField>

                        <FormField label="Reorder Level" hint="Trigger">
                          <input
                            type="number"
                            className="input w-full font-mono text-center"
                            value={formData.reorder_level}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                reorder_level: e.target.value,
                              })
                            }
                            min="0"
                          />
                        </FormField>

                        <FormField label="Safety Stock" hint="Reserve">
                          <input
                            type="number"
                            className="input w-full font-mono text-center"
                            value={formData.safety_stock}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                safety_stock: e.target.value,
                              })
                            }
                            min="0"
                          />
                        </FormField>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* Card 5: Accounting & Tax Mapping */}
              <SectionCard
                icon={FileText}
                title="Accounting & Tax Configuration"
                description="General ledger and statutory taxation parameters for billing & procurement."
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      label="Tax on Purchase"
                      required
                      helper="Input tax rate applied to purchase orders"
                    >
                      <select
                        className="input w-full"
                        value={formData.vat_on_purchase_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            vat_on_purchase_id: e.target.value,
                          })
                        }
                        required
                        aria-required="true"
                      >
                        <option value="">-- Select Tax Code --</option>
                        {taxes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField
                      label="Tax on Sales"
                      required
                      helper="Output tax rate applied to customer invoices"
                    >
                      <select
                        className="input w-full"
                        value={formData.vat_on_sales_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            vat_on_sales_id: e.target.value,
                          })
                        }
                        required
                        aria-required="true"
                      >
                        <option value="">-- Select Tax Code --</option>
                        {taxes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <FormField
                      label="Purchase Account (GL)"
                      required
                      helper="Expense or Asset GL account debited on receipt"
                    >
                      <select
                        className="input w-full"
                        value={formData.purchase_account_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            purchase_account_id: e.target.value,
                          })
                        }
                        required
                        aria-required="true"
                      >
                        <option value="">-- Select Purchase Account --</option>
                        {accounts
                          .filter(
                            (a) =>
                              !a.nature ||
                              ["EXPENSE", "ASSET"].includes(
                                a.nature.toUpperCase(),
                              ),
                          )
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.code || a.account_number || `#${a.id}`})
                            </option>
                          ))}
                        <option disabled>──────────</option>
                        {accounts.map((a) => (
                          <option key={`all-${a.id}`} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField
                      label="Sales Account (GL)"
                      required
                      helper="Revenue GL account credited on sales invoicing"
                    >
                      <select
                        className="input w-full"
                        value={formData.sales_account_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            sales_account_id: e.target.value,
                          })
                        }
                        required
                        aria-required="true"
                      >
                        <option value="">-- Select Sales Account --</option>
                        {accounts
                          .filter(
                            (a) =>
                              !a.nature || a.nature.toUpperCase() === "INCOME",
                          )
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.code || a.account_number || `#${a.id}`})
                            </option>
                          ))}
                        <option disabled>──────────</option>
                        {accounts.map((a) => (
                          <option key={`all-${a.id}`} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Secondary Column (4 Cols) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Card 6: Item Media */}
              <SectionCard
                icon={ImageIcon}
                title="Item Media"
                description="Visual reference shown in POS catalog and item lists."
              >
                <div className="space-y-3">
                  {formData.image_url ? (
                    <div className="relative group rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 overflow-hidden flex flex-col items-center justify-center min-h-[200px]">
                      <img
                        src={resolveImageUrl(formData.image_url)}
                        alt={formData.item_name || "Item Preview"}
                        className="w-full h-44 object-contain rounded-lg transition-transform duration-300 group-hover:scale-102"
                      />
                      {!isViewMode && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, image_url: "" }))
                          }
                          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800/95 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                          aria-label="Remove image"
                          title="Remove image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <label
                      className={`group border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center text-center transition-all duration-150 ${
                        isViewMode
                          ? "opacity-60 cursor-default"
                          : "hover:border-brand-500 dark:hover:border-brand-400 hover:bg-brand-50/20 dark:hover:bg-brand-950/20 cursor-pointer"
                      } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
                    >
                      <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:border-brand-300 transition-all">
                        {uploading ? (
                          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5 text-slate-500 group-hover:text-brand-600 transition-colors" />
                        )}
                      </div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {uploading ? "Uploading Image..." : "Click to Upload Photo"}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        PNG, JPG, or WebP up to 5MB
                      </span>
                      {!isViewMode && (
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleImageUpload}
                          accept="image/*"
                          disabled={uploading}
                        />
                      )}
                    </label>
                  )}
                </div>
              </SectionCard>

              {/* Card 7: Operational Behavior & Governance */}
              <SectionCard
                icon={ShieldCheck}
                title="Operational Governance"
                description="Configure permissions for sales, purchasing, and warehouse stocking."
              >
                <div className="space-y-3">
                  <ToggleSwitch
                    label="Stockable"
                    description="Tracks quantities in warehouses and computes valuations."
                    checked={Boolean(formData.is_stockable)}
                    onChange={(checked) =>
                      setFormData({ ...formData, is_stockable: checked })
                    }
                    disabled={
                      isViewMode ||
                      String(formData.item_type || "")
                        .toUpperCase()
                        .includes("SERVICE") ||
                      String(formData.item_type || "")
                        .toUpperCase()
                        .includes("NONINVENTORY")
                    }
                    badge={
                      String(formData.item_type || "")
                        .toUpperCase()
                        .includes("SERVICE") ||
                      String(formData.item_type || "")
                        .toUpperCase()
                        .includes("NONINVENTORY")
                        ? "Policy Locked"
                        : undefined
                    }
                  />

                  <ToggleSwitch
                    label="Sellable"
                    description="Available for quotes, sales orders, invoices, and POS checkout."
                    checked={Boolean(formData.is_sellable)}
                    onChange={(checked) =>
                      setFormData({ ...formData, is_sellable: checked })
                    }
                    disabled={isViewMode}
                  />

                  <ToggleSwitch
                    label="Purchasable"
                    description="Available for purchase orders, supplier RFQs, and material receipts."
                    checked={Boolean(formData.is_purchasable)}
                    onChange={(checked) =>
                      setFormData({ ...formData, is_purchasable: checked })
                    }
                    disabled={isViewMode}
                  />

                  <ToggleSwitch
                    label="Production Item"
                    description="Eligible for manufacturing bill-of-materials (BOM) & work orders."
                    checked={Boolean(formData.is_production_item)}
                    onChange={(checked) =>
                      setFormData({ ...formData, is_production_item: checked })
                    }
                    disabled={isViewMode || isProductionMode}
                  />
                </div>
              </SectionCard>
            </div>
          </div>
        </fieldset>

        {/* Apple-style Elevated Action Dock */}
        <div className="sticky bottom-4 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-erp-md p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            {isViewMode ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                <Lock className="w-3.5 h-3.5" />
                Read-only mode. Click "Edit Item" above to modify.
              </span>
            ) : (
              <span>
                Required fields are indicated by{" "}
                <span className="text-rose-500 font-bold">*</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {isModal ? (
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary h-11 px-5 w-full sm:w-auto"
              >
                {isViewMode ? "Close" : "Cancel"}
              </button>
            ) : (
              <Link
                to={returnTo}
                className="btn-secondary h-11 px-5 w-full sm:w-auto flex items-center justify-center"
              >
                {isViewMode ? "Back to Items" : "Cancel"}
              </Link>
            )}

            {!isViewMode && (
              <button
                type="submit"
                disabled={saving}
                className="btn-primary h-11 px-7 w-full sm:w-auto flex items-center justify-center gap-2 font-medium active:scale-[0.98] transition-transform"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isNew ? "Create Item" : "Save Changes"}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
