import assert from "node:assert/strict";
import test from "node:test";
import performanceReportHook from "../infra/directus/extensions/directus-extension-findelio-performance-report/dist/index.js";

// In-memory Knex adapter: execute predicates and joins against fixture rows,
// while keeping mail delivery isolated from real recipients.
import { databaseFixture } from "./fixtures/metrics-database.mjs";

function fixture() {
  const tables = { listings: [], subscriptions: [], premium_grants: [], organization_members: [], directus_users: [], listing_metric_reports: [], listing_metrics_daily: [] };
  const sent = [], errors = [];
  let run;
  performanceReportHook({ schedule(expression, callback) { assert.equal(expression, "5 8 1 * *"); run = callback; } }, {
    database: databaseFixture(tables), env: { FINDELIO_SITE_URL: "https://example.test" }, getSchema: async () => ({}),
    logger: { error: (...args) => errors.push(args) },
    services: { MailService: class { async send(message) { sent.push(message); } } },
  });
  function listing(id, { role = "owner", memberStatus = "active", userStatus = "active", email = `${id}@example.test` } = {}) {
    tables.listings.push({ id, name: id, organization: id });
    tables.organization_members.push({ organization: id, user: id, status: memberStatus, role });
    tables.directus_users.push({ id, status: userStatus, email, language: "de" });
  }
  function grant(listing, overrides = {}) {
    tables.premium_grants.push({ listing, starts_at: "2000-01-01T00:00:00Z", ends_at: "2100-01-01T00:00:00Z", revoked_at: null, ...overrides });
  }
  return { tables, sent, errors, listing, grant, run: async () => { await run(); assert.deepEqual(errors, []); } };
}

test("trial-only and unlimited grants receive reports alongside subscriptions, without duplicates", async () => {
  const f = fixture();
  for (const id of ["trial", "unlimited", "paid", "both", "past-due"]) f.listing(id);
  f.grant("trial"); f.grant("unlimited", { ends_at: null }); f.grant("both"); f.grant("both");
  for (const id of ["paid", "both", "past-due"]) f.tables.subscriptions.push({ listing: id, plan: "premium", status: id === "past-due" ? "past_due" : "active" });
  await f.run();
  assert.deepEqual(f.sent.map(m => m.to).sort(), ["both", "paid", "past-due", "trial", "unlimited"].map(id => `${id}@example.test`).sort());
  assert.equal(f.tables.listing_metric_reports.length, 5);
  await f.run();
  assert.equal(f.sent.length, 5, "a second run must not resend logged reports");
});

test("expired, future, revoked grants and ineligible owners do not receive reports", async () => {
  const f = fixture();
  for (const id of ["expired", "future", "revoked", "free"]) f.listing(id);
  f.grant("expired", { ends_at: "2001-01-01T00:00:00Z" });
  f.grant("future", { starts_at: "2099-01-01T00:00:00Z" });
  f.grant("revoked", { revoked_at: "2020-01-01T00:00:00Z" });
  for (const [id, options] of [["member", { role: "member" }], ["inactive-member", { memberStatus: "inactive" }], ["inactive-user", { userStatus: "suspended" }], ["no-email", { email: null }]]) {
    f.listing(id, options); f.grant(id);
  }
  await f.run();
  assert.equal(f.sent.length, 0);
  assert.equal(f.tables.listing_metric_reports.length, 0);
});
