import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/apiTokens";

// GET /api/tokens — the signed-in user's Atajos keys (never the keys themselves)
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await prisma.apiToken.findMany({
    where: { email },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tokens);
}

// POST /api/tokens { label } — creates a key and returns it once
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : "iPhone";
  const token = generateToken();
  const created = await prisma.apiToken.create({
    data: { tokenHash: hashToken(token), email, name: session.user?.name ?? null, label },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true },
  });
  return NextResponse.json({ ...created, token });
}
