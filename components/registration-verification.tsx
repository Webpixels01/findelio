"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";

type VerificationState = "loading" | "success" | "error";

export default function RegistrationVerification({
  token,
  invitationToken,
  locale,
}: {
  token: string;
  invitationToken: string;
  locale: string;
}) {
  const t = useTranslations("VerifyRegistration");
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState<VerificationState>(
    token ? "loading" : "error",
  );

  useEffect(() => {
    if (!token || started.current) {
      return;
    }
    started.current = true;

    window.history.replaceState({}, "", window.location.pathname);

    async function verifyRegistration() {
      try {
        const response = await fetch("/api/auth/verify-registration", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token, invitationToken, locale }),
        });

        const result = (await response.json()) as {
          success?: boolean;
          redirectPath?: string;
        };

        if (response.ok && result.success && result.redirectPath) {
          router.replace(result.redirectPath);
          router.refresh();
          return;
        }

        setState(response.ok && result.success ? "success" : "error");
      } catch {
        setState("error");
      }
    }

    // The verification token is single-use. React replays effects in
    // development, so keep the first request alive while `started` prevents a
    // duplicate submission.
    void verifyRegistration();
  }, [invitationToken, locale, router, token]);

  if (state === "loading") {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-white p-8 text-center shadow-xl shadow-[#001734]/6">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#d9e8f8] border-t-[#0277ee]" />
        <h1 className="mt-6 text-3xl font-extrabold">
          {t(invitationToken ? "invitationLoadingTitle" : "loadingTitle")}
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          {t(invitationToken ? "invitationLoadingText" : "loadingText")}
        </p>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="rounded-3xl border border-[#bfe4ca] bg-[#eefaf2] p-8 text-center text-[#135f30]">
        <h1 className="text-3xl font-extrabold">{t("successTitle")}</h1>
        <p className="mt-3 leading-7">
          {t("successText")}
        </p>
        <Link
          href="/login"
          className="primary-button mt-7 h-12 px-6"
        >
          {t("loginButton")}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-800">
      <h1 className="text-3xl font-extrabold">{t("errorTitle")}</h1>
      <p className="mt-3 leading-7">{t("errorText")}</p>
      <Link href="/firma-eintragen" className="primary-button mt-7 h-12 px-6">
        {t("registerButton")}
      </Link>
    </div>
  );
}
