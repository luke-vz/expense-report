import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/categories
export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { expenses: true } } },
  });

  return NextResponse.json(
    categories.map(({ _count, ...c }) => ({ ...c, expenseCount: _count.expenses }))
  );
}

// POST /api/categories
export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });

  try {
    const category = await prisma.category.create({ data: { name } });
    return NextResponse.json({ ...category, expenseCount: 0 });
  } catch {
    return NextResponse.json({ error: "Category already exists" }, { status: 409 });
  }
}
