// app/expenses/new/page.tsx
"use client";

import { useRouter } from "next/navigation";
import ExpenseForm, { ExpenseFormValues } from "@/components/ExpenseForm";
import { todayISO } from "@/lib/format";

export default function NewExpensePage() {
  const router = useRouter();

  const createExpense = async (values: ExpenseFormValues) => {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, amount: parseFloat(values.amount) }),
    });

    if (!res.ok) return "Error al guardar el gasto.";
    router.push("/expenses");
  };

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Agregar nuevo gasto</h1>
      <ExpenseForm
        initialValues={{ title: "", amount: "", categoryId: "", date: todayISO() }}
        submitLabel="Guardar"
        onSubmit={createExpense}
      />
    </main>
  );
}
