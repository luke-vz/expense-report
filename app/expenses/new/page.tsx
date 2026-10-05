// app/expenses/new/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ExpenseForm, { ExpenseFormValues, ExpenseSubmit, PendingDraft } from "@/components/ExpenseForm";
import type { PendingExpense } from "@/lib/expenses";
import { expenseTitle, formatAmount, formatDate, toAmountInput, toLocalISODate, todayISO } from "@/lib/format";
import type { Expense } from "@/lib/expenses";
import { notifyPendingChanged } from "@/lib/usePendingCount";

interface Saved {
  id: string;
  label: string;
  kind: "expense" | "pending";
}

const emptyValues = (): ExpenseFormValues => ({ title: "", amount: "", categoryId: "", date: todayISO(), currency: "ARS" });

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

  const uploadPending = async (draft: PendingDraft) => {
    const form = new FormData();
    form.append("photo", draft.photo, "photo.jpg");
    if (draft.amount) form.append("amount", String(draft.amount));
    if (draft.note) form.append("note", draft.note);
    const res = await fetch("/api/pending", { method: "POST", body: form });
    return res.ok ? ((await res.json()) as PendingExpense) : null;
  };

  const savePending = async (draft: PendingDraft) => {
    const saved = await uploadPending(draft);
    if (!saved) return "No se pudo guardar el pendiente.";
    notifyPendingChanged();
    setLastSaved({ id: saved.id, label: "", kind: "pending" });
    setFormKey((k) => k + 1);
  };

  const createExpense = async ({ photo, ...expense }: ExpenseSubmit, another: boolean) => {
    // A photo attached here is uploaded as a pending first, then completed into the
    // expense: same path as completing a pending, so it becomes the receipt (cuotas too)
    let fromPending = pendingId;
    if (photo) {
      const uploaded = await uploadPending({ photo, amount: null, note: null });
      if (!uploaded) return "No se pudo subir la foto.";
      fromPending = uploaded.id;
    }
    const post = (allowDuplicate: boolean) =>
      fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...expense, ...(fromPending ? { pendingId: fromPending } : {}), allowDuplicate }),
      });
    let res = await post(false);

    // Same amount, category and day already loaded (maybe by the other person): ask first
    if (res.status === 409) {
      const { duplicate } = (await res.json()) as { duplicate: Expense };
      const by = duplicate.createdByName ? `, cargado por ${duplicate.createdByName.split(" ")[0]}` : "";
      const ok = confirm(
        `Ya hay un gasto igual: "${expenseTitle(duplicate)}" ${formatAmount(duplicate.amount, duplicate.currency)} ` +
          `el ${formatDate(duplicate.date)}${by}.\n\n¿Cargarlo igual?`
      );
      if (!ok) {
        // A photo attached here was uploaded as a pending just for this save: discard it
        if (photo && fromPending) await fetch(`/api/pending/${fromPending}`, { method: "DELETE" });
        return "No se cargó: era un duplicado.";
      }
      res = await post(true);
    }
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
    const cuotas = expense.installments ? ` en ${expense.installments} cuotas` : "";
    setLastSaved({ id: saved.id, label: `${expense.title} · ${formatAmount(expense.amount, expense.currency)}${cuotas}`, kind: "expense" });
    setFormKey((k) => k + 1);
  };

  const undo = async () => {
    if (!lastSaved) return;
    // scope=group also removes the other installments of a purchase just saved in cuotas
    const url = lastSaved.kind === "pending" ? `/api/pending/${lastSaved.id}` : `/api/expenses/${lastSaved.id}?scope=group`;
    const res = await fetch(url, { method: "DELETE" });
    if (lastSaved.kind === "pending") notifyPendingChanged();
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
          currency: "ARS",
        }}
        allowInstallments
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
        allowInstallments
        allowPhoto
        showShortcuts
        onSaveAsPending={savePending}
        autoFocusAmount
        onSubmit={createExpense}
      />

      {lastSaved && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-28 z-50 mx-auto max-w-md flex items-center justify-between gap-3 rounded-md bg-[#2b2b2b] border-card px-4 py-3 shadow-lg md:bottom-8"
        >
          <span className="text-sm truncate">
            {lastSaved.kind === "pending" ? "Guardado en pendientes" : `Guardado: ${lastSaved.label}`}
          </span>
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
