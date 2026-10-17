/**
 * @fileoverview ItemGroupsList component.
 * Provides a 2-grid responsive dashboard for Item Classification:
 * Item Types, Item Groups, Item Categories, and Units of Measure.
 * Supports direct in-place modal management for all 4 classification sections.
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Layers,
  FolderTree,
  Package,
  Ruler,
  Plus,
  Search,
  X,
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import { filterAndSort } from "@/utils/searchUtils.js";

const UOM_TYPES = [
  { value: "COUNT", label: "Count" },
  { value: "WEIGHT", label: "Weight" },
  { value: "VOLUME", label: "Volume" },
  { value: "LENGTH", label: "Length" },
];

/**
 * Item Classification List component
 * Arranged in a modern 2-column grid layout across classification hierarchy sections with equal column widths.
 *
 * @returns {JSX.Element} The rendered component
 */
export default function ItemGroupsList() {
  const [searchTerm, setSearchTerm] = useState("");

  const [itemTypes, setItemTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesError, setTypesError] = useState("");

  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState("");

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");

  const [uoms, setUoms] = useState([]);
  const [uomsLoading, setUomsLoading] = useState(false);
  const [uomsError, setUomsError] = useState("");

  // In-place Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("group"); // "type" | "group" | "category" | "uom"
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit" | "view"
  const [selectedItem, setSelectedItem] = useState(null);
  const [savingModal, setSavingModal] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "COUNT",
    parent: "",
    active: "Y",
    item_type_id: "",
    item_group_id: "",
  });

