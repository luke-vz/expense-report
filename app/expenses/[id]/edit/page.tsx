// app/expenses/[id]/edit/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
}

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params;

  const [form, setForm] = useState<Expense>({
    id: "",
    title: "",
    amount: 0,
    category: "",
    date: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Traemos el gasto existente
  useEffect(() => {
    const fetchExpense = async () => {
      try {
        const res = await fetch("/api/expenses");
        const data: Expense[] = await res.json();
        const expense = data.find((e) => e.id === id);
        if (!expense) {
          setError("Gasto no encontrado");
          return;
        }
        setForm({
          ...expense,
          date: expense.date.split("T")[0], // "YYYY-MM-DD" para el input
        });
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Error al cargar el gasto");
      }
    };
    fetchExpense();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.amount || !form.category || !form.date) {
      setError("Todos los campos son obligatorios");
      return;
    }

    try {
      await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          amount: parseFloat(form.amount.toString()),
          category: form.category,
          date: form.date,
        }),
      });
      router.push("/expenses");
    } catch (err) {
      console.error(err);
      setError("Error al actualizar el gasto");
    }
  };

  if (loading) return <p className="p-6">Cargando...</p>;
  if (error) return <p className="p-6 text-red-500">{error}</p>;

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Editar Gasto</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white shadow rounded-2xl p-6">
        {error && <p className="text-red-500">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700">Título</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Monto</label>
          <input
            type="number"
            name="amount"
            value={form.amount}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Categoría</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
            required
          >
            <option value="">Seleccioná...</option>
            <option value="food">Comida</option>
            <option value="transport">Transporte</option>
            <option value="utilities">Servicios</option>
            <option value="entertainment">Ocio</option>
            <option value="other">Otros</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700"
        >
          Actualizar
        </button>
      </form>
    </main>
  );
}
