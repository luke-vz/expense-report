import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { savePhoto } from "@/lib/photos";
import { serializePending } from "@/lib/pending";

// Compressed on the phone to ~200-400 KB; this is just a safety cap
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

// GET /api/pending — oldest first, so the backlog gets cleared in order
export async function GET() {
  const pending = await prisma.pendingExpense.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(pending.map(serializePending));
}

// POST /api/pending — multipart form: photo (image/jpeg, optional), amount, note
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });

  const photo = form.get("photo");
  const amountRaw = form.get("amount");
  const noteRaw = form.get("note");

  if (photo !== null && !(photo instanceof Blob && photo.type === "image/jpeg")) {
    return NextResponse.json({ error: "Invalid photo: expected image/jpeg" }, { status: 400 });
  }
  if (photo && photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Photo too large" }, { status: 400 });
  }

  let amount: Prisma.Decimal | null = null;
  if (typeof amountRaw === "string" && amountRaw !== "") {
    const n = Number(amountRaw);
    if (!Number.isFinite(n) || n <= 0 || n > 9_999_999_999.99) {
      return NextResponse.json({ error: "Invalid amount: must be a positive number" }, { status: 400 });
    }
    amount = new Prisma.Decimal(n.toFixed(2));
  }
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim() : null;

  if (!photo && !amount) {
    return NextResponse.json({ error: "A photo or an amount is required" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const photoKey = photo ? await savePhoto(photo) : null;
  const pending = await prisma.pendingExpense.create({
    data: { photoKey, amount, note, createdBy: session?.user?.email ?? null },
  });
  return NextResponse.json(serializePending(pending));
}
