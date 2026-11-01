import { getAccessToken, getRefreshToken, saveAuthTokens } from "@/lib/auth";
import { refreshDirectusSession } from "@/lib/directus-auth";

async function handle(request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const suffix = path[0] || "";
  if (path.length > 1 || (suffix && suffix !== "manage" && !/^[0-9a-f-]{36}$/i.test(suffix))) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin) return Response.json({ error: "forbidden" }, { status: 403 });
    if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "invalid_data" }, { status: 415 });
  }
  try {
    let token = await getAccessToken();
    const target = new URL(`/findelio-review-notification/customer-reviews${suffix ? `/${suffix}` : ""}`, process.env.DIRECTUS_URL);
    const search = new URL(request.url).searchParams;
    for (const key of ["listing", "page", "summary"]) if (search.has(key)) target.searchParams.set(key, search.get(key)!);
    const body = request.method === "GET" ? undefined : await request.text();
    if (body && body.length > 16000) return Response.json({ error: "invalid_data" }, { status: 413 });
    const send = () => fetch(target, { method: request.method, body, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, cache: "no-store" });
    if (!token) {
      const refresh = await getRefreshToken();
      if (refresh) {
        try { const tokens = await refreshDirectusSession(refresh); await saveAuthTokens(tokens); token = tokens.access_token; } catch { /* Public reviews remain available. */ }
      }
    }
    let response = await send();
    if (response.status === 401 && token) {
      const refresh = await getRefreshToken();
      if (refresh) {
        const tokens = await refreshDirectusSession(refresh);
        await saveAuthTokens(tokens);
        token = tokens.access_token;
        response = await send();
      }
    }
    const data = await response.json();
    return Response.json(data, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
export { handle as GET, handle as POST, handle as PATCH };
