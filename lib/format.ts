// lib/format.ts
// Expense dates are DATE columns, so the API returns them as "YYYY-MM-DDT00:00:00.000Z".
// Read the calendar day from the string instead of going through new Date(), which would
// shift it to the previous day in Argentina (UTC-3).

const pad = (n: number) => n.toString().padStart(2, "0");

/** "2026-09-26T00:00:00.000Z" -> "26/09/2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-09-26T00:00:00.000Z" -> "2026-09" */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** "2026-09" -> "sept 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("es-AR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today's local date as "YYYY-MM-DD" (toISOString would give the UTC day). */
export function todayISO(): string {
  return daysAgoISO(0);
}

/** Local date `days` days ago as "YYYY-MM-DD". */
export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalISODate(d);
}

/** A Date's local calendar day as "YYYY-MM-DD". */
export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString("en-us", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Amount with its currency sign: "$1,500.00" (ARS) or "US$ 15.99" (USD). */
export function formatAmount(amount: number, currency = "ARS"): string {
  return currency === "USD" ? `US$ ${formatMoney(amount)}` : `$${formatMoney(amount)}`;
}

/** "Heladera" + installment 2 of 6 -> "Heladera 2/6". */
export function expenseTitle(e: { title: string; installmentNumber?: number | null; installmentCount?: number | null }) {
  return e.installmentNumber && e.installmentCount ? `${e.title} ${e.installmentNumber}/${e.installmentCount}` : e.title;
}

/**
 * Parses an amount as typed on an Argentine keyboard. A comma is the decimal separator
 * and dots are thousands separators ("1.500,50" -> 1500.5). Without a comma, a dot is
 * read as thousands when followed by exactly three digits ("1.500" -> 1500) and as a
 * decimal point otherwise ("12.5" -> 12.5). Returns NaN for anything else.
 */
export function parseAmount(input: string): number {
  const s = input.trim().replace(/^\$\s*/, "");
  if (!/^[\d.,]+$/.test(s)) return NaN;

  let normalized: string;
  if (s.includes(",")) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, "");
  } else {
    normalized = s;
  }
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

/** 1500.5 -> "1500,5", for prefilling the amount input in the format parseAmount expects. */
export function toAmountInput(amount: number): string {
  return amount.toString().replace(".", ",");
}
