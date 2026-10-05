// app/expenses/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ExpenseForm, { ExpenseSubmit } from "@/components/ExpenseForm";
import { formatMoney, todayISO } from "@/lib/format";

interface Saved {
  id: string;
  label: string;
}

export default function NewExpensePage() {
  const router = useRouter();
  // Changing the key remounts the form with empty values after "Guardar y otro"
  const [formKey, setFormKey] = useState(0);
  const [lastSaved, setLastSaved] = useState<Saved | null>(null);

  useEffect(() => {
    if (!lastSaved) return;
    const timer = setTimeout(() => setLastSaved(null), 6000);
    return () => clearTimeout(timer);
  }, [lastSaved]);

  const createExpense = async (expense: ExpenseSubmit, another: boolean) => {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expense),
    });
    if (!res.ok) return "Error al guardar el gasto.";

    if (!another) {
      router.push("/expenses");
      return;
    }
    const saved = await res.json();
    setLastSaved({ id: saved.id, label: `${expense.title} · $${formatMoney(expense.amount)}` });
    setFormKey((k) => k + 1);
  };

  const undo = async () => {
    if (!lastSaved) return;
    const res = await fetch(`/api/expenses/${lastSaved.id}`, { method: "DELETE" });
    setLastSaved(null);
    if (!res.ok) alert("No se pudo deshacer.");
  };

  return (
    <div>
      <ExpenseForm
        key={formKey}
        heading="Nuevo gasto"
        initialValues={{ title: "", amount: "", categoryId: "", date: todayISO() }}
        submitLabel="Guardar"
        allowAnother
        autoFocusAmount
        onSubmit={createExpense}
      />

      {lastSaved && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-28 z-50 mx-auto max-w-md flex items-center justify-between gap-3 rounded-md bg-[#2b2b2b] border-card px-4 py-3 shadow-lg md:bottom-8"
        >
          <span className="text-sm truncate">Guardado: {lastSaved.label}</span>
          <button onClick={undo} className="text-[#3987e5] font-semibold text-sm shrink-0">
            Deshacer
          </button>
        </div>
      )}
    </div>
  );
}
