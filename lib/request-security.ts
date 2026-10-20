import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export type RequestLimitScope =
  | "login-ip" | "login-account" | "upload";

export function requestIdentity(request: Request, identity?: string): string {
  // Both supported ingress proxies append/overwrite the last XFF entry.
  // The application port must only be reachable through the ingress proxy.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const address = forwarded && isIP(forwarded) ? forwarded : "unknown";
  const secret = process.env.DIRECTUS_TOKEN;
  if (!secret) throw new Error("DIRECTUS_TOKEN fehlt.");
  return createHmac("sha256", secret).update(identity ?? address).digest("hex");
}

/** Uses atomic database counters in Directus, shared across app instances. */
export async function enforceRequestLimit(
  request: Request,
  scope: RequestLimitScope,
  identity?: string,
): Promise<Response | null> {
  try {
    const response = await fetch(
      new URL("/findelio-review-notification/rate-limit", process.env.DIRECTUS_URL),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scope, client_key: requestIdentity(request, identity) }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.ok) return null;
    if (response.status === 429) {
      return Response.json({ error: "rate_limited" }, {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": response.headers.get("retry-after") ?? "900" },
      });
    }
  } catch {
    // An unavailable limiter must not silently permit unlimited attempts.
  }
  return Response.json({ error: "temporarily_unavailable" }, {
    status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" },
  });
}
