"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type BillingResult = {
  success?: boolean;
  url?: string;
  error?: string;
};

export default function ListingBillingActions({
  listingId,
  locale,
  premiumEnabled,
  initialInterval,
}: {
  listingId: string;
  locale: AppLocale;
  premiumEnabled: boolean;
  initialInterval: "monthly" | "yearly";
}) {
  const t = useTranslations("Billing");
  const [billingInterval, setBillingInterval] = useState(initialInterval);
  const [pendingAction, setPendingAction] = useState<
    "checkout" | "portal" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  function getErrorMessage(code?: string): string {
    const knownCodes = new Set([
      "invalid_data",
      "unauthorized",
      "forbidden",
      "not_found",
      "already_active",
      "listing_not_published",
      "billing_not_configured",
      "portal_unavailable",
      "checkout_failed",
      "portal_failed",
    ]);

    return knownCodes.has(code ?? "")
      ? t(`errors.${code}`)
      : t("errors.unknown");
  }

  async function startAction(
    action: "checkout" | "portal",
  ): Promise<void> {
    // Open the customer portal synchronously so browsers don't block the new
    // tab after the asynchronous session request has finished.
    const portalWindow =
      action === "portal" ? window.open("about:blank", "_blank") : null;

    if (portalWindow) {
      portalWindow.opener = null;
    }

    setPendingAction(action);
    setError(null);

    try {
      const response = await fetch(`/api/billing/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listing_id: listingId,
          billing_interval: billingInterval,
          locale,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | BillingResult
        | null;

      if (!response.ok || !result?.success || !result.url) {
        portalWindow?.close();
        setError(getErrorMessage(result?.error));
        return;
      }

      if (portalWindow) {
        portalWindow.location.replace(result.url);
      } else {
        // Fall back to the current tab if the browser blocks pop-ups.
        window.location.assign(result.url);
      }
    } catch {
      portalWindow?.close();
      setError(t("errors.network"));
    } finally {
      setPendingAction(null);
    }
  }

  if (premiumEnabled) {
    return (
      <div className="mt-6">
        <button
          type="button"
          className="primary-button h-12 px-6"
          onClick={() => startAction("portal")}
          disabled={pendingAction !== null}
        >
          {pendingAction === "portal"
            ? t("actions.openingPortal")
            : t("actions.manage")}
        </button>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {t("actions.portalHint")}
        </p>
        {error && (
          <p className="mt-4 font-bold text-[#b42318]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <fieldset>
        <legend className="font-extrabold">{t("intervalTitle")}</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["monthly", "yearly"] as const).map((interval) => (
            <label
              key={interval}
              className={`cursor-pointer rounded-2xl border-2 bg-white p-4 ${
                billingInterval === interval
                  ? "border-[var(--accent)]"
                  : "border-[var(--border)]"
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  className="mt-1"
                  type="radio"
                  name="billing_interval"
                  value={interval}
                  checked={billingInterval === interval}
                  onChange={() => setBillingInterval(interval)}
                  disabled={pendingAction !== null}
                />
                <span>
                  <span className="block font-extrabold">
                    {t(`intervals.${interval}.title`)}
                  </span>
                  <span className="mt-1 block text-sm text-[var(--muted)]">
                    {t(`intervals.${interval}.description`)}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="mt-4 text-sm text-[var(--muted)]">{t("terms")}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {t("termsNotice")}{" "}
        <Link href="/agb" className="font-bold text-[var(--accent)] hover:underline">
          {t("termsLink")}
        </Link>
      </p>

      <button
        type="button"
        className="primary-button mt-5 h-12 px-6"
        onClick={() => startAction("checkout")}
        disabled={pendingAction !== null}
      >
        {pendingAction === "checkout"
          ? t("actions.openingCheckout")
          : t("actions.subscribe")}
      </button>

      {error && (
        <p className="mt-4 font-bold text-[#b42318]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
