/**
 * @fileoverview CustomerForm component for Point of Sale (POS) module.
 * Provides create, edit, and view functionality for customers within POS.
 */

import React, { useState, useEffect } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api } from "../../../../api/client";
import { useGhanaCities } from "../../../../hooks/useGhanaCities";
import { useDispatch } from "react-redux";
import { setRefresh } from "../../../../store/ui/refreshSlice.js";
import PhoneInput from "../../../../components/PhoneInput.jsx";
import { useAuth } from "../../../../auth/AuthContext.jsx";

/**
 * CustomerForm component for POS
 *
 * @returns {JSX.Element} The rendered component
 */
export default function CustomerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const isViewOnly = Boolean(isEdit) && searchParams.get("mode") === "view";
  const dispatch = useDispatch();
  const { scope } = useAuth();
  const { cities: ghanaCities } = useGhanaCities();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [priceTypes, setPriceTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [countries, setCountries] = useState([]);
  const [salesAccounts, setSalesAccounts] = useState([]);
  const [zoneOptions, setZoneOptions] = useState([]);

  const GHANA_REGIONS = [
    "Greater Accra",
    "Ashanti",
    "Central",
    "Eastern",
    "Western",
    "Western North",
    "Volta",
    "Oti",
    "Northern",
    "Savannah",
    "North East",
    "Upper East",
    "Upper West",
    "Bono",
    "Bono East",
    "Ahafo",
  ];
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
    sales_account_id: "",
    enforce_credit_limit: false,
    credit_limit: "",
  });

  useEffect(() => {
    fetchPriceTypes();
    fetchCurrencies();
    fetchCountries();
    fetchSalesAccounts();
    fetchZones();
    if (isEdit) {
      fetchCustomer();
    } else {
      fetchNextCode();
    }
  }, [id]);

  async function fetchCountries() {
    try {
      const resp = await fetch(
        "https://restcountries.com/v3.1/all?fields=name",
      );
      const data = await resp.json();
      if (Array.isArray(data)) {
        const list = data.map((c) => c.name.common).sort();
        setCountries(list);
      }
    } catch (err) {
      console.error("Failed to fetch countries", err);
    }
  }

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

  async function fetchZones() {
    try {
      const res = await api.get("/sales/zones");
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setZoneOptions(items.filter((z) => z.is_active).map((z) => z.zone_name));
    } catch (err) {
      console.error("Error fetching zones", err);
    }
  }

  async function fetchSalesAccounts() {
    try {
      const response = await api.get("/finance/accounts", {
        params: { nature: "INCOME" },
      });
      const arr = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      setSalesAccounts(arr);
    } catch (err) {
      console.error("Error fetching sales accounts", err);
    }
  }

  async function fetchCustomer() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/sales/customers/${id}`);
      if (response.data?.item) {
        const itm = response.data.item;
        setForm({
          ...itm,
          sales_account_id: itm.sales_account_id ? String(itm.sales_account_id) : "",
          enforce_credit_limit: Boolean(Number(itm.enforce_credit_limit) === 1 || itm.enforce_credit_limit === true || String(itm.enforce_credit_limit) === "true"),
        });
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching customer");
    } finally {
      setLoading(false);
    }
  }

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  useEffect(() => {
    if (form.sales_account_id || !salesAccounts.length) return;

    const preferred =
      salesAccounts.find(
        (a) => String(a.name || "").toLowerCase() === "sales account",
      ) ||
      salesAccounts.find((a) => /sales/i.test(String(a.name || ""))) ||
      salesAccounts.find((a) => /revenue|income/i.test(String(a.name || ""))) ||
      salesAccounts[0];

    if (preferred?.id) {
      setForm((p) => ({
        ...p,
        sales_account_id: p.sales_account_id || String(preferred.id),
      }));
    }
  }, [salesAccounts, form.sales_account_id]);

  async function submit(e) {
    e.preventDefault();
    if (loading || isViewOnly) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        branch_id: form.branch_id || (scope?.branchId && scope?.branchId !== "all" ? Number(scope.branchId) : undefined),
        customer_code: form.customer_code || null,
        customer_name: form.customer_name || "",
        email: form.email || null,
        phone: form.phone || null,
        mobile: form.mobile || null,
        contact_person: form.contact_person || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zone: form.zone || null,
        country: form.country || null,
        customer_type: form.customer_type || "Individual",
        price_type_id: form.price_type_id || null,
        currency_id: form.currency_id || null,
        enforce_credit_limit: Boolean(form.enforce_credit_limit),
        credit_limit: form.enforce_credit_limit ? (Number(form.credit_limit || 0) || 0) : 0,
        payment_terms: form.payment_terms || "Net 30",
        is_active: Boolean(form.is_active),
        sales_account_id: form.sales_account_id || null,
        service_customer: form.service_customer === 'Y' || form.service_customer === true ? 'Y' : 'N',
      };
      let createdId = null;
      if (isEdit) {
        const res = await api.put(`/sales/customers/${id}`, payload);
        createdId = res?.data?.id || res?.data?.item?.id || id;
      } else {
        const res = await api.post("/sales/customers", payload);
        createdId = res?.data?.id || res?.data?.item?.id || null;
      }
      dispatch(setRefresh({ key: "customers", id: createdId || null }));

      const successMessage = isEdit
        ? "Customer updated successfully!"
        : "Customer created successfully!";

      navigate("/pos/customers", {
        state: {
          afterSave: {
            entity: "customers",
            id: createdId || null,
            ts: Date.now(),
            message: successMessage,
          },
        },
        replace: true,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || "Error saving customer");
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
                  ? "View Customer"
                  : "Edit Customer"
                : "New Customer"}
            </h1>
          </div>
          <div className="flex gap-2">
            <Link to="/pos" className="btn btn-secondary">
              Return to POS
            </Link>
            <button onClick={() => navigate("/pos/customers")} className="btn-success">
              Back to Customers
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
                  className="min-w-0 border-0 p-0 m-0 space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Customer Name *</label>
                      <input
                        className="input"
                        placeholder="e.g. Acme Corp / John Doe"
                        value={form.customer_name}
                        onChange={(e) => update("customer_name", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Customer Code</label>
                      <input
                        className="input"
                        placeholder="Auto-generated if empty"
                        value={form.customer_code}
                        onChange={(e) => update("customer_code", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Customer Type</label>
                      <select
                        className="select"
                        value={form.customer_type || "Individual"}
                        onChange={(e) => update("customer_type", e.target.value)}
                      >
                        <option value="Individual">Individual</option>
                        <option value="Corporate">Corporate</option>
                        <option value="Wholesale">Wholesale</option>
                        <option value="Retail">Retail</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Price Type</label>
                      <select
                        className="select"
                        value={form.price_type_id}
                        onChange={(e) => update("price_type_id", e.target.value)}
                      >
                        <option value="">Default (Standard Selling Price)</option>
                        {priceTypes.map((pt) => (
                          <option key={pt.id} value={pt.id}>
                            {pt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Contact Person</label>
                      <input
                        className="input"
                        placeholder="e.g. Jane Doe"
                        value={form.contact_person || ""}
                        onChange={(e) => update("contact_person", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Phone / Mobile</label>
                      <PhoneInput
                        value={form.phone || form.mobile || ""}
                        onChange={(val) => {
                          update("phone", val);
                          update("mobile", val);
                        }}
                        placeholder="Enter phone number"
                        disabled={loading || isViewOnly}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Email Address</label>
                      <input
                        type="email"
                        className="input"
                        placeholder="e.g. billing@acme.com"
                        value={form.email || ""}
                        onChange={(e) => update("email", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Currency</label>
                      <select
                        className="select"
                        value={form.currency_id}
                        onChange={(e) => update("currency_id", e.target.value)}
                      >
                        <option value="">Select Currency</option>
                        {currencies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} - {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Country</label>
                      <select
                        className="select"
                        value={form.country || "Ghana"}
                        onChange={(e) => update("country", e.target.value)}
                      >
                        <option value="Ghana">Ghana</option>
                        {countries
                          .filter((c) => c !== "Ghana")
                          .map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">State / Region</label>
                      {form.country === "Ghana" || !form.country ? (
                        <select
                          className="select"
                          value={form.state || ""}
                          onChange={(e) => update("state", e.target.value)}
                        >
                          <option value="">Select Region</option>
                          {GHANA_REGIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="input"
                          placeholder="Region / State"
                          value={form.state || ""}
                          onChange={(e) => update("state", e.target.value)}
                        />
                      )}
                    </div>
                    <div>
                      <label className="label">City / Town</label>
                      <input
                        className="input"
                        placeholder="City"
                        list="ghana-cities-list"
                        value={form.city || ""}
                        onChange={(e) => update("city", e.target.value)}
                      />
                      <datalist id="ghana-cities-list">
                        {(ghanaCities || []).map((city) => (
                          <option key={city} value={city} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Delivery Zone</label>
                      <select
                        className="select"
                        value={form.zone || ""}
                        onChange={(e) => update("zone", e.target.value)}
                      >
                        <option value="">No Zone</option>
                        {zoneOptions.map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Postal / Physical Address</label>
                      <input
                        className="input"
                        placeholder="Street, P.O. Box, Digital Address (e.g. GA-183-9321)"
                        value={form.address || ""}
                        onChange={(e) => update("address", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Revenue / Sales Account</label>
                      <select
                        className="select"
                        value={form.sales_account_id || ""}
                        onChange={(e) => update("sales_account_id", e.target.value)}
                      >
                        <option value="">Select Revenue Account</option>
                        {salesAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code ? `${a.code} - ` : ""}
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Payment Terms</label>
                      <select
                        className="select"
                        value={form.payment_terms || "Net 30"}
                        onChange={(e) => update("payment_terms", e.target.value)}
                      >
                        <option value="Immediate">Immediate / Cash</option>
                        <option value="Net 7">Net 7 Days</option>
                        <option value="Net 15">Net 15 Days</option>
                        <option value="Net 30">Net 30 Days</option>
                        <option value="Net 60">Net 60 Days</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={Boolean(form.enforce_credit_limit)}
                          onChange={(e) =>
                            update("enforce_credit_limit", e.target.checked)
                          }
                        />
                        <span className="text-sm font-medium">
                          Enforce Credit Limit
                        </span>
                      </label>
                      {form.enforce_credit_limit && (
                        <div className="mt-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input"
                            placeholder="Credit Limit Amount"
                            value={form.credit_limit || ""}
                            onChange={(e) => update("credit_limit", e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={Boolean(form.is_active)}
                          onChange={(e) => update("is_active", e.target.checked)}
                        />
                        <span className="text-sm font-medium">Active Customer</span>
                      </label>
                    </div>
                  </div>
                </fieldset>

                {!isViewOnly && (
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => navigate("/pos/customers")}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-success" disabled={loading}>
                      {loading ? "Saving..." : "Save Customer"}
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
