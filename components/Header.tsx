// components/Header.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/expenses", label: "Gastos" },
    { href: "/expenses/new", label: "Nuevo Gasto" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <header className="header-bg shadow-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex justify-between items-center p-4">
        <h1 className="text-xl font-bold ">Expense Report</h1>

        {/* Desktop Links */}
        <nav className="hidden md:flex gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 rounded-md transition-colors duration-300 ${
                pathname === link.href
                  ? "bg-boton"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Hamburger Button */}
        <button
          className="md:hidden flex items-center px-3 py-2 border rounded text-gray-700 border-gray-400"
          onClick={() => setOpen(!open)}
        >
          <svg
            className="fill-current h-5 w-5"
            viewBox="0 0 20 20"
          >
            {open ? (
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            ) : (
              <path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu Animado */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden  shadow-md overflow-hidden"
          >
            <ul className="flex flex-col gap-1 p-4">
              {links.map((link) => (
                <motion.li
                  key={link.href}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link
                    href={link.href}
                    className={`block px-3 py-2 rounded-md transition-colors duration-300 ${
                      pathname === link.href
                        ? "bg-indigo-600 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
