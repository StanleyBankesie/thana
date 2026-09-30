import { openDB } from "./db.js";

const POS_SALES_STORE = "pos_sales";

async function withStore(mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(POS_SALES_STORE, mode);
    const store = tx.objectStore(POS_SALES_STORE);
    callback(store, resolve, reject);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveLocalSale(sale) {
  return withStore("readwrite", (store, resolve, reject) => {
    const req = store.put({ ...sale, updatedAt: Date.now() });
    req.onerror = () => reject(req.error);
    req.transaction.oncomplete = () => resolve(req.result);
  });
}

export async function getLocalSale(id) {
  return withStore("readonly", (store, resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllLocalSales(status) {
  return withStore("readonly", (store, resolve, reject) => {
    if (status) {
      const idx = store.index("status");
      const req = idx.getAll(status);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } else {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }
  });
}

export async function deleteLocalSale(id) {
  return withStore("readwrite", (store, resolve, reject) => {
    const req = store.delete(id);
    req.onerror = () => reject(req.error);
    req.transaction.oncomplete = () => resolve();
  });
}

export async function getUnsyncedSales() {
  return getAllLocalSales("pending");
}

export async function getFailedSales() {
  return getAllLocalSales("failed");
}
