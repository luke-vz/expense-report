// components/ExpenseForm.tsx
"use client";

import { useState } from "react";
import { useCategories } from "@/lib/useCategories";

export interface ExpenseFormValues {
  title: string;
  amount: string;
  categoryId: string;
  date: string; // "YYYY-MM-DD"
}

interface ExpenseFormProps {
  initialValues: ExpenseFormValues;
  submitLabel: string;
  /** Returns an error message to show, or nothing on success. */
  onSubmit: (values: ExpenseFormValues) => Promise<string | void>;
}

export default function ExpenseForm({ initialValues, submitLabel, onSubmit }: ExpenseFormProps) {
  const { categories } = useCategories();
  const [form, setForm] = useState(initialValues);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim() || !form.amount || !form.categoryId || !form.date) {
      setError("Todos los campos son obligatorios.");
      return;
    }
    if (!(parseFloat(form.amount) > 0)) {
      setError("El monto tiene que ser mayor a cero.");
      return;
    }

    setSaving(true);
    const submitError = await onSubmit(form);
    setSaving(false);
    setError(submitError ?? "");
  };

  return (
    <form onSubmit={handleSubmit} className="border-card space-y-4 shadow rounded-md p-6 bg-secundario">
      {error && <p className="text-red-500">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-gray-400">Título</label>
        <input
          type="text"
          name="title"
          value={form.title}
          onChange={handleChange}
          className="bg-input mt-1 block w-full rounded-md shadow-sm p-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400">Monto</label>
        <input
          type="number"
          name="amount"
          value={form.amount}
          onChange={handleChange}
          className="bg-input mt-1 block w-full rounded-md shadow-sm p-2"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400">Categoría</label>
        <select
          name="categoryId"
          value={form.categoryId}
          onChange={handleChange}
          className="bg-input mt-1 block w-full rounded-md shadow-sm p-2"
          required
        >
          <option value="">Seleccioná...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400">Fecha</label>
        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          className="bg-input mt-1 block w-full rounded-md shadow-sm p-2"
          required
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-boton px-4 py-2 rounded-md disabled:opacity-50"
      >
        {saving ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}
