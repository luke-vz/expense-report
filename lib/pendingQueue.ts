// Offline-safe saving of pending expenses (quick entry and photo capture).
// When the phone has no connection the pending waits in IndexedDB and is sent when the
// connection comes back (or the next time the app opens). No Background Sync: iOS lacks it.
"use client";

import { notifyPendingChanged } from "@/lib/usePendingCount";

export interface PendingFields {
  amount?: number;
  note?: string;
  suggestedAmount?: number;
  suggestedCurrency?: string;
  suggestedTitle?: string;
  suggestedCategoryId?: string;
  suggestedDate?: string;
  suggestedInstallments?: number;
}

interface QueuedPending {
  id?: number;
  fields: PendingFields;
  photo: Blob | null;
}

const DB = "expense-report";
const STORE = "pending-queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

const toForm = ({ fields, photo }: QueuedPending) => {
  const form = new FormData();
  if (photo) form.append("photo", photo, "photo.jpg");
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== "") form.append(key, String(value));
  }
  return form;
};

/** "network": no connection (or the server never answered). Otherwise the HTTP status. */
async function post(item: QueuedPending): Promise<"ok" | "network" | number> {
  try {
    const res = await fetch("/api/pending", { method: "POST", body: toForm(item) });
    return res.ok ? "ok" : res.status;
  } catch {
    return "network";
  }
}

/**
 * Saves a pending expense: right away when online, queued on this phone otherwise.
 * "error" means the server rejected it (nothing was queued).
 */
export async function savePending(fields: PendingFields, photo: Blob | null = null): Promise<"saved" | "queued" | "error"> {
  const item = { fields, photo };
  const result = navigator.onLine ? await post(item) : "network";
  if (result === "ok") {
    notifyPendingChanged();
    return "saved";
  }
  if (result !== "network") return "error";
  await withStore("readwrite", (store) => store.add(item));
  return "queued";
}

let flushing = false;

/** Sends whatever was saved offline. Safe to call any time; stops at the first failure. */
export async function flushPendingQueue(): Promise<void> {
  if (flushing || !navigator.onLine || typeof indexedDB === "undefined") return;
  flushing = true;
  try {
    const items = await withStore<QueuedPending[]>("readonly", (store) => store.getAll());
    let sent = false;
    for (const item of items) {
      const result = await post(item);
      // 400: the server will never accept it, so it's dropped instead of blocking the queue.
      // Anything else (offline, 401 with an expired session, 5xx) is retried later.
      if (result === "ok" || result === 400) {
        await withStore("readwrite", (store) => store.delete(item.id!));
        sent ||= result === "ok";
      } else {
        break;
      }
    }
    if (sent) notifyPendingChanged();
  } catch (err) {
    console.error("pending queue flush failed", err);
  } finally {
    flushing = false;
  }
}
