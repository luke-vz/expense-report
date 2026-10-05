// components/CaptureButton.tsx
"use client";

import { useEffect, useState } from "react";
import { compressImage } from "@/lib/compressImage";
import { parseAmount } from "@/lib/format";
import { notifyPendingChanged } from "@/lib/usePendingCount";

interface CaptureButtonProps {
  className?: string;
  children: React.ReactNode;
  onSaved?: () => void;
}

// "Pre-gasto": pick or take a photo, optionally jot the amount, and save it as pending.
// The <input> has no `capture` attribute on purpose: phones then offer camera *or*
// gallery, so screenshots (Mercado Pago, home banking) work too.
export default function CaptureButton({ className, children, onSaved }: CaptureButtonProps) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const close = () => {
    setPhoto(null);
    setPreview(null);
    setAmount("");
    setNote("");
    setError("");
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setBusy(true);
    try {
      setPhoto(await compressImage(file));
    } catch {
      alert("No se pudo leer la imagen.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!photo) return;
    const form = new FormData();
    form.append("photo", photo, "photo.jpg");
    if (amount) {
      const value = parseAmount(amount);
      if (!(value > 0)) {
        setError("El monto no es válido (o dejalo vacío).");
        return;
      }
      form.append("amount", String(value));
    }
    if (note.trim()) form.append("note", note.trim());

    setBusy(true);
    const res = await fetch("/api/pending", { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      setError("No se pudo guardar. Probá de nuevo.");
      return;
    }
    close();
    notifyPendingChanged();
    onSaved?.();
  };

  return (
    <>
      <label className={`cursor-pointer ${busy && !photo ? "opacity-50 pointer-events-none" : ""} ${className ?? ""}`}>
        <input type="file" accept="image/*" className="sr-only" onChange={onFile} />
        {busy && !photo ? "Procesando..." : children}
      </label>

      {photo && preview && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/80" role="dialog" aria-label="Guardar como pendiente">
          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={preview} alt="Foto del gasto" className="max-h-full max-w-full rounded-md object-contain" />
          </div>
          <div className="bg-[#121212] border-t border-[#2b2b2b] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Monto (opcional)"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                className="bg-input w-1/2 rounded-md p-3"
              />
              <input
                type="text"
                placeholder="Nota (opcional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="bg-input w-1/2 rounded-md p-3"
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={close} disabled={busy} className="flex-1 bg-boton py-3 rounded-md">
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="flex-1 bg-[#3987e5] text-white font-semibold py-3 rounded-md disabled:opacity-50"
              >
                {busy ? "Guardando..." : "Guardar pendiente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
