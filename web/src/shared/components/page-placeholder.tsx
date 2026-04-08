import Link from "next/link";

type PagePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PagePlaceholder({
  eyebrow,
  title,
  description,
}: PagePlaceholderProps) {
  return (
    <main className="page-shell">
      <section className="panel gap-4">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
        <Link className="inline-link" href="/">
          Volver al Dashboard
        </Link>
      </section>
    </main>
  );
}
