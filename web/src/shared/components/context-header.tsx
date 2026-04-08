"use client";

import Link from "next/link";

type ContextHeaderProps = {
  backHref: string;
  backLabel: string;
  backIcon?: "chevron" | "close";
  backOnClick?: () => void;
  title: string;
  subtitle?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function ContextHeader({
  backHref,
  backLabel,
  backIcon = "chevron",
  backOnClick,
  title,
  subtitle,
  secondaryHref,
  secondaryLabel,
}: ContextHeaderProps) {
  return (
    <header className="context-header">
      <div className="context-header-top">
        {backOnClick ? (
          <button className="context-header-back" type="button" onClick={backOnClick}>
            <svg
              className="context-header-back-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              {backIcon === "close" ? (
                <path d="M6 6l12 12M18 6 6 18" />
              ) : (
                <path d="M15 18 9 12l6-6" />
              )}
            </svg>
            <span>{backLabel}</span>
          </button>
        ) : (
          <Link className="context-header-back" href={backHref}>
            <svg
              className="context-header-back-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              {backIcon === "close" ? (
                <path d="M6 6l12 12M18 6 6 18" />
              ) : (
                <path d="M15 18 9 12l6-6" />
              )}
            </svg>
            <span>{backLabel}</span>
          </Link>
        )}

        {secondaryHref && secondaryLabel ? (
          <Link className="context-header-secondary" href={secondaryHref}>
            {secondaryLabel}
          </Link>
        ) : null}
      </div>

      <div className="context-header-copy">
        <h1 className="context-header-title">{title}</h1>
        {subtitle ? <p className="context-header-subtitle">{subtitle}</p> : null}
      </div>
    </header>
  );
}
