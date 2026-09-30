/**
 * @fileoverview ShippingAdviceForm component.
 * Provides functionality for ShippingAdviceForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { useAuth } from "../../../../auth/AuthContext.jsx";
import defaultLogo from "../../../../assets/resources/OMNISUITE_LOGO_FILL.png";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ShippingAdviceForm() {
  const { hasExceptional } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [purchaseOrders, setPurchaseOrders] = useState([]);

  // Data State
  const [formData, setFormData] = useState({
    advice_no: "Auto-generated",
    advice_date: new Date().toISOString().split("T")[0],
    po_id: "",
    status: "IN_TRANSIT",
    shipping_method: "",
    shipping_company: "",
    tracking_number: "",
    vessel_name: "",
    voyage_number: "",
    port_of_loading: "",
    port_of_discharge: "",
    bl_number: "",
    bl_date: "",
    container_numbers: "",
    total_packages: 0,
    gross_weight: 0,
    volume: 0,
    etd: "",
    eta: "",
    remarks: "",
  });

  const [items, setItems] = useState([]);
  const [timeline, setTimeline] = useState([]);

  // To store PO details for reference (e.g. ordered qty)
  const [poDetails, setPoDetails] = useState([]);
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

  // Load Purchase Orders List excluding ones with existing Shipping Advice
  useEffect(() => {
    Promise.all([
      api.get("/purchase/orders?status=APPROVED"),
      api.get("/purchase/shipping-advices"),
    ])
      .then(([poRes, saRes]) => {
        const allOrders = Array.isArray(poRes.data?.items)
          ? poRes.data.items
          : [];
        const importOrders = allOrders.filter(
          (po) => String(po.po_type || "").toUpperCase() === "IMPORT",
        );
        const advices = Array.isArray(saRes.data?.items)
          ? saRes.data.items
          : [];
        const activeAdvices = advices.filter(
          (a) => String(a.status || "").toUpperCase() !== "CANCELLED",
        );
        const advisedPoIds = new Set(
          activeAdvices
            .map((a) => a.po_id || a.poId)
            .filter((v) => v != null)
            .map((v) => String(v)),
        );
        const advisedPoNos = new Set(
          activeAdvices
            .map((a) => a.po_no || a.poNo)
            .filter((v) => v != null)
            .map((v) => String(v)),
        );
        const filtered = importOrders.filter((po) => {
          const pid = String(po.id);
          const pno = String(po.po_no || po.poNo || "");
          if (advisedPoIds.has(pid)) return false;
          if (pno && advisedPoNos.has(pno)) return false;
          return true;
        });
        setPurchaseOrders(filtered);
      })
      .catch((e) => console.error(e));
  }, []);

  useEffect(() => {
    fetchCompanyInfo();
  }, []);

  useEffect(() => {
    if (!isNew) return;
    (async () => {
      try {
        const res = await api.get("/purchase/shipping-advices/next-no");
        const nextNo = res.data?.nextNo;
        if (nextNo) {
          setFormData((prev) => ({ ...prev, advice_no: nextNo }));
        }
      } catch {}
    })();
  }, [isNew]);

  async function fetchCompanyInfo() {
    try {
      const meResp = await api.get("/admin/me");
      const companyId = meResp.data?.scope?.companyId;
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
      setCompanyInfo((prev) => ({
        ...prev,
        logoUrl: prev.logoUrl || defaultLogo,
      }));
    }
  }

  // Load Existing Shipping Advice
  useEffect(() => {
    if (isNew) return;

    setLoading(true);
    api
      .get(`/purchase/shipping-advices/${id}`)
      .then((res) => {
        const d = res.data?.item || {};
        const loadedItems = d.details || []; // Adjusted based on API response structure
        // const loadedTimeline = res.data?.timeline || []; // Timeline not yet in API, ignoring for now

        setFormData({
          advice_no: d.advice_no,
          advice_date: d.advice_date ? d.advice_date.split("T")[0] : "",
          po_id: d.po_id,
          supplier_id: d.supplier_id, // Ensure supplier_id is set
          status: d.status,
          // shipping_method: d.shipping_method || "", // Not in schema yet
          // shipping_company: d.shipping_company || "",
          tracking_number: d.bill_of_lading || "",
          vessel_name: d.vessel_name || "",
          // voyage_number: d.voyage_number || "",
          // port_of_loading: d.port_of_loading || "",
          // port_of_discharge: d.port_of_discharge || "",
          // bl_date: d.bl_date ? d.bl_date.split("T")[0] : "",
          container_numbers: d.container_no || "",
          // total_packages: d.total_packages || 0,
          // gross_weight: d.gross_weight || 0,
          // volume: d.volume || 0,
          etd: d.etd_date ? d.etd_date.split("T")[0] : "",
          eta: d.eta_date ? d.eta_date.split("T")[0] : "",
          remarks: d.remarks || "",
        });

        setItems(
          loadedItems.map((i) => ({
            item_id: i.item_id,
            item_code: i.item_code,
            item_name: i.item_name,
            ordered_qty: 0, // We'll get this from PO details
            shipped_qty: i.qty_shipped,
            uom: "pcs", // Default or fetch
            remarks: i.remarks || "",
          })),
        );
        // setTimeline(loadedTimeline);
      })
      .catch((e) =>
        setError(e?.response?.data?.message || "Failed to load data"),
      )
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Load PO Details when PO is selected
  useEffect(() => {
    if (!formData.po_id) return;

    // If we are in "New" mode, or if we switched POs, we might want to refresh items.
    // But for "Edit" mode, we already loaded saved items.
    // We still fetch PO details to know the "Ordered Qty" for reference.

    api
      .get(`/purchase/orders/${formData.po_id}`)
      .then((res) => {
        const details = res.data?.item?.details || [];
        const po = res.data?.item;
        setPoDetails(details);

        // Update supplier if not set
        if (po && po.supplier_id) {
          setFormData((prev) => ({ ...prev, supplier_id: po.supplier_id }));
        }

        // If New Mode and no items yet, populate from PO
        if (isNew && items.length === 0) {
          const initialItems = details.map((d) => ({
            item_id: d.item_id,
            item_code: d.item_code,
            item_name: d.item_name,
            ordered_qty: d.qty,
            shipped_qty: d.qty, // Default to full shipment
            uom: d.uom || "pcs",
            package_numbers: "",
            remarks: "",
          }));
          setItems(initialItems);
        } else if (items.length > 0) {
          // Update ordered_qty in existing items
          setItems((prev) =>
            prev.map((item) => {
              const poItem = details.find(
                (d) => String(d.item_id) === String(item.item_id),
              );
              return poItem ? { ...item, ordered_qty: poItem.qty } : item;
            }),
          );
        }
      })
      .catch(console.error);
  }, [formData.po_id, isNew]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addTimelineEvent = () => {
    setTimeline([
      {
        status_title: "",
        status_date: new Date().toISOString().slice(0, 16),
        description: "",
        location: "",
      },
      ...timeline,
    ]);
  };

  const handleTimelineChange = (index, field, value) => {
    const newTimeline = [...timeline];
    newTimeline[index] = { ...newTimeline[index], [field]: value };
    setTimeline(newTimeline);
  };

  const removeTimeline = (index) => {
    setTimeline(timeline.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const supplierFromList =
        purchaseOrders.find((po) => String(po.id) === String(formData.po_id))
          ?.supplier_id || null;
      const payload = {
        advice_no: formData.advice_no,
        advice_date: formData.advice_date,
        po_id: formData.po_id,
        supplier_id: formData.supplier_id || supplierFromList,
        status: formData.status || "IN_TRANSIT",
        vessel_name: formData.vessel_name || null,
        bill_of_lading: formData.tracking_number || null,
        container_no: formData.container_numbers || null,
        etd_date: formData.etd || null,
        eta_date: formData.eta || null,
        remarks: formData.remarks || null,
        details: items.map((i) => ({
          item_id: i.item_id,
          qty_shipped: Number(i.shipped_qty) || 0,
          remarks: i.remarks || null,
        })),
      };

      if (isNew) {
        await api.post("/purchase/shipping-advices", payload);
      } else {
        await api.put(`/purchase/shipping-advices/${id}`, payload);
      }
      navigate("/purchase/shipping-advice");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const notifyArrival = () => {
    alert("Notification sent to warehouse and stakeholders!");
  };

  const printAdvice = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20">
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
            <div className="text-xl font-semibold">Shipping Advice</div>
          </div>
          <div className="text-right text-sm">
            <div>DATE: {formData.advice_date || ""}</div>
            <div>Advice #: {formData.advice_no || ""}</div>
          </div>
        </div>
      </div>
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isNew ? "New" : "Edit"} Shipping Advice
          </h1>
          <p className="text-sm text-slate-500">
            Manage shipment details, tracking, and items.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.history.back()} className="btn btn-outline">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Advice"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">Loading...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Info Card */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">
              General Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="label">Advice No</label>
                <input
                  type="text"
                  className="input bg-slate-100"
                  value={formData.advice_no}
                  disabled
                />
              </div>
              <div>
                <label className="label">Advice Date *</label>
                <input
                  type="date"
                  className="input"
                  name="advice_date"
                  value={formData.advice_date}
                  onChange={handleChange}
                  required
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div>
                <label className="label">Purchase Order *</label>
                <select
                  className="input"
                  name="po_id"
                  value={formData.po_id}
                  onChange={handleChange}
                  required
                  disabled={!isNew && items.length > 0}
                >
                  <option value="">Select PO...</option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.po_no} - {po.supplier_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="ARRIVED">Arrived</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Shipment Details */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">
              Shipment Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="label">Shipping Method</label>
                <select
                  className="input"
                  name="shipping_method"
                  value={formData.shipping_method}
                  onChange={handleChange}
                >
                  <option value="">Select...</option>
                  <option value="SEA">Sea Freight</option>
                  <option value="AIR">Air Freight</option>
                  <option value="ROAD">Road Freight</option>
                  <option value="COURIER">Courier</option>
                </select>
              </div>
              <div>
                <label className="label">Shipping Company</label>
                <input
                  type="text"
                  className="input"
                  name="shipping_company"
                  value={formData.shipping_company}
                  onChange={handleChange}
                  placeholder="e.g. Maersk, DHL"
                />
              </div>
              <div>
                <label className="label">Tracking / BL No</label>
                <input
                  type="text"
                  className="input"
                  name="tracking_number"
                  value={formData.tracking_number}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="label">Vessel / Flight Name</label>
                <input
                  type="text"
                  className="input"
                  name="vessel_name"
                  value={formData.vessel_name}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="label">Voyage No</label>
                <input
                  type="text"
                  className="input"
                  name="voyage_number"
                  value={formData.voyage_number}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="label">Port of Loading</label>
                <input
                  type="text"
                  className="input"
                  name="port_of_loading"
                  value={formData.port_of_loading}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="label">Port of Discharge</label>
                <input
                  type="text"
                  className="input"
                  name="port_of_discharge"
                  value={formData.port_of_discharge}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="label">Container Nos</label>
                <input
                  type="text"
                  className="input"
                  name="container_numbers"
                  value={formData.container_numbers}
                  onChange={handleChange}
                  placeholder="Comma separated"
                />
              </div>
              <div>
                <label className="label">ETD (Estimated Departure)</label>
                <input
                  type="date"
                  className="input"
                  name="etd"
                  value={formData.etd}
                  onChange={handleChange}
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div>
                <label className="label">ETA (Estimated Arrival)</label>
                <input
                  type="date"
                  className="input"
                  name="eta"
                  value={formData.eta}
                  onChange={handleChange}
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div>
                <label className="label">Total Packages</label>
                <input
                  type="number"
                  className="input"
                  name="total_packages"
                  value={formData.total_packages}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="label">Gross Weight (kg)</label>
                <input
                  type="number"
                  className="input"
                  name="gross_weight"
                  value={formData.gross_weight}
                  onChange={handleChange}
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-semibold">Items in Shipment</h3>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  // Optional: Allow adding custom items or re-fetching from PO
                }}
              >
                Refresh from PO
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th className="w-24">Ordered</th>
                    <th className="w-32">Shipped Qty</th>
                    <th className="w-24">UOM</th>
                    <th>Package Nos</th>
                    <th>Remarks</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.item_code}</td>
                      <td>{item.item_name}</td>
                      <td className="text-slate-500">{item.ordered_qty}</td>
                      <td>
                        <input
                          type="number"
                          className="input input-sm w-full"
                          value={item.shipped_qty}
                          onChange={(e) =>
                            handleItemChange(idx, "shipped_qty", e.target.value)
                          }
                          step="0.01"
                        />
                      </td>
                      <td>{item.uom}</td>
                      <td>
                        <input
                          type="text"
                          className="input input-sm w-full"
                          value={item.package_numbers}
                          onChange={(e) =>
                            handleItemChange(
                              idx,
                              "package_numbers",
                              e.target.value,
                            )
                          }
                          placeholder="e.g. 1-10"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="input input-sm w-full"
                          value={item.remarks}
                          onChange={(e) =>
                            handleItemChange(idx, "remarks", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => removeItem(idx)}
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan="8"
                        className="text-center py-4 text-slate-500"
                      >
                        No items selected. Select a PO to populate items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
