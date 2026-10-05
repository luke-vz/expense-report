import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

// Receipt photos. In production they live in a *private* Vercel Blob store and are only
// served through /api/photos/<key> (behind the login), so no blob URL ever reaches the
// client. Connecting a Blob store to the Vercel project sets BLOB_STORE_ID and the SDK
// authenticates with the deployment's OIDC token; BLOB_READ_WRITE_TOKEN also works.
// Without either (local dev) photos are written to ./.uploads.

const KEY_PATTERN = /^receipts\/[0-9a-f-]{36}\.jpg$/;
const LOCAL_DIR = path.join(process.cwd(), ".uploads");
const blobStorageEnabled = () => {
  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) return true;
  // Vercel's filesystem is read-only: never fall back to local disk there
  if (process.env.VERCEL) throw new Error("No Blob store configured (connect a private Blob store to the project)");
  return false;
};

// An explicit read-write token wins; otherwise the SDK uses BLOB_STORE_ID + the deployment's
// OIDC token. Passing the token explicitly matters locally: with BLOB_STORE_ID also set, the
// SDK would try OIDC, which Vercel doesn't issue for the "development" environment.
const auth = () => (process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {});

export const photoUrl = (key: string) => `/api/photos/${key}`;

/** Extracts the storage key from a photoUrl, or null if it isn't one of ours. */
export function keyFromPhotoUrl(url: string | null | undefined): string | null {
  const key = url?.startsWith("/api/photos/") ? url.slice("/api/photos/".length) : null;
  return key && isValidKey(key) ? key : null;
}

export const isValidKey = (key: string) => KEY_PATTERN.test(key);

export async function savePhoto(data: Blob): Promise<string> {
  const key = `receipts/${randomUUID()}.jpg`;
  if (blobStorageEnabled()) {
    await put(key, data, { access: "private", contentType: "image/jpeg", addRandomSuffix: false, ...auth() });
  } else {
    await mkdir(path.join(LOCAL_DIR, "receipts"), { recursive: true });
    await writeFile(path.join(LOCAL_DIR, key), Buffer.from(await data.arrayBuffer()));
  }
  return key;
}

export async function readPhoto(key: string): Promise<ReadableStream<Uint8Array> | Uint8Array | null> {
  if (!isValidKey(key)) return null;
  if (blobStorageEnabled()) {
    const result = await get(key, { access: "private", ...auth() });
    return result?.statusCode === 200 ? result.stream : null;
  }
  try {
    return new Uint8Array(await readFile(path.join(LOCAL_DIR, key)));
  } catch {
    return null;
  }
}

export async function deletePhoto(key: string): Promise<void> {
  if (!isValidKey(key)) return;
  if (blobStorageEnabled()) await del(key, auth());
  else await rm(path.join(LOCAL_DIR, key), { force: true });
}
