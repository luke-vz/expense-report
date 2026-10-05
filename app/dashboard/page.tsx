"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { Expense } from "@/lib/expenses";
import { currentMonthKey, expenseTitle, formatAmount, formatDate, monthKey, monthLabel, shiftMonth } from "@/lib/format";

// Selected month in the action blue (validated against the #2b2b2b cards); the other
// months recede in gray so the selection reads at a glance
const BAR_COLOR = "#3987e5";
const MUTED_BAR = "#4b5563";
const AXIS_COLOR = "#9ca3af";
const GRID_COLOR = "#3c3c3c";
const MONTHS_IN_CHART = 12;

const sum = (list: Expense[]) => list.reduce((total, exp) => total + exp.amount, 0);

const longMonth = (key: string) =>
  new Date(`${key}-01T12:00:00`).toLocaleString("es-AR", { month: "long", year: "numeric" });

const formatAxis = (currency: string) => (value: number) =>
  (currency === "USD" ? "US$" : "$") + value.toLocaleString("en-us", { notation: "compact", maximumFractionDigits: 1 });

/** Percent change against a reference; null when there is nothing to compare with. */
function percentChange(value: number, reference: number): number | null {
  return reference > 0 ? ((value - reference) / reference) * 100 : null;
}

// More spending is the bad direction: up = red, down = green, always with an arrow and sign
function Delta({ change, label }: { change: number | null; label: string }) {
  if (change === null) return <span className="text-gray-500">— {label}</span>;
  const rounded = Math.round(change);
  const up = rounded > 0;
  const color = rounded === 0 ? "text-gray-400" : up ? "text-red-400" : "text-green-400";
  return (
    <span className={color}>
      {rounded === 0 ? "=" : up ? "▲" : "▼"} {up ? "+" : rounded < 0 ? "−" : ""}
      {Math.abs(rounded)}% {label}
    </span>
  );
}

