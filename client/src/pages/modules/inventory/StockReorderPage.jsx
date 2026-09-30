/**
 * @fileoverview StockReorderPage component.
 * Provides functionality for StockReorderPage.
 */

import React, { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client";
import { toast } from "react-toastify";
import {
  Package,
  AlertTriangle,
  ArrowDown,
  Warehouse,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit,
  Save,
  RotateCcw,
  X,
  Download,
  Upload,
} from "lucide-react";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function StockReorderPage() {
  const [reorderPoints, setReorderPoints] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [searchItem, setSearchItem] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    item_id: "",
    warehouse_id: "",
    min_stock: "",
    max_stock: "",
    reorder_qty: "",
    lead_time: "0",
    supplier_id: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Stats
  const stats = useMemo(() => {
    let critical = 0;
    let low = 0;
    reorderPoints.forEach((rp) => {
      const stock = Number(rp.current_stock || 0);
      const min = Number(rp.min_stock || 0);
      if (stock < min) critical++;
      else if (stock < min * 1.2) low++;
    });
    return {
      total: reorderPoints.length,
      critical,
      low,
      activeWarehouses: new Set(reorderPoints.map((rp) => rp.warehouse_id))
        .size,
    };
  }, [reorderPoints]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rpRes, itemsRes, whRes, supRes] = await Promise.all([
        api.get("/inventory/reorder-points"),
        api.get("/inventory/items"),
        api.get("/inventory/warehouses"),
        api.get("/purchase/suppliers"),
      ]);

      setReorderPoints(rpRes.data.items || []);
      setItems(itemsRes.data.items || []);
      setWarehouses(whRes.data.items || []);
      setSuppliers(supRes.data.items || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterWarehouse) params.warehouseId = filterWarehouse;
      if (searchItem) params.search = searchItem;
      if (filterStatus) params.status = filterStatus;

      const res = await api.get("/inventory/reorder-points", { params });
      setReorderPoints(res.data.items || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to apply filters");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this reorder point?"))
      return;
    try {
      await api.delete(`/inventory/reorder-points/${id}`);
      toast.success("Reorder point deleted");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete reorder point");
    }
  };

  const handleEdit = (rp) => {
    setEditingId(rp.id);
    setFormData({
      item_id: rp.item_id,
      warehouse_id: rp.warehouse_id,
      min_stock: rp.min_stock,
      max_stock: rp.max_stock,
      reorder_qty: rp.reorder_qty,
      lead_time: rp.lead_time,
      supplier_id: rp.supplier_id || "",
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      item_id: "",
      warehouse_id: "",
      min_stock: "",
      max_stock: "",
      reorder_qty: "",
      lead_time: "0",
      supplier_id: "",
    });
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/inventory/reorder-points", formData);
      toast.success("Reorder point saved");
      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Failed to save reorder point",
      );
    }
  };

  const getStockStatus = (stock, min, max) => {
    stock = Number(stock);
    min = Number(min);
    if (stock < min)
      return {
        className: "bg-red-100 text-red-700 border-red-200",
        text: "Critical",
      };
    if (stock < min * 1.2)
      return {
        className: "bg-yellow-100 text-yellow-700 border-yellow-200",
        text: "Low Stock",
      };
    return {
      className: "bg-green-100 text-green-700 border-green-200",
      text: "Normal",
    };
  };

  const handleDownloadTemplate = async () => {
    try {
      console.log("🔄 Starting template download...");
      const response = await api.get(
        "/inventory/reorder-points/export/template",
        {
          responseType: "blob",
        },
      );
      console.log("✅ Template response received:", response);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "reorder_points_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Template downloaded successfully");
    } catch (err) {
      console.error("❌ Download template error:", err);
      console.error("Error response:", err.response);
      console.error("Error message:", err.message);
      toast.error(
        `Failed to download template: ${err.response?.data?.message || err.message}`,
      );
    }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          // Parse Excel file using xlsx if available
          const data = event.target?.result;
          if (!data) {
            toast.error("Failed to read file");
            return;
          }

          // Dynamic import for xlsx
          const XLSX = (await import("xlsx")).default;
          const arrayBuffer = new Uint8Array(data);
          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (!jsonData.length) {
            toast.error("File is empty");
            return;
          }

          // Send to backend for processing
          const response = await api.post(
            "/inventory/reorder-points/bulk-upload",
            {
              data: jsonData,
            },
          );

          if (response.data.processed > 0) {
            toast.success(
              `Successfully processed ${response.data.processed}/${response.data.total} entries`,
            );
            if (response.data.errors && response.data.errors.length > 0) {
              toast.warning(
                `${response.data.errors.length} entries had errors:\n${response.data.errors
                  .slice(0, 5)
                  .join(
                    "\n",
                  )}${response.data.errors.length > 5 ? "\n..." : ""}`,
              );
            }
            fetchData();
          } else {
            toast.error("No entries were processed");
            if (response.data.errors) {
              toast.error(response.data.errors.join("\n"));
            }
          }
        } catch (parseErr) {
          console.error(parseErr);
          toast.error("Failed to parse Excel file");
        } finally {
          setUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload file");
      setUploading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span className="text-3xl">📦</span> Stock Reorder Management
              System
            </h1>
            <p className="text-slate-500 mt-1">
              Manage inventory reorder points and maintain optimal stock levels
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              <Plus size={20} /> Add Reorder Point
            </button>
            <Link to="/inventory?section=Stock%20Operations" className="btn btn-secondary">
              Return to Menu
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border-l-4 border-cyan-800">
          <h3 className="text-slate-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
            <Package /> Total Items
          </h3>
          <div className="text-3xl font-bold text-cyan-900 dark:text-cyan-100">
            {stats.total}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border-l-4 border-red-500">
          <h3 className="text-slate-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
            <AlertTriangle className="text-red-500" /> Critical Stock
          </h3>
          <div className="text-3xl font-bold text-slate-800 dark:text-white">
            {stats.critical}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border-l-4 border-yellow-500">
          <h3 className="text-slate-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
            <ArrowDown className="text-yellow-500" /> Low Stock
          </h3>
          <div className="text-3xl font-bold text-slate-800 dark:text-white">
            {stats.low}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
          <h3 className="text-slate-500 text-xs font-bold uppercase mb-2 flex items-center gap-2">
            <Warehouse className="text-blue-500" /> Active Warehouses
          </h3>
          <div className="text-3xl font-bold text-slate-800 dark:text-white">
            {stats.activeWarehouses}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* List Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                Stock Reorder List
              </h2>
              <div className="flex gap-2">
                <button
                  className="btn btn-outline btn-sm gap-2"
                  onClick={handleDownloadTemplate}
                  disabled={uploading}
                >
                  <Download size={18} /> Download Template
                </button>
                <button
                  className="btn btn-outline btn-sm gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={18} />{" "}
                  {uploading ? "Uploading..." : "Bulk Upload"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBulkUpload}
                  style={{ display: "none" }}
                />
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text">Warehouse</span>
                </label>
                <select
                  className="select select-bordered w-full select-sm"
                  value={filterWarehouse}
                  onChange={(e) => setFilterWarehouse(e.target.value)}
                >
                  <option value="">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text">Item Search</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by item name..."
                    className="input input-bordered w-full input-sm pr-8"
                    value={searchItem}
                    onChange={(e) => setSearchItem(e.target.value)}
                  />
                  <Search
                    className="absolute right-3 top-2 text-slate-400"
                    size={16}
                  />
                </div>
              </div>
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text">Status</span>
                </label>
                <select
                  className="select select-bordered w-full select-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="critical">Critical</option>
                  <option value="low">Low Stock</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  className="btn btn-primary btn-sm w-full"
                  onClick={handleFilter}
                  disabled={loading}
                >
                  <Filter /> Filter
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th>Item</th>
                    <th>Warehouse</th>
                    <th>Current Stock</th>
                    <th>Levels (Min/Max)</th>
                    <th>Reorder Qty</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colspan="7" className="text-center py-4">
                        Loading...
                      </td>
                    </tr>
                  ) : reorderPoints.length === 0 ? (
                    <tr>
                      <td
                        colspan="7"
                        className="text-center py-8 text-slate-500"
                      >
                        <div className="flex flex-col items-center">
                          <Package className="text-4xl mb-2 opacity-20" />
                          No reorder points found
                        </div>
                      </td>
                    </tr>
                  ) : (
                    reorderPoints.map((rp) => {
                      const status = getStockStatus(
                        rp.current_stock || 0,
                        rp.min_stock,
                        rp.max_stock,
                      );
                      return (
                        <tr key={rp.id} className="hover">
                          <td>
                            <div className="font-bold">{rp.item_code}</div>
                            <div className="text-xs text-slate-500">
                              {rp.item_name}
                            </div>
                          </td>
                          <td>{rp.warehouse_name}</td>
                          <td className="font-mono">
                            {Number(rp.current_stock || 0)} {rp.uom}
                          </td>
                          <td className="text-xs">
                            <div>Min: {Number(rp.min_stock)}</div>
                            <div>Max: {Number(rp.max_stock)}</div>
                          </td>
                          <td>{Number(rp.reorder_qty)}</td>
                          <td>
                            <span
                              className={`badge ${status.className} font-semibold`}
                            >
                              {status.text}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                className="btn btn-ghost btn-xs text-blue-600"
                                onClick={() => handleEdit(rp)}
                                title="Edit"
                              >
                                <Edit />
                              </button>
                              <button
                                className="btn btn-ghost btn-xs text-red-600"
                                onClick={() => handleDelete(rp.id)}
                                title="Delete"
                              >
                                <Trash2 />
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
      </div>

      {/* Modal for Add/Edit Reorder Point */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                  {editingId ? "Edit Reorder Point" : "Add Reorder Point"}
                </h2>
                <button
                  onClick={closeModal}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text font-semibold">Item *</span>
                    </label>
                    <select
                      className="select select-bordered w-full select-sm"
                      required
                      value={formData.item_id}
                      onChange={(e) =>
                        setFormData({ ...formData, item_id: e.target.value })
                      }
                      disabled={!!editingId}
                    >
                      <option value="">Select Item</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.item_code} - {i.item_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text font-semibold">
                        Warehouse *
                      </span>
                    </label>
                    <select
                      className="select select-bordered w-full select-sm"
                      required
                      value={formData.warehouse_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          warehouse_id: e.target.value,
                        })
                      }
                      disabled={!!editingId}
                    >
                      <option value="">Select Warehouse</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.warehouse_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="divider text-xs text-slate-400">
                  Stock Levels
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">Min Stock *</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      className="input input-bordered w-full input-sm"
                      value={formData.min_stock}
                      onChange={(e) =>
                        setFormData({ ...formData, min_stock: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">Max Stock *</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      className="input input-bordered w-full input-sm"
                      value={formData.max_stock}
                      onChange={(e) =>
                        setFormData({ ...formData, max_stock: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">Reorder Qty *</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      className="input input-bordered w-full input-sm"
                      value={formData.reorder_qty}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reorder_qty: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-control w-full">
                    <label className="label">
                      <span className="label-text">Lead Time (Days)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="input input-bordered w-full input-sm"
                      value={formData.lead_time}
                      onChange={(e) =>
                        setFormData({ ...formData, lead_time: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="divider text-xs text-slate-400">Supplier</div>

                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text">Preferred Supplier</span>
                  </label>
                  <select
                    className="select select-bordered w-full select-sm"
                    value={formData.supplier_id}
                    onChange={(e) =>
                      setFormData({ ...formData, supplier_id: e.target.value })
                    }
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="submit"
                    className="btn btn-success btn-sm flex-1"
                  >
                    <Save /> {editingId ? "Update" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-warning btn-sm flex-1"
                    onClick={closeModal}
                  >
                    <X /> Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
