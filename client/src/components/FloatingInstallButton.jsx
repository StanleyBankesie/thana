/**
 * @fileoverview Floating button component to prompt Progressive Web App (PWA) installation.
 * Handles different device install scenarios (e.g., iOS Safari manual prompt).
 */

import React from "react";
import { Download } from "lucide-react";
import usePWAInstall from "../hooks/usePWAInstall.js";

/**
 * FloatingInstallButton component
 * Displays a persistent install button in the bottom right corner when PWA installation is supported and not yet installed.
 * 
 * @returns {JSX.Element|null} The floating install button or null if already installed/unsupported.
 */
export default function FloatingInstallButton() {
  const { isInstallable, isInstalled, handleInstall } = usePWAInstall();

  // Show ONLY if the browser can directly install the app (via native install prompt) and app is not yet installed
  if (!isInstallable || isInstalled) return null;

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        className="inline-flex items-center justify-center w-9 h-9 lg:w-auto lg:px-3 lg:gap-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
        aria-label="Install App"
        onClick={() => handleInstall()}
        title="Install OmniSuite ERP"
      >
        <Download className="w-5 h-5" />
        <span className="hidden lg:inline text-sm font-medium">Install App</span>
      </button>
    </div>
  );
}
