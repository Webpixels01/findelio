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
import {
  createPremiumGrant,
  getAdminPremiumListings,
} from "@/lib/directus-premium";

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

async function getAdminToken(): Promise<{ token: string; userId: string } | null> {
  let token = await getAccessToken();
  if (!token) token = await refreshAccessToken();
  if (!token) return null;

  const [user, permissions] = await Promise.all([
    getDirectusCurrentUser(token),
    getDirectusCurrentUserPermissions(token),
  ]);

  if (!hasListingReviewAccess(permissions)) return null;
  return { token, userId: user.id };
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_data" }, { status: 415 });
  }

  const auth = await getAdminToken();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let data: Record<string, unknown>;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") throw new Error();
    data = body as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const listingId = typeof data.listing_id === "string" ? data.listing_id.trim() : "";
  const reason = typeof data.reason === "string" ? data.reason.trim() : "";
  const rawEndsAt = data.ends_at;

  if (!listingId || reason.length < 3 || reason.length > 1000) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  let endsAt: string | null = null;
  if (rawEndsAt !== null && rawEndsAt !== undefined && rawEndsAt !== "") {
    if (typeof rawEndsAt !== "string") {
      return NextResponse.json({ error: "invalid_data" }, { status: 400 });
    }
    const endDate = new Date(rawEndsAt);
    if (Number.isNaN(endDate.getTime()) || endDate <= new Date()) {
      return NextResponse.json({ error: "invalid_end_date" }, { status: 400 });
    }
    endsAt = endDate.toISOString();
  }

  try {
    const listings = await getAdminPremiumListings(auth.token);
    const listing = listings.find((item) => item.id === listingId);
    if (!listing || listing.status === "archived") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (listing.grants.some((grant) => !grant.revoked_at && (!grant.ends_at || new Date(grant.ends_at) > new Date()))) {
      return NextResponse.json({ error: "already_active" }, { status: 409 });
    }

    const grant = await createPremiumGrant({
      listing: listingId,
      grantedBy: auth.userId,
      reason,
      endsAt,
    });
    return NextResponse.json({ success: true, grant });
  } catch (error) {
    console.error("Premium-Freischaltung konnte nicht angelegt werden:", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
