// app/expenses/[id]/edit/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import ExpenseForm, { ExpenseFormValues } from "@/components/ExpenseForm";
import type { Expense } from "@/lib/expenses";

export default function EditExpensePage() {
  const router = useRouter();
  const { id } = useParams();

  const [initialValues, setInitialValues] = useState<ExpenseFormValues | null>(null);
  const [loadError, setLoadError] = useState("");

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
        setInitialValues({
          title: expense.title,
          amount: expense.amount.toString(),
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

  const updateExpense = async (values: ExpenseFormValues) => {
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, amount: parseFloat(values.amount) }),
    });

    if (!res.ok) return "Error al actualizar el gasto.";
    router.push("/expenses");
  };

  if (loadError) return <p className="p-6 text-red-500">{loadError}</p>;
  if (!initialValues) return <p className="p-6">Cargando...</p>;

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Editar gasto</h1>
      <ExpenseForm initialValues={initialValues} submitLabel="Actualizar" onSubmit={updateExpense} />
    </main>
  );
}
