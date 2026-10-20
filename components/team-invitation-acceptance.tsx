"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PublicTeamInvitation } from "@/lib/directus-team";

type TeamInvitationAcceptanceProps = {
  token: string;
  invitation: PublicTeamInvitation | null;
  currentUserEmail: string | null;
  errorState?: "invalid" | "expired";
};

export default function TeamInvitationAcceptance({
  token,
  invitation,
  currentUserEmail,
  errorState,
}: TeamInvitationAcceptanceProps) {
  const t = useTranslations("TeamInvitation");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [acceptedOrganization, setAcceptedOrganization] = useState("");

  if (!invitation) {
    return (
      <section className="rounded-3xl border border-[var(--border)] bg-white p-7 text-center shadow-xl shadow-[#001734]/6 sm:p-9">
        <h1 className="text-3xl font-extrabold">
          {t(errorState === "expired" ? "expiredTitle" : "invalidTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-[var(--muted)]">
          {t(
            errorState === "expired"
              ? "expiredDescription"
              : "invalidDescription",
          )}
        </p>
        <Link href="/" className="primary-button mt-7 h-11 px-5">
          {t("home")}
        </Link>
      </section>
    );
  }

  if (acceptedOrganization) {
    return (
      <section className="rounded-3xl border border-[#bfe4ca] bg-[#eefaf2] p-7 text-center text-[#135f30] shadow-xl shadow-[#001734]/6 sm:p-9">
        <p className="eyebrow">{t("acceptedEyebrow")}</p>
        <h1 className="mt-3 text-3xl font-extrabold">
          {t("acceptedTitle", { organization: acceptedOrganization })}
        </h1>
        <p className="mt-4 leading-7">{t("acceptedDescription")}</p>
        <Link href="/dashboard/team" className="primary-button mt-7 h-11 px-5">
          {t("openTeam")}
        </Link>
      </section>
    );
  }

  const emailMatches =
    currentUserEmail?.toLowerCase() === invitation.email.toLowerCase();
  const nextPath = `/${locale}/team/einladung?token=${encodeURIComponent(token)}`;
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;
  const registerHref = `/firma-eintragen?invitation=${encodeURIComponent(token)}`;
  const expires = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
  }).format(new Date(invitation.expires_at));
  const organizationName = invitation.organization_name;

  async function accept() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/account/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_invitation", token }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: { organization_name?: string };
      };

      if (!response.ok || !result.success) {
        setError(
          result.error === "email_mismatch"
            ? t("emailMismatch")
            : result.error === "expired"
              ? t("expiredDescription")
              : t("acceptError"),
        );
        return;
      }

      setAcceptedOrganization(
        result.data?.organization_name ?? organizationName,
      );
    } catch {
      setError(t("acceptError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-7 shadow-xl shadow-[#001734]/6 sm:p-9">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
        {t("title", { organization: invitation.organization_name })}
      </h1>
      <p className="mt-4 leading-7 text-[var(--muted)]">{t("description")}</p>

      <dl className="mt-7 grid gap-4 rounded-2xl bg-[var(--surface)] p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-bold text-[var(--muted)]">{t("email")}</dt>
          <dd className="mt-1 break-all font-extrabold">{invitation.email}</dd>
        </div>
        <div>
          <dt className="text-sm font-bold text-[var(--muted)]">{t("role")}</dt>
          <dd className="mt-1 font-extrabold">
            {t(`roles.${invitation.role}`)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-sm font-bold text-[var(--muted)]">{t("validUntil")}</dt>
          <dd className="mt-1 font-extrabold">{expires}</dd>
        </div>
      </dl>

      {!currentUserEmail ? (
        <div className="mt-7 rounded-2xl border border-[#b8daf8] bg-[#f1f8ff] p-5">
          <h2 className="text-xl font-extrabold">{t("signInTitle")}</h2>
          <p className="mt-2 leading-7 text-[var(--muted)]">
            {t("signInDescription", { email: invitation.email })}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={loginHref} className="primary-button h-11 px-5">
              {t("signIn")}
            </Link>
            <Link href={registerHref} className="secondary-button h-11 px-5">
              {t("register")}
            </Link>
          </div>
        </div>
      ) : !emailMatches ? (
        <div className="mt-7 rounded-2xl border border-[#efb5b5] bg-[#fff4f4] p-5 text-[#941b1b]">
          <h2 className="text-xl font-extrabold">{t("wrongAccountTitle")}</h2>
          <p className="mt-2 leading-7">
            {t("wrongAccountDescription", {
              current: currentUserEmail,
              invited: invitation.email,
            })}
          </p>
        </div>
      ) : (
        <div className="mt-7">
          {error && (
            <p role="alert" className="mb-4 font-bold text-[#941b1b]">
              {error}
            </p>
          )}
          <button
            type="button"
            className="primary-button h-12 px-6 disabled:cursor-wait disabled:opacity-60"
            onClick={accept}
            disabled={busy}
          >
            {busy ? t("accepting") : t("accept")}
          </button>
        </div>
      )}
    </section>
  );
}
