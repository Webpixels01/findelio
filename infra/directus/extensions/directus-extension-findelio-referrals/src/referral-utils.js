function isReferralRegistrationEnabled(env) {
  return (
    String(env?.FINDELIO_REFERRAL_REGISTRATION_ENABLED ?? "")
      .trim()
      .toLowerCase() === "true"
  );
}

function normalizeReferralCode(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

function normalizeEmail(email) {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

function isUrlAllowed(url, allowList) {
  if (!url) return true;
  const allowed = String(allowList ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.some(
    (entry) =>
      url === entry || url.startsWith(`${entry}?`) || url.startsWith(`${entry}/`),
  );
}

/**
 * Existing Directus users must never receive a new referral redemption.
 * @returns {'block_silent' | 'resend_only' | 'create'}
 */
function classifyRegistrationUser(existingUser, hasEmailVerification) {
  if (!existingUser) return "create";
  if (hasEmailVerification && existingUser.status === "unverified") {
    return "resend_only";
  }
  return "block_silent";
}

/**
 * Only treat a verified concurrent registration on directus_users.email
 * as success-equivalent. Missing metadata must not match.
 *
 * Verified shapes (Directus 11.17.4):
 * - UsersService.checkUniqueEmails → RecordNotUniqueError
 *   { collection: 'directus_users', field: 'email' }
 * - Postgres unique_violation translated the same way via
 *   api/src/database/errors/dialects/postgres.ts
 */
function isCompetingEmailRegistrationError(error) {
  if (!error || typeof error !== "object") return false;

  const extensions =
    error.extensions && typeof error.extensions === "object"
      ? error.extensions
      : {};
  const code = error.code ?? extensions.code;
  const collection = extensions.collection ?? error.collection;
  const field = extensions.field ?? error.field;

  if (code !== "RECORD_NOT_UNIQUE") return false;
  if (collection !== "directus_users") return false;
  if (typeof field !== "string" || field.toLowerCase() !== "email") {
    return false;
  }

  return true;
}

/**
 * Apply Directus public_registration_email_filter.
 * Returns true when the email is rejected by the filter.
 */
function emailFailsPublicRegistrationFilter(emailFilter, email, validatePayload) {
  if (!emailFilter) return false;
  if (typeof validatePayload !== "function") {
    // Fail closed if the Directus helper is unavailable at runtime.
    return true;
  }
  return validatePayload(emailFilter, { email }).length !== 0;
}

export {
  isReferralRegistrationEnabled,
  normalizeReferralCode,
  normalizeEmail,
  isUrlAllowed,
  classifyRegistrationUser,
  isCompetingEmailRegistrationError,
  emailFailsPublicRegistrationFilter,
};
