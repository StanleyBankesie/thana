/**
 * @fileoverview useFloatingCollision hook
 * Provides butter-smooth automatic collision detection and avoidance for floating action
 * widgets (Ask Banks and Floating Chat). Automatically detects when floating widgets
 * cover underlying interactive buttons (e.g. in modals, dialogs, drawers, or sticky bars)
 * and smoothly glides them up out of the way, returning them gracefully to their resting
 * position when the collision clears.
 */

import { useState, useEffect, useRef } from "react";

// Global registry of active floating widgets
// id -> { ref, setShiftY }
const registeredWidgets = new Map();

let observerInstance = null;
let debounceTimer = null;
let scheduledRafId = null;
let heartbeatIntervalId = null;
let lastCalculatedShift = 0;

/**
 * Extracts the current live translateY value from the element's computed transform matrix.
 * This guarantees we know the exact in-flight translation at any point during CSS transitions.
 */
function getTransformY(el) {
  try {
    const st = window.getComputedStyle(el);
    const tr = st.transform || st.webkitTransform;
    if (!tr || tr === "none") return 0;
    if (tr.startsWith("matrix(")) {
      const parts = tr.slice(7, -1).split(",");
      if (parts.length >= 6) {
        return parseFloat(parts[5]) || 0;
      }
    }
    if (tr.startsWith("matrix3d(")) {
      const parts = tr.slice(9, -1).split(",");
      if (parts.length >= 16) {
        return parseFloat(parts[13]) || 0;
      }
    }
  } catch {}
  return 0;
}

/**
 * Checks if a candidate element is visible on screen and not obscured by dialog backdrops.
 */
function isInteractiveCandidate(el) {
  if (!el || !el.isConnected) return false;

  // Skip elements inside floating widgets themselves
  if (el.closest('[data-floating-widget="true"]')) return false;

  // Skip elements inside Banks AI modal or Chat modal
  if (el.closest('[data-floating-ignore="true"]')) return false;

  // Check computed display / visibility / pointerEvents
  const style = window.getComputedStyle(el);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0" ||
    style.pointerEvents === "none"
  ) {
    return false;
  }

  const rect = el.getBoundingClientRect();
  if (rect.width <= 4 || rect.height <= 4) return false;

  // Quick viewport boundary check
  if (
    rect.bottom <= 0 ||
    rect.top >= window.innerHeight ||
    rect.right <= 0 ||
    rect.left >= window.innerWidth
  ) {
    return false;
  }

  // Pre-filter: only elements in the bottom-right zone of the viewport can collide
  // with bottom-right floating widgets
  if (
    rect.bottom < window.innerHeight - 350 ||
    rect.right < window.innerWidth - 450
  ) {
    return false;
  }

  // Occlusion test: verify this element is actually on top (not hidden behind a modal overlay or backdrop)
  try {
    const cx = Math.max(1, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
    const cy = Math.max(1, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
    const elements = document.elementsFromPoint(cx, cy);
    if (elements && elements.length > 0) {
      const topNonFloating = elements.find(
        (item) => !item.closest('[data-floating-widget="true"]')
      );
      if (
        topNonFloating &&
        topNonFloating !== el &&
        !el.contains(topNonFloating) &&
        !topNonFloating.contains(el)
      ) {
        // Obscured by an overlay, dialog backdrop, or higher element
        return false;
      }
    }
  } catch {}

  return true;
}

/**
 * Executes collision detection across all registered floating widgets
 * and updates their avoidance offsets in unison.
 */
function runCollisionCheck() {
  if (registeredWidgets.size === 0) return;

  // Query potential clickable interactive elements in the DOM
  const candidatesRaw = document.querySelectorAll(
    'button, [role="button"], input[type="button"], input[type="submit"], a.btn, a[role="button"], [data-floating-avoid="true"]'
  );

  const activeCandidates = [];
  for (let i = 0; i < candidatesRaw.length; i++) {
    const el = candidatesRaw[i];
    if (isInteractiveCandidate(el)) {
      activeCandidates.push({
        el,
        rect: el.getBoundingClientRect(),
      });
    }
  }

  let maxNeededShift = 0;

  // Iterate over each registered widget
  registeredWidgets.forEach((widget) => {
    const el = widget.ref?.current;
    if (!el || !el.isConnected) return;

    const liveRect = el.getBoundingClientRect();
    if (liveRect.width <= 0 || liveRect.height <= 0) return;

    // Calculate untransformed base resting rectangle using live matrix decomposition
    // liveRect.bottom is liveTranslateY pixels from resting bottom
    const liveTranslateY = getTransformY(el);
    const baseBottom = liveRect.bottom - liveTranslateY;
    const baseTop = liveRect.top - liveTranslateY;
    const baseLeft = liveRect.left;
    const baseRight = liveRect.right;

    // Test collision against candidates
    let widgetShift = 0;

    for (let j = 0; j < activeCandidates.length; j++) {
      const { rect: btnRect } = activeCandidates[j];

      // Check bounding box intersection with resting position (with 10px buffer)
      const overlapsX =
        btnRect.right >= baseLeft - 10 && btnRect.left <= baseRight + 10;
      const overlapsY =
        btnRect.bottom >= baseTop - 10 && btnRect.top <= baseBottom + 10;

      if (overlapsX && overlapsY) {
        // Upward clearance: place bottom of widget 14px above the candidate button's top
        const shiftCandidate = baseBottom - btnRect.top + 14;
        if (shiftCandidate > widgetShift) {
          widgetShift = shiftCandidate;
        }
      }
    }

    // Secondary pass: ensure the candidate shifted position doesn't collide with stacked buttons above
    if (widgetShift > 0) {
      for (let pass = 0; pass < 2; pass++) {
        const testBottom = baseBottom - widgetShift;
        const testTop = baseTop - widgetShift;
        let extra = 0;
        for (let j = 0; j < activeCandidates.length; j++) {
          const { rect: btnRect } = activeCandidates[j];
          const overlapsX =
            btnRect.right >= baseLeft - 10 && btnRect.left <= baseRight + 10;
          const overlapsY =
            btnRect.bottom >= testTop - 10 && btnRect.top <= testBottom + 10;
          if (overlapsX && overlapsY) {
            const shiftMore = testBottom - btnRect.top + 14;
            if (shiftMore > extra) {
              extra = shiftMore;
            }
          }
        }
        if (extra > 0) {
          widgetShift += extra;
        } else {
          break;
        }
      }
    }

    // Cap shift so widget does not get pushed past the top of viewport
    const maxSafeShift = Math.max(0, baseTop - 24);
    widgetShift = Math.min(widgetShift, maxSafeShift);

    if (widgetShift > maxNeededShift) {
      maxNeededShift = widgetShift;
    }
  });

  // Round to nearest integer pixel
  maxNeededShift = Math.round(maxNeededShift);

  // Smooth deadband / hysteresis:
  // If moving to/from 0, update immediately.
  // Otherwise, only update if the shift difference is at least 6px, preventing visual jitter.
  const diff = Math.abs(lastCalculatedShift - maxNeededShift);
  const shouldUpdate =
    (maxNeededShift === 0 && lastCalculatedShift !== 0) ||
    (lastCalculatedShift === 0 && maxNeededShift !== 0) ||
    diff >= 6;

  if (shouldUpdate) {
    lastCalculatedShift = maxNeededShift;
    registeredWidgets.forEach((widget) => {
      widget.setShiftY(maxNeededShift);
    });
  }
}

/**
 * Schedules a debounced collision check so modal animations and layout changes settle first.
 */
function scheduleCollisionCheck(delay = 40) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (scheduledRafId !== null) cancelAnimationFrame(scheduledRafId);
    scheduledRafId = requestAnimationFrame(() => {
      scheduledRafId = null;
      runCollisionCheck();
    });
  }, delay);
}

