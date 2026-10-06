// components/Header.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const links = [
  { href: "/", label: "Home" },
  { href: "/expenses", label: "Gastos" },
  { href: "/expenses/new", label: "Nuevo Gasto" },
  { href: "/pending", label: "Pendientes" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/categories", label: "Categorías" },
];

// On mobile only the title shows; navigation lives in BottomNav.
export default function Header() {
  const pathname = usePathname();

  return (
    // Desktop only: on the phone, navigation is the BottomNav and "Salir" lives at the
    // bottom of the home page, so the screen isn't spent on a bar with a single button
    <header className="header-bg shadow-md sticky top-0 z-50 hidden md:block">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-4 py-3 md:p-4">
        <Link href="/" className="text-lg md:text-xl font-bold">
          Expense Report
        </Link>
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md transition-colors duration-300 ${
                  pathname === link.href
                    ? "bg-boton"
                    : "text-gray-300 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {pathname !== "/login" && (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-gray-400 hover:text-white"
            >
              Salir
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
