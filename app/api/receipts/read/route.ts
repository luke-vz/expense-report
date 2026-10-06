import { NextRequest, NextResponse } from "next/server";
import { aiAvailable, expenseFromReceipt } from "@/lib/expenseAi";

// Compressed on the phone to ~200-400 KB; this is just a safety cap
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

// POST /api/receipts/read — multipart: photo (image/jpeg), today (YYYY-MM-DD).
// Reads a ticket or payment screenshot attached in "Nuevo gasto" and returns the fields
// to fill. Nothing is saved.
export async function POST(req: NextRequest) {
  if (!aiAvailable()) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  const today = form?.get("today");
  if (!(photo instanceof Blob) || photo.type !== "image/jpeg" || photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Expected photo: image/jpeg up to 4 MB" }, { status: 400 });
  }
  if (typeof today !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return NextResponse.json({ error: "Expected today: YYYY-MM-DD" }, { status: 400 });
  }

  try {
    return NextResponse.json(await expenseFromReceipt(new Uint8Array(await photo.arrayBuffer()), today));
  } catch (err) {
    console.error("receipt read failed", err);
    return NextResponse.json({ error: "Could not read the receipt" }, { status: 502 });
  }
}
