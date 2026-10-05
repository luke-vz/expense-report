"use client";

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from "recharts";
import type { Expense } from "@/lib/expenses";
import { monthKey, monthLabel } from "@/lib/format";

interface CategoryData {
  category: string;
  amount: number;
  [key: string]: string | number;
}

interface MonthData {
  month: string;
  amount: number;
  [key: string]: string | number;
}

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

  const byCategory: CategoryData[] = Object.values(
    expenses.reduce((acc: Record<string, CategoryData>, exp) => {
      const category = exp.category.name;
      if (!acc[category]) acc[category] = { category, amount: 0 };
      acc[category].amount += exp.amount;
      return acc;
    }, {})
  );

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

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

  return (
    <div className="p-6 grid gap-8 grid-cols-1 md:grid-cols-2">
      <div className="border-card bg-secundario shadow rounded-md p-4">
        <h2 className="text-lg font-semibold mb-4">Gastos por Categoría</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={byCategory}
              dataKey="amount"
              nameKey="category"
              outerRadius={100}
              label={(entry) => `${entry.category}: $${entry.amount}`}
            >
              {byCategory.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="border-card bg-secundario shadow rounded-md p-4">
        <h2 className="text-lg font-semibold mb-4">Gastos por Mes</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byMonth}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="amount" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
