import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";
import {
  DirectusAuthError,
  getDirectusCurrentUser,
  type DirectusAuthTokens,
  type DirectusCurrentUser,
} from "@/lib/directus-auth";

export const ACCESS_COOKIE_NAME = "findelio_access_token";
export const REFRESH_COOKIE_NAME = "findelio_refresh_token";

const LEGACY_REFRESH_COOKIE_PATH = "/api/auth";
const DEFAULT_REFRESH_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 7;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function getRefreshCookieTtl(): number {
  const configuredTtl = Number(
    process.env.AUTH_REFRESH_COOKIE_TTL_SECONDS ??
      DEFAULT_REFRESH_COOKIE_TTL_SECONDS,
  );

  if (!Number.isFinite(configuredTtl) || configuredTtl <= 0) {
    return DEFAULT_REFRESH_COOKIE_TTL_SECONDS;
  }

  return Math.floor(configuredTtl);
}

export async function saveAuthTokens(
  tokens: DirectusAuthTokens,
): Promise<void> {
  const cookieStore = await cookies();
  const accessMaxAge = Math.max(Math.floor(tokens.expires / 1000) - 30, 60);
  const secure = isProduction();

  cookieStore.set(ACCESS_COOKIE_NAME, tokens.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
    priority: "high",
  });

  cookieStore.set(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: LEGACY_REFRESH_COOKIE_PATH,
    maxAge: 0,
  });

  cookieStore.set(REFRESH_COOKIE_NAME, tokens.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: getRefreshCookieTtl(),
    priority: "high",
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  const secure = isProduction();

  cookieStore.set(ACCESS_COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  cookieStore.set(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  cookieStore.set(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: LEGACY_REFRESH_COOKIE_PATH,
    maxAge: 0,
  });
}

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE_NAME)?.value ?? null;
}

export const getCurrentUser = cache(
  async (): Promise<DirectusCurrentUser | null> => {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return null;
    }

    try {
      return await getDirectusCurrentUser(accessToken);
    } catch (error) {
      if (error instanceof DirectusAuthError && error.status === 401) {
        return null;
      }

      throw error;
    }
  },
);

export async function requireCurrentUser({
  locale,
  nextPath,
}: {
  locale: AppLocale;
  nextPath: string;
}): Promise<DirectusCurrentUser> {
  const user = await getCurrentUser();

  if (user) {
    return user;
  }

  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    const refreshUrl = new URL("/api/auth/refresh", "http://localhost");
    refreshUrl.searchParams.set("next", nextPath);
    refreshUrl.searchParams.set("locale", locale);
    redirect(`${refreshUrl.pathname}${refreshUrl.search}`);
  }

  const loginUrl = new URL(`/${locale}/login`, "http://localhost");
  loginUrl.searchParams.set("next", nextPath);
  redirect(`${loginUrl.pathname}${loginUrl.search}`);
}
