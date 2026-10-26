// components/OfflineSync.tsx
"use client";

import { useEffect } from "react";
import { flushPendingQueue } from "@/lib/pendingQueue";

// Registers the service worker (production only: in dev it would cache Turbopack's chunks)
// and sends the pending expenses saved offline whenever the connection is back.
export default function OfflineSync() {
  useEffect(() => {
    flushPendingQueue();
    window.addEventListener("online", flushPendingQueue);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => navigator.serviceWorker.ready)
        .then((registration) => {
          // The first visit loads before the worker is in control: hand it the files and the page
          const urls = performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((url) => new URL(url).pathname.startsWith("/_next/static/"));
          registration.active?.postMessage({ type: "cache-assets", urls, page: location.pathname });
        })
        .catch((err) => console.error("service worker registration failed", err));
    }

    return () => window.removeEventListener("online", flushPendingQueue);
  }, []);

  return null;
}
