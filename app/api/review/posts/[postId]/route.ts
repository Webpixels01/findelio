import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";
import { getDirectusCurrentUserPermissions, hasListingReviewAccess } from "@/lib/directus-auth";
import { DirectusAccountError } from "@/lib/directus-account";
import { decideListingPost } from "@/lib/directus-growth";
import { sendPostDecisionNotification } from "@/lib/mail";

async function notifyCustomer(
  accessToken: string,
  postId: string,
  action: "approve" | "reject",
  reason: string,
): Promise<void> {
  try {
    await sendPostDecisionNotification(accessToken, {
      postId,
      action,
      ...(reason ? { reason } : {}),
    });
  } catch (error) {
    console.error("Beitragsentscheidung konnte nicht an den Kunden gesendet werden:", error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const accessToken = await getAccessToken();
  if (!accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const permissions = await getDirectusCurrentUserPermissions(accessToken);
  if (!hasListingReviewAccess(permissions)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { action?: string; reason?: string; reviewVersion?: number } | null;
  if (!body || !["approve", "reject"].includes(body.action ?? "")) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  if (typeof body.reviewVersion !== "number" || !Number.isSafeInteger(body.reviewVersion) || body.reviewVersion < 1) return NextResponse.json({ error: "invalid_version" }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length > 2000) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }
  if (body.action === "reject" && reason.length < 3) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }
  const { postId } = await params;
  const action = body.action as "approve" | "reject";
  try {
    await decideListingPost(accessToken, postId, body.reviewVersion, action, reason);
  } catch (error) {
    if (error instanceof DirectusAccountError) return NextResponse.json({ error: "action_failed" }, { status: error.status >= 400 && error.status <= 599 ? error.status : 500 });
    throw error;
  }
  await notifyCustomer(accessToken, postId, action, reason);
  return NextResponse.json({ success: true });
}
