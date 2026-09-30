/**
 * @fileoverview ProspectConversion component.
 * Provides functionality for ProspectConversion.
 */

import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../api/client";
import { useDispatch } from "react-redux";
import { setRefresh } from "../../../../store/ui/refreshSlice.js";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function ProspectConversion() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prospects, setProspects] = useState([]);
  const [selectedProspectId, setSelectedProspectId] = useState("");
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
    customer_type: "Individual",
    contact_person: "",
    mobile: "",
    enforce_credit_limit: false,
    credit_limit: "0.00",
    payment_terms: "Net 30",
  });

  useEffect(() => {
    fetchProspects();
    fetchPriceTypes();
    fetchCurrencies();
    fetchZones();
    fetchNextCode();
  }, []);

  async function fetchNextCode() {
    try {
      const response = await api.get("/sales/customers/next-code");
      if (response.data?.code) {
        update("customer_code", response.data.code);
      }
    } catch (err) {
      console.error("Error fetching next customer code", err);
    }
  }

  async function fetchProspects() {
    try {
      const response = await api.get("/sales/prospect-customers", {
        params: { active: "true" },
      });
      setProspects(
        Array.isArray(response.data?.items) ? response.data.items : [],
      );
    } catch (err) {
      console.error("Error fetching prospects", err);
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
      if (base) {
        update("currency_id", String(base.id));
      }
    } catch (err) {
      console.error("Error fetching currencies", err);
    }
  }

  const handleProspectChange = (e) => {
    const id = e.target.value;
    setSelectedProspectId(id);
    if (!id) {
      setForm((prev) => ({
        ...prev,
        customer_name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        country: "",
        contact_person: "",
        mobile: "",
        customer_type: "Individual",
      }));
      return;
    }

    const p = prospects.find((x) => String(x.id) === String(id));
    if (p) {
      setForm((prev) => ({
        ...prev,
        customer_name: p.customer_name || p.prospect_customer || "",
        email: p.email || "",
        phone: p.phone || p.telephone || "",
        address: p.address || "",
        city: p.city || "",
        state: p.state || "",
        country: p.country || "",
        contact_person: p.contact_person || "",
        mobile: p.mobile || "",
        customer_type: p.customer_type || "Individual",
        price_type_id: p.price_type_id || prev.price_type_id,
        currency_id: p.currency_id || prev.currency_id,
        credit_limit: p.credit_limit || "0.00",
        payment_terms: p.payment_terms || "Net 30",
        zone: p.zone || "",
      }));
    }
  };

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.customer_name) {
      setError("Please select a prospect or enter a customer name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/sales/customers", form);
      const createdId = res?.data?.id || res?.data?.item?.id || null;

      dispatch(setRefresh({ key: "customers", id: createdId || null }));
      navigate("/sales/customers", {
        replace: true,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message || "Error converting prospect to customer",
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
              Prospect Conversion
            </h1>
            <p className="text-sm opacity-90">
              Convert a prospective customer into a full customer account
            </p>
          </div>
          <button onClick={() => window.history.back()} className="btn-success">
            Back to Customers
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="max-w-md">
            <label className="label font-bold text-brand">
              Select Prospect to Convert
            </label>
            <select
              className="input border-2 border-brand/20 focus:border-brand"
              value={selectedProspectId}
              onChange={handleProspectChange}
            >
              <option value="">-- Choose a Prospect --</option>
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.customer_name || p.prospect_customer}{" "}
                  {p.customer_code ? `(${p.customer_code})` : ""}
                </option>
              ))}
            </select>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <label className="label cursor-pointer flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary"
                        checked={Boolean(form.enforce_credit_limit)}
                        onChange={(e) => update("enforce_credit_limit", e.target.checked)}
                      />
                      <span className="font-semibold text-slate-700">Enforce Credit Limit</span>
                    </label>
                  </div>
                  {form.enforce_credit_limit ? (
                    <div>
                      <label className="label">Credit Limit Amount</label>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Enter credit limit amount"
                        value={form.credit_limit || ""}
                        onChange={(e) => update("credit_limit", e.target.value)}
                      />
                    </div>
                  ) : null}
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
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => window.history.back()} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button className="btn-success" disabled={loading}>
                    {loading ? "Converting..." : "Complete Conversion"}
                  </button>
                </div>
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
                      <p>Select a prospect to preview details</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                          Customer Code
                        </span>
                        <div className="font-mono text-brand-600 font-medium">
                          {form.customer_code || "(Auto-generated)"}
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                          Customer Name
                        </span>
                        <div className="text-lg font-bold">
                          {form.customer_name}
                        </div>
                        {form.customer_type && (
                          <span className="inline-block bg-slate-200 dark:bg-slate-700 text-xs px-2 py-0.5 rounded mt-1">
                            {form.customer_type}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Contact
                          </span>
                          <div className="text-sm">
                            {form.contact_person || "-"}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Phone
                          </span>
                          <div className="text-sm">{form.phone || "-"}</div>
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                          Email
                        </span>
                        <div className="text-sm break-all text-brand-500">
                          {form.email || "-"}
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                          Credit Limit
                        </span>
                        <div className="font-medium text-green-600">
                          {form.credit_limit
                            ? `${Number(form.credit_limit).toLocaleString()}`
                            : "0.00"}
                        </div>
                      </div>

                      {form.address && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Address
                          </span>
                          <div className="text-sm whitespace-pre-wrap">
                            {form.address}
                          </div>
                        </div>
                      )}

                      {(form.city ||
                        form.state ||
                        form.country ||
                        form.zone) && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Location
                          </span>
                          <div className="text-sm">
                            {[form.city, form.state, form.country]
                              .filter(Boolean)
                              .join(", ")}
                            {form.zone && (
                              <div className="text-xs text-slate-500 mt-1">
                                Zone: {form.zone}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {form.price_type_id && (
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                            Price Type
                          </span>
                          <div className="text-sm">
                            {priceTypes.find(
                              (pt) =>
                                String(pt.id) === String(form.price_type_id),
                            )?.name || form.price_type_id}
                          </div>
                        </div>
                      )}
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
