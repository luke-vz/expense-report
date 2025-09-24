"use client";

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from "recharts";

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
}

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
      if (!acc[exp.category]) acc[exp.category] = { category: exp.category, amount: 0 };
      acc[exp.category].amount += exp.amount;
      return acc;
    }, {})
  );

  const byMonth: MonthData[] = Object.values(
    expenses.reduce((acc: Record<string, MonthData>, exp) => {
      const month = new Date(exp.date).toLocaleString("default", { month: "short", year: "numeric" });
      if (!acc[month]) acc[month] = { month, amount: 0 };
      acc[month].amount += exp.amount;
      return acc;
    }, {})
  );

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

  return (
    <div className="p-6 grid gap-8 grid-cols-1 md:grid-cols-2">
      <div className="bg-white shadow rounded-2xl p-4">
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

      <div className="bg-white shadow rounded-2xl p-4">
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
