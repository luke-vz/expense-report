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
    <div className="mt-2 flex items-center gap-2">
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
        className="shrink-0 rounded-md bg-[#3987e5] px-4 py-2 text-sm font-semibold text-white"
      >
        {copied ? "Copiada ✓" : "Copiar"}
      </button>
    </div>
  );
}

// One action of the Atajos shortcut, with the exact names of the iPhone buttons
function Action({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3987e5] text-sm font-bold text-white">
        {n}
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{title}</p>
        <div className="mt-1 space-y-1 text-gray-300">{children}</div>
      </div>
    </li>
  );
}

export default function ShortcutsPage() {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [shortcutUrl, setShortcutUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState("1500 en el supermercado");
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/tokens");
    setTokens(res.ok ? await res.json() : []);
  }, []);

  useEffect(() => {
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
    const { token } = await res.json();
    // The key travels in the URL: one thing to paste in Atajos, no headers to set up
    setShortcutUrl(`${window.location.origin}/api/shortcuts/voice?key=${token}`);
    setTestResult(null);
    load();
  };

  // Calls the endpoint exactly like the shortcut would, but without saving (dryRun)
  const test = async () => {
    if (!shortcutUrl) return;
    setTestResult(null);
    try {
      const res = await fetch(`${shortcutUrl}&dryRun=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sample }),
      });
      setTestResult({ ok: res.ok, text: await res.text() });
    } catch {
      setTestResult({ ok: false, text: "No se pudo conectar." });
    }
  };

  const revoke = async (token: Token) => {
    if (!confirm("¿Revocar esta clave? El atajo que la use deja de funcionar.")) return;
    const res = await fetch(`/api/tokens/${token.id}`, { method: "DELETE" });
    if (!res.ok) alert("No se pudo revocar.");
    load();
  };

  const card = "rounded-md bg-secundario border-card p-4 space-y-3";

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Siri y widget de iPhone</h1>
        <p className="mt-1 text-sm text-gray-400">
          Un atajo de la app <strong>Atajos</strong> para cargar gastos hablando, sin abrir la app: &quot;Oye Siri,
          anotar gasto&quot;, un widget o el botón de acción. Se arma una sola vez, en unos 3 minutos.
        </p>
      </div>

      {/* Paso A: la URL con la clave */}
      <section className={card}>
        <h2 className="font-semibold">A. Generá tu URL personal</h2>
        {shortcutUrl ? (
          <>
            <p className="text-sm text-amber-400">
              Copiala y guardala hasta terminar el atajo: no se vuelve a mostrar. Si la perdés, generá otra.
            </p>
            <Copyable value={shortcutUrl} label="URL del atajo" />
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400">Incluye una clave que es solo tuya. Si perdés el teléfono, revocala abajo.</p>
            <button
              onClick={create}
              disabled={busy}
              className="w-full rounded-md bg-[#3987e5] py-3 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Generando..." : "Generar URL"}
            </button>
          </>
        )}
      </section>

      {/* Paso B: probar que la URL anda, antes de tocar el iPhone */}
      {shortcutUrl && (
        <section className={card}>
          <h2 className="font-semibold">B. Probala desde acá</h2>
          <p className="text-sm text-gray-400">Hace lo mismo que el atajo, pero no guarda nada.</p>
          <div className="flex gap-2">
            <input
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              aria-label="Frase de prueba"
              className="bg-input min-w-0 flex-1 rounded-md p-2 text-sm"
            />
            <button onClick={test} className="bg-boton shrink-0 rounded-md px-4 text-sm">
              Probar
            </button>
          </div>
          {testResult && (
            <p className={`text-sm ${testResult.ok ? "text-green-400" : "text-red-400"}`}>{testResult.text}</p>
          )}
        </section>
      )}

      {/* Paso C: armar el atajo */}
      <section className={card}>
        <h2 className="font-semibold">C. Armá el atajo en el iPhone</h2>
        <p className="text-sm text-gray-400">
          Abrí la app <strong>Atajos</strong>, tocá <strong>+</strong> (arriba a la derecha) y agregá estas 3 acciones
          con el buscador de abajo (&quot;Buscar apps y acciones&quot;):
        </p>
        <ol className="space-y-4">
          <Action n={1} title="Dictar texto">
            <p>Buscá &quot;Dictar texto&quot; y tocala. No hace falta cambiar nada.</p>
          </Action>
          <Action n={2} title="Obtener contenido de URL">
            <p>Buscala y tocala. Después:</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                Tocá el texto azul <strong>URL</strong> y pegá la URL del paso A.
              </li>
              <li>
                Tocá la flecha <strong>›</strong> de la acción para ver las opciones.
              </li>
              <li>
                <strong>Método</strong>: elegí <strong>POST</strong>.
              </li>
              <li>
                <strong>Cuerpo de la solicitud</strong>: elegí <strong>JSON</strong>. Tocá <strong>Añadir nuevo campo</strong>{" "}
                → <strong>Texto</strong>. En <strong>Clave</strong> escribí <code>text</code>; en <strong>Texto</strong>{" "}
                tocá y elegí la variable <strong>Texto dictado</strong>.
              </li>
            </ul>
          </Action>
          <Action n={3} title="Mostrar notificación">
            <p>
              Buscala y tocala. Si no dice <strong>Contenido de la URL</strong>, tocá el texto y elegí esa variable. Es
              lo que te confirma qué se guardó.
            </p>
          </Action>
        </ol>
        <p className="text-sm text-gray-300">
          Por último, tocá el nombre arriba de todo, ponele <strong>Anotar gasto</strong> y tocá <strong>OK</strong>.
          Probalo con el botón ▶ de abajo.
        </p>
        <p className="text-xs text-gray-500">
          Si algo no coincide con lo que ves, los nombres pueden variar un poco según la versión de iOS.
        </p>
      </section>

      <section className={card}>
        <h2 className="font-semibold">D. Usalo</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            <strong>&quot;Oye Siri, anotar gasto&quot;</strong> y después decí el gasto: &quot;1500 en el
            supermercado&quot;.
          </li>
          <li>
            <strong>Widget:</strong> mantené apretada la pantalla de inicio → <strong>Editar</strong> →{" "}
            <strong>Añadir widget</strong> → Atajos → elegí &quot;Anotar gasto&quot;.
          </li>
          <li>
            <strong>Botón de acción</strong> (si tu iPhone lo tiene): Ajustes → Botón de acción → Atajo.
          </li>
        </ul>
        <p className="text-sm text-gray-400">
          Si falta el monto o la categoría, o parece repetido, queda en Pendientes para completarlo en la app.
        </p>
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
          {tokens !== null && tokens.length === 0 && (
            <li className="p-3 text-sm text-gray-500">Todavía no generaste ninguna.</li>
          )}
        </ul>
        <p className="mt-2 text-xs text-gray-500">
          &quot;Último uso&quot; te sirve para saber si el atajo está llegando: si nunca cambia, el atajo no se está
          conectando.
        </p>
      </section>
    </div>
  );
}
