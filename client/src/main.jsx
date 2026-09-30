import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import "antd/dist/reset.css";
import "./styles.css";
import iconClearUrl from "./assets/resources/OMNISUITE_ICON_CLEAR.png?url";

async function clearPwaCachesOnce() {
  const key = "omnisuite_favicon_reset_v3";
  try {
    if (localStorage.getItem(key) === "1") return;
    localStorage.setItem(key, "1");

    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    try {
      localStorage.setItem(key, "1");
    } catch {}
  }
}

// Dynamic Vite chunk loading error handler:
// If a deployment replaces static JS bundle hashes (resulting in 404 for stale chunks),
// automatically reload the window once to fetch the latest index.html and current bundle assets.
window.addEventListener("vite:preloadError", (event) => {
  console.warn("Vite preload error detected (stale bundle). Reloading page...");
  const lastReload = Number(sessionStorage.getItem("chunk_reload_time") || 0);
  if (Date.now() - lastReload > 10000) {
    sessionStorage.setItem("chunk_reload_time", String(Date.now()));
    window.location.reload();
  }
});

window.addEventListener(
  "error",
  (event) => {
    const msg = event?.message || "";
    const targetSrc = event?.target?.src || "";
    const isChunkError =
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("error loading dynamically imported module") ||
      (event?.target?.tagName === "SCRIPT" && targetSrc.includes("/assets/"));

    if (isChunkError) {
      console.warn("Chunk load error detected:", msg || targetSrc);
      const lastReload = Number(sessionStorage.getItem("chunk_reload_time") || 0);
      if (Date.now() - lastReload > 10000) {
        sessionStorage.setItem("chunk_reload_time", String(Date.now()));
        window.location.reload();
      }
    }
  },
  true
);

if (import.meta.env.DEV) {
  clearPwaCachesOnce();
}

(function setFavicons() {
  try {
    const head = document.head || document.getElementsByTagName("head")[0];
    const rels = [
      "icon",
      "shortcut icon",
      "apple-touch-icon",
      "apple-touch-icon-precomposed",
    ];
    rels.forEach((rel) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", rel);
        link.setAttribute("type", "image/png");
        if (rel.startsWith("apple-touch-icon")) {
          link.setAttribute("sizes", "180x180");
        }
        head.appendChild(link);
      }
      link.setAttribute("href", iconClearUrl);
    });
  } catch {}
})();

// Silence React's "Download the React DevTools" tip in dev console
if (import.meta.env.DEV) {
  try {
    const originalInfo = console.info;
    const originalLog = console.log;
    console.info = function (...args) {
      const msg = args?.[0];
      if (
        typeof msg === "string" &&
        msg.includes("Download the React DevTools")
      ) {
        return;
      }
      return originalInfo.apply(this, args);
    };
    console.log = function (...args) {
      const msg = args?.[0];
      if (
        typeof msg === "string" &&
        msg.includes("Download the React DevTools")
      ) {
        return;
      }
      return originalLog.apply(this, args);
    };
  } catch {}
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service Worker registration skipped/failed:", err);
    });
  });
}
