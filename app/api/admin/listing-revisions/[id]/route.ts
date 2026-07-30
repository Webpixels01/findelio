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
  approveListingRevision,
  DirectusReviewError,
  rejectListingRevision,
  suspendListingFromRevision,
} from "@/lib/directus-review";
import { sendListingDecisionNotification } from "@/lib/mail";

type ReviewAction = "approve" | "reject" | "suspend";

const actions = new Set<ReviewAction>(["approve", "reject", "suspend"]);

function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  return (
    origin ===
    new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin
  );
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

async function runAction(
  accessToken: string,
  revisionId: string,
  action: ReviewAction,
  reason: string,
): Promise<void> {
  const [user, permissions] = await Promise.all([
    getDirectusCurrentUser(accessToken),
    getDirectusCurrentUserPermissions(accessToken),
  ]);

  if (!hasListingReviewAccess(permissions)) {
    throw new DirectusReviewError("Keine Berechtigung.", 403, "FORBIDDEN");
  }

  if (action === "approve") {
    await approveListingRevision(accessToken, revisionId, user.id);
    return;
  }

  if (!reason || reason.length < 3 || reason.length > 2000) {
    throw new DirectusReviewError(
      "Eine Begründung ist erforderlich.",
      400,
      "INVALID_REASON",
    );
  }

  if (action === "reject") {
    await rejectListingRevision(accessToken, revisionId, user.id, reason);
    return;
  }

  await suspendListingFromRevision(accessToken, revisionId, user.id, reason);
}

async function notifyCustomer(
  accessToken: string,
  revisionId: string,
  action: ReviewAction,
  reason: string,
): Promise<void> {
  try {
    await sendListingDecisionNotification(accessToken, {
      revisionId,
      action,
      ...(reason ? { reason } : {}),
    });
  } catch (error) {
    console.error(
      "Kundenbenachrichtigung konnte nicht gesendet werden:",
      error,
    );
  }
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
  const revisionId = id.trim();

  if (!revisionId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const action = typeof data.action === "string" ? data.action : "";
  const reason = typeof data.reason === "string" ? data.reason.trim() : "";

  if (!actions.has(action as ReviewAction)) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }
  const reviewAction = action as ReviewAction;

  let accessToken = await getAccessToken();

  if (!accessToken) {
    accessToken = await refreshAccessToken();
  }

  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await runAction(accessToken, revisionId, reviewAction, reason);
    await notifyCustomer(
      accessToken,
      revisionId,
      reviewAction,
      reason,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DirectusReviewError && error.status === 401) {
      const refreshedToken = await refreshAccessToken();

      if (refreshedToken) {
        try {
          await runAction(
            refreshedToken,
            revisionId,
            reviewAction,
            reason,
          );
          await notifyCustomer(
            refreshedToken,
            revisionId,
            reviewAction,
            reason,
          );
          return NextResponse.json({ success: true });
        } catch (retryError) {
          error = retryError;
        }
      }
    }

    if (error instanceof DirectusReviewError) {
      console.error("Prüfaktion fehlgeschlagen:", error);
      return NextResponse.json(
        { error: error.code === "INVALID_REASON" ? "invalid_reason" : "action_failed" },
        { status: error.status >= 400 && error.status < 600 ? error.status : 500 },
      );
    }

    console.error("Prüfaktion fehlgeschlagen:", error);
    return NextResponse.json({ error: "action_failed" }, { status: 500 });
  }
}
