// Only these Google accounts can use the app. ALLOWED_EMAILS is a comma-separated list.
// Kept dependency-free so it can run in middleware (Edge runtime).
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
