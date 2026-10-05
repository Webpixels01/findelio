import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const directusUrl = process.env.DIRECTUS_URL?.trim();

  if (!directusUrl) {
    return NextResponse.json(
      { status: "unhealthy" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch(new URL("/server/ping", directusUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) throw new Error("Directus is unavailable");

    return NextResponse.json(
      { status: "healthy" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unhealthy" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
