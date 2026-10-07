import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { toast } from "react-toastify";
import { LayoutGrid, Layers, CheckCircle2, ShieldAlert, Sparkles, Compass, FolderKanban } from "lucide-react";

export default function AppModeControlSection() {
  const [mode, setMode] = useState("STANDARD");
  const [moduleSectionView, setModuleSectionView] = useState(() => {
    try {
      if (typeof localStorage !== "undefined") {
        const val = localStorage.getItem("omnisuite.module_section_view");
        if (val !== null) return val === "true";
      }
    } catch {}
    return false;
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadMode() {
      try {
        setLoading(true);
        const res = await api.get("/admin/settings/app-mode");
        if (!mounted) return;
        const currentMode = res.data?.mode === "BASIC" ? "BASIC" : "STANDARD";
        setMode(currentMode);
        const secView = res.data?.module_section_view === true;
        setModuleSectionView(secView);
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("omnisuite.app_mode", currentMode);
            localStorage.setItem("omnisuite.module_section_view", String(secView));
          }
        } catch {}
      } catch (err) {
        console.error("Failed to load application mode:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadMode();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleToggleSectionView(checked) {
    setModuleSectionView(checked);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("omnisuite.module_section_view", String(checked));
      }
      window.dispatchEvent(
        new CustomEvent("module-section-view-changed", { detail: { enabled: checked } })
      );
      await api.post("/admin/settings/app-mode", { mode, module_section_view: checked });
      toast.success(
        checked
          ? "Module home section view enabled! In Standard Mode, users will see sections first."
          : "Direct page cards restored for module homes."
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update module section view setting");
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      await api.post("/admin/settings/app-mode", { mode, module_section_view: moduleSectionView });
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("omnisuite.app_mode", mode);
          localStorage.setItem("omnisuite.module_section_view", String(moduleSectionView));
        }
        window.dispatchEvent(
          new CustomEvent("app-mode-changed", { detail: { mode } })
        );
        window.dispatchEvent(
          new CustomEvent("module-section-view-changed", { detail: { enabled: moduleSectionView } })
        );
      } catch {}
      toast.success(
        mode === "BASIC"
          ? "Basic Mode activated! Homepage & Module Homes streamlined."
          : "Standard Mode activated! Full enterprise view restored."
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save application mode");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="card-body space-y-5">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <Compass className="w-5 h-5 text-brand-600" />
              Application Navigation & Layout Mode
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Control whether users experience the full enterprise layout or the streamlined operational Basic Mode.
            </div>
          </div>
          {loading ? (
            <span className="text-xs text-slate-400">Loading...</span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                mode === "BASIC"
                  ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              }`}
            >
              <CheckCircle2 size={13} />
              Current: {mode === "BASIC" ? "Basic Mode" : "Standard Mode"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Standard Mode Option */}
          <div
            onClick={() => setMode("STANDARD")}
            className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              mode === "STANDARD"
                ? "border-brand-600 bg-brand-50/20 dark:bg-brand-950/20 shadow-md ring-1 ring-brand-500/30"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      mode === "STANDARD"
                        ? "bg-brand-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Layers size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Standard Mode
                    </h3>
                    <span className="text-[11px] text-slate-500">Default Enterprise View</span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="app_mode"
                  checked={mode === "STANDARD"}
                  onChange={() => setMode("STANDARD")}
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                />
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Full enterprise dashboard featuring Company Feed/Posts, Pending Approvals workflow queue, all Module Reports, and Notification summaries. Module homes show grouped Category Section cards with "Explore Section" navigation.
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-500">✓</span> Pending Approvals & Workflows on Home
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-500">✓</span> Company Social Feed & Post History
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-500">✓</span> Module Reports & Notification Center
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-500">✓</span> Category Section Cards in Module Homes
                </div>
              </div>
            </div>
          </div>

          {/* Basic Mode Option */}
          <div
            onClick={() => setMode("BASIC")}
            className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              mode === "BASIC"
                ? "border-amber-600 bg-amber-50/20 dark:bg-amber-950/20 shadow-md ring-1 ring-amber-500/30"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      mode === "BASIC"
                        ? "bg-amber-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <LayoutGrid size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Basic Mode
                    </h3>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      Fast Direct Operational View
                    </span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="app_mode"
                  checked={mode === "BASIC"}
                  onChange={() => setMode("BASIC")}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500"
                />
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Streamlined view for fast operations. Hides Pending Approvals, Company Posts, Reports, and Notifications from the homepage. Directly displays up to 3 assigned pages per module on the homepage, and individual assigned pages in module homes.
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-500">✓</span> Top 4 Dashboard Metric Cards Unchanged
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-500">✓</span> 3 Assigned Pages Per Module on Homepage
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-500">✓</span> Direct Individual Pages in Module Homes (No Section Cards)
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">✗</span> Approvals, Posts, Reports, Notifications Hidden from Home
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Module Home Section View Option (for Standard Mode) */}
        <div className={`p-4 rounded-xl border transition-all ${
          mode === "STANDARD"
            ? "border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60"
            : "border-slate-100 dark:border-slate-800/40 bg-slate-50/40 dark:bg-slate-900/30 opacity-70"
        } flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Show Pages Section First in Module Homes (Standard Mode)</span>
              {mode === "BASIC" && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Standard Mode Only
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              When checked, navigating to any module home in Standard Mode presents the pages section overview. Clicking a section opens its individual page cards. When unchecked, all page cards are directly visible.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={moduleSectionView}
              onChange={(e) => handleToggleSectionView(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-brand-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles size={14} className="text-brand-500" />
            Switching mode applies instantly across all users in the company.
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Saving Mode..." : "Save Application Mode"}
          </button>
        </div>
      </div>
    </div>
  );
}
