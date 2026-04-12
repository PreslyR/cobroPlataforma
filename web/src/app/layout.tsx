import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { PersistentRootShell } from "@/shared/components/persistent-root-shell";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Cobro | Dashboard",
  description: "Panel operativo movil para la gestion de prestamos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Suspense fallback={children}>
          <PersistentRootShell>{children}</PersistentRootShell>
        </Suspense>
      </body>
    </html>
  );
}
