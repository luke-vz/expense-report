// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Expense Report",
  description: "Trackeá tus gastos del hogar",
  // Installable on iOS ("Agregar a inicio"); Android uses app/manifest.ts
  appleWebApp: { capable: true, title: "Gastos", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#040404",
  viewportFit: "cover", // lets the fixed bars use env(safe-area-inset-*) on notched phones
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <Header />
        <main>{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
