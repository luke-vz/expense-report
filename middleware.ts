import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAllowedEmail } from "@/lib/allowlist";

// Every page and API route requires a session from an allowed Google account.
// The allowlist is re-checked on each request, so removing an email revokes access
// even for sessions that are still valid.
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token && isAllowedEmail(token.email)) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Public: NextAuth's own routes, the login page, Next internals, the PWA manifest/icons
  // (browsers fetch those without cookies) and api/shortcuts, which authenticates with a
  // personal key instead of the session (the iPhone shortcut can't do the Google login)
  matcher: ["/((?!api/auth|api/shortcuts/|login|_next/|icons/|manifest.webmanifest|favicon.ico).*)"],
};
