/**
 * @file usePWAInstall.js
 * @description Hook to manage Progressive Web App (PWA) installation.
 */

import { useEffect, useMemo, useState } from "react";

/**
 * Hook to handle PWA installation prompt and status.
 * @returns {Object} An object containing PWA installation state and functions.
 * @returns {boolean} returns.isInstallable - Whether the app can be installed.
 * @returns {boolean} returns.isInstalled - Whether the app is already installed.
 * @returns {boolean} returns.isPWASupported - Whether the browser supports service workers.
 * @returns {Function} returns.handleInstall - Function to prompt the user to install the PWA.
 * @returns {Function} returns.dismissPrompt - Function to dismiss the installation prompt.
 */
export default function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported("serviceWorker" in navigator);
    function onBeforeInstallPrompt(e) {
      // Prevent default so we can trigger the prompt from our UI
      try {
        e.preventDefault();
      } catch {}
      setInstallPrompt(e);
    }
    function onAppInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    const displayModeStandalone =
      window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = navigator.standalone === true;
    if (displayModeStandalone || iosStandalone) {
      setInstalled(true);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const isInstallable = useMemo(() => Boolean(installPrompt), [installPrompt]);

  async function handleInstall() {
    if (!installPrompt) return false;
    try {
      await installPrompt.prompt?.();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      return choice?.outcome === "accepted";
    } catch {
      setInstallPrompt(null);
      return false;
    }
  }

  function dismissPrompt() {
    setInstallPrompt(null);
  }

  return {
    isInstallable,
    isInstalled: installed,
    isPWASupported: supported,
    handleInstall,
    dismissPrompt,
  };
}
