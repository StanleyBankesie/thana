/**
 * @fileoverview PortClearancesForm component.
 * Provides functionality for PortClearancesForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PortClearancesForm() {
  const { hasExceptional } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [shippingAdvice, setShippingAdvice] = useState([]);

  // Main Form Data
  const [formData, setFormData] = useState({
    clearance_no: isNew ? "Auto-generated" : "",
    clearance_date: new Date().toISOString().split("T")[0],
    shipping_advice_id: "",
    status: "PENDING",

    // New Fields
    port_of_entry: "",
    arrival_date: "",
    clearing_agent: "",
    target_clearance_date: "",
    customs_declaration_number: "",
    declaration_date: "",
    hs_code: "",
    assessment_date: "",

    // Total (computed)
    total_clearance_cost: 0,
  });

  // Charges Array
  const [charges, setCharges] = useState([]);

  // --- Fetch Shipping Advice eligible for clearance ---
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get("/purchase/shipping-advices"),
      api.get("/purchase/port-clearances"),
    ])
      .then(([saRes, pcRes]) => {
        if (!mounted) return;
        const advices = Array.isArray(saRes.data?.items)
          ? saRes.data.items
          : [];
        const clearances = Array.isArray(pcRes.data?.items)
          ? pcRes.data.items
          : [];
        const usedAdviceIds = new Set(
          clearances
            .map((c) => c.advice_id || c.adviceId)
            .filter((v) => v != null)
            .map((v) => String(v)),
        );
        const eligible = advices.filter((sa) => {
          const status = String(sa.status || "").toUpperCase();
          const isPendingClearance =
            status === "IN_TRANSIT" || status === "ARRIVED";
          const notUsed = !usedAdviceIds.has(String(sa.id));
          return isPendingClearance && notUsed;
        });
        setShippingAdvice(eligible);
      })
      .catch((e) => {
        if (!mounted) return;
        console.error("Failed to load shipping advice", e);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isNew) return;
    api
      .get("/purchase/port-clearances/next-no")
      .then((res) => {
        const nextNo = res.data?.nextNo;
        if (nextNo) {
          setFormData((prev) => ({ ...prev, clearance_no: nextNo }));
        }
      })
      .catch(() => {});
  }, [isNew]);

  // --- Handle Shipping Advice Selection ---
  useEffect(() => {
    if (!formData.shipping_advice_id) return;

    api
      .get(`/purchase/shipping-advices/${formData.shipping_advice_id}`)
      .then((res) => {
        const sa = res.data?.item;
        if (sa) {
          const eta =
            sa.eta_date && typeof sa.eta_date === "string"
              ? sa.eta_date.split("T")[0]
              : sa.eta_date || "";
          setFormData((prev) => ({
            ...prev,
            arrival_date: prev.arrival_date || eta || prev.arrival_date,
            target_clearance_date:
              prev.target_clearance_date || eta || prev.target_clearance_date,
          }));
        }
      })
      .catch(console.error);
  }, [formData.shipping_advice_id]);

  // --- Fetch Existing Record ---
  useEffect(() => {
    if (isNew) return;
    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/purchase/port-clearances/${id}`)
      .then((res) => {
        if (!mounted) return;
        const it = res.data?.item;
        if (!it) return;

        setFormData({
          clearance_no: it.clearance_no || "",
          clearance_date: it.clearance_date
            ? typeof it.clearance_date === "string"
              ? it.clearance_date.split("T")[0]
              : it.clearance_date
            : new Date().toISOString().split("T")[0],
          shipping_advice_id: it.advice_id ? String(it.advice_id) : "",
          status: it.status || "PENDING",

          port_of_entry: it.port_of_entry || "",
          arrival_date: it.arrival_date || "",
          clearing_agent: it.clearing_agent || "",
          target_clearance_date: it.target_clearance_date || "",
          customs_declaration_number:
            it.customs_entry_no || it.customs_declaration_number || "",
          declaration_date: it.declaration_date || "",
          hs_code: it.hs_code || "",
          assessment_date: it.assessment_date || "",

          total_clearance_cost:
            Number(it.total_clearance_cost) ||
            Number(it.duty_amount || 0) + Number(it.other_charges || 0) ||
            0,
        });

        // Load charges if present
        if (res.data.charges && Array.isArray(res.data.charges)) {
          setCharges(
            res.data.charges.map((c) => ({
              id: c.id, // maintain ID if editing existing charge (though backend does delete/insert)
              charge_type: c.charge_type,
              amount: c.amount,
              vendor_authority: c.vendor_authority || "",
            })),
          );
        } else {
          // Fallback: if no charges table data, try to construct from legacy fields if they exist
          // This is just a UI convenience; backend handles migration too.
          const initialCharges = [];
          if (Number(it.duty_amount) > 0)
            initialCharges.push({
              charge_type: "DUTY",
              amount: it.duty_amount,
              vendor_authority: "Customs",
            });
          if (Number(it.other_charges) > 0)
            initialCharges.push({
              charge_type: "OTHER",
              amount: it.other_charges,
              vendor_authority: "Other",
            });
          setCharges(initialCharges);
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load port clearance");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  // --- Calculations ---
  useEffect(() => {
    const total = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    setFormData((prev) => ({ ...prev, total_clearance_cost: total }));
  }, [charges]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // --- Charges Management ---
  const addCharge = () => {
    setCharges([
      ...charges,
      { charge_type: "DUTY", amount: 0, vendor_authority: "" },
    ]);
  };

  const removeCharge = (index) => {
    const next = [...charges];
    next.splice(index, 1);
    setCharges(next);
  };

  const updateCharge = (index, field, value) => {
    const next = [...charges];
    next[index] = { ...next[index], [field]: value };
    setCharges(next);
  };

  // --- Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        ...formData,
        shipping_advice_id: Number(formData.shipping_advice_id),
        charges: charges.map((c) => ({
          charge_type: c.charge_type,
          amount: Number(c.amount),
          vendor_authority: c.vendor_authority,
        })),
      };

      if (isNew) {
        await api.post("/purchase/port-clearances", payload);
      } else {
        await api.put(`/purchase/port-clearances/${id}`, payload);
      }
      navigate("/purchase/port-clearances");
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save port clearance");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isNew ? "New" : "Edit"} Port Clearance
          </h1>
          <p className="text-sm mt-1 text-slate-500">
            Manage customs declarations and port charges
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.history.back()} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Clearance Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Info Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Clearance Details</h3>
            </div>
            <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Clearance No</label>
                <input
                  type="text"
                  className="input"
                  value={formData.clearance_no}
                  disabled
                />
              </div>
              <div>
                <label className="label">Clearance Date</label>
                <input
                  type="date"
                  className="input"
                  name="clearance_date"
                  value={formData.clearance_date}
                  onChange={handleFormChange}
                  required
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Shipping Advice</label>
                <select
                  className="input"
                  name="shipping_advice_id"
                  value={formData.shipping_advice_id}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Select Shipping Advice...</option>
                  {shippingAdvice.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.advice_no} - {sa.po_no} ({sa.supplier_name})
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
                  onChange={handleFormChange}
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="CLEARED">Cleared</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="label">Target Clearance Date</label>
                <input
                  type="date"
                  className="input"
                  name="target_clearance_date"
                  value={formData.target_clearance_date}
                  onChange={handleFormChange}
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
            </div>
          </div>

          {/* Import/Customs Details Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Customs & Import Data</h3>
            </div>
            <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Port of Entry</label>
                <input
                  type="text"
                  className="input"
                  name="port_of_entry"
                  value={formData.port_of_entry}
                  onChange={handleFormChange}
                  placeholder="e.g. Tema Port"
                />
              </div>
              <div>
                <label className="label">Arrival Date</label>
                <input
                  type="date"
                  className="input"
                  name="arrival_date"
                  value={formData.arrival_date}
                  onChange={handleFormChange}
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div>
                <label className="label">Clearing Agent</label>
                <input
                  type="text"
                  className="input"
                  name="clearing_agent"
                  value={formData.clearing_agent}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="label">HS Code</label>
                <input
                  type="text"
                  className="input"
                  name="hs_code"
                  value={formData.hs_code}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="label">Customs Decl. No</label>
                <input
                  type="text"
                  className="input"
                  name="customs_declaration_number"
                  value={formData.customs_declaration_number}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="label">Declaration Date</label>
                <input
                  type="date"
                  className="input"
                  name="declaration_date"
                  value={formData.declaration_date}
                  onChange={handleFormChange}
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
            </div>
          </div>

          {/* Charges Section */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h3 className="card-title">Charges & Duties</h3>
              <button
                type="button"
                onClick={addCharge}
                className="btn-sm btn-secondary"
              >
                + Add Charge
              </button>
            </div>
            <div className="card-body space-y-4">
              {charges.length === 0 && (
                <p className="text-sm text-slate-500 italic">
                  No charges added yet.
                </p>
              )}
              {charges.map((charge, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 items-end border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <label className="label text-xs">Type</label>
                    <select
                      className="input text-sm py-1"
                      value={charge.charge_type}
                      onChange={(e) =>
                        updateCharge(idx, "charge_type", e.target.value)
                      }
                    >
                      <option value="DUTY">Import Duty</option>
                      <option value="VAT">VAT</option>
                      <option value="LEVY">Import Levy</option>
                      <option value="HANDLING">Port Handling</option>
                      <option value="STORAGE">Storage Fees</option>
                      <option value="OTHER">Other Charges</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="label text-xs">Amount</label>
                    <input
                      type="number"
                      step="1"
                      className="input text-sm py-1"
                      value={charge.amount}
                      onChange={(e) =>
                        updateCharge(idx, "amount", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex-[2]">
                    <label className="label text-xs">Vendor / Authority</label>
                    <input
                      type="text"
                      className="input text-sm py-1"
                      value={charge.vendor_authority}
                      onChange={(e) =>
                        updateCharge(idx, "vendor_authority", e.target.value)
                      }
                      placeholder="e.g. GRA"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCharge(idx)}
                    className="text-red-500 hover:text-red-700 pb-2"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <div className="text-right">
                  <span className="text-sm font-medium text-slate-500 mr-4">
                    Total Cost:
                  </span>
                  <span className="text-xl font-bold text-slate-900">
                    {formData.total_clearance_cost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Documents & Actions */}
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Documents</h3>
            </div>
            <div className="card-body">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="text-slate-400 mb-2">
                  <svg
                    className="w-8 h-8 mx-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <p className="text-sm text-slate-600 font-medium">
                  Click to upload documents
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  PDF, JPG, PNG up to 10MB
                </p>
              </div>

              <div className="mt-4 space-y-2">
                {/* Placeholder for uploaded docs list */}
                <p className="text-xs text-slate-400 italic text-center">
                  No documents attached
                </p>
              </div>
            </div>
          </div>

          <div className="card bg-blue-50 border-blue-100">
            <div className="card-body">
              <h4 className="font-semibold text-blue-800 mb-2">
                Help & Instructions
              </h4>
              <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                <li>
                  Ensure all duties are calculated based on the latest HS Code
                  rates.
                </li>
                <li>Attach scanned copies of the Customs Declaration.</li>
                <li>
                  Update status to 'Cleared' only when goods have left the port.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
