"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList,
} from "recharts";
import type { Expense } from "@/lib/expenses";
import { formatMoney, monthKey, monthLabel } from "@/lib/format";

interface CategoryData {
  category: string;
  amount: number;
  share: number; // fraction of the total
}

interface MonthData {
  month: string;
  amount: number;
}

// Single-series charts: one color, validated for the dark card surface (#2b2b2b)
const BAR_COLOR = "#3987e5";
const AXIS_COLOR = "#9ca3af";
const GRID_COLOR = "#3c3c3c";
const BAR_HEIGHT = 36;

const formatAxis = (value: number) =>
  "$" + value.toLocaleString("en-us", { notation: "compact", maximumFractionDigits: 1 });

const tooltipProps = {
  formatter: (value: number) => [`$${formatMoney(value)}`, "Total"] as [string, string],
  cursor: { fill: "rgba(255,255,255,0.05)" },
  contentStyle: { background: "#121212", border: "1px solid #616161", borderRadius: 6 },
  labelStyle: { color: "#d1d5db" },
  itemStyle: { color: "#d1d5db" },
};

export default function DashboardPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    const fetchExpenses = async () => {
      const res = await fetch("/api/expenses");
      const data = await res.json();
      setExpenses(data);
    };
    fetchExpenses();
  }, []);

  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Ranking: biggest category first, to answer "where does the money go"
  const byCategory: CategoryData[] = Object.entries(
    expenses.reduce((acc: Record<string, number>, exp) => {
      acc[exp.category.name] = (acc[exp.category.name] ?? 0) + exp.amount;
      return acc;
    }, {})
  )
    .map(([category, amount]) => ({ category, amount, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // Keyed by "YYYY-MM" so months sort chronologically, then labeled for the chart
  const byMonth: MonthData[] = Object.entries(
    expenses.reduce((acc: Record<string, number>, exp) => {
      const key = monthKey(exp.date);
      acc[key] = (acc[key] ?? 0) + exp.amount;
      return acc;
    }, {})
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => ({ month: monthLabel(key), amount }));

  return (
    <div className="p-6 grid gap-8 grid-cols-1 md:grid-cols-2">
      <div className="border-card bg-secundario shadow rounded-md p-4">
        <h2 className="text-lg font-semibold mb-4">Gastos por categoría</h2>
        <ResponsiveContainer width="100%" height={Math.max(byCategory.length * BAR_HEIGHT, 120)}>
          <BarChart data={byCategory} layout="vertical" margin={{ left: 8, right: 48 }}>
            <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
            <XAxis type="number" tickFormatter={formatAxis} stroke={AXIS_COLOR} fontSize={12} />
            <YAxis type="category" dataKey="category" width={110} stroke={AXIS_COLOR} fontSize={12} tickLine={false} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="amount" fill={BAR_COLOR} barSize={20} radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="share"
                position="right"
                fill="#d1d5db"
                fontSize={12}
                formatter={(share) => `${Math.round(Number(share) * 100)}%`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="border-card bg-secundario shadow rounded-md p-4">
        <h2 className="text-lg font-semibold mb-4">Gastos por mes</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byMonth}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis dataKey="month" stroke={AXIS_COLOR} fontSize={12} />
            <YAxis tickFormatter={formatAxis} stroke={AXIS_COLOR} fontSize={12} width={56} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="amount" fill={BAR_COLOR} maxBarSize={32} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
