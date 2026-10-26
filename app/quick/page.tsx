// app/quick/page.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CaptureButton from "@/components/CaptureButton";
import VoiceButton, { type VoiceResult, type VoiceState } from "@/components/VoiceButton";
import { useCategories } from "@/lib/useCategories";
import { formatAmount, formatDate, parseAmount, toAmountInput, todayISO } from "@/lib/format";
import { savePending } from "@/lib/pendingQueue";
import { limitExcess } from "@/lib/spendingLimit";

// No spending limit exists yet (savings and budgets are on hold): with null the "supera
// límite" state never shows. See lib/spendingLimit.ts.
const SPENDING_LIMIT: number | null = null;

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const CAMERA = icon("M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7");
const MENU = icon("M4 7h16M4 12h16M4 17h16");

// With the keyboard open (iOS doesn't resize the page for it) the content is laid out in the
// visible area, so the + button stays reachable above the keyboard
function useKeyboardHeight() {
  const [visible, setVisible] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVisible(vv.height < window.innerHeight - 120 ? vv.height : null);
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, []);
  return visible;
}

type Flash = { text: string; error?: boolean };

// Quick entry, the screen the installed app opens on: type the amount, tap +. It's saved
// as a pending expense (no category yet) to finish later in Pendientes, and it works
// offline (lib/pendingQueue.ts). Camera and voice work like in Nuevo gasto: the photo is
// read with AI in the background, and voice understands whole sentences.
export default function QuickEntryPage() {
  const { categories } = useCategories();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  // What the voice understood besides the amount, kept as the pending's suggestion
  const [suggestion, setSuggestion] = useState<VoiceResult | null>(null);
  const [heard, setHeard] = useState<{ text: string; complete: boolean } | null>(null);
  const [voice, setVoice] = useState<{ state: VoiceState; transcript: string }>({ state: "idle", transcript: "" });
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const keyboardHeight = useKeyboardHeight();

  const value = parseAmount(amount);
  const valid = value > 0;
  const currency = suggestion?.currency ?? "ARS";
  const excess = limitExcess(valid ? value : 0, 0, SPENDING_LIMIT);

  const showFlash = (next: Flash) => {
    clearTimeout(flashTimer.current);
    setFlash(next);
    flashTimer.current = setTimeout(() => setFlash(null), 3500);
  };
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const onVoiceProgress = useCallback((state: VoiceState, transcript: string) => setVoice({ state, transcript }), []);

  const onVoiceResult = (result: VoiceResult) => {
    // Only a valid amount fills the field; the rest rides along as the pending's suggestion
    if (!result.amount) {
      setHeard({ text: "No entendí el monto. Probá de nuevo.", complete: false });
      return;
    }
    setAmount(toAmountInput(result.amount));
    setSuggestion(result);
    const category = categories.find((c) => c.id === result.categoryId);
    const parts = [
      formatAmount(result.amount, result.currency),
      result.title,
      category?.name,
      result.date !== todayISO() && formatDate(result.date),
      result.installments && `${result.installments} cuotas`,
    ].filter(Boolean);
    setHeard({ text: `Entendí: ${parts.join(" · ")}`, complete: true });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setFlash(null);
    let result: Awaited<ReturnType<typeof savePending>>;
    try {
      result = await savePending({
        amount: value,
        // The day it was entered: an offline save can reach the server tomorrow
        suggestedDate: suggestion?.date ?? todayISO(),
        ...(suggestion && {
          suggestedAmount: suggestion.amount ?? undefined,
          suggestedCurrency: suggestion.currency,
          suggestedTitle: suggestion.title ?? undefined,
          suggestedCategoryId: suggestion.categoryId ?? undefined,
          suggestedInstallments: suggestion.installments ?? undefined,
        }),
      });
    } catch {
      result = "error";
    }
    setSaving(false);
    if (result === "error") {
      showFlash({ text: "No se pudo guardar. Probá de nuevo.", error: true });
      return;
    }
    setAmount("");
    setSuggestion(null);
    setHeard(null);
    showFlash({
      text:
        result === "queued"
          ? "Sin conexión: quedó en este teléfono y se guarda al volver la conexión"
          : "Guardado en pendientes",
    });
  };

  const help: Flash = saving
    ? { text: "Guardando gasto…" }
    : voice.state === "listening"
      ? { text: voice.transcript || "Escuchando… (tocá para terminar)" }
      : voice.state === "thinking"
        ? { text: `Entendiendo “${voice.transcript}”…` }
        : flash ?? (heard && !heard.complete ? { text: heard.text, error: true } : null) ??
          (valid ? { text: heard?.text ?? "Tocá + para guardar" } : { text: "Ingresá el monto" });

  return (
    <>
      <form
        onSubmit={save}
        style={keyboardHeight ? { minHeight: keyboardHeight, paddingBottom: 16 } : undefined}
        className="mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top))] max-w-md flex-col px-4 pt-16 pb-[calc(104px+env(safe-area-inset-bottom))]"
      >
        <h1 className="text-center text-[15px] font-semibold text-ink-muted">Nuevo gasto · hoy</h1>

        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6">
          <div className="amount-panel w-full" data-alert={excess ? "true" : undefined}>
            <label className="flex items-baseline justify-center gap-1">
              <span className="sr-only">Monto</span>
              <span className={`text-[32px] font-bold ${excess ? "text-alert-text" : "text-ink-muted"}`} aria-hidden>
                {currency === "USD" ? "US$" : "$"}
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                readOnly={saving}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setFlash(null);
                  if (heard && !heard.complete) setHeard(null);
                }}
                aria-invalid={excess ? true : undefined}
                aria-describedby={excess ? "quick-limit" : "quick-help"}
                // --chars is the fallback width where field-sizing isn't supported (Safari);
                // long amounts shrink from 72px so they still fit a 390px screen
                style={
                  {
                    "--chars": Math.max(amount.length, 1),
                    fontSize: amount.length > 9 ? 44 : amount.length > 6 ? 56 : undefined,
                  } as React.CSSProperties
                }
                className="amount-input text-display"
              />
            </label>
          </div>

          {excess && (
            <p id="quick-limit" role="alert" className="flex items-center gap-2 text-alert-text">
              <span aria-hidden>⚠</span>
              Supera el límite del mes en {formatAmount(excess, currency)}
            </p>
          )}

          <p
            id="quick-help"
            role="status"
            className={`min-h-[1.5em] text-center text-[15px] font-medium ${help.error ? "text-alert-text" : "text-ink-muted"}`}
          >
            {help.error && <span aria-hidden>⚠ </span>}
            {help.text}
          </p>

          <button
            type="submit"
            disabled={!valid || saving}
            aria-busy={saving}
            aria-label={saving ? "Guardando gasto" : "Guardar gasto"}
            className="fab-save"
          >
            {saving ? <span className="spinner" aria-hidden /> : <span aria-hidden>+</span>}
          </button>
        </div>
      </form>

      {!keyboardHeight && (
        <nav
          aria-label="Acciones"
          className="fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 mx-auto flex h-[72px] max-w-md items-center justify-around rounded-pill bg-bg px-2 shadow-raised"
        >
          <CaptureButton
            className="tab-item"
            ariaLabel="Foto del ticket"
            initialAmount={amount}
            onSaved={(result) => {
              setAmount("");
              setSuggestion(null);
              setHeard(null);
              showFlash({
                text:
                  result === "queued"
                    ? "Sin conexión: quedó en este teléfono y se guarda al volver la conexión"
                    : "Guardado en pendientes",
              });
            }}
          >
            {CAMERA}
          </CaptureButton>
          <VoiceButton
            compact
            today={todayISO()}
            onResult={onVoiceResult}
            onError={(text) => setHeard({ text, complete: false })}
            onProgress={onVoiceProgress}
          />
          <Link href="/" aria-label="Menú" className="tab-item">
            {MENU}
          </Link>
        </nav>
      )}
    </>
  );
}
