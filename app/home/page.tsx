// app/home/page.tsx
"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import CaptureButton from "@/components/CaptureButton";
import type { Expense } from "@/lib/expenses";
import { usePendingCount } from "@/lib/usePendingCount";
import { currentMonthKey, expenseTitle, formatAmount, formatDate, monthKey, todayISO } from "@/lib/format";

/** { ARS: 1500, USD: 20 } — totals are never mixed across currencies */
const totalsByCurrency = (list: Expense[]) =>
  list.reduce<Record<string, number>>((acc, exp) => {
    const currency = exp.currency ?? "ARS";
    acc[currency] = (acc[currency] ?? 0) + exp.amount;
    return acc;
  }, {});

export default function HomePage() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const pendingCount = usePendingCount();

  useEffect(() => {
    fetch("/api/auth/session").then(async (res) => {
      const session = res.ok ? await res.json() : null;
      setUserName(session?.user?.name?.split(" ")[0] ?? session?.user?.email ?? null);
    });
  }, []);

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
  const monthlyTotals = totalsByCurrency(monthExpenses);
  const today = todayISO();
  // The API returns newest first, which puts future installments on top: skip those
  const latest = (expenses ?? []).filter((exp) => exp.date.slice(0, 10) <= today).slice(0, 5);
  // Installments still to be paid after this month
  const committed = (expenses ?? []).filter((exp) => exp.installmentGroupId && monthKey(exp.date) > month);
  const committedTotals = totalsByCurrency(committed);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <section className="bg-secundario border-card rounded-md p-5">
        <h2 className="text-sm text-ink-muted">Total de {monthName}</h2>
        <p className="mt-1 text-4xl font-bold">{formatAmount(monthlyTotals.ARS ?? 0)}</p>
        {monthlyTotals.USD !== undefined && (
          <p className="text-2xl font-bold text-ink">{formatAmount(monthlyTotals.USD, "USD")}</p>
        )}
        <p className="mt-1 text-sm text-ink-muted">
          {expenses === null ? "Cargando..." : `${monthExpenses.length} gastos`}
        </p>
        {committed.length > 0 && (
          <p className="mt-3 border-t border-line pt-3 text-sm text-ink-muted">
            Cuotas a futuro:{" "}
            {Object.entries(committedTotals)
              .map(([currency, total]) => formatAmount(total, currency))
              .join(" + ")}
          </p>
        )}
      </section>

      {pendingCount > 0 && (
        <Link
          href="/pending"
          className="flex items-center justify-between rounded-md border border-accent bg-accent/20 px-4 py-3"
        >
          <span>
            Tenés <strong>{pendingCount}</strong> {pendingCount === 1 ? "gasto" : "gastos"} para completar
          </span>
          <span className="text-accent-text font-semibold">Ver →</span>
        </Link>
      )}

      <div className="flex gap-3">
        <Link
          href="/expenses/new"
          className="flex flex-1 items-center justify-center gap-2 rounded-md bg-accent py-4 text-lg font-semibold text-accent-ink"
        >
          <span className="text-2xl leading-none">+</span> Cargar gasto
        </Link>
        <CaptureButton className="flex items-center justify-center rounded-md bg-boton px-5 text-2xl" >
          <span aria-label="Sacar foto para completar después">📷</span>
        </CaptureButton>
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-semibold">Últimos gastos</h2>
          <Link href="/expenses" className="text-sm text-accent-text">
            Ver todos
          </Link>
        </div>
        <ul className="bg-secundario border-card rounded-md divide-y divide-line">
          {latest.map((exp) => (
            <li key={exp.id}>
              <Link href={`/expenses/${exp.id}/edit`} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block truncate">{expenseTitle(exp)}</span>
                  <span className="block text-xs text-ink-muted">
                    {exp.category.name} · {formatDate(exp.date)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold">{formatAmount(exp.amount, exp.currency)}</span>
              </Link>
            </li>
          ))}
          {expenses !== null && latest.length === 0 && (
            <li className="p-3 text-center text-ink-muted">Todavía no hay gastos</li>
          )}
        </ul>
      </section>

      <Link href="/shortcuts" className="block text-center text-sm text-accent-text">
        📱 Cargar gastos con Siri o un widget
      </Link>

      {/* On the phone there is no header: the session lives here */}
      <p className="text-center text-xs text-ink-muted">
        {userName && <>Conectado como {userName} · </>}
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="underline">
          Salir
        </button>
      </p>
    </div>
  );
}
