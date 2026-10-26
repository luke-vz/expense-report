// "Supera límite" state of the quick entry screen. The app has no limit yet (savings and
// budgets are on hold): this only does the math, so whoever adds a limit decides which one
// (daily, monthly, per category) and what counts as already spent.

/**
 * How much the new amount goes over the limit, or null when it doesn't (or there is no
 * limit, or no valid amount). Amounts in the same currency.
 */
export function limitExcess(amount: number, spentSoFar: number, limit: number | null | undefined): number | null {
  if (limit == null || !(amount > 0)) return null;
  const excess = Math.round((spentSoFar + amount - limit) * 100) / 100;
  return excess > 0 ? excess : null;
}
