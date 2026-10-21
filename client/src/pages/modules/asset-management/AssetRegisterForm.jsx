import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { 
  Building2, ArrowLeft, Save, Tag, DollarSign, 
  Calendar, Layers, MapPin, User, CheckCircle2, ShieldAlert
} from "lucide-react";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";

export default function AssetRegisterForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [tagGenerating, setTagGenerating] = useState(false);
  const [categories, setCategories] = useState([]);
  const [properties, setProperties] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);

  const [form, setForm] = useState({
    asset_code: "",
    barcode: "",
    asset_name: "",
    category_id: "",
    serial_number: "",
    model_number: "",
    manufacturer: "",
    capitalization_date: new Date().toISOString().split("T")[0],
    purchase_date: new Date().toISOString().split("T")[0],
    purchase_cost: "",
    salvage_value: "0.00",
    depreciation_method: "STRAIGHT_LINE",
    useful_life_years: 5,
    depreciation_rate_pct: 20,
    property_id: "",
    space_id: "",
    custodian_user_id: "",
    status: "ACTIVE",
    notes: "",
  });

  useEffect(() => {
    fetchPrerequisites();
    if (isEdit) {
      fetchAssetDetails();
    }
  }, [id]);

  const fetchPrerequisites = async () => {
    try {
      const [catRes, propRes, mfgRes] = await Promise.all([
        api.get("/assets/categories").catch(() => ({ data: { data: [] } })),
        api.get("/assets/properties").catch(() => api.get("/facilities/properties").catch(() => ({ data: { data: [] } }))),
        api.get("/assets/manufacturers").catch(() => ({ data: { data: [] } })),
      ]);
      setCategories(catRes.data?.data || []);
      setProperties(propRes.data?.data || []);
      setManufacturers(mfgRes.data?.data || []);
    } catch {
      // Ignored
    }
  };

  const handleAutoGenerateTag = async (categoryIdOverride = null, propertyIdOverride = null) => {
    try {
      setTagGenerating(true);
      const catId = categoryIdOverride ?? form.category_id;
      const propId = propertyIdOverride ?? form.property_id;
      const res = await api.get("/assets/setup/next-tag", {
        params: {
          categoryId: catId,
          propertyId: propId,
        },
      });
      const nextTag = res.data?.next_tag || res.data?.tag;
      if (nextTag) {
        setForm((prev) => ({
          ...prev,
          asset_code: nextTag,
          barcode: prev.barcode || nextTag,
        }));
        toast.info(`Generated Asset Tag: ${nextTag}`);
      }
    } catch {
      toast.error("Failed to generate tag from nomenclature");
    } finally {
      setTagGenerating(false);
    }
  };

  const fetchAssetDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/assets/${id}`);
      const d = res.data?.data;
      if (d) {
        setForm({
          asset_code: d.asset_code || "",
          barcode: d.barcode || "",
          asset_name: d.asset_name || "",
          category_id: d.category_id || "",
          serial_number: d.serial_number || "",
          model_number: d.model_number || "",
          manufacturer: d.manufacturer || d.make || "",
          capitalization_date: d.capitalization_date ? d.capitalization_date.split("T")[0] : "",
          purchase_date: d.purchase_date ? d.purchase_date.split("T")[0] : "",
          purchase_cost: d.purchase_cost || "",
          salvage_value: d.salvage_value || "0.00",
          depreciation_method: d.depreciation_method || "STRAIGHT_LINE",
          useful_life_years: d.useful_life_years || 5,
          depreciation_rate_pct: d.depreciation_rate_pct || 20,
          property_id: d.property_id || "",
          space_id: d.space_id || "",
          custodian_user_id: d.custodian_user_id || "",
          status: d.status || "ACTIVE",
          notes: d.notes || "",
        });
      }
    } catch {
      toast.error("Failed to load asset details");
      navigate("/assets");
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    const selected = categories.find((c) => String(c.id) === String(catId));
    if (selected) {
      setForm((prev) => ({
        ...prev,
        category_id: catId,
        depreciation_method: selected.depreciation_method || prev.depreciation_method,
        useful_life_years: selected.default_useful_life_years || prev.useful_life_years,
        depreciation_rate_pct: selected.default_depreciation_rate || prev.depreciation_rate_pct,
      }));
    } else {
      setForm((prev) => ({ ...prev, category_id: catId }));
    }
    if (!form.asset_code && !isEdit && catId) {
      handleAutoGenerateTag(catId, form.property_id);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.asset_name.trim()) {
      toast.error("Please enter asset name");
      return;
    }
    if (!form.category_id) {
      toast.error("Please select an asset category");
      return;
    }
    if (!form.purchase_cost || Number(form.purchase_cost) <= 0) {
      toast.error("Please specify a valid purchase cost");
      return;
    }

    try {
      setSaving(true);
      if (isEdit) {
        await api.put(`/assets/${id}`, form);
        toast.success("Asset updated successfully");
      } else {
        await api.post("/assets", form);
        toast.success("Asset capitalized successfully");
      }
      navigate("/assets");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save asset");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Loading asset data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary inline-flex items-center gap-2 px-3.5 py-2 text-sm"
            title="Go Back"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {isEdit ? `Edit Fixed Asset: ${form.asset_code || form.asset_name}` : "Capitalize New Fixed Asset"}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Record master asset details, capitalization costs, and financial depreciation parameters.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Asset Identification */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Tag className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            Asset Identification & Master Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Asset Name *
              </label>
              <input
                type="text"
                required
                value={form.asset_name}
                onChange={(e) => setForm({ ...form, asset_name: e.target.value })}
                placeholder="e.g. Caterpillar 500kVA Diesel Generator"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Asset Category *
                </label>
                <Link to="/assets/categories" className="text-[11px] text-slate-400 hover:text-brand-600">
                  Setup Categories
                </Link>
              </div>
              <select
                required
                value={form.category_id}
                onChange={handleCategoryChange}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select Category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Asset Code / Tag
                </label>
                <button
                  type="button"
                  onClick={() => handleAutoGenerateTag()}
                  disabled={tagGenerating}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors"
                >
                  {tagGenerating ? "Generating..." : "Auto-Generate Tag"}
                </button>
              </div>
              <input
                type="text"
                value={form.asset_code}
                onChange={(e) => setForm({ ...form, asset_code: e.target.value })}
                placeholder="Populated from nomenclature rule or enter tag"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Barcode / RFID Tag
              </label>
              <input
                type="text"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                placeholder="Scan or enter barcode number"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Serial Number
              </label>
              <input
                type="text"
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                placeholder="Manufacturer serial no."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Manufacturer / Brand
                </label>
                <Link to="/assets/setup" className="text-[11px] text-slate-400 hover:text-brand-600">
                  Manage Brands
                </Link>
              </div>
              <input
                type="text"
                list="manufacturers-list"
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                placeholder="Select or enter manufacturer brand..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <datalist id="manufacturers-list">
                {manufacturers.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} {m.country ? `(${m.country})` : ""}
                  </option>
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* Card 2: Financial Capitalization & Depreciation Parameters */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Financial Capitalization & Depreciation Engine
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Capitalization Date *
              </label>
              <input
                type="date"
                required
                value={form.capitalization_date}
                onChange={(e) => setForm({ ...form, capitalization_date: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Gross Purchase Cost *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={form.purchase_cost}
                onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Salvage / Residual Value
              </label>
              <input
                type="number"
                step="0.01"
                value={form.salvage_value}
                onChange={(e) => setForm({ ...form, salvage_value: e.target.value })}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Depreciation Method
              </label>
              <select
                value={form.depreciation_method}
                onChange={(e) => setForm({ ...form, depreciation_method: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="STRAIGHT_LINE">Straight-Line (Equal Monthly)</option>
                <option value="REDUCING_BALANCE">Reducing Balance</option>
                <option value="DOUBLE_DECLINING">Double Declining Balance</option>
                <option value="NONE">No Depreciation (e.g. Freehold Land)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Useful Life (Years)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.useful_life_years}
                onChange={(e) => setForm({ ...form, useful_life_years: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Annual Depreciation Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.depreciation_rate_pct}
                onChange={(e) => setForm({ ...form, depreciation_rate_pct: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Location, Custody & Notes */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Location & Physical Custody
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Property / Facility Site
                </label>
                <Link to="/assets/setup" className="text-[11px] text-slate-400 hover:text-brand-600">
                  Manage Sites
                </Link>
              </div>
              <select
                value={form.property_id}
                onChange={(e) => {
                  const pid = e.target.value;
                  setForm({ ...form, property_id: pid });
                  if (!form.asset_code && !isEdit) handleAutoGenerateTag(form.category_id, pid);
                }}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select Facility / Site...</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.property_name} {p.property_type ? `(${p.property_type})` : ""} {p.city ? `— ${p.city}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Operational Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="ACTIVE">Active & Operational</option>
                <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                <option value="FULLY_DEPRECIATED">Fully Depreciated</option>
                <option value="DISPOSED">Disposed / Retired</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Notes & Technical Specifications
              </label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes, warranty terms, or installation details..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to="/assets/register"
            className="btn btn-secondary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving Asset..." : isEdit ? "Update Asset" : "Capitalize Asset"}
          </button>
        </div>
      </form>
    </div>
  );
}
