import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth";
import {
  acceptTeamInvitation,
  cancelTeamInvitation,
  createTeamInvitation,
  DirectusTeamError,
  removeTeamMember,
  updateTeamMemberRole,
  type ManageableTeamRole,
} from "@/lib/directus-team";
import {
  DirectusAuthError,
  refreshDirectusSession,
} from "@/lib/directus-auth";
import { routing } from "@/i18n/routing";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{40,100}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  return (
    origin ===
    new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin
  );
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const tokens = await refreshDirectusSession(refreshToken);
    await saveAuthTokens(tokens);
    return tokens.access_token;
  } catch (error) {
    if (!(error instanceof DirectusAuthError)) throw error;
    await clearAuthCookies();
    return null;
  }
}

async function performAction(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const action = stringValue(body.action);

  if (action === "invite") {
    const organizationId = stringValue(body.organization_id);
    const email = stringValue(body.email).toLowerCase();
    const role = stringValue(body.role);
    const locale = stringValue(body.locale);

    if (
      !uuidPattern.test(organizationId) ||
      !emailPattern.test(email) ||
      email.length > 254 ||
      !["admin", "editor"].includes(role) ||
      !routing.locales.includes(locale as (typeof routing.locales)[number])
    ) {
      throw new DirectusTeamError("invalid_data", 400, "invalid_data");
    }

    return createTeamInvitation(accessToken, {
      organization_id: organizationId,
      email,
      role: role as ManageableTeamRole,
      locale,
    });
  }

  if (action === "cancel_invitation") {
    const invitationId = stringValue(body.invitation_id);
    if (!uuidPattern.test(invitationId)) {
      throw new DirectusTeamError("invalid_data", 400, "invalid_data");
    }
    await cancelTeamInvitation(accessToken, invitationId);
    return null;
  }

  if (action === "update_role") {
    const memberId = stringValue(body.member_id);
    const role = stringValue(body.role);
    if (!uuidPattern.test(memberId) || !["admin", "editor"].includes(role)) {
      throw new DirectusTeamError("invalid_data", 400, "invalid_data");
    }
    return updateTeamMemberRole(
      accessToken,
      memberId,
      role as ManageableTeamRole,
    );
  }

  if (action === "remove_member") {
    const memberId = stringValue(body.member_id);
    if (!uuidPattern.test(memberId)) {
      throw new DirectusTeamError("invalid_data", 400, "invalid_data");
    }
    await removeTeamMember(accessToken, memberId);
    return null;
  }

  if (action === "accept_invitation") {
    const token = stringValue(body.token);
    if (!tokenPattern.test(token)) {
      throw new DirectusTeamError("invalid_data", 400, "invalid_data");
    }
    return acceptTeamInvitation(accessToken, token);
  }

  throw new DirectusTeamError("invalid_data", 400, "invalid_data");
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_data" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  let accessToken = await getAccessToken();
  if (!accessToken) accessToken = await refreshAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const data = await performAction(
      accessToken,
      body as Record<string, unknown>,
    );
    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof DirectusTeamError && error.status === 401) {
      const refreshedAccessToken = await refreshAccessToken();
      if (!refreshedAccessToken) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      try {
        const data = await performAction(
          refreshedAccessToken,
          body as Record<string, unknown>,
        );
        return NextResponse.json(
          { success: true, data },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch (retryError) {
        error = retryError;
      }
    }

    if (error instanceof DirectusTeamError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error("Teamaktion fehlgeschlagen:", error);
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
}
