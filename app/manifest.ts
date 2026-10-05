import type { MetadataRoute } from "next";

// PWA manifest: the installed app opens straight into quick entry
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expense Report",
    short_name: "Gastos",
    description: "Trackeá tus gastos del hogar",
    start_url: "/expenses/new",
    // Without an explicit scope the browser derives it from start_url ("/expenses/"), and
    // every page outside it (home, dashboard, pending…) opened with browser UI
    scope: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#040404",
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
