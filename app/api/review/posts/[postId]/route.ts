import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";
import { getDirectusCurrentUser, getDirectusCurrentUserPermissions, hasListingReviewAccess } from "@/lib/directus-auth";
import { decideListingPost } from "@/lib/directus-growth";
import { sendPostDecisionNotification } from "@/lib/mail";

async function notifyCustomer(
  accessToken: string,
  postId: string,
  action: "approve" | "reject",
): Promise<void> {
  try {
    await sendPostDecisionNotification(accessToken, { postId, action });
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
  const body = (await request.json().catch(() => null)) as { action?: string; reason?: string } | null;
  if (!body || !["approve", "reject"].includes(body.action ?? "")) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  if (body.action === "reject" && (body.reason?.trim().length ?? 0) < 3) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }
  const user = await getDirectusCurrentUser(accessToken);
  const { postId } = await params;
  const action = body.action as "approve" | "reject";
  await decideListingPost(accessToken, postId, user.id, action, body.reason?.trim() ?? "");
  await notifyCustomer(accessToken, postId, action);
  return NextResponse.json({ success: true });
}
