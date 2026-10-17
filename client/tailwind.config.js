/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    fontFamily: {
      sans: [
        "-apple-system",
        "BlinkMacSystemFont",
        '"SF Pro Text"',
        '"SF Pro Display"',
        '"SF Pro"',
        '"Inter"',
        "system-ui",
        '"Segoe UI"',
        "Roboto",
        '"Helvetica Neue"',
        "Arial",
        "sans-serif",
      ],
      mono: [
        '"SF Mono"',
        "ui-monospace",
        "Menlo",
        "Monaco",
        "Consolas",
        '"Liberation Mono"',
        '"Courier New"',
        "monospace",
      ],
    },
    extend: {
      colors: {
        // User-defined Brand Blend: #0E3646, #F57C00, #2E8B1F
        brand: {
          DEFAULT: "#0E3646", // Deep Teal / Navy Base
          50: "#f0f7fa",
          100: "#e1eff5",
          200: "#c2deeb",
          300: "#94c3db",
          400: "#5fa2c4",
          500: "#3b86a8",
          600: "#296d8f",
          700: "#215876",
          800: "#173d50",
          900: "#0E3646",
          950: "#061a22",
        },
        // Primary Action Color (Mapped to brand-900)
        primary: {
          DEFAULT: "#0E3646",
          light: "#173d50",
          dark: "#061a22",
          50: "#f0f7fa", // For backgrounds
        },
        // Secondary Color (Custom Golden Yellow from user)
        secondary: {
          DEFAULT: "#F9B514", // vibrant golden yellow
          light: "#FBCD49",
          dark: "#E59E04",
          50: "#FFFDF2", // For backgrounds
        },
        // Colorful Tickers & Dashboards (Mapped to Theme)
        ticker: {
          blue: { DEFAULT: "#0E3646", bg: "#f0f7fa" }, // Brand Base
          green: { DEFAULT: "#2E8B1F", bg: "#f2fdf0" }, // Success Base
          orange: { DEFAULT: "#fbbf24", bg: "#fffbeb" }, // Secondary Base
          red: { DEFAULT: "#ef4444", bg: "#fef2f2" }, // Keep Red for Alerts (UX Standard)
          purple: { DEFAULT: "#5fa2c4", bg: "#e1eff5" }, // Mapped to Brand Light
          teal: { DEFAULT: "#3b86a8", bg: "#c2deeb" }, // Mapped to Brand Mid
          pink: { DEFAULT: "#fbbf24", bg: "#fffbeb" }, // Mapped to Secondary
        },
        // Semantic Status Colors (Apple HIG compliant contrast)
        status: {
          success: "#2E8B1F", // Green
          warning: "#F57C00", // Orange
          error: "#ef4444", // Red (Standard)
          info: "#0E3646", // Brand
          pending: "#64748b", // Slate 500
        },
      },
      borderRadius: {
        "apple-xs": "6px",
        "apple-sm": "8px",
        "apple-md": "10px",
        "apple-lg": "12px",
        "apple-xl": "16px",
        "apple-2xl": "20px",
        "apple-3xl": "24px",
      },
      boxShadow: {
        "erp-sm": "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
        erp: "0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -1px rgba(15, 23, 42, 0.06)",
        "erp-md":
          "0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -2px rgba(15, 23, 42, 0.05)",
        "erp-lg":
          "0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 10px 10px -5px rgba(15, 23, 42, 0.04)",
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",

        // Apple Ambient Occlusion + Key Light Shadows
        "apple-xs": "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        "apple-sm": "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
        "apple-md": "0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
        "apple-lg": "0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)",
        "apple-xl": "0 20px 25px -5px rgba(0, 0, 0, 0.10), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
        "apple-dock": "0 -4px 20px -2px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.04)",
      },
      fontSize: {
        base: ["0.875rem", { lineHeight: "1.25rem" }], // 14px default base font size
      },
    },
  },
  plugins: [],
};
