/**
 * @fileoverview Application Background Resolution & Theme Adapters
 * Provides seamless resolution of light and dark mode counterparts for application backgrounds.
 */

export const BACKGROUND_PRESETS = [
  {
    id: "solid-white",
    name: "Solid Clean Minimal",
    subtitle: "Adaptive Solid",
    description: "Glare-free pure solid white in light mode, switching to sleek dark slate in dark mode",
    url: "/backgrounds/solid-white.svg",
    darkUrl: "/backgrounds/solid-dark.svg",
    previewUrl: "/backgrounds/solid-white.svg",
    theme: "Adaptive Solid",
  },
  {
    id: "silk-waves",
    name: "Silk Waves",
    subtitle: "Recommended",
    description: "Translucent frosted 3D silk ribbons in deep indigo & cyan",
    url: "/backgrounds/abstract-silk-waves.jpg",
    darkUrl: "/backgrounds/abstract-silk-waves.jpg",
    previewUrl: "/backgrounds/abstract-silk-waves.jpg",
    theme: "Dark & Vibrant",
  },
  {
    id: "pastel-silk",
    name: "Pastel Silk",
    subtitle: "Ethereal Flow",
    description: "Pearlescent violet & sky blue ribbons in light mode, deep indigo silk in dark mode",
    url: "/backgrounds/pastel-silk-waves.jpg",
    darkUrl: "/backgrounds/abstract-silk-waves.jpg",
    previewUrl: "/backgrounds/pastel-silk-waves.jpg",
    theme: "Pastel Iridescent",
  },
  {
    id: "amber-apricot",
    name: "Amber Apricot",
    subtitle: "Warm Luster",
    description: "Luminous golden apricot waveforms in light mode, deep dark luxury amber in dark mode",
    url: "/backgrounds/amber-apricot-flow.jpg",
    darkUrl: "/backgrounds/amber-apricot-dark.jpg",
    previewUrl: "/backgrounds/amber-apricot-flow.jpg",
    theme: "Warm Apricot",
  },
  {
    id: "digital-aura",
    name: "Digital Aura",
    subtitle: "Cybernetic Mesh",
    description: "Warm ivory golden mesh in light mode, deep navy constellation cyber space in dark mode",
    url: "/backgrounds/digital-aura-light.jpg",
    darkUrl: "/backgrounds/cyber-nexus-dark.jpg",
    previewUrl: "/backgrounds/digital-aura-light.jpg",
    theme: "Light / Dark Tech",
  },
  {
    id: "cyber-nexus",
    name: "Cyber Nexus",
    subtitle: "Dark Tech",
    description: "Deep navy digital space with glowing amber network constellations & orbital rings",
    url: "/backgrounds/cyber-nexus-dark.jpg",
    darkUrl: "/backgrounds/cyber-nexus-dark.jpg",
    previewUrl: "/backgrounds/cyber-nexus-dark.jpg",
    theme: "Dark Cybernetic",
  },
  {
    id: "none",
    name: "Clean Slate",
    subtitle: "Classic",
    description: "No wallpaper graphic (minimalist slate theme background)",
    url: "",
    darkUrl: "",
    previewUrl: null,
    theme: "Solid Color",
  },
];

/**
 * Resolves the appropriate background image URL, colors, and visual styles
 * depending on whether dark mode is currently active.
 *
 * @param {Object} appBackground - The background settings object from PermissionContext or localStorage
 * @param {boolean} isDark - True if dark mode is active
 * @returns {Object} Resolved background properties
 */
export function resolveBackgroundForTheme(appBackground, isDark) {
  if (!appBackground) {
    return {
      isSolid: true,
      isSolidWhite: !isDark,
      isSolidDark: isDark,
      color: isDark ? "#0b0f19" : "#ffffff",
      url: isDark ? "/backgrounds/solid-dark.svg" : "/backgrounds/solid-white.svg",
      opacity: 40,
      blur: 0,
      isCustom: false,
    };
  }

  const { preset, url = "", opacity = 40, blur = 0 } = appBackground;

  // 1. Solid Clean Minimal (solid-white)
  if (preset === "solid-white" || url?.includes("solid-white")) {
    return {
      isSolid: true,
      isSolidWhite: !isDark,
      isSolidDark: isDark,
      color: isDark ? "#0b0f19" : "#ffffff",
      url: isDark ? "/backgrounds/solid-dark.svg" : "/backgrounds/solid-white.svg",
      opacity,
      blur,
      isCustom: false,
    };
  }

  // 2. Solid Slate / None
  if (preset === "none" || !url) {
    return {
      isSolid: true,
      isSolidWhite: false,
      isSolidDark: isDark,
      color: isDark ? "#0b0f19" : "#f1f5f9",
      url: "",
      opacity,
      blur,
      isCustom: false,
    };
  }

  // 3. Preset & URL pairing for Dark / Light counterparts
  let resolvedUrl = url;
  let isCustom = false;

  if (isDark) {
    if (preset === "digital-aura" || url.includes("digital-aura-light")) {
      resolvedUrl = "/backgrounds/cyber-nexus-dark.jpg";
    } else if (preset === "amber-apricot" || url.includes("amber-apricot-flow")) {
      resolvedUrl = "/backgrounds/amber-apricot-dark.jpg";
    } else if (preset === "pastel-silk" || url.includes("pastel-silk-waves")) {
      resolvedUrl = "/backgrounds/abstract-silk-waves.jpg";
    } else if (preset === "silk-waves" || url.includes("abstract-silk-waves")) {
      resolvedUrl = "/backgrounds/abstract-silk-waves.jpg";
    } else if (preset === "cyber-nexus" || url.includes("cyber-nexus-dark")) {
      resolvedUrl = "/backgrounds/cyber-nexus-dark.jpg";
    } else {
      // Custom uploaded or arbitrary image: in dark mode, preserve the image but apply dark treatment
      isCustom = true;
      resolvedUrl = url;
    }
  } else {
    // Light mode resolution
    if (preset === "digital-aura" || url.includes("cyber-nexus-dark")) {
      resolvedUrl = "/backgrounds/digital-aura-light.jpg";
    } else if (preset === "amber-apricot" || url.includes("amber-apricot-dark") || url.includes("abstract-aurora-glow")) {
      resolvedUrl = "/backgrounds/amber-apricot-flow.jpg";
    } else if (preset === "pastel-silk") {
      resolvedUrl = "/backgrounds/pastel-silk-waves.jpg";
    } else if (preset === "cyber-nexus") {
      resolvedUrl = "/backgrounds/cyber-nexus-dark.jpg";
    }
  }

  return {
    isSolid: false,
    isSolidWhite: false,
    isSolidDark: false,
    color: isDark ? "#0b0f19" : "#ffffff",
    url: resolvedUrl,
    opacity,
    blur,
    isCustom,
  };
}
