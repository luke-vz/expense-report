import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeExpense } from "@/lib/serialize";
import { parseExpenseInput } from "@/lib/validation";
import { photoUrl } from "@/lib/photos";
import { MAX_INSTALLMENTS, addMonths, splitAmount } from "@/lib/installments";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface ExpenseFilter {
  categoryId?: string;
  from?: string;
  to?: string;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const filter: ExpenseFilter = {
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };

  const where: Prisma.ExpenseWhereInput = {};

  if (filter.categoryId) where.categoryId = filter.categoryId;
  if (filter.from || filter.to) {
    where.date = {};
    if (filter.from) where.date.gte = new Date(filter.from);
    if (filter.to) where.date.lte = new Date(filter.to);
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { category: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses.map(serializeExpense));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = parseExpenseInput(body);
  if (parsed.error !== undefined) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data } = parsed;

  // Completing a pending expense: its photo becomes the receipt and the pending
  // entry is removed in the same transaction
  const pendingId = typeof body?.pendingId === "string" ? body.pendingId : null;

  // installments >= 2: the amount is the total; one expense per month is created
  const installments = body?.installments ?? 1;
  if (!Number.isInteger(installments) || installments < 1 || installments > MAX_INSTALLMENTS) {
    return NextResponse.json({ error: `Invalid installments: 1 to ${MAX_INSTALLMENTS}` }, { status: 400 });
  }
  if (Math.round(data.amount!.toNumber() * 100) < installments) {
    return NextResponse.json({ error: "Amount too small for that many installments" }, { status: 400 });
  }

  // Two people load expenses: before creating, look for the same amount, currency, category
  // and day (e.g. the other one already loaded it). The client confirms and retries with
  // allowDuplicate: true. Purchases in installments are not checked.
  if (installments === 1 && body?.allowDuplicate !== true) {
    const duplicate = await prisma.expense.findFirst({
      where: {
        amount: data.amount,
        currency: data.currency ?? "ARS",
        categoryId: data.categoryId,
        date: data.date,
        installmentGroupId: null,
      },
      include: { category: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Possible duplicate", duplicate: serializeExpense(duplicate) },
        { status: 409 }
      );
    }
  }

  const session = await getServerSession(authOptions);
  const createdBy = { createdBy: session?.user?.email ?? null, createdByName: session?.user?.name ?? null };

  try {
    const expense = await prisma.$transaction(async (tx) => {
      let receiptUrl = data.receiptUrl;
      if (pendingId) {
        const pending = await tx.pendingExpense.delete({ where: { id: pendingId } });
        if (pending.photoKey) receiptUrl = photoUrl(pending.photoKey);
      }
      if (installments === 1) {
        return tx.expense.create({
          data: { ...data, ...createdBy, receiptUrl } as Prisma.ExpenseUncheckedCreateInput,
          include: { category: true },
        });
      }

      const groupId = randomUUID();
      const firstDay = data.date!.toISOString().slice(0, 10);
      const amounts = splitAmount(data.amount!.toNumber(), installments);
      const created = [];
      for (let i = 0; i < installments; i++) {
        created.push(
          await tx.expense.create({
            data: {
              ...data,
              ...createdBy,
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
    return NextResponse.json(serializeExpense(expense));
  } catch {
    return NextResponse.json({ error: "Failed to create expense" }, { status: 400 });
  }
}
