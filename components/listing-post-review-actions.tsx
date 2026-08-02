"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export default function ListingPostReviewActions({ postId }: { postId: string }) {
  const t = useTranslations("Growth.review");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function decide(action: "approve" | "reject") {
    if (action === "reject" && reason.trim().length < 3) { setError(true); return; }
    setBusy(true); setError(false);
    const response = await fetch(`/api/review/posts/${postId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
    if (!response.ok) { setError(true); setBusy(false); return; }
    router.refresh();
  }

  return <div className="mt-5 border-t border-[var(--border)] pt-5"><label className="field-group"><span className="field-label">{t("reason")}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} className="field-control min-h-20" /></label>{error && <p className="mt-3 text-sm font-bold text-[#9d1c1c]">{t("error")}</p>}<div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => decide("approve")} className="primary-button h-10 px-4">{t("approve")}</button><button type="button" disabled={busy} onClick={() => decide("reject")} className="rounded-xl border border-[#e2a6a6] px-4 py-2 font-bold text-[#9d1c1c]">{t("reject")}</button></div></div>;
}