/**
 * Initializes global event listeners and MutationObserver.
 */
function startGlobalListeners() {
  if (typeof window === "undefined") return;

  if (!observerInstance) {
    observerInstance = new MutationObserver((mutations) => {
      // Ignore mutations originating entirely from the floating widgets themselves
      const allFloating = mutations.every((m) => {
        const target = m.target;
        return (
          target &&
          target.closest &&
          target.closest('[data-floating-widget="true"]')
        );
      });
      if (allFloating) return;

      scheduleCollisionCheck(50);
    });

    try {
      observerInstance.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden", "aria-hidden"],
      });
    } catch {}
  }

  window.addEventListener("scroll", () => scheduleCollisionCheck(60), {
    capture: true,
    passive: true,
  });
  window.addEventListener("resize", () => scheduleCollisionCheck(60), {
    passive: true,
  });

  if (!heartbeatIntervalId) {
    heartbeatIntervalId = setInterval(() => scheduleCollisionCheck(0), 1000);
  }

  scheduleCollisionCheck(0);
}

/**
 * Tears down global listeners if no widgets remain registered.
 */
function stopGlobalListenersIfEmpty() {
  if (registeredWidgets.size > 0) return;

  if (observerInstance) {
    observerInstance.disconnect();
    observerInstance = null;
  }
  window.removeEventListener("scroll", scheduleCollisionCheck);
  window.removeEventListener("resize", scheduleCollisionCheck);

  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (scheduledRafId !== null) {
    cancelAnimationFrame(scheduledRafId);
    scheduledRafId = null;
  }
  lastCalculatedShift = 0;
}

/**
 * React hook for floating widget collision detection and avoidance.
 *
 * @param {string} id - Unique identifier for the floating widget.
 * @param {React.RefObject} containerRef - Ref attached to the floating widget container element.
 * @returns {number} shiftY - Upward shift distance in pixels (0 when resting).
 */
export function useFloatingCollision(id, containerRef) {
  const [shiftY, setShiftY] = useState(lastCalculatedShift);

  useEffect(() => {
    registeredWidgets.set(id, {
      ref: containerRef,
      setShiftY,
    });

    startGlobalListeners();

    return () => {
      registeredWidgets.delete(id);
      stopGlobalListenersIfEmpty();
    };
  }, [id, containerRef]);

  return shiftY;
}

export default useFloatingCollision;
