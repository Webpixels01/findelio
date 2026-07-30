import { NextResponse } from "next/server";
import {
  DirectusAuthError,
  verifyDirectusRegistration,
} from "@/lib/directus-auth";

type VerificationBody = {
  token?: string;
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
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "INVALID_FORMAT" }, { status: 415 });
  }

  try {
    const { token } = (await request.json()) as VerificationBody;
    const normalizedToken = token?.trim();

    if (!normalizedToken || normalizedToken.length > 2048) {
      return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
    }

    await verifyDirectusRegistration(normalizedToken);

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
      console.warn(
        "Registrierungsbestätigung abgelehnt:",
        error.code ?? error.status,
      );

      return NextResponse.json(
        { error: "INVALID_TOKEN" },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    console.error("Registrierungsbestätigung fehlgeschlagen:", error);

    return NextResponse.json(
      { error: "SERVER_ERROR" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
