/**
 * @fileoverview SupplierForm component.
 * Provides functionality for SupplierForm.
 */

import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "api/client";
import { useGhanaCities } from "../../../../hooks/useGhanaCities";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { setRefresh } from "../../../../store/ui/refreshSlice.js";
import PhoneInput from "../../../../components/PhoneInput.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function SupplierForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const fileInputRef = useRef(null);
  const dispatch = useDispatch();
  const { cities: ghanaCities } = useGhanaCities();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currencies, setCurrencies] = useState([]);
  const [countries, setCountries] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);

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

  const [formData, setFormData] = useState({
    supplier_code: "",
    supplier_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    payment_terms: "",
    is_active: true,
    // Extra fields for UI (not all persisted yet)
    supplier_type: "LOCAL",
    service_contractor: false,
    tax_id: "",
    business_reg_no: "",
    industry: "",
    website: "",
    city: "",
    state: "",
    country: "Ghana",
    currency_id: "",
    expense_account_id: "",
    credit_limit: "",
  });

  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    setLoading(true);
    setError("");

    api
      .get(`/purchase/suppliers/${id}`)
      .then((res) => {
        if (!mounted) return;
        const s = res.data?.item;
        if (!s) return;
        setFormData((prev) => ({
          ...prev,
          supplier_code: s.supplier_code || "",
          supplier_name: s.supplier_name || "",
          contact_person: s.contact_person || "",
          email: s.email || "",
          phone: s.phone || "",
          address: s.address || "",
          city: s.city || "",
          state: s.state || "",
          country: s.country || "Ghana",
          payment_terms: s.payment_terms || "",
          is_active: Boolean(s.is_active),
          supplier_type: s.supplier_type || prev.supplier_type || "LOCAL",
          currency_id: s.currency_id || "",
          expense_account_id: s.expense_account_id || "",
          service_contractor:
            String(s.service_contractor || "").toUpperCase() === "Y",
        }));
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.response?.data?.message || "Failed to load supplier");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, isNew]);

  useEffect(() => {
    if (!isNew) return;

    const fetchNextCode = async () => {
      try {
        const res = await api.get("/purchase/suppliers/next-code");
        if (res.data?.code) {
          setFormData((prev) => ({ ...prev, supplier_code: res.data.code }));
          return;
        }
      } catch (err) {
        console.error("Failed to fetch next supplier code", err);
      }
      try {
        const resSup = await api.get("/purchase/suppliers");
        const supItems = Array.isArray(resSup.data?.items)
          ? resSup.data.items
          : [];
        const resAcc = await api.get("/finance/accounts", {
          params: { search: "SU-" },
        });
        const accItems = Array.isArray(resAcc.data?.items)
          ? resAcc.data.items
          : [];
        let max = 0;
        for (const s of supItems) {
          const m = String(s.supplier_code || "").match(/^SU-(\d{6})$/);
          if (m) {
            const n = Number(m[1]);
            if (Number.isFinite(n) && n > max) max = n;
          }
        }
        for (const a of accItems) {
          const m = String(a.code || "").match(/^SU-(\d{6})$/);
          if (m) {
            const n = Number(m[1]);
            if (Number.isFinite(n) && n > max) max = n;
          }
        }
        const code = `SU-${String(max + 1).padStart(6, "0")}`;
        setFormData((prev) => ({ ...prev, supplier_code: code }));
      } catch {}
    };

    fetchNextCode();
  }, [isNew]);

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const response = await api.get("/finance/currencies");
        const arr = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        setCurrencies(arr);
        const defaultCurrency =
          arr.find((c) => Number(c.is_base) === 1) ||
          arr.find(
            (c) =>
              String(c.code || c.currency_code || "").toUpperCase() === "GHS",
          ) ||
          arr.find((c) =>
            /ghana|cedi/i.test(String(c.name || c.currency_name || "")),
          );
        if (defaultCurrency) {
          setFormData((p) => ({
            ...p,
            currency_id: p.currency_id || String(defaultCurrency.id || ""),
          }));
        }
      } catch (err) {
        console.error("Failed to fetch currencies", err);
      }
    };

    const fetchExpenseAccounts = async () => {
      try {
        const response = await api.get("/finance/expense-accounts");
        const arr = Array.isArray(response.data?.items)
          ? response.data.items
          : [];
        setExpenseAccounts(arr);
      } catch (err) {
        console.error("Failed to fetch expense accounts", err);
      }
    };

    const fetchCountries = async () => {
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
    };

    fetchCurrencies();
    fetchExpenseAccounts();
    fetchCountries();
  }, []);

  // Set purchase account as default when expense accounts are loaded (for new suppliers only)
  useEffect(() => {
    if (!isNew || formData.expense_account_id || !expenseAccounts.length)
      return;

    // Find purchase account - look for accounts with "purchase" in the name
    const purchaseAccount = expenseAccounts.find(
      (a) =>
        a.name?.toLowerCase().includes("purchase") ||
        a.account_name?.toLowerCase().includes("purchase"),
    );

    if (purchaseAccount) {
      setFormData((prev) => ({
        ...prev,
        expense_account_id: purchaseAccount.id,
      }));
    }
  }, [expenseAccounts, isNew, formData.expense_account_id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // Prepare payload - currently only sending fields supported by backend
      const payload = {
        supplier_code: formData.supplier_code || null,
        supplier_name: formData.supplier_name || null,
        contact_person: formData.contact_person || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        country: formData.country || null,
        payment_terms: formData.payment_terms || null,
        is_active: Boolean(formData.is_active),
        supplier_type: formData.supplier_type || "LOCAL",
        currency_id:
          formData.currency_id === undefined ||
          formData.currency_id === null ||
          formData.currency_id === ""
            ? null
            : Number(formData.currency_id || 0) || null,
        expense_account_id:
          formData.expense_account_id === undefined ||
          formData.expense_account_id === null ||
          formData.expense_account_id === ""
            ? null
            : Number(formData.expense_account_id || 0) || null,
        service_contractor: formData.service_contractor ? "Y" : "N",
      };

      if (isNew) {
        const res = await api.post("/purchase/suppliers", payload);
        const createdId = res?.data?.id || res?.data?.item?.id || null;
        dispatch(setRefresh({ key: "suppliers", id: createdId || null }));
        navigate("/purchase/suppliers", {
          state: {
            afterSave: {
              entity: "suppliers",
              id: createdId || null,
              ts: Date.now(),
            },
          },
          replace: true,
        });
      } else {
        const res = await api.put(`/purchase/suppliers/${id}`, payload);
        const updatedId = res?.data?.id || res?.data?.item?.id || id;
        dispatch(setRefresh({ key: "suppliers", id: updatedId || null }));
        navigate("/purchase/suppliers", {
          state: {
            afterSave: {
              entity: "suppliers",
              id: updatedId || null,
              ts: Date.now(),
            },
          },
          replace: true,
        });
      }
      setSuccess("Supplier saved successfully!");
      toast.success("Supplier saved successfully");
    } catch (e2) {
      setError(e2?.response?.data?.message || "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "supplier_name",
      "supplier_code",
      "contact_person",
      "email",
      "phone",
      "address",
      "payment_terms",
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      "Example Supplier,SUP001,John Doe,john@example.com,1234567890,123 Main St,30 Days";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "supplier_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMassUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const rows = text
        .split("\n")
        .map((r) => r.trim())
        .filter((r) => r);
      if (rows.length < 2) {
        setError("Invalid CSV format or empty file");
        return;
      }

      const headers = rows[0].split(",").map((h) => h.trim());
      const dataRows = rows.slice(1);

      let successCount = 0;
      let failCount = 0;

      setLoading(true);

      // Simple parsing - assumes strictly ordered columns matching template
      // Better to map by header name

      for (const rowStr of dataRows) {
        const cols = rowStr.split(",").map((c) => c.trim());
        if (cols.length < 1) continue;

        // Map based on headers
        const rowData = {};
        headers.forEach((h, i) => {
          if (cols[i]) rowData[h] = cols[i];
        });

        if (!rowData.supplier_name) {
          failCount++;
          continue;
        }

        try {
          await api.post("/purchase/suppliers", {
            supplier_name: rowData.supplier_name,
            supplier_code: rowData.supplier_code || null,
            contact_person: rowData.contact_person || null,
            email: rowData.email || null,
            phone: rowData.phone || null,
            address: rowData.address || null,
            payment_terms: rowData.payment_terms || null,
            is_active: true,
          });
          successCount++;
        } catch (err) {
          console.error("Failed to upload row", rowStr, err);
          failCount++;
        }
      }

      setLoading(false);
      setSuccess(
        `Mass upload completed. Success: ${successCount}, Failed: ${failCount}`,
      );
      if (successCount > 0) {
        // Refresh logic if needed
      }
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden my-6">
      {/* Header */}
      <div
        className="text-white p-8"
        style={{
          background: "linear-gradient(135deg, #0E3646 0%, #0E3646 100%)",
        }}
      >
        <h1 className="text-3xl font-bold">
          👥 Supplier Setup & Configuration
        </h1>
        <p className="mt-2 text-slate-300">
          Manage supplier information, contacts, and performance
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap justify-between items-center p-6 bg-slate-50 border-b border-slate-200 gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0E3646]"
            placeholder="Search suppliers..."
          />
          <span className="absolute right-3 top-2.5 text-slate-400">🔍</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
            onClick={handleDownloadTemplate}
          >
            📥 Template
          </button>
          <button
            type="button"
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            📤 Mass Upload
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".csv"
            onChange={handleMassUpload}
          />
          {!isNew && (
            <button
              type="button"
              className="text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
              style={{ backgroundColor: "#0E3646" }}
              onClick={() => {
                setFormData({
                  supplier_code: "",
                  supplier_name: "",
                  contact_person: "",
                  email: "",
                  phone: "",
                  address: "",
                  payment_terms: "",
                  is_active: true,
                  supplier_type: "LOCAL",
                  tax_id: "",
                  business_reg_no: "",
                  industry: "",
                  website: "",
                  city: "",
                  country: "GH",
                  currency: "GHS",
                  credit_limit: "",
                });
                navigate("/purchase/suppliers/new");
              }}
            >
              ➕ New Supplier
            </button>
          )}
          <button onClick={() => window.history.back()} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
          >
            Back
          </button>
        </div>
      </div>

      <div className="p-8">
        {loading && <div className="text-center py-4">Loading...</div>}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-600 p-4 rounded-md mb-6">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          {/* Single section form - all fields in Basic Information */}

          {/* Tab Content */}
          <div className="block">
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b-2 border-slate-800">
                🏢 Supplier Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {/* Supplier Code field hidden per user request */}
                
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    name="supplier_name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
                    value={formData.supplier_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Supplier Type
                  </label>
                  <select
                    name="supplier_type"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.supplier_type}
                    onChange={handleChange}
                  >
                    <option value="LOCAL">Local Supplier</option>
                    <option value="IMPORT">Import Supplier</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="svc_contractor"
                    type="checkbox"
                    name="service_contractor"
                    checked={formData.service_contractor}
                    onChange={handleChange}
                  />
                  <label
                    htmlFor="svc_contractor"
                    className="text-sm font-semibold text-slate-800"
                  >
                    Service Contractor
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Tax Registration Number
                  </label>
                  <input
                    type="text"
                    name="tax_id"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.tax_id}
                    onChange={handleChange}
                    placeholder="TIN/VAT number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Industry
                  </label>
                  <select
                    name="industry"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.industry}
                    onChange={handleChange}
                  >
                    <option value="">Select Industry</option>
                    <option value="MANUFACTURING">Manufacturing</option>
                    <option value="TRADING">Trading</option>
                    <option value="SERVICES">Services</option>
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    name="website"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.website}
                    onChange={handleChange}
                    placeholder="https://www.supplier.com"
                  />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b-2 border-slate-800">
                📍 Address & Contact
              </h3>
              <div className="grid grid-cols-1 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Address
                  </label>
                  <textarea
                    name="address"
                    rows="2"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Street address"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    list="ghana-cities"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.city}
                    onChange={handleChange}
                  />
                  <datalist id="ghana-cities">
                    {ghanaCities.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    State
                  </label>
                  <input
                    name="state"
                    list="ghana-regions"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.state}
                    onChange={handleChange}
                  />
                  <datalist id="ghana-regions">
                    {GHANA_REGIONS.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Country
                  </label>
                  <input
                    name="country"
                    list="world-countries"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.country}
                    onChange={handleChange}
                  />
                  <datalist id="world-countries">
                    {countries.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Phone
                  </label>
                  <PhoneInput
                    className="w-60"
                    value={formData.phone}
                    onChange={(v) => setFormData(p => ({ ...p, phone: v }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Contact Person (Primary)
                  </label>
                  <input
                    type="text"
                    name="contact_person"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.contact_person}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="text"
                    name="payment_terms"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.payment_terms}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Credit Limit
                  </label>
                  <input
                    type="number"
                    name="credit_limit"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.credit_limit}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Expense Account *
                  </label>
                  <select
                    name="expense_account_id"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.expense_account_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select expense account</option>
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Default Currency *
                  </label>
                  <select
                    name="currency_id"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                    value={formData.currency_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select currency</option>
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
            </div>

            {/* Active Status Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b-2 border-slate-800">
                ⚙️ Status
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="w-5 h-5 text-[#0E3646] border-slate-300 rounded focus:ring-[#0E3646]"
                />
                <label
                  htmlFor="is_active"
                  className="text-sm font-semibold text-slate-800"
                >
                  Active Supplier
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 mt-6">
            <button onClick={() => window.history.back()} className="px-6 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-white rounded-md transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#0E3646" }}
              disabled={saving}
            >
              {saving ? "Saving..." : "💾 Save Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
