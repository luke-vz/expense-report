// app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Expense } from "@/lib/expenses";
import { currentMonthKey, formatDate, formatMoney, monthKey } from "@/lib/format";

export default function HomePage() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);

  useEffect(() => {
    const fetchExpenses = async () => {
      const res = await fetch("/api/expenses");
      setExpenses(res.ok ? await res.json() : []);
    };
    fetchExpenses();
  }, []);

  const month = currentMonthKey();
  const monthName = new Date(`${month}-01T12:00:00`).toLocaleString("es-AR", { month: "long", year: "numeric" });
  const monthExpenses = (expenses ?? []).filter((exp) => monthKey(exp.date) === month);
  const monthlyTotal = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  // The API returns expenses newest first
  const latest = (expenses ?? []).slice(0, 5);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <section className="bg-secundario border-card rounded-md p-5">
        <h2 className="text-sm text-gray-400">Total de {monthName}</h2>
        <p className="mt-1 text-4xl font-bold">${formatMoney(monthlyTotal)}</p>
        <p className="mt-1 text-sm text-gray-500">
          {expenses === null ? "Cargando..." : `${monthExpenses.length} gastos`}
        </p>
      </section>

      <Link
        href="/expenses/new"
        className="flex items-center justify-center gap-2 w-full rounded-md bg-[#3987e5] py-4 text-lg font-semibold text-white"
      >
        <span className="text-2xl leading-none">+</span> Cargar gasto
      </Link>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-semibold">Últimos gastos</h2>
          <Link href="/expenses" className="text-sm text-[#3987e5]">
            Ver todos
          </Link>
        </div>
        <ul className="bg-secundario border-card rounded-md divide-y divide-[#3c3c3c]">
          {latest.map((exp) => (
            <li key={exp.id}>
              <Link href={`/expenses/${exp.id}/edit`} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block truncate">{exp.title}</span>
                  <span className="block text-xs text-gray-500">
                    {exp.category.name} · {formatDate(exp.date)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold">${formatMoney(exp.amount)}</span>
              </Link>
            </li>
          ))}
          {expenses !== null && latest.length === 0 && (
            <li className="p-3 text-center text-gray-500">Todavía no hay gastos</li>
          )}
        </ul>
      </section>
    </div>
  );
}
