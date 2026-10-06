// Shared by the list and the edit screen. Installments ask whether to delete the whole
// purchase or just this one. Returns what was deleted, or null if cancelled/failed.
import type { Expense } from "@/lib/expenses";

export async function confirmAndDeleteExpense(exp: Expense): Promise<"group" | "single" | null> {
  let wholeGroup = false;
  if (exp.installmentGroupId) {
    wholeGroup = confirm(
      `"${exp.title}" está en ${exp.installmentCount} cuotas.\n\n¿Eliminar TODAS las cuotas?\n(Cancelar para elegir otra opción)`
    );
    if (!wholeGroup && !confirm(`¿Eliminar solo la cuota ${exp.installmentNumber}/${exp.installmentCount}?`)) return null;
  } else if (!confirm("¿Seguro que querés eliminar este gasto?")) {
    return null;
  }

  const res = await fetch(`/api/expenses/${exp.id}${wholeGroup ? "?scope=group" : ""}`, { method: "DELETE" });
  if (!res.ok) {
    alert("No se pudo eliminar el gasto.");
    return null;
  }
  return wholeGroup ? "group" : "single";
}
