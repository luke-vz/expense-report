import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client"; // Import correcto desde @prisma/client
import { prisma } from "@/lib/prisma"; // ✅ Correcto: usamos prisma desde lib/prisma.ts
import { serializeExpense } from "@/lib/serialize";

// GET /api/expenses/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const expense = await prisma.expense.findUnique({ where: { id }, include: { category: true } });
  if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  return NextResponse.json(serializeExpense(expense));
}

// PATCH /api/expenses/:id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const body = await req.json();

  const allowedFields = ["title","amount","date","currency","note","receiptUrl"] as const;

  const data: Prisma.ExpenseUpdateInput = {};

  allowedFields.forEach(f => {
    if (body[f] !== undefined) {
      if (f === "amount") data[f] = new Prisma.Decimal(body[f]);
      else if (f === "date") data[f] = new Date(body[f]);
      else data[f] = body[f];
    }
  });
  if (body.categoryId) data.category = { connect: { id: String(body.categoryId) } };

  try {
    const updated = await prisma.expense.update({ where: { id }, data, include: { category: true } });
    return NextResponse.json(serializeExpense(updated));
  } catch {
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

// DELETE /api/expenses/:id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  try {
    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
