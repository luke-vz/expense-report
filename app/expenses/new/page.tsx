// app/expenses/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCategories } from "@/lib/useCategories";
import { todayISO } from "@/lib/format";

export default function NewExpensePage() {
  const router = useRouter();
  const { categories } = useCategories();
  const [form, setForm] = useState({
    title: "",
    amount: "",
    categoryId: "",
    date: todayISO(),
  });
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title || !form.amount || !form.categoryId || !form.date) {
      setError("Todos los campos son obligatorios.");
      return;
    }

    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        amount: parseFloat(form.amount),
        categoryId: form.categoryId,
        date: form.date,
      }),
    });

    if (res.ok) {
      router.push("/expenses");
    } else {
      setError("Error al guardar el gasto.");
    }
  };

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Agregar nuevo gasto</h1>
      
      <form onSubmit={handleSubmit} className="border-card space-y-4 bg-grey-50 shadow rounded-md p-6 bg-secundario">
        {error && <p className="text-red-500">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-500">Título</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            className="bg-input mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-500">Monto</label>
          <input
            type="number"
            name="amount"
            value={form.amount}
            onChange={handleChange}
            className="bg-input mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
            inputMode="numeric"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-500">Categoría</label>
          <select
            name="categoryId"
            value={form.categoryId}
            onChange={handleChange}
            className="bg-input mt-1 block w-full rounded-md border-gray-500 shadow-sm p-2"
            required
          >
            <option value="">Seleccioná...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-500">Fecha</label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            className="bg-input mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-boton px-4 py-2 rounded-xl hover:bg-indigo-700"
        >
          Guardar
        </button>
      </form>
    </main>
  );
}
