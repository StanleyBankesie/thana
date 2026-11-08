/**
 * @fileoverview ScrollToTop component.
 * Ensures that whenever a user navigates to any page or module home, the view
 * always starts at the very top (beginning of the page), preventing the browser
 * or router from restoring or retaining the scrolled portion of the page from when
 * it was previously visited or closed.
 */

import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const location = useLocation();

  // Disable automatic browser scroll restoration so previously scrolled positions are not remembered
  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // On every route change (pathname or search change without an explicit hash anchor), reset scroll to top
  useLayoutEffect(() => {
    if (location.hash) {
      return;
    }

    const resetScroll = () => {
      // 1. Reset standard browser window and document scrolling
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      if (document.documentElement && document.documentElement.scrollTop !== 0) {
        document.documentElement.scrollTop = 0;
      }
      if (document.body && document.body.scrollTop !== 0) {
        document.body.scrollTop = 0;
      }

      // 2. Reset any scrollable main element or app layout containers
      const mainEl = document.querySelector("main");
      if (mainEl && mainEl.scrollTop !== 0) {
        mainEl.scrollTop = 0;
      }
      const rootEl = document.getElementById("root");
      if (rootEl && rootEl.scrollTop !== 0) {
        rootEl.scrollTop = 0;
      }
    };

    // Instant synchronous reset before paint
    resetScroll();

    // Subsequent microtask & RAF resets to handle async component mounting and layout settling
    const rafId = requestAnimationFrame(() => {
      resetScroll();
    });
    const timerId = setTimeout(() => {
      resetScroll();
    }, 40);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [location.pathname, location.search, location.key]);

  return null;
}
