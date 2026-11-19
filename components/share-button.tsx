"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type ShareButtonProps = {
  variant?: "header" | "mobile" | "inline";
  kind?: "page" | "listing";
  hideOnCompanyProfile?: boolean;
};

type ShareStatus = "copied" | "shared" | "error" | null;

const privateRoutePattern =
  /(?:^|\/)\b(?:dashboard|login|firmenkonto-einrichten|registrierung-bestaetigen)\b(?:\/|$)/;
const companyProfilePattern = /(?:^|\/)unternehmen\/[^/]+\/?$/;

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4" />
      <path d="m8.6 13.5 6.8 4" />
    </svg>
  );
}

export default function ShareButton({
  variant = "header",
  kind = "page",
  hideOnCompanyProfile = false,
}: ShareButtonProps) {
  const t = useTranslations("Share");
  const pathname = usePathname();
  const [status, setStatus] = useState<ShareStatus>(null);

  useEffect(() => {
    if (!status) return;

    const timeout = window.setTimeout(() => setStatus(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [status]);

  if (
    privateRoutePattern.test(pathname) ||
    (hideOnCompanyProfile && companyProfilePattern.test(pathname))
  ) {
    return null;
  }

  const label = t(kind);
  const statusLabel = status ? t(status) : null;

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  async function shareCurrentPage() {
    const url = window.location.href;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: document.title, url });
        setStatus("shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    await copyLink(url);
  }

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={shareCurrentPage}
        className="mobile-nav-link flex w-full items-center gap-3 text-left"
        aria-label={label}
      >
        <ShareIcon />
        <span>{statusLabel ?? label}</span>
      </button>
    );
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={shareCurrentPage}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 font-bold text-[var(--foreground)] transition-colors hover:border-[#9dceff] hover:bg-[#f5faff] hover:text-[var(--accent)]"
        aria-label={label}
      >
        <ShareIcon />
        <span>{statusLabel ?? label}</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={shareCurrentPage}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface)] hover:text-[var(--accent)]"
        aria-label={label}
        title={label}
      >
        <ShareIcon />
      </button>
      {statusLabel && (
        <span
          role="status"
          className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-xl bg-[var(--foreground)] px-3 py-2 text-xs font-bold text-white shadow-lg"
        >
          {statusLabel}
        </span>
      )}
    </div>
  );
}
