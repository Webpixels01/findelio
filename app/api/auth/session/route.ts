import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth";
import {
  DirectusAuthError,
  getDirectusCurrentUser,
  refreshDirectusSession,
} from "@/lib/directus-auth";

export async function GET() {
  let accessToken = await getAccessToken();

  try {
    if (!accessToken) {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        return NextResponse.json({ user: null }, { status: 401 });
      }

      const tokens = await refreshDirectusSession(refreshToken);
      await saveAuthTokens(tokens);
      accessToken = tokens.access_token;
    }

    const user = await getDirectusCurrentUser(accessToken);

    return NextResponse.json(
      { user },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (!(error instanceof DirectusAuthError)) {
      console.error("Sitzung konnte nicht gelesen werden:", error);
    }

    await clearAuthCookies();
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
