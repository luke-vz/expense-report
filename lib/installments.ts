// Purchases in installments ("cuotas"): the user enters the total (interest already
// included) and the number of installments; each installment becomes its own Expense.

export const MAX_INSTALLMENTS = 60;

/** Splits a total into `count` amounts that add up exactly, spreading leftover cents over the first ones. */
export function splitAmount(total: number, count: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

/**
 * "YYYY-MM-DD" plus `months` months, clamped to the last day of the target month
 * (Jan 31 + 1 month -> Feb 28/29), so every installment stays in its own month.
 */
export function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}
