"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type {
  AccountDeletionRequest,
  DeletionEntityType,
} from "@/lib/directus-deletion";

type Props = {
  entityType: DeletionEntityType;
  targetId: string;
  targetName: string;
  request: AccountDeletionRequest | null;
  canRequest: boolean;
  premiumMustBeCancelled: boolean;
  subscriptionHref?: string;
};

export default function DeletionRequestAction({
  entityType,
  targetId,
  targetName,
  request,
  canRequest,
  premiumMustBeCancelled,
  subscriptionHref,
}: Props) {
  const t = useTranslations("DeletionRequests.customer");
  const locale = useLocale();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function errorText(code: string): string {
    const known = new Set([
      "premium_not_cancelled",
      "request_exists",
      "send_failed",
      "forbidden",
      "not_found",
    ]);
    return t(`errors.${known.has(code) ? code : "unknown"}`);
  }

  async function submitRequest() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/deletion-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          target_id: targetId,
          reason: reason.trim(),
          locale,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(errorText(result?.error ?? ""));
        return;
      }
      setDialogOpen(false);
      setReason("");
      router.refresh();
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  async function withdrawRequest() {
    if (!request) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/deletion-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: request.id }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(errorText(result?.error ?? ""));
        return;
      }
      router.refresh();
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(false);
    }
  }

  if (request) {
    return (
      <div className="mt-5 rounded-2xl border border-[#efd58c] bg-[#fff9e9] p-4">
        <p className="font-extrabold text-[#6f5000]">{t("pendingTitle")}</p>
        <p className="mt-1 text-sm leading-6 text-[#765d1e]">
          {t("pendingDescription")}
        </p>
        {request.can_cancel && (
          <button
            type="button"
            className="mt-3 text-sm font-extrabold text-[#8d241f] underline decoration-1 underline-offset-4 disabled:opacity-50"
            onClick={withdrawRequest}
            disabled={busy}
          >
            {busy ? t("withdrawing") : t("withdraw")}
          </button>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm font-bold text-[#9d1c1c]">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!canRequest) return null;

  if (premiumMustBeCancelled) {
    return (
      <div className="mt-5 rounded-2xl border border-[#b8daf8] bg-[#f1f8ff] p-4">
        <p className="font-extrabold">{t("premiumTitle")}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          {t("premiumDescription")}
        </p>
        {subscriptionHref && (
          <Link
            href={subscriptionHref}
            className="mt-3 inline-flex text-sm font-extrabold text-[var(--accent)] hover:underline"
          >
            {entityType === "listing"
              ? t("manageSubscription")
              : t("viewListings")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="mt-5 text-sm font-extrabold text-[#9d1c1c] underline decoration-1 underline-offset-4"
        onClick={() => {
          setError("");
          setDialogOpen(true);
        }}
      >
        {t("requestButton")}
      </button>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#001734]/65 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setDialogOpen(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !busy) setDialogOpen(false);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`deletion-title-${targetId}`}
            aria-describedby={`deletion-description-${targetId}`}
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-7"
          >
            <p className="eyebrow">{t("eyebrow")}</p>
            <h2
              id={`deletion-title-${targetId}`}
              className="mt-2 text-2xl font-extrabold"
            >
              {t(`${entityType}Title`, { name: targetName })}
            </h2>
            <p
              id={`deletion-description-${targetId}`}
              className="mt-3 leading-7 text-[var(--muted)]"
            >
              {t(`${entityType}Description`)}
            </p>

            <label className="mt-5 block">
              <span className="field-label">{t("reasonLabel")}</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={2000}
                rows={4}
                className="field-control mt-2"
                placeholder={t("reasonPlaceholder")}
                autoFocus
              />
            </label>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-bold text-[#9d1c1c]"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="secondary-button h-11 px-5"
                onClick={() => setDialogOpen(false)}
                disabled={busy}
              >
                {t("keep")}
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#a92323] px-5 font-extrabold text-white transition hover:bg-[#7f1717] disabled:opacity-60"
                onClick={submitRequest}
                disabled={busy}
              >
                {busy ? t("submitting") : t("confirm")}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
