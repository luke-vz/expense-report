// Turns a dictated (or typed) sentence into expense fields, without AI:
//   "Gasté 1500 en el supermercado" -> $1500 · "Supermercado" · Comida · today
// Meant for the phone keyboard's dictation, so it expects what keyboards produce
// ("1500", "1.500", "mil quinientos") plus Argentine slang ("12 lucas", "un palo").
// Anything it can't find is left undefined for the user to fill in.
import type { Category, Suggestion } from "@/lib/expenses";
import { parseAmount } from "@/lib/format";
import { MAX_INSTALLMENTS } from "@/lib/installments";

export interface SpokenExpense {
  amount?: number;
  currency?: "ARS" | "USD";
  date?: string; // "YYYY-MM-DD"
  installments?: number;
  title?: string;
  categoryId?: string;
}

export interface SpokenContext {
  categories: Pick<Category, "id" | "name">[];
  suggestions: Suggestion[];
  today: string; // "YYYY-MM-DD", local
}

const normalize = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---------- numbers written as words ----------

const UNITS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300,
  trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800,
  ochocientas: 800, novecientos: 900, novecientas: 900,
};
const SCALES: Record<string, number> = { mil: 1_000, millon: 1_000_000, millones: 1_000_000 };
// Slang multipliers that follow a number: "12 lucas" = 12.000, "un palo" = 1.000.000
const SLANG: Record<string, number> = {
  luca: 1_000, lucas: 1_000, luquita: 1_000, luquitas: 1_000, palo: 1_000_000, palos: 1_000_000,
};

const isNumberWord = (w: string) => w in UNITS || w in SCALES || w === "y";

/** ["mil", "quinientos"] -> 1500; ["doscientos", "cincuenta"] -> 250 */
function wordsToNumber(words: string[]): number {
  let total = 0;
  let current = 0;
  for (const w of words) {
    if (w === "y") continue;
    if (w in UNITS) current += UNITS[w];
    else if (w === "mil") {
      total += (current || 1) * 1_000;
      current = 0;
    } else if (w in SCALES) {
      total += (current || 1) * SCALES[w];
      current = 0;
    }
  }
  return total + current;
}

// ---------- dates ----------

const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Most recent occurrence of a weekday, today included ("el lunes" said on a Monday = today). */
function lastWeekday(today: string, weekday: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const todayWeekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return shiftDay(today, -((todayWeekday - weekday + 7) % 7));
}

// ---------- categories ----------

// Fallback when nothing like it was loaded before: keyword -> category names to try, in order
const KEYWORDS: Record<string, string[]> = {};
const addKeywords = (categoryNames: string[], words: string) =>
  words.split(" ").forEach((w) => (KEYWORDS[w] = categoryNames));
addKeywords(["Comida"], "supermercado super almacen verduleria verdura carniceria carne panaderia pan chino mercado fiambreria helado heladeria pizza empanadas comida delivery rotiseria coto carrefour jumbo disco dia vea");
addKeywords(["Transporte"], "colectivo bondi subte tren nafta combustible uber cabify didi taxi remis peaje estacionamiento sube");
addKeywords(["Servicios"], "luz gas agua internet celular telefono expensas cable edenor edesur metrogas aysa wifi");
addKeywords(["Ocio", "Entretenimiento"], "cine teatro recital salida bar cerveza birra restaurante resto boliche netflix spotify");
addKeywords(["Casa"], "ferreteria limpieza muebles pintura bazar");
addKeywords(["Salud", "Otros"], "farmacia remedios medicamentos medico");
addKeywords(["Colegio"], "colegio escuela utiles");

// Words that carry no meaning for the title
const FILLER = new Set(
  "gaste gastamos gasto pague pagamos pago compre compramos compro fueron fue son es salio salieron se me nos en de del por para el la los las un una al con a y que".split(" ")
);

// ---------- main ----------

