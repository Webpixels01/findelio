"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type ReviewAction = "approve" | "reject" | "suspend";

export default function ListingReviewActions({ revisionId }: { revisionId: string }) {
  const t = useTranslations("ListingReview.detail");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: ReviewAction) {
    if ((action === "reject" || action === "suspend") && reason.trim().length < 3) {
      setError(t("reasonRequired"));
      return;
    }

    setPendingAction(action);
    setError(null);

    try {
      const response = await fetch(`/api/admin/listing-revisions/${revisionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() }),
      });

      const result = await response.json().catch(() => null) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "action_failed");
      }

      router.push("/dashboard/pruefung");
      router.refresh();
    } catch {
      setError(t("actionFailed"));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5">
      <h2 className="text-xl font-extrabold">{t("decisionTitle")}</h2>
      <p className="mt-2 text-[var(--muted)]">{t("decisionDescription")}</p>

      <label className="mt-5 block">
        <span className="text-sm font-bold">{t("reasonLabel")}</span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={t("reasonPlaceholder")}
          className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[#0277ee]/10"
        />
      </label>

      {error ? (
        <p className="mt-3 rounded-xl bg-[#fff0f0] px-4 py-3 text-sm font-bold text-[#9d1c1c]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => submit("approve")}
          className="rounded-xl bg-[var(--accent)] px-5 py-3 font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingAction === "approve" ? t("processing") : t("approve")}
        </button>
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => submit("reject")}
          className="rounded-xl border border-[#d99b00] bg-[#fff7df] px-5 py-3 font-extrabold text-[#765600] transition hover:bg-[#ffefbd] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingAction === "reject" ? t("processing") : t("reject")}
        </button>
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => submit("suspend")}
          className="rounded-xl border border-[#d33a3a] bg-[#fff0f0] px-5 py-3 font-extrabold text-[#9d1c1c] transition hover:bg-[#ffe0e0] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingAction === "suspend" ? t("processing") : t("suspend")}
        </button>
      </div>
    </section>
  );
}
