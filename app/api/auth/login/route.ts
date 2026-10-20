import { NextResponse } from "next/server";
import { saveAuthTokens } from "@/lib/auth";
import { readJsonObject, RequestBodyError, stringValue } from "@/lib/request-body";
import { enforceRequestLimit } from "@/lib/request-security";
import {
  DirectusAuthError,
  loginWithDirectus,
} from "@/lib/directus-auth";

function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const expectedOrigin = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? request.url,
  ).origin;

  return origin === expectedOrigin;
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json(
      { error: "Ungültige Anfrage." },
      { status: 403 },
    );
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json(
      { error: "Ungültiges Datenformat." },
      { status: 415 },
    );
  }

  try {
    const limited = await enforceRequestLimit(request, "login-ip");
    if (limited) return limited;
    const { email, password } = await readJsonObject(request);
    const normalizedEmail = stringValue(email).toLowerCase();

    if (!normalizedEmail || normalizedEmail.length > 254 ||
        typeof password !== "string" || !password || password.length > 1024) {
      return NextResponse.json(
        { error: "E-Mail-Adresse und Passwort sind erforderlich." },
        { status: 400 },
      );
    }

    const accountLimited = await enforceRequestLimit(request, "login-account", normalizedEmail);
    if (accountLimited) return accountLimited;
    const tokens = await loginWithDirectus(normalizedEmail, password);
    await saveAuthTokens(tokens);

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: error.status });
    }
    if (error instanceof DirectusAuthError) {
      if (error.status === 429 || error.status === 503) {
        return NextResponse.json({ error: "rate_limited" }, {
          status: error.status, headers: { "Cache-Control": "no-store", "Retry-After": "900" },
        });
      }
      console.warn("Directus-Login abgelehnt:", error.code ?? error.status);

      return NextResponse.json(
        { error: "E-Mail-Adresse oder Passwort ist falsch." },
        { status: 401 },
      );
    }

    console.error("Login fehlgeschlagen:", error);

    return NextResponse.json(
      { error: "Die Anmeldung konnte nicht verarbeitet werden." },
      { status: 500 },
    );
  }
}
