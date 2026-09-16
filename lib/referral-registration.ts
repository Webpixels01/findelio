/** Server-side gate. Unset/false keeps referral registration inactive. */
export function isReferralRegistrationEnabled(): boolean {
  return (
    process.env.FINDELIO_REFERRAL_REGISTRATION_ENABLED?.trim().toLowerCase() ===
    "true"
  );
}

export function normalizeReferralCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

export function isValidReferralCodeFormat(code: string): boolean {
  return code.length >= 3 && code.length <= 64;
}
