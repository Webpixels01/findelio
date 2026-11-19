import "server-only";
import { NextResponse } from "next/server";
import { getAccessToken, getRefreshToken, saveAuthTokens } from "@/lib/auth";
import { refreshDirectusSession } from "@/lib/directus-auth";
import { isReferralRegistrationEnabled } from "@/lib/referral-registration";

export async function referralAdminRequest(token: string, path: string, init: RequestInit = {}) {
  const url = process.env.DIRECTUS_URL?.trim();
  if (!url) throw new Error("missing_config");
  return fetch(new URL(`/findelio-referrals/admin/${path}`, url), {
    ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, cache: "no-store",
  });
}

export async function canManageReferrals(token: string): Promise<boolean> {
  if (!isReferralRegistrationEnabled()) return false;
  try { return (await referralAdminRequest(token, "access")).ok; } catch { return false; }
}

export async function proxyReferralAdmin(request: Request, path: string, method: "GET" | "POST" | "PATCH") {
  if (!isReferralRegistrationEnabled()) return NextResponse.json({ error: "feature_disabled" }, { status: 503 });
  const origin = request.headers.get("origin");
  if (method !== "GET" && origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (method !== "GET" && !request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_data" }, { status: 415 });
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
  let body: string | undefined;
  if (method !== "GET") {
    try { body = JSON.stringify(await request.json()); }
    catch { return NextResponse.json({ error: "invalid_data" }, { status: 400 }); }
    if (body.length > 10000) return NextResponse.json({ error: "invalid_data" }, { status: 413 });
  }
  try {
    let token = await getAccessToken() ?? await refresh();
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    let response = await referralAdminRequest(token, path, { method, body });
    if (response.status === 401) {
      token = await refresh();
      if (token) response = await referralAdminRequest(token, path, { method, body });
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const allowed = ["feature_disabled", "forbidden", "unauthorized", "invalid_data", "code_exists", "not_found"];
      return NextResponse.json({ error: allowed.includes(data?.error) ? data.error : "request_failed" }, { status: response.status >= 400 && response.status < 600 ? response.status : 500 });
    }
    return NextResponse.json({ data: data.data }, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "request_failed" }, { status: 500 }); }
}
