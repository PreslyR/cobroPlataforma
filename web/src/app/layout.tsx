import type { Metadata } from "next";
import { PersistentRootShell } from "@/shared/components/persistent-root-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cobro | Dashboard",
  description: "Panel operativo móvil para la gestión de préstamos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PersistentRootShell>{children}</PersistentRootShell>
      </body>
    </html>
  );
}
