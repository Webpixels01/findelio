"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Grant = {
  id: string;
  reason: string;
  starts_at: string;
  ends_at: string | null;
  revoked_at: string | null;
};

type Listing = {
  id: string;
  name: string;
  status: string;
  organization: { name: string } | null;
  grants: Grant[];
};

function isActive(grant: Grant): boolean {
  if (grant.revoked_at) return false;
  return !grant.ends_at || new Date(grant.ends_at) > new Date();
}

export default function PremiumGrantManager({
  listings,
  locale,
}: {
  listings: Listing[];
  locale: string;
}) {
  const t = useTranslations("PremiumGrants");
  const router = useRouter();
  const [listingId, setListingId] = useState("");
  const [reason, setReason] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableListings = useMemo(
    () => listings.filter((listing) => listing.status !== "archived" && !listing.grants.some(isActive)),
    [listings],
  );

  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value))
      : t("unlimited");

  async function grantPremium(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/premium-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          reason,
          ends_at: unlimited ? null : endsAt,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "save_failed");
        return;
      }
      setListingId("");
      setReason("");
      setEndsAt("");
      setUnlimited(true);
      router.refresh();
    } catch {
      setError("network");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(grantId: string) {
    if (!window.confirm(t("revokeConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/premium-grants/${grantId}`, { method: "DELETE" });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(result?.error ?? "save_failed");
        return;
      }
      router.refresh();
    } catch {
      setError("network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-3xl border border-[#bfdcff] bg-[#f5faff] p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
        <h2 className="text-2xl font-extrabold">{t("grantTitle")}</h2>
        <p className="mt-3 text-[var(--muted)]">{t("grantDescription")}</p>
        <form className="mt-6 grid gap-4" onSubmit={grantPremium}>
          <label className="field-group">
            <span className="field-label">{t("listingLabel")}</span>
            <select className="field-control" value={listingId} onChange={(event) => setListingId(event.target.value)} required>
              <option value="">{t("listingPlaceholder")}</option>
              {availableListings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.organization?.name ?? t("unknownOrganization")} · {listing.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">{t("reasonLabel")}</span>
            <textarea className="field-control min-h-24 py-3" value={reason} onChange={(event) => setReason(event.target.value)} required minLength={3} maxLength={1000} />
          </label>

          <label className="flex items-center gap-3 font-bold">
            <input type="checkbox" checked={unlimited} onChange={(event) => setUnlimited(event.target.checked)} />
            {t("unlimitedLabel")}
          </label>

          {!unlimited && (
            <label className="field-group">
              <span className="field-label">{t("endsAtLabel")}</span>
              <input className="field-control" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required />
            </label>
          )}

          {error && <p className="font-bold text-[#b42318]">{t.has(error) ? t(error) : t("save_failed")}</p>}
          <button type="submit" className="primary-button h-12 px-5" disabled={busy || availableListings.length === 0}>
            {busy ? t("saving") : t("grantButton")}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-lg shadow-[#001734]/5 sm:p-8">
        <h2 className="text-2xl font-extrabold">{t("overviewTitle")}</h2>
        <p className="mt-3 text-[var(--muted)]">{t("overviewDescription")}</p>
        <div className="mt-6 grid gap-4">
          {listings.map((listing) => {
            const activeGrant = listing.grants.find(isActive);
            return (
              <article key={listing.id} className="rounded-2xl border border-[var(--border)] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--accent)]">{listing.organization?.name ?? t("unknownOrganization")}</p>
                    <h3 className="mt-1 text-xl font-extrabold">{listing.name}</h3>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-extrabold ${activeGrant ? "bg-[#e8f8ed] text-[#176b35]" : "bg-[var(--surface)] text-[#40536b]"}`}>
                    {activeGrant ? t("active") : t("notActive")}
                  </span>
                </div>
                {activeGrant ? (
                  <div className="mt-4 flex flex-col gap-3 text-sm text-[var(--muted)] sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p><strong className="text-[var(--foreground)]">{t("reasonLabel")}:</strong> {activeGrant.reason}</p>
                      <p className="mt-1"><strong className="text-[var(--foreground)]">{t("endsAtLabel")}:</strong> {formatDate(activeGrant.ends_at)}</p>
                    </div>
                    <button type="button" className="danger-button h-10 px-4 text-sm" disabled={busy} onClick={() => revoke(activeGrant.id)}>{t("revokeButton")}</button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[var(--muted)]">{t("noActiveGrant")}</p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
