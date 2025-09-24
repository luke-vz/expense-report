// app/layout.tsx
import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "Expense Report",
  description: "Trackeá tus gastos del hogar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="dark:bg-bg-dark text-gray-900 dark:text-text-dark min-h-screen transition-colors duration-300">
        <Header />
        <main className="pt-20">{children}</main>
      </body>
    </html>
  );
}
