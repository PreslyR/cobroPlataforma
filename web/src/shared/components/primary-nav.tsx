import Link from "next/link";

export type PrimaryNavItem = {
  key: "dashboard" | "portfolio" | "clients" | "reports";
  label: string;
  href: string;
  active: boolean;
};

type PrimaryNavProps = {
  items: PrimaryNavItem[];
  variant: "mobile" | "desktop";
};

function NavIcon({ itemKey }: { itemKey: PrimaryNavItem["key"] }) {
  const className = "primary-nav-icon";

  switch (itemKey) {
    case "dashboard":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M3.75 10.5L12 4l8.25 6.5" />
          <path d="M5.25 9.75V20h13.5V9.75" />
        </svg>
      );
    case "portfolio":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M3.75 7.5h16.5v11.25H3.75z" />
          <path d="M8.25 7.5V6a2.25 2.25 0 0 1 2.25-2.25h3A2.25 2.25 0 0 1 15.75 6v1.5" />
          <path d="M15.75 13.125h2.25" />
        </svg>
      );
    case "clients":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M12 12a3.375 3.375 0 1 0 0-6.75A3.375 3.375 0 0 0 12 12Z" />
          <path d="M5.625 19.5a6.375 6.375 0 0 1 12.75 0" />
          <path d="M6.375 9.75a2.25 2.25 0 1 0 0-4.5" />
          <path d="M17.625 5.25a2.25 2.25 0 1 1 0 4.5" />
        </svg>
      );
    case "reports":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M4.5 19.5h15" />
          <path d="M7.5 16.5V12" />
          <path d="M12 16.5V8.25" />
          <path d="M16.5 16.5v-5.25" />
        </svg>
      );
  }
}

export function PrimaryNav({ items, variant }: PrimaryNavProps) {
  return (
    <nav
      aria-label="Navegacion principal"
      className={
        variant === "desktop" ? "primary-nav primary-nav-desktop" : "primary-nav"
      }
    >
      {items.map((item) => (
        <Link
          key={item.key}
          className={`primary-nav-link ${item.active ? "primary-nav-link-active" : ""}`}
          href={item.href}
        >
          <NavIcon itemKey={item.key} />
          <span className="primary-nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
