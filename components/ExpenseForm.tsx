"use client"

import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

const expenseSchema = z.object({
  amount: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, {
    message: "El monto debe ser un número positivo",
  }),
  category: z.string().min(1, "Seleccione una categoría"),
  date: z.string().min(1, "Seleccione una fecha"),
  note: z.string().optional(),
})

type ExpenseFormData = z.infer<typeof expenseSchema>
export type ExpenseSaveData = Omit<ExpenseFormData, "amount"> & { amount: number }

interface ExpenseFormProps {
  onSave: (data: ExpenseSaveData) => void
}

export default function ExpenseForm({ onSave }: ExpenseFormProps) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      category: "Alimentos",
    }
  })

  const onSubmit = (data: ExpenseFormData) => {
    onSave({ ...data, amount: Number(data.amount) })
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 p-4 border rounded-xl shadow-sm bg-white">
      <input
        {...register("amount")}
        placeholder="Monto"
        className="border p-2 rounded"
      />
      {errors.amount && <p className="text-red-500 text-sm">{errors.amount.message}</p>}

      <select {...register("category")} className="border p-2 rounded">
        <option value="Alimentos">Alimentos</option>
        <option value="Transporte">Transporte</option>
        <option value="Hogar">Hogar</option>
        <option value="Entretenimiento">Entretenimiento</option>
        <option value="Salud">Salud</option>
      </select>
      {errors.category && <p className="text-red-500 text-sm">{errors.category.message}</p>}

      <input type="date" {...register("date")} className="border p-2 rounded" />
      {errors.date && <p className="text-red-500 text-sm">{errors.date.message}</p>}

      <textarea {...register("note")} placeholder="Nota (opcional)" className="border p-2 rounded" />

      <button type="submit" className="bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
        Guardar
      </button>
    </form>
  )
}
