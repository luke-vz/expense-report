// app/expenses/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [category, setCategory] = useState("");
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth()+1;
  const currentYear = currentDate.getFullYear();
  const [month, setMonth] = useState(`${currentYear}-${currentMonth.toString().padStart(2, '0')}`);
  useEffect(() => {
    const fetchExpenses = async () => {
      const res = await fetch("/api/expenses");
      const data = await res.json();
      setExpenses(data);
    };
    fetchExpenses();
  }, []);

  const filteredExpenses = expenses.filter((exp) => {
    const expDate = new Date(exp.date);
    const matchesCategory = category ? exp.category === category : true;
    const matchesMonth = month
      ? expDate.toISOString().slice(0, 7) === month
      : true;
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
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border rounded-md p-2"
        >
          <option value="">Todas las categorías</option>
          <option value="food">Comida</option>
          <option value="transport">Transporte</option>
          <option value="utilities">Servicios</option>
          <option value="entertainment">Ocio</option>
          <option value="other">Otros</option>
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
                        <td className="p-3">${exp.amount.toLocaleString('en-us', {minimumFractionDigits: 2})}</td>
                        <td className="p-3 capitalize">{exp.category}</td>
                        <td className="p-3">{new Date(exp.date).toLocaleDateString("es-AR")}</td>
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