export default function DashboardPage() {
  const [allExpenses, setExpenses] = useState<Expense[] | null>(null);
  const [month, setMonth] = useState(currentMonthKey());
  // Amounts are never mixed across currencies: everything shows one at a time
  const [currency, setCurrency] = useState("ARS");

  useEffect(() => {
    fetch("/api/expenses").then(async (res) => setExpenses(res.ok ? await res.json() : []));
  }, []);

  const hasUsd = (allExpenses ?? []).some((exp) => exp.currency === "USD");
  const expenses = (allExpenses ?? []).filter((exp) => (exp.currency ?? "ARS") === currency);
  const inMonth = (key: string) => expenses.filter((exp) => monthKey(exp.date) === key);

  const current = inMonth(month);
  const previous = inMonth(shiftMonth(month, -1));
  const total = sum(current);
  const previousTotal = sum(previous);
  // Average of the three months before the selected one, skipping months with no expenses
  // (before the app was in use they would drag the average down and inflate the change)
  const priorTotals = [1, 2, 3].map((n) => sum(inMonth(shiftMonth(month, -n)))).filter((t) => t > 0);
  const average3 = priorTotals.length ? priorTotals.reduce((a, b) => a + b, 0) / priorTotals.length : 0;

  // Category ranking for the month, with the change against the previous month
  const previousByCategory = previous.reduce<Record<string, number>>((acc, exp) => {
    acc[exp.category.name] = (acc[exp.category.name] ?? 0) + exp.amount;
    return acc;
  }, {});
  const ranking = Object.entries(
    current.reduce<Record<string, number>>((acc, exp) => {
      acc[exp.category.name] = (acc[exp.category.name] ?? 0) + exp.amount;
      return acc;
    }, {})
  )
    .map(([category, amount]) => ({ category, amount, previous: previousByCategory[category] ?? 0 }))
    .sort((a, b) => b.amount - a.amount);
  const maxCategory = ranking[0]?.amount ?? 0;

  const biggest = [...current].sort((a, b) => b.amount - a.amount).slice(0, 5);

  const byMonth = Array.from({ length: MONTHS_IN_CHART }, (_, i) => {
    const key = shiftMonth(month, i - (MONTHS_IN_CHART - 1));
    return { key, month: monthLabel(key), amount: sum(inMonth(key)) };
  });

  if (allExpenses === null) return <p className="p-6">Cargando...</p>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Month picker and currency */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Mes anterior"
            className="h-10 w-10 rounded-full border border-[#616161] text-lg"
          >
            ‹
          </button>
          <h1 className="min-w-44 text-center text-xl font-bold first-letter:uppercase">{longMonth(month)}</h1>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Mes siguiente"
            className="h-10 w-10 rounded-full border border-[#616161] text-lg"
          >
            ›
          </button>
        </div>
        {hasUsd && (
          <div className="flex gap-2" role="tablist" aria-label="Moneda">
            {["ARS", "USD"].map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={currency === c}
                onClick={() => setCurrency(c)}
                className={`px-4 py-1 rounded-full border text-sm ${
                  currency === c ? "bg-[#3987e5] border-[#3987e5] text-white" : "border-[#616161] text-gray-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Headline numbers */}
      <section className="bg-secundario border-card rounded-md p-5">
        <p className="text-sm text-gray-400">Total del mes</p>
        <p className="mt-1 text-4xl font-bold">{formatAmount(total, currency)}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Delta change={percentChange(total, previousTotal)} label="vs mes anterior" />
          <Delta change={percentChange(total, average3)} label="vs promedio 3 meses" />
        </div>
        <p className="mt-2 text-sm text-gray-500">{current.length} gastos</p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Where the money went this month */}
        <section className="bg-secundario border-card rounded-md p-4">
          <h2 className="text-lg font-semibold mb-3">Por categoría</h2>
          {ranking.length === 0 && <p className="text-gray-500">No hay gastos en este mes.</p>}
          <ul className="space-y-3">
            {ranking.map((row) => (
              <li key={row.category}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{row.category}</span>
                  <span>
                    {formatAmount(row.amount, currency)}{" "}
                    <span className="text-gray-400">· {Math.round((row.amount / total) * 100)}%</span>
                  </span>
                </div>
                <div className="mt-1 h-2 rounded bg-[#3c3c3c]">
                  <div
                    className="h-2 rounded"
                    style={{ width: `${(row.amount / maxCategory) * 100}%`, background: BAR_COLOR }}
                  />
                </div>
                <div className="mt-1 text-xs">
                  <Delta change={percentChange(row.amount, row.previous)} label="vs mes anterior" />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Biggest expenses of the month */}
        <section className="bg-secundario border-card rounded-md p-4">
          <h2 className="text-lg font-semibold mb-3">Gastos más grandes</h2>
          {biggest.length === 0 && <p className="text-gray-500">No hay gastos en este mes.</p>}
          <ul className="divide-y divide-[#3c3c3c]">
            {biggest.map((exp) => (
              <li key={exp.id}>
                <Link href={`/expenses/${exp.id}/edit`} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{expenseTitle(exp)}</span>
                    <span className="block text-xs text-gray-500">
                      {exp.category.name} · {formatDate(exp.date)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold">{formatAmount(exp.amount, currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Trend: last 12 months, tap a bar to jump to that month */}
      <section className="bg-secundario border-card rounded-md p-4">
        <h2 className="text-lg font-semibold mb-3">Últimos 12 meses</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={byMonth}
            onClick={(state) => {
              const key = byMonth[Number(state?.activeTooltipIndex)]?.key;
              if (key) setMonth(key);
            }}
          >
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis dataKey="month" stroke={AXIS_COLOR} fontSize={11} interval="preserveStartEnd" />
            <YAxis tickFormatter={formatAxis(currency)} stroke={AXIS_COLOR} fontSize={11} width={52} />
            <Tooltip
              formatter={(value: number) => [formatAmount(value, currency), "Total"]}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{ background: "#121212", border: "1px solid #616161", borderRadius: 6 }}
              labelStyle={{ color: "#d1d5db" }}
              itemStyle={{ color: "#d1d5db" }}
            />
            <Bar dataKey="amount" maxBarSize={28} radius={[4, 4, 0, 0]} className="cursor-pointer">
              {byMonth.map((row) => (
                <Cell key={row.key} fill={row.key === month ? BAR_COLOR : MUTED_BAR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
