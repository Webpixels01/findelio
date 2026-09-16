import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  saveAuthTokens,
} from "@/lib/auth";
import {
  createAccountOrganization,
  DirectusAccountError,
} from "@/lib/directus-account";
import {
  DirectusAuthError,
  getDirectusCurrentUser,
  refreshDirectusSession,
} from "@/lib/directus-auth";

type SetupBody = {
  name?: string;
};

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

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const tokens = await refreshDirectusSession(refreshToken);
    await saveAuthTokens(tokens);
    return tokens.access_token;
  } catch {
    await clearAuthCookies();
    return null;
  }
}

async function createOrganizationForUser(accessToken: string, name: string) {
  const user = await getDirectusCurrentUser(accessToken);

  if (user.status !== "active" || user.role?.name !== "Firmenkonto") {
    throw new DirectusAccountError(
      "Das Benutzerkonto darf keine Organisation einrichten.",
      403,
      "FORBIDDEN",
    );
  }

  return createAccountOrganization(accessToken, name);
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_data" }, { status: 415 });
  }

  let body: SetupBody;

  try {
    body = (await request.json()) as SetupBody;
  } catch {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";

  if (!name || name.length > 255) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  let accessToken = await getAccessToken();

  if (!accessToken) {
    accessToken = await refreshAccessToken();
  }

  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const organization = await createOrganizationForUser(accessToken, name);

    return NextResponse.json(
      { success: true, organization: { id: organization.id } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof DirectusAuthError && error.status === 401) {
      const refreshedAccessToken = await refreshAccessToken();

      if (!refreshedAccessToken) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      try {
        const organization = await createOrganizationForUser(
          refreshedAccessToken,
          name,
        );

        return NextResponse.json(
          { success: true, organization: { id: organization.id } },
          { status: 201, headers: { "Cache-Control": "no-store" } },
        );
      } catch (retryError) {
        error = retryError;
      }
    }

    if (error instanceof DirectusAccountError) {
      if (error.status === 409) {
        return NextResponse.json(
          { error: "already_configured" },
          { status: 409 },
        );
      }

      if (error.status === 403) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      console.warn(
        "Organisation konnte nicht eingerichtet werden:",
        error.code ?? error.status,
      );
    } else if (error instanceof DirectusAuthError) {
      await clearAuthCookies();
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    } else {
      console.error("Organisation konnte nicht eingerichtet werden:", error);
    }

    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
