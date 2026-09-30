/**
 * posPreloader.js
 *
 * Proactively fetches and caches ALL POS reference data to IndexedDB so that
 * the POS Sales Entry page and all other POS pages work fully offline.
 *
 * Strategy:
 * - On first load (online): fetch everything and cache it.
 * - On reconnect: re-fetch everything to refresh stale data.
 * - Uses a staleness window: if data is <15 minutes old, skip re-fetch
 *   (avoids hammering the server on every page visit).
 */

import api from "../api/client.js";
import { cachePosDatum, getPosDatum, POS_CACHE_KEYS } from "./offlinePosCache.js";

// Re-fetch reference data if older than 15 minutes
const REFRESH_AFTER_MS = 15 * 60 * 1000;

let _preloading = false;
let _lastPreloadAt = 0;

function isOnline() {
  try { return navigator.onLine !== false; } catch { return true; }
}

/**
 * Fetch one endpoint and cache it, ignoring errors silently.
 * Returns the data on success, null on failure.
 */
async function fetchAndCache(key, url, transform) {
  try {
    const res = await api.get(url);
    const data = transform ? transform(res.data) : res.data;
    if (data !== null && data !== undefined) {
      await cachePosDatum(key, data);
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Main preload function. Fetches all POS reference data and caches it.
 * Safe to call multiple times — debounced by REFRESH_AFTER_MS.
 * @param {boolean} force - skip staleness check and always refresh
 */
export async function preloadPosData(force = false) {
  if (!isOnline()) return;
  if (_preloading) return;

  const now = Date.now();
  if (!force && now - _lastPreloadAt < REFRESH_AFTER_MS) return;

  _preloading = true;
  _lastPreloadAt = now;

  try {
    // 1. Payment Modes
    await fetchAndCache(
      POS_CACHE_KEYS.PAYMENT_MODES,
      "/pos/payment-modes",
      (d) => (Array.isArray(d?.items) ? d.items : []),
    );

    // 2. Price Types
    await fetchAndCache(
      POS_CACHE_KEYS.PRICE_TYPES,
      "/sales/price-types",
      (d) => (Array.isArray(d?.items) ? d.items : []),
    );

    // 3. Tax Settings
    const taxData = await fetchAndCache(
      POS_CACHE_KEYS.TAX_SETTINGS,
      "/pos/tax-settings",
      (d) => d?.item || null,
    );

    // 4. Tax Components (if a tax code is linked)
    const taxCodeId = Number(taxData?.tax_code_id || 0);
    if (taxCodeId > 0) {
      await fetchAndCache(
        POS_CACHE_KEYS.TAX_COMPONENTS,
        `/finance/tax-codes/${taxCodeId}/components`,
        (d) => (Array.isArray(d?.items) ? d.items : []),
      );
    } else {
      await cachePosDatum(POS_CACHE_KEYS.TAX_COMPONENTS, []);
    }

    // 5. Customers
    await fetchAndCache(
      POS_CACHE_KEYS.CUSTOMERS,
      "/pos/customers",
      (d) => (Array.isArray(d?.items) ? d.items : []),
    );

    // 6. Terminals
    const terminalsData = await fetchAndCache(
      POS_CACHE_KEYS.TERMINALS,
      "/pos/terminals",
      (d) => (Array.isArray(d?.items) ? d.items : []),
    );

    // 7. Terminal Users
    await fetchAndCache(
      POS_CACHE_KEYS.TERMINAL_USERS,
      "/pos/terminal-users",
      (d) => (Array.isArray(d?.items) ? d.items : []),
    );

    // 8. Receipt Settings
    await fetchAndCache(
      POS_CACHE_KEYS.RECEIPT_SETTINGS,
      "/pos/receipt-settings",
      (d) => d?.item || d || null,
    );

    // 9. Company Info (via /admin/me then /admin/companies/:id)
    try {
      const meRes = await api.get("/admin/me");
      const companyId = meRes.data?.scope?.companyId;
      if (companyId) {
        const cRes = await api.get(`/admin/companies/${companyId}`);
        const item = cRes.data?.item || {};
        const companyInfo = {
          name: item.name || "",
          address: item.address || "",
          city: item.city || "",
          state: item.state || "",
          country: item.country || "",
          phone: item.telephone || "",
          email: item.email || "",
          website: item.website || "",
          taxId: item.tax_id || "",
          registrationNo: item.registration_no || "",
          hasLogo: item.has_logo === 1 || item.has_logo === true,
          companyId,
        };
        await cachePosDatum(POS_CACHE_KEYS.COMPANY_INFO, companyInfo);
      }
    } catch {}

    // 10. Products — stored in both localStorage (for speed) and IndexedDB
    try {
      const res = await api.get("/inventory/items");
      const raw = Array.isArray(res.data?.items) ? res.data.items : [];
      if (raw.length) {
        const mapped = raw
          .filter((it) => it && it.is_active !== false)
          .map((it) => ({
            id: it.id,
            name: it.item_name || "",
            code: it.item_code || "",
            price: Number(it.selling_price ?? 0),
            availQty: Number(it.stock_level ?? 0),
            image_url: it.image_url || "",
            barcode: it.barcode || "",
          }));
        try {
          localStorage.setItem("omnisuite.pos.products", JSON.stringify(mapped));
        } catch {}
      }
    } catch {}

  } finally {
    _preloading = false;
  }
}

// Re-run preloader when connectivity is restored so stale data is refreshed
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    // Force refresh on reconnect
    _lastPreloadAt = 0;
    preloadPosData(true);
  });
}
