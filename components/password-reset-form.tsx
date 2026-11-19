"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";

export default function PasswordResetForm({ reset = false }: { reset?: boolean }) {
  const t = useTranslations("PasswordReset");
  const tr = useTranslations("Register");
  const locale = useLocale();
  const search = useSearchParams();
  const token = search.get("token") || "";
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    if (reset && form.get("password") !== form.get("confirm")) { setError("passwordMismatch"); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reset ? { action: "reset", token, password: form.get("password") } : { action: "request", locale, email: form.get("email") }) });
      const result = await response.json();
      if (!response.ok) {
        setError(response.status === 429 ? "rateLimited" : ["invalidToken", "passwordError"].includes(result.error) ? result.error : "error");
      } else {
        setSuccess(true);
        if (reset) window.history.replaceState(null, "", window.location.pathname);
      }
    } catch { setError("error"); } finally { setBusy(false); }
  }
  return <div className="rounded-3xl border border-[var(--border)] bg-white p-7">
    {success ? <p role="status">{t(reset ? "done" : "sent")}</p> : reset && !token ? <p role="alert">{t("invalidToken")}</p> : <form onSubmit={submit} className="space-y-5">
      {reset ? <>
        <label className="field-group"><span className="field-label">{t("newPassword")}</span><input className="field-control" type="password" name="password" autoComplete="new-password" required minLength={8} maxLength={1024} disabled={busy} aria-describedby="password-help" /></label>
        <p id="password-help" className="text-sm text-[var(--muted)]">{tr("passwordError")}</p>
        <label className="field-group"><span className="field-label">{t("confirmPassword")}</span><input className="field-control" type="password" name="confirm" autoComplete="new-password" required minLength={8} maxLength={1024} disabled={busy} /></label>
      </> : <label className="field-group"><span className="field-label">{t("email")}</span><input className="field-control" type="email" name="email" autoComplete="email" required maxLength={254} disabled={busy} /></label>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error === "passwordError" || error === "passwordMismatch" ? tr(error) : t(error)}</p>}
      <button disabled={busy} className="primary-button w-full px-8 py-4 disabled:opacity-50">{t(busy ? "busy" : reset ? "save" : "send")}</button>
    </form>}
    {reset && !success && <Link href="/passwort-vergessen" className="mt-5 block underline">{t("requestNew")}</Link>}
    <Link href="/login" className="mt-5 block underline">{t("back")}</Link>
  </div>;
}
