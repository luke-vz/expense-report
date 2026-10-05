import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/categories/:id/merge — moves every expense of :id into targetId, then deletes :id
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";

  if (!targetId) return NextResponse.json({ error: "Missing required field: targetId" }, { status: 400 });
  if (targetId === id) return NextResponse.json({ error: "Cannot merge a category into itself" }, { status: 400 });

  const [source, target] = await Promise.all([
    prisma.category.findUnique({ where: { id } }),
    prisma.category.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const [moved] = await prisma.$transaction([
    prisma.expense.updateMany({ where: { categoryId: id }, data: { categoryId: targetId } }),
    prisma.category.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true, moved: moved.count });
}