export function parseSpokenExpense(input: string, ctx: SpokenContext): SpokenExpense {
  // Keep the original spelling for the title, compare on normalized words
  const raw = input
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^[¡¿"'(]+|[.,;:!?"')]+$/g, ""))
    .filter(Boolean);
  const words = raw.map(normalize);
  const used = new Array(words.length).fill(false);
  const result: SpokenExpense = {};

  // Installments: "en 6 cuotas", "seis cuotas"
  const cuotasAt = words.findIndex((w) => w === "cuotas" || w === "cuota");
  if (cuotasAt > 0) {
    const n = /^\d+$/.test(words[cuotasAt - 1]) ? Number(words[cuotasAt - 1]) : UNITS[words[cuotasAt - 1]];
    if (n >= 2 && n <= MAX_INSTALLMENTS) {
      result.installments = n;
      used[cuotasAt] = used[cuotasAt - 1] = true;
      if (words[cuotasAt - 2] === "en") used[cuotasAt - 2] = true;
    }
  }

  // Amount: digits ("1500", "1.500", "$1500", "15k") or number words, plus slang/scale
  for (let i = 0; i < words.length && result.amount === undefined; i++) {
    if (used[i]) continue;
    const w = words[i].replace(/^\$/, "");
    let value = NaN;
    let end = i; // last token consumed
    if (/^\d[\d.,]*k$/.test(w)) value = parseAmount(w.slice(0, -1)) * 1_000;
    else if (/^\d[\d.,]*$/.test(w)) value = parseAmount(w);
    else if (w in UNITS || w in SCALES) {
      // A run of number words: "mil quinientos", "doscientos cincuenta"
      while (end + 1 < words.length && isNumberWord(words[end + 1]) && !used[end + 1]) end++;
      if (words[end] === "y") end--;
      value = wordsToNumber(words.slice(i, end + 1));
      // "un"/"una" alone is an article, not an amount, unless a multiplier follows
      if (["un", "una", "uno"].includes(w) && end === i && !(words[i + 1] in SLANG)) value = NaN;
    }
    if (!(value > 0)) continue;
    const next = words[end + 1];
    if (next in SLANG || next === "mil") {
      value *= next === "mil" ? 1_000 : SLANG[next];
      end++;
    }
    result.amount = Math.round(value * 100) / 100;
    for (let k = i; k <= end; k++) used[k] = true;
  }

  // Currency
  words.forEach((w, i) => {
    if (["dolares", "dolar", "usd", "u$s", "verdes"].includes(w)) {
      result.currency = "USD";
      used[i] = true;
    } else if (["pesos", "peso", "$"].includes(w)) {
      result.currency ??= "ARS";
      used[i] = true;
    }
  });

  // Date: hoy / ayer / anteayer / antes de ayer / (el) lunes…
  words.forEach((w, i) => {
    if (used[i]) return;
    if (w === "hoy") result.date = ctx.today;
    else if (w === "anteayer") result.date = shiftDay(ctx.today, -2);
    else if (w === "ayer") {
      const antesDe = words[i - 2] === "antes" && words[i - 1] === "de";
      result.date = shiftDay(ctx.today, antesDe ? -2 : -1);
      if (antesDe) used[i - 2] = used[i - 1] = true;
    } else if (WEEKDAYS.includes(w)) {
      result.date = lastWeekday(ctx.today, WEEKDAYS.indexOf(w));
      if (words[i - 1] === "el") used[i - 1] = true;
    } else return;
    used[i] = true;
  });

  // Title: what's left after removing what was understood and the filler words
  const titleWords = raw.filter((_, i) => !used[i] && !FILLER.has(words[i]));
  if (titleWords.length) {
    const title = titleWords.join(" ");
    result.title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  result.categoryId = guessCategory(result.title, ctx);
  return result;
}

function guessCategory(title: string | undefined, ctx: SpokenContext): string | undefined {
  if (!title) return undefined;
  const t = normalize(title);
  const known = (id: string) => ctx.categories.some((c) => c.id === id);

  // 1. What they used before for this title (suggestions come sorted by use)
  const learned = ctx.suggestions.find((s) => normalize(s.title) === t) ??
    ctx.suggestions.find((s) => normalize(s.title).includes(t) || t.includes(normalize(s.title)));
  if (learned && known(learned.categoryId)) return learned.categoryId;

  const titleWords = t.split(/\s+/);
  // 2. A word that is a category name ("comida", "transporte")
  const byName = ctx.categories.find((c) => titleWords.includes(normalize(c.name)));
  if (byName) return byName.id;

  // 3. Built-in keywords, only for categories that exist
  for (const w of titleWords) {
    for (const name of KEYWORDS[w] ?? []) {
      const category = ctx.categories.find((c) => normalize(c.name) === normalize(name));
      if (category) return category.id;
    }
  }
  return undefined;
}