const DEFAULT_PRESET_ITEM_TYPES = [
  { id: 1, type_code: "RAW_MATERIAL", type_name: "Raw Material", is_active: 1 },
  { id: 2, type_code: "PRODUCTION_ITEM", type_name: "Production Item", is_active: 1 },
  { id: 3, type_code: "FIXED_ASSET", type_name: "Fixed Asset", is_active: 1 },
  { id: 4, type_code: "FINISHED_GOOD", type_name: "Finished Good", is_active: 1 },
  { id: 5, type_code: "SEMI_FINISHED", type_name: "Semi-Finished", is_active: 1 },
  { id: 6, type_code: "CONSUMABLE", type_name: "Consumable", is_active: 1 },
  { id: 7, type_code: "SERVICE", type_name: "Service", is_active: 1 },
];

  const fetchTypes = useCallback(async () => {
    setTypesLoading(true);
    setTypesError("");
    try {
      const res = await api.get("/inventory/item-types");
      const loaded = Array.isArray(res.data?.items) ? res.data.items : [];
      if (!loaded.length) {
        setItemTypes(DEFAULT_PRESET_ITEM_TYPES);
      } else {
        const existingCodes = new Set(
          loaded.map((t) => String(t.type_code || t.code || "").toUpperCase())
        );
        const merged = [...loaded];
        for (const preset of DEFAULT_PRESET_ITEM_TYPES) {
          if (!existingCodes.has(preset.type_code)) {
            merged.push(preset);
          }
        }
        setItemTypes(merged);
      }
    } catch (e) {
      setTypesError(e?.response?.data?.message || "Failed to load item types");
      setItemTypes(DEFAULT_PRESET_ITEM_TYPES);
    } finally {
      setTypesLoading(false);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    setGroupsError("");
    try {
      const res = await api.get("/inventory/item-groups");
      setGroups(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      setGroupsError(e?.response?.data?.message || "Failed to load item groups");
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError("");
    try {
      const res = await api.get("/inventory/item-categories");
      setCategories(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      setCategoriesError(e?.response?.data?.message || "Failed to load item categories");
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const fetchUoms = useCallback(async () => {
    setUomsLoading(true);
    setUomsError("");
    try {
      const res = await api.get("/inventory/uoms");
      setUoms(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (e) {
      setUomsError(e?.response?.data?.message || "Failed to load units of measure");
    } finally {
      setUomsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
    fetchGroups();
    fetchCategories();
    fetchUoms();
  }, [fetchTypes, fetchGroups, fetchCategories, fetchUoms]);

  // Code Generator Helper
  const generateCode = (prefix, list) => {
    const maxNum = (Array.isArray(list) ? list : []).reduce((max, item) => {
      const code =
        item.group_code ||
        item.category_code ||
        item.uom_code ||
        item.type_code ||
        item.code ||
        "";
      const num = parseInt(String(code).replace(/\D/g, "")) || 0;
      return Math.max(max, num);
    }, 0);
    return `${prefix}${(maxNum + 1).toString().padStart(3, "0")}`;
  };

  // Open Modal Handler
  const handleOpenModal = (type, mode = "create", item = null) => {
    setModalType(type);
    setModalMode(mode);
    setSelectedItem(item);

    if (mode === "create") {
      const prefix =
        type === "group"
          ? "GRP"
          : type === "category"
            ? "CAT"
            : type === "type"
              ? "TYP"
              : "";
      const list =
        type === "group"
          ? groups
          : type === "category"
            ? categories
            : type === "type"
              ? itemTypes
              : uoms;
      setFormData({
        code: prefix ? generateCode(prefix, list) : "",
        name: "",
        type: "COUNT",
        parent: "",
        active: "Y",
        item_type_id: "",
        item_group_id: "",
      });
    } else if ((mode === "edit" || mode === "view") && item) {
      setFormData({
        code:
          item.group_code ||
          item.category_code ||
          item.uom_code ||
          item.type_code ||
          item.code ||
          "",
        name:
          item.group_name ||
          item.category_name ||
          item.uom_name ||
          item.type_name ||
          item.name ||
          "",
        type: item.uom_type || item.type || "COUNT",
        parent: item.parent_category_id ? String(item.parent_category_id) : "",
        active:
          item.is_active === 1 || item.is_active === true || item.is_active === "Y"
            ? "Y"
            : "N",
        item_type_id: item.item_type_id ? String(item.item_type_id) : "",
        item_group_id: item.item_group_id ? String(item.item_group_id) : "",
      });
    }

    setShowModal(true);
  };

  // Submit Modal Handler
  const handleSubmitModal = async () => {
    if (modalMode === "view") {
      setShowModal(false);
      return;
    }

    if (!formData.name?.trim() || !formData.code?.trim()) {
      toast.error("Please fill in Code and Name.");
      return;
    }

    setSavingModal(true);
    try {
      if (modalType === "group") {
        if (!formData.item_type_id) {
          toast.error("Please select an Item Type that this item group falls under.");
          setSavingModal(false);
          return;
        }

        const payload = {
          group_code: formData.code.trim(),
          group_name: formData.name.trim(),
          item_type_id: Number(formData.item_type_id),
          is_active: formData.active === "Y" ? 1 : 0,
        };

        if (modalMode === "create") {
          await api.post("/inventory/item-groups", payload);
          toast.success("Item group created successfully");
        } else {
          const groupId = selectedItem?.group_id || selectedItem?.id;
          await api.put(`/inventory/item-groups/${groupId}`, payload);
          toast.success("Item group updated successfully");
        }
        await fetchGroups();
      } else if (modalType === "category") {
        if (!formData.item_group_id) {
          toast.error("Please select an Item Group that this item category falls under.");
          setSavingModal(false);
          return;
        }

        const payload = {
          category_code: formData.code.trim(),
          category_name: formData.name.trim(),
          item_group_id: Number(formData.item_group_id),
          parent_category_id: formData.parent ? Number(formData.parent) : null,
          is_active: formData.active === "Y" ? 1 : 0,
        };

        if (modalMode === "create") {
          await api.post("/inventory/item-categories", payload);
          toast.success("Item category created successfully");
        } else {
          const categoryId = selectedItem?.category_id || selectedItem?.id;
          await api.put(`/inventory/item-categories/${categoryId}`, payload);
          toast.success("Item category updated successfully");
        }
        await fetchCategories();
      } else if (modalType === "type") {
        const payload = {
          type_code: formData.code.trim(),
          type_name: formData.name.trim(),
          is_active: formData.active === "Y" ? 1 : 0,
        };

        if (modalMode === "create") {
          await api.post("/inventory/item-types", payload);
          toast.success("Item type created successfully");
        } else {
          const typeId = selectedItem?.type_id || selectedItem?.id;
          await api.put(`/inventory/item-types/${typeId}`, payload);
          toast.success("Item type updated successfully");
        }
        await fetchTypes();
      } else if (modalType === "uom") {
        const payload = {
          uom_code: formData.code.trim(),
          uom_name: formData.name.trim(),
          uom_type: formData.type || "COUNT",
          is_active: formData.active === "Y" ? 1 : 0,
        };

        if (modalMode === "create") {
          await api.post("/inventory/uoms", payload);
          toast.success("Unit of measure created successfully");
        } else {
          const uomId = selectedItem?.id;
          await api.put(`/inventory/uoms/${uomId}`, payload);
          toast.success("Unit of measure updated successfully");
        }
        await fetchUoms();
      }

      setShowModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save item classification");
    } finally {
      setSavingModal(false);
    }
  };

  // Filtered datasets based on search term
  const filteredTypes = useMemo(() => {
    if (!searchTerm.trim()) return itemTypes;
    return filterAndSort(itemTypes, {
      query: searchTerm,
      getKeys: (t) => [t.type_code, t.type_name, t.code, t.name],
    });
  }, [itemTypes, searchTerm]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups;
    return filterAndSort(groups, {
      query: searchTerm,
      getKeys: (g) => [
        g.group_code,
        g.group_name,
        g.parent_group_name,
        g.item_type_name,
        g.item_type_code,
      ],
    });
  }, [groups, searchTerm]);

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    return filterAndSort(categories, {
      query: searchTerm,
      getKeys: (c) => [
        c.category_code,
        c.category_name,
        c.parent_category_name,
        c.item_group_name,
        c.item_group_code,
        c.item_type_name,
      ],
    });
  }, [categories, searchTerm]);

  const filteredUoms = useMemo(() => {
    if (!searchTerm.trim()) return uoms;
    return filterAndSort(uoms, {
      query: searchTerm,
      getKeys: (u) => [u.uom_code, u.uom_name, u.uom_type, u.type, u.code, u.name],
    });
  }, [uoms, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="card bg-brand text-white rounded-xl overflow-hidden shadow">
        <div className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                Item Classification
              </h1>
              <p className="text-sm mt-1 text-slate-100 opacity-90">
                Manage your catalog hierarchy: Item Types &rarr; Item Groups &rarr; Item Categories, and Units of Measure.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Link
                to="/inventory?section=Stock%20Operations"
                className="btn btn-secondary text-sm"
              >
                Return to Menu
              </Link>
              <button
                type="button"
                onClick={() => handleOpenModal("group", "create")}
                className="btn-success text-sm flex items-center gap-1.5"
                data-rbac-exempt="true"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Classification</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Search and Classification Pills */}
      <div className="card p-4 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search across types, groups, categories, units..."
              className="input pl-9 w-full text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-medium border border-indigo-200 dark:border-indigo-800">
              {filteredTypes.length} Types
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-medium border border-emerald-200 dark:border-emerald-800">
              {filteredGroups.length} Groups
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 font-medium border border-amber-200 dark:border-amber-800">
              {filteredCategories.length} Categories
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800">
              {filteredUoms.length} UOMs
            </span>
          </div>
        </div>
      </div>

      {/* Equal Width Two-Grid Layout for Classification Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-stretch">
        {/* Grid 1: Item Types */}
        <div className="card flex flex-col h-full w-full min-w-0 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden">
          <div className="card-header bg-brand text-white p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Item Types</h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200">
                      {filteredTypes.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">Top-level classification (Presets & Custom)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenModal("type", "create")}
                className="btn-success btn-sm flex items-center gap-1.5 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Type</span>
              </button>
            </div>
          </div>

          <div className="card-body p-0 flex-1 flex flex-col">
            {typesError && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border-b border-red-100">{typesError}</div>
            )}
            <div className="overflow-x-auto flex-1 max-h-[380px] overflow-y-auto">
              <table
                className="w-full min-w-[520px] border-collapse text-sm"
                style={{ width: "100%", tableLayout: "fixed" }}
              >
                <colgroup>
                  <col style={{ width: "45%" }} />
                  <col style={{ width: "25%" }} />
                  <col style={{ width: "30%" }} />
                </colgroup>
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
                  <tr>
                    <th style={{ width: "45%" }} className="py-2.5 px-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Name</th>
                    <th style={{ width: "25%" }} className="py-2.5 px-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Active</th>
                    <th style={{ width: "30%" }} className="py-2.5 px-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {typesLoading ? (
                    <tr>
                      <td colSpan="3" className="text-center py-8 text-slate-400">Loading item types...</td>
                    </tr>
                  ) : !filteredTypes.length ? (
                    <tr>
                      <td colSpan="3" className="text-center py-8 text-slate-400">No item types found</td>
                    </tr>
                  ) : (
                    filteredTypes.map((t) => {
                      const isActive = t.is_active === 1 || t.is_active === true || t.is_active === "Y";
                      return (
                        <tr key={t.id || t.type_code} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td style={{ width: "45%" }} className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium truncate" title={t.type_name || t.name}>
                            {t.type_name || t.name}
                          </td>
                          <td style={{ width: "25%" }} className="py-2.5 px-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"}`}>
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ width: "30%" }} className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenModal("type", "edit", t)}
                              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Grid 2: Item Groups */}
        <div className="card flex flex-col h-full w-full min-w-0 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden">
          <div className="card-header bg-brand text-white p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-lg">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Item Groups</h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-200">
                      {filteredGroups.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">Linked under Parent Item Type</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenModal("group", "create")}
                className="btn-success btn-sm flex items-center gap-1.5 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Group</span>
              </button>
            </div>
          </div>

          <div className="card-body p-0 flex-1 flex flex-col">
            {groupsError && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border-b border-red-100">{groupsError}</div>
            )}
            <div className="overflow-x-auto flex-1 max-h-[380px] overflow-y-auto">
              <table
                className="w-full min-w-[560px] border-collapse text-sm"
                style={{ width: "100%", tableLayout: "fixed" }}
              >
                <colgroup>
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "32%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "22%" }} />
                </colgroup>
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
                  <tr>
                    <th style={{ width: "28%" }} className="py-2.5 px-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Name</th>
                    <th style={{ width: "32%" }} className="py-2.5 px-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Item Type</th>
                    <th style={{ width: "18%" }} className="py-2.5 px-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Active</th>
                    <th style={{ width: "22%" }} className="py-2.5 px-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {groupsLoading ? (
                    <tr>
                      <td colSpan="4" className="text-center py-8 text-slate-400">Loading item groups...</td>
                    </tr>
                  ) : !filteredGroups.length ? (
                    <tr>
                      <td colSpan="4" className="text-center py-8 text-slate-400">No item groups found</td>
                    </tr>
                  ) : (
                    filteredGroups.map((g) => {
                      const isActive = g.is_active === 1 || g.is_active === true || g.is_active === "Y";
                      return (
                        <tr key={g.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td style={{ width: "28%" }} className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium truncate" title={g.group_name}>
                            {g.group_name}
                          </td>
                          <td style={{ width: "32%" }} className="py-2.5 px-3 truncate">
                            {g.item_type_name || g.item_type_code ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 truncate" title={g.item_type_name || g.item_type_code}>
                                {g.item_type_name || g.item_type_code}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">None</span>
                            )}
                          </td>
                          <td style={{ width: "18%" }} className="py-2.5 px-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"}`}>
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ width: "22%" }} className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenModal("group", "view", g)}
                                className="px-1.5 py-0.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenModal("group", "edit", g)}
                                className="px-1.5 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Grid 3: Item Categories */}
        <div className="card flex flex-col h-full w-full min-w-0 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden">
          <div className="card-header bg-brand text-white p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Item Categories</h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/30 text-amber-200">
                      {filteredCategories.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">Linked under Parent Item Group</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenModal("category", "create")}
                className="btn-success btn-sm flex items-center gap-1.5 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category</span>
              </button>
            </div>
          </div>

          <div className="card-body p-0 flex-1 flex flex-col">
            {categoriesError && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border-b border-red-100">{categoriesError}</div>
            )}
            <div className="overflow-x-auto flex-1 max-h-[380px] overflow-y-auto">
              <table
                className="w-full min-w-[560px] border-collapse text-sm"
                style={{ width: "100%", tableLayout: "fixed" }}
              >
                <colgroup>
                  <col style={{ width: "32%" }} />
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "17%" }} />
                </colgroup>
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
                  <tr>
                    <th style={{ width: "32%" }} className="py-2.5 px-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Name</th>
                    <th style={{ width: "34%" }} className="py-2.5 px-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Item Group</th>
                    <th style={{ width: "17%" }} className="py-2.5 px-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Active</th>
                    <th style={{ width: "17%" }} className="py-2.5 px-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categoriesLoading ? (
                    <tr>
                      <td colSpan="4" className="text-center py-8 text-slate-400">Loading item categories...</td>
                    </tr>
                  ) : !filteredCategories.length ? (
                    <tr>
                      <td colSpan="4" className="text-center py-8 text-slate-400">No item categories found</td>
                    </tr>
                  ) : (
                    filteredCategories.map((c) => {
                      const isActive = c.is_active === 1 || c.is_active === true || c.is_active === "Y";
                      return (
                        <tr key={c.id || c.category_code} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td style={{ width: "32%" }} className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium truncate" title={c.category_name}>
                            {c.category_name}
                          </td>
                          <td style={{ width: "34%" }} className="py-2.5 px-3 truncate">
                            {c.item_group_name || c.item_group_code ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 truncate" title={c.item_group_name || c.item_group_code}>
                                {c.item_group_name || c.item_group_code}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">None</span>
                            )}
                          </td>
                          <td style={{ width: "17%" }} className="py-2.5 px-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"}`}>
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ width: "17%" }} className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenModal("category", "edit", c)}
                              className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-semibold"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Grid 4: Units of Measure */}
        <div className="card flex flex-col h-full w-full min-w-0 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl overflow-hidden">
          <div className="card-header bg-brand text-white p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/20 text-blue-300 rounded-lg">
                  <Ruler className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Units of Measure</h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/30 text-blue-200">
                      {filteredUoms.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">Inventory measurement units</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenModal("uom", "create")}
                className="btn-success btn-sm flex items-center gap-1.5 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add UOM</span>
              </button>
            </div>
          </div>

          <div className="card-body p-0 flex-1 flex flex-col">
            {uomsError && (
              <div className="p-3 text-xs text-red-600 bg-red-50 border-b border-red-100">{uomsError}</div>
            )}
            <div className="overflow-x-auto flex-1 max-h-[380px] overflow-y-auto">
              <table
                className="w-full min-w-[560px] border-collapse text-sm"
                style={{ width: "100%", tableLayout: "fixed" }}
              >
                <colgroup>
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "32%" }} />
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "17%" }} />
                </colgroup>
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-10">
                  <tr>
                    <th style={{ width: "34%" }} className="py-2.5 px-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Name</th>
                    <th style={{ width: "32%" }} className="py-2.5 px-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Type</th>
                    <th style={{ width: "17%" }} className="py-2.5 px-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Active</th>
                    <th style={{ width: "17%" }} className="py-2.5 px-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {uomsLoading ? (
                    <tr>
                      <td colSpan="4" className="text-center py-8 text-slate-400">Loading units of measure...</td>
                    </tr>
                  ) : !filteredUoms.length ? (
                    <tr>
                      <td colSpan="4" className="text-center py-8 text-slate-400">No units of measure found</td>
                    </tr>
                  ) : (
                    filteredUoms.map((u) => {
                      const isActive = u.is_active === 1 || u.is_active === true || u.is_active === "Y";
                      return (
                        <tr key={u.id || u.uom_code} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td style={{ width: "34%" }} className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium truncate" title={u.uom_name || u.name}>
                            {u.uom_name || u.name}
                          </td>
                          <td style={{ width: "32%" }} className="py-2.5 px-3 truncate">
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {u.uom_type || u.type || "COUNT"}
                            </span>
                          </td>
                          <td style={{ width: "17%" }} className="py-2.5 px-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"}`}>
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ width: "17%" }} className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenModal("uom", "edit", u)}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Direct In-Place Modal for Adding / Editing Classification Sections */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div
              className="p-5 border-b"
              style={{ backgroundColor: "#0E3646" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {modalMode === "create" ? "Add" : modalMode === "edit" ? "Edit" : "View"}{" "}
                    {modalType === "group"
                      ? "Item Group"
                      : modalType === "category"
                        ? "Item Category"
                        : modalType === "type"
                          ? "Item Type"
                          : "Unit of Measure"}
                  </h2>
                  <p className="text-xs text-slate-200 mt-0.5">
                    {modalMode === "view"
                      ? "Classification details (Read-Only)"
                      : "Configure hierarchy linkage and attributes"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <fieldset disabled={modalMode === "view"} className="p-6 space-y-4 border-0 m-0">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  className="input w-full"
                  readOnly={modalType !== "uom" && modalType !== "type" && modalMode === "create"}
                  placeholder={modalType === "type" ? "e.g. RAW_MATERIAL, PROD_01" : ""}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="input w-full"
                  placeholder="Enter classification name"
                />
              </div>

              {/* Group Modal: Select Parent Item Type */}
              {modalType === "group" && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Item Type *
                  </label>
                  <select
                    value={formData.item_type_id}
                    onChange={(e) =>
                      setFormData({ ...formData, item_type_id: e.target.value })
                    }
                    className="input w-full"
                    required
                  >
                    <option value="">-- Select Item Type --</option>
                    {itemTypes.map((t) => (
                      <option key={t.type_id || t.id} value={t.type_id || t.id}>
                        {t.type_name || t.type_code || t.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Item groups must fall under an item type.</p>
                </div>
              )}

              {/* Category Modal: Select Parent Item Group */}
              {modalType === "category" && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Item Group *
                  </label>
                  <select
                    value={formData.item_group_id}
                    onChange={(e) =>
                      setFormData({ ...formData, item_group_id: e.target.value })
                    }
                    className="input w-full"
                    required
                  >
                    <option value="">-- Select Item Group --</option>
                    {groups.map((g) => (
                      <option key={g.group_id || g.id} value={g.group_id || g.id}>
                        {g.group_name} {g.item_type_name ? `(${g.item_type_name})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Item categories must fall under an item group.</p>
                </div>
              )}

              {/* Category Modal: Optional Parent Category */}
              {modalType === "category" && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Parent Category (Optional)
                  </label>
                  <select
                    value={formData.parent}
                    onChange={(e) =>
                      setFormData({ ...formData, parent: e.target.value })
                    }
                    className="input w-full"
                  >
                    <option value="">Root (No Parent)</option>
                    {categories
                      .filter(
                        (c) =>
                          String(c.category_id || c.id) !==
                          String(selectedItem?.category_id || selectedItem?.id),
                      )
                      .map((c) => (
                        <option key={c.category_id || c.id} value={c.category_id || c.id}>
                          {c.category_name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* UOM Modal: Select UOM Type */}
              {modalType === "uom" && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Measurement Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="input w-full"
                  >
                    {UOM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.value })
                  }
                  className="input w-full"
                >
                  <option value="Y">Active</option>
                  <option value="N">Inactive</option>
                </select>
              </div>
            </fieldset>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-secondary"
              >
                {modalMode === "view" ? "Close" : "Cancel"}
              </button>
              {modalMode !== "view" && (
                <button
                  type="button"
                  onClick={handleSubmitModal}
                  disabled={savingModal}
                  className={
                    modalMode === "create"
                      ? "btn-success px-5 py-2 font-medium"
                      : "btn-primary px-5 py-2 font-medium"
                  }
                  data-rbac-exempt="true"
                >
                  {savingModal ? "Saving..." : modalMode === "create" ? "Add" : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
