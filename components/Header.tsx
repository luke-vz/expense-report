// components/Header.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/expenses", label: "Gastos" },
  { href: "/expenses/new", label: "Nuevo Gasto" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/categories", label: "Categorías" },
];

// On mobile only the title shows; navigation lives in BottomNav.
export default function Header() {
  const pathname = usePathname();

  return (
    <header className="header-bg shadow-md sticky top-0 z-50 pt-[env(safe-area-inset-top)]">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-4 py-3 md:p-4">
        <Link href="/" className="text-lg md:text-xl font-bold">
          Expense Report
        </Link>
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
      </div>
    </header>
  );
}
