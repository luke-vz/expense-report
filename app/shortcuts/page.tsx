// app/shortcuts/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

interface Token {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "nunca";

function Copyable({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-2">
      <code className="bg-input min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm" aria-label={label}>
        {value}
      </code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="bg-boton shrink-0 rounded-md px-3 py-2 text-sm"
      >
        {copied ? "Copiado ✓" : "Copiar"}
      </button>
    </div>
  );
}

export default function ShortcutsPage() {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/tokens");
    setTokens(res.ok ? await res.json() : []);
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    const res = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "iPhone" }),
    });
    setBusy(false);
    if (!res.ok) {
      alert("No se pudo generar la clave.");
      return;
    }
    setNewToken((await res.json()).token);
    load();
  };

  const revoke = async (token: Token) => {
    if (!confirm("¿Revocar esta clave? El atajo que la use deja de funcionar.")) return;
    const res = await fetch(`/api/tokens/${token.id}`, { method: "DELETE" });
    if (!res.ok) alert("No se pudo revocar.");
    load();
  };

  const url = `${origin}/api/shortcuts/voice`;
  const step = "rounded-md bg-secundario border-card p-4 space-y-2";

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Siri y widget de iPhone</h1>
        <p className="mt-1 text-sm text-gray-400">
          Con un atajo de la app <strong>Atajos</strong> cargás un gasto hablando, sin abrir la app: &quot;Oye Siri,
          anotar gasto&quot;, desde un widget o con el botón de acción. Si falta el monto o la categoría, o parece
          repetido, queda en Pendientes para completarlo acá.
        </p>
      </div>

      <section className={step}>
        <h2 className="font-semibold">1. Tu clave personal</h2>
        {newToken ? (
          <>
            <p className="text-sm text-amber-400">Copiala ahora: no se vuelve a mostrar.</p>
            <Copyable value={`Bearer ${newToken}`} label="Clave para el encabezado Authorization" />
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400">El atajo la usa para identificarte. Es solo tuya; si perdés el teléfono, revocala abajo.</p>
            <button
              onClick={create}
              disabled={busy}
              className="w-full rounded-md bg-[#3987e5] py-3 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Generando..." : "Generar clave"}
            </button>
          </>
        )}
      </section>

      <section className={step}>
        <h2 className="font-semibold">2. Armá el atajo en el iPhone</h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          <li>
            Abrí la app <strong>Atajos</strong>, tocá <strong>+</strong> y llamalo <strong>Anotar gasto</strong>.
          </li>
          <li>
            Agregá la acción <strong>Dictar texto</strong>. Idioma: Español (Argentina); dejar de escuchar: después de
            una pausa.
          </li>
          <li>
            Agregá <strong>Obtener contenido de URL</strong> con esta URL:
            <Copyable value={url} label="URL del atajo" />
            Tocá la flecha de la acción y configurá:
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                Método: <strong>POST</strong>
              </li>
              <li>
                Encabezados: agregá uno con clave <code>Authorization</code> y como valor la clave del paso 1 (empieza
                con <code>Bearer</code>).
              </li>
              <li>
                Cuerpo de la solicitud: <strong>JSON</strong>, con un campo de texto de clave <code>text</code> y como
                valor la variable <strong>Texto dictado</strong>.
              </li>
            </ul>
          </li>
          <li>
            Agregá <strong>Mostrar notificación</strong> con la variable <strong>Contenido de la URL</strong>.
          </li>
        </ol>
        <p className="text-xs text-gray-500">Los nombres de las acciones pueden variar un poco según la versión de iOS.</p>
      </section>

      <section className={step}>
        <h2 className="font-semibold">3. Usalo</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            Decí <strong>&quot;Oye Siri, anotar gasto&quot;</strong> y después el gasto: &quot;1500 en el supermercado&quot;.
          </li>
          <li>
            <strong>Widget:</strong> mantené apretada la pantalla de inicio, tocá <strong>+</strong>, elegí Atajos y
            el atajo &quot;Anotar gasto&quot;.
          </li>
          <li>
            <strong>Botón de acción</strong> (si tu iPhone lo tiene): Ajustes → Botón de acción → Atajo.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Tus claves</h2>
        <ul className="bg-secundario border-card rounded-md divide-y divide-[#3c3c3c]">
          {(tokens ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>
                {t.label}
                <span className="block text-xs text-gray-500">
                  Creada {when(t.createdAt)} · último uso {when(t.lastUsedAt)}
                </span>
              </span>
              <button onClick={() => revoke(t)} className="text-red-400">
                Revocar
              </button>
            </li>
          ))}
          {tokens !== null && tokens.length === 0 && <li className="p-3 text-sm text-gray-500">Todavía no generaste ninguna.</li>}
        </ul>
      </section>
    </div>
  );
}
