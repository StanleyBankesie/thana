/**
 * @fileoverview DeliveryForm component.
 * Provides functionality for DeliveryForm.
 */

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../api/client";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import { usePermission } from "../../../../auth/PermissionContext.jsx";
import { ArrowLeft, Save, Search, Truck, CheckCircle } from "lucide-react";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function DeliveryForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { hasExceptional } = usePermission();
  const { scope } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [taxes, setTaxes] = useState([]);

  const [formData, setFormData] = useState({
    delivery_no: "",
    delivery_date: new Date().toISOString().split("T")[0],
    customer_id: "",
    sales_order_id: "",
    invoice_id: "",
    warehouse_id: "",
    status: "DRAFT",
    remarks: "",
    delivery_instructions: "",
    terms_and_conditions: "",
    total_tax: 0,
    invoice_amount: 0,
    items: [],
  });

  // Search states
  const [searchOrderNo, setSearchOrderNo] = useState("");

  // Data Lists
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [itemsCatalog, setItemsCatalog] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    loadCustomers();
    loadInvoices();
    loadItems();
    loadWarehouses();
    fetchTaxCodes();
    if (isEdit) {
      loadDelivery(id);
    } else {
      (async () => {
        try {
          const nextNo = await getNextDeliveryNo();
          setFormData((prev) => ({ ...prev, delivery_no: nextNo }));
        } catch {
          setFormData((prev) => ({ ...prev, delivery_no: "DN-000001" }));
        }
      })();
    }
  }, [id]);

  async function loadCustomers() {
    try {
      const res = await api.get("/sales/customers", {
        params: { active: "true" }
      });
      setCustomers(res.data.items || []);
    } catch (err) {
      console.error("Failed to load customers", err);
    }
  }

  async function loadInvoices() {
    try {
      const [invRes, delRes] = await Promise.all([
        api.get("/sales/invoices"),
        api.get("/sales/deliveries"),
      ]);
      const invs = Array.isArray(invRes.data?.items) ? invRes.data.items : [];
      const dels = Array.isArray(delRes.data?.items) ? delRes.data.items : [];
      const usedInvoiceIds = new Set(
        dels
          .map((d) => d?.invoice_id)
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v)),
      );
      const usedOrderIds = new Set(
        dels
          .map((d) => d?.sales_order_id)
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v)),
      );
      let filtered = invs;
      if (usedInvoiceIds.size > 0) {
        filtered = filtered.filter((i) => !usedInvoiceIds.has(String(i.id)));
      } else {
        filtered = filtered.filter(
          (i) => !usedOrderIds.has(String(i.sales_order_id)),
        );
      }
      setInvoices(filtered);
    } catch (err) {
      console.error("Failed to load invoices", err);
    }
  }

  
  async function loadWarehouses() {
    try {
      const res = await api.get("/inventory/warehouses");
      setWarehouses(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      console.error("Failed to load warehouses", err);
    }
  }

  async function loadItems() {
    try {
      const res = await api.get("/inventory/items");
      setItemsCatalog(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      console.error("Failed to load items", err);
    }
  }

  async function getNextDeliveryNo() {
    try {
      const res = await api.get("/sales/deliveries/next-no");
      const nextNo = res.data?.nextNo || "";
      return nextNo || "DN-000001";
    } catch (err) {
      console.error("Failed to fetch deliveries for next no", err);
      return "DN-000001";
    }
  }

  const fetchTaxCodes = async () => {
    try {
      const response = await api.get("/finance/tax-codes", {
        params: { form: "DELIVERY_NOTE" },
      });
      const fetchedTaxes = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      const mappedTaxes = fetchedTaxes.map((t) => ({
        value: t.id,
        label: t.name,
        rate: Number(t.rate_percent),
      }));
      setTaxes(mappedTaxes);
    } catch (error) {
      console.error("Error fetching tax codes:", error);
    }
  };

  async function loadDelivery(deliveryId) {
    try {
      setLoading(true);
      const res = await api.get(`/sales/deliveries/${deliveryId}`);
      const header = res.data?.item || {};
      const details = Array.isArray(res.data?.details) ? res.data.details : [];
      setFormData((prev) => ({
        ...prev,
        delivery_no: header.delivery_no || prev.delivery_no,
        delivery_date:
          (header.delivery_date
            ? String(header.delivery_date).slice(0, 10)
            : prev.delivery_date) || prev.delivery_date,
        customer_id: header.customer_id || "",
        sales_order_id: header.sales_order_id || "",
        invoice_id: header.invoice_id || "",
        warehouse_id: header.warehouse_id || "",
        status: header.status || prev.status,
        remarks: header.remarks || "",
        delivery_instructions: header.delivery_instructions || "",
        terms_and_conditions: header.terms_and_conditions || "",
        total_tax: Number(header.total_tax || 0),
        invoice_amount: Number(header.invoice_amount || 0),
        items: details.map((d) => ({
          item_id: d.item_id,
          item_name: d.item_name || "",
          quantity: Number(d.quantity || 0),
          ordered_qty: Number(d.quantity || 0),
          tax_type: d.tax_id || "",
          uom: d.uom || "PCS",
          unit_price: Number(d.unit_price || 0),
        })),
      }));
      setLoading(false);
    } catch (err) {
      setError("Failed to load delivery");
      setLoading(false);
    }
  }

  async function fetchItemBatches(itemId, index) {
    try {
      const res = await api.get(`/inventory/items/${itemId}/batches`);
      const batches = res.data?.items || [];
      setFormData((prev) => {
        const newItems = [...prev.items];
        newItems[index].available_batches = batches;
        return { ...prev, items: newItems };
      });
    } catch (err) {
      console.error("Error fetching batches:", err);
    }
  }

  function handleItemChange(index, field, value) {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index][field] = value;
      return { ...prev, items: newItems };
    });
  }

  async function handleInvoiceSelect(invoiceId) {
    if (!invoiceId) return;

    try {
      setLoading(true);
      const invRes = await api.get(`/sales/invoices/${invoiceId}`);
      const invItem = invRes.data?.item || {};
      const invDetails = Array.isArray(invRes.data?.details)
        ? invRes.data.details
        : [];
      let itemsToLoad = invDetails;
      if (!itemsToLoad.length) {
        const inList = invoices.find((i) => String(i.id) === String(invoiceId));
        if (inList?.sales_order_id) {
          const orderRes = await api.get(
            `/sales/orders/${inList.sales_order_id}`,
          );
          itemsToLoad = Array.isArray(orderRes.data?.details)
            ? orderRes.data.details
            : [];
          setSearchOrderNo(orderRes.data?.item?.order_no || "");
        } else {
          setSearchOrderNo("");
        }
      } else {
        setSearchOrderNo("");
      }
      setFormData((prev) => ({
        ...prev,
        customer_id: invItem.customer_id || prev.customer_id,
        sales_order_id: invItem.sales_order_id || "",
        invoice_id: invItem.id || invoiceId,
        warehouse_id: invItem.warehouse_id || "",
        total_tax: Number(invItem.tax_amount || 0),
        invoice_amount: Number(invItem.total_amount || 0),
        delivery_instructions: invItem.remarks || "",
        items: itemsToLoad.map((d) => ({
          item_id: d.item_id,
          item_name:
            d.item_name ||
            itemsCatalog.find((p) => String(p.id) === String(d.item_id))
              ?.item_name ||
            "",
          quantity: Number(d.quantity || 0),
          ordered_qty: Number(d.quantity || 0),
          tax_type: d.tax_id || (taxes.length > 0 ? taxes[0].value : ""),
          batch_id: "",
          uom: d.uom || "PCS",
          unit_price: Number(d.unit_price || 0),
        })),
      }));
      setSuccess(
        `Loaded from Invoice ${invItem.invoice_no || String(invoiceId)}`,
      );
    } catch (err) {
      console.error(err);
      alert("Error loading invoice details");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.customer_id) {
      alert("Please select a customer");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        company_id: scope?.companyId || 1,
        branch_id: scope?.branchId,
        invoice_id: formData.invoice_id || null,
        warehouse_id: formData.warehouse_id || null,
        sales_order_id: formData.sales_order_id || null,
        items: formData.items.map((item) => {
          const tax = taxes.find((t) => t.value == item.tax_type);
          const itemPayload = {
            item_id: item.item_id,
            quantity: Number(item.quantity),
            batch_id: item.batch_id || null,
          };
          if (item.tax_type) {
            itemPayload.tax_id = item.tax_type;
            itemPayload.tax_rate = tax ? tax.rate : 0;
            itemPayload.tax_amount = 0;
          }
          return itemPayload;
        }),
      };
      if (isEdit) {
        await api.put(`/sales/deliveries/${id}`, payload);
      } else {
        await api.post("/sales/deliveries", payload);
      }
      setSuccess("Delivery saved successfully");
      setTimeout(() => navigate("/sales/delivery"), 1500);
    } catch (err) {
      const serverMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to save delivery";
      setError(serverMessage);
    } finally {
      setSaving(false);
    }
  }

  function updateStatus(newStatus) {
    if (isEdit && id) {
      (async () => {
        try {
          await api.put(`/sales/deliveries/${id}/status`, {
            status: newStatus,
          });
          setFormData((prev) => ({ ...prev, status: newStatus }));
          setSuccess(`Status updated to ${newStatus}`);
        } catch (err) {
          setError("Failed to update status");
          console.error(err);
        }
      })();
    } else {
      setFormData((prev) => ({ ...prev, status: newStatus }));
    }
  }

  if (loading && !formData.customer_id)
    return <div className="p-8">Loading...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">
            {isEdit ? "Edit Delivery" : "New Delivery"}
          </h1>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => updateStatus("DELIVERED")}
            disabled={
              !isEdit ||
              saving ||
              String(formData.status || "").toUpperCase() === "DELIVERED"
            }
            className="btn-success flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Auto Delivery
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Delivery
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded mb-6">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 p-4 rounded mb-6">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Delivery Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery No
                </label>
                <input
                  type="text"
                  value={formData.delivery_no}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_no: e.target.value })
                  }
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_date: e.target.value })
                  }
                  className="w-full border rounded p-2"
                  disabled={isEdit && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border rounded p-2"
                  required
                  value={formData.warehouse_id || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouse_id: e.target.value })
                  }
                >
                  <option value="">-- Select Warehouse --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer
                </label>
                <input
                  type="text"
                  className="w-full border rounded p-2"
                  placeholder="Search customer..."
                  value={
                    customers.find((c) => String(c.id) === String(formData.customer_id))?.customer_name ||
                    customerSearch
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerSearch(val);
                    setFormData({
                      ...formData,
                      customer_id: "",
                      invoice_id: "",
    warehouse_id: "",
                      sales_order_id: "",
                      items: [],
                    });
                    setSearchOrderNo("");
                  }}
                />
                {customerSearch && (
                  (() => {
                    const q = customerSearch.toLowerCase();
                    const matched = customers.filter(
                      (c) =>
                        String(c.customer_name || "").toLowerCase().includes(q) ||
                        String(c.customer_code || "").toLowerCase().includes(q)
                    ).slice(0, 10);
                    return matched.length > 0 ? (
                      <div className="absolute z-30 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                        {matched.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                customer_id: String(c.id),
                                invoice_id: "",
    warehouse_id: "",
                                sales_order_id: "",
                                items: [],
                              });
                              setSearchOrderNo("");
                              setCustomerSearch("");
                            }}
                          >
                            <div className="font-medium text-slate-800 text-sm">{c.customer_name}</div>
                            {c.customer_code && <div className="text-xs text-slate-500">{c.customer_code}</div>}
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })()
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Load Items</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Invoice Selection */}
              <div className="p-4 bg-gray-50 rounded border col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Invoice
                </label>
                <select
                  className="w-full border rounded p-2"
                  onChange={(e) => handleInvoiceSelect(e.target.value)}
                  value={formData.invoice_id || ""}
                >
                  <option value="">Select an Invoice...</option>
                  {invoices
                    .filter((inv) =>
                      formData.customer_id
                        ? String(inv.customer_id) === String(formData.customer_id)
                        : true,
                    )
                    .map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_no} - {new Date(inv.invoice_date).toLocaleDateString()} (
                        {inv.total_amount})
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Selecting an invoice will populate customer and order details.
                </p>
              </div>

              {/* Sales Order Display */}
              <div className="p-4 bg-gray-50 rounded border col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sales Order Number
                </label>
                <input
                  type="text"
                  placeholder="Sales Order No"
                  value={searchOrderNo}
                  readOnly
                  className="w-full border rounded p-2 bg-gray-100 text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex justify-end mb-2">
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    items: prev.items.map((item) => ({ ...item, batch_id: "" })),
                  }));
                }}
              >
                Auto Allocate (FIFO)
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="p-3 w-[40%]">Item</th>
                    <th className="p-3 w-28">Qty</th>
                    <th className="p-3 w-24">UOM</th>
                    <th className="p-3 w-48">Batch</th>
                    <th className="p-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formData.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-medium">{item.item_name}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...formData.items];
                            newItems[idx].quantity = parseFloat(e.target.value) || 0;
                            setFormData({ ...formData, items: newItems });
                          }}
                          className="w-full border rounded p-1"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          readOnly
                          value={item.uom || ""}
                          className="w-full border-none p-1 text-sm bg-transparent text-gray-600"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={item.batch_id || ""}
                          onFocus={() => fetchItemBatches(item.item_id, idx)}
                          onChange={(e) => handleItemChange(idx, "batch_id", e.target.value)}
                          className="w-full border rounded p-1 text-sm"
                        >
                          <option value="">AUTO (FIFO)</option>
                          {item.available_batches?.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.batch_no} ({b.qty} avail) {b.expiry_date ? `exp ${b.expiry_date.slice(0, 10)}` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            const newItems = formData.items.filter((_, i) => i !== idx);
                            setFormData({ ...formData, items: newItems });
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Financial Summary</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Amount
                </label>
                <input
                  type="number"
                  readOnly
                  value={formData.total_tax}
                  className="w-full border rounded p-2 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Amount
                </label>
                <input
                  type="number"
                  readOnly
                  value={formData.invoice_amount}
                  className="w-full border rounded p-2 bg-gray-50 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Instructions & Terms</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DELIVERY INSTRUCTIONS
                </label>
                <textarea
                  value={formData.delivery_instructions}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_instructions: e.target.value })
                  }
                  rows="3"
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TERMS AND CONDITIONS
                </label>
                <textarea
                  value={formData.terms_and_conditions}
                  onChange={(e) =>
                    setFormData({ ...formData, terms_and_conditions: e.target.value })
                  }
                  rows="3"
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({ ...formData, remarks: e.target.value })
                  }
                  rows="2"
                  className="w-full border rounded p-2"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
