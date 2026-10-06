// Creating expenses, shared by POST /api/expenses (the app) and the Siri/Atajos endpoint.
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { photoUrl } from "@/lib/photos";
import { addMonths, splitAmount } from "@/lib/installments";

export interface NewExpense {
  title: string;
  amount: Prisma.Decimal;
  categoryId: string;
  date: Date;
  currency?: string;
  note?: string | null;
  receiptUrl?: string | null;
}

export interface Author {
  createdBy: string | null;
  createdByName: string | null;
}

/**
 * Same amount, currency, category and day already loaded (maybe by the other person).
 * Purchases in installments are not checked.
 */
export function findDuplicate(data: NewExpense) {
  return prisma.expense.findFirst({
    where: {
      amount: data.amount,
      currency: data.currency ?? "ARS",
      categoryId: data.categoryId,
      date: data.date,
      installmentGroupId: null,
    },
    include: { category: true },
  });
}

/**
 * Creates the expense, or one per month when `installments` >= 2 (the amount is the total).
 * With `pendingId`, the pending is removed in the same transaction and its photo becomes
 * the receipt. Returns the first (or only) expense, with its category.
 */
export async function createExpenses(
  data: NewExpense,
  { installments = 1, author, pendingId }: { installments?: number; author: Author; pendingId?: string | null }
) {
  return prisma.$transaction(async (tx) => {
    let receiptUrl = data.receiptUrl;
    if (pendingId) {
      const pending = await tx.pendingExpense.delete({ where: { id: pendingId } });
      if (pending.photoKey) receiptUrl = photoUrl(pending.photoKey);
    }
    if (installments === 1) {
      return tx.expense.create({
        data: { ...data, ...author, receiptUrl } as Prisma.ExpenseUncheckedCreateInput,
        include: { category: true },
      });
    }

    const groupId = randomUUID();
    const firstDay = data.date.toISOString().slice(0, 10);
    const amounts = splitAmount(data.amount.toNumber(), installments);
    const created = [];
    for (let i = 0; i < installments; i++) {
      created.push(
        await tx.expense.create({
          data: {
            ...data,
            ...author,
            receiptUrl,
            amount: new Prisma.Decimal(amounts[i].toFixed(2)),
            date: new Date(addMonths(firstDay, i)),
            installmentGroupId: groupId,
            installmentNumber: i + 1,
            installmentCount: installments,
          } as Prisma.ExpenseUncheckedCreateInput,
          include: { category: true },
        })
      );
    }
    return created[0];
  });
}
