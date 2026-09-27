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
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonthKey(): string {
  return todayISO().slice(0, 7);
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString("en-us", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
