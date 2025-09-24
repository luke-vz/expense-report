// components/ExpenseFilters.tsx
"use client"
import { useState } from "react"

// Definimos un tipo para los filtros
export interface ExpenseFilter {
  category: string
  from: string
  to: string
}

export default function ExpenseFilters({ onFilter }: { onFilter: (filters: ExpenseFilter) => void }) {
  const [category, setCategory] = useState<string>("")
  const [from, setFrom] = useState<string>("")
  const [to, setTo] = useState<string>("")

  const apply = () => {
    onFilter({ category, from, to })
  }

  return (
    <div className="flex gap-2 items-end mb-4">
      <select
        value={category}
        onChange={e => setCategory(e.target.value)}
        className="border p-2 rounded"
      >
        <option value="">Todas</option>
        <option>Alimentos</option>
        <option>Transporte</option>
        <option>Hogar</option>
        <option>Entretenimiento</option>
        <option>Salud</option>
      </select>

      <input
        type="date"
        value={from}
        onChange={e => setFrom(e.target.value)}
        className="border p-2 rounded"
      />
      <input
        type="date"
        value={to}
        onChange={e => setTo(e.target.value)}
        className="border p-2 rounded"
      />

      <button
        onClick={apply}
        className="bg-gray-200 px-3 py-2 rounded hover:bg-gray-300"
      >
        Filtrar
      </button>
    </div>
  )
}
