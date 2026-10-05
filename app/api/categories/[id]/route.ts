import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/categories/:id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });

  try {
    const updated = await prisma.category.update({ where: { id }, data: { name } });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to rename category" }, { status: 409 });
  }
}

// DELETE /api/categories/:id — only allowed when no expense uses it
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const inUse = await prisma.expense.count({ where: { categoryId: id } });
  if (inUse > 0) {
    return NextResponse.json({ error: "Category has expenses" }, { status: 409 });
  }

  try {
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
