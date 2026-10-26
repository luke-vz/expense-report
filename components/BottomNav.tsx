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
  { href: "/home", label: "Inicio", icon: icon("M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10") },
  { href: "/expenses", label: "Gastos", icon: icon("M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01") },
  { href: "/dashboard", label: "Dashboard", icon: icon("M4 20V10M10 20V4M16 20v-7M22 20H2") },
  { href: "/pending", label: "Pendientes", icon: icon("M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7") },
];

// Mobile-only floating tab bar (design system: 72px tall, pill radius, raised, 16px above
// the safe area), on every screen but login and quick entry (it has its own bar). Items are 64×52; the active one is pressed.
// The expense form pins its Guardar buttons right above it (see ExpenseForm).
export default function BottomNav() {
  const pathname = usePathname();
  const pendingCount = usePendingCount();
  if (pathname === "/login" || pathname === "/") return null;

  const item = (link: (typeof links)[number], badge = 0) => {
    const active = pathname === link.href;
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={`relative flex h-[52px] w-16 flex-col items-center justify-center gap-0.5 rounded-card text-[11px] font-semibold ${
          active ? "text-accent-text shadow-pressed" : "text-ink-muted"
        }`}
      >
        {link.icon}
        {link.label}
        {badge > 0 && (
          <span className="absolute top-0.5 right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] leading-5 text-center">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Spacer so page content never ends up under the floating bar (72 + 16 + breathing room) */}
      <div className="h-[calc(104px+env(safe-area-inset-bottom))] md:hidden" aria-hidden />
      <nav
        aria-label="Navegación principal"
        className="md:hidden fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 flex h-[72px] items-center justify-around rounded-pill bg-bg px-2 shadow-raised"
      >
        {item(links[0])}
        {item(links[1])}
        {/* Quick entry (amount + "+"); the full form stays on the home's "Cargar gasto" */}
        <Link
          href="/"
          aria-label="Cargar gasto"
          className="flex h-[52px] w-16 items-center justify-center"
        >
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-3xl text-accent-ink shadow-raised">
            +
          </span>
        </Link>
        {item(links[2])}
        {item(links[3], pendingCount)}
      </nav>
    </>
  );
}
