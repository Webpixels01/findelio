import { NextResponse } from "next/server";
import { clearAuthCookies, getAccessToken } from "@/lib/auth";
import { DirectusAuthError } from "@/lib/directus-auth";
import { readJsonObject, RequestBodyError } from "@/lib/request-body";
import { directusTwoFactor } from "@/lib/two-factor";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  // This cookie-authenticated security endpoint only accepts same-origin JSON.
  if (request.headers.get("origin") !== new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin) {
    return NextResponse.json({ error: "invalid_request" }, { status: 403, headers });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 415, headers });
  }
  try {
    const token = await getAccessToken();
    if (!token) return NextResponse.json({ error: "session_expired" }, { status: 401, headers });
    const { action, password, otp, ticket, backedUp } = await readJsonObject(request);
    if (!["generate", "enable", "disable"].includes(String(action)) ||
      (action !== "enable" && (typeof password !== "string" || !password || password.length > 1024)) ||
      (action !== "generate" && (typeof otp !== "string" || !/^\d{6}$/.test(otp))) ||
      (action === "enable" && (typeof ticket !== "string" || ticket.length > 2048 || backedUp !== true))) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
    }
    const result = await directusTwoFactor(token, { action, password, otp, ticket, backedUp });
    if (action !== "generate") await clearAuthCookies();
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: "invalid_request" }, { status: error.status, headers });
    if (error instanceof DirectusAuthError) {
      const code = error.code;
      const message = code === "INVALID_OTP" ? "invalid_otp" : code === "INVALID_SETUP" ? "expired_setup" :
        code === "TFA_REQUIRED" ? "required" : error.status === 429 ? "rate_limited" :
        code === "TOKEN_EXPIRED" || code === "INVALID_TOKEN" ? "session_expired" :
        code === "INVALID_CREDENTIALS" ? "invalid_password" : "failed";
      return NextResponse.json({ error: message }, { status: error.status, headers: { ...headers, ...(error.status === 429 ? { "Retry-After": "900" } : {}) } });
    }
    console.error("Two-factor operation unavailable");
    return NextResponse.json({ error: "failed" }, { status: 503, headers });
  }
}
