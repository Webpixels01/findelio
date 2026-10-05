import { NextResponse } from "next/server";
import { routing, type AppLocale } from "@/i18n/routing";
import { sendContactNotification } from "@/lib/mail";

type ContactBody = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  subject?: unknown;
  message?: unknown;
  privacyAccepted?: unknown;
  website?: unknown;
  locale?: unknown;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBJECTS = new Set([
  "general",
  "listing",
  "account",
  "partnership",
  "other",
]);
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimits = new Map<string, number[]>();

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

function getClientAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function exceedsRateLimit(address: string): boolean {
  const now = Date.now();
  const recentRequests = (rateLimits.get(address) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimits.set(address, recentRequests);
    return true;
  }

  recentRequests.push(now);
  rateLimits.set(address, recentRequests);
  return false;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isAppLocale(value: unknown): value is AppLocale {
  return (
    typeof value === "string" &&
    routing.locales.includes(value as AppLocale)
  );
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "invalid_format" }, { status: 415 });
  }

  const clientAddress = getClientAddress(request);

  if (exceedsRateLimit(clientAddress)) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "900",
        },
      },
    );
  }

  let body: ContactBody;

  try {
    body = (await request.json()) as ContactBody;
  } catch {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const name = stringValue(body.name);
  const email = stringValue(body.email).toLowerCase();
  const phone = stringValue(body.phone);
  const subject = stringValue(body.subject);
  const message = stringValue(body.message);
  const website = stringValue(body.website);

  if (website) {
    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    !name ||
    name.length > 120 ||
    !email ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    phone.length > 50 ||
    !SUBJECTS.has(subject) ||
    message.length < 20 ||
    message.length > 5000 ||
    body.privacyAccepted !== true
  ) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  try {
    await sendContactNotification({
      name,
      email,
      phone,
      subject,
      message,
      locale: isAppLocale(body.locale) ? body.locale : routing.defaultLocale,
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Kontaktanfrage konnte nicht gesendet werden:", error);

    return NextResponse.json(
      { error: "send_failed" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
