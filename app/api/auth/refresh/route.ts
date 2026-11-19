import { NextResponse } from "next/server";
import { routing, type AppLocale } from "@/i18n/routing";
import {
  clearAuthCookies,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth";
import {
  DirectusAuthError,
  refreshDirectusSession,
} from "@/lib/directus-auth";

function isAppLocale(value: string | null): value is AppLocale {
  return routing.locales.includes(value as AppLocale);
}

function getSafeLocale(value: string | null): AppLocale {
  return isAppLocale(value) ? value : routing.defaultLocale;
}

function getSafeNextPath(value: string | null, locale: AppLocale): string {
  if (
    value &&
    value.startsWith(`/${locale}/`) &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }

  return `/${locale}/dashboard`;
}

async function refreshSession() {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return false;
  }

  try {
    const tokens = await refreshDirectusSession(refreshToken);
    await saveAuthTokens(tokens);
    return true;
  } catch (error) {
    if (!(error instanceof DirectusAuthError)) {
      console.error("Session-Aktualisierung fehlgeschlagen:", error);
    }

    await clearAuthCookies();
    return false;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const redirectBase = configuredSiteUrl
    ? new URL(configuredSiteUrl)
    : requestUrl;
  const locale = getSafeLocale(requestUrl.searchParams.get("locale"));
  const nextPath = getSafeNextPath(
    requestUrl.searchParams.get("next"),
    locale,
  );
  const refreshed = await refreshSession();

  if (refreshed) {
    return NextResponse.redirect(new URL(nextPath, redirectBase));
  }

  const loginUrl = new URL(`/${locale}/login`, redirectBase);
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}

export async function POST() {
  const refreshed = await refreshSession();

  if (!refreshed) {
    return NextResponse.json(
      { success: false },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    { success: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
