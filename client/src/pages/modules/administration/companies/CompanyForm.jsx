/**
 * @fileoverview CompanyForm component.
 * Provides functionality for CompanyForm.
 */

import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { api } from "api/client";
import { useGhanaCities } from "../../../../hooks/useGhanaCities";
import { useAuth } from "@/auth/AuthContext.jsx";

/**
 *  component
 * 
 * @returns {JSX.Element} The rendered component
 */
export default function CompanyForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const isSystemConfig = location.pathname.startsWith("/system-configuration");
  const backPath = isSystemConfig ? "/system-configuration/companies" : "/administration/companies";
  const moduleHome = isSystemConfig ? "/system-configuration" : "/administration";
  const { cities: ghanaCities } = useGhanaCities();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    isActive: true,
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    telephone: "",
    email: "",
    website: "",
    tax_id: "",
    registration_no: "",
    fiscal_year_start_month: 1,
    timezone: "",
    currency_id: "",
  });
  const [currencies, setCurrencies] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [countries, setCountries] = useState([]);

  const GHANA_REGIONS = [
    "Greater Accra", "Ashanti", "Central", "Eastern", "Western", 
    "Western North", "Volta", "Oti", "Northern", "Savannah", 
    "North East", "Upper East", "Upper West", "Bono", "Bono East", "Ahafo"
  ];

  useEffect(() => {
    fetchCurrencies();
    fetchCountries();
    if (isEdit) {
      fetchCompany();
    }
  }, [id]);

  async function fetchCountries() {
    try {
      const resp = await fetch("https://restcountries.com/v3.1/all?fields=name");
      const data = await resp.json();
      if (Array.isArray(data)) {
        const list = data.map(c => c.name.common).sort();
        setCountries(list);
      }
    } catch (err) {
      console.error("Failed to fetch countries", err);
    }
  }

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  async function fetchCompany() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get(`/admin/companies/${id}`);
      if (response.data?.item) {
        const it = response.data.item;
        setForm({
          code: it.code || "",
          name: it.name || "",
          isActive: it.is_active === 1 || it.is_active === true,
          address: it.address || "",
          city: it.city || "",
          state: it.state || "",
          postal_code: it.postal_code || "",
          country: it.country || "",
          telephone: it.telephone || "",
          email: it.email || "",
          website: it.website || "",
          tax_id: it.tax_id || "",
          registration_no: it.registration_no || "",
          fiscal_year_start_month: it.fiscal_year_start_month || 1,
          timezone: it.timezone || "",
          currency_id: it.currency_id || "",
        });
        try {
          const timestamp = new Date().getTime();
          const logoResp = await api.get(
            `/admin/companies/${id}/logo?t=${timestamp}`,
            {
              responseType: "blob",
            },
          );
          if (logoResp.data && logoResp.data.size > 0) {
            const url = URL.createObjectURL(logoResp.data);
            setLogoPreview(url);
            console.log("Logo loaded on fetch");
          }
        } catch (err) {
          console.log("No logo found for company:", err?.response?.status);
        }
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error fetching company");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCurrencies() {
    try {
      const resp = await api.get("/finance/currencies");
      const arr = Array.isArray(resp.data?.items) ? resp.data.items : [];
      setCurrencies(arr);
    } catch {}
  }

  async function reloadLogoFromServer(companyId) {
    try {
      // Add timestamp to bust cache
      const timestamp = new Date().getTime();
      console.log(
        "Fetching logo for company:",
        companyId,
        "timestamp:",
        timestamp,
      );
      const logoResp = await api.get(
        `/admin/companies/${companyId}/logo?t=${timestamp}`,
        {
          responseType: "blob",
        },
      );
      console.log(
        "Logo response:",
        logoResp.status,
        "size:",
        logoResp.data?.size,
      );
      if (logoResp.data && logoResp.data.size > 0) {
        const url = URL.createObjectURL(logoResp.data);
        setLogoPreview(url);
        console.log("Logo loaded successfully from server:", url);
      } else {
        console.warn("Logo response is empty", logoResp.data);
        setLogoError("Logo uploaded but could not be retrieved");
      }
    } catch (err) {
      console.error("Failed to load logo from server:", {
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        message: err?.message,
        data: err?.response?.data,
      });
      // Don't set error if it's a 404 (logo doesn't exist yet), that's normal for new companies
      if (err?.response?.status !== 404) {
        setLogoError("Failed to load uploaded logo");
      }
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    setLogoError("");
    if (!file) return;
    if (!String(file.type).startsWith("image/")) {
      setLogoError("Only image files are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Image size must be less than 2MB");
      return;
    }
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  }

  async function uploadLogo() {
    if (!isEdit) {
      setLogoError("Save company first before uploading logo");
      return;
    }
    if (!logoFile) {
      setLogoError("Choose an image file to upload");
      return;
    }
    setLogoUploading(true);
    setLogoError("");
    try {
      console.log("Uploading logo file:", logoFile.name, logoFile.size);
      const formData = new FormData();
      formData.append("logo", logoFile);
      const resp = await api.post(`/admin/companies/${id}/logo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("Upload response:", resp.data);
      // Clear the file after successful upload
      setLogoFile(null);
      // Reload logo from server to show the actual uploaded logo
      await reloadLogoFromServer(id);
    } catch (err) {
      console.error("Upload error:", err);
      setLogoError(err?.response?.data?.message || "Failed to upload logo");
    } finally {
      setLogoUploading(false);
    }
  }

  function update(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        code: form.code,
        is_active: form.isActive ? 1 : 0,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        postal_code: form.postal_code || undefined,
        country: form.country || undefined,
        telephone: form.telephone || undefined,
        email: form.email || undefined,
        website: form.website || undefined,
        tax_id: form.tax_id || undefined,
        registration_no: form.registration_no || undefined,
        fiscal_year_start_month:
          form.fiscal_year_start_month !== undefined &&
          form.fiscal_year_start_month !== null
            ? Number(form.fiscal_year_start_month)
            : undefined,
        timezone: form.timezone || undefined,
        currency_id:
          form.currency_id !== "" && form.currency_id !== null
            ? Number(form.currency_id)
            : undefined,
      };
      let companyId = id;
      if (isEdit) {
        await api.put(`/admin/companies/${id}`, payload);
      } else {
        const res = await api.post("/admin/companies", payload);
        companyId = res.data?.id;
        if (companyId) {
          await api.put(`/admin/companies/${companyId}`, payload);
        }
      }

      // Upload logo if a file was selected
      if (logoFile && companyId) {
        try {
          console.log("Submitting logo with company:", companyId);
          const formData = new FormData();
          formData.append("logo", logoFile);
          const uploadResp = await api.post(
            `/admin/companies/${companyId}/logo`,
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
            },
          );
          console.log("Logo upload response:", uploadResp.data);
          setLogoFile(null);
          // Reload logo from server to show the actual uploaded logo
          await reloadLogoFromServer(companyId);
        } catch (uploadErr) {
          console.error("Logo upload during submit failed:", uploadErr);
        }
      }

      navigate(backPath);
    } catch (err) {
      setError(err?.response?.data?.message || "Error saving company");
    } finally {
      setLoading(false);
    }
  }

  if (Number(user?.id) !== 1) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">
          You do not have permission to view the Company Setup page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={backPath}
          className="text-sm text-brand hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-block"
        >
          ← Back to Companies
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isEdit ? "Edit Company" : "New Company"}
        </h1>
        <p className="text-sm mt-1">Company profile</p>
      </div>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Code *</label>
                <input
                  className="input"
                  value={form.code}
                  onChange={(e) => update("code", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={form.isActive ? "1" : "0"}
                  onChange={(e) => update("isActive", e.target.value === "1")}
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Address</label>
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>
              <div>
                <label className="label">City</label>
                <input
                  className="input"
                  list="ghana-cities"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                />
                <datalist id="ghana-cities">
                  {ghanaCities.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label">State</label>
                <input
                  className="input"
                  list="ghana-regions"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                />
                <datalist id="ghana-regions">
                  {GHANA_REGIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label">Postal Code</label>
                <input
                  className="input"
                  value={form.postal_code}
                  onChange={(e) => update("postal_code", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Country</label>
                <input
                  className="input"
                  list="world-countries"
                  value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                />
                <datalist id="world-countries">
                  {countries.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label">Telephone</label>
                <input
                  className="input"
                  value={form.telephone}
                  onChange={(e) => update("telephone", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Website</label>
                <input
                  className="input"
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Tax ID</label>
                <input
                  className="input"
                  value={form.tax_id}
                  onChange={(e) => update("tax_id", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Registration No.</label>
                <input
                  className="input"
                  value={form.registration_no}
                  onChange={(e) => update("registration_no", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Fiscal Year Start Month</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="12"
                  value={form.fiscal_year_start_month}
                  onChange={(e) =>
                    update("fiscal_year_start_month", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="label">Timezone</label>
                <input
                  className="input"
                  value={form.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Base/Functional Currency *</label>
                <select
                  className="input"
                  value={form.currency_id}
                  onChange={(e) => update("currency_id", e.target.value)}
                  required
                >
                  <option value="">Select Base Currency</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.code || c.currency_code) +
                        " - " +
                        (c.name || c.currency_name)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Company Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 border border-gray-200 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-sm text-slate-500">No logo</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="input"
                    />
                    <div className="mt-2">
                      {logoFile && (
                        <button
                          type="button"
                          onClick={uploadLogo}
                          className="btn-success"
                          disabled={logoUploading}
                        >
                          {logoUploading ? "Uploading..." : "Upload Logo"}
                        </button>
                      )}
                    </div>
                    {logoError && (
                      <div className="text-red-600 text-xs mt-2">
                        {logoError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Link to={backPath} className="btn-success">
                Cancel
              </Link>
              <button className="btn-success" type="submit" disabled={loading}>
                {loading ? "Saving..." : isEdit ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
