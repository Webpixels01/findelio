import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";
import { getDirectusCurrentUser } from "@/lib/directus-auth";
import { DirectusAccountError } from "@/lib/directus-account";
import {
  archiveAccountListingPost,
  type ListingPostInput,
  updateAccountListingPost,
} from "@/lib/directus-growth";
import { sendPostReviewNotification } from "@/lib/mail";

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = new URL(value.trim());
  if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) throw new Error();
  return url.toString();
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; postId: string }> }) {
  const accessToken = await getAccessToken();
  if (!accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id, postId } = await params;
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (!body || body.action === "archive") {
      await archiveAccountListingPost(accessToken, id, postId);
      return NextResponse.json({ success: true });
    }

    if (body.action !== "update") {
      return NextResponse.json({ error: "invalid_data" }, { status: 400 });
    }

    const text = (key: string, max: number) => typeof body[key] === "string" ? body[key].trim().slice(0, max) : "";
    let ctaUrl: string | null;
    try { ctaUrl = normalizeUrl(body.cta_url); } catch { return NextResponse.json({ error: "invalid_data" }, { status: 400 }); }
    const input: ListingPostInput = {
      type: body.type === "offer" || body.type === "event" ? body.type : "update",
      status: body.status === "draft" ? "draft" : "pending",
      title: text("title", 180),
      body: text("body", 10000) || null,
      image: text("image", 36) || null,
      cta_label: text("cta_label", 80) || null,
      cta_url: ctaUrl,
      starts_at: text("starts_at", 40) || null,
      ends_at: text("ends_at", 40) || null,
    };
    if (!input.title || Boolean(input.cta_label) !== Boolean(input.cta_url)) {
      return NextResponse.json({ error: "invalid_data" }, { status: 400 });
    }

    const user = await getDirectusCurrentUser(accessToken);
    const savedPostId = await updateAccountListingPost(accessToken, id, postId, user.id, input);
    if (input.status === "pending") {
      try {
        await sendPostReviewNotification(accessToken, savedPostId);
      } catch (error) {
        console.error("Beitragsbenachrichtigung konnte nicht gesendet werden:", error);
      }
    }
    return NextResponse.json({ success: true, postId: savedPostId });
  } catch (error) {
    const statusCode = error instanceof DirectusAccountError ? error.status : 500;
    return NextResponse.json(
      { error: statusCode === 403 ? "premium_required" : "save_failed" },
      { status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 },
    );
  }
}
