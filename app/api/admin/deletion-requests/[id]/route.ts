import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth";
import {
  decideDeletionRequest,
  DirectusDeletionError,
} from "@/lib/directus-deletion";
import {
  getDirectusCurrentUserPermissions,
  hasListingReviewAccess,
  refreshDirectusSession,
} from "@/lib/directus-auth";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function runDecision(
  accessToken: string,
  requestId: string,
  action: "approve" | "reject",
  note: string,
) {
  const permissions = await getDirectusCurrentUserPermissions(accessToken);
  if (!hasListingReviewAccess(permissions)) {
    throw new DirectusDeletionError("forbidden", 403, "forbidden");
  }
  return decideDeletionRequest(accessToken, requestId, action, note);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_data" }, { status: 415 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const action =
    body?.action === "approve" || body?.action === "reject"
      ? body.action
      : null;
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  if (
    !uuidPattern.test(id) ||
    !action ||
    note.length > 2000 ||
    (action === "reject" && note.length < 3)
  ) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  let accessToken = await getAccessToken();
  if (!accessToken) accessToken = await refreshAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await runDecision(accessToken, id, action, note);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DirectusDeletionError && error.status === 401) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        try {
          await runDecision(refreshedToken, id, action, note);
          return NextResponse.json({ success: true });
        } catch (retryError) {
          error = retryError;
        }
      }
    }

    if (error instanceof DirectusDeletionError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Löschanfrage konnte nicht entschieden werden:", error);
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
}
