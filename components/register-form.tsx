"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const LETTER_PATTERN = /[A-Za-z]/;
const NUMBER_PATTERN = /\d/;
const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;

function isValidPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    LETTER_PATTERN.test(password) &&
    NUMBER_PATTERN.test(password) &&
    SPECIAL_CHARACTER_PATTERN.test(password)
  );
}

export default function RegisterForm({
  initialEmail = "",
  invitationToken = "",
}: {
  initialEmail?: string;
  invitationToken?: string;
}) {
  const t = useTranslations("Register");
  const locale = useLocale();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isValidPassword(password)) {
      setError(t("passwordError"));
      return;
    }

    if (password !== passwordConfirmation) {
      setError(t("passwordMismatch"));
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          locale,
          invitationToken,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        if (result.error === "INVALID_PASSWORD") {
          setError(t("passwordError"));
        } else if (result.error === "INVALID_EMAIL") {
          setError(t("emailError"));
        } else if (result.error === "INVALID_INVITATION") {
          setError(t("invitationError"));
        } else if (response.status >= 500) {
          setError(t("serverError"));
        } else {
          setError(t("errorFallback"));
        }
        return;
      }

      setIsSubmitted(true);
    } catch {
      setError(t("connectionError"));
    } finally {
      setIsLoading(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="rounded-3xl border border-[#bfe4ca] bg-[#eefaf2] p-8 text-[#135f30]">
        <h2 className="text-2xl font-extrabold">
          {t(invitationToken ? "invitationSuccessTitle" : "successTitle")}
        </h2>
        <p className="mt-3 leading-7">
          {t(invitationToken ? "invitationSuccessText" : "successText")}
        </p>
        <p className="mt-3 text-sm">{t("successHint")}</p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5 rounded-3xl border border-[var(--border)] bg-white p-6 shadow-xl shadow-[#001734]/6 md:grid-cols-2 md:p-8"
      onSubmit={handleSubmit}
    >
      <label className="field-group">
        <span className="field-label">{t("firstName")}</span>
        <input
          type="text"
          name="firstName"
          autoComplete="given-name"
          required
          maxLength={100}
          className="field-control"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          disabled={isLoading}
        />
      </label>

      <label className="field-group">
        <span className="field-label">{t("lastName")}</span>
        <input
          type="text"
          name="lastName"
          autoComplete="family-name"
          required
          maxLength={100}
          className="field-control"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          disabled={isLoading}
        />
      </label>

      <label className="field-group md:col-span-2">
        <span className="field-label">{t("email")}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
          className="field-control"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isLoading}
          readOnly={Boolean(invitationToken)}
          aria-readonly={Boolean(invitationToken)}
        />
      </label>

      <label className="field-group">
        <span className="field-label">{t("password")}</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="field-control"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isLoading}
        />
      </label>

      <label className="field-group">
        <span className="field-label">{t("passwordConfirmation")}</span>
        <input
          type="password"
          name="passwordConfirmation"
          autoComplete="new-password"
          required
          minLength={8}
          className="field-control"
          value={passwordConfirmation}
          onChange={(event) => setPasswordConfirmation(event.target.value)}
          disabled={isLoading}
        />
      </label>

      <p className="text-sm leading-6 text-[var(--muted)] md:col-span-2">
        {t("passwordHint")}
      </p>

      <button
        type="submit"
        className="primary-button h-12 px-6 md:col-span-2 md:justify-self-start"
        disabled={isLoading}
      >
        {isLoading
          ? t("loading")
          : t(invitationToken ? "invitationSubmit" : "submit")}
      </button>

      {error && (
        <p
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700 md:col-span-2"
          role="alert"
        >
          {error}
        </p>
      )}

      <p className="text-sm text-[var(--muted)] md:col-span-2">
        {t("loginPrompt")} {" "}
        <Link
          href={
            invitationToken
              ? `/login?next=${encodeURIComponent(`/${locale}/team/einladung?token=${invitationToken}`)}`
              : "/login"
          }
          className="font-bold text-[#0277ee] hover:underline"
        >
          {t("loginLink")}
        </Link>
      </p>
    </form>
  );
}
