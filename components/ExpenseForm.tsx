// components/ExpenseForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PhotoViewer from "@/components/PhotoViewer";
import { useCategories } from "@/lib/useCategories";
import { daysAgoISO, formatAmount, formatDate, monthKey, monthLabel, parseAmount, toAmountInput } from "@/lib/format";
import VoiceButton, { VoiceResult } from "@/components/VoiceButton";
import { MAX_INSTALLMENTS, addMonths, splitAmount } from "@/lib/installments";
import { compressImage } from "@/lib/compressImage";
import type { Suggestion } from "@/lib/expenses";

const normalize = (text: string) =>
  text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const SHORTCUTS = 5;

export interface ExpenseFormValues {
  title: string; // optional: empty means "use the category name"
  amount: string; // as typed, e.g. "1.500,50" — parse with parseAmount
  categoryId: string;
  date: string; // "YYYY-MM-DD"
  currency: string; // "ARS" | "USD"
}

export interface ExpenseSubmit {
  title: string;
  amount: number; // with installments: the total of the purchase
  categoryId: string;
  date: string;
  currency: string;
  installments?: number;
  /** Receipt photo attached in this form (already compressed). */
  photo?: Blob;
}

export interface PendingDraft {
  photo: Blob;
  amount: number | null;
  note: string | null;
}

interface ExpenseFormProps {
  heading: string;
  initialValues: ExpenseFormValues;
  submitLabel: string;
  /** Shows a second "Guardar y otro" button that calls onSubmit with another = true. */
  allowAnother?: boolean;
  autoFocusAmount?: boolean;
  /** Shows the "Cuotas" picker (new expenses only: an existing installment is edited on its own). */
  allowInstallments?: boolean;
  /** Shows an "Eliminar gasto" button at the end (edit screen). */
  onDelete?: () => void;
  /** Shows "🎤 Decí el gasto": speech -> Claude -> fields (new expenses). */
  allowVoice?: boolean;
  /** With allowPhoto: read the attached photo with AI and fill the empty fields. */
  readReceipts?: boolean;
  /** Installments preselected (completing a pending the AI read as "en 6 cuotas"). */
  initialInstallments?: number;
  /** Shows the "Frecuentes" shortcuts (most used titles) above the categories. */
  showShortcuts?: boolean;
  /** Shows "📷 Foto del ticket" to attach a receipt photo while creating the expense. */
  allowPhoto?: boolean;
  /** With a photo attached, offers saving it as pending ("completar después"). */
  onSaveAsPending?: (draft: PendingDraft) => Promise<string | void>;
  /** Receipt photo shown above the amount (completing a pending expense, or editing one). */
  photoUrl?: string | null;
  /**
   * "Supera límite" state of the design system: alert ring on the amount and this message.
   * There is no limit rule in the app yet; whoever adds one decides when to pass it.
   */
  overLimitMessage?: string;
  /** Returns an error message to show, or nothing on success. */
  onSubmit: (expense: ExpenseSubmit, another: boolean) => Promise<string | void>;
}

