import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deletePhoto } from "@/lib/photos";
import { serializePending } from "@/lib/pending";

// GET /api/pending/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pending = await prisma.pendingExpense.findUnique({ where: { id } });
  if (!pending) return NextResponse.json({ error: "Pending expense not found" }, { status: 404 });
  return NextResponse.json(serializePending(pending));
}

// DELETE /api/pending/:id — discards it together with its photo
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pending = await prisma.pendingExpense.findUnique({ where: { id } });
  if (!pending) return NextResponse.json({ error: "Pending expense not found" }, { status: 404 });

  await prisma.pendingExpense.delete({ where: { id } });
  if (pending.photoKey) await deletePhoto(pending.photoKey);
  return NextResponse.json({ ok: true });
}
