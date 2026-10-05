import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Suggestion } from "@/lib/expenses";

const normalize = (text: string) =>
  text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// GET /api/suggestions — titles already used, with how often and the category used last
// time. Feeds the quick-entry autocomplete and the "Frecuentes" shortcuts.
export async function GET() {
  const expenses = await prisma.expense.findMany({
    where: {
      date: { lte: new Date() },
      // One entry per purchase: later installments repeat the same title
      OR: [{ installmentNumber: null }, { installmentNumber: 1 }],
    },
    select: { title: true, categoryId: true, date: true, category: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  const byTitle = new Map<string, Suggestion>();
  for (const exp of expenses) {
    const key = normalize(exp.title);
    // An empty "detalle" is saved as the category name: not a useful suggestion
    if (!key || key === normalize(exp.category.name)) continue;
    const existing = byTitle.get(key);
    if (existing) existing.count++;
    // Newest first, so the first one seen sets the spelling and category to suggest
    else byTitle.set(key, { title: exp.title, categoryId: exp.categoryId, count: 1, lastDate: exp.date.toISOString() });
  }

  const suggestions = [...byTitle.values()]
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, 300);
  return NextResponse.json(suggestions);
}