// Quick-entry form, mobile first: amount on top, categories as tap targets,
// date shortcuts and the actions pinned to the bottom of the screen.
export default function ExpenseForm({
  heading,
  initialValues,
  submitLabel,
  allowAnother = false,
  autoFocusAmount = false,
  allowInstallments = false,
  allowPhoto = false,
  showShortcuts = false,
  allowVoice = false,
  readReceipts = false,
  initialInstallments = 1,
  onDelete,
  onSaveAsPending,
  photoUrl,
  overLimitMessage,
  onSubmit,
}: ExpenseFormProps) {
  const { categories } = useCategories();
  const [form, setForm] = useState(initialValues);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [installments, setInstallments] = useState(initialInstallments);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [titleFocused, setTitleFocused] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const [voiceFeedback, setVoiceFeedback] = useState<{ text: string; complete: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/suggestions").then(async (res) => res.ok && setSuggestions(await res.json()));
  }, []);

  // Typing in "Detalle": up to 4 known titles containing the text (accents/case ignored).
  // "cafe" still offers "Café": picking it fixes the spelling and sets the category.
  const query = normalize(form.title);
  const matches =
    titleFocused && query
      ? suggestions.filter((s) => normalize(s.title).includes(query) && s.title !== form.title.trim()).slice(0, 4)
      : [];
  const shortcuts = suggestions.filter((s) => s.count >= 2).slice(0, SHORTCUTS);

  // Picking a known title also picks the category it was used with last time
  const applySuggestion = (suggestion: Suggestion) => {
    const knownCategory = categories.some((c) => c.id === suggestion.categoryId);
    setForm({ ...form, title: suggestion.title, categoryId: knownCategory ? suggestion.categoryId : form.categoryId });
    setError("");
  };
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const onPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setProcessingPhoto(true);
    let compressed: Blob;
    try {
      compressed = await compressImage(file);
      setPhoto(compressed);
      setError("");
    } catch {
      setError("No se pudo leer la imagen.");
      return;
    } finally {
      setProcessingPhoto(false);
    }
    if (!readReceipts) return;

    // Read the ticket while the person keeps using the form
    setReadingPhoto(true);
    setVoiceFeedback(null);
    try {
      const body = new FormData();
      body.append("photo", compressed, "photo.jpg");
      body.append("today", today);
      const res = await fetch("/api/receipts/read", { method: "POST", body });
      if (!res.ok) throw new Error(String(res.status));
      applyAi(await res.json(), "receipt");
    } catch {
      setVoiceFeedback({ text: "No pude leer el ticket. Completalo a mano.", complete: false });
    } finally {
      setReadingPhoto(false);
    }
  };

  // Fills the form with what the AI understood; nothing is saved until "Guardar".
  // Voice overwrites (the person just said it); a receipt only fills empty fields, so
  // whatever was typed while the photo was being read wins. Functional update: the
  // receipt answer arrives later and must not work on a stale copy of the form.
  const applyAi = (result: VoiceResult, source: "voice" | "receipt") => {
    const onlyEmpty = source === "receipt";
    setForm((prev) => {
      const amountEmpty = !prev.amount.trim();
      return {
        ...prev,
        amount: result.amount && (!onlyEmpty || amountEmpty) ? toAmountInput(result.amount) : prev.amount,
        currency: !onlyEmpty || amountEmpty ? result.currency : prev.currency,
        // The default date is today: a date read from the ticket replaces it
        date: !onlyEmpty || prev.date === today ? result.date : prev.date,
        title: result.title && (!onlyEmpty || !prev.title.trim()) ? result.title : prev.title,
        categoryId: result.categoryId && (!onlyEmpty || !prev.categoryId) ? result.categoryId : prev.categoryId,
      };
    });
    if (result.installments && allowInstallments && (!onlyEmpty || installments === 1)) setInstallments(result.installments);
    setError("");

    const category = categories.find((c) => c.id === result.categoryId);
    const understood = [
      result.amount && formatAmount(result.amount, result.currency),
      result.title,
      category?.name,
      result.date === today ? "hoy" : result.date === yesterday ? "ayer" : formatDate(result.date),
      result.installments && `${result.installments} cuotas`,
    ].filter(Boolean);
    const missing = [!result.amount && "el monto", !category && "la categoría"].filter(Boolean);
    const nothing = !result.amount && !result.title && !category;
    setVoiceFeedback({
      text: nothing
        ? source === "receipt"
          ? "No encontré datos de un gasto en la foto. Completalo a mano."
          : "No entendí el gasto. Probá de nuevo."
        : `${source === "receipt" ? "Del ticket" : "Entendí"}: ${understood.join(" · ")}.` +
          (missing.length ? ` Completá ${missing.join(" y ")}.` : ""),
      complete: missing.length === 0,
    });
  };

  const saveAsPending = async () => {
    if (!photo || !onSaveAsPending) return;
    const amount = parseAmount(form.amount);
    setSaving(true);
    const saveError = await onSaveAsPending({
      photo,
      amount: amount > 0 ? amount : null,
      note: form.title.trim() || null,
    });
    setSaving(false);
    setError(saveError ?? "");
  };

  const today = daysAgoISO(0);
  const yesterday = daysAgoISO(1);
  // Most used categories first, so the usual ones are always within reach
  const sortedCategories = [...categories].sort(
    (a, b) => (b.expenseCount ?? 0) - (a.expenseCount ?? 0) || a.name.localeCompare(b.name)
  );

  const set = (field: keyof ExpenseFormValues, value: string) => {
    setForm({ ...form, [field]: value });
    setError("");
  };

  const submit = async (another: boolean) => {
    const amount = parseAmount(form.amount);
    if (!(amount > 0)) {
      setError("Ingresá un monto válido.");
      return;
    }
    const category = categories.find((c) => c.id === form.categoryId);
    if (!category) {
      setError("Elegí una categoría.");
      return;
    }
    if (!form.date) {
      setError("Elegí una fecha.");
      return;
    }
    if (!Number.isInteger(installments) || installments < 1 || installments > MAX_INSTALLMENTS) {
      setError(`Las cuotas tienen que ser entre 2 y ${MAX_INSTALLMENTS}.`);
      return;
    }

    setSaving(true);
    const submitError = await onSubmit(
      {
        title: form.title.trim() || category.name,
        amount,
        categoryId: category.id,
        date: form.date,
        currency: form.currency,
        ...(installments > 1 ? { installments } : {}),
        ...(photo ? { photo } : {}),
      },
      another
    );
    setSaving(false);
    setError(submitError ?? "");
  };

  const parsedAmount = parseAmount(form.amount);
  const installmentPreview =
    installments > 1 && parsedAmount > 0 && form.date
      ? `${installments} cuotas de ${formatAmount(splitAmount(parsedAmount, installments)[0], form.currency)} · la última en ${monthLabel(
          monthKey(addMonths(form.date, installments - 1))
        )}`
      : null;

  // Design system chip: raised; selected = pressed + accent text (the state is in aria-pressed)
  const chip = (selected: boolean) => `chip ${selected ? "chip-on" : "active:shadow-pressed"}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="max-w-xl mx-auto px-4 pt-4 pb-24 md:pb-8"
    >
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-title">{heading}</h1>
        <Link href="/expenses" aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-ink-muted">
          ✕
        </Link>
      </div>

      {error && (
        <p role="alert" className="mb-4 flex items-start gap-2 text-alert-text">
          <span aria-hidden>⚠</span>
          {error}
        </p>
      )}

      {photoUrl && (
        <div className="mb-6 flex justify-center">
          <PhotoViewer src={photoUrl} alt="Foto del gasto" className="max-h-64 rounded-card object-contain" />
        </div>
      )}

      {allowPhoto && !photoUrl && (
        <div className="mb-6">
          {photoPreview ? (
            <div className="flex items-center gap-4">
              <PhotoViewer src={photoPreview} alt="Foto del ticket" className="h-24 w-24 rounded-card object-cover" />
              <div className="flex flex-col items-start gap-2 text-sm">
                {readingPhoto && <span className="text-accent-text">Leyendo el ticket…</span>}
                {onSaveAsPending && (
                  <button
                    type="button"
                    onClick={saveAsPending}
                    disabled={saving}
                    className="btn btn-text !px-0 !min-h-11 disabled:opacity-50"
                  >
                    ¿Sin tiempo? Guardar como pendiente →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null);
                    setVoiceFeedback(null);
                  }}
                  className="btn btn-text !px-0 !min-h-11 !text-ink-muted"
                >
                  Quitar foto
                </button>
              </div>
            </div>
          ) : (
            // No `capture` attribute: phones offer camera *or* gallery (screenshots too)
            <label
              className={`btn btn-secondary w-full ${
                processingPhoto ? "opacity-50 pointer-events-none" : "cursor-pointer"
              }`}
            >
              <input type="file" accept="image/*" className="sr-only" onChange={onPhotoFile} />
              {processingPhoto ? "Procesando..." : "📷 Foto del ticket"}
            </label>
          )}
        </div>
      )}

      {allowVoice && (
        <div className="mb-6">
          <VoiceButton
            today={today}
            onResult={(result) => applyAi(result, "voice")}
            onError={(text) => setVoiceFeedback({ text, complete: false })}
          />
        </div>
      )}

      {/* What the AI understood, from the voice or from the ticket photo */}
      {voiceFeedback && (
        <p className={`-mt-4 mb-6 text-sm ${voiceFeedback.complete ? "text-accent-text" : "text-alert-text"}`}>
          {voiceFeedback.text}
        </p>
      )}

      {/* Amount panel: sunken well; alert ring + message when over a limit (overLimitMessage) */}
      <div className="amount-panel" data-alert={overLimitMessage ? "true" : undefined}>
        <label className="block text-center">
          <span className="sr-only">Monto</span>
          <span className="flex items-baseline justify-center gap-1">
            <span className={`text-3xl font-bold ${overLimitMessage ? "text-alert-text" : "text-ink-muted"}`}>
              {form.currency === "USD" ? "US$" : "$"}
            </span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              autoFocus={autoFocusAmount}
              ref={amountRef}
              aria-invalid={overLimitMessage ? true : undefined}
              aria-describedby={overLimitMessage ? "amount-alert" : undefined}
              // Grows with the typed amount so the "$" stays next to the number, and shrinks
              // the 72px display size for long amounts so they still fit a 390px screen
              style={{
                width: `${Math.max(form.amount.length, 1) + 0.5}ch`,
                fontSize: form.amount.length > 9 ? 44 : form.amount.length > 6 ? 56 : undefined,
              }}
              className="text-display max-w-full bg-transparent text-ink outline-none"
            />
          </span>
        </label>

        <div className="mt-4 flex justify-center gap-2" role="group" aria-label="Moneda">
          {["ARS", "USD"].map((currency) => (
            <button
              key={currency}
              type="button"
              onClick={() => set("currency", currency)}
              aria-pressed={form.currency === currency}
              className={chip(form.currency === currency)}
            >
              {currency}
            </button>
          ))}
        </div>
      </div>
      {overLimitMessage && (
        <p id="amount-alert" role="alert" className="mt-3 flex items-center justify-center gap-2 text-alert-text">
          <span aria-hidden>⚠</span>
          {overLimitMessage}
        </p>
      )}

      {showShortcuts && shortcuts.length > 0 && (
        <fieldset className="mt-8">
          <legend className="text-label mb-3">Frecuentes</legend>
          <div className="flex flex-wrap gap-2">
            {shortcuts.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => {
                  applySuggestion(s);
                  amountRef.current?.focus();
                }}
                className={chip(normalize(form.title) === normalize(s.title))}
              >
                {s.title}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="mt-8">
        <legend className="text-label mb-3">Categoría</legend>
        <div className="flex flex-wrap gap-2">
          {sortedCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => set("categoryId", c.id)}
              aria-pressed={form.categoryId === c.id}
              className={chip(form.categoryId === c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block mt-6">
        <span className="text-label">Detalle (opcional)</span>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          onFocus={() => setTitleFocused(true)}
          // Delay so a tap on a suggestion lands before the list disappears
          onBlur={() => setTimeout(() => setTitleFocused(false), 150)}
          autoComplete="off"
          placeholder="Ej: súper, nafta, farmacia"
          className="field mt-2 block w-full"
        />
      </label>
      {matches.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Sugerencias">
          {matches.map((s) => (
            <button
              key={s.title}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // keep the input focused
              onClick={() => applySuggestion(s)}
              className={chip(false)}
            >
              {s.title}
              <span className="ml-1 text-ink-muted">· {categories.find((c) => c.id === s.categoryId)?.name}</span>
            </button>
          ))}
        </div>
      )}

      <fieldset className="mt-6">
        <legend className="text-label mb-3">Fecha</legend>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => set("date", today)} className={chip(form.date === today)}>
            Hoy
          </button>
          <button type="button" onClick={() => set("date", yesterday)} className={chip(form.date === yesterday)}>
            Ayer
          </button>
          <input
            type="date"
            aria-label="Otra fecha"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className={`field !rounded-pill !py-0 ${
              form.date !== today && form.date !== yesterday ? "text-accent-text font-semibold" : ""
            }`}
          />
        </div>
      </fieldset>

      {allowInstallments && (
        <fieldset className="mt-6">
          <legend className="text-label mb-3">Cuotas</legend>
          <div className="flex flex-wrap items-center gap-2">
            {[1, 3, 6, 12].map((n) => (
              <button key={n} type="button" onClick={() => setInstallments(n)} className={chip(installments === n)}>
                {n === 1 ? "Sin cuotas" : n}
              </button>
            ))}
            <input
              type="number"
              inputMode="numeric"
              min={2}
              max={MAX_INSTALLMENTS}
              aria-label="Otra cantidad de cuotas"
              placeholder="Otra"
              value={[1, 3, 6, 12].includes(installments) ? "" : installments}
              onChange={(e) => {
                setInstallments(e.target.value ? Number(e.target.value) : 1);
                setError("");
              }}
              className={`field w-24 !rounded-pill !py-0 ${
                ![1, 3, 6, 12].includes(installments) ? "text-accent-text font-semibold" : ""
              }`}
            />
          </div>
          {installments > 1 && (
            <p className="mt-2 text-sm text-ink-muted">
              {installmentPreview ?? "Ingresá el monto total de la compra (con interés incluido)."}
            </p>
          )}
        </fieldset>
      )}

      {onDelete && (
        <button type="button" onClick={onDelete} disabled={saving} className="btn btn-destructive mt-10 w-full">
          Eliminar gasto
        </button>
      )}

      {/* Pinned right above the floating tab bar (72px + 16px gap + the iPhone safe area); the
          background runs to the bottom edge so the form doesn't show around the floating bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 flex gap-3 bg-bg px-4 pt-3 pb-[calc(100px+env(safe-area-inset-bottom))] md:static md:mt-8 md:p-0 md:bg-transparent">
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving}
          className="btn btn-primary flex-1"
        >
          {saving && <span className="spinner" aria-hidden />}
          {saving ? "Guardando..." : submitLabel}
        </button>
        {allowAnother && (
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(true)}
            className="btn btn-secondary flex-1"
          >
            Guardar y otro
          </button>
        )}
      </div>
    </form>
  );
}
