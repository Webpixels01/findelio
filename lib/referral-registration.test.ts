import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isReferralRegistrationEnabled,
  isValidReferralCodeFormat,
  normalizeReferralCode,
} from "./referral-registration.ts";

test("feature flag defaults to disabled without env", () => {
  const previous = process.env.FINDELIO_REFERRAL_REGISTRATION_ENABLED;
  delete process.env.FINDELIO_REFERRAL_REGISTRATION_ENABLED;
  assert.equal(isReferralRegistrationEnabled(), false);

  process.env.FINDELIO_REFERRAL_REGISTRATION_ENABLED = "true";
  assert.equal(isReferralRegistrationEnabled(), true);

  process.env.FINDELIO_REFERRAL_REGISTRATION_ENABLED = "false";
  assert.equal(isReferralRegistrationEnabled(), false);

  if (previous === undefined) {
    delete process.env.FINDELIO_REFERRAL_REGISTRATION_ENABLED;
  } else {
    process.env.FINDELIO_REFERRAL_REGISTRATION_ENABLED = previous;
  }
});

test("normalizeReferralCode trims outer whitespace", () => {
  assert.equal(normalizeReferralCode("  AbC12  "), "AbC12");
  assert.equal(normalizeReferralCode(""), "");
  assert.equal(normalizeReferralCode(null), "");
});

test("referral code format rejects empty and oversized values", () => {
  assert.equal(isValidReferralCodeFormat(""), false);
  assert.equal(isValidReferralCodeFormat("ab"), false);
  assert.equal(isValidReferralCodeFormat("abc"), true);
  assert.equal(isValidReferralCodeFormat("a".repeat(64)), true);
  assert.equal(isValidReferralCodeFormat("a".repeat(65)), false);
});

test("disabled feature means no referral redemption path is selected", () => {
  const previous = process.env.FINDELIO_REFERRAL_REGISTRATION_ENABLED;
  delete process.env.FINDELIO_REFERRAL_REGISTRATION_ENABLED;
  assert.equal(isReferralRegistrationEnabled(), false);
  // Contract: with the flag off, Next keeps /users/register and must not
  // require referral_* collections to exist.
  if (previous === undefined) {
    delete process.env.FINDELIO_REFERRAL_REGISTRATION_ENABLED;
  } else {
    process.env.FINDELIO_REFERRAL_REGISTRATION_ENABLED = previous;
  }
});
