/**
 * @fileoverview BI Settings — preferences for the Business Intelligence module.
 */
import React, { useState } from "react";
import { Settings, Save } from "lucide-react";
import { PageHeader, SectionCard } from "./bi.shared.jsx";

const STORAGE_KEY = "bi_settings";

const DEFAULT_SETTINGS = {
  defaultDateRange: "6",
  currency: "GHS",
  dateFormat: "YYYY-MM-DD",
  kpiRefreshInterval: "manual",
  autoRefreshDashboard: false,
  showAllModules: true,
  defaultLandingPage: "executive-dashboard",
  alertsEnabled: true,
  insightsEnabled: true,
  compactMode: false,
};

export default function BISettings() {
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
    catch { return { ...DEFAULT_SETTINGS }; }
  });
  const [saved, setSaved] = useState(false);

  const update = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings({ ...DEFAULT_SETTINGS });
  };

  const Field = ({ label, help, children }) => (
    <div className="flex items-start justify-between py-4 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex-1 pr-8">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</div>
        {help && <div className="text-[10px] text-slate-400 mt-0.5">{help}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  const Toggle = ({ value, onChange }) => (
    <button onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors ${value ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600"}`}>
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="BI Settings" description="Configure your Business Intelligence module preferences">
        <button onClick={save} className="btn-secondary text-xs px-3 py-1.5 gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20">
          <Save size={13} /> {saved ? "Saved!" : "Save"}
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Display Preferences">
          <div className="px-5">
            <Field label="Default Date Range" help="For all trend charts and analytics pages">
              <select className="input text-xs py-1 px-2" value={settings.defaultDateRange} onChange={e => update("defaultDateRange", e.target.value)}>
                <option value="3">3 Months</option>
                <option value="6">6 Months</option>
                <option value="12">12 Months</option>
              </select>
            </Field>
            <Field label="Currency Display" help="Currency symbol for financial values">
              <select className="input text-xs py-1 px-2" value={settings.currency} onChange={e => update("currency", e.target.value)}>
                <option>GHS</option><option>USD</option><option>EUR</option><option>GBP</option>
              </select>
            </Field>
            <Field label="Date Format" help="How dates are displayed across BI pages">
              <select className="input text-xs py-1 px-2" value={settings.dateFormat} onChange={e => update("dateFormat", e.target.value)}>
                <option>YYYY-MM-DD</option><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option>
              </select>
            </Field>
            <Field label="Compact Mode" help="Reduce spacing to show more data on screen">
              <Toggle value={settings.compactMode} onChange={v => update("compactMode", v)} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Dashboard & Landing Page">
          <div className="px-5">
            <Field label="Default Landing Page" help="Which page opens when you enter the BI module">
              <select className="input text-xs py-1 px-2" value={settings.defaultLandingPage} onChange={e => update("defaultLandingPage", e.target.value)}>
                <option value="executive-dashboard">Executive Dashboard</option>
                <option value="">BI Hub (All Modules)</option>
                <option value="ai-insights">AI Insights</option>
                <option value="alerts">Alerts Center</option>
              </select>
            </Field>
            <Field label="Auto-Refresh Dashboard" help="Automatically refresh Executive Dashboard every 5 minutes">
              <Toggle value={settings.autoRefreshDashboard} onChange={v => update("autoRefreshDashboard", v)} />
            </Field>
            <Field label="Show All Modules" help="Show all module analytics regardless of role">
              <Toggle value={settings.showAllModules} onChange={v => update("showAllModules", v)} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Alerts & Insights">
          <div className="px-5">
            <Field label="Alerts Center Enabled" help="Show threshold-based alerts from all modules">
              <Toggle value={settings.alertsEnabled} onChange={v => update("alertsEnabled", v)} />
            </Field>
            <Field label="AI Insights Enabled" help="Generate rules-based insights on your data">
              <Toggle value={settings.insightsEnabled} onChange={v => update("insightsEnabled", v)} />
            </Field>
          </div>
        </SectionCard>

        <div className="flex flex-col gap-3">
          <SectionCard title="Actions">
            <div className="p-5 space-y-3">
              <button onClick={save} className="btn-primary w-full gap-2 justify-center">
                <Save size={15} /> {saved ? "Settings Saved!" : "Save Settings"}
              </button>
              <button onClick={reset} className="btn-secondary w-full text-sm gap-2 justify-center">
                Reset to Defaults
              </button>
            </div>
          </SectionCard>

          <SectionCard title="About BI Module">
            <div className="p-5 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex justify-between"><span>Module</span><span className="font-semibold text-slate-700 dark:text-slate-300">Business Intelligence</span></div>
              <div className="flex justify-between"><span>Version</span><span className="font-semibold text-slate-700 dark:text-slate-300">1.0.0</span></div>
              <div className="flex justify-between"><span>Data Source</span><span className="font-semibold text-slate-700 dark:text-slate-300">OmniSuite ERP</span></div>
              <div className="flex justify-between"><span>Modules Integrated</span><span className="font-semibold text-slate-700 dark:text-slate-300">11 Modules</span></div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
