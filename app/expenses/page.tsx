// app/expenses/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Expense } from "@/lib/expenses";
import { useCategories } from "@/lib/useCategories";
import { currentMonthKey, formatDate, formatMoney, monthKey } from "@/lib/format";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const { categories } = useCategories();
  const [categoryId, setCategoryId] = useState("");
  const [month, setMonth] = useState(currentMonthKey());
  useEffect(() => {
    const fetchExpenses = async () => {
      const res = await fetch("/api/expenses");
      const data = await res.json();
      setExpenses(data);
    };
    fetchExpenses();
  }, []);

  const filteredExpenses = expenses.filter((exp) => {
    const matchesCategory = categoryId ? exp.categoryId === categoryId : true;
    const matchesMonth = month ? monthKey(exp.date) === month : true;
    return matchesCategory && matchesMonth;
  });

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Listado de Gastos</h1>
        <Link
          href="/expenses/new"
          className="bg-boton px-4 py-2 rounded-md"
        >
          Agregar
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-6">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="border rounded-md p-2"
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
          className="border rounded-md p-2"
        />
      </div>

      {/* Listado */}
      <div className="bg-secundario shadow rounded-md overflow-hidden border-card">
        <table className="w-full text-sm">
          <thead className=" text-left">
            <tr>
              <th className="p-3">Título</th>
              <th className="p-3">Monto</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
                {filteredExpenses.length > 0 ? (
                    filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="border-t">
                        <td className="p-3">{exp.title}</td>
                        <td className="p-3">${formatMoney(exp.amount)}</td>
                        <td className="p-3">{exp.category.name}</td>
                        <td className="p-3">{formatDate(exp.date)}</td>
                        <td className="p-3 flex gap-2">
                        <Link
                            href={`/expenses/${exp.id}/edit`}
                            className="text-blue-400 hover:underline"
                        >
                            Editar
                        </Link>
                        <button
                            onClick={async () => {
                            if (!confirm("¿Seguro que querés eliminar este gasto?")) return;
                            await fetch(`/api/expenses/${exp.id}`, { method: "DELETE" });
                            setExpenses(expenses.filter((e) => e.id !== exp.id));
                            }}
                            className="text-red-400 hover:underline"
                        >
                            Eliminar
                        </button>
                        </td>
                    </tr>
                    ))
                ) : (
                    <tr>
                    <td colSpan={5} className="p-3 text-center text-gray-500">
                        No hay gastos
                    </td>
                    </tr>
                )}
                </tbody>

        </table>
      </div>
    </main>
  );
}
