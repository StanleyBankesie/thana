import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client.js";
import { toast } from "react-toastify";
import { useAuth } from "../../../auth/AuthContext.jsx";
import { Brain, Sparkles, CheckCircle, ShieldCheck } from "lucide-react";

export default function GeneralSettingsPage() {
  const { user } = useAuth();
  const [cloud, setCloud] = useState({ cloud_name: "", api_key: "", api_secret: "", folder: "", has_secret: false });
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [emailTestTo, setEmailTestTo] = useState("");
  const [emailTesting, setEmailTesting] = useState(false);
  const [loginBackgroundUrl, setLoginBackgroundUrl] = useState("");
  const [loginBackgroundVersion, setLoginBackgroundVersion] = useState("");
  const [loginBackgroundSaving, setLoginBackgroundSaving] = useState(false);
  const [inactivityTimeout, setInactivityTimeout] = useState(() => {
    try {
      if (typeof localStorage !== "undefined") {
        const val = localStorage.getItem("omnisuite.inactivityTimeout");
        if (val !== null) return val;
      }
    } catch {}
    return "60";
  });

  const [envVars, setEnvVars] = useState({
    ARKESEL_API_KEY: "",
    ARKESEL_SENDER_ID: "",
    GREEN_API_ID_INSTANCE: "",
    GREEN_API_TOKEN_INSTANCE: "",
    SMTP_HOST: "",
    SMTP_PORT: "",
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM: "",
    SMTP_SECURE: "false",
    TEMPLATE_SALES_ORDER: "",
    TEMPLATE_PURCHASE_ORDER: "",
    TEMPLATE_SERVICE_ORDER: "",
    TEMPLATE_MAINTENANCE_JOB: "",
    TEMPLATE_PAYMENT_VOUCHER: "",
  });
  const [announcements, setAnnouncements] = useState("");
  const [announcementsSaving, setAnnouncementsSaving] = useState(false);
  const [envLoading, setEnvLoading] = useState(false);
  const [envSaving, setEnvSaving] = useState(false);
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState("");
  const [googleMapsLoading, setGoogleMapsLoading] = useState(false);
  const [googleMapsSaving, setGoogleMapsSaving] = useState(false);

  // AI Configuration State (Groq & OpenRouter / 0x Alpha)
  const [groqKey, setGroqKey] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [aiStatus, setAiStatus] = useState(null);
  const [groqSaving, setGroqSaving] = useState(false);
  const [groqTesting, setGroqTesting] = useState(false);
  const [openRouterSaving, setOpenRouterSaving] = useState(false);
  const [openRouterTesting, setOpenRouterTesting] = useState(false);
  const [selectedAiModel, setSelectedAiModel] = useState("openai/gpt-oss-120b");
  const [banksAiEnabled, setBanksAiEnabled] = useState(() => {
    try {
      const val = localStorage.getItem("omnisuite.banks_ai_enabled");
      if (val !== null) return val === "true";
    } catch {}
    return true;
  });

  async function toggleBanksAi(checked) {
    setBanksAiEnabled(checked);
    try {
      localStorage.setItem("omnisuite.banks_ai_enabled", String(checked));
      window.dispatchEvent(
        new CustomEvent("omni.banks_ai.visibility", {
          detail: { enabled: checked },
        }),
      );
      await api.post("/ai/toggle-visibility", { enabled: checked });
      toast.success(
        checked
          ? "Ask Banks AI floating assistant is now enabled and visible."
          : "Ask Banks AI floating assistant is now disabled and hidden.",
      );
    } catch (e) {
      toast.error("Failed to update Ask Banks visibility");
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCloudLoading(true);
        const res = await api.get("/admin/settings/cloudinary");
        const d = res?.data?.data || {};
        if (!mounted) return;
        setCloud(p => ({ ...p, cloud_name: d.cloud_name || "", api_key: d.api_key || "", folder: d.folder || "", has_secret: !!d.has_secret }));
      } catch {} finally { if (mounted) setCloudLoading(false); }
    })();

    (async () => {
      try {
        setEnvLoading(true);
        const res = await api.get("/admin/settings/env");
        if (!mounted) return;
        setEnvVars({
          ARKESEL_API_KEY: res.data.ARKESEL_API_KEY || "",
          ARKESEL_SENDER_ID: res.data.ARKESEL_SENDER_ID || "",
          GREEN_API_ID_INSTANCE: res.data.GREEN_API_ID_INSTANCE || "",
          GREEN_API_TOKEN_INSTANCE: res.data.GREEN_API_TOKEN_INSTANCE || "",
          SMTP_HOST: res.data.SMTP_HOST || "",
          SMTP_PORT: res.data.SMTP_PORT || "",
          SMTP_USER: res.data.SMTP_USER || "",
          SMTP_PASS: res.data.SMTP_PASS || "",
          SMTP_FROM: res.data.SMTP_FROM || "",
          SMTP_SECURE: res.data.SMTP_SECURE || "false",
          TEMPLATE_SALES_ORDER: res.data.TEMPLATE_SALES_ORDER || "",
          TEMPLATE_PURCHASE_ORDER: res.data.TEMPLATE_PURCHASE_ORDER || "",
          TEMPLATE_SERVICE_ORDER: res.data.TEMPLATE_SERVICE_ORDER || "",
          TEMPLATE_MAINTENANCE_JOB: res.data.TEMPLATE_MAINTENANCE_JOB || "",
          TEMPLATE_PAYMENT_VOUCHER: res.data.TEMPLATE_PAYMENT_VOUCHER || "",
        });
      } catch (err) {
        toast.error("Failed to load environment variables.");
      } finally {
        if (mounted) setEnvLoading(false);
      }
    })();

    (async () => {
      try {
        setGoogleMapsLoading(true);
        const res = await api.get("/admin/settings/google-maps");
        if (mounted && res?.data?.data?.api_key) {
          setGoogleMapsApiKey(res.data.data.api_key);
        }
      } catch {} finally { if (mounted) setGoogleMapsLoading(false); }
    })();

    (async () => {
      try {
        const res = await api.get("/ai/status");
        if (mounted && res.data) {
          setAiStatus(res.data);
          if (res.data.defaultModel) setSelectedAiModel(res.data.defaultModel);
          if (res.data.enabled !== undefined) {
            setBanksAiEnabled(Boolean(res.data.enabled));
            try {
              localStorage.setItem("omnisuite.banks_ai_enabled", String(res.data.enabled));
            } catch {}
          }
        }
      } catch {}
    })();

    (async () => {
      try {
        const res = await api.get("/admin/settings/announcements");
        if (mounted && res?.data?.announcements !== undefined) {
          setAnnouncements(res.data.announcements);
        }
      } catch {}
    })();

    return () => { mounted = false; };
  }, []);

  async function saveGroqSettings() {
    if (!groqKey.trim()) return;
    try {
      setGroqSaving(true);
      const res = await api.post("/ai/save-key", { apiKey: groqKey.trim() });
      toast.success(res.data?.message || "Groq AI Key verified and saved successfully!");
      setGroqKey("");
      const statusRes = await api.get("/ai/status");
      setAiStatus(statusRes.data);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to verify Groq key");
    } finally {
      setGroqSaving(false);
    }
  }

  async function saveOpenRouterSettings() {
    if (!openRouterKey.trim()) return;
    try {
      setOpenRouterSaving(true);
      const res = await api.post("/ai/save-openrouter-key", { apiKey: openRouterKey.trim() });
      toast.success(res.data?.message || "OpenRouter (0x Alpha) Key verified and saved successfully!");
      setOpenRouterKey("");
      const statusRes = await api.get("/ai/status");
      setAiStatus(statusRes.data);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to verify OpenRouter key");
    } finally {
      setOpenRouterSaving(false);
    }
  }

  async function testGroqConnection() {
    try {
      setGroqTesting(true);
      const res = await api.get("/ai/status");
      if (res.data?.groq?.connected) {
        toast.success("Groq Cloud AI Engine is connected and responding!");
      } else {
        toast.warn(res.data?.groq?.statusMessage || "Groq API key is not configured.");
      }
      setAiStatus(res.data);
    } catch (e) {
      toast.error("Failed to test connection to Groq API.");
    } finally {
      setGroqTesting(false);
    }
  }

  async function testOpenRouterConnection() {
    try {
      setOpenRouterTesting(true);
      const res = await api.get("/ai/status");
      if (res.data?.openRouter?.connected) {
        toast.success("OpenRouter (0x Alpha) AI Engine is connected and responding!");
      } else {
        toast.warn(res.data?.openRouter?.statusMessage || "OpenRouter API key is not configured.");
      }
      setAiStatus(res.data);
    } catch (e) {
      toast.error("Failed to test connection to OpenRouter API.");
    } finally {
      setOpenRouterTesting(false);
    }
  }

  async function loadLoginBackgroundMeta() {
    try {
      const res = await api.get("/admin/settings/login-bg-info");
      if (res.data) {
        const hasBackground = !!res?.data?.hasBackground;
        const version = res?.data?.version ? `?v=${res.data.version}` : "";
        setLoginBackgroundUrl(hasBackground ? `/api/admin/settings/login-background${version}` : "");
        setLoginBackgroundVersion(res?.data?.version || "");
      }
    } catch {
      setLoginBackgroundUrl("");
      setLoginBackgroundVersion("");
    }
  }

  useEffect(() => { loadLoginBackgroundMeta(); }, []);

  async function uploadLoginBackground(file) {
    if (!file) return;
    try {
      setLoginBackgroundSaving(true);
      let uploadFile = file;
      if (file.size > 300 * 1024) {
        const compressed = await new Promise((resolve) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(url);
            let w = img.naturalWidth, h = img.naturalHeight;
            const maxDim = 1920;
            if (w > maxDim || h > maxDim) {
              if (w > h) { h = (h / w) * maxDim; w = maxDim; }
              else { w = (w / h) * maxDim; h = maxDim; }
            }
            const c = document.createElement("canvas");
            c.width = w; c.height = h;
            const ctx = c.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            c.toBlob(blob => resolve(blob), "image/jpeg", 0.8);
          };
          img.src = url;
        });
        uploadFile = new File([compressed], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
      }
      const fd = new FormData();
      fd.append("background", uploadFile);
      await api.post("/admin/settings/login-background", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Login background updated");
      await loadLoginBackgroundMeta();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to update login background");
    } finally { setLoginBackgroundSaving(false); }
  }

  async function clearLoginBackground() {
    try {
      setLoginBackgroundSaving(true);
      await api.delete("/admin/settings/login-background");
      setLoginBackgroundUrl("");
      setLoginBackgroundVersion("");
      toast.success("Login background reset");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to reset login background");
    } finally { setLoginBackgroundSaving(false); }
  }

  async function saveCloudinary() {
    try {
      setCloudSaving(true);
      await api.post("/admin/settings/cloudinary", {
        cloud_name: cloud.cloud_name, api_key: cloud.api_key,
        api_secret: cloud.api_secret || undefined, folder: cloud.folder || undefined,
      });
      toast.success("Cloudinary settings saved");
      setCloud(p => ({ ...p, has_secret: true, api_secret: "" }));
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to save settings");
    } finally { setCloudSaving(false); }
  }

  async function sendTestEmail() {
    try {
      setEmailTesting(true);
      const res = await api.post("/admin/email/test", { to: emailTestTo || undefined });
      const configured = !!res?.data?.configured;
      const sent = !!res?.data?.sent;
      const error = res?.data?.error;
      if (sent) {
        toast.success(`Test email sent to ${res?.data?.to || emailTestTo || "your address"}`);
      } else if (!configured) {
        toast.error("SMTP is not configured. Set SMTP_HOST and credentials first.");
      } else {
        toast.error(error ? `Failed to send: ${error}` : "Failed to send test email");
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Failed to send test email";
      toast.error(msg);
    } finally {
      setEmailTesting(false);
    }
  }

  async function saveAnnouncements() {
    try {
      setAnnouncementsSaving(true);
      await api.post("/admin/settings/announcements", { announcements });
      toast.success("Announcements saved successfully.");
    } catch (e) {
      toast.error("Failed to save announcements");
    } finally {
      setAnnouncementsSaving(false);
    }
  }

  async function saveEnvVars() {
    try {
      setEnvSaving(true);
      await api.post("/admin/settings/env", envVars);
      toast.success("Environment configurations saved successfully.");
      
      const res = await api.get("/admin/settings/env");
      setEnvVars(prev => ({
        ...prev,
        ARKESEL_API_KEY: res.data.ARKESEL_API_KEY || "",
        ARKESEL_SENDER_ID: res.data.ARKESEL_SENDER_ID || "",
        GREEN_API_TOKEN_INSTANCE: res.data.GREEN_API_TOKEN_INSTANCE || "",
        SMTP_PASS: res.data.SMTP_PASS || ""
      }));
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to save environment variables");
    } finally {
      setEnvSaving(false);
    }
  }

  async function saveGoogleMaps() {
    try {
      setGoogleMapsSaving(true);
      await api.post("/admin/settings/google-maps", { api_key: googleMapsApiKey });
      toast.success("Google Maps settings saved");
      const res = await api.get("/admin/settings/google-maps");
      if (res?.data?.data?.api_key) {
        setGoogleMapsApiKey(res.data.data.api_key);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to save settings");
    } finally { setGoogleMapsSaving(false); }
  }

  async function saveGroqSettings() {
    if (!groqKey.trim()) return;
    try {
      setGroqSaving(true);
      const res = await api.post("/ai/save-key", { apiKey: groqKey.trim() });
      toast.success(res.data?.message || "Groq AI Key verified and saved successfully!");
      setGroqKey("");
      const statusRes = await api.get("/ai/status");
      setGroqStatus(statusRes.data);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to verify Groq key");
    } finally {
      setGroqSaving(false);
    }
  }

  async function testGroqConnection() {
    try {
      setGroqTesting(true);
      const res = await api.get("/ai/status");
      if (res.data?.connected) {
        toast.success("Groq Cloud AI Engine is connected and responding!");
      } else {
        toast.warn(res.data?.statusMessage || "Groq API key is not yet configured.");
      }
      setGroqStatus(res.data);
    } catch (e) {
      toast.error("Failed to test connection to Groq API.");
    } finally {
      setGroqTesting(false);
    }
  }

  if (user?.id !== 1) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <h2 className="text-xl font-bold mb-2 text-slate-700">Access Denied</h2>
        <p className="text-sm">You do not have permission to view System Configurations.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <div className="text-xs text-slate-500 mb-1">
          <Link to="/system-configuration" className="text-brand-600 hover:underline">System Configuration</Link> / General Settings
        </div>
        <h1 className="text-2xl font-bold text-slate-800">General Settings</h1>
        <p className="text-sm text-slate-500">Manage environment configurations, API integrations, AI copilot, and system defaults.</p>
      </div>

      <div className="space-y-6">
        {/* Banks AI Dual-Provider Configuration (Groq + OpenRouter 0x Alpha) */}
        <div className="card border-brand-200 dark:border-brand-800 shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/80">
          <div className="card-body space-y-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-900 text-white flex items-center justify-center shadow-inner">
                  <Brain size={22} className="text-primary animate-pulse" />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span>Banks AI Intelligence Engine (Groq + OpenRouter 0x Alpha)</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Configure API keys for Groq (high-speed LPU) and OpenRouter (0x Alpha / free failover engine with 1M token context).
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {aiStatus?.groq?.connected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle size={12} className="text-emerald-500" /> Groq Active ({aiStatus.groq.maskedKey})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-800">
                    Groq Unset
                  </span>
                )}

                {aiStatus?.openRouter?.connected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full border border-purple-300 dark:border-purple-800">
                    <CheckCircle size={12} className="text-purple-500" /> 0x Alpha Active ({aiStatus.openRouter.maskedKey})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full border border-slate-300 dark:border-slate-700">
                    0x Alpha Unset
                  </span>
                )}
              </div>
            </div>

            {/* Ask Banks Global Visibility Switch */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-brand-50/60 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800/60">
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Sparkles size={16} className="text-primary" />
                  <span>Floating "Ask Banks" AI Button Visibility</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  When enabled, the floating "Ask Banks" button is visible across the entire application. When disabled, the floating button is hidden.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={banksAiEnabled}
                  onChange={(e) => toggleBanksAi(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Groq Cloud Key Card */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                    1. Groq Cloud API Key (Primary Fast Engine)
                  </span>
                  {aiStatus?.groq?.connected && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">● Connected</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter gsk_... key"
                    className="input w-full text-xs"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    disabled={groqSaving}
                  />
                  <button
                    type="button"
                    className="btn-primary whitespace-nowrap text-xs px-3.5"
                    onClick={saveGroqSettings}
                    disabled={groqSaving || !groqKey.trim()}
                  >
                    {groqSaving ? "Saving..." : "Save Groq Key"}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Get free key at <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-brand-600 dark:text-brand-400 underline font-medium">console.groq.com/keys</a></span>
                  <button
                    type="button"
                    className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
                    onClick={testGroqConnection}
                    disabled={groqTesting}
                  >
                    {groqTesting ? "Testing..." : "Test Groq"}
                  </button>
                </div>
              </div>

              {/* OpenRouter 0x Alpha Key Card */}
              <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/20 dark:bg-purple-950/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider">
                    2. OpenRouter API Key (0x Alpha / Failover)
                  </span>
                  {aiStatus?.openRouter?.connected && (
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">● Connected</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter sk-or-v1-... key"
                    className="input w-full text-xs"
                    value={openRouterKey}
                    onChange={(e) => setOpenRouterKey(e.target.value)}
                    disabled={openRouterSaving}
                  />
                  <button
                    type="button"
                    className="btn-primary bg-purple-600 hover:bg-purple-700 border-none text-white whitespace-nowrap text-xs px-3.5"
                    onClick={saveOpenRouterSettings}
                    disabled={openRouterSaving || !openRouterKey.trim()}
                  >
                    {openRouterSaving ? "Saving..." : "Save 0x Alpha Key"}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Get OpenRouter key at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-purple-600 dark:text-purple-400 underline font-medium">openrouter.ai/keys</a></span>
                  <button
                    type="button"
                    className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                    onClick={testOpenRouterConnection}
                    disabled={openRouterTesting}
                  >
                    {openRouterTesting ? "Testing..." : "Test OpenRouter"}
                  </button>
                </div>
              </div>
            </div>

            {/* Model Selection & Auto-Failover Summary */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Default AI Model Preference
                </label>
                <select
                  value={selectedAiModel}
                  onChange={(e) => setSelectedAiModel(e.target.value)}
                  className="input w-full text-xs"
                >
                  <optgroup label="🚀 OpenRouter (0x Alpha & Free Models)">
                    <option value="stealth/ox-alpha">0x Alpha (stealth/ox-alpha: 1M Context, High Reasoning & Tools)</option>
                    <option value="openrouter/free">OpenRouter Free Auto-Router (Dynamic Free Tool Engine)</option>
                    <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B Instruct [OpenRouter Free Tier]</option>
                    <option value="qwen/qwen-2.5-72b-instruct:free">Qwen 2.5 72B Instruct [OpenRouter Free Tier]</option>
                  </optgroup>
                  <optgroup label="⚡ Groq Cloud High Speed Models">
                    <option value="openai/gpt-oss-120b">GPT-OSS 120B (Best: Deep ERP Reasoning & Tools)</option>
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Meta Flagship)</option>
                    <option value="qwen/qwen3.6-27b">Qwen 3.6 27B (High Efficiency & Code Reasoning)</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Ultra-Fast)</option>
                  </optgroup>
                </select>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  <span>Smart Auto-Failover Active</span>
                </div>
                <p>
                  If Groq reaches its daily free token quota (HTTP 429), Banks AI automatically routes prompts to OpenRouter <strong>0x Alpha</strong> with zero user downtime.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-4">
            <div>
              <div className="text-lg font-semibold">Global Broadcast / Announcements</div>
              <div className="text-sm text-slate-500">Post a message that displays on the dashboard or header for all system users.</div>
            </div>
            <div>
              <textarea
                className="input w-full h-24 resize-none"
                placeholder="e.g. System maintenance scheduled for tonight at 11:00 PM."
                value={announcements}
                onChange={e => setAnnouncements(e.target.value)}
                disabled={announcementsSaving}
              />
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={saveAnnouncements} disabled={announcementsSaving}>
                {announcementsSaving ? "Saving..." : "Save Announcement"}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-4">
            <div>
              <div className="text-lg font-semibold">Communication & Service Credentials</div>
              <div className="text-sm text-slate-500">Configure external API integrations and keys for SMS, WhatsApp, and Mail.</div>
            </div>

            {envLoading ? (
              <div className="text-sm text-slate-500">Loading configurations...</div>
            ) : (
              <div className="space-y-4">
                <div className="border-b pb-3">
                  <div className="font-medium text-slate-700 mb-2">Arkesel SMS Gateway</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700">API Key</label>
                      <input type="password" placeholder={envVars.ARKESEL_API_KEY === "********" ? "•••••••• (unchanged)" : ""} className="input w-full" value={envVars.ARKESEL_API_KEY === "********" ? "" : envVars.ARKESEL_API_KEY} onChange={e => setEnvVars(p => ({ ...p, ARKESEL_API_KEY: e.target.value }))} disabled={envSaving} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">Sender ID</label>
                      <input type="text" placeholder={envVars.ARKESEL_SENDER_ID === "********" ? "•••••••• (unchanged)" : ""} className="input w-full" value={envVars.ARKESEL_SENDER_ID === "********" ? "" : envVars.ARKESEL_SENDER_ID} onChange={e => setEnvVars(p => ({ ...p, ARKESEL_SENDER_ID: e.target.value }))} disabled={envSaving} />
                    </div>
                  </div>
                </div>

                <div className="border-b pb-3">
                  <div className="font-medium text-slate-700 mb-2">Green API (WhatsApp)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700">ID Instance</label>
                      <input type="text" className="input w-full" value={envVars.GREEN_API_ID_INSTANCE} onChange={e => setEnvVars(p => ({ ...p, GREEN_API_ID_INSTANCE: e.target.value }))} disabled={envSaving} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">Token Instance</label>
                      <input type="password" placeholder={envVars.GREEN_API_TOKEN_INSTANCE === "********" ? "•••••••• (unchanged)" : ""} className="input w-full" value={envVars.GREEN_API_TOKEN_INSTANCE === "********" ? "" : envVars.GREEN_API_TOKEN_INSTANCE} onChange={e => setEnvVars(p => ({ ...p, GREEN_API_TOKEN_INSTANCE: e.target.value }))} disabled={envSaving} />
                    </div>
                  </div>
                </div>

                <div className="border-b pb-3">
                  <div className="font-medium text-slate-700 mb-2">SMTP Mail Configuration</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700">Host</label>
                      <input type="text" className="input w-full" value={envVars.SMTP_HOST} onChange={e => setEnvVars(p => ({ ...p, SMTP_HOST: e.target.value }))} disabled={envSaving} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">Port</label>
                      <input type="text" className="input w-full" value={envVars.SMTP_PORT} onChange={e => setEnvVars(p => ({ ...p, SMTP_PORT: e.target.value }))} disabled={envSaving} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">Secure (SSL/TLS)</label>
                      <select className="input w-full" value={envVars.SMTP_SECURE} onChange={e => setEnvVars(p => ({ ...p, SMTP_SECURE: e.target.value }))} disabled={envSaving}>
                        <option value="false">False (Port 587)</option>
                        <option value="true">True (Port 465)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">Username</label>
                      <input type="text" className="input w-full" value={envVars.SMTP_USER} onChange={e => setEnvVars(p => ({ ...p, SMTP_USER: e.target.value }))} disabled={envSaving} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">Password</label>
                      <input type="password" placeholder={envVars.SMTP_PASS === "********" ? "•••••••• (unchanged)" : ""} className="input w-full" value={envVars.SMTP_PASS === "********" ? "" : envVars.SMTP_PASS} onChange={e => setEnvVars(p => ({ ...p, SMTP_PASS: e.target.value }))} disabled={envSaving} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-700">From Address</label>
                      <input type="text" className="input w-full" value={envVars.SMTP_FROM} onChange={e => setEnvVars(p => ({ ...p, SMTP_FROM: e.target.value }))} disabled={envSaving} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="font-medium text-slate-700">Messaging Templates</div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Sales Order Template</label>
                    <textarea className="input w-full h-24 resize-none" value={envVars.TEMPLATE_SALES_ORDER} onChange={e => setEnvVars(p => ({ ...p, TEMPLATE_SALES_ORDER: e.target.value }))} disabled={envSaving}></textarea>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Purchase Order Template</label>
                    <textarea className="input w-full h-24 resize-none" value={envVars.TEMPLATE_PURCHASE_ORDER} onChange={e => setEnvVars(p => ({ ...p, TEMPLATE_PURCHASE_ORDER: e.target.value }))} disabled={envSaving}></textarea>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Service Order Template</label>
                    <textarea className="input w-full h-24 resize-none" value={envVars.TEMPLATE_SERVICE_ORDER} onChange={e => setEnvVars(p => ({ ...p, TEMPLATE_SERVICE_ORDER: e.target.value }))} disabled={envSaving}></textarea>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Maintenance Job Template</label>
                    <textarea className="input w-full h-24 resize-none" value={envVars.TEMPLATE_MAINTENANCE_JOB} onChange={e => setEnvVars(p => ({ ...p, TEMPLATE_MAINTENANCE_JOB: e.target.value }))} disabled={envSaving}></textarea>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Payment Voucher Template</label>
                    <textarea className="input w-full h-24 resize-none" value={envVars.TEMPLATE_PAYMENT_VOUCHER} onChange={e => setEnvVars(p => ({ ...p, TEMPLATE_PAYMENT_VOUCHER: e.target.value }))} disabled={envSaving}></textarea>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-primary bg-green-600 hover:bg-green-700 border-none text-white" onClick={saveEnvVars} disabled={envSaving}>
                {envSaving ? "Saving..." : "Save Credentials"}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-3">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="text-lg font-semibold">Login Background Image</div>
                <div className="text-sm text-slate-500">Set the background image for the login and password reset forms.</div>
              </div>
              {loginBackgroundUrl && (
                <img src={loginBackgroundUrl} alt="Login Background" className="h-20 w-auto rounded border border-slate-200" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="btn-primary cursor-pointer">
                {loginBackgroundSaving ? "Saving..." : "Upload Background"}
                <input type="file" accept="image/*" className="hidden" disabled={loginBackgroundSaving} onChange={e => { const file = e.target.files?.[0] || null; e.target.value = ""; uploadLoginBackground(file); }} />
              </label>
              <button type="button" className="btn-outline" disabled={loginBackgroundSaving || !loginBackgroundUrl} onClick={clearLoginBackground}>Reset to Default</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-3">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="text-lg font-semibold">Security & Inactivity</div>
                <div className="text-sm text-slate-500">Set how many minutes until an inactive user is automatically logged out. Set to 0 to disable.</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input type="number" min="0" className="input w-32" value={inactivityTimeout}
                onChange={e => { const val = e.target.value; setInactivityTimeout(val); try { if (typeof localStorage !== "undefined") localStorage.setItem("omnisuite.inactivityTimeout", val); } catch {} }} />
              <span className="text-sm text-slate-600">minutes</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-3">
            <div className="text-lg font-semibold">Email</div>
            <div className="text-sm text-slate-500">Send a test email to verify SMTP settings.</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Recipient</label>
                <input className="input w-full" value={emailTestTo} onChange={e => setEmailTestTo(e.target.value)} placeholder="user@example.com (optional)" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" onClick={sendTestEmail} disabled={emailTesting}>{emailTesting ? "Sending..." : "Send Test Email"}</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-3">
            <div className="text-lg font-semibold">Cloudinary Storage</div>
            <div className="text-sm text-slate-500">Store attachments in Cloudinary; links are saved to document records.</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Cloud Name</label>
                <input className="input w-full" value={cloud.cloud_name} onChange={e => setCloud(p => ({ ...p, cloud_name: e.target.value }))} disabled={cloudLoading || cloudSaving} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">API Key</label>
                <input className="input w-full" value={cloud.api_key} onChange={e => setCloud(p => ({ ...p, api_key: e.target.value }))} disabled={cloudLoading || cloudSaving} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">API Secret</label>
                <input type="password" placeholder={cloud.has_secret && !cloud.api_secret ? "•••••••• (unchanged)" : ""} className="input w-full" value={cloud.api_secret} onChange={e => setCloud(p => ({ ...p, api_secret: e.target.value }))} disabled={cloudLoading || cloudSaving} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Folder (optional)</label>
                <input className="input w-full" value={cloud.folder} onChange={e => setCloud(p => ({ ...p, folder: e.target.value }))} disabled={cloudLoading || cloudSaving} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" onClick={saveCloudinary} disabled={cloudSaving}>{cloudSaving ? "Saving..." : "Save Cloudinary Settings"}</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-3">
            <div>
              <div className="text-lg font-semibold">Google Maps</div>
              <div className="text-sm text-slate-500">Enter your Google Maps API Key to enable map features.</div>
            </div>
            {googleMapsLoading ? <div className="text-sm text-slate-500">Loading...</div> : (
              <div className="max-w-md space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">API Key</label>
                  <input type="text" className="input w-full" placeholder="AIzaSy..." value={googleMapsApiKey} onChange={e => setGoogleMapsApiKey(e.target.value)} disabled={googleMapsSaving} />
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary" disabled={googleMapsSaving} onClick={saveGoogleMaps}>
                    {googleMapsSaving ? "Saving..." : "Save Google Maps Settings"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-3">
            <div className="text-lg font-semibold">Compliance Notification Template</div>
            <div className="text-sm text-slate-500">Message template sent when a vehicle compliance document is expiring soon or expired.</div>
            <ComplianceTemplateSection />
          </div>
        </div>

        <div className="card">
          <div className="card-body space-y-3">
            <div className="text-lg font-semibold">Servicing Notification Template</div>
            <div className="text-sm text-slate-500">Message template sent when a vehicle is due for servicing.</div>
            <ServicingTemplateSection />
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplianceTemplateSection() {
  const [template, setTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await api.get("/transport/templates/compliance");
        setTemplate(res.data?.template || "");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      await api.put("/transport/templates/compliance", { template });
      toast.success("Compliance template updated");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update compliance template");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading template...</div>;

  return (
    <div className="space-y-3">
      <textarea
        className="input w-full h-24"
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        placeholder="Enter template..."
      />
      <div className="flex justify-between items-center text-xs text-slate-500">
        <div>Variables: {"{registration_number}"}, {"{compliance_type}"}, {"{expiry_date}"}, {"{days_left}"}</div>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Template"}
        </button>
      </div>
    </div>
  );
}

function ServicingTemplateSection() {
  const [template, setTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await api.get("/transport/templates/servicing");
        setTemplate(res.data?.template || "");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      await api.put("/transport/templates/servicing", { template });
      toast.success("Servicing template updated");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update servicing template");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading template...</div>;

  return (
    <div className="space-y-3">
      <textarea
        className="input w-full h-24"
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        placeholder="Enter template..."
      />
      <div className="flex justify-between items-center text-xs text-slate-500">
        <div>Variables: {"{registration_number}"}, {"{current_mileage}"}, {"{next_service_mileage}"}, {"{due_date}"}</div>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Template"}
        </button>
      </div>
    </div>
  );
}
