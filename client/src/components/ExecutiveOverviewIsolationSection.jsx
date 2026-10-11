import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { toast } from "react-toastify";
import { Briefcase, ShieldCheck } from "lucide-react";

export default function ExecutiveOverviewIsolationSection() {
  const [isolateBranch, setIsolateBranch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await api.get("/admin/settings/executive-overview-isolation");
        if (mounted && res?.data?.data) {
          setIsolateBranch(Boolean(res.data.data.isolate_branch));
        }
      } catch (err) {
        console.error("Failed to load Executive Overview isolation settings", err);
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
      await api.post("/admin/settings/executive-overview-isolation", {
        isolate_branch: isolateBranch,
      });
      toast.success("Executive Overview isolation settings saved successfully");
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to save Executive Overview settings",
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
              <Briefcase className="w-5 h-5 text-indigo-600" />
              Executive Overview Data Access & Isolation
            </div>
            <div className="text-sm text-slate-500 mt-0.5">
              Individual configuration for Executive Overview module workflows and metrics.
            </div>
          </div>
          <span className="badge badge-primary">Executive Module Setup</span>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500 py-3">
            Loading Executive Overview settings...
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="flex items-start justify-between p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors bg-white">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <label
                    htmlFor="isolate-exec-cb"
                    className="font-medium text-slate-800 cursor-pointer text-sm"
                  >
                    Isolate Executive Overview by Branch
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isolateBranch
                      ? "Enabled: Executive Overview dashboard, pending approval queues, and cross-module workflow trackers will only display records originating from the user's assigned branch."
                      : "Disabled (Global Overview): Executive Overview aggregates company-wide metrics and pending workflows across all branches."}
                  </p>
                </div>
              </div>
              <input
                id="isolate-exec-cb"
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
                {saving ? "Saving..." : "Save Executive Overview Settings"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
