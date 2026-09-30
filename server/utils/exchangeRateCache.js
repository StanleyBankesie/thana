/**
 * @file exchangeRateCache.js
 * @description Fetches and caches foreign exchange rates with a 1-hour Redis TTL.
 * Uses the open.er-api.com free API. Falls back to fetching live on cache miss.
 */
import { cacheGet, cacheSet } from "./redis.js";

const CACHE_TTL = 60 * 60; // 1 hour
const CACHE_KEY = (base) => `fx:rates:${base.toUpperCase()}`;
const API_URL = (base) =>
  `https://open.er-api.com/v6/latest/${encodeURIComponent(base.toUpperCase())}`;

/**
 * Returns exchange rates for the given base currency.
 * Cached in Redis for 1 hour. Returns null on failure.
 *
 * @param {string} base - ISO 4217 currency code, e.g. "USD"
 * @returns {Promise<{base: string, rates: Record<string, number>, updated: string}|null>}
 */
export async function getExchangeRates(base) {
  const key = CACHE_KEY(base);

  // Try cache first
  try {
    const cached = await cacheGet(key);
    if (cached) return cached;
  } catch {
    // Cache unavailable — fall through to live fetch
  }

  // Fetch live rates
  try {
    const res = await fetch(API_URL(base));
    if (!res.ok) {
      console.error(`[ExchangeRateCache] API error ${res.status} for base ${base}`);
      return null;
    }
    const data = await res.json();
    if (data.result !== "success") {
      console.error(`[ExchangeRateCache] API returned non-success:`, data["error-type"]);
      return null;
    }

    const payload = {
      base: data.base_code,
      rates: data.rates,
      updated: data.time_last_update_utc,
    };

    // Store in cache (best-effort)
    try {
      await cacheSet(key, payload, CACHE_TTL);
    } catch {
      // Cache write failure is non-fatal
    }

    return payload;
  } catch (err) {
    console.error(`[ExchangeRateCache] Fetch failed:`, err.message);
    return null;
  }
}
