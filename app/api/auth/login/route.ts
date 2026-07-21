import { NextResponse } from "next/server";
import { saveAuthTokens } from "@/lib/auth";
import {
  DirectusAuthError,
  loginWithDirectus,
} from "@/lib/directus-auth";

type LoginBody = {
  email?: string;
  password?: string;
};

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
    const { email, password } = (await request.json()) as LoginBody;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: "E-Mail-Adresse und Passwort sind erforderlich." },
        { status: 400 },
      );
    }

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
    if (error instanceof DirectusAuthError) {
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
