// app/expenses/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Expense } from "@/lib/expenses";
import { useCategories } from "@/lib/useCategories";
import { currentMonthKey, expenseTitle, formatAmount, monthKey } from "@/lib/format";

// "2026-10-05" -> "Lunes 5 de octubre" (read from the string: no timezone shift)
const dayHeading = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  const text = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const firstName = (name?: string | null) => name?.split(" ")[0] ?? null;

/** "$12,000.00 · US$ 15.99": totals per currency, never mixed */
const totalsLabel = (list: Expense[]) =>
  Object.entries(
    list.reduce<Record<string, number>>((acc, exp) => {
      const currency = exp.currency ?? "ARS";
      acc[currency] = (acc[currency] ?? 0) + exp.amount;
      return acc;
    }, {})
  )
    .map(([currency, total]) => formatAmount(total, currency))
    .join(" · ");

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const { categories } = useCategories();
  const [categoryId, setCategoryId] = useState("");
  const [month, setMonth] = useState(currentMonthKey());

  useEffect(() => {
    fetch("/api/expenses").then(async (res) => setExpenses(res.ok ? await res.json() : []));
  }, []);

  const filtered = (expenses ?? []).filter(
    (exp) => (!categoryId || exp.categoryId === categoryId) && (!month || monthKey(exp.date) === month)
  );

  // Grouped by day, newest first (the API already sorts by date desc)
  const days: [string, Expense[]][] = [];
  for (const exp of filtered) {
    const day = exp.date.slice(0, 10);
    const last = days[days.length - 1];
    if (last && last[0] === day) last[1].push(exp);
    else days.push([day, [exp]]);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Gastos</h1>
        <Link href="/categories" className="text-sm text-[#3987e5]">
          Categorías
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-2">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="bg-input rounded-md p-2"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="bg-input rounded-md p-2"
        />
      </div>

      {filtered.length > 0 && (
        <p className="mb-4 text-sm text-gray-400">
          {filtered.length} gastos · {totalsLabel(filtered)}
        </p>
      )}

      {expenses === null && <p className="text-gray-500">Cargando...</p>}
      {expenses !== null && filtered.length === 0 && (
        <p className="py-8 text-center text-gray-500">No hay gastos para este filtro.</p>
      )}

      <div className="space-y-5">
        {days.map(([day, list]) => (
          <section key={day}>
            <div className="flex items-baseline justify-between px-1 mb-1 text-sm">
              <h2 className="font-semibold text-gray-300">{dayHeading(day)}</h2>
              <span className="text-gray-400">{totalsLabel(list)}</span>
            </div>
            <ul className="bg-secundario border-card rounded-md divide-y divide-[#3c3c3c]">
              {list.map((exp) => (
                <li key={exp.id}>
                  <Link href={`/expenses/${exp.id}/edit`} className="flex items-center justify-between gap-3 p-3">
                    <span className="min-w-0">
                      <span className="block truncate">
                        {expenseTitle(exp)}
                        {exp.receiptUrl && <span className="ml-1 text-xs" aria-label="con foto">📎</span>}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {exp.category.name}
                        {firstName(exp.createdByName) && ` · ${firstName(exp.createdByName)}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold">{formatAmount(exp.amount, exp.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
