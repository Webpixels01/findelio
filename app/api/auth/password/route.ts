import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { readJsonObject, RequestBodyError, stringValue } from "@/lib/request-body";
import { enforceRequestLimit } from "@/lib/request-security";
import { clearAuthCookies } from "@/lib/auth";

const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site || request.headers.get("origin") !== new URL(site).origin) return reply({ error: "forbidden" }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply({ error: "invalid" }, 415);
  try {
    const body = await readJsonObject(request);
    if (body.action !== "request" && body.action !== "reset") return reply({ error: "invalid" }, 400);
    const limited = await enforceRequestLimit(request, body.action === "request" ? "password-email-ip" : "password-reset");
    if (limited) return limited;
    let payload: object;
    if (body.action === "request") {
      const email = stringValue(body.email).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !hasLocale(routing.locales, body.locale)) return reply({ error: "invalid" }, 400);
      const accountLimited = await enforceRequestLimit(request, "password-email-account", email);
      if (accountLimited) return accountLimited;
      payload = { email, reset_url: new URL(`/${body.locale}/passwort-zuruecksetzen`, site).toString() };
    } else {
      const token = stringValue(body.token);
      const password = body.password;
      if (!token || token.length > 4096) return reply({ error: "invalidToken" }, 400);
      if (typeof password !== "string" || password.length < 8 || password.length > 1024 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) return reply({ error: "passwordError" }, 400);
      payload = { token, password };
    }
    const response = await fetch(new URL(`/auth/password/${body.action}`, process.env.DIRECTUS_URL), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (response.status === 429) return reply({ error: "rateLimited" }, 429);
      const result = await response.json().catch(() => null);
      const code = result?.errors?.[0]?.extensions?.code;
      if (body.action === "reset") {
        if (code === "FAILED_VALIDATION") return reply({ error: "passwordError" }, 400);
        if (["INVALID_TOKEN", "TOKEN_EXPIRED", "INVALID_CREDENTIALS", "FORBIDDEN"].includes(code)) return reply({ error: "invalidToken" }, 400);
      }
      // Never disclose whether an email address has an account.
      if (body.action !== "request" || !["INVALID_CREDENTIALS", "RECORD_NOT_FOUND"].includes(code)) return reply({ error: "error" }, 503);
    }
    if (body.action === "reset") await clearAuthCookies();
    return reply({ success: true });
  } catch (error) {
    return reply({ error: "error" }, error instanceof RequestBodyError ? error.status : 503);
  }
}
