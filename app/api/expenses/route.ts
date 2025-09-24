import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client"; // Import correcto desde @prisma/client
import { prisma } from "@/lib/prisma"; // ✅ Correcto: usamos prisma desde lib/prisma.ts

export interface ExpenseFilter {
  category?: string;
  from?: string;
  to?: string;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const filter: ExpenseFilter = {
    category: url.searchParams.get("category") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };

  const where: Prisma.ExpenseWhereInput = {};

  if (filter.category) where.category = filter.category;
  if (filter.from || filter.to) {
    where.date = {};
    if (filter.from) where.date.gte = new Date(filter.from);
    if (filter.to) where.date.lte = new Date(filter.to);
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const requiredFields = ["title", "amount", "category", "date"] as const;
  for (const field of requiredFields) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  // ✅ Usamos Prisma.ExpenseCreateInput en lugar de ExpenseCreateInput
  const data: Prisma.ExpenseCreateInput = {
    title: String(body.title),
    amount: Number(body.amount),
    category: String(body.category),
    date: new Date(body.date),
    currency: body.currency ? String(body.currency) : undefined,
    note: body.note ? String(body.note) : undefined,
    receiptUrl: body.receiptUrl ? String(body.receiptUrl) : undefined,
  };

  const expense = await prisma.expense.create({ data });
  return NextResponse.json(expense);
}
