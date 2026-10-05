// app/expenses/[id]/edit/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import ExpenseForm, { ExpenseFormValues, ExpenseSubmit } from "@/components/ExpenseForm";
import type { Expense } from "@/lib/expenses";
import { toAmountInput } from "@/lib/format";

export default function EditExpensePage() {
  const router = useRouter();
  const { id } = useParams();

  const [initialValues, setInitialValues] = useState<ExpenseFormValues | null>(null);
  const [loadError, setLoadError] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  // Traemos el gasto existente
  useEffect(() => {
    const fetchExpense = async () => {
      try {
        const res = await fetch(`/api/expenses/${id}`);
        if (!res.ok) {
          setLoadError("Gasto no encontrado");
          return;
        }
        const expense: Expense = await res.json();
        setReceiptUrl(expense.receiptUrl ?? null);
        setInitialValues({
          title: expense.title,
          amount: toAmountInput(expense.amount),
          categoryId: expense.categoryId,
          date: expense.date.slice(0, 10), // "YYYY-MM-DD" para el input
        });
      } catch (err) {
        console.error(err);
        setLoadError("Error al cargar el gasto");
      }
    };
    fetchExpense();
  }, [id]);

  const updateExpense = async (expense: ExpenseSubmit) => {
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expense),
    });

    if (!res.ok) return "Error al actualizar el gasto.";
    router.push("/expenses");
  };

  if (loadError) return <p className="p-6 text-red-500">{loadError}</p>;
  if (!initialValues) return <p className="p-6">Cargando...</p>;

  return (
    <div>
      <ExpenseForm
        heading="Editar gasto"
        initialValues={initialValues}
        photoUrl={receiptUrl}
        submitLabel="Actualizar"
        onSubmit={updateExpense}
      />
    </div>
  );
}
