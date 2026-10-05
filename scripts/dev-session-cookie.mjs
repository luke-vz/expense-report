// Prints a NextAuth session cookie for local testing (curl, Playwright) without going
// through Google. It is signed with NEXTAUTH_SECRET from .env, so it only works against
// a server using that same secret.
//
//   node --env-file=.env scripts/dev-session-cookie.mjs [email] [name]
//   curl -b "$(node --env-file=.env scripts/dev-session-cookie.mjs)" localhost:3100/api/expenses
import { encode } from "next-auth/jwt";

const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  console.error("NEXTAUTH_SECRET is not set (run with --env-file=.env)");
  process.exit(1);
}

const email = process.argv[2] ?? process.env.ALLOWED_EMAILS?.split(",")[0]?.trim();
const name = process.argv[3] ?? email;
const token = await encode({ token: { email, name, sub: email }, secret });
console.log(`next-auth.session-token=${token}`);
