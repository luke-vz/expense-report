import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authenticateToken } from "@/lib/apiTokens";
import { aiAvailable, argentinaToday, expenseFromSentence } from "@/lib/expenseAi";
import { createExpenses, findDuplicate, type NewExpense } from "@/lib/expenseStore";
import { formatAmount, formatDate } from "@/lib/format";

const MAX_TEXT = 300;

/**
 * The dictated sentence, whatever body type Atajos was set to: JSON { text }, form fields
 * (urlencoded or multipart) with `text`, or the plain body. Lenient on purpose: a wrong
 * "Cuerpo de la solicitud" choice on the phone shouldn't break the shortcut.
 */
async function sentenceFrom(req: NextRequest): Promise<string> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const value = form?.get("text") ?? [...(form?.values() ?? [])].find((v) => typeof v === "string" && v.trim());
    return typeof value === "string" ? value.trim() : "";
  }
  const raw = (await req.text().catch(() => "")).trim();
  // JSON first, whatever the declared content type (a JSON body sent as a "form" still works)
  try {
    const json = JSON.parse(raw);
    if (typeof json?.text === "string") return json.text.trim();
    if (typeof json === "string") return json.trim();
  } catch {
    // not JSON
  }
  if (type.includes("application/x-www-form-urlencoded")) {
    const form = new URLSearchParams(raw);
    const value = form.get("text") ?? [...form.values()].find((v) => v.trim());
    if (value) return value.trim();
  }
  return raw;
}

// Atajos defaults to GET: answer with the fix instead of a bare 405, it shows in the notification
export function GET() {
  return reply('En el atajo, en "Obtener contenido de URL", cambiá el Método a POST.', 405);
}

// Plain text: the Atajos shortcut shows the response as-is in a notification
const reply = (message: string, status = 200) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

const dayLabel = (day: string, today: string) => {
  const [y, m, d] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  return day === today ? "hoy" : day === yesterday ? "ayer" : formatDate(day);
};

// POST /api/shortcuts/voice?key=<personal key> — called by the iPhone "Anotar gasto"
// shortcut (Siri, widget, Action button) with the dictated sentence in the body (any format,
// see sentenceFrom). Outside the session middleware on purpose: the key authenticates.
//
// Complete sentences are saved right away. Two cases go to "Pendientes" instead, to be
// finished in the app: something missing (amount or category), or a possible duplicate
// (the shortcut has no way to ask for confirmation).
export async function POST(req: NextRequest) {
  // ?dryRun=1 (the "Probar" button on /shortcuts): interpret and report, never save
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const user = await authenticateToken(req, { touch: !dryRun });
  if (!user) return reply("La clave no es válida o fue revocada. Generá una nueva en la app.", 401);
  if (!aiAvailable()) return reply("La IA no está configurada en la app.", 503);

  const text = await sentenceFrom(req);
  if (!text) return reply("No llegó ningún texto. ¿Se dictó algo?", 400);
  if (text.length > MAX_TEXT) return reply("El texto es demasiado largo.", 400);

  const today = argentinaToday();
  let ai;
  try {
    ai = await expenseFromSentence(text, today);
  } catch (err) {
    console.error("shortcut voice parse failed", err);
    return reply("No pude interpretar el gasto. Probá de nuevo o cargalo en la app.", 502);
  }

  const author = { createdBy: user.email, createdByName: user.name };
  const category = ai.categoryId
    ? await prisma.category.findUnique({ where: { id: ai.categoryId }, select: { name: true } })
    : null;
  const installments =
    ai.installments && ai.amount && Math.round(ai.amount * 100) >= ai.installments ? ai.installments : 1;

  const toPending = async (reason: string) => {
    if (dryRun) return reply(`Prueba OK. Esto quedaría en Pendientes (${reason}).`);
    // No `note`: on completion a note would win over the AI's cleaner title ("Supermercado")
    await prisma.pendingExpense.create({
      data: {
        createdBy: user.email,
        aiStatus: "done",
        suggestedAmount: ai.amount,
        suggestedCurrency: ai.currency,
        suggestedTitle: ai.title,
        suggestedCategoryId: ai.categoryId,
        suggestedDate: new Date(ai.date),
        suggestedInstallments: ai.installments,
      },
    });
    return reply(`Quedó en Pendientes (${reason}): "${text}". Completalo en la app.`);
  };

  if (!ai.amount && !category) return toPending("no entendí el monto ni la categoría");
  if (!ai.amount) return toPending("no entendí el monto");
  if (!category || !ai.categoryId) return toPending("no supe la categoría");

  const data: NewExpense = {
    title: ai.title ?? category.name,
    amount: new Prisma.Decimal(ai.amount.toFixed(2)),
    categoryId: ai.categoryId,
    date: new Date(ai.date),
    currency: ai.currency,
  };
  if (installments === 1 && (await findDuplicate(data))) {
    return toPending("parece repetido de uno ya cargado");
  }

  const parts = [
    formatAmount(ai.amount, ai.currency),
    data.title,
    category.name,
    dayLabel(ai.date, today),
    installments > 1 && `${installments} cuotas`,
  ].filter(Boolean);
  if (dryRun) return reply(`Prueba OK. Se guardaría: ${parts.join(" · ")}`);

  try {
    await createExpenses(data, { installments, author });
  } catch (err) {
    console.error("shortcut voice save failed", err);
    return reply("No pude guardar el gasto. Probá de nuevo o cargalo en la app.", 500);
  }
  return reply(`Guardado: ${parts.join(" · ")}`);
}
