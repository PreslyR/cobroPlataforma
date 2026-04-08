"use client";

import { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppShell } from "@/shared/components/app-shell";

type PersistentRootShellProps = {
  children: ReactNode;
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthStartInputValue(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function clampDateInputValue(value: string, maxValue: string) {
  return value > maxValue ? maxValue : value;
}

function buildQueryString(values: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

const ROOT_PATHS = new Set(["/", "/portfolio", "/clients", "/reports"]);

export function PersistentRootShell({
  children,
}: PersistentRootShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!ROOT_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  const lenderId = searchParams.get("lenderId") ?? "";

  if (!lenderId) {
    return <>{children}</>;
  }

  const today = toDateInputValue(new Date());
  const routeDate = clampDateInputValue(
    searchParams.get("date") ?? searchParams.get("to") ?? today,
    today,
  );
  const reportsFrom = clampDateInputValue(
    searchParams.get("from") ?? getMonthStartInputValue(routeDate),
    today,
  );
  const reportsTo = clampDateInputValue(
    searchParams.get("to") ?? routeDate,
    today,
  );
  const baseQueryString = buildQueryString({ lenderId, date: routeDate });
  const reportsQueryString = buildQueryString({
    lenderId,
    from: reportsFrom,
    to: reportsTo,
  });

  const navItems = [
    { key: "dashboard" as const, label: "Inicio", href: `/${baseQueryString}` },
    {
      key: "portfolio" as const,
      label: "Cartera",
      href: `/portfolio${baseQueryString}`,
    },
    {
      key: "clients" as const,
      label: "Clientes",
      href: `/clients${baseQueryString}`,
    },
    {
      key: "reports" as const,
      label: "Reportes",
      href: `/reports${reportsQueryString}`,
    },
  ];

  const activeItem =
    pathname === "/portfolio"
      ? "portfolio"
      : pathname === "/clients"
        ? "clients"
        : pathname === "/reports"
          ? "reports"
          : "dashboard";

  return (
    <AppShell
      activeItem={activeItem}
      navItems={navItems}
      paymentHref={`/payments/new${buildQueryString({
        lenderId,
        date: routeDate,
        origin: "global-payment",
        from: pathname === "/reports" ? reportsFrom : undefined,
        to: pathname === "/reports" ? reportsTo : undefined,
      })}`}
      newLoanHref={`/loans/new${baseQueryString}`}
    >
      {children}
    </AppShell>
  );
}
