import React, { useState, useEffect, useRef } from "react";
import { api } from "../api/client.js";
import { toast } from "react-toastify";
import {
  Image as ImageIcon,
  Sparkles,
  Upload,
  Check,
  RotateCcw,
  Sliders,
  Layers,
  Eye,
  Trash2,
  ExternalLink,
} from "lucide-react";

export const BACKGROUND_PRESETS = [
  {
    id: "silk-waves",
    name: "Silk Waves",
    subtitle: "Recommended",
    description: "Translucent frosted 3D silk ribbons in deep indigo & cyan",
    url: "/backgrounds/abstract-silk-waves.jpg",
    previewUrl: "/backgrounds/abstract-silk-waves.jpg",
    theme: "Dark & Vibrant",
  },
  {
    id: "pastel-silk",
    name: "Pastel Silk",
    subtitle: "Ethereal Flow",
    description: "Translucent frosted violet & sky blue ribbons on pearlescent backdrop",
    url: "/backgrounds/pastel-silk-waves.jpg",
    previewUrl: "/backgrounds/pastel-silk-waves.jpg",
    theme: "Pastel Iridescent",
  },
  {
    id: "amber-apricot",
    name: "Amber Apricot",
    subtitle: "Warm Luster",
    description: "Luminous flowing golden apricot waveforms on warm cream backdrop",
    url: "/backgrounds/amber-apricot-flow.jpg",
    previewUrl: "/backgrounds/amber-apricot-flow.jpg",
    theme: "Warm Apricot",
  },
  {
    id: "cyber-nexus",
    name: "Cyber Nexus",
    subtitle: "Dark Tech",
    description: "Deep navy digital space with glowing amber network constellations & orbital rings",
    url: "/backgrounds/cyber-nexus-dark.jpg",
    previewUrl: "/backgrounds/cyber-nexus-dark.jpg",
    theme: "Dark Cybernetic",
  },
  {
    id: "digital-aura",
    name: "Digital Aura",
    subtitle: "Light Tech",
    description: "Warm ivory background with vibrant golden cybernetic ribbons & constellation mesh",
    url: "/backgrounds/digital-aura-light.jpg",
    previewUrl: "/backgrounds/digital-aura-light.jpg",
    theme: "Light Cybernetic",
  },
  {
    id: "none",
    name: "Clean Solid",
    subtitle: "Classic",
    description: "No background image (minimalist clean slate background)",
    url: "",
    previewUrl: null,
    theme: "Solid Color",
  },
];

