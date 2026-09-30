const DB_NAME = "omnisuite_offline";
const DB_VERSION = 5; // bumped from 4 to add pos_cache store
const QUEUE_STORE = "queue";
const CACHE_STORE = "cache";
const POS_SALES_STORE = "pos_sales";
const POS_CACHE_STORE = "pos_cache"; // NEW: key-value store for POS reference data

let _db = null;

export async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;

      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        const store = db.createObjectStore(CACHE_STORE, { keyPath: "key" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(POS_SALES_STORE)) {
        const store = db.createObjectStore(POS_SALES_STORE, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      // NEW: Dedicated store for POS reference data (payment modes, tax, customers etc.)
      if (!db.objectStoreNames.contains(POS_CACHE_STORE)) {
        const store = db.createObjectStore(POS_CACHE_STORE, { keyPath: "key" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        _db = null;
      };
      db.onclose = () => {
        _db = null;
      };
      _db = db;
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

export function closeDB() {
  if (_db) {
    try { _db.close(); } catch {}
    _db = null;
  }
}

export async function addQueueItem(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingItems() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const store = tx.objectStore(QUEUE_STORE);
    const idx = store.index("status");
    const req = idx.getAll("pending");
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function updateItemStatus(id, status, response) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    const store = tx.objectStore(QUEUE_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) return resolve(null);
      existing.status = status;
      existing.response = response || null;
      store.put(existing);
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllItems() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const store = tx.objectStore(QUEUE_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteItem(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ── POS Cache helpers ─────────────────────────────────────────────────────────

export async function putPosCache(key, data) {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(POS_CACHE_STORE)) return false;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(POS_CACHE_STORE, "readwrite");
      tx.objectStore(POS_CACHE_STORE).put({ key, data, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return false;
  }
}

export async function getPosCache(key) {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(POS_CACHE_STORE)) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(POS_CACHE_STORE, "readonly");
      const req = tx.objectStore(POS_CACHE_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearPosCache() {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(POS_CACHE_STORE)) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(POS_CACHE_STORE, "readwrite");
      tx.objectStore(POS_CACHE_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}
