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
      <body className="bg-gray-50 min-h-screen">
        <Header />
        <main className="pt-20">{children}</main>
      </body>
    </html>
  );
}
