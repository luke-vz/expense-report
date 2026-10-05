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

// DELETE /api/expenses/:id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  try {
    const deleted = await prisma.expense.delete({ where: { id } });
    const photoKey = keyFromPhotoUrl(deleted.receiptUrl);
    if (photoKey) await deletePhoto(photoKey);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
