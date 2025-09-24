"use client"
import { PieChart, Pie, Cell, Tooltip } from "recharts"

const COLORS = ["#4ade80", "#60a5fa", "#fbbf24", "#f87171", "#a78bfa"]

export default function ChartSummary({ data }: { data: { category: string, amount: number }[] }) {
  return (
    <div className="flex justify-center">
      <PieChart width={300} height={300}>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="category"
          cx="50%"
          cy="50%"
          outerRadius={120}
          label
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </div>
  )
}
