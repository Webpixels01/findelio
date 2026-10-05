import { NextResponse } from "next/server";
import { routing, type AppLocale } from "@/i18n/routing";
import {
  DirectusAuthError,
  registerDirectusUser,
} from "@/lib/directus-auth";
import {
  DirectusReferralError,
  registerDirectusUserWithReferral,
} from "@/lib/directus-referral";
import {
  isReferralRegistrationEnabled,
  isValidReferralCodeFormat,
  normalizeReferralCode,
} from "@/lib/referral-registration";
import {
  DirectusTeamError,
  getPublicTeamInvitation,
} from "@/lib/directus-team";

type RegisterBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  locale?: string;
  invitationToken?: string;
  referralCode?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LETTER_PATTERN = /[A-Za-z]/;
const NUMBER_PATTERN = /\d/;
const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;
const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,100}$/;

function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const expectedOrigin = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? request.url,
  ).origin;

  return origin === expectedOrigin;
}

function isAppLocale(value: string | undefined): value is AppLocale {
  return routing.locales.includes(value as AppLocale);
}

function validatePassword(password: string): boolean {
  return (
    password.length >= 8 &&
    LETTER_PATTERN.test(password) &&
    NUMBER_PATTERN.test(password) &&
    SPECIAL_CHARACTER_PATTERN.test(password)
  );
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "INVALID_FORMAT" }, { status: 415 });
  }

  try {
    const body = (await request.json()) as RegisterBody;
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const invitationToken = body.invitationToken?.trim() ?? "";
    const referralCode = normalizeReferralCode(body.referralCode);
    const locale = isAppLocale(body.locale)
      ? body.locale
      : routing.defaultLocale;
    const referralEnabled = isReferralRegistrationEnabled();

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: "REQUIRED_FIELDS" }, { status: 400 });
    }

    if (firstName.length > 100 || lastName.length > 100) {
      return NextResponse.json({ error: "NAME_TOO_LONG" }, { status: 400 });
    }

    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
    }

    if (!validatePassword(password)) {
      return NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 400 });
    }

    if (invitationToken) {
      if (!INVITATION_TOKEN_PATTERN.test(invitationToken)) {
        return NextResponse.json(
          { error: "INVALID_INVITATION" },
          { status: 400 },
        );
      }

      try {
        const invitation = await getPublicTeamInvitation(invitationToken);
        if (invitation.email.toLowerCase() !== email) {
          return NextResponse.json(
            { error: "INVALID_INVITATION" },
            { status: 400 },
          );
        }
      } catch (error) {
        if (error instanceof DirectusTeamError) {
          return NextResponse.json(
            { error: "INVALID_INVITATION" },
            { status: 400 },
          );
        }
        throw error;
      }
    }

    // Team invitations never create a referral redemption. Ignore any code.
    const effectiveReferralCode =
      !invitationToken && referralEnabled ? referralCode : "";

    if (effectiveReferralCode && !isValidReferralCodeFormat(effectiveReferralCode)) {
      return NextResponse.json({ error: "INVALID_REFERRAL" }, { status: 400 });
    }

    // When the feature is off, never treat a submitted code as accepted.
    if (!referralEnabled && referralCode) {
      // Fall through to the standard registration path without redeeming.
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!siteUrl) {
      throw new Error("NEXT_PUBLIC_SITE_URL fehlt in der Datei .env.local");
    }

    const verificationUrl = new URL(
      `/${locale}/registrierung-bestaetigen`,
      siteUrl,
    );
    if (invitationToken) {
      verificationUrl.searchParams.set("invitation", invitationToken);
    }

    try {
      if (effectiveReferralCode) {
        await registerDirectusUserWithReferral({
          firstName,
          lastName,
          email,
          password,
          verificationUrl: verificationUrl.toString(),
          referralCode: effectiveReferralCode,
        });
      } else {
        await registerDirectusUser({
          firstName,
          lastName,
          email,
          password,
          verificationUrl: verificationUrl.toString(),
        });
      }
    } catch (error) {
      if (
        error instanceof DirectusReferralError &&
        error.code === "feature_disabled"
      ) {
        try {
          await registerDirectusUser({
            firstName,
            lastName,
            email,
            password,
            verificationUrl: verificationUrl.toString(),
          });
        } catch (fallbackError) {
          if (
            fallbackError instanceof DirectusAuthError &&
            fallbackError.status < 500
          ) {
            console.warn(
              "Directus-Registrierung abgelehnt:",
              fallbackError.code ?? fallbackError.status,
              fallbackError.message,
            );
          } else {
            throw fallbackError;
          }
        }
      } else if (error instanceof DirectusReferralError) {
        if (error.code === "invalid_referral") {
          return NextResponse.json(
            { error: "INVALID_REFERRAL" },
            { status: 400 },
          );
        }
        if (error.status < 500) {
          console.warn(
            "Referral-Registrierung abgelehnt:",
            error.code ?? error.status,
          );
        } else {
          throw error;
        }
      } else if (error instanceof DirectusAuthError && error.status < 500) {
        console.warn(
          "Directus-Registrierung abgelehnt:",
          error.code ?? error.status,
          error.message,
        );
      } else {
        throw error;
      }
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Registrierung fehlgeschlagen:", error);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
