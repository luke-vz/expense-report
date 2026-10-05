// app/expenses/new/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExpenseForm, { ExpenseFormValues, ExpenseSubmit } from "@/components/ExpenseForm";
import type { PendingExpense } from "@/lib/expenses";
import { formatMoney, toAmountInput, toLocalISODate, todayISO } from "@/lib/format";
import { notifyPendingChanged } from "@/lib/usePendingCount";

interface Saved {
  id: string;
  label: string;
}

const emptyValues = (): ExpenseFormValues => ({ title: "", amount: "", categoryId: "", date: todayISO() });

function NewExpense() {
  const router = useRouter();
  // ?pending=<id>: completing a "pre-gasto" captured earlier
  const pendingId = useSearchParams().get("pending");
  const [pending, setPending] = useState<PendingExpense | null>(null);
  const [loadError, setLoadError] = useState("");
  // Changing the key remounts the form with empty values after "Guardar y otro"
  const [formKey, setFormKey] = useState(0);
  const [lastSaved, setLastSaved] = useState<Saved | null>(null);

  useEffect(() => {
    if (!pendingId) return;
    fetch(`/api/pending/${pendingId}`).then(async (res) => {
      if (res.ok) setPending(await res.json());
      else setLoadError("Ese pendiente ya no existe.");
    });
  }, [pendingId]);

  useEffect(() => {
    if (!lastSaved) return;
    const timer = setTimeout(() => setLastSaved(null), 6000);
    return () => clearTimeout(timer);
  }, [lastSaved]);

  const createExpense = async (expense: ExpenseSubmit, another: boolean) => {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingId ? { ...expense, pendingId } : expense),
    });
    if (!res.ok) return "Error al guardar el gasto.";

    if (pendingId) {
      notifyPendingChanged();
      router.push("/pending");
      return;
    }
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

  if (pendingId) {
    if (loadError) return <p className="p-6 text-red-500">{loadError}</p>;
    if (!pending) return <p className="p-6">Cargando...</p>;
    return (
      <ExpenseForm
        heading="Completar gasto"
        photoUrl={pending.photoUrl}
        initialValues={{
          title: pending.note ?? "",
          amount: pending.amount ? toAmountInput(pending.amount) : "",
          categoryId: "",
          date: toLocalISODate(new Date(pending.createdAt)),
        }}
        submitLabel="Guardar"
        onSubmit={createExpense}
      />
    );
  }

  return (
    <div>
      <ExpenseForm
        key={formKey}
        heading="Nuevo gasto"
        initialValues={emptyValues()}
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

export default function NewExpensePage() {
  // useSearchParams needs a Suspense boundary for static rendering
  return (
    <Suspense>
      <NewExpense />
    </Suspense>
  );
}
