/**
 * @fileoverview Utility functions for string searching, ranking, and filtering.
 * Uses text normalization to handle diacritics and case-insensitive matching.
 */

/**
 * Normalizes a string by converting it to lowercase and removing diacritics.
 * 
 * @param {string} s - The string to normalize.
 * @returns {string} The normalized string.
 */
export function normalizeString(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Finds the index of a match at a word boundary.
 * @param {string} haystack - The string to search within.
 * @param {string} needle - The string to search for.
 * @returns {number} The index of the match, or -1 if not found.
 */
function wordBoundaryIndex(haystack, needle) {
  // Find if needle matches at start of any word in haystack
  const idx = haystack.indexOf(needle);
  if (idx <= 0) return idx;
  // Check previous char is space or punctuation
  const prev = haystack[idx - 1];
  return /\s|[_\-./]/.test(prev) ? idx : -1;
}

/**
 * Ranks a match based on its position and word boundaries.
 * 
 * @param {string} str - The target string.
 * @param {string} query - The search query.
 * @returns {number} The computed rank score (lower is better).
 */
export function rankMatch(str, query) {
  const h = normalizeString(str);
  const q = normalizeString(query);
  if (!q) return Number.MAX_SAFE_INTEGER;
  if (h.startsWith(q)) return 0;
  const wb = wordBoundaryIndex(h, q);
  if (wb === 0) return 0;
  if (wb > 0) return 1;
  const any = h.indexOf(q);
  if (any >= 0) return 2 + any / 1000; // prefer earlier positions slightly
  return Infinity;
}

/**
 * Filters and sorts an array of items based on a search query.
 * @param {Array} items - The items to filter and sort.
 * @param {Object} options - The filter options.
 * @param {string} options.query - The search query.
 * @param {Function} options.getKeys - Function to extract searchable keys from an item.
 * @returns {Array} The filtered and sorted array.
 */
export function filterAndSort(items, { query, getKeys }) {
  const q = normalizeString(query || "");
  if (!q) return items.slice();
  // Build scored list
  const scored = [];
  for (const it of items) {
    const keys = (getKeys && getKeys(it)) || [];
    let best = Infinity;
    for (const k of keys) {
      const r = rankMatch(String(k || ""), q);
      if (r < best) best = r;
    }
    if (best !== Infinity) {
      scored.push({ it, score: best, key: normalizeString(keys[0] || "") });
    }
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.key.localeCompare(b.key);
  });
  return scored.map((s) => s.it);
}

/**
 * Filters items by checking if any of their searchable fields start with the query.
 * @param {Array} items - The items to filter.
 * @param {Object} options - The filter options.
 * @param {string} options.query - The search query.
 * @param {Function} [options.getKeys] - Optional function to extract keys from an item.
 * @param {Array<string>} [options.searchFields] - Optional list of property names to search in each item.
 * @returns {Array} An array of up to 20 matching items.
 */
export function filterByPrefix(items, { query, getKeys, searchFields }) {
  const q = normalizeString(query || "");
  if (!q) return [];
  return items.filter((it) => {
    if (searchFields) {
      return searchFields.some((field) =>
        normalizeString(String(it[field] || "")).includes(q)
      );
    }
    const keys = (getKeys && getKeys(it)) || [];
    return keys.some((k) => normalizeString(String(k || "")).includes(q));
  }).slice(0, 20);
}
