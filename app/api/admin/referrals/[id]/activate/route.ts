import { NextResponse } from "next/server";
import { getAccessToken, getRefreshToken, saveAuthTokens } from "@/lib/auth";
import { refreshDirectusSession } from "@/lib/directus-auth";
import { isReferralRegistrationEnabled } from "@/lib/referral-registration";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isReferralRegistrationEnabled()) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 503 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }
  async function refresh() {
    const token = await getRefreshToken();
    if (!token) return null;
    try {
      const session = await refreshDirectusSession(token);
      await saveAuthTokens(session);
      return session.access_token;
    } catch { return null; }
  }
  try {
    let token = await getAccessToken() ?? await refresh();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const url = process.env.DIRECTUS_URL?.trim();
    if (!url) throw new Error("missing_config");
    const activate = (accessToken: string) => fetch(new URL("/findelio-referrals/activate", url), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ redemption_id: id }), cache: "no-store",
    });
    // Directus enforces an explicit admin policy, independently of Next/review rights.
    let response = await activate(token);
    if (response.status === 401) {
      token = await refresh();
      if (token) response = await activate(token);
    }
    if (!response.ok) {
      const status = [401, 403, 404, 409, 503].includes(response.status) ? response.status : 500;
      return NextResponse.json({ error: status === 403 ? "forbidden" : "activation_failed" }, { status });
    }
    const body = await response.json();
    return NextResponse.json({ data: body.data });
  } catch {
    return NextResponse.json({ error: "activation_failed" }, { status: 500 });
  }
}
