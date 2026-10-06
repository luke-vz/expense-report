// Personal keys for the iPhone Atajos shortcut (it can't do the Google login).
// The key is shown once; only its SHA-256 hash is stored.
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isAllowedEmail } from "@/lib/allowlist";

export const generateToken = () => `gst_${randomBytes(32).toString("base64url")}`;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * The owner of the key, or null if missing/revoked/not allowed. The key can come in the URL
 * (`?key=gst_…`, the simplest setup in Atajos: one URL to paste, no headers) or as
 * "Authorization: Bearer gst_…".
 */
export async function authenticateToken(
  req: Request,
  { touch = true }: { touch?: boolean } = {}
): Promise<{ email: string; name: string | null } | null> {
  const fromQuery = new URL(req.url).searchParams.get("key")?.trim();
  const fromHeader = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(gst_[A-Za-z0-9_-]+)$/)?.[1];
  const token = fromQuery && /^gst_[A-Za-z0-9_-]+$/.test(fromQuery) ? fromQuery : fromHeader;
  if (!token) return null;

  const record = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(token) } });
  // Removing someone from ALLOWED_EMAILS disables their keys too
  if (!record || !isAllowedEmail(record.email)) return null;

  // "Último uso" tells whether the phone's shortcut is reaching us: tests from the page don't count
  if (touch) await prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return { email: record.email, name: record.name };
}
