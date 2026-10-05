// components/PhotoViewer.tsx
"use client";

import { useEffect, useState } from "react";

interface PhotoViewerProps {
  src: string;
  alt: string;
  className?: string;
}

// Thumbnail that opens the photo full screen inside the app. A plain link with
// target="_blank" would leave the installed app and open the browser.
export default function PhotoViewer({ src, alt, className }: PhotoViewerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Ver foto completa" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- auth-protected API image */}
        <img src={src} alt={alt} className={className} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={alt}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-2 pt-[calc(0.5rem+env(safe-area-inset-top))]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- auth-protected API image */}
          <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] h-10 w-10 rounded-full bg-black/60 text-2xl text-white"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
