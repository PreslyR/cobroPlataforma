import { ReactNode } from "react";
import { ActionLauncher } from "@/shared/components/action-launcher";
import { PrimaryNav, type PrimaryNavItem } from "@/shared/components/primary-nav";

type AppShellProps = {
  activeItem: PrimaryNavItem["key"];
  navItems: Omit<PrimaryNavItem, "active">[];
  paymentHref: string;
  newLoanHref: string;
  children: ReactNode;
};

export function AppShell({
  activeItem,
  navItems,
  paymentHref,
  newLoanHref,
  children,
}: AppShellProps) {
  const items = navItems.map((item) => ({
    ...item,
    active: item.key === activeItem,
  }));

  return (
    <div className="app-shell">
      <aside className="app-shell-sidebar">
        <div className="app-shell-brand">
          <p className="eyebrow">Cobro</p>
          <h1 className="app-shell-brand-title">Operacion del prestamista</h1>
          <p className="app-shell-brand-copy">
            Navegacion principal y acciones rapidas del negocio.
          </p>
        </div>

        <PrimaryNav items={items} variant="desktop" />
        <ActionLauncher
          paymentHref={paymentHref}
          newLoanHref={newLoanHref}
          variant="desktop"
        />
      </aside>

      <div className="app-shell-content">{children}</div>

      <div className="app-mobile-dock">
        <ActionLauncher
          paymentHref={paymentHref}
          newLoanHref={newLoanHref}
          variant="mobile"
        />
        <PrimaryNav items={items} variant="mobile" />
      </div>
    </div>
  );
}
