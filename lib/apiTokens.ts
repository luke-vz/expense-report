// Personal keys for the iPhone Atajos shortcut (it can't do the Google login).
// The key is shown once; only its SHA-256 hash is stored.
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isAllowedEmail } from "@/lib/allowlist";

export const generateToken = () => `gst_${randomBytes(32).toString("base64url")}`;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** The owner of the "Authorization: Bearer <key>" header, or null if missing/revoked/not allowed. */
export async function authenticateToken(req: Request): Promise<{ email: string; name: string | null } | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(gst_[A-Za-z0-9_-]+)$/)?.[1];
  if (!token) return null;

  const record = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(token) } });
  // Removing someone from ALLOWED_EMAILS disables their keys too
  if (!record || !isAllowedEmail(record.email)) return null;

  await prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return { email: record.email, name: record.name };
}
