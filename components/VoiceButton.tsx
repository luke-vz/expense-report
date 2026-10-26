// components/VoiceButton.tsx
"use client";

import { useEffect, useRef, useState } from "react";

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

export type VoiceState = "idle" | "listening" | "thinking";
type State = VoiceState;

interface VoiceButtonProps {
  today: string;
  onResult: (result: VoiceResult, transcript: string) => void;
  onError: (message: string) => void;
  /**
   * Icon-only button for a tab bar (64×52). It's hidden where the browser has no speech
   * recognition, and the words heard go to onProgress for the page to show.
   */
  compact?: boolean;
  onProgress?: (state: VoiceState, transcript: string) => void;
}

// One tap: listen, transcribe (browser), interpret (Claude via /api/voice), fill the form.
// Stops by itself when the person stops talking; tapping again stops early.
export default function VoiceButton({ today, onResult, onError, compact = false, onProgress }: VoiceButtonProps) {
  const [state, setState] = useState<State>("idle");
  const [transcript, setTranscript] = useState("");
  const recognition = useRef<Recognition | null>(null);
  // Known only in the browser: decided after mounting so the server HTML matches
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => setSupported(Boolean(getRecognition())), []);
  useEffect(() => onProgress?.(state, transcript), [onProgress, state, transcript]);

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

  if (compact) {
    if (!supported) return null;
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={state === "thinking"}
        aria-label={state === "listening" ? "Terminar de dictar" : "Decí el gasto"}
        aria-pressed={state !== "idle"}
        className={`tab-item ${state !== "idle" ? "tab-item-active" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "thinking"}
      aria-live="polite"
      // Secondary button of the design system; while listening it stays pressed in
      className={`btn btn-secondary w-full !text-accent-text ${state === "listening" ? "!shadow-pressed" : ""}`}
    >
      {state === "idle" && "🎤 Decí el gasto"}
      {state === "listening" && (
        <span className="truncate px-2">● {transcript || "Escuchando… (tocá para terminar)"}</span>
      )}
      {state === "thinking" && <span className="truncate px-2">Entendiendo “{transcript}”…</span>}
    </button>
  );
}
