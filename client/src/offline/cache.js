import { openDB } from "./db.js";

const CACHE_STORE = "cache";

export async function putCache(key, data) {
  try {
    const db = await openDB();

    // Check if store exists
    if (!db.objectStoreNames.contains(CACHE_STORE)) {
      console.warn("Cache store not available, skipping cache");
      return false;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      const store = tx.objectStore(CACHE_STORE);
      store.put({ key, data, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn("Failed to cache data:", error);
    return false;
  }
}

export async function getCache(key) {
  try {
    const db = await openDB();

    // Check if store exists
    if (!db.objectStoreNames.contains(CACHE_STORE)) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readonly");
      const store = tx.objectStore(CACHE_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn("Failed to retrieve cached data:", error);
    return null;
  }
}

export async function clearGeneralCache() {
  try {
    const db = await openDB();

    if (!db.objectStoreNames.contains(CACHE_STORE)) {
      return false;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      const store = tx.objectStore(CACHE_STORE);
      store.clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn("Failed to clear cache:", error);
    return false;
  }
}

export async function deleteCacheByUrlPrefixes(prefixes = []) {
  try {
    const normalizedPrefixes = prefixes
      .map((prefix) => String(prefix || "").trim())
      .filter(Boolean);
    if (!normalizedPrefixes.length) {
      return false;
    }

    const db = await openDB();
    if (!db.objectStoreNames.contains(CACHE_STORE)) {
      return false;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      const store = tx.objectStore(CACHE_STORE);
      const req = store.openCursor();

      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const key = String(cursor.value?.key || "");
        if (normalizedPrefixes.some((prefix) => key.includes(prefix))) {
          cursor.delete();
        }
        cursor.continue();
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn("Failed to delete cache entries by prefix:", error);
    return false;
  }
}
