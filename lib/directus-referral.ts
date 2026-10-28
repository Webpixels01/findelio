import "server-only";
import {
  isReferralRegistrationEnabled,
  isValidReferralCodeFormat,
  normalizeReferralCode,
} from "@/lib/referral-registration";

type DirectusErrorBody = {
  error?: string;
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
};

export class DirectusReferralError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "DirectusReferralError";
  }
}

function getDirectusUrl(): string {
  const value = process.env.DIRECTUS_URL?.trim();
  if (!value) {
    throw new Error("DIRECTUS_URL fehlt in der Laufzeitumgebung");
  }
  return value;
}

export async function registerDirectusUserWithReferral({
  firstName,
  lastName,
  email,
  password,
  verificationUrl,
  referralCode,
}: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  verificationUrl: string;
  referralCode: string;
}): Promise<void> {
  if (!isReferralRegistrationEnabled()) {
    throw new DirectusReferralError(
      "Referral-Registrierung ist deaktiviert.",
      503,
      "feature_disabled",
    );
  }

  const normalizedCode = normalizeReferralCode(referralCode);
  if (!isValidReferralCodeFormat(normalizedCode)) {
    throw new DirectusReferralError(
      "Ungültiger Empfehlungscode.",
      400,
      "invalid_referral",
    );
  }

  const response = await fetch(
    new URL("/findelio-referrals/register", getDirectusUrl()),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        verification_url: verificationUrl,
        referral_code: normalizedCode,
      }),
      cache: "no-store",
    },
  );

  if (response.status === 204 || response.ok) {
    return;
  }

  let body: DirectusErrorBody | null = null;
  try {
    body = (await response.json()) as DirectusErrorBody;
  } catch {
    body = null;
  }

  const errorCode = body?.error;
  if (errorCode === "invalid_referral") {
    throw new DirectusReferralError(
      "Ungültiger Empfehlungscode.",
      400,
      "invalid_referral",
    );
  }
  if (errorCode === "feature_disabled") {
    throw new DirectusReferralError(
      "Referral-Registrierung ist deaktiviert.",
      503,
      "feature_disabled",
    );
  }

  throw new DirectusReferralError(
    body?.errors?.[0]?.message ?? "Referral-Registrierung fehlgeschlagen.",
    response.status,
    body?.errors?.[0]?.extensions?.code ?? errorCode,
  );
}
