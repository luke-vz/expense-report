import type { MetadataRoute } from "next";

// PWA manifest: the installed app opens straight into quick entry (amount + "+")
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expense Report",
    short_name: "Gastos",
    description: "Trackeá tus gastos del hogar",
    start_url: "/quick",
    // Without an explicit scope the browser derives it from start_url ("/expenses/"), and
    // every page outside it (home, dashboard, pending…) opened with browser UI
    scope: "/",
    display: "standalone",
    // Design system --bg (light); the page itself follows the phone's light/dark setting
    background_color: "#e6e9ee",
    theme_color: "#e6e9ee",
    lang: "es-AR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nuevo gasto", url: "/expenses/new" },
      { name: "Gastos", url: "/expenses" },
      { name: "Dashboard", url: "/dashboard" },
    ],
  };
}
