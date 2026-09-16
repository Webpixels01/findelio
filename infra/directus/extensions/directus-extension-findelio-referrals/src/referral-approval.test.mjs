import assert from "node:assert/strict";
import { test } from "node:test";
import { activationDecision, hasFullReviewAccess, listingPatch, registerApprovalRoutes } from "./referral-approval.js";
import { referralMailContent } from "../../directus-extension-findelio-review-notification/src/referral-mail.js";

const at = new Date("2026-09-11T10:00:00Z");
const reservation = {
  status: "pending_activation", trial_decision: "eligible", trial_listing: "listing",
  trial_starts_at: at.toISOString(), trial_ends_at: "2026-12-11T11:00:00Z",
};

test("review access must match the existing full-access rule, not partial company permissions", () => {
  const full = { listing_revisions: { read: { access: "full" }, update: { access: "full" } }, listings: { update: { access: "full" } } };
  assert.equal(hasFullReviewAccess(full), true);
  assert.equal(hasFullReviewAccess({}), false);
  for (const [collection, action] of [["listing_revisions", "read"], ["listing_revisions", "update"], ["listings", "update"]]) {
    const partial = structuredClone(full);
    partial[collection][action].access = "partial";
    assert.equal(hasFullReviewAccess(partial), false);
  }
});

test("activation preserves skips and grants, expires the original window, rejects corrupt reservations", () => {
  assert.equal(activationDecision(reservation, null, at), "granted");
  assert.equal(activationDecision(reservation, "active_subscription", at), "skipped_existing_premium");
  assert.equal(activationDecision({ ...reservation, status: "skipped_existing_premium" }, null, at), "skipped_existing_premium");
  assert.equal(activationDecision({ ...reservation, status: "granted", premium_grant: "g" }, null, at), "granted");
  assert.equal(activationDecision(reservation, null, new Date("2027-01-01")), "expired_unactivated");
  assert.throws(() => activationDecision({ ...reservation, trial_listing: null }, null, at), /invalid_reservation/);
});

test("listing patch preserves optional fields and excludes arbitrary revision payload fields", () => {
  const patch = listingPatch({ name: "New", logo_id: null, social_links: [], organization: "foreign", requested_billing_interval: "monthly" }, at.toISOString());
  assert.deepEqual(patch, { name: "New", logo: null, social_links: [], status: "published", published_at: at.toISOString() });
  assert.equal("description_translations" in patch, false);
});

test("disabled routes and non-admin retry never touch schema or database", async () => {
  for (const enabled of [false, true]) {
    const routes = new Map();
    registerApprovalRoutes({ post: (path, handler) => routes.set(path, handler) }, {
      env: { FINDELIO_REFERRAL_REGISTRATION_ENABLED: String(enabled) },
      services: {}, database: () => { throw Error("DB must not be called"); },
      getSchema: () => { throw Error("Schema must not be called"); }, logger: {},
    });
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await routes.get("/activate")({ accountability: { user: "firm", admin: false } }, res);
    assert.equal(res.code, enabled ? 403 : 503);
    if (!enabled) {
      await routes.get("/approve-revision")({ accountability: { user: "admin", admin: true } }, res);
      assert.equal(res.code, 503);
    } else {
      await routes.get("/approve-revision")({}, res);
      assert.equal(res.code, 401);
    }
  }
});

test("mail does not promise a pending, expired or revoked trial and localizes all nine languages", () => {
  for (const locale of ["de-ch", "en", "sk", "cs", "hu", "pl", "ru", "pt-pt", "ro"]) {
    const grant = { status: "granted", premium_grant: "g", grant_starts_at: at.toISOString(), grant_ends_at: reservation.trial_ends_at };
    const active = referralMailContent(grant, locale, at);
    assert.ok(active.text.includes("2026"));
    assert.ok(active.suppressCheckout);
    for (const status of ["pending_activation", "expired_unactivated", "skipped_existing_premium"]) {
      const content = referralMailContent({ status }, locale, at);
      assert.ok(content.text.length > 20);
      assert.ok(content.suppressCheckout);
      assert.notEqual(content.text, active.text);
    }
    assert.notEqual(referralMailContent({ ...grant, grant_revoked_at: at }, locale, at).text, active.text);
    assert.notEqual(referralMailContent(grant, locale, new Date("2027-01-01")).text, active.text);
  }
  assert.deepEqual(referralMailContent(null, "de-ch"), { text: "", suppressCheckout: false });
});
