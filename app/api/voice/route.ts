import { NextRequest, NextResponse } from "next/server";
import { aiAvailable, expenseFromSentence } from "@/lib/expenseAi";

const MAX_TEXT = 300;

// POST /api/voice { text, today } — a spoken sentence ("gasté 1500 en el supermercado")
// turned into expense fields by Claude. Nothing is saved: the client fills the form.
export async function POST(req: NextRequest) {
  if (!aiAvailable()) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  // The client sends its local date: the server runs in UTC and would be a day ahead at night
  const today = typeof body?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null;
  if (!text || text.length > MAX_TEXT || !today) {
    return NextResponse.json({ error: "Expected { text, today: YYYY-MM-DD }" }, { status: 400 });
  }

  try {
    return NextResponse.json(await expenseFromSentence(text, today));
  } catch (err) {
    console.error("voice parse failed", err);
    return NextResponse.json({ error: "Could not interpret the sentence" }, { status: 502 });
  }
}
