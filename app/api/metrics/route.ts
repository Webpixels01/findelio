import { readJsonObject, RequestBodyError } from "@/lib/request-body";
import { requestIdentity } from "@/lib/request-security";
import { NextResponse } from "next/server";

const metricEvents = new Set([
  "search_impressions",
  "profile_views",
  "website_clicks",
  "phone_clicks",
  "email_clicks",
  "social_clicks",
  "custom_cta_clicks",
  "post_views",
  "post_cta_clicks",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin;
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ success: false }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await readJsonObject(request); } catch (error) {
    return NextResponse.json({ success: false }, { status: error instanceof RequestBodyError ? error.status : 400 });
  }
  const event = typeof body?.event === "string" ? body.event : "";
  const listingIds = Array.isArray(body?.listingIds)
    ? Array.from(new Set(body.listingIds.filter((id): id is string =>
        typeof id === "string" && uuidPattern.test(id),
      ))).slice(0, 50)
    : [];

  if (!metricEvents.has(event) || listingIds.length === 0) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const directusUrl = process.env.DIRECTUS_URL;
  const directusToken = process.env.DIRECTUS_TOKEN;
  if (!directusUrl || !directusToken) {
    return NextResponse.json({ success: false }, { status: 503 });
  }

  try {
    const response = await fetch(new URL("/findelio-review-notification/metrics", directusUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${directusToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ listing_ids: listingIds, event, client_key: requestIdentity(request) }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    return NextResponse.json(
      { success: response.ok },
      { status: response.ok ? 200 : response.status === 429 ? 429 : 502, headers: { "Cache-Control": "no-store", ...(response.status === 429 ? { "Retry-After": "60" } : {}) } },
    );
  } catch {
    return NextResponse.json({ success: false }, { status: 503 });
  }
}
