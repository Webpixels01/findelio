import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth";
import {
  cancelDeletionRequest,
  createDeletionRequest,
  DirectusDeletionError,
  type DeletionEntityType,
} from "@/lib/directus-deletion";
import { refreshDirectusSession } from "@/lib/directus-auth";
import { routing } from "@/i18n/routing";

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

async function withAccessToken<T>(
  action: (accessToken: string) => Promise<T>,
): Promise<T> {
  let accessToken = await getAccessToken();
  if (!accessToken) accessToken = await refreshAccessToken();
  if (!accessToken) {
    throw new DirectusDeletionError("unauthorized", 401, "unauthorized");
  }

  try {
    return await action(accessToken);
  } catch (error) {
    if (!(error instanceof DirectusDeletionError) || error.status !== 401) {
      throw error;
    }
    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) throw error;
    return action(refreshedToken);
  }
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof DirectusDeletionError) {
    return NextResponse.json(
      { error: error.code },
      {
        status: error.status >= 400 && error.status < 600 ? error.status : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  console.error("Löschanfrage fehlgeschlagen:", error);
  return NextResponse.json({ error: "unknown" }, { status: 500 });
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_data" }, { status: 415 });
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const entityType =
    body?.entity_type === "listing" || body?.entity_type === "organization"
      ? body.entity_type
      : null;
  const targetId = typeof body?.target_id === "string" ? body.target_id.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const locale = typeof body?.locale === "string" ? body.locale.trim() : "";

  if (
    !entityType ||
    !uuidPattern.test(targetId) ||
    reason.length > 2000 ||
    !routing.locales.includes(locale as (typeof routing.locales)[number])
  ) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  try {
    const data = await withAccessToken((accessToken) =>
      createDeletionRequest(accessToken, {
        entity_type: entityType as DeletionEntityType,
        target_id: targetId,
        reason,
        locale,
      }),
    );
    return NextResponse.json(
      { success: true, data },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_data" }, { status: 415 });
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const requestId =
    typeof body?.request_id === "string" ? body.request_id.trim() : "";
  if (!uuidPattern.test(requestId)) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  try {
    await withAccessToken((accessToken) =>
      cancelDeletionRequest(accessToken, requestId),
    );
    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
