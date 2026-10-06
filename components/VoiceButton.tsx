// components/VoiceButton.tsx
"use client";

import { useRef, useState } from "react";

export interface VoiceResult {
  amount: number | null;
  currency: "ARS" | "USD";
  date: string;
  title: string | null;
  categoryId: string | null;
  installments: number | null;
}

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib in every version;
// Safari exposes it as webkitSpeechRecognition)
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionConstructor = new () => Recognition;

const getRecognition = (): RecognitionConstructor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const ERRORS: Record<string, string> = {
  "not-allowed": "No hay permiso para usar el micrófono. Habilitalo en los ajustes del teléfono.",
  "service-not-allowed": "Este teléfono no permite reconocimiento de voz desde la app.",
  "no-speech": "No escuché nada. Probá de nuevo.",
  network: "Sin conexión para reconocer la voz.",
};

type State = "idle" | "listening" | "thinking";

interface VoiceButtonProps {
  today: string;
  onResult: (result: VoiceResult, transcript: string) => void;
  onError: (message: string) => void;
}

// One tap: listen, transcribe (browser), interpret (Claude via /api/voice), fill the form.
// Stops by itself when the person stops talking; tapping again stops early.
export default function VoiceButton({ today, onResult, onError }: VoiceButtonProps) {
  const [state, setState] = useState<State>("idle");
  const [transcript, setTranscript] = useState("");
  const recognition = useRef<Recognition | null>(null);

  const interpret = async (text: string) => {
    setState("thinking");
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, today }),
      });
      if (!res.ok) throw new Error(String(res.status));
      onResult(await res.json(), text);
    } catch {
      onError("No pude interpretar el gasto. Probá de nuevo o cargalo a mano.");
    } finally {
      setState("idle");
    }
  };

  const start = () => {
    const Recognition = getRecognition();
    if (!Recognition) {
      onError("Este teléfono no permite reconocimiento de voz desde la app.");
      return;
    }
    let heard = "";
    const rec = new Recognition();
    rec.lang = "es-AR";
    rec.interimResults = true; // show the words while speaking
    rec.continuous = false; // ends on its own after a pause
    rec.onresult = (e) => {
      heard = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
      setTranscript(heard);
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted") onError(ERRORS[e.error] ?? "No pude escuchar. Probá de nuevo.");
    };
    rec.onend = () => {
      recognition.current = null;
      if (heard.trim()) interpret(heard.trim());
      else setState("idle");
    };
    recognition.current = rec;
    setTranscript("");
    setState("listening");
    try {
      rec.start();
    } catch {
      setState("idle");
      onError("No pude usar el micrófono. Probá de nuevo.");
    }
  };

  const onClick = () => {
    if (state === "listening") recognition.current?.stop();
    else if (state === "idle") start();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "thinking"}
      aria-live="polite"
      className={`flex w-full items-center justify-center gap-2 rounded-md py-3 font-semibold transition-colors ${
        state === "listening"
          ? "bg-red-500/20 border border-red-400 text-red-300"
          : "bg-[#3987e5]/15 border border-[#3987e5] text-[#9cc3f2]"
      } disabled:opacity-70`}
    >
      {state === "idle" && "🎤 Decí el gasto"}
      {state === "listening" && (
        <span className="truncate px-2">● {transcript || "Escuchando… (tocá para terminar)"}</span>
      )}
      {state === "thinking" && <span className="truncate px-2">Entendiendo “{transcript}”…</span>}
    </button>
  );
}
