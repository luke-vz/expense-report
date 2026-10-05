import type { Category, Expense } from "@prisma/client";

// Prisma returns Decimal objects, which JSON-serialize as strings. The client works with numbers.
export function serializeExpense(expense: Expense & { category: Category }) {
  return { ...expense, amount: expense.amount.toNumber() };
}
