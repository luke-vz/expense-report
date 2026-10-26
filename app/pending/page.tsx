// app/pending/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import CaptureButton from "@/components/CaptureButton";
import PhotoViewer from "@/components/PhotoViewer";
import type { PendingExpense } from "@/lib/expenses";
import { formatAmount } from "@/lib/format";
import { notifyPendingChanged } from "@/lib/usePendingCount";
import { useCategories } from "@/lib/useCategories";

const capturedAt = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function PendingPage() {
  const [pending, setPending] = useState<PendingExpense[] | null>(null);
  const { categories } = useCategories();

  const load = useCallback(async () => {
    const res = await fetch("/api/pending");
    setPending(res.ok ? await res.json() : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // While the AI is reading a photo, refresh every few seconds to show what it found
  const reading = (pending ?? []).some((p) => p.aiStatus === "reading");
  useEffect(() => {
    if (!reading) return;
    const timer = setTimeout(load, 3000);
    return () => clearTimeout(timer);
  }, [reading, pending, load]);

  // What the person typed at capture wins over what the AI read
  const describe = (item: PendingExpense) => {
    const ai = item.suggestion;
    const amount = item.amount ?? ai?.amount;
    const currency = item.amount ? "ARS" : (ai?.currency ?? "ARS");
    return {
      amount: amount ? formatAmount(amount, currency) : null,
      title: item.note ?? ai?.title ?? null,
      category: categories.find((c) => c.id === ai?.categoryId)?.name ?? null,
    };
  };

  const discard = async (item: PendingExpense) => {
    if (!confirm("¿Descartar este pendiente? La foto se borra.")) return;
    const res = await fetch(`/api/pending/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("No se pudo descartar.");
      return;
    }
    notifyPendingChanged();
    load();
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pendientes</h1>
        <p className="text-sm text-ink-muted mt-1">Sacale una foto al ticket ahora y completalo cuando tengas un rato.</p>
      </div>

      <CaptureButton
        onSaved={load}
        className="flex items-center justify-center gap-2 w-full rounded-md bg-accent py-4 text-lg font-semibold text-accent-ink"
      >
        📷 Sacar foto
      </CaptureButton>

      <ul className="space-y-3">
        {(pending ?? []).map((item) => (
          <li key={item.id} className="flex gap-3 bg-secundario border-card rounded-md p-3">
            {item.photoUrl ? (
              <PhotoViewer src={item.photoUrl} alt="Foto del pendiente" className="h-20 w-20 rounded object-cover bg-input" />
            ) : (
              <div className="h-20 w-20 shrink-0 rounded bg-input flex items-center justify-center text-2xl">📝</div>
            )}
            <div className="min-w-0 flex-1 flex flex-col">
              <span className="font-semibold">{describe(item).amount ?? "Sin monto"}</span>
              {describe(item).title && (
                <span className="text-sm truncate">
                  {describe(item).title}
                  {describe(item).category && <span className="text-ink-muted"> · {describe(item).category}</span>}
                </span>
              )}
              {item.aiStatus === "reading" && <span className="text-xs text-accent-text">Leyendo el ticket…</span>}
              <span className="text-xs text-ink-muted">{capturedAt(item.createdAt)}</span>
              <div className="mt-auto flex gap-4 pt-1 text-sm">
                <Link href={`/expenses/new?pending=${item.id}`} className="text-accent-text font-semibold">
                  Completar
                </Link>
                <button onClick={() => discard(item)} className="text-alert-text">
                  Descartar
                </button>
              </div>
            </div>
          </li>
        ))}
        {pending !== null && pending.length === 0 && (
          <li className="text-center text-ink-muted py-6">No hay pendientes 🎉</li>
        )}
      </ul>
    </div>
  );
}
