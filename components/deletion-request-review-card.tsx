"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { AdminDeletionRequest } from "@/lib/directus-deletion";

function requesterName(request: AdminDeletionRequest, fallback: string): string {
  return (
    [request.requester_first_name, request.requester_last_name]
      .filter(Boolean)
      .join(" ") ||
    request.requester_email ||
    fallback
  );
}

export default function DeletionRequestReviewCard({
  request,
}: {
  request: AdminDeletionRequest;
}) {
  const t = useTranslations("DeletionRequests.admin");
  const locale = useLocale();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );

  async function decide(action: "approve" | "reject") {
    if (action === "reject" && note.trim().length < 3) {
      setError(t("reasonRequired"));
      return;
    }
    setBusy(action);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/deletion-requests/${request.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, note: note.trim() }),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(
          result?.error === "premium_active"
            ? t("premiumStillActive")
            : t("actionFailed"),
        );
        return;
      }
      router.refresh();
    } catch {
      setError(t("actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[var(--accent)]">
            {request.organization_name}
          </p>
          <h3 className="mt-2 text-2xl font-extrabold">{request.target_name}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {t("submittedBy", {
              name: requesterName(request, t("unknownRequester")),
              date: dateFormatter.format(new Date(request.date_created)),
            })}
          </p>
        </div>
        <span className="w-fit rounded-full bg-[#fff4d6] px-3 py-1.5 text-sm font-extrabold text-[#765600]">
          {t(`types.${request.entity_type}`)}
        </span>
      </div>

      <div className="mt-5 rounded-2xl bg-[var(--surface)] p-4">
        <p className="text-sm font-extrabold">{t("customerReason")}</p>
        <p className="mt-2 whitespace-pre-line text-[var(--muted)]">
          {request.reason || t("noReason")}
        </p>
      </div>

      {!request.can_approve && (
        <div className="mt-5 rounded-2xl border border-[#efd58c] bg-[#fff9e9] p-4 text-[#6f5000]">
          <p className="font-extrabold">{t("waitingForSubscription")}</p>
          <p className="mt-1 text-sm leading-6">
            {request.archive_available_at
              ? t("availableAfter", {
                  date: dateFormatter.format(
                    new Date(request.archive_available_at),
                  ),
                })
              : t("availableUnknown")}
          </p>
        </div>
      )}

      <label className="mt-5 block">
        <span className="field-label">{t("noteLabel")}</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          maxLength={2000}
          className="field-control mt-2"
          placeholder={t("notePlaceholder")}
        />
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-bold text-[#9d1c1c]">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          className="primary-button h-11 px-5 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy !== null || !request.can_approve}
          onClick={() => decide("approve")}
        >
          {busy === "approve" ? t("processing") : t("approve")}
        </button>
        <button
          type="button"
          className="rounded-xl border border-[#d99b00] bg-[#fff7df] px-5 py-2 font-extrabold text-[#765600] transition hover:bg-[#ffefbd] disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => decide("reject")}
        >
          {busy === "reject" ? t("processing") : t("reject")}
        </button>
      </div>
    </article>
  );
}
