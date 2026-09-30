/**
 * offlinePosCache.js
 *
 * Thin wrapper around IndexedDB's pos_cache store for storing and retrieving
 * POS reference data (payment modes, tax settings, price types, customers,
 * company info, terminal/day status) so the POS Sales Entry page works fully
 * offline after at least one online session.
 *
 * TTL: entries older than MAX_STALE_MS are considered stale and the preloader
 * will refresh them when connectivity is restored, but the stale data is still
 * served offline rather than showing an empty dropdown.
 */

import { putPosCache, getPosCache, clearPosCache } from "./db.js";

export const POS_CACHE_KEYS = {
  PAYMENT_MODES: "pos:payment-modes",
  PRICE_TYPES: "pos:price-types",
  TAX_SETTINGS: "pos:tax-settings",
  TAX_COMPONENTS: "pos:tax-components",
  CUSTOMERS: "pos:customers",
  COMPANY_INFO: "pos:company-info",
  TERMINAL_DAY: "pos:terminal-day",
  TERMINALS: "pos:terminals",
  TERMINAL_USERS: "pos:terminal-users",
  RECEIPT_SETTINGS: "pos:receipt-settings",
  GENERAL_SETTINGS: "pos:general-settings",
};

// Data older than 4 hours is considered stale (but still used offline)
const MAX_STALE_MS = 4 * 60 * 60 * 1000;

/**
 * Save a value to the POS offline cache.
 * @param {string} key - one of POS_CACHE_KEYS
 * @param {*} data - JSON-serialisable data
 */
export async function cachePosDatum(key, data) {
  try {
    await putPosCache(key, data);
  } catch {}
}

/**
 * Read a value from the POS offline cache.
 * @param {string} key - one of POS_CACHE_KEYS
 * @param {*} fallback - returned when no cached entry exists
 * @returns {{ data: *, stale: boolean } | null}
 */
export async function getPosDatum(key, fallback = null) {
  try {
    const entry = await getPosCache(key);
    if (!entry) return { data: fallback, stale: true };
    const stale = Date.now() - Number(entry.updatedAt || 0) > MAX_STALE_MS;
    return { data: entry.data ?? fallback, stale };
  } catch {
    return { data: fallback, stale: true };
  }
}

/**
 * Wipe all POS reference data from the cache (e.g. on logout or manual reset).
 */
export async function clearAllPosCache() {
  try {
    await clearPosCache();
  } catch {}
}
