/**
 * @fileoverview ServiceConfirmationForm component.
 * Provides functionality for ServiceConfirmationForm.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "api/client";
import { usePermission } from "@/auth/PermissionContext.jsx";

function toISODate(v) {
  if (!v) return "";
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ServiceConfirmationForm() {
  const { hasExceptional } = usePermission();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [suppliers, setSuppliers] = useState([]);

  const [formData, setFormData] = useState({
    sc_no: "",
    sc_date: toISODate(new Date()),
    supplier_id: "",
    status: "DRAFT",
    remarks: "",
    details: [],
  });

  useEffect(() => {
    let mounted = true;
    api
      .get("/purchase/suppliers")
      .then((res) => {
        if (!mounted) return;
        setSuppliers(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load suppliers");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/inventory/service-confirmations/${id}`)
      .then((res) => {
        if (!mounted) return;
        const c = res.data?.item;
        const details = Array.isArray(res.data?.details)
          ? res.data.details
          : [];
        if (!c) return;

        setFormData({
          sc_no: c.sc_no || "",
          sc_date: toISODate(c.sc_date),
          supplier_id: c.supplier_id ? String(c.supplier_id) : "",
          status: c.status || "DRAFT",
          remarks: c.remarks || "",
          details: details.map((d) => ({
            description: d.description || "",
            qty: d.qty ?? "",
            unit_price: d.unit_price ?? "",
          })),
        });
      })
      .catch((e) => {
        if (!mounted) return;
        setError(
          e?.response?.data?.message || "Failed to load service confirmation"
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  const computedTotal = useMemo(() => {
    const lines = formData.details || [];
    let total = 0;
    for (const d of lines) {
      const qty = Number(d.qty);
      const unitPrice = Number(d.unit_price);
      if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) continue;
      total += qty * unitPrice;
    }
    return total;
  }, [formData.details]);

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      details: [...prev.details, { description: "", qty: "", unit_price: "" }],
    }));
  };

  const removeLine = (idx) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== idx),
    }));
  };

  const updateLine = (idx, patch) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        sc_no: formData.sc_no || null,
        sc_date: formData.sc_date,
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
        status: formData.status || "DRAFT",
        remarks: formData.remarks || null,
        details: (formData.details || []).map((d) => ({
          description: String(d.description || "").trim(),
          qty: d.qty === "" ? null : Number(d.qty),
          unit_price: d.unit_price === "" ? null : Number(d.unit_price),
        })),
      };

      if (!payload.sc_date || !payload.supplier_id) {
        throw new Error("Date and supplier are required");
      }

      if (isNew) {
        await api.post("/inventory/service-confirmations", payload);
      } else {
        await api.put(`/inventory/service-confirmations/${id}`, payload);
      }

      navigate("/purchase/service-confirmation");
    } catch (e2) {
      setError(
        e2?.response?.data?.message ||
          e2?.message ||
          "Failed to save service confirmation"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg">
          <div className="flex justify-between items-center text-white"><div>
              <h1 className="text-2xl font-bold dark:text-brand-300">
                {isNew
                  ? "New Service Confirmation"
                  : "Edit Service Confirmation"}
              </h1>
              <p className="text-sm mt-1">
                Confirm service receipts
              </p>
            </div>
            <button onClick={() => window.history.back()} className="btn-success"
            >
              Back to List
            </button>
          </div>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            {loading ? (
              <div className="text-sm">
                Loading...
              </div>
            ) : null}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">No</label>
                <input
                  type="text"
                  className="input"
                  value={formData.sc_no}
                  onChange={(e) =>
                    setFormData({ ...formData, sc_no: e.target.value })
                  }
                  placeholder="Auto-generated if blank"
                />
              </div>
              <div>
                <label className="label">Date *</label>
                <input
                  type="date"
                  className="input"
                  value={formData.sc_date}
                  onChange={(e) =>
                    setFormData({ ...formData, sc_date: e.target.value })
                  }
                  required
                
                  disabled={!isNew && !hasExceptional("DOCUMENT.EDIT_DATE")}
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Supplier *</label>
                <select
                  className="input"
                  value={formData.supplier_id}
                  onChange={(e) =>
                    setFormData({ ...formData, supplier_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {(s.supplier_code ? `${s.supplier_code} - ` : "") +
                        s.supplier_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Total Amount</label>
                <input
                  type="text"
                  className="input"
                  value={computedTotal.toFixed(2)}
                  readOnly
                />
              </div>
            </div>

            <div>
              <label className="label">Remarks</label>
              <textarea
                className="input"
                rows="3"
                value={formData.remarks}
                onChange={(e) =>
                  setFormData({ ...formData, remarks: e.target.value })
                }
              />
            </div>

            <div className="card">
              <div className="card-header bg-brand text-white rounded-t-lg">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Lines
                  </h2>
                  <button
                    type="button"
                    className="btn-success"
                    onClick={addLine}
                  >
                    + Add Line
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Line Total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {!formData.details.length ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="text-center py-6 text-slate-500 dark:text-slate-400"
                          >
                            No lines. Click "Add Line" to begin.
                          </td>
                        </tr>
                      ) : null}

                      {formData.details.map((d, idx) => {
                        const qty = Number(d.qty);
                        const unitPrice = Number(d.unit_price);
                        const lineTotal =
                          Number.isFinite(qty) && Number.isFinite(unitPrice)
                            ? qty * unitPrice
                            : 0;

                        return (
                          <tr key={idx}>
                            <td>
                              <input
                                type="text"
                                className="input"
                                value={d.description}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    description: e.target.value,
                                  })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.001"
                                className="input"
                                value={d.qty}
                                onChange={(e) =>
                                  updateLine(idx, { qty: e.target.value })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={d.unit_price}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    unit_price: e.target.value,
                                  })
                                }
                              />
                            </td>
                            <td>{lineTotal.toFixed(2)}</td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="btn-success"
                                onClick={() => removeLine(idx)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => window.history.back()} className="btn-success"
              >
                Cancel
              </button>
              <button type="submit" className="btn-success" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}







