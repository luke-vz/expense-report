import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeExpense } from "@/lib/serialize";
import { parseExpenseInput } from "@/lib/validation";

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

  try {
    const expense = await prisma.expense.create({
      data: data as Prisma.ExpenseUncheckedCreateInput,
      include: { category: true },
    });
    return NextResponse.json(serializeExpense(expense));
  } catch {
    return NextResponse.json({ error: "Failed to create expense" }, { status: 400 });
  }
}
