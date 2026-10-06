import { NextRequest, NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { savePhoto } from "@/lib/photos";
import { serializePending } from "@/lib/pending";
import { aiAvailable, argentinaToday, expenseFromReceipt } from "@/lib/expenseAi";

// Compressed on the phone to ~200-400 KB; this is just a safety cap
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

// GET /api/pending — oldest first, so the backlog gets cleared in order
export async function GET() {
  const pending = await prisma.pendingExpense.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(pending.map(serializePending));
}

// POST /api/pending — multipart form: photo (image/jpeg, optional), amount, note,
// skipAi ("1" when the photo is only being attached to an expense saved right away)
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
  const readPhoto = Boolean(photo) && form.get("skipAi") !== "1" && aiAvailable();
  const pending = await prisma.pendingExpense.create({
    data: { photoKey, amount, note, createdBy: session?.user?.email ?? null, aiStatus: readPhoto ? "reading" : null },
  });

  // Capture stays instant: the AI reads the photo after the response is sent
  if (photo && readPhoto) {
    const jpeg = new Uint8Array(await photo.arrayBuffer());
    const today = argentinaToday();
    after(async () => {
      try {
        const ai = await expenseFromReceipt(jpeg, today, today);
        // updateMany: a no-op if the pending was completed or discarded meanwhile
        await prisma.pendingExpense.updateMany({
          where: { id: pending.id },
          data: {
            aiStatus: "done",
            suggestedAmount: ai.amount,
            suggestedCurrency: ai.currency,
            suggestedTitle: ai.title,
            suggestedCategoryId: ai.categoryId,
            suggestedDate: new Date(ai.date),
            suggestedInstallments: ai.installments,
          },
        });
      } catch (err) {
        console.error("pending receipt read failed", err);
        await prisma.pendingExpense.updateMany({ where: { id: pending.id }, data: { aiStatus: "failed" } });
      }
    });
  }
  return NextResponse.json(serializePending(pending));
}
