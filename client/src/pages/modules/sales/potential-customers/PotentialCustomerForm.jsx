/**
 * @fileoverview PotentialCustomerForm component.
 * Provides functionality for PotentialCustomerForm.
 */

import React, { useState, useEffect } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api } from "../../../../api/client";
import { useDispatch } from "react-redux";
import { setRefresh } from "../../../../store/ui/refreshSlice.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function PotentialCustomerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const isViewOnly =
    Boolean(isEdit) && searchParams.get("mode") === "view";
  const returnUrl = searchParams.get("returnUrl");
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [priceTypes, setPriceTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [zoneOptions, setZoneOptions] = useState([]);
  const [form, setForm] = useState({
    customer_code: "",
    customer_name: "",
    email: "",
    phone: "",
    is_active: true,
    address: "",
    city: "",
    state: "",
    zone: "",
    country: "",
    price_type_id: "",
    currency_id: "",
  });

  useEffect(() => {
    fetchPriceTypes();
    fetchCurrencies();
    fetchZones();
    if (isEdit) {
      fetchCustomer();
    } else {
      fetchNextCode();
    }
  }, [id]);

  async function fetchNextCode() {
    try {
      const response = await api.get("/sales/prospect-customers/next-code");
      if (response.data?.code) {
        update("customer_code", response.data.code);
      }
    } catch (err) {
      console.error("Error fetching next customer code", err);
    }
  }

  async function fetchPriceTypes() {
    try {
      const response = await api.get("/sales/price-types");
      setPriceTypes(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (err) {
      console.error("Error fetching price types", err);
    }
  }

  async function fetchZones() {
    try {
      const res = await api.get("/sales/zones");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setZoneOptions(items.filter((z) => z.is_active).map((z) => z.zone_name));
    } catch (err) {
      console.error("Error fetching zones", err);
    }
  }

  async function fetchCurrencies() {
    try {
      const response = await api.get("/finance/currencies");
      const arr = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      setCurrencies(arr);
      const base = arr.find((c) => Number(c.is_base) === 1);
      if (!isEdit && base) {
        update("currency_id", String(base.id));
      }
    } catch (err) {
      console.error("Error fetching currencies", err);
    }
  }

  async function fetchCustomer() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/sales/prospect-customers/${id}`);
      if (response.data?.item) {
        setForm(response.data.item);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || "Error fetching prospective customer",
      );
    } finally {
      setLoading(false);
    }
  }

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (isViewOnly) return;
    setLoading(true);
    setError("");
    try {
      let createdId = null;
      if (isEdit) {
        const res = await api.put(`/sales/prospect-customers/${id}`, form);
        createdId = res?.data?.id || res?.data?.item?.id || id;
      } else {
        const res = await api.post("/sales/prospect-customers", form);
        createdId = res?.data?.id || res?.data?.item?.id || null;
      }
      dispatch(
        setRefresh({ key: "prospect_customers", id: createdId || null }),
      );
      if (returnUrl) {
        navigate(returnUrl, { replace: true });
      } else {
        navigate("/sales/prospect-customers", {
          state: {
            afterSave: {
              entity: "prospect_customers",
              id: createdId || null,
              ts: Date.now(),
            },
          },
          replace: true,
        });
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || "Error saving prospective customer",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header bg-brand text-white rounded-t-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold dark:text-brand-300">
              {isEdit
                ? isViewOnly
                  ? "View Prospective Customer"
                  : "Edit Prospective Customer"
                : "New Prospective Customer"}
            </h1>
          </div>
          <div className="flex gap-2">
            {returnUrl ? (
              <button
                type="button"
                onClick={() => navigate(returnUrl)}
                className="btn btn-secondary"
              >
                Back to Origin
              </button>
            ) : (
              <button onClick={() => window.history.back()} className="btn btn-secondary">
                Back to Quotation
              </button>
            )}
            <button onClick={() => window.history.back()} className="btn-success">
              Back
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Section */}
              <div className="lg:col-span-2 space-y-4">
                <fieldset
                  disabled={loading || isViewOnly}
                  className="min-w-0 border-0 p-0 m-0 grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div>
                    <label className="label">Customer Code</label>
                    <input
                      className="input"
                      value={form.customer_code || ""}
                      onChange={(e) => update("customer_code", e.target.value)}
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                  <div>
                    <label className="label">Customer Name *</label>
                    <input
                      className="input"
                      value={form.customer_name || ""}
                      onChange={(e) => update("customer_name", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Customer Type</label>
                    <select
                      className="input"
                      value={form.customer_type || "Individual"}
                      onChange={(e) => update("customer_type", e.target.value)}
                    >
                      <option value="Individual">Individual</option>
                      <option value="Business">Business</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Contact Person</label>
                    <input
                      className="input"
                      value={form.contact_person || ""}
                      onChange={(e) => update("contact_person", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input
                      className="input"
                      type="email"
                      value={form.email || ""}
                      onChange={(e) => update("email", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input
                      className="input"
                      value={form.phone || ""}
                      onChange={(e) => update("phone", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Mobile</label>
                    <input
                      className="input"
                      value={form.mobile || ""}
                      onChange={(e) => update("mobile", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Credit Limit</label>
                    <input
                      className="input"
                      type="number"
                      value={form.credit_limit || ""}
                      onChange={(e) => update("credit_limit", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Payment Terms</label>
                    <select
                      className="input"
                      value={form.payment_terms || "Net 30"}
                      onChange={(e) => update("payment_terms", e.target.value)}
                    >
                      <option value="Immediate">Immediate</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 45">Net 45</option>
                      <option value="Net 60">Net 60</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select
                      className="input"
                      value={form.is_active ? "1" : "0"}
                      onChange={(e) =>
                        update("is_active", e.target.value === "1")
                      }
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Address</label>
                    <textarea
                      className="input"
                      rows="3"
                      value={form.address || ""}
                      onChange={(e) => update("address", e.target.value)}
                    ></textarea>
                  </div>
                  <div>
                    <label className="label">City</label>
                    <input
                      className="input"
                      value={form.city || ""}
                      onChange={(e) => update("city", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input
                      className="input"
                      value={form.state || ""}
                      onChange={(e) => update("state", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Zone</label>
                    <select
                      className="input"
                      value={form.zone || ""}
                      onChange={(e) => update("zone", e.target.value)}
                    >
                      <option value="">Select zone</option>
                      {zoneOptions.map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Country</label>
                    <input
                      className="input"
                      value={form.country || ""}
                      onChange={(e) => update("country", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Price Type</label>
                    <select
                      className="input"
                      value={form.price_type_id || ""}
                      onChange={(e) => update("price_type_id", e.target.value)}
                    >
                      <option value="">-- Select Price Type --</option>
                      {priceTypes.map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Currency</label>
                    <select
                      className="input"
                      value={form.currency_id || ""}
                      onChange={(e) => update("currency_id", e.target.value)}
                    >
                      <option value="">-- Select Currency --</option>
                      {currencies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {(c.code || c.currency_code) +
                            " - " +
                            (c.name || c.currency_name || "")}
                        </option>
                      ))}
                    </select>
                  </div>
                </fieldset>
                {!isViewOnly && (
                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => window.history.back()} className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button className="btn-success" disabled={loading}>
                    {loading ? "Saving..." : "Save Potential Customer"}
                  </button>
                </div>
                )}
              </div>

              {/* Preview Section */}
              <div className="lg:col-span-1">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700 sticky top-4">
                  <h3 className="text-lg font-bold mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                    Customer Preview
                  </h3>

                  {!form.customer_code && !form.customer_name ? (
                    <div className="text-center py-10 text-slate-400">
                      <div className="text-5xl mb-3">👤</div>
                      <p>Fill in the form to preview customer details</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                          Code
                        </span>
                        <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                          {form.customer_code || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                          Name
                        </span>
                        <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {form.customer_name || "N/A"}
                        </span>
                      </div>
                      {form.contact_person && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Contact
                          </span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {form.contact_person}
                          </span>
                        </div>
                      )}
                      {form.email && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Email
                          </span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {form.email}
                          </span>
                        </div>
                      )}
                      {form.phone && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Phone
                          </span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {form.phone}
                          </span>
                        </div>
                      )}
                      {form.city && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            City
                          </span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {form.city}
                          </span>
                        </div>
                      )}
                      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded-full text-xs font-semibold">
                          {form.is_active ? "Active" : "Inactive"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
