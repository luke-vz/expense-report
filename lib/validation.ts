import { Prisma } from "@prisma/client";

// Largest value that fits in Decimal(12,2)
const MAX_AMOUNT = 9_999_999_999.99;

type ExpenseData = {
  title?: string;
  amount?: Prisma.Decimal;
  categoryId?: string;
  date?: Date;
  currency?: string;
  note?: string | null;
  receiptUrl?: string | null;
};

type Result = { data: ExpenseData; error?: undefined } | { data?: undefined; error: string };

/**
 * Validates an expense payload from the API. With `partial` (PATCH), only the fields
 * present are validated; otherwise title, amount, categoryId and date are required.
 */
export function parseExpenseInput(body: unknown, { partial = false } = {}): Result {
  if (typeof body !== "object" || body === null) return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const data: ExpenseData = {};

  const required = ["title", "amount", "categoryId", "date"] as const;
  if (!partial) {
    for (const field of required) {
      if (b[field] === undefined || b[field] === null || b[field] === "") {
        return { error: `Missing required field: ${field}` };
      }
    }
  }

  if (b.title !== undefined) {
    if (typeof b.title !== "string" || !b.title.trim()) return { error: "Invalid title" };
    data.title = b.title.trim();
  }

  if (b.amount !== undefined) {
    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      return { error: "Invalid amount: must be a positive number" };
    }
    data.amount = new Prisma.Decimal(amount.toFixed(2));
  }

  if (b.categoryId !== undefined) {
    if (typeof b.categoryId !== "string" || !b.categoryId) return { error: "Invalid categoryId" };
    data.categoryId = b.categoryId;
  }

  if (b.date !== undefined) {
    // Expect a calendar day ("YYYY-MM-DD"); a full ISO timestamp is accepted and truncated
    const day = typeof b.date === "string" ? b.date.slice(0, 10) : "";
    const date = new Date(day);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
      return { error: "Invalid date: expected YYYY-MM-DD" };
    }
    data.date = date;
  }

  if (b.currency !== undefined) {
    if (typeof b.currency !== "string" || !/^[A-Z]{3}$/.test(b.currency)) return { error: "Invalid currency" };
    data.currency = b.currency;
  }

  for (const field of ["note", "receiptUrl"] as const) {
    if (b[field] !== undefined) {
      if (b[field] !== null && typeof b[field] !== "string") return { error: `Invalid ${field}` };
      data[field] = (b[field] as string | null) || null;
    }
  }

  return { data };
}
