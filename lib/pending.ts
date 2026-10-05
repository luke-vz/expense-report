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
  };
}
