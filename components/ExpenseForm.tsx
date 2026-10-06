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
  /** Shows the "Frecuentes" shortcuts (most used titles) above the categories. */
  showShortcuts?: boolean;
  /** Shows "📷 Foto del ticket" to attach a receipt photo while creating the expense. */
  allowPhoto?: boolean;
  /** With a photo attached, offers saving it as pending ("completar después"). */
  onSaveAsPending?: (draft: PendingDraft) => Promise<string | void>;
  /** Receipt photo shown above the amount (completing a pending expense, or editing one). */
  photoUrl?: string | null;
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
  onDelete,
  onSaveAsPending,
  photoUrl,
  onSubmit,
}: ExpenseFormProps) {
  const { categories } = useCategories();
  const [form, setForm] = useState(initialValues);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [installments, setInstallments] = useState(1);
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
    try {
      setPhoto(await compressImage(file));
      setError("");
    } catch {
      setError("No se pudo leer la imagen.");
    } finally {
      setProcessingPhoto(false);
    }
  };

  // Fills only what was understood; nothing is saved until "Guardar"
  const applyVoice = (result: VoiceResult) => {
    setForm({
      ...form,
      amount: result.amount ? toAmountInput(result.amount) : form.amount,
      currency: result.currency,
      date: result.date,
      title: result.title ?? form.title,
      categoryId: result.categoryId ?? form.categoryId,
    });
    if (result.installments && allowInstallments) setInstallments(result.installments);
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
    setVoiceFeedback({
      text: `Entendí: ${understood.join(" · ")}.` + (missing.length ? ` Completá ${missing.join(" y ")}.` : ""),
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

  const chip = (selected: boolean) =>
    `px-4 py-2 rounded-full border text-sm transition-colors ${
      selected ? "bg-[#3987e5] border-[#3987e5] text-white" : "border-[#616161] text-gray-300 active:bg-neutral-800"
    }`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="max-w-xl mx-auto px-4 pt-4 pb-32 md:pb-8"
    >
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{heading}</h1>
        <Link href="/expenses" aria-label="Cerrar" className="text-2xl leading-none px-2 text-gray-400">
          ✕
        </Link>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {photoUrl && (
        <div className="mb-6 flex justify-center">
          <PhotoViewer src={photoUrl} alt="Foto del gasto" className="max-h-64 rounded-md object-contain" />
        </div>
      )}

      {allowPhoto && !photoUrl && (
        <div className="mb-6">
          {photoPreview ? (
            <div className="flex items-center gap-4">
              <PhotoViewer src={photoPreview} alt="Foto del ticket" className="h-24 w-24 rounded-md object-cover" />
              <div className="flex flex-col items-start gap-2 text-sm">
                {onSaveAsPending && (
                  <button
                    type="button"
                    onClick={saveAsPending}
                    disabled={saving}
                    className="text-[#3987e5] font-semibold disabled:opacity-50"
                  >
                    ¿Sin tiempo? Guardar como pendiente →
                  </button>
                )}
                <button type="button" onClick={() => setPhoto(null)} className="text-gray-400">
                  Quitar foto
                </button>
              </div>
            </div>
          ) : (
            // No `capture` attribute: phones offer camera *or* gallery (screenshots too)
            <label
              className={`flex items-center justify-center gap-2 rounded-md border border-dashed border-[#616161] py-3 text-gray-300 ${
                processingPhoto ? "opacity-50 pointer-events-none" : "cursor-pointer active:bg-neutral-800"
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
            onResult={applyVoice}
            onError={(text) => setVoiceFeedback({ text, complete: false })}
          />
          {voiceFeedback && (
            <p className={`mt-2 text-sm ${voiceFeedback.complete ? "text-green-400" : "text-amber-400"}`}>
              {voiceFeedback.text}
            </p>
          )}
        </div>
      )}

      <label className="block text-center">
        <span className="sr-only">Monto</span>
        <span className="flex items-baseline justify-center gap-1">
          <span className="text-3xl text-gray-500">{form.currency === "USD" ? "US$" : "$"}</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            autoFocus={autoFocusAmount}
            ref={amountRef}
            // Grows with the typed amount so the "$" stays next to the number
            style={{ width: `${Math.max(form.amount.length, 1) + 0.5}ch` }}
            className="max-w-full bg-transparent text-5xl font-bold outline-none placeholder:text-gray-600"
          />
        </span>
      </label>

      <div className="mt-3 flex justify-center gap-2" role="group" aria-label="Moneda">
        {["ARS", "USD"].map((currency) => (
          <button
            key={currency}
            type="button"
            onClick={() => set("currency", currency)}
            aria-pressed={form.currency === currency}
            className={`${chip(form.currency === currency)} !py-1`}
          >
            {currency}
          </button>
        ))}
      </div>

      {showShortcuts && shortcuts.length > 0 && (
        <fieldset className="mt-8">
          <legend className="text-sm text-gray-400 mb-2">Frecuentes</legend>
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
        <legend className="text-sm text-gray-400 mb-2">Categoría</legend>
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
        <span className="text-sm text-gray-400">Detalle (opcional)</span>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          onFocus={() => setTitleFocused(true)}
          // Delay so a tap on a suggestion lands before the list disappears
          onBlur={() => setTimeout(() => setTitleFocused(false), 150)}
          autoComplete="off"
          placeholder="Ej: súper, nafta, farmacia"
          className="bg-input mt-1 block w-full rounded-md p-3"
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
              <span className="ml-1 text-gray-500">· {categories.find((c) => c.id === s.categoryId)?.name}</span>
            </button>
          ))}
        </div>
      )}

      <fieldset className="mt-6">
        <legend className="text-sm text-gray-400 mb-2">Fecha</legend>
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
            className={`bg-input rounded-full px-4 py-2 text-sm ${
              form.date !== today && form.date !== yesterday ? "ring-2 ring-[#3987e5]" : ""
            }`}
          />
        </div>
      </fieldset>

      {allowInstallments && (
        <fieldset className="mt-6">
          <legend className="text-sm text-gray-400 mb-2">Cuotas</legend>
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
              className={`bg-input w-20 rounded-full px-4 py-2 text-sm ${
                ![1, 3, 6, 12].includes(installments) ? "ring-2 ring-[#3987e5]" : ""
              }`}
            />
          </div>
          {installments > 1 && (
            <p className="mt-2 text-sm text-gray-400">
              {installmentPreview ?? "Ingresá el monto total de la compra (con interés incluido)."}
            </p>
          )}
        </fieldset>
      )}

      {onDelete && (
        <button type="button" onClick={onDelete} disabled={saving} className="mt-10 w-full py-3 text-red-400">
          Eliminar gasto
        </button>
      )}

      <div className="fixed bottom-0 inset-x-0 z-40 flex gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-[#121212] border-t border-[#2b2b2b] md:static md:mt-8 md:p-0 md:border-0 md:bg-transparent">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-[#3987e5] text-white font-semibold py-3 rounded-md disabled:opacity-50"
        >
          {saving ? "Guardando..." : submitLabel}
        </button>
        {allowAnother && (
          <button
            type="button"
            disabled={saving}
            onClick={() => submit(true)}
            className="flex-1 bg-boton py-3 rounded-md disabled:opacity-50"
          >
            Guardar y otro
          </button>
        )}
      </div>
    </form>
  );
}
