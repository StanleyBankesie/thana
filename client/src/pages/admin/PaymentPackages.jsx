import React, { useState, useEffect } from "react";
import { api } from "../../api/client.js";
import { toast } from "react-toastify";
import { useAuth } from "../../auth/AuthContext.jsx";
import { useNavigate, useLocation } from "react-router-dom";

export default function PaymentPackages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSystemConfig = location.pathname.startsWith("/system-configuration");
  const moduleHome = isSystemConfig ? "/system-configuration" : "/administration";
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [superAdminId, setSuperAdminId] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [packageSearch, setPackageSearch] = useState("");

  const initialForm = {
    plan_name: "",
    cloud_hosting: "",
    support_maintenance: "",
    software_license: "",
    amount: "",
    duration_months: "",
    status: "ACTIVE",
  };

  const [formData, setFormData] = useState(initialForm);

  // Auto-calculate the total amount whenever the breakdown fields change
  useEffect(() => {
    const total =
      (parseFloat(formData.cloud_hosting) || 0) +
      (parseFloat(formData.support_maintenance) || 0) +
      (parseFloat(formData.software_license) || 0);
    setFormData((prev) => ({ ...prev, amount: total }));
  }, [
    formData.cloud_hosting,
    formData.support_maintenance,
    formData.software_license,
  ]);

  useEffect(() => {
    fetchConfig();
    fetchPackages();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await api.get("/licenses/super-admin").catch(() => null);
      if (res?.data?.superAdminId) {
        setSuperAdminId(res.data.superAdminId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await api.get("/subscription-plans").catch(() => null);
      if (res && res.data && Array.isArray(res.data)) {
        setPackages(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedPackageId) {
      if (selectedPackageId === "NEW") {
        setFormData(initialForm);
        setPackageSearch("New Package");
      } else {
        const selected = packages.find(
          (p) => String(p.id) === String(selectedPackageId),
        );
        if (selected) {
          setPackageSearch(selected.plan_name);
          setFormData({
            plan_name: selected.plan_name,
            cloud_hosting: selected.cloud_hosting,
            support_maintenance: selected.support_maintenance,
            software_license: selected.software_license,
            amount: selected.amount,
            duration_months: selected.duration_months,
            status: selected.status,
          });
        }
      }
    }
  }, [selectedPackageId, packages]);

  const handleSavePackage = async () => {
    if (
      !formData.plan_name ||
      formData.amount === "" ||
      !formData.duration_months
    ) {
      return toast.error("Please fill in all required fields.");
    }
    setLoading(true);
    try {
      if (selectedPackageId === "NEW") {
        await api.post(`/subscription-plans`, formData);
        toast.success("Package created successfully.");
      } else {
        await api.put(`/subscription-plans/${selectedPackageId}`, formData);
        toast.success("Package updated successfully.");
      }
      setSelectedPackageId("");
      fetchPackages();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Failed to save package",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePackage = async () => {
    if (selectedPackageId === "NEW" || !selectedPackageId) return;
    if (
      !window.confirm("Are you sure you want to delete this payment package?")
    )
      return;

    setLoading(true);
    try {
      await api.delete(`/subscription-plans/${selectedPackageId}`);
      toast.success("Package deleted successfully.");
      setSelectedPackageId("");
      fetchPackages();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to delete package",
      );
    } finally {
      setLoading(false);
    }
  };

  if (Number(user?.id) !== Number(superAdminId)) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400">
          You do not have permission to view the Payment Packages console.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Payment Packages</h1>
        <button 
          onClick={() => navigate(moduleHome)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded shadow-sm transition">Back to Menu
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-4 rounded shadow">
            <h2 className="text-lg font-semibold mb-4">Select Package</h2>
            <button
              onClick={() => setSelectedPackageId("NEW")}
              className="w-full mb-4 bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition"
            >
              + Create New Package
            </button>
            <div className="relative">
              <input
                type="text"
                className="w-full border rounded p-2 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                placeholder="Type to search packages..."
                value={packageSearch}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 250)}
                onChange={(e) => {
                  setPackageSearch(e.target.value);
                  setShowDropdown(true);
                }}
              />
              {showDropdown && (
                <div className="absolute z-10 w-full bg-white dark:bg-slate-800 border rounded shadow mt-1 max-h-60 overflow-y-auto">
                  {packages.filter((p) =>
                    p.plan_name
                      .toLowerCase()
                      .includes(packageSearch.toLowerCase()),
                  ).length > 0 ? (
                    packages
                      .filter((p) =>
                        p.plan_name
                          .toLowerCase()
                          .includes(packageSearch.toLowerCase()),
                      )
                      .map((p) => (
                        <div
                          key={p.id}
                          className="p-2 hover:bg-slate-100 cursor-pointer text-sm"
                          onClick={() => {
                            setSelectedPackageId(p.id);
                            setPackageSearch(p.plan_name);
                            setShowDropdown(false);
                          }}
                        >
                          {p.plan_name} - GHS {p.amount}
                        </div>
                      ))
                  ) : (
                    <div className="p-2 text-slate-500 dark:text-slate-500 text-xs">
                      No packages found
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedPackageId && selectedPackageId !== "NEW" && (
              <div className="mt-6 border-t pt-4">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300">
                  Current Package Info
                </h3>
                <p className="mt-2 text-sm">
                  <strong>Total Amount:</strong> GHS {formData.amount}
                </p>
                <p className="text-sm">
                  <strong>Status:</strong>
                  <span
                    className={`ml-2 px-2 py-1 rounded text-xs ${formData.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                  >
                    {formData.status}
                  </span>
                </p>
                <p className="text-sm mt-2">
                  <strong>Duration:</strong> {formData.duration_months} Months
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-1 md:col-span-2">
          {selectedPackageId ? (
            <div className="bg-white dark:bg-slate-800 p-6 rounded shadow space-y-6">
              <h2 className="text-xl font-bold border-b pb-2">
                {selectedPackageId === "NEW"
                  ? "New Payment Package"
                  : "Edit Payment Package"}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Package Name
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    placeholder="e.g. 1 Year Standard"
                    value={formData.plan_name}
                    onChange={(e) =>
                      setFormData({ ...formData, plan_name: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-2 mt-4">
                  <h3 className="text-md font-semibold text-slate-700 border-b pb-1 mb-3">
                    Pricing Breakdown (GHS)
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Cloud Hosting & Backup
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    value={formData.cloud_hosting}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cloud_hosting: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Support & Maintenance
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    value={formData.support_maintenance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        support_maintenance: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Annual Software License
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded p-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    value={formData.software_license}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        software_license: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-primary-600">
                    Total Calculated Amount
                  </label>
                  <input
                    type="number"
                    disabled
                    className="w-full border-2 border-primary-200 rounded p-2 bg-primary-50 font-bold text-slate-600"
                    value={formData.amount}
                  />
                </div>

                <div className="col-span-2 mt-2">
                  <h3 className="text-md font-semibold text-slate-700 border-b pb-1 mb-3">
                    Settings
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    value={formData.duration_months}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        duration_months: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Status
                  </label>
                  <select
                    className="w-full border rounded p-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                {selectedPackageId !== "NEW" ? (
                  <button
                    onClick={handleDeletePackage}
                    className="bg-red-600 text-white px-6 py-2 rounded shadow hover:bg-red-700 transition"
                    disabled={loading}
                  >
                    {loading ? "Deleting..." : "Delete Package"}
                  </button>
                ) : (
                  <div></div>
                )}
                <button
                  onClick={handleSavePackage}
                  className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition"
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Package"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 p-6 rounded shadow flex items-center justify-center h-64 text-slate-500 dark:text-slate-500">
              Select a payment package to edit or create a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

