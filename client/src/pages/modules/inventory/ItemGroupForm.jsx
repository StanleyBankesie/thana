import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  FolderTree,
  Package,
  Ruler,
  X,
} from "lucide-react";
import { api } from "api/client";
import { toast } from "react-toastify";
import { useUoms } from "@/hooks/useUoms";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useItemTypes } from "@/hooks/useItemTypes";
import { filterAndSort } from "@/utils/searchUtils.js";

const ItemGroupForm = () => {
  const [activeTab, setActiveTab] = useState("groups");
  const [itemGroups, setItemGroups] = useState([]);

  // Use hooks for UOMs and Categories
  const { uoms: uomList, refresh: fetchUoms } = useUoms();
  const { categories: itemCategories, refresh: fetchCategories } =
    useItemCategories();
  const { itemTypes, refresh: fetchItemTypes } = useItemTypes();

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [modalType, setModalType] = useState("group");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "COUNT",
    parent: "",
    active: "Y",
  });

  const uomTypes = [
    { value: "COUNT", label: "Count" },
    { value: "WEIGHT", label: "Weight" },
    { value: "VOLUME", label: "Volume" },
    { value: "LENGTH", label: "Length" },
  ];

  const categoryList = (
    Array.isArray(itemCategories) ? itemCategories : []
  ).map((c) => ({
    ...c,
    category_id: c.category_id ?? c.id,
    is_active:
      c.is_active === 1 || c.is_active === true || c.is_active === "Y"
        ? "Y"
        : "N",
  }));

  const itemTypeList = (Array.isArray(itemTypes) ? itemTypes : []).map((t) => ({
    ...t,
    type_id: t.type_id ?? t.id,
    is_active:
      t.is_active === 1 || t.is_active === true || t.is_active === "Y"
        ? "Y"
        : "N",
  }));

  useEffect(() => {
    fetchGroups();
  }, []);

  async function requestWithFallback(method, paths, data = undefined) {
    let lastErr = null;
    for (const path of paths) {
      try {
        if (method === "get") return await api.get(path);
        if (method === "post") return await api.post(path, data);
        if (method === "put") return await api.put(path, data);
        if (method === "delete") return await api.delete(path);
      } catch (e) {
        lastErr = e;
        const status = e?.response?.status;
        if (status !== 404) throw e;
      }
    }
    if (lastErr) throw lastErr;
    return null;
  }

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await requestWithFallback("get", [
        "/inventory/item-groups",
        "/inventory/item-group",
        "/inventory/groups",
      ]);
      const groups = Array.isArray(res.data?.items) ? res.data.items : [];
      // Map API data to UI format
      const mappedGroups = groups.map((g) => ({
        group_id: g.id,
        group_code: g.group_code,
        group_name: g.group_name,
        is_active: g.is_active ? "Y" : "N",
      }));
      setItemGroups(mappedGroups);
    } catch (err) {
      console.error("Failed to fetch item groups", err);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = (prefix, list) => {
    const maxNum = list.reduce((max, item) => {
      const code =
        item.group_code ||
        item.category_code ||
        item.uom_code ||
        item.type_code;
      const num = parseInt(code.replace(/\D/g, "")) || 0;
      return Math.max(max, num);
    }, 0);
    return `${prefix}${(maxNum + 1).toString().padStart(3, "0")}`;
  };

  const handleOpenModal = (type, mode, item = null) => {
    setModalType(type);
    setModalMode(mode);

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
          ? itemGroups
          : type === "category"
            ? categoryList
            : type === "type"
              ? itemTypeList
              : uomList;
      setFormData({
        code: prefix ? generateCode(prefix, list) : "",
        name: "",
        type: "COUNT",
        parent: "",
        active: "Y",
      });
    } else if (mode === "edit" && item) {
      setFormData({
        code:
          item.group_code ||
          item.category_code ||
          item.uom_code ||
          item.type_code,
        name:
          item.group_name ||
          item.category_name ||
          item.uom_name ||
          item.type_name,
        type: item.uom_type || "COUNT",
        parent: item.parent_category_id || "",
        active: item.is_active === 1 || item.is_active === "Y" ? "Y" : "N",
      });
      setSelectedItem(item);
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      if (modalType === "group") {
        const isDuplicate = itemGroups.some((g) => {
          if (modalMode === "edit" && (g.group_id === selectedItem?.group_id || g.id === selectedItem?.id)) return false;
          return (
            g.group_code?.toString().toUpperCase() === formData.code.trim().toUpperCase() ||
            g.group_name?.toString().toUpperCase() === formData.name.trim().toUpperCase()
          );
        });

        if (isDuplicate) {
          toast.error("An item group with this code or name already exists.");
          setLoading(false);
          return;
        }

        const payload = {
          group_code: formData.code.trim(),
          group_name: formData.name.trim(),
          is_active: formData.active === "Y" ? 1 : 0,
        };

        if (modalMode === "create") {
          await requestWithFallback("post", [
            "/inventory/item-groups",
            "/inventory/item-group",
            "/inventory/groups",
          ], payload);
          toast.success("Item group created successfully");
        } else {
          const groupId = selectedItem?.group_id || selectedItem?.id;
          await requestWithFallback("put", [
            `/inventory/item-groups/${groupId}`,
            `/inventory/item-group/${groupId}`,
            `/inventory/groups/${groupId}`,
          ], payload);
          toast.success("Item group updated successfully");
        }
        await fetchGroups();
      } else if (modalType === "category") {
        const isDuplicate = categoryList.some((c) => {
          const catId = c.id || c.category_id;
          const selectedCatId = selectedItem?.id || selectedItem?.category_id;
          if (modalMode === "edit" && catId === selectedCatId) return false;
          return (
            c.category_code?.toString().toUpperCase() === formData.code.trim().toUpperCase() ||
            c.category_name?.toString().toUpperCase() === formData.name.trim().toUpperCase()
          );
        });

        if (isDuplicate) {
          toast.error("A category with this code or name already exists.");
          setLoading(false);
          return;
        }

        const payload = {
          category_code: formData.code.trim(),
          category_name: formData.name.trim(),
          parent_category_id: formData.parent || null,
          is_active: formData.active === "Y" ? 1 : 0,
        };

        if (modalMode === "create") {
          await requestWithFallback("post", [
            "/inventory/item-categories",
            "/inventory/item-category",
            "/inventory/categories",
          ], payload);
          toast.success("Category created successfully");
        } else {
          const categoryId = selectedItem?.id || selectedItem?.category_id;
          await requestWithFallback("put", [
            `/inventory/item-categories/${categoryId}`,
            `/inventory/item-category/${categoryId}`,
            `/inventory/categories/${categoryId}`,
          ], payload);
          toast.success("Category updated successfully");
        }
        await fetchCategories();
      } else if (modalType === "uom") {
        const isDuplicate = uomList.some((u) => {
          if (modalMode === "edit" && u.id === selectedItem?.id) return false;
          return (
            u.uom_code?.toString().toUpperCase() === formData.code.trim().toUpperCase() ||
            u.uom_name?.toString().toUpperCase() === formData.name.trim().toUpperCase()
          );
        });

        if (isDuplicate) {
          toast.error("A unit of measure with this code or name already exists.");
          setLoading(false);
          return;
        }

        const payload = {
          uom_code: formData.code.trim(),
          uom_name: formData.name.trim(),
          uom_type: formData.type,
          is_active: formData.active === "Y" ? 1 : 0,
        };

        if (modalMode === "create") {
          await api.post("/inventory/uoms", payload);
          toast.success("Unit of measure created successfully");
        } else {
          await api.put(`/inventory/uoms/${selectedItem.id}`, payload);
          toast.success("Unit of measure updated successfully");
        }
        await fetchUoms();
      } else if (modalType === "type") {
        const isDuplicate = itemTypeList.some((t) => {
          const typeId = t.id || t.type_id;
          const selectedTypeId = selectedItem?.id || selectedItem?.type_id;
          if (modalMode === "edit" && typeId === selectedTypeId) return false;
          return (
            t.type_code?.toString().toUpperCase() === formData.code.trim().toUpperCase() ||
            t.type_name?.toString().toUpperCase() === formData.name.trim().toUpperCase()
          );
        });

        if (isDuplicate) {
          toast.error("An item type with this code or name already exists.");
          setLoading(false);
          return;
        }

        const payload = {
          type_code: formData.code.trim(),
          type_name: formData.name.trim(),
          is_active: formData.active === "Y" ? 1 : 0,
        };

        if (modalMode === "create") {
          await api.post("/inventory/item-types", payload);
          toast.success("Item type created successfully");
        } else {
          await api.put(
            `/inventory/item-types/${selectedItem.type_id || selectedItem.id}`,
            payload,
          );
          toast.success("Item type updated successfully");
        }
        await fetchItemTypes();
      }
      setShowModal(false);
      setSelectedItem(null);
    } catch (err) {
      toast.error(
        "Failed to save item: " + (err.response?.data?.message || err.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    if (type === "group") {
      alert("Delete is not currently supported for Item Groups.");
    } else if (type === "category") {
      try {
        await api.delete(`/inventory/item-categories/${id}`);
        await fetchCategories();
      } catch (err) {
        alert(
          "Failed to delete category: " +
            (err.response?.data?.message || err.message),
        );
      }
    } else if (type === "uom") {
      try {
        await api.delete(`/inventory/uoms/${id}`);
        await fetchUoms();
      } catch (err) {
        alert(
          "Failed to delete UOM: " +
            (err.response?.data?.message || err.message),
        );
      }
    } else if (type === "type") {
      try {
        await api.delete(`/inventory/item-types/${id}`);
        await fetchItemTypes();
      } catch (err) {
        alert(
          "Failed to delete item type: " +
            (err.response?.data?.message || err.message),
        );
      }
    }
  };

  const getCategoryParentName = (parentId) => {
    if (!parentId) return "Root";
    const parent = categoryList.find((c) => c.category_id === parentId);
    return parent ? parent.category_name : "Root";
  };

  const getUomTypeName = (type) => {
    return uomTypes.find((t) => t.value === type)?.label || type;
  };

  const filterData = (data, term, getKeys) => {
    const q = String(term || "").trim();
    if (!q) return data.slice();
    return filterAndSort(data, { query: q, getKeys });
  };

  const filteredGroups = filterData(itemGroups, searchTerm, (it) => [
    it.group_code,
    it.group_name,
  ]);
  const filteredCategories = filterData(itemCategories, searchTerm, (it) => [
    it.category_code,
    it.category_name,
  ]);
  const filteredUoms = filterData(uomList, searchTerm, (it) => [
    it.uom_code,
    it.uom_name,
  ]);
  const filteredTypes = filterData(itemTypes, searchTerm, (it) => [
    it.type_code,
    it.type_name,
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="mb-2">
            <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 text-sm text-brand hover:text-brand-700"
              data-rbac-exempt="true"
            >
              ← Back to Item Groups
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Item Setup Management
          </h1>
          <p className="text-gray-600">
            Manage item groups, categories, and units of measure
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Item Groups</p>
                <p className="text-2xl font-bold text-gray-900">
                  {itemGroups.length}
                </p>
              </div>
              <Package className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Categories</p>
                <p className="text-2xl font-bold text-gray-900">
                  {categoryList.length}
                </p>
              </div>
              <FolderTree className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Item Types</p>
                <p className="text-2xl font-bold text-gray-900">
                  {itemTypeList.length}
                </p>
              </div>
              <Package className="w-10 h-10 text-amber-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Units of Measure</p>
                <p className="text-2xl font-bold text-gray-900">
                  {uomList.length}
                </p>
              </div>
              <Ruler className="w-10 h-10 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab("groups")}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "groups"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Item Groups
                </div>
              </button>
              <button
                onClick={() => setActiveTab("categories")}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "categories"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FolderTree className="w-5 h-5" />
                  Categories
                </div>
              </button>
              <button
                onClick={() => setActiveTab("types")}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "types"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Item Types
                </div>
              </button>
              <button
                onClick={() => setActiveTab("uom")}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === "uom"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Ruler className="w-5 h-5" />
                  Units of Measure
                </div>
              </button>
            </nav>
          </div>

          <div className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex-1 w-full md:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <button
                onClick={() =>
                  handleOpenModal(
                    activeTab === "groups"
                      ? "group"
                      : activeTab === "categories"
                        ? "category"
                        : activeTab === "types"
                          ? "type"
                          : "uom",
                    "create",
                  )
                }
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90"
                style={{ backgroundColor: "#0E3646" }}
                data-rbac-exempt="true"
              >
                <Plus className="w-5 h-5" />
                Add New
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === "groups" && (
              <table className="w-full">
                <thead style={{ backgroundColor: "#0E3646" }}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Group Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading && (
                    <tr>
                      <td colSpan="4" className="text-center py-4">
                        Loading...
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    filteredGroups.map((group) => (
                      <tr key={group.group_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {group.group_code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {group.group_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              group.is_active === "Y"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {group.is_active === "Y" ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleOpenModal("group", "edit", group)
                              }
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}

            {activeTab === "categories" && (
              <table className="w-full">
                <thead style={{ backgroundColor: "#0E3646" }}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Category Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Parent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCategories.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {category.category_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {category.category_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {getCategoryParentName(category.parent_category_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            category.is_active === "Y" ||
                            category.is_active === 1 ||
                            category.is_active === true
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {category.is_active === "Y" ||
                          category.is_active === 1 ||
                          category.is_active === true
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleOpenModal("category", "edit", category)
                            }
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "types" && (
              <table className="w-full">
                <thead style={{ backgroundColor: "#0E3646" }}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Type Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTypes.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {t.type_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {t.type_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            t.is_active === "Y" ||
                            t.is_active === 1 ||
                            t.is_active === true
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {t.is_active === "Y" ||
                          t.is_active === 1 ||
                          t.is_active === true
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenModal("type", "edit", t)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete("type", t.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "uom" && (
              <table className="w-full">
                <thead style={{ backgroundColor: "#0E3646" }}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      UOM Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUoms.map((uom) => (
                    <tr key={uom.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {uom.uom_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {uom.uom_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {getUomTypeName(uom.uom_type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            uom.is_active === "Y" ||
                            uom.is_active === 1 ||
                            uom.is_active === true
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {uom.is_active === "Y" ||
                          uom.is_active === 1 ||
                          uom.is_active === true
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenModal("uom", "edit", uom)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete("uom", uom.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div
              className="p-6 border-b"
              style={{ backgroundColor: "#0E3646" }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {modalMode === "create" ? "Add" : "Edit"}{" "}
                  {modalType === "group"
                    ? "Group"
                    : modalType === "category"
                      ? "Category"
                      : modalType === "type"
                        ? "Item Type"
                        : "UOM"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  readOnly={modalType !== "uom" && modalMode === "create"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter name"
                />
              </div>

              {modalType === "category" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parent Category
                  </label>
                  <select
                    value={formData.parent}
                    onChange={(e) =>
                      setFormData({ ...formData, parent: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Root (No Parent)</option>
                    {categoryList
                      .filter(
                        (c) => c.category_id !== selectedItem?.category_id,
                      )
                      .map((c) => (
                        <option key={c.category_id} value={c.category_id}>
                          {c.category_name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {modalType === "uom" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {uomTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.active}
                  onChange={(e) =>
                    setFormData({ ...formData, active: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Y">Active</option>
                  <option value="N">Inactive</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-lg">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 text-white rounded-lg hover:opacity-90"
                style={{ backgroundColor: "#0E3646" }}
                data-rbac-exempt="true"
              >
                {modalMode === "create" ? "Create" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemGroupForm;
