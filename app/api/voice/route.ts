import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { MAX_INSTALLMENTS } from "@/lib/installments";

// Cheapest model, chosen by the user: turning one short sentence into fields is a simple task
const MODEL = "claude-haiku-4-5";
const MAX_TEXT = 300;

const SCHEMA = {
  type: "object",
  properties: {
    amount: { anyOf: [{ type: "number" }, { type: "null" }], description: "Monto. null si no se dijo." },
    currency: { type: "string", enum: ["ARS", "USD"] },
    date: { type: "string", format: "date", description: "YYYY-MM-DD" },
    title: { anyOf: [{ type: "string" }, { type: "null" }], description: "Qué se compró o dónde, 1 a 4 palabras" },
    categoryId: { anyOf: [{ type: "string" }, { type: "null" }] },
    installments: { anyOf: [{ type: "integer" }, { type: "null" }] },
  },
  required: ["amount", "currency", "date", "title", "categoryId", "installments"],
  additionalProperties: false,
};

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// POST /api/voice { text, today } — a spoken sentence ("gasté 1500 en el supermercado")
// turned into expense fields by Claude. Nothing is saved: the client fills the form.
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  // The client sends its local date: the server runs in UTC and would be a day ahead at night
  const today = typeof body?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null;
  if (!text || text.length > MAX_TEXT || !today) {
    return NextResponse.json({ error: "Expected { text, today: YYYY-MM-DD }" }, { status: 400 });
  }

  const [categories, recent] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // What they usually call things and where they file them, so the model learns their habits
    prisma.expense.findMany({
      where: { OR: [{ installmentNumber: null }, { installmentNumber: 1 }] },
      select: { title: true, category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
  ]);
  const habits = [...new Map(recent.map((e) => [e.title.toLowerCase(), `${e.title} → ${e.category.name}`])).values()]
    .slice(0, 60)
    .join("\n");
  const [y, m, d] = today.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];

  const system = `Convertís una frase dicha en voz alta por alguien de Argentina en los datos de un gasto del hogar.

Hoy es ${weekday} ${today}.

Categorías disponibles (id: nombre):
${categories.map((c) => `${c.id}: ${c.name}`).join("\n")}

Cómo vienen cargando gastos (detalle → categoría):
${habits || "(todavía no hay)"}

Reglas:
- amount: el monto en números. "lucas"/"luca" = miles ("12 lucas" = 12000), "un palo" = 1000000, "k" = miles. Si no se dice un monto, null; nunca lo inventes.
- currency: "USD" si dice dólares/USD/verdes; si no, "ARS".
- date: la fecha del gasto. Sin mención, hoy. "ayer", "anteayer", "el lunes" (el más reciente, hoy incluido) se calculan desde hoy.
- title: qué se compró o dónde, corto (1 a 4 palabras), con mayúscula inicial y sin muletillas ("gasté", "en el"). Si coincide con un detalle del historial, usá esa misma escritura.
- categoryId: el id de la categoría que corresponda. Preferí la que se usó antes para ese detalle. Si ninguna encaja razonablemente, null.
- installments: la cantidad de cuotas si se mencionan ("en 6 cuotas"); si no, null. El monto dicho es el total.`;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: text }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });
    const block = response.content.find((b) => b.type === "text");
    if (response.stop_reason === "refusal" || !block || block.type !== "text") throw new Error(response.stop_reason ?? "no text");
    const raw = JSON.parse(block.text);

    // Never trust model output blindly: keep only values that make sense for the app
    const result = {
      amount: typeof raw.amount === "number" && raw.amount > 0 && raw.amount < 1e10 ? Math.round(raw.amount * 100) / 100 : null,
      currency: raw.currency === "USD" ? "USD" : "ARS",
      date: typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) && raw.date <= today ? raw.date : today,
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 80) : null,
      categoryId: categories.some((c) => c.id === raw.categoryId) ? raw.categoryId : null,
      installments:
        Number.isInteger(raw.installments) && raw.installments >= 2 && raw.installments <= MAX_INSTALLMENTS
          ? raw.installments
          : null,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("voice parse failed", err);
    return NextResponse.json({ error: "Could not interpret the sentence" }, { status: 502 });
  }
}
