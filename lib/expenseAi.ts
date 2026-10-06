// Shared by "🎤 Decí el gasto" (/api/voice) and receipt reading (/api/receipts/read and
// pending photos): Claude Haiku turns a sentence or a photo into expense fields.
// Nothing here saves anything; callers fill a form or store suggestions.
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { MAX_INSTALLMENTS } from "@/lib/installments";

// Cheapest model, chosen by the user: these are short, simple extractions
const MODEL = "claude-haiku-4-5";

export interface AiExpense {
  amount: number | null;
  currency: "ARS" | "USD";
  date: string; // "YYYY-MM-DD"
  title: string | null;
  categoryId: string | null;
  installments: number | null;
}

const SCHEMA = {
  type: "object",
  properties: {
    amount: { anyOf: [{ type: "number" }, { type: "null" }] },
    currency: { type: "string", enum: ["ARS", "USD"] },
    date: { type: "string", format: "date" },
    title: { anyOf: [{ type: "string" }, { type: "null" }] },
    categoryId: { anyOf: [{ type: "string" }, { type: "null" }] },
    installments: { anyOf: [{ type: "integer" }, { type: "null" }] },
  },
  required: ["amount", "currency", "date", "title", "categoryId", "installments"],
  additionalProperties: false,
};

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Today's date in Argentina, for server-side calls (the server runs in UTC). */
export function argentinaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

export const aiAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

type Category = { id: string; name: string };

/** Categories plus the household's habits (recent titles and where they filed them). */
async function householdContext(today: string) {
  const [categories, recent] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
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
  const text = `Hoy es ${weekday} ${today}.

Categorías disponibles (id: nombre):
${categories.map((c) => `${c.id}: ${c.name}`).join("\n")}

Cómo vienen cargando gastos (detalle → categoría):
${habits || "(todavía no hay)"}`;
  return { categories, text };
}

const COMMON_RULES = `- currency: "USD" si el gasto es en dólares; si no, "ARS".
- title: qué se compró o dónde, corto (1 a 4 palabras), con mayúscula inicial. Si coincide con un detalle del historial, usá esa misma escritura.
- categoryId: el id de la categoría que corresponda. Preferí la que se usó antes para ese detalle o comercio; si no hay historial, elegí igual la más razonable por el tipo de gasto (un supermercado o almacén va a la de comida, una factura de luz a la de servicios, etc.). null solo si ninguna tiene relación.
- installments: la cantidad de cuotas si se mencionan; si no, null. El monto es el total.`;

/** Never trust model output blindly: keep only values that make sense for the app. */
function validate(raw: Record<string, unknown>, categories: Category[], today: string, fallbackDate: string): AiExpense {
  const amount = raw.amount;
  const date = raw.date;
  const installments = raw.installments;
  return {
    amount: typeof amount === "number" && amount > 0 && amount < 1e10 ? Math.round(amount * 100) / 100 : null,
    currency: raw.currency === "USD" ? "USD" : "ARS",
    date: typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today ? date : fallbackDate,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 80) : null,
    categoryId: categories.some((c) => c.id === raw.categoryId) ? (raw.categoryId as string) : null,
    installments:
      typeof installments === "number" && Number.isInteger(installments) && installments >= 2 && installments <= MAX_INSTALLMENTS
        ? installments
        : null,
  };
}

async function extract(system: string, content: Anthropic.ContentBlockParam[]): Promise<Record<string, unknown>> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  });
  const block = response.content.find((b) => b.type === "text");
  if (response.stop_reason === "refusal" || !block || block.type !== "text") {
    throw new Error(`no structured output (${response.stop_reason})`);
  }
  return JSON.parse(block.text);
}

/** "gasté 1500 en el supermercado" -> fields. `today` comes from the client's clock. */
export async function expenseFromSentence(text: string, today: string): Promise<AiExpense> {
  const { categories, text: context } = await householdContext(today);
  const system = `Convertís una frase dicha en voz alta por alguien de Argentina en los datos de un gasto del hogar.

${context}

Reglas:
- amount: el monto en números. "lucas"/"luca" = miles ("12 lucas" = 12000), "un palo" = 1000000, "k" = miles. Si no se dice un monto, null; nunca lo inventes.
- date: la fecha del gasto. Sin mención, hoy. "ayer", "anteayer", "el lunes" (el más reciente, hoy incluido) se calculan desde hoy.
${COMMON_RULES}
- title: sin muletillas ("gasté", "en el").`;
  const raw = await extract(system, [{ type: "text", text }]);
  return validate(raw, categories, today, today);
}

/**
 * A photo of a ticket, invoice or payment screenshot (Mercado Pago, home banking) -> fields.
 * `capturedOn` is the day the photo was taken: the date used when the ticket shows none.
 */
export async function expenseFromReceipt(jpeg: Uint8Array, today: string, capturedOn = today): Promise<AiExpense> {
  const { categories, text: context } = await householdContext(today);
  const system = `Leés la foto de un comprobante de un gasto del hogar en Argentina: ticket o factura en papel, o captura de pantalla de un pago (Mercado Pago, home banking, transferencia). Devolvés los datos del gasto.

${context}

La foto se sacó el ${capturedOn}.

Reglas:
- amount: el TOTAL pagado (no subtotales, ni IVA, ni vuelto, ni ítems sueltos). En los tickets argentinos el punto separa miles y la coma decimales ("12.500,50" = 12500.5). Si no se lee un total, null; nunca lo inventes.
- date: la fecha impresa en el comprobante. Si no se ve, ${capturedOn}.
- title: el nombre comercial corto del comercio, como lo diría una persona ("Coto", no "Coto C.I.C.S.A."; sin "S.A.", "S.R.L." ni CUIT). Si no figura, qué se compró. Para una transferencia, a quién se le pagó.
- En transferencias y pagos, si hay un motivo o concepto ("plomería baño", "cuota colegio"), usalo para elegir la categoría.
${COMMON_RULES}
- Si la foto no es un comprobante de un gasto, devolvé amount, title y categoryId en null.`;
  const raw = await extract(system, [
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(jpeg).toString("base64") } },
    { type: "text", text: "Datos del gasto de este comprobante." },
  ]);
  const result = validate(raw, categories, today, capturedOn);
  return { ...result, title: result.title ? withoutCompanySuffix(result.title) : null };
}

// Tickets print the legal name: "Coto C.I.C.S.A." -> "Coto", "Farmacity S.A." -> "Farmacity"
const COMPANY_SUFFIX = /[\s,]+(s\.?\s?a\.?(\s?i\.?\s?c\.?)?|s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?\s?s\.?|c\.?\s?i\.?\s?c\.?\s?s\.?\s?a\.?)$/i;
export function withoutCompanySuffix(title: string): string {
  const cleaned = title.replace(COMPANY_SUFFIX, "").trim();
  return cleaned || title;
}
