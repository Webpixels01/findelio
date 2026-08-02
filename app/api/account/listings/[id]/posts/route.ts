import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";
import { getDirectusCurrentUser } from "@/lib/directus-auth";
import { createAccountListingPost, type ListingPostInput } from "@/lib/directus-growth";
import { DirectusAccountError } from "@/lib/directus-account";
import { sendPostReviewNotification } from "@/lib/mail";

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = new URL(value.trim());
  if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) throw new Error();
  return url.toString();
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accessToken = await getAccessToken();
  if (!accessToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  const text = (key: string, max: number) => typeof body[key] === "string" ? body[key].trim().slice(0, max) : "";
  const type = body.type;
  const status = body.status;
  let ctaUrl: string | null;
  try { ctaUrl = normalizeUrl(body.cta_url); } catch { return NextResponse.json({ error: "invalid_data" }, { status: 400 }); }
  const input: ListingPostInput = {
    type: type === "offer" || type === "event" ? type : "update",
    status: status === "draft" ? "draft" : "pending",
    title: text("title", 180),
    excerpt: text("excerpt", 500) || null,
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
  try {
    const user = await getDirectusCurrentUser(accessToken);
    const { id } = await params;
    const postId = await createAccountListingPost(accessToken, id, user.id, input);
    if (input.status === "pending") {
      try {
        await sendPostReviewNotification(accessToken, postId);
      } catch (error) {
        console.error("Beitragsbenachrichtigung konnte nicht gesendet werden:", error);
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const statusCode = error instanceof DirectusAccountError ? error.status : 500;
    return NextResponse.json({ error: statusCode === 403 ? "premium_required" : "save_failed" }, { status: statusCode });
  }
}