export default function AppBackgroundControlSection() {
  const [selectedPreset, setSelectedPreset] = useState("silk-waves");
  const [backgroundUrl, setBackgroundUrl] = useState("/backgrounds/abstract-silk-waves.jpg");
  const [opacity, setOpacity] = useState(40);
  const [blur, setBlur] = useState(0);
  const [hasCustom, setHasCustom] = useState(false);
  const [customUrl, setCustomUrl] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fileInputRef = useRef(null);

  // Load existing configuration from backend
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setIsLoading(true);
        const res = await api.get("/admin/settings/app-background");
        if (mounted && res.data?.success) {
          const d = res.data;
          let preset = d.background_preset || "silk-waves";
          let bgUrl = d.background_url || "";
          if (preset === "midnight-flow" || bgUrl.includes("txb3zy")) {
            preset = "cyber-nexus";
            bgUrl = "/backgrounds/cyber-nexus-dark.jpg";
          } else if (preset === "amber-luster" || preset === "aurora-glow" || bgUrl.includes("hsy20i") || bgUrl.includes("abstract-aurora-glow")) {
            preset = "amber-apricot";
            bgUrl = "/backgrounds/amber-apricot-flow.jpg";
          } else if (preset === "slate-horizon" || preset === "geometric-cubes" || bgUrl.includes("5eegyy") || bgUrl.includes("abstract-geometric-cubes")) {
            preset = "digital-aura";
            bgUrl = "/backgrounds/digital-aura-light.jpg";
          }
          setSelectedPreset(preset);
          setBackgroundUrl(bgUrl);
          setOpacity(Number.isFinite(d.background_opacity) ? d.background_opacity : 40);
          setBlur(Number.isFinite(d.background_blur) ? d.background_blur : 0);
          setHasCustom(Boolean(d.has_custom));
          setCustomUrl(d.custom_url || null);
          if (preset === "custom" && d.background_url && !d.background_url.includes("/api/admin/settings/app-background/image")) {
            setUrlInput(d.background_url);
          }
        }
      } catch (err) {
        console.error("Failed to load app background settings:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const broadcastAndStore = (data) => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("omnisuite.app_background", JSON.stringify(data));
      }
      window.dispatchEvent(
        new CustomEvent("app-background-changed", {
          detail: { background: data },
        })
      );
    } catch {}
  };

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset.id);
    setBackgroundUrl(preset.url);
    if (preset.id !== "custom") {
      setUrlInput("");
    }
    // Instant preview broadcast
    broadcastAndStore({
      url: preset.url,
      preset: preset.id,
      opacity,
      blur,
    });
  };

  const handleOpacityChange = (newVal) => {
    const val = Number(newVal);
    setOpacity(val);
    broadcastAndStore({
      url: backgroundUrl,
      preset: selectedPreset,
      opacity: val,
      blur,
    });
  };

  const handleBlurChange = (newVal) => {
    const val = Number(newVal);
    setBlur(val);
    broadcastAndStore({
      url: backgroundUrl,
      preset: selectedPreset,
      opacity,
      blur: val,
    });
  };

  const handleCustomUrlApply = () => {
    const trimmed = String(urlInput || "").trim();
    if (!trimmed) {
      toast.warning("Please enter a valid image URL");
      return;
    }
    setSelectedPreset("custom");
    setBackgroundUrl(trimmed);
    broadcastAndStore({
      url: trimmed,
      preset: "custom",
      opacity,
      blur,
    });
    toast.info("Custom image URL applied to preview. Remember to click Save.");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file is too large (Maximum allowed size is 10MB)");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
      setIsUploading(true);
      const res = await api.post("/admin/settings/app-background/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success) {
        const newUrl = res.data.background_url;
        setSelectedPreset("custom");
        setBackgroundUrl(newUrl);
        setHasCustom(true);
        setCustomUrl(newUrl);
        broadcastAndStore({
          url: newUrl,
          preset: "custom",
          opacity,
          blur,
          hasCustom: true,
          customUrl: newUrl,
        });
        toast.success("Custom background image uploaded and applied successfully!");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to upload custom background image";
      toast.error(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveCustom = async () => {
    try {
      const res = await api.delete("/admin/settings/app-background/custom");
      if (res.data?.success) {
        setHasCustom(false);
        setCustomUrl(null);
        setSelectedPreset("silk-waves");
        const defaultUrl = "/backgrounds/abstract-silk-waves.jpg";
        setBackgroundUrl(defaultUrl);
        broadcastAndStore({
          url: defaultUrl,
          preset: "silk-waves",
          opacity,
          blur,
        });
        toast.success("Custom uploaded background removed and reset to default preset");
      }
    } catch (err) {
      toast.error("Failed to remove custom background");
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const payload = {
        background_url: backgroundUrl,
        background_preset: selectedPreset,
        background_opacity: opacity,
        background_blur: blur,
      };

      const res = await api.post("/admin/settings/app-background", payload);
      if (res.data?.success) {
        broadcastAndStore(payload);
        toast.success("Application background settings saved successfully!");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to save background settings";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    const defaultUrl = "/backgrounds/abstract-silk-waves.jpg";
    setSelectedPreset("silk-waves");
    setBackgroundUrl(defaultUrl);
    setOpacity(40);
    setBlur(0);
    setUrlInput("");
    broadcastAndStore({
      url: defaultUrl,
      preset: "silk-waves",
      opacity: 40,
      blur: 0,
    });
    toast.info("Reset to default Ethereal Silk Waves preset. Click Save to persist.");
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Application Background
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                <Sparkles className="w-3 h-3" />
                Abstract Theme
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Choose an abstract wallpaper for the application with real-time opacity and glassmorphic depth.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
            title="Reset to default Ethereal Silk Waves"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/20 transition flex items-center gap-1.5 disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
          Loading background configuration...
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Preset Cards Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Curated Abstract Presets</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Click any preset for instant live preview
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
              {BACKGROUND_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`relative rounded-xl border-2 cursor-pointer transition-all duration-200 overflow-hidden flex flex-col justify-between group ${
                      isSelected
                        ? "border-brand-600 bg-brand-50/40 dark:bg-brand-950/30 shadow-md ring-2 ring-brand-500/20"
                        : "border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow"
                    }`}
                  >
                    {/* Thumbnail Preview Banner */}
                    <div className="h-28 w-full relative bg-slate-900 overflow-hidden flex items-center justify-center">
                      {preset.previewUrl ? (
                        <img
                          src={preset.previewUrl}
                          alt={preset.name}
                          onError={(e) => {
                            if (e.target.src.endsWith(".jfif")) {
                              e.target.src = e.target.src.replace(/\.jfif$/, ".jpg");
                            }
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-400">
                          Solid Slate Theme
                        </div>
                      )}

                      {/* Selected Badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-md">
                          <Check className="w-3 h-3" />
                          <span>Active</span>
                        </div>
                      )}

                      {/* Preset Tag */}
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold">
                        {preset.theme}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {preset.name}
                          </h4>
                          {preset.subtitle && (
                            <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-1.5 py-0.5 rounded">
                              {preset.subtitle}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {preset.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Status</span>
                        <span className={isSelected ? "font-bold text-brand-600 dark:text-brand-400" : "text-slate-500"}>
                          {isSelected ? "Selected" : "Select"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Upload and URL Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Upload Custom Image Tile */}
            <div className={`p-4 rounded-xl border ${selectedPreset === "custom" && hasCustom ? "border-brand-500 bg-brand-50/20 dark:bg-brand-950/20" : "border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Upload Custom Wallpaper</span>
                </span>
                {hasCustom && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                    Custom Upload Active
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                Upload your company or brand abstract wallpaper (PNG, JPG, WebP up to 10MB).
              </p>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
                >
                  {isUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-brand-600" />
                      <span>Choose File</span>
                    </>
                  )}
                </button>

                {hasCustom && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSelectPreset({ id: "custom", url: customUrl })}
                      className="px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition"
                    >
                      Use Custom
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveCustom}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition"
                      title="Delete uploaded custom wallpaper"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Custom URL Input Tile */}
            <div className={`p-4 rounded-xl border ${selectedPreset === "custom" && !hasCustom ? "border-brand-500 bg-brand-50/20 dark:bg-brand-950/20" : "border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
                  <span>External Image Link</span>
                </span>
                <span className="text-[10px] text-slate-400">Direct HTTP/HTTPS</span>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                Paste an image URL hosted on your CDN or image server.
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/background.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={handleCustomUrlApply}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition shrink-0"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Opacity & Blur Fine-Tuning Controls */}
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/30">
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Display & Contrast Tuning
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Opacity Slider */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span>Background Visibility (Opacity)</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={opacity}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        handleOpacityChange(v);
                      }}
                      className="w-14 text-center font-mono font-bold text-xs py-0.5 px-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={opacity}
                  onChange={(e) => handleOpacityChange(e.target.value)}
                  className="w-full accent-brand-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-750 rounded-lg"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleOpacityChange(10)}
                    className={`px-1.5 py-0.5 rounded transition ${opacity === 10 ? "font-bold text-brand-600 bg-brand-50 dark:bg-brand-950/60" : "hover:text-brand-600"}`}
                  >
                    Faint (10%)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpacityChange(25)}
                    className={`px-1.5 py-0.5 rounded transition ${opacity === 25 ? "font-bold text-brand-600 bg-brand-50 dark:bg-brand-950/60" : "hover:text-brand-600"}`}
                  >
                    Subtle (25%)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpacityChange(40)}
                    className={`px-1.5 py-0.5 rounded transition ${opacity === 40 ? "font-bold text-brand-600 bg-brand-50 dark:bg-brand-950/60" : "hover:text-brand-600"}`}
                  >
                    Balanced (40%)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpacityChange(65)}
                    className={`px-1.5 py-0.5 rounded transition ${opacity === 65 ? "font-bold text-brand-600 bg-brand-50 dark:bg-brand-950/60" : "hover:text-brand-600"}`}
                  >
                    Vivid (65%)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpacityChange(90)}
                    className={`px-1.5 py-0.5 rounded transition ${opacity === 90 ? "font-bold text-brand-600 bg-brand-50 dark:bg-brand-950/60" : "hover:text-brand-600"}`}
                  >
                    Full (90%)
                  </button>
                </div>
              </div>

              {/* Blur Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Soft Background Blur</span>
                  <span className="font-mono text-brand-600 dark:text-brand-400 font-bold bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded">
                    {blur}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={blur}
                  onChange={(e) => handleBlurChange(e.target.value)}
                  className="w-full accent-brand-600 cursor-pointer"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <button type="button" onClick={() => handleBlurChange(0)} className="hover:text-brand-600">
                    Crisp (0px)
                  </button>
                  <button type="button" onClick={() => handleBlurChange(2)} className="hover:text-brand-600">
                    Soft (2px)
                  </button>
                  <button type="button" onClick={() => handleBlurChange(5)} className="hover:text-brand-600">
                    Diffusion (5px)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Live Mockup Preview Box */}
          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden relative">
            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-500" />
                Live In-App Mockup Preview
              </span>
              <span className="text-[10px] font-normal text-slate-400">
                Shows card clarity and typography against your background
              </span>
            </div>

            <div className="relative p-6 min-h-[160px] flex items-center justify-center overflow-hidden bg-slate-900">
              {/* Background behind preview */}
              {backgroundUrl ? (
                <div
                  className="absolute inset-0 bg-cover bg-center transition-all duration-300"
                  style={{
                    backgroundImage: `url(${backgroundUrl})`,
                    opacity: opacity / 100,
                    filter: blur ? `blur(${blur}px)` : undefined,
                  }}
                />
              ) : (
                <div className="absolute inset-0 bg-slate-100 dark:bg-slate-900" />
              )}

              {/* Sample Floating Card */}
              <div className="relative z-10 max-w-sm w-full p-4 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-white/60 dark:border-slate-700/60 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                      ⚡
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Sample Dashboard Metric</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Live background contrast test</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                    +18.4%
                  </span>
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white mt-1">$142,850.00</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">High clarity text, buttons and graphs remain fully readable.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
