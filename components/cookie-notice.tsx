"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const STORAGE_KEY = "findelio_cookie_notice_v1";
const STORAGE_DURATION = 1000 * 60 * 60 * 24 * 365;
const STORAGE_EVENT = "findelio-cookie-notice-change";
let acknowledgedInMemory = false;

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_EVENT, onStoreChange);
  };
}

function getSnapshot() {
  if (acknowledgedInMemory) return false;

  try {
    const acknowledgedAt = Number(window.localStorage.getItem(STORAGE_KEY));
    return !(
      Number.isFinite(acknowledgedAt) &&
      Date.now() - acknowledgedAt < STORAGE_DURATION
    );
  } catch {
    return true;
  }
}

function getServerSnapshot() {
  return false;
}

export default function CookieNotice() {
  const t = useTranslations("CookieNotice");
  const isVisible = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  function acknowledge() {
    acknowledgedInMemory = true;

    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // The notice can still be closed for the current page view.
    }

    window.dispatchEvent(new Event(STORAGE_EVENT));
  }

  if (!isVisible) return null;

  return (
    <aside
      aria-labelledby="cookie-notice-title"
      aria-describedby="cookie-notice-description"
      className="fixed inset-x-4 bottom-4 z-[60] rounded-3xl border border-[var(--border)] bg-white p-6 shadow-2xl shadow-[#001734]/20 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[30rem] sm:p-7"
      data-nosnippet
    >
      <p className="eyebrow">{t("eyebrow")}</p>
      <h2 id="cookie-notice-title" className="mt-2 text-2xl font-extrabold">
        {t("title")}
      </h2>
      <p
        id="cookie-notice-description"
        className="mt-3 leading-7 text-[var(--muted)]"
      >
        {t("description")}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          className="primary-button min-h-11 px-5"
          onClick={acknowledge}
        >
          {t("acknowledge")}
        </button>
        <Link
          href="/cookies"
          className="inline-flex min-h-11 items-center justify-center px-2 font-extrabold text-[var(--accent)] underline decoration-2 underline-offset-4 hover:text-[var(--foreground)]"
        >
          {t("details")}
        </Link>
      </div>
    </aside>
  );
}
