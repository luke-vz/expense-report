// components/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePendingCount } from "@/lib/usePendingCount";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const links = [
  { href: "/", label: "Inicio", icon: icon("M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10") },
  { href: "/expenses", label: "Gastos", icon: icon("M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01") },
  { href: "/dashboard", label: "Dashboard", icon: icon("M4 20V10M10 20V4M16 20v-7M22 20H2") },
  { href: "/pending", label: "Pendientes", icon: icon("M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7") },
];

// Mobile-only tab bar with the quick-add button in the middle, on every screen but login.
// The expense form pins its Guardar buttons right above it (see ExpenseForm).
export default function BottomNav() {
  const pathname = usePathname();
  const pendingCount = usePendingCount();
  if (pathname === "/login") return null;

  const item = (link: (typeof links)[number], badge = 0) => (
    <Link
      key={link.href}
      href={link.href}
      className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
        pathname === link.href ? "text-[#3987e5]" : "text-gray-400"
      }`}
    >
      {link.icon}
      {link.label}
      {badge > 0 && (
        <span className="absolute top-1 left-1/2 ml-2 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] leading-5 text-center">
          {badge}
        </span>
      )}
    </Link>
  );

  return (
    <>
      {/* Spacer so page content never ends up under the fixed bar */}
      <div className="h-24 md:hidden" aria-hidden />
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-end bg-[#040404] border-t border-[#2b2b2b] pb-[env(safe-area-inset-bottom)]">
        {item(links[0])}
        {item(links[1])}
        <Link
          href="/expenses/new"
          aria-label="Cargar gasto"
          className="flex flex-1 justify-center -mt-6"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#3987e5] text-white text-3xl shadow-lg">
            +
          </span>
        </Link>
        {item(links[2])}
        {item(links[3], pendingCount)}
      </nav>
    </>
  );
}
