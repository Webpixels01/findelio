import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getRefreshToken,
} from "@/lib/auth";
import { logoutDirectusSession } from "@/lib/directus-auth";

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
    return NextResponse.json(
      { error: "Ungültige Anfrage." },
      { status: 403 },
    );
  }

  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    try {
      await logoutDirectusSession(refreshToken);
    } catch (error) {
      console.warn("Directus-Logout konnte nicht bestätigt werden:", error);
    }
  }

  await clearAuthCookies();

  return NextResponse.json(
    { success: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
