import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyRegistrationUser,
  emailFailsPublicRegistrationFilter,
  isCompetingEmailRegistrationError,
  isReferralRegistrationEnabled,
  isUrlAllowed,
  normalizeReferralCode,
} from "./referral-utils.js";

test("extension feature flag defaults to disabled without touching collections", () => {
  assert.equal(isReferralRegistrationEnabled({}), false);
  assert.equal(
    isReferralRegistrationEnabled({
      FINDELIO_REFERRAL_REGISTRATION_ENABLED: "false",
    }),
    false,
  );
  assert.equal(
    isReferralRegistrationEnabled({
      FINDELIO_REFERRAL_REGISTRATION_ENABLED: "true",
    }),
    true,
  );
});

test("extension normalizes codes by trimming", () => {
  assert.equal(normalizeReferralCode("  CODE  "), "CODE");
});

test("existing users never classify as create for redemption", () => {
  assert.equal(classifyRegistrationUser(null, true), "create");
  assert.equal(
    classifyRegistrationUser({ status: "unverified" }, true),
    "resend_only",
  );
  assert.equal(
    classifyRegistrationUser({ status: "active" }, true),
    "block_silent",
  );
  assert.equal(
    classifyRegistrationUser({ status: "unverified" }, false),
    "block_silent",
  );
});

test("verification URL allow-list rejects foreign hosts", () => {
  const allow = "http://localhost:3000/de-ch/registrierung-bestaetigen";
  assert.equal(
    isUrlAllowed("http://localhost:3000/de-ch/registrierung-bestaetigen", allow),
    true,
  );
  assert.equal(
    isUrlAllowed("https://evil.example/de-ch/registrierung-bestaetigen", allow),
    false,
  );
});

test("confirmed email unique conflict is success-equivalent", () => {
  assert.equal(
    isCompetingEmailRegistrationError({
      code: "RECORD_NOT_UNIQUE",
      extensions: { collection: "directus_users", field: "email", value: "a@b.c" },
      message:
        'Value "a@b.c" for field "email" in collection "directus_users" has to be unique.',
    }),
    true,
  );
});

test("RECORD_NOT_UNIQUE without metadata is not success-equivalent", () => {
  assert.equal(
    isCompetingEmailRegistrationError({
      code: "RECORD_NOT_UNIQUE",
      message: 'Value for field "email" in collection "directus_users" has to be unique.',
    }),
    false,
  );
  assert.equal(
    isCompetingEmailRegistrationError({
      code: "RECORD_NOT_UNIQUE",
      extensions: {},
    }),
    false,
  );
  assert.equal(
    isCompetingEmailRegistrationError({
      code: "RECORD_NOT_UNIQUE",
      extensions: { field: "email" },
    }),
    false,
  );
  assert.equal(
    isCompetingEmailRegistrationError({
      code: "RECORD_NOT_UNIQUE",
      extensions: { collection: "directus_users" },
    }),
    false,
  );
});

test("referral_redemptions unique conflict is not success-equivalent", () => {
  assert.equal(
    isCompetingEmailRegistrationError({
      code: "RECORD_NOT_UNIQUE",
      extensions: { collection: "referral_redemptions", field: "user" },
      message: 'Value for field "user" has to be unique.',
    }),
    false,
  );
});

test("unique conflict on another user field is not success-equivalent", () => {
  assert.equal(
    isCompetingEmailRegistrationError({
      code: "RECORD_NOT_UNIQUE",
      extensions: {
        collection: "directus_users",
        field: "external_identifier",
      },
    }),
    false,
  );
});

test("other database errors are not success-equivalent", () => {
  assert.equal(
    isCompetingEmailRegistrationError({
      code: "23505",
      table: "directus_users",
      detail: "Key (email)=(a@b.c) already exists.",
      message: "duplicate key value violates unique constraint",
    }),
    false,
  );
  assert.equal(
    isCompetingEmailRegistrationError({
      message: "connection terminated unexpectedly",
    }),
    false,
  );
  assert.equal(
    isCompetingEmailRegistrationError({
      code: "23503",
      extensions: { collection: "directus_users", field: "role" },
    }),
    false,
  );
});

test("email filter fails closed without validatePayload helper", () => {
  assert.equal(
    emailFailsPublicRegistrationFilter({ email: { _contains: "@" } }, "a@b.c"),
    true,
  );
  assert.equal(
    emailFailsPublicRegistrationFilter(null, "a@b.c", () => []),
    false,
  );
  assert.equal(
    emailFailsPublicRegistrationFilter(
      { email: { _ends_with: "example.com" } },
      "user@blocked.test",
      () => [{ path: ["email"] }],
    ),
    true,
  );
});
