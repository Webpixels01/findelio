"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "@/i18n/navigation";
import type { TwoFactorStatus } from "@/lib/two-factor";

type Setup = { secret: string; url: string; ticket: string };

export default function TwoFactorSettings({ status }: { status: TwoFactorStatus }) {
  const t = useTranslations("TwoFactor");
  const locale = useLocale();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [backedUp, setBackedUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const action = setup ? "enable" : status.enabled ? "disable" : "generate";
    try {
      const response = await fetch("/api/auth/two-factor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, password, otp, ticket: setup?.ticket, backedUp }),
      });
      const result = await response.json();
      if (!response.ok) {
        const messages: Record<string, string> = {
          invalid_otp: t("invalidOtp"), invalid_password: t("invalidPassword"),
          expired_setup: t("expiredSetup"), rate_limited: t("rateLimited"),
          session_expired: t("sessionExpired"), required: t("required"),
        };
        setError(messages[result.error] ?? t("failed"));
        return;
      }
      setPassword("");
      setOtp("");
      if (action === "generate") setSetup(result as Setup);
      else { setSetup(null); setDone(true); }
    } catch { setError(t("failed")); }
    finally { setBusy(false); }
  }

  if (done || (status.pending && status.enabled)) return (
    <div className="mt-7 rounded-3xl border border-[var(--border)] bg-white p-7" role="status">
      <p>{done ? t("saved") : t("loginAgain")}</p>
      <Link href={`/login?next=${encodeURIComponent(`/${locale}/konto/sicherheit`)}`} className="primary-button mt-5 inline-flex px-6 py-3">{t("login")}</Link>
    </div>
  );

  return <section className="mt-7 rounded-3xl border border-[var(--border)] bg-white p-7 shadow-lg shadow-[#001734]/5">
    <p className="font-bold">{status.enabled ? t("enabled") : t("disabled")}</p>
    <p className="mt-2 text-sm text-[var(--muted)]">{status.required ? t("required") : t("optional")}</p>
    {status.enabled && <p className="mt-4 text-sm text-[var(--muted)]">{t("recovery")}</p>}
    {!status.passwordSupported && <p className="mt-5">{t("externalProvider")}</p>}
    {status.passwordSupported && !(status.enabled && status.required) && (
      <form className="mt-6" onSubmit={submit}>
        {!setup ? <>
          <label className="field-group">
            <span className="field-label">{t("password")}</span>
            <input className="field-control" type="password" autoComplete="current-password" required maxLength={1024}
              value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          </label>
        </> : <>
          <p>{t("scan")}</p>
          <div className="my-5 w-fit rounded-xl border border-[var(--border)] bg-white p-4" data-brand-surface>
            <QRCodeSVG value={setup.url} size={200} level="M" title={t("qrLabel")} />
          </div>
          <p className="text-sm font-bold">{t("secretLabel")}</p>
          <code className="mt-2 block break-all rounded-xl bg-[var(--surface)] p-3 text-base select-all">{setup.secret}</code>
          <p className="mt-3 text-sm text-[var(--muted)]">{t("backup")}</p>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" required checked={backedUp} onChange={(e) => setBackedUp(e.target.checked)} disabled={busy} className="mt-1" />
            <span>{t("backedUp")}</span>
          </label>
        </>}
        {(setup || status.enabled) && <label className="field-group mt-5">
          <span className="field-label">{t("otp")}</span>
          <input className="field-control" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
            value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} disabled={busy} />
        </label>}
        <button className="primary-button mt-6 min-h-12 w-full px-6" disabled={busy || (!!setup && !backedUp)}>
          {busy ? t("working") : setup ? t("enable") : status.enabled ? t("disable") : t("start")}
        </button>
        {setup && <button type="button" className="mt-4 w-full text-sm font-bold" disabled={busy}
          onClick={() => { setSetup(null); setOtp(""); setBackedUp(false); setError(""); }}>{t("cancel")}</button>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </form>
    )}
  </section>;
}
