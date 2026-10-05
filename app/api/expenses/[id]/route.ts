import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeExpense } from "@/lib/serialize";
import { parseExpenseInput } from "@/lib/validation";
import { deletePhoto, keyFromPhotoUrl } from "@/lib/photos";

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

  const body = await req.json().catch(() => null);
  const parsed = parseExpenseInput(body, { partial: true });
  if (parsed.error !== undefined) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data } = parsed;

  try {
    const updated = await prisma.expense.update({ where: { id }, data, include: { category: true } });
    return NextResponse.json(serializeExpense(updated));
  } catch {
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

// DELETE /api/expenses/:id — ?scope=group deletes every installment of the same purchase
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  const wholeGroup = req.nextUrl.searchParams.get("scope") === "group" && expense.installmentGroupId;
  const where = wholeGroup ? { installmentGroupId: expense.installmentGroupId } : { id };

  try {
    const { count } = await prisma.expense.deleteMany({ where });
    // Installments share one receipt photo: delete it only once nothing references it
    const photoKey = keyFromPhotoUrl(expense.receiptUrl);
    if (photoKey && !(await prisma.expense.count({ where: { receiptUrl: expense.receiptUrl } }))) {
      await deletePhoto(photoKey);
    }
    return NextResponse.json({ ok: true, deleted: count });
  } catch {
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
