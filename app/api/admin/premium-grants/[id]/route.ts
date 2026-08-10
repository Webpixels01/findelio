import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth";
import {
  getDirectusCurrentUser,
  getDirectusCurrentUserPermissions,
  hasListingReviewAccess,
  refreshDirectusSession,
} from "@/lib/directus-auth";
import { revokePremiumGrant } from "@/lib/directus-premium";

function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  try {
    const tokens = await refreshDirectusSession(refreshToken);
    await saveAuthTokens(tokens);
    return tokens.access_token;
  } catch {
    await clearAuthCookies();
    return null;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let accessToken = await getAccessToken();
  if (!accessToken) accessToken = await refreshAccessToken();
  if (!accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [user, permissions] = await Promise.all([
    getDirectusCurrentUser(accessToken),
    getDirectusCurrentUserPermissions(accessToken),
  ]);
  if (!hasListingReviewAccess(permissions)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id.trim()) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await revokePremiumGrant({ grantId: id.trim(), revokedBy: user.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Premium-Freischaltung konnte nicht widerrufen werden:", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
