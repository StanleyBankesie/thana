import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { toast } from "react-toastify";
import { LineChart, Database } from "lucide-react";

export default function BiIsolationSection() {
  const [isolateBranch, setIsolateBranch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await api.get("/admin/settings/bi-isolation");
        if (mounted && res?.data?.data) {
          setIsolateBranch(Boolean(res.data.data.isolate_branch));
        }
      } catch (err) {
        console.error("Failed to load Business Intelligence isolation settings", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      await api.post("/admin/settings/bi-isolation", {
        isolate_branch: isolateBranch,
      });
      toast.success("Business Intelligence isolation settings saved successfully");
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to save Business Intelligence settings",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-body space-y-4">
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              <LineChart className="w-5 h-5 text-emerald-600" />
              Business Intelligence (BI) Data Access & Isolation
            </div>
            <div className="text-sm text-slate-500 mt-0.5">
              Individual configuration for Business Intelligence module analytics, data pipelines, and insights.
            </div>
          </div>
          <span className="badge badge-success">BI Module Setup</span>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500 py-3">
            Loading Business Intelligence settings...
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="flex items-start justify-between p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors bg-white">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg mt-0.5">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <label
                    htmlFor="isolate-bi-cb"
                    className="font-medium text-slate-800 cursor-pointer text-sm"
                  >
                    Isolate Business Intelligence (BI) by Branch
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isolateBranch
                      ? "Enabled: BI dashboards, automated insights, fact tables, multidimensional analytics, and ETL datasets will strictly filter and display records for the user's assigned branch."
                      : "Disabled (Enterprise BI): Business Intelligence analytics, custom dashboards, and data pipelines aggregate data enterprise-wide across all company branches."}
                  </p>
                </div>
              </div>
              <input
                id="isolate-bi-cb"
                type="checkbox"
                className="checkbox checkbox-primary mt-1"
                checked={isolateBranch}
                onChange={(e) => setIsolateBranch(e.target.checked)}
                disabled={saving}
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving ? "Saving..." : "Save BI Isolation Settings"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
