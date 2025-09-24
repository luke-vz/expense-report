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
        <h2 className="text-3xl md:text-5xl font-bold">
          Trackeá tus gastos del hogar
        </h2>
        <p className="mt-4 text-lg text-gray-500">
          Simple. Rápido. Visual.
        </p>
        <div className="mt-6 flex gap-4 justify-center">
          <Link
            href="/expenses/new"
            className="bg-boton text-gray-300 px-6 py-3 rounded-md shadow"
          >
            Agregar gasto
          </Link>
          <Link
            href="/dashboard"
            className="bg-boton text-gray-300 px-6 py-3 rounded-md shadow"
          >
            Ver dashboard
          </Link>
        </div>
      </section>

      {/* Quick stats */}
      <section className="mt-12 bg-secundario border-card shadow rounded-md p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-300">Total del mes</h3>
        <p className="mt-2 text-3xl font-bold text-gray-500">${total.toLocaleString('en-us', {minimumFractionDigits: 2})}</p>
      </section>
    </main>
  );
}
