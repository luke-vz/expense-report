import type { PendingExpense } from "@prisma/client";
import { photoUrl } from "@/lib/photos";

// Client-facing shape: amount as a number, photo as an app URL (never the storage key)
export function serializePending(pending: PendingExpense) {
  return {
    id: pending.id,
    amount: pending.amount ? pending.amount.toNumber() : null,
    note: pending.note,
    photoUrl: pending.photoKey ? photoUrl(pending.photoKey) : null,
    createdBy: pending.createdBy,
    createdAt: pending.createdAt.toISOString(),
    aiStatus: pending.aiStatus as "reading" | "done" | "failed" | null,
    suggestion:
      pending.aiStatus === "done"
        ? {
            amount: pending.suggestedAmount ? pending.suggestedAmount.toNumber() : null,
            currency: pending.suggestedCurrency ?? "ARS",
            title: pending.suggestedTitle,
            categoryId: pending.suggestedCategoryId,
            date: pending.suggestedDate ? pending.suggestedDate.toISOString().slice(0, 10) : null,
            installments: pending.suggestedInstallments,
          }
        : null,
  };
}
