// app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Expense {
  amount: number;
  date: string;
}

export default function HomePage() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchExpenses = async () => {
      const res = await fetch("/api/expenses");
      const data: Expense[] = await res.json();

      // total mes actual
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();

      const monthlyTotal = data
        .filter((exp) => {
          const d = new Date(exp.date);
          return d.getMonth() === month && d.getFullYear() === year;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);

      setTotal(monthlyTotal);
    };
    fetchExpenses();
  }, []);

  return (
    <main className="flex flex-col items-center justify-center px-6">
      {/* Hero */}
      <section className="text-center mt-16">
        <h2 className="text-3xl md:text-5xl font-bold text-gray-800">
          Trackeá tus gastos del hogar
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          Simple. Rápido. Visual.
        </p>
        <div className="mt-6 flex gap-4 justify-center">
          <Link
            href="/expenses/new"
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl shadow hover:bg-indigo-700"
          >
            Agregar gasto
          </Link>
          <Link
            href="/dashboard"
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl shadow hover:bg-gray-200"
          >
            Ver dashboard
          </Link>
        </div>
      </section>

      {/* Quick stats */}
      <section className="mt-12 bg-white shadow rounded-2xl p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-700">Total del mes</h3>
        <p className="mt-2 text-3xl font-bold text-indigo-600">${total.toLocaleString('en-us', {minimumFractionDigits: 2})}</p>
      </section>
    </main>
  );
}
