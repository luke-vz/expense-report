// components/ExpenseForm.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import PhotoViewer from "@/components/PhotoViewer";
import { useCategories } from "@/lib/useCategories";
import { daysAgoISO, parseAmount } from "@/lib/format";

export interface ExpenseFormValues {
  title: string; // optional: empty means "use the category name"
  amount: string; // as typed, e.g. "1.500,50" — parse with parseAmount
  categoryId: string;
  date: string; // "YYYY-MM-DD"
}

export interface ExpenseSubmit {
  title: string;
  amount: number;
  categoryId: string;
  date: string;
}

interface ExpenseFormProps {
  heading: string;
  initialValues: ExpenseFormValues;
  submitLabel: string;
  /** Shows a second "Guardar y otro" button that calls onSubmit with another = true. */
  allowAnother?: boolean;
  autoFocusAmount?: boolean;
  /** Receipt photo shown above the amount (completing a pending expense, or editing one). */
  photoUrl?: string | null;
  /** Returns an error message to show, or nothing on success. */
  onSubmit: (expense: ExpenseSubmit, another: boolean) => Promise<string | void>;
}

// Quick-entry form, mobile first: amount on top, categories as tap targets,
// date shortcuts and the actions pinned to the bottom of the screen.
export default function ExpenseForm({
  heading,
  initialValues,
  submitLabel,
  allowAnother = false,
  autoFocusAmount = false,
  photoUrl,
  onSubmit,
}: ExpenseFormProps) {
  const { categories } = useCategories();
  const [form, setForm] = useState(initialValues);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const today = daysAgoISO(0);
  const yesterday = daysAgoISO(1);
  // Most used categories first, so the usual ones are always within reach
  const sortedCategories = [...categories].sort(
    (a, b) => (b.expenseCount ?? 0) - (a.expenseCount ?? 0) || a.name.localeCompare(b.name)
  );

  const set = (field: keyof ExpenseFormValues, value: string) => {
    setForm({ ...form, [field]: value });
    setError("");
  };

  const submit = async (another: boolean) => {
    const amount = parseAmount(form.amount);
    if (!(amount > 0)) {
      setError("Ingresá un monto válido.");
      return;
    }
    const category = categories.find((c) => c.id === form.categoryId);
    if (!category) {
      setError("Elegí una categoría.");
      return;
    }
    if (!form.date) {
      setError("Elegí una fecha.");
      return;
    }

    setSaving(true);
    const submitError = await onSubmit(
      { title: form.title.trim() || category.name, amount, categoryId: category.id, date: form.date },
      another
    );
    setSaving(false);
    setError(submitError ?? "");
  };

  const chip = (selected: boolean) =>
    `px-4 py-2 rounded-full border text-sm transition-colors ${
      selected ? "bg-[#3987e5] border-[#3987e5] text-white" : "border-[#616161] text-gray-300 active:bg-neutral-800"
    }`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="max-w-xl mx-auto px-4 pt-4 pb-32 md:pb-8"
    >
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{heading}</h1>
        <Link href="/expenses" aria-label="Cerrar" className="text-2xl leading-none px-2 text-gray-400">
          ✕
        </Link>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {photoUrl && (
        <div className="mb-6 flex justify-center">
          <PhotoViewer src={photoUrl} alt="Foto del gasto" className="max-h-64 rounded-md object-contain" />
        </div>
      )}

      <label className="block text-center">
        <span className="sr-only">Monto</span>
        <span className="flex items-baseline justify-center gap-1">
          <span className="text-3xl text-gray-500">$</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            autoFocus={autoFocusAmount}
            // Grows with the typed amount so the "$" stays next to the number
            style={{ width: `${Math.max(form.amount.length, 1) + 0.5}ch` }}
            className="max-w-full bg-transparent text-5xl font-bold outline-none placeholder:text-gray-600"
          />
        </span>
      </label>

      <fieldset className="mt-8">
        <legend className="text-sm text-gray-400 mb-2">Categoría</legend>
        <div className="flex flex-wrap gap-2">
          {sortedCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => set("categoryId", c.id)}
              aria-pressed={form.categoryId === c.id}
              className={chip(form.categoryId === c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block mt-6">
        <span className="text-sm text-gray-400">Detalle (opcional)</span>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ej: súper, nafta, farmacia"
          className="bg-input mt-1 block w-full rounded-md p-3"
        />
      </label>

      <fieldset className="mt-6">
        <legend className="text-sm text-gray-400 mb-2">Fecha</legend>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => set("date", today)} className={chip(form.date === today)}>
            Hoy
          </button>
          <button type="button" onClick={() => set("date", yesterday)} className={chip(form.date === yesterday)}>
            Ayer
          </button>
          <input
            type="date"
            aria-label="Otra fecha"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className={`bg-input rounded-full px-4 py-2 text-sm ${
              form.date !== today && form.date !== yesterday ? "ring-2 ring-[#3987e5]" : ""
            }`}
          />
        </div>
      </fieldset>

      <div className="fixed bottom-0 inset-x-0 z-40 flex gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-[#121212] border-t border-[#2b2b2b] md:static md:mt-8 md:p-0 md:border-0 md:bg-transparent">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-[#3987e5] text-white font-semibold py-3 rounded-md disabled:opacity-50"
        >
          {saving ? "Guardando..." : submitLabel}
        </button>
        {allowAnother && (
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(true)}
            className="flex-1 bg-boton py-3 rounded-md disabled:opacity-50"
          >
            Guardar y otro
          </button>
        )}
      </div>
    </form>
  );
}
