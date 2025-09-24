import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client"; // Import correcto desde @prisma/client
import { prisma } from "@/lib/prisma"; // ✅ Correcto: usamos prisma desde lib/prisma.ts

// GET /api/expenses/:id
export async function GET(req: NextRequest, context: { params: unknown }) {
  const params = context.params as { id: string };
  if (!params?.id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const expense = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  return NextResponse.json(expense);
}

// PATCH /api/expenses/:id
export async function PATCH(req: NextRequest, context: { params: unknown }) {
  const params = context.params as { id: string };
  if (!params?.id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const body = await req.json();

  const allowedFields = ["title","amount","category","date","currency","note","receiptUrl"] as const;

  const data: Prisma.ExpenseUpdateInput = {};

  allowedFields.forEach(f => {
    if (body[f] !== undefined) {
      if (f === "amount") data[f] = Number(body[f]);
      else if (f === "date") data[f] = new Date(body[f]);
      else data[f] = body[f];
    }
  });

  try {
    const updated = await prisma.expense.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

// DELETE /api/expenses/:id
export async function DELETE(req: NextRequest, context: { params: unknown }) {
  const params = context.params as { id: string };
  if (!params?.id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  try {
    await prisma.expense.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
