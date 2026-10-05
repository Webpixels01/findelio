import { NextResponse } from "next/server";
import { routing, type AppLocale } from "@/i18n/routing";
import { saveAuthTokens } from "@/lib/auth";
import {
  DirectusAuthError,
  verifyDirectusRegistration,
} from "@/lib/directus-auth";
import {
  completeInvitationRegistration,
  DirectusTeamError,
} from "@/lib/directus-team";

type VerificationBody = {
  token?: string;
  invitationToken?: string;
  locale?: string;
};

const invitationTokenPattern = /^[A-Za-z0-9_-]{40,100}$/;

function appLocale(value: string | undefined): AppLocale {
  return routing.locales.includes(value as AppLocale)
    ? (value as AppLocale)
    : routing.defaultLocale;
}

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

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "INVALID_FORMAT" }, { status: 415 });
  }

  try {
    const { token, invitationToken, locale: requestedLocale } =
      (await request.json()) as VerificationBody;
    const normalizedToken = token?.trim();
    const normalizedInvitationToken = invitationToken?.trim() ?? "";
    const locale = appLocale(requestedLocale);

    if (!normalizedToken || normalizedToken.length > 2048) {
      return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
    }

    if (
      normalizedInvitationToken &&
      !invitationTokenPattern.test(normalizedInvitationToken)
    ) {
      return NextResponse.json(
        { error: "INVALID_INVITATION" },
        { status: 400 },
      );
    }

    if (normalizedInvitationToken) {
      const completed = await completeInvitationRegistration(
        normalizedToken,
        normalizedInvitationToken,
      );
      await saveAuthTokens({
        access_token: completed.access_token,
        refresh_token: completed.refresh_token,
        expires: completed.expires,
      });

      return NextResponse.json(
        {
          success: true,
          redirectPath: `/${locale}/dashboard/firmenprofile`,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    await verifyDirectusRegistration(normalizedToken);

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof DirectusTeamError && error.status >= 500) {
      console.error("Einladungsregistrierung fehlgeschlagen:", error);
      return NextResponse.json(
        { error: "SERVER_ERROR" },
        {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    if (
      error instanceof DirectusAuthError ||
      error instanceof DirectusTeamError
    ) {
      console.warn(
        "Registrierungsbestätigung abgelehnt:",
        error.code ?? error.status,
      );

      return NextResponse.json(
        { error: "INVALID_TOKEN" },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    console.error("Registrierungsbestätigung fehlgeschlagen:", error);

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
