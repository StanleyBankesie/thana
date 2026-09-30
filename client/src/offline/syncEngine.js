import api from "../api/client.js";
import { uuid } from "./uuid.js";
import {
  addQueueItem,
  getPendingItems,
  updateItemStatus,
  getAllItems,
} from "./db.js";
import { getUnsyncedSales, getFailedSales, deleteLocalSale } from "./posStore.js";

const MAX_RETRIES = 5;

let listeners = [];
let snapshot = { pending: 0, failed: 0, completed: 0, items: [] };
let isSyncing = false;
let intervalId = null;

function isOnline() {
  try {
    return navigator.onLine !== false;
  } catch {
    return true;
  }
}

function emit(event, payload) {
  snapshot = payload?.snapshot || snapshot;
  for (const l of listeners) {
    try {
      l({ event, payload, snapshot });
    } catch {}
  }
}

async function refreshSnapshot() {
  const items = await getAllItems();
  const pending = items.filter((i) => i.status === "pending").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const completed = items.filter((i) => i.status === "completed").length;
  snapshot = { pending, failed, completed, items };
  emit("update", { snapshot });
}

async function syncPosSales() {
  if (!isOnline()) return;
  try {
    const unsynced = await getUnsyncedSales();
    const failed = await getFailedSales();
    const all = [...unsynced, ...failed];
    for (const item of all) {
      try {
        const { id: _id, syncStatus: _status, createdAt: _ts, receipt_no: _rcp, updatedAt: _upd, status: _st, ...payload } = item;
        await api.post("/pos/sales", payload, {
          headers: { "x-skip-offline-queue": "1", "x-idempotency-key": String(item.id) },
        });
        await deleteLocalSale(item.id);
      } catch (err) {
        console.warn("Auto-sync error for POS offline sale:", item.id, err);
      }
    }
  } catch {}
}

export function onQueueUpdate(listener) {
  listeners.push(listener);
  listener({ event: "init", payload: {}, snapshot });
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getQueueSnapshot() {
  return snapshot;
}

export async function queueMutation({ method, url, data, headers }) {
  const id = uuid();
  const item = {
    id,
    method,
    url,
    data,
    headers: {
      ...(headers || {}),
      "x-idempotency-key": id,
      "x-transaction-id": id,
    },
    status: "pending",
    retries: 0,
    createdAt: Date.now(),
  };
  await addQueueItem(item);
  await refreshSnapshot();
  emit("queued", { id, item, snapshot });
  if (isOnline()) {
    processQueue();
  }
  return { id, queued: true, offline: !isOnline() };
}

async function sendItem(item) {
  try {
    const resp = await api.request({
      method: item.method,
      url: item.url,
      data: item.data,
      headers: item.headers,
    });
    await updateItemStatus(item.id, "completed", resp?.data || null);
    await refreshSnapshot();
    return true;
  } catch {
    item.retries += 1;
    if (item.retries >= MAX_RETRIES) {
      await updateItemStatus(item.id, "failed", null);
      await refreshSnapshot();
      return false;
    }
    const backoff = Math.min(30000, 1000 * 2 ** item.retries);
    await new Promise((r) => setTimeout(r, backoff));
    return sendItem(item);
  }
}

export async function processQueue() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    await syncPosSales();
    const items = await getPendingItems();
    for (const item of items) {
      await sendItem(item);
    }
    await refreshSnapshot();
    emit("synced", { snapshot });
  } finally {
    isSyncing = false;
  }
}

export function startSyncEngine() {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  window.addEventListener("online", () => {
    processQueue();
  });
  window.addEventListener("offline", () => {});
  if (isOnline()) {
    processQueue();
  }
  if (!intervalId) {
    intervalId = setInterval(() => {
      processQueue();
    }, 15000);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      processQueue();
    }
  });
}

export async function retryItem(id) {
  const items = snapshot.items || (await getAllItems());
  const found = items.find((i) => i.id === id);
  if (!found) return false;
  found.retries = 0;
  found.status = "pending";
  await addQueueItem(found);
  await refreshSnapshot();
  emit("retry", { id, snapshot });
  return sendItem(found);
}

export async function retryAllFailed() {
  const items = snapshot.items || (await getAllItems());
  const failed = items.filter((i) => i.status === "failed");
  for (const item of failed) {
    await retryItem(item.id);
  }
  await refreshSnapshot();
  emit("retryAll", { snapshot });
}

export async function syncNow() {
  await processQueue();
}
